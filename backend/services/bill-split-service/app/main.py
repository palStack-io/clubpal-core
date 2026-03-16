import asyncio
import os
import uuid
from typing import Optional

import httpx
from cachetools import TTLCache
from fastapi import FastAPI, HTTPException, Header, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from app.database import (
    init_db,
    create_bill_split,
    create_bill_item,
    create_bill_share,
    get_split_by_event,
    get_split_by_id,
    get_items_by_split,
    get_shares_by_split,
    get_share_by_token,
    get_share_by_split_user,
    mark_share_paid,
    update_split_status,
    get_ocr_stats,
    set_claim_token,
    get_split_by_claim_token,
    upsert_claim,
    submit_claim,
    get_claims_by_split,
    apply_claims_to_items,
    delete_shares_by_split,
)
from app.models import (
    CreateBillSplitRequest,
    BillItemResponse,
    BillShareResponse,
    BillSplitResponse,
    OCRStatsResponse,
    StartClaimingResponse,
    ClaimItemsRequest,
    ClaimStatusResponse,
    ClaimStatusMember,
    ClaimViewResponse,
)
from app.utils import compute_shares
from app.ocr import extract_receipt, reload_config
from app.email_service import send_member_email, send_payer_summary_email

# ── Configuration ─────────────────────────────────────────────────────────────

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://clubpal:clubpal@db:5432/clubpal_billsplit"
)
API_GATEWAY_URL = os.environ.get("API_GATEWAY_URL", "http://api-gateway:8001")
EVENTS_SERVICE_URL = os.environ.get("EVENTS_SERVICE_URL", "http://events-service:8003")
INTERNAL_API_SECRET = os.environ.get("INTERNAL_API_SECRET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:9000")

# ── Session cache (60-second TTL, avoids hammering gateway) ──────────────────

_session_cache: TTLCache = TTLCache(maxsize=256, ttl=60)

# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(title="ClubPal Bill Split Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    init_db()
    await reload_config()
    print("Bill split service started")


# ── Auth dependency ────────────────────────────────────────────────────────────

