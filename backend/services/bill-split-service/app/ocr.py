import base64
import os
import re
import time
from typing import Optional

import httpx

API_GATEWAY_URL = os.environ.get("API_GATEWAY_URL", "http://api-gateway:8001")
INTERNAL_API_SECRET = os.environ.get("INTERNAL_API_SECRET", "")
VISION_URL = "https://vision.googleapis.com/v1/images:annotate"

_vision_api_key: Optional[str] = None


async def reload_config():
    global _vision_api_key
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                f"{API_GATEWAY_URL}/internal/integrations",
                headers={"x-internal-secret": INTERNAL_API_SECRET},
            )
            data = r.json()
            _vision_api_key = data.get("google_cloud_vision_api_key") or None
    except Exception:
        pass


async def extract_receipt(
    image_bytes: bytes,
    event_id: int = None,
    user_id: int = None,
) -> dict:
    from app.database import log_ocr

    start = time.monotonic()

    if not _vision_api_key:
        log_ocr(
            event_id=event_id,
            user_id=user_id,
            success=False,
            error_msg="No Vision API key configured",
            duration_ms=0,
        )
        return {
            "items": [],
            "tax": 0.0,
            "tip": 0.0,
            "subtotal": 0.0,
            "confidence": "low",
        }

    try:
        b64 = base64.b64encode(image_bytes).decode()
        payload = {
            "requests": [
                {
                    "image": {"content": b64},
                    "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
                }
            ]
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{VISION_URL}?key={_vision_api_key}", json=payload
            )
            resp.raise_for_status()

        text = (
            resp.json()["responses"][0]
            .get("fullTextAnnotation", {})
            .get("text", "")
        )
        result = parse_receipt_text(text)
        duration = int((time.monotonic() - start) * 1000)
        log_ocr(
            event_id=event_id,
            user_id=user_id,
            success=True,
            item_count=len(result["items"]),
            confidence=result["confidence"],
            duration_ms=duration,
        )
        return result

    except Exception as e:
        duration = int((time.monotonic() - start) * 1000)
        log_ocr(
            event_id=event_id,
            user_id=user_id,
            success=False,
            error_msg=str(e)[:500],
            duration_ms=duration,
        )
        return {
            "items": [],
            "tax": 0.0,
            "tip": 0.0,
            "subtotal": 0.0,
            "confidence": "low",
        }


