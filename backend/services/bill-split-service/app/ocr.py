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


def parse_receipt_text(text: str) -> dict:
    lines = text.strip().splitlines()
    items = []
    tax = 0.0
    tip = 0.0

    amount_re = re.compile(r'\$?\s*(\d+\.\d{2})')
    skip_kw = {
        "subtotal", "sub total", "total", "balance", "change",
        "cash", "credit", "amount due",
    }
    tax_kw = {"tax", "vat", "gst", "hst", "pst"}
    tip_kw = {"tip", "gratuity", "service charge", "service fee"}

    for line in lines:
        ll = line.lower().strip()
        m = amount_re.search(line)
        if not m:
            continue
        amount = float(m.group(1))
        name = line[: m.start()].strip().rstrip(".:").strip()

        if any(k in ll for k in tax_kw):
            tax = amount
        elif any(k in ll for k in tip_kw):
            tip = amount
        elif any(k in ll for k in skip_kw):
            continue
        elif name:
            items.append({"name": name, "price": amount})

    subtotal = round(sum(i["price"] for i in items), 2)
    confidence = "high" if len(items) >= 2 else "low"
    return {
        "items": items,
        "tax": tax,
        "tip": tip,
        "subtotal": subtotal,
        "confidence": confidence,
    }