async def verify_session(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization")

    token = authorization[len("Bearer "):]

    if token in _session_cache:
        return _session_cache[token]

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                f"{API_GATEWAY_URL}/auth/me",
                headers={"Authorization": authorization},
            )
            if r.status_code == 200:
                user = r.json()
                _session_cache[token] = user
                return user
    except Exception:
        pass

    raise HTTPException(status_code=401, detail="Invalid or expired session")


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _fetch_user_profile(uid: int) -> dict:
    """Fetch a single user profile from the gateway. Returns minimal fallback on failure."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                f"{API_GATEWAY_URL}/users/{uid}/profile",
                headers={"x-internal-secret": INTERNAL_API_SECRET},
            )
            if r.status_code == 200:
                return r.json()
    except Exception:
        pass
    return {"id": uid, "full_name": f"User {uid}", "avatar_url": None, "email": ""}


async def _fetch_event(event_id: int, caller_id: int) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                f"{EVENTS_SERVICE_URL}/events/{event_id}",
                params={"user_id": caller_id},
            )
            if r.status_code == 200:
                return r.json()
    except Exception:
        pass
    return None


async def _fetch_attendees(event_id: int, caller_id: int) -> list:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                f"{EVENTS_SERVICE_URL}/events/{event_id}/attendees",
                params={"user_id": caller_id},
            )
            if r.status_code == 200:
                data = r.json()
                if isinstance(data, list):
                    return data
                return data.get("attendees", [])
    except Exception:
        pass
    return []


def _build_split_response(split: dict, items: list, shares: list, profiles: dict) -> BillSplitResponse:
    payer_profile = profiles.get(split["paid_by_user_id"], {})
    paid_by_name = payer_profile.get("full_name") or f"User {split['paid_by_user_id']}"

    item_responses = [
        BillItemResponse(
            id=item["id"],
            name=item["name"],
            price=float(item["price"]),
            assigned_to=item.get("assigned_to") or [],
        )
        for item in items
    ]

    share_responses = []
    for share in shares:
        profile = profiles.get(share["user_id"], {})
        paid_at_str = None
        if share.get("paid_at"):
            paid_at_str = str(share["paid_at"])
        share_responses.append(
            BillShareResponse(
                user_id=share["user_id"],
                full_name=profile.get("full_name") or f"User {share['user_id']}",
                avatar_url=profile.get("avatar_url"),
                items_subtotal=float(share["items_subtotal"]),
                tax_share=float(share["tax_share"]),
                tip_share=float(share["tip_share"]),
                total_owed=float(share["total_owed"]),
                paid=bool(share["paid"]),
                paid_at=paid_at_str,
            )
        )

    return BillSplitResponse(
        id=split["id"],
        event_id=split["event_id"],
        paid_by_user_id=split["paid_by_user_id"],
        paid_by_name=paid_by_name,
        subtotal=float(split["subtotal"]),
        tax_amount=float(split["tax_amount"]),
        tip_amount=float(split["tip_amount"]),
        total_amount=float(split["total_amount"]),
        payment_note=split.get("payment_note"),
        status=split["status"],
        items=item_responses,
        shares=share_responses,
        created_at=str(split["created_at"]),
    )


async def send_all_emails(
    split_id: int,
    payer_id: int,
    payer_name: str,
    payer_email: str,
    event_name: str,
    event_date: str,
    payment_note: Optional[str],
    shares_with_profiles: list,
    items_by_user: dict,
):
    frontend_url = FRONTEND_URL

    for share in shares_with_profiles:
        if share["user_id"] == payer_id:
            continue
        mark_paid_url = f"{frontend_url}/pay/{share['payment_token']}"
        await send_member_email(
            to_email=share["email"],
            member_name=share["full_name"],
            payer_name=payer_name,
            event_name=event_name,
            event_date=event_date,
            assigned_items=items_by_user.get(share["user_id"], []),
            tax_share=share["tax_share"],
            tip_share=share["tip_share"],
            total_owed=share["total_owed"],
            payment_note=payment_note,
            mark_paid_url=mark_paid_url,
        )

    event_url = f"{frontend_url}/events/{shares_with_profiles[0]['event_id'] if shares_with_profiles else ''}"
    total_paid = sum(s["total_owed"] for s in shares_with_profiles)
    await send_payer_summary_email(
        to_email=payer_email,
        payer_name=payer_name,
        event_name=event_name,
        event_date=event_date,
        total_paid=total_paid,
        shares=shares_with_profiles,
        event_url=event_url,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "bill-split-service"}


@app.post("/admin/reload-config")
async def admin_reload_config(x_internal_secret: Optional[str] = Header(None)):
    if x_internal_secret != INTERNAL_API_SECRET or not INTERNAL_API_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    await reload_config()
    return {"ok": True}


@app.post("/ocr")
async def ocr_receipt(
    receipt: UploadFile = File(...),
    current_user: dict = Depends(verify_session),
):
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if receipt.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {receipt.content_type}. Use JPEG, PNG, or WebP.",
        )

    data = await receipt.read()
    max_bytes = 10 * 1024 * 1024  # 10 MB
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB)")

    result = await extract_receipt(data, user_id=current_user["id"])
    return result


@app.post("/", response_model=BillSplitResponse, status_code=201)
async def create_split(
    req: CreateBillSplitRequest,
    current_user: dict = Depends(verify_session),
):
    caller_id = current_user["id"]

    # 1. Verify event exists
    event = await _fetch_event(req.event_id, caller_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # 2. Fetch attendees from events-service
    attendees = await _fetch_attendees(req.event_id, caller_id)
    real_attendee_ids = set()
    for a in attendees:
        uid = a.get("user_id") or a.get("id")
        if uid:
            real_attendee_ids.add(int(uid))

    # 3. Cross-reference requested attending_user_ids with real attendees
    valid_attending_ids = [
        uid for uid in req.attending_user_ids if uid in real_attendee_ids
    ]
    if not valid_attending_ids:
        # Fall back to all going attendees
        valid_attending_ids = [
            a.get("user_id") or a.get("id")
            for a in attendees
            if (a.get("status") or "").lower() in ("going", "attending")
        ]
        valid_attending_ids = [uid for uid in valid_attending_ids if uid]
        if not valid_attending_ids:
            valid_attending_ids = list(real_attendee_ids)

    # Ensure payer is included
    if caller_id not in valid_attending_ids:
        valid_attending_ids.insert(0, caller_id)

    # 4. Check for existing split
    existing = get_split_by_event(req.event_id)
    if existing:
        raise HTTPException(
            status_code=409, detail="A bill split already exists for this event"
        )

    # 5. Payer is current user
    payer_id = caller_id

    # 6. Compute shares
    items_as_dicts = [
        {"name": it.name, "price": it.price, "assigned_to": it.assigned_to}
        for it in req.items
    ]
    computed = compute_shares(
        items=items_as_dicts,
        tax=req.tax_amount,
        tip=req.tip_amount,
        attending_user_ids=valid_attending_ids,
        paid_by_user_id=payer_id,
    )

    subtotal = round(sum(it.price for it in req.items), 2)
    total_amount = round(subtotal + req.tax_amount + req.tip_amount, 2)

    # 7. Insert into DB
    split_row = create_bill_split(
        event_id=req.event_id,
        paid_by_user_id=payer_id,
        subtotal=subtotal,
        tax_amount=req.tax_amount,
        tip_amount=req.tip_amount,
        total_amount=total_amount,
        payment_note=req.payment_note,
    )
    split_id = split_row["id"]

    item_rows = []
    for it in req.items:
        row = create_bill_item(split_id, it.name, it.price, it.assigned_to)
        item_rows.append(row)

    share_rows = []
    for cs in computed:
        token = str(uuid.uuid4())
        row = create_bill_share(
            split_id=split_id,
            user_id=cs["user_id"],
            items_subtotal=cs["items_subtotal"],
            tax_share=cs["tax_share"],
            tip_share=cs["tip_share"],
            total_owed=cs["total_owed"],
            payment_token=token,
            paid=cs["paid"],
        )
        share_rows.append(row)

    # 8. Fetch user profiles concurrently
    profile_tasks = [_fetch_user_profile(uid) for uid in valid_attending_ids]
    profiles_list = await asyncio.gather(*profile_tasks)
    profiles = {p["id"]: p for p in profiles_list}

    # 9. Build items_by_user for email
    items_by_user: dict = {}
    for item_row in item_rows:
        assigned = item_row.get("assigned_to") or []
        if not assigned:
            # Unassigned goes to all
            for uid in valid_attending_ids:
                items_by_user.setdefault(uid, []).append(
                    {"name": item_row["name"], "price": float(item_row["price"])}
                )
        else:
            for uid in assigned:
                items_by_user.setdefault(uid, []).append(
                    {"name": item_row["name"], "price": float(item_row["price"])}
                )

    # Build shares_with_profiles for email
    shares_for_email = []
    for share in share_rows:
        profile = profiles.get(share["user_id"], {})
        shares_for_email.append(
            {
                **share,
                "full_name": profile.get("full_name") or f"User {share['user_id']}",
                "email": profile.get("email") or "",
                "total_owed": float(share["total_owed"]),
                "tax_share": float(share["tax_share"]),
                "tip_share": float(share["tip_share"]),
                "event_id": req.event_id,
            }
        )

    payer_profile = profiles.get(payer_id, {})
    payer_name = payer_profile.get("full_name") or f"User {payer_id}"
    payer_email = payer_profile.get("email") or ""

    event_name = event.get("title") or event.get("name") or f"Event {req.event_id}"
    event_date = str(event.get("date") or event.get("event_date") or "")

    # 9. Fire-and-forget emails
    asyncio.create_task(
        send_all_emails(
            split_id=split_id,
            payer_id=payer_id,
            payer_name=payer_name,
            payer_email=payer_email,
            event_name=event_name,
            event_date=event_date,
            payment_note=req.payment_note,
            shares_with_profiles=shares_for_email,
            items_by_user=items_by_user,
        )
    )

    # 10. Update status to 'sent'
    update_split_status(split_id, "sent")
    split_row = get_split_by_id(split_id)

    return _build_split_response(split_row, item_rows, share_rows, profiles)


@app.get("/event/{event_id}", response_model=BillSplitResponse)
async def get_split_for_event(
    event_id: int,
    current_user: dict = Depends(verify_session),
):
    caller_id = current_user["id"]

    split = get_split_by_event(event_id)
    if not split:
        raise HTTPException(status_code=404, detail="No bill split found for this event")

    # Validate caller is an attendee
    attendees = await _fetch_attendees(event_id, caller_id)
    attendee_ids = set()
    for a in attendees:
        uid = a.get("user_id") or a.get("id")
        if uid:
            attendee_ids.add(int(uid))

    if caller_id not in attendee_ids and caller_id != split["paid_by_user_id"]:
        raise HTTPException(status_code=403, detail="You are not an attendee of this event")

    items = get_items_by_split(split["id"])
    shares = get_shares_by_split(split["id"])

    user_ids = list({s["user_id"] for s in shares} | {split["paid_by_user_id"]})
    profile_tasks = [_fetch_user_profile(uid) for uid in user_ids]
    profiles_list = await asyncio.gather(*profile_tasks)
    profiles = {p["id"]: p for p in profiles_list}

    return _build_split_response(split, items, shares, profiles)


@app.post("/pay/{payment_token}")
async def pay_by_token(payment_token: str):
    share = get_share_by_token(payment_token)
    if not share:
        raise HTTPException(status_code=404, detail="Payment token not found")

    if share["paid"]:
        # Already paid — return success idempotently
        split = get_split_by_id(share["split_id"])
        event_name = f"Event {split['event_id']}" if split else "Event"
        # Best effort: fetch event name
        if split:
            event = await _fetch_event(split["event_id"], split["paid_by_user_id"])
            if event:
                event_name = event.get("title") or event.get("name") or event_name
        return {
            "success": True,
            "already_paid": True,
            "member_name": f"User {share['user_id']}",
            "amount": float(share["total_owed"]),
            "event_name": event_name,
        }

    mark_share_paid(share["id"])

    split = get_split_by_id(share["split_id"])
    event_name = f"Event {split['event_id']}" if split else "Event"

    if split:
        event = await _fetch_event(split["event_id"], split["paid_by_user_id"])
        if event:
            event_name = event.get("title") or event.get("name") or event_name

    # Fetch user profile for display name
    profile = await _fetch_user_profile(share["user_id"])
    member_name = profile.get("full_name") or f"User {share['user_id']}"

    return {
        "success": True,
        "member_name": member_name,
        "amount": float(share["total_owed"]),
        "event_name": event_name,
    }


@app.patch("/{split_id}/shares/{user_id}/paid")
async def mark_user_share_paid(
    split_id: int,
    user_id: int,
    current_user: dict = Depends(verify_session),
):
    split = get_split_by_id(split_id)
    if not split:
        raise HTTPException(status_code=404, detail="Bill split not found")

    if current_user["id"] != split["paid_by_user_id"]:
        raise HTTPException(
            status_code=403,
            detail="Only the payer can manually mark shares as paid",
        )

    share = get_share_by_split_user(split_id, user_id)
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    mark_share_paid(share["id"])

    # Return updated share
    updated = get_share_by_split_user(split_id, user_id)
    profile = await _fetch_user_profile(user_id)

    paid_at_str = str(updated["paid_at"]) if updated.get("paid_at") else None
    return BillShareResponse(
        user_id=updated["user_id"],
        full_name=profile.get("full_name") or f"User {user_id}",
        avatar_url=profile.get("avatar_url"),
        items_subtotal=float(updated["items_subtotal"]),
        tax_share=float(updated["tax_share"]),
        tip_share=float(updated["tip_share"]),
        total_owed=float(updated["total_owed"]),
        paid=bool(updated["paid"]),
        paid_at=paid_at_str,
    )


@app.post("/{split_id}/reminders")
async def send_reminders(
    split_id: int,
    current_user: dict = Depends(verify_session),
):
    split = get_split_by_id(split_id)
    if not split:
        raise HTTPException(status_code=404, detail="Bill split not found")

    if current_user["id"] != split["paid_by_user_id"]:
        raise HTTPException(status_code=403, detail="Only the payer can send reminders")

    shares = get_shares_by_split(split_id)
    items = get_items_by_split(split_id)

    # Only pending (unpaid, non-payer) shares
    pending = [
        s for s in shares
        if not s["paid"] and s["user_id"] != split["paid_by_user_id"]
    ]

    if not pending:
        return {"sent": 0}

    # Best-effort: fetch event info
    event = await _fetch_event(split["event_id"], current_user["id"])
    event_name = (event.get("title") or event.get("name") or f"Event {split['event_id']}") if event else f"Event {split['event_id']}"
    event_date = str(event.get("date") or event.get("event_date") or "") if event else ""

    payer_profile = await _fetch_user_profile(split["paid_by_user_id"])
    payer_name = payer_profile.get("full_name") or f"User {split['paid_by_user_id']}"

    # Build items_by_user
    items_by_user: dict = {}
    for item_row in items:
        assigned = item_row.get("assigned_to") or []
        for uid in [s["user_id"] for s in pending]:
            if not assigned or uid in assigned:
                items_by_user.setdefault(uid, []).append(
                    {"name": item_row["name"], "price": float(item_row["price"])}
                )

    sent_count = 0
    for share in pending:
        profile = await _fetch_user_profile(share["user_id"])
        to_email = profile.get("email") or ""
        if not to_email:
            continue
        mark_paid_url = f"{FRONTEND_URL}/pay/{share['payment_token']}"
        await send_member_email(
            to_email=to_email,
            member_name=profile.get("full_name") or f"User {share['user_id']}",
            payer_name=payer_name,
            event_name=event_name,
            event_date=event_date,
            assigned_items=items_by_user.get(share["user_id"], []),
            tax_share=float(share["tax_share"]),
            tip_share=float(share["tip_share"]),
            total_owed=float(share["total_owed"]),
            payment_note=split.get("payment_note"),
            mark_paid_url=mark_paid_url,
        )
        sent_count += 1

    return {"sent": sent_count}


@app.post("/{split_id}/start-claiming", response_model=StartClaimingResponse)
async def start_claiming(
    split_id: int,
    current_user: dict = Depends(verify_session),
):
    split = get_split_by_id(split_id)
    if not split:
        raise HTTPException(status_code=404, detail="Bill split not found")
    if current_user["id"] != split["paid_by_user_id"]:
        raise HTTPException(status_code=403, detail="Only the payer can start claiming")

    # Generate or reuse existing claim token; always ensure status is 'claiming'
    token = split.get("claim_token")
    if not token:
        token = str(uuid.uuid4())
        set_claim_token(split_id, token)
    if split["status"] != "claiming":
        update_split_status(split_id, "claiming")

    claim_url = f"{FRONTEND_URL}/claim/{token}"
    return StartClaimingResponse(claim_token=token, claim_url=claim_url)


@app.get("/claim/{claim_token}", response_model=ClaimViewResponse)
async def get_claim_view(
    claim_token: str,
    current_user: dict = Depends(verify_session),
):
    split = get_split_by_claim_token(claim_token)
    if not split:
        raise HTTPException(status_code=404, detail="Claim link not found or expired")

    if split["status"] not in ("claiming", "draft"):
        raise HTTPException(status_code=410, detail="Claiming is no longer open for this bill")

    items = get_items_by_split(split["id"])
    claims = get_claims_by_split(split["id"])

    # Find current user's existing claim
    my_claim = next((c for c in claims if c["user_id"] == current_user["id"]), None)
    my_claimed_items = my_claim["claimed_items"] if my_claim else []
    already_submitted = bool(my_claim and my_claim.get("submitted_at"))

    # Fetch event name and payer name
    event = await _fetch_event(split["event_id"], current_user["id"])
    event_name = (event.get("title") or event.get("name") or f"Event {split['event_id']}") if event else f"Event {split['event_id']}"

    payer_profile = await _fetch_user_profile(split["paid_by_user_id"])
    payer_name = payer_profile.get("full_name") or f"User {split['paid_by_user_id']}"

    item_responses = [
        BillItemResponse(
            id=item["id"],
            name=item["name"],
            price=float(item["price"]),
            assigned_to=item.get("assigned_to") or [],
        )
        for item in items
    ]

    return ClaimViewResponse(
        split_id=split["id"],
        event_id=split["event_id"],
        event_name=event_name,
        payer_name=payer_name,
        items=item_responses,
        tax_amount=float(split["tax_amount"]),
        tip_amount=float(split["tip_amount"]),
        total_amount=float(split["total_amount"]),
        my_claimed_items=my_claimed_items,
        already_submitted=already_submitted,
    )


@app.post("/claim/{claim_token}/submit")
async def submit_my_claim(
    claim_token: str,
    req: ClaimItemsRequest,
    current_user: dict = Depends(verify_session),
):
    split = get_split_by_claim_token(claim_token)
    if not split:
        raise HTTPException(status_code=404, detail="Claim link not found")
    if split["status"] not in ("claiming", "draft"):
        raise HTTPException(status_code=410, detail="Claiming is no longer open")

    # Validate item IDs belong to this split
    items = get_items_by_split(split["id"])
    valid_ids = {item["id"] for item in items}
    invalid = [iid for iid in req.claimed_items if iid not in valid_ids]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid item IDs: {invalid}")

    submit_claim(split["id"], current_user["id"], req.claimed_items)
    return {"ok": True, "submitted": True}


@app.get("/{split_id}/claiming-status", response_model=ClaimStatusResponse)
async def get_claiming_status(
    split_id: int,
    current_user: dict = Depends(verify_session),
):
    split = get_split_by_id(split_id)
    if not split:
        raise HTTPException(status_code=404, detail="Bill split not found")
    if current_user["id"] != split["paid_by_user_id"]:
        raise HTTPException(status_code=403, detail="Only the payer can view claiming status")

    claims = get_claims_by_split(split_id)
    # Get all shares to know total members
    shares = get_shares_by_split(split_id)
    attending_ids = [s["user_id"] for s in shares]

    profile_tasks = [_fetch_user_profile(uid) for uid in attending_ids]
    profiles_list = await asyncio.gather(*profile_tasks)
    profiles = {p["id"]: p for p in profiles_list}

    claims_by_user = {c["user_id"]: c for c in claims}

    members = []
    submitted_count = 0
    for uid in attending_ids:
        profile = profiles.get(uid, {})
        claim = claims_by_user.get(uid)
        submitted = bool(claim and claim.get("submitted_at"))
        if submitted:
            submitted_count += 1
        members.append(ClaimStatusMember(
            user_id=uid,
            full_name=profile.get("full_name") or f"User {uid}",
            avatar_url=profile.get("avatar_url"),
            submitted=submitted,
            submitted_at=str(claim["submitted_at"]) if claim and claim.get("submitted_at") else None,
            claimed_items=claim["claimed_items"] if claim else [],
        ))

    claim_token = split.get("claim_token") or ""
    return ClaimStatusResponse(
        split_id=split_id,
        status=split["status"],
        claim_token=claim_token,
        claim_url=f"{FRONTEND_URL}/claim/{claim_token}" if claim_token else "",
        total_members=len(attending_ids),
        submitted_count=submitted_count,
        members=members,
    )


@app.post("/{split_id}/finalize")
async def finalize_claims(
    split_id: int,
    current_user: dict = Depends(verify_session),
):
    """
    Payer finalizes collaborative claiming:
    1. Merge all submitted claims into item.assigned_to
    2. Recompute shares from new assignments
    3. Delete old shares, insert new shares
    4. Update status to 'sent', send emails
    """
    split = get_split_by_id(split_id)
    if not split:
        raise HTTPException(status_code=404, detail="Bill split not found")
    if current_user["id"] != split["paid_by_user_id"]:
        raise HTTPException(status_code=403, detail="Only the payer can finalize")
    if split["status"] == "sent":
        raise HTTPException(status_code=409, detail="Bill split has already been finalized and sent")

    claims = get_claims_by_split(split_id)
    items = get_items_by_split(split_id)

    # Build item_assignments from claims: item_id -> set of user_ids who claimed it
    item_assignments: dict = {}
    for claim in claims:
        if not claim.get("submitted_at"):
            continue  # skip unsubmitted
        for item_id in claim["claimed_items"]:
            item_assignments.setdefault(item_id, [])
            if claim["user_id"] not in item_assignments[item_id]:
                item_assignments[item_id].append(claim["user_id"])

    # Apply to DB
    if item_assignments:
        apply_claims_to_items(split_id, item_assignments)

    # Reload items with new assignments
    items = get_items_by_split(split_id)

    # Get attending user IDs from existing shares
    old_shares = get_shares_by_split(split_id)
    attending_ids = [s["user_id"] for s in old_shares]

    items_as_dicts = [
        {"name": it["name"], "price": float(it["price"]), "assigned_to": it.get("assigned_to") or []}
        for it in items
    ]
    computed = compute_shares(
        items=items_as_dicts,
        tax=float(split["tax_amount"]),
        tip=float(split["tip_amount"]),
        attending_user_ids=attending_ids,
        paid_by_user_id=split["paid_by_user_id"],
    )

    # Delete old shares and reinsert
    delete_shares_by_split(split_id)

    new_share_rows = []
    for cs in computed:
        # Reuse old payment token if possible
        old = next((s for s in old_shares if s["user_id"] == cs["user_id"]), None)
        token = old["payment_token"] if old else str(uuid.uuid4())
        row = create_bill_share(
            split_id=split_id,
            user_id=cs["user_id"],
            items_subtotal=cs["items_subtotal"],
            tax_share=cs["tax_share"],
            tip_share=cs["tip_share"],
            total_owed=cs["total_owed"],
            payment_token=token,
            paid=old["paid"] if old else cs["paid"],
        )
        new_share_rows.append(row)

    # Fetch profiles
    profile_tasks = [_fetch_user_profile(uid) for uid in attending_ids]
    profiles_list = await asyncio.gather(*profile_tasks)
    profiles = {p["id"]: p for p in profiles_list}

    # Build items_by_user for email
    items_by_user: dict = {}
    for item_row in items:
        assigned = item_row.get("assigned_to") or []
        if not assigned:
            for uid in attending_ids:
                items_by_user.setdefault(uid, []).append(
                    {"name": item_row["name"], "price": float(item_row["price"])}
                )
        else:
            for uid in assigned:
                items_by_user.setdefault(uid, []).append(
                    {"name": item_row["name"], "price": float(item_row["price"])}
                )

    # Build shares_for_email
    shares_for_email = []
    for share in new_share_rows:
        profile = profiles.get(share["user_id"], {})
        shares_for_email.append({
            **share,
            "full_name": profile.get("full_name") or f"User {share['user_id']}",
            "email": profile.get("email") or "",
            "total_owed": float(share["total_owed"]),
            "tax_share": float(share["tax_share"]),
            "tip_share": float(share["tip_share"]),
            "event_id": split["event_id"],
        })

    payer_profile = profiles.get(split["paid_by_user_id"], {})
    payer_name = payer_profile.get("full_name") or f"User {split['paid_by_user_id']}"
    payer_email = payer_profile.get("email") or ""

    event = await _fetch_event(split["event_id"], split["paid_by_user_id"])
    event_name = (event.get("title") or event.get("name") or f"Event {split['event_id']}") if event else f"Event {split['event_id']}"
    event_date = str(event.get("date") or event.get("event_date") or "") if event else ""

    asyncio.create_task(
        send_all_emails(
            split_id=split_id,
            payer_id=split["paid_by_user_id"],
            payer_name=payer_name,
            payer_email=payer_email,
            event_name=event_name,
            event_date=event_date,
            payment_note=split.get("payment_note"),
            shares_with_profiles=shares_for_email,
            items_by_user=items_by_user,
        )
    )

    update_split_status(split_id, "sent")
    split_row = get_split_by_id(split_id)

    return _build_split_response(split_row, items, new_share_rows, profiles)


@app.get("/admin/ocr-stats", response_model=OCRStatsResponse)
async def ocr_stats(current_user: dict = Depends(verify_session)):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")

    from app import ocr as ocr_module

    raw = get_ocr_stats()
    calls_this_month = raw["calls_this_month"]
    total_month = raw["total_count_month"]
    success_month = raw["success_count_month"]

    success_rate = (
        round((success_month / total_month) * 100, 1) if total_month else 0.0
    )
    high_conf_pct = (
        round((raw["high_confidence_count"] / total_month) * 100, 1)
        if total_month
        else 0.0
    )

    return OCRStatsResponse(
        calls_today=raw["calls_today"],
        calls_this_month=calls_this_month,
        success_rate_pct=success_rate,
        avg_items_extracted=round(raw["avg_items"], 2),
        avg_duration_ms=round(raw["avg_duration_ms"], 1),
        high_confidence_pct=high_conf_pct,
        estimated_cost_usd=round(calls_this_month * 0.0015, 4),
        key_configured=ocr_module._vision_api_key is not None,
    )