def parse_receipt_text(text: str) -> dict:  # noqa: C901
    lines = [l for l in text.strip().splitlines() if l.strip()]
    items: list[dict] = []
    tax = 0.0
    tip = 0.0

    # Matches US prices: $12.50, 12.50, $ 12.50
    amount_re = re.compile(r'\$?\s*(\d+\.\d{2})')
    # Standalone price line: optional leading $ and/or qty, nothing else
    price_only_re = re.compile(r'^\$?\s*\d+\.\d{2}\s*$')
    # Continuation markers (unit-price prefix lines from some POS systems)
    continuation_re = re.compile(r'^[\s]*([àx@]|\$?\s*\d+\.\d{2})\s*$', re.IGNORECASE)

    # Lines whose content is noise — skip entirely
    noise_re = re.compile(
        r'^\s*('
        r'\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}'           # dates
        r'|\d{1,2}:\d{2}\s*(am|pm)?'                     # times
        r'|\(?\d{3}\)?[\s\-]\d{3}[\s\-]\d{4}'           # phone numbers
        r'|[-=*~_#]{2,}'                                  # dividers
        r'|www\.|http'                                     # URLs
        r')\s*$',
        re.IGNORECASE,
    )

    skip_kw = {
        # Totals / summaries
        "subtotal", "sub total", "sub-total", "net total", "total",
        "balance due", "balance", "amount due", "amount paid",
        "grand total", "new total",
        # Payments
        "change", "cash", "credit", "visa", "mastercard", "amex",
        "discover", "debit", "payment", "paid",
        # Receipt noise
        "thank you", "welcome", "receipt", "check #", "check no",
        "order #", "order no", "table", "server", "guest",
        "transaction", "approval", "auth",
        # Party/cover charges that are aggregate lines, not splittable items
        "large party", "party of", "cover charge", "minimum",
        # Delivery
        "delivery fee", "delivery charge",
    }
    tax_kw = {"tax", "vat", "gst", "hst", "pst", "qst", "mwst"}
    tip_kw = {"tip", "gratuity", "auto grat", "auto-grat", "suggested tip"}
    # Service charge can be tip-like (auto-added) — treat as tip
    service_charge_kw = {"service charge", "service fee"}

    # ── Pass 1: merge "name then price" splits ───────────────────────────────
    # Many POS systems print: "Item Name\n         $12.50"
    # Others use:             "Item Name\nà 4.50  9.00"
    merged: list[str] = []
    for line in lines:
        s = line.strip()
        if not s:
            continue
        if merged and (continuation_re.match(s) or price_only_re.match(s)):
            prev = merged[-1]
            # Only merge if previous line has no price yet
            if not amount_re.search(prev):
                merged[-1] = prev.rstrip() + ' ' + s
                continue
        merged.append(line)
    lines = merged

    # ── Pass 2: lookahead merge — "Burger\n12.00" style ─────────────────────
    merged2: list[str] = []
    i = 0
    while i < len(lines):
        cur = lines[i].strip()
        if (i + 1 < len(lines)
                and not amount_re.search(cur)
                and price_only_re.match(lines[i + 1].strip())
                and len(cur) >= 3):
            merged2.append(cur + ' ' + lines[i + 1].strip())
            i += 2
        else:
            merged2.append(lines[i])
            i += 1
    lines = merged2

    # ── Pass 3: extract ───────────────────────────────────────────────────────
    for line in lines:
        ll = line.lower().strip()

        # Drop noise lines (dates, phones, dividers, URLs)
        if noise_re.match(line.strip()):
            continue
        # Drop very short lines
        if len(ll) < 2:
            continue

        matches = list(amount_re.finditer(line))
        if not matches:
            continue

        # VOID / REFUND / COMP — skip, don't count voided items
        if re.search(r'\b(void|voided|refund|refunded|comp\b|comped)\b', ll):
            continue

        # Use LAST price on the line (handles "qty × unit   total" patterns)
        last_match = matches[-1]
        amount = float(last_match.group(1))

        # Skip zero-price lines (complimentary water, bread, etc.)
        if amount == 0.0:
            continue

        # Discount/promo lines — skip (negative prices show as "DISC  3.50")
        if re.search(r'\b(disc|discount|promo|coupon|savings?|off)\b', ll):
            continue

        # Extract name: everything before the first price match
        name = line[: matches[0].start()].strip()
        # Clean trailing separators and unit markers
        name = re.sub(r'[\s\.,:;àx@#*\|]+$', '', name, flags=re.IGNORECASE).strip()
        # Strip leading quantity: "2x ", "2 ", "(2) ", "2: "
        name = re.sub(r'^\(?(\d+)\)?\s*[xX:]?\s+', '', name).strip()
        # Strip leading item codes: "A1234 ", "001 "
        name = re.sub(r'^[A-Z]?\d{3,}\s+', '', name).strip()

        if any(k in ll for k in tax_kw):
            tax = max(tax, amount)   # keep the largest tax line if multiple
        elif any(k in ll for k in tip_kw):
            tip = max(tip, amount)
        elif any(k in ll for k in service_charge_kw):
            tip = max(tip, amount)   # treat auto-added service charge as tip
        elif any(k in ll for k in skip_kw):
            continue
        elif name and len(name) >= 2:
            items.append({"name": name, "price": amount})

    subtotal = round(sum(i["price"] for i in items), 2)
    confidence = "high" if len(items) >= 2 else ("medium" if len(items) == 1 else "low")
    return {
        "items": items,
        "tax": tax,
        "tip": tip,
        "subtotal": subtotal,
        "confidence": confidence,
    }
