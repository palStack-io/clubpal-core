"""
Party Invite module — host management routes and public /p/ routes.
Both routers are registered in main.py via app.include_router().
"""
import os
import hmac
import secrets
import hashlib
import time
import httpx
from collections import defaultdict
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Header, Depends, Request
from fastapi import Query
from pydantic import BaseModel, Field

from app import storage
from app import bring_sync
from app.database import get_db, get_event, update_event, get_comments, get_event_bring_items
from app.party_invites_db import (
    create_party_invite, get_party_invite_by_token, get_party_invite_by_event_id,
    update_party_invite, add_group_to_invite, get_invite_groups,
    create_guest_rsvp, get_guest_rsvp, update_guest_rsvp, get_all_guests,
    guest_has_rsvpd, upsert_email_notification, get_email_notifications,
    create_invite_item, delete_invite_item, get_invite_items,
    claim_item, increment_view_count,
    add_member_invite, get_member_invites,
)

GROUPS_SERVICE_URL = "http://groups-service:8002"
GATEWAY_URL        = "http://api-gateway:8001"

_ACTIVITY_DEFAULTS = {
    "dining":  {"variant": "warm",      "bg_animation": "fireworks", "accent_color": "#f59e0b"},
    "hiking":  {"variant": "outdoor",   "bg_animation": "waves",     "accent_color": "#22d3a0"},
    "gaming":  {"variant": "neon",      "bg_animation": "sparkles",  "accent_color": "#a855f7"},
    "movies":  {"variant": "cinematic", "bg_animation": "none",      "accent_color": "#6366f1"},
    "arts":    {"variant": "pastel",    "bg_animation": "confetti",  "accent_color": "#fb7185"},
    "other":   {"variant": "default",   "bg_animation": "confetti",  "accent_color": "#f43f5e"},
}

host_router   = APIRouter(prefix="/party-invites", tags=["party-invites"])
public_router = APIRouter(prefix="/p", tags=["party-invites-public"])


# ── Auth helper (mirrors main.py — avoids circular import) ───────────────────

def _get_current_user_id(authorization: Optional[str] = Header(None)) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization")
    try:
        r = httpx.get(
            f"{GATEWAY_URL}/auth/me",
            headers={"Authorization": authorization},
            timeout=5.0,
        )
        if r.status_code == 200:
            return r.json()["id"]
    except Exception:
        pass
    raise HTTPException(status_code=401, detail="Invalid or expired session")


# ── Internal service helpers ──────────────────────────────────────────────────

async def _get_group_members(group_id: int) -> list:
    internal = os.getenv("INTERNAL_API_SECRET", "")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                f"{GROUPS_SERVICE_URL}/internal/groups/{group_id}/members",
                headers={"x-internal-secret": internal},
            )
            return r.json() if r.status_code == 200 else []
    except Exception:
        return []


async def _get_group_rotation(group_id: int) -> dict:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{GROUPS_SERVICE_URL}/groups/{group_id}/rotation")
            if r.status_code == 200:
                return r.json()
    except Exception:
        pass
    return {}


async def _get_host_profile(host_user_id: int) -> dict:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(
                f"{GATEWAY_URL}/internal/users/{host_user_id}/profile",
                headers={"x-internal-secret": os.getenv("INTERNAL_API_SECRET", "")},
            )
            if r.status_code == 200:
                return r.json()
    except Exception:
        pass
    return {}


async def _notify_invite_to_group(group_id: int, event_id: int,
                                   event_title: str, invite_token: str) -> None:
    internal = os.getenv("INTERNAL_API_SECRET", "")
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{GATEWAY_URL}/internal/notify/event",
                json={
                    "group_id": group_id,
                    "event_id": event_id,
                    "event_title": event_title,
                    "type": "party_invite",
                    "invite_token": invite_token,
                },
                headers={"x-internal-secret": internal},
            )
    except Exception:
        pass


def _add_pending_attendees(event_id: int, members: list) -> None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM event_attendees WHERE event_id = %s", (event_id,))
    existing = {r["user_id"] for r in cursor.fetchall()}
    for m in members:
        uid = m.get("user_id")
        if uid and uid not in existing:
            try:
                cursor.execute(
                    "INSERT INTO event_attendees (event_id, user_id, status) VALUES (%s, %s, 'pending') ON CONFLICT DO NOTHING",
                    (event_id, uid)
                )
            except Exception:
                pass
    conn.commit()
    conn.close()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class PartyInviteCreate(BaseModel):
    event_id: int
    group_ids: List[int] = Field(default_factory=list)
    theme_activity_type: str = "other"
    theme_variant: Optional[str] = None
    bg_animation: Optional[str] = None
    accent_color: Optional[str] = None
    bring_list_enabled: bool = False
    bring_list_type: str = "freeform"
    style: str = "glass"
    cover_image_url: Optional[str] = None
    cover_image_position: Optional[str] = None
    items: List[dict] = Field(default_factory=list)


class PartyInvitePatch(BaseModel):
    theme_activity_type: Optional[str] = None
    theme_variant: Optional[str] = None
    bg_animation: Optional[str] = None
    accent_color: Optional[str] = None
    cover_image_url: Optional[str] = None
    cover_image_position: Optional[str] = None
    sticker_data: Optional[list] = None
    bring_list_enabled: Optional[bool] = None
    bring_list_type: Optional[str] = None
    style: Optional[str] = None


class InviteUsersRequest(BaseModel):
    user_ids: List[int] = Field(default_factory=list)
    emails: List[str] = Field(default_factory=list)


class InviteItemCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=200)
    emoji: str = ""
    max_claims: int = Field(1, ge=1)
    sort_order: int = 0


class ShareToGroupRequest(BaseModel):
    group_id: int


class CoverUploadRequest(BaseModel):
    filename: str = "cover.jpg"
    content_type: str = "image/jpeg"


class GuestRsvpCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=3, max_length=255)
    status: str = Field("going", pattern="^(going|maybe|not_going)$")
    bring_note: Optional[str] = Field(None, max_length=500)
    claim_item_id: Optional[int] = None
    email_opt_in: bool = False
    plus_ones: int = Field(0, ge=0, le=20)


class GuestRsvpPatch(BaseModel):
    status: Optional[str] = Field(None, pattern="^(going|maybe|not_going)$")
    bring_note: Optional[str] = Field(None, max_length=500)
    claim_item_id: Optional[int] = None
    edit_token: Optional[str] = None
    plus_ones: Optional[int] = Field(None, ge=0, le=20)


class GuestItemClaim(BaseModel):
    guest_id: int
    edit_token: str
    quantity: int = Field(1, ge=0, le=99)  # 0 releases the claim
    note: Optional[str] = Field(None, max_length=500)


# ── Simple in-memory rate limiter ─────────────────────────────────────────────

_rsvp_timestamps: dict = defaultdict(list)
_RSVP_WINDOW = 60
_RSVP_LIMIT  = 5


def _check_rate_limit(ip: str) -> None:
    now = time.time()
    _rsvp_timestamps[ip] = [t for t in _rsvp_timestamps[ip] if now - t < _RSVP_WINDOW]
    if len(_rsvp_timestamps[ip]) >= _RSVP_LIMIT:
        raise HTTPException(status_code=429, detail="Too many RSVPs — try again in a minute")
    _rsvp_timestamps[ip].append(now)


_ALLOWED_IMG_EXT  = {"jpg", "jpeg", "png", "webp", "gif"}
_ALLOWED_IMG_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def _guest_edit_token(guest_id: int, invite_token: str) -> str:
    secret = os.getenv("INTERNAL_API_SECRET", "dev-secret")
    msg = f"{guest_id}:{invite_token}".encode()
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()[:32]


def _fp(ip: str, ua: str) -> str:
    return hashlib.sha256(f"{ip}:{ua}".encode()).hexdigest()[:64]


# ── Host routes ───────────────────────────────────────────────────────────────

@host_router.post("")
async def create_party_invite_endpoint(
    body: PartyInviteCreate,
    user_id: int = Depends(_get_current_user_id),
):
    event = get_event(body.event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event["host_user_id"] != user_id and event.get("created_by") != user_id:
        raise HTTPException(status_code=403, detail="Only the event host can create an invite")
    if get_party_invite_by_event_id(body.event_id):
        raise HTTPException(status_code=409, detail="Party invite already exists for this event")

    activity_type = body.theme_activity_type
    defaults = _ACTIVITY_DEFAULTS.get(activity_type, _ACTIVITY_DEFAULTS["other"])
    bring_enabled = False if activity_type == "dining" else body.bring_list_enabled

    token = secrets.token_urlsafe(12)
    invite = create_party_invite(
        event_id=body.event_id,
        host_user_id=user_id,
        token=token,
        theme_activity_type=activity_type,
        theme_variant=body.theme_variant or defaults["variant"],
        bg_animation=body.bg_animation or defaults["bg_animation"],
        accent_color=body.accent_color or defaults["accent_color"],
        bring_list_enabled=bring_enabled,
        bring_list_type=body.bring_list_type,
        style=body.style,
        group_ids=body.group_ids,
    )

    # Sync cover image between event and party invite
    event_cover = event.get("cover_url")
    body_cover  = getattr(body, "cover_image_url", None)
    if body_cover:
        # Caller explicitly set a cover — write it back to the event too
        update_event(body.event_id, cover_url=body_cover)
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("UPDATE party_invites SET cover_image_url = %s WHERE id = %s",
                    (body_cover, invite["id"]))
        conn.commit()
        conn.close()
        invite["cover_image_url"] = body_cover
    elif event_cover and not invite.get("cover_image_url"):
        # Event already has a cover — copy it onto the invite
        conn = get_db()
        cur  = conn.cursor()
        cur.execute("UPDATE party_invites SET cover_image_url = %s WHERE id = %s",
                    (event_cover, invite["id"]))
        conn.commit()
        conn.close()
        invite["cover_image_url"] = event_cover

    # Bring list: enable it on the event so the event page shows it, and mirror
    # items into canonical event_bring_items (linked) so both surfaces share one list.
    update_event(body.event_id, bring_list_enabled=bring_enabled)

    # Mirror any pre-existing event bring items into the invite (event created
    # first, invite attached later) so the public page matches the event page.
    existing_event_items = get_event_bring_items(body.event_id)
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "SELECT event_item_id FROM party_invite_items WHERE party_invite_id = %s AND event_item_id IS NOT NULL",
        (invite["id"],)
    )
    linked_ids = {r["event_item_id"] for r in cur.fetchall()}
    for it in existing_event_items:
        if it["id"] not in linked_ids:
            cur.execute(
                """INSERT INTO party_invite_items
                       (party_invite_id, label, emoji, max_claims, sort_order, event_item_id)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (invite["id"], it["label"], it.get("emoji") or "", it["max_claims"], it["sort_order"], it["id"])
            )
    conn.commit()
    conn.close()

    # Add the invite's own items as new linked pairs (event item + invite mirror).
    for i, item in enumerate(body.items):
        if item.get("label"):
            bring_sync.create_linked_item(
                body.event_id,
                item.get("label", ""),
                item.get("emoji", ""),
                int(item.get("max_claims") or 1),
                len(existing_event_items) + i,
            )

    for group_id in body.group_ids:
        members = await _get_group_members(group_id)
        _add_pending_attendees(body.event_id, members)
        await _notify_invite_to_group(group_id, body.event_id, event["title"], token)

    return {
        **invite,
        "groups": get_invite_groups(invite["id"]),
        "items": get_invite_items(invite["id"]),
    }


@host_router.get("/by-event/{event_id}")
async def get_invite_by_event(
    event_id: int, user_id: int = Depends(_get_current_user_id)
):
    invite = get_party_invite_by_event_id(event_id)
    if not invite:
        raise HTTPException(status_code=404, detail="No party invite for this event")
    if invite["host_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your invite")
    return invite


@host_router.get("/pending-for-group")
async def get_pending_for_group(
    group_id: int,
    user_id: int = Depends(_get_current_user_id),
):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT pi.token, pi.accent_color, pi.style, pi.bg_animation,
               pi.cover_image_url, pi.cover_image_position,
               pi.host_user_id, pi.event_id,
               e.title, e.scheduled_date, e.location, e.max_attendees,
               e.activity_type,
               (SELECT COUNT(*) FROM event_attendees
                WHERE event_id = pi.event_id AND status = 'going') AS going_count
        FROM party_invites pi
        JOIN party_invite_groups pig ON pig.party_invite_id = pi.id
        JOIN events e ON e.id = pi.event_id
        JOIN event_attendees ea ON ea.event_id = pi.event_id AND ea.user_id = %s
        WHERE pig.group_id = %s AND ea.status = 'pending'
        ORDER BY pi.created_at DESC
    """, (user_id, group_id))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    for row in rows:
        row["host"] = await _get_host_profile(row["host_user_id"])
    return rows


@host_router.get("/pending-for-user")
async def get_pending_for_user(
    user_id: int = Depends(_get_current_user_id),
):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT DISTINCT pi.token, pi.accent_color, pi.style, pi.bg_animation, pi.cover_image_url,
               pi.host_user_id, pi.event_id,
               e.title, e.scheduled_date, e.location, e.max_attendees,
               e.activity_type,
               (SELECT COUNT(*) FROM event_attendees
                WHERE event_id = pi.event_id AND status = 'going') AS going_count
        FROM party_invites pi
        JOIN events e ON e.id = pi.event_id
        JOIN event_attendees ea ON ea.event_id = pi.event_id AND ea.user_id = %s
        WHERE ea.status = 'pending'
        ORDER BY e.scheduled_date ASC NULLS LAST, pi.event_id DESC
    """, (user_id,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    for row in rows:
        row["host"] = await _get_host_profile(row["host_user_id"])
    return rows


@host_router.get("/{token}/manage")
async def get_manage_view(
    token: str, user_id: int = Depends(_get_current_user_id)
):
    invite = get_party_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["host_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your invite")
    return {
        **invite,
        "groups": get_invite_groups(invite["id"]),
        "guests": get_all_guests(invite["id"]),
        "email_notifications": get_email_notifications(invite["id"]),
        "items": get_invite_items(invite["id"]),
    }


@host_router.patch("/{token}")
async def patch_party_invite(
    token: str, body: PartyInvitePatch,
    user_id: int = Depends(_get_current_user_id),
):
    invite = get_party_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["host_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your invite")
    kwargs = {k: v for k, v in body.dict().items() if v is not None}
    if kwargs.get("theme_activity_type") == "dining":
        kwargs.setdefault("bring_list_enabled", False)
    updated = update_party_invite(token, **kwargs)
    if "cover_image_url" in kwargs and kwargs["cover_image_url"]:
        update_event(invite["event_id"], cover_url=kwargs["cover_image_url"])
    return updated


@host_router.post("/{token}/items")
async def add_item(
    token: str, body: InviteItemCreate,
    user_id: int = Depends(_get_current_user_id),
):
    invite = get_party_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["host_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your invite")
    return bring_sync.add_item_from_invite(invite, body.label, body.emoji, body.max_claims, body.sort_order)


@host_router.delete("/{token}/items/{item_id}", status_code=204)
async def remove_item(
    token: str, item_id: int,
    user_id: int = Depends(_get_current_user_id),
):
    invite = get_party_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["host_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your invite")
    bring_sync.delete_item_from_invite(invite, item_id)


@host_router.post("/{token}/share-to-group")
async def share_to_group(
    token: str, body: ShareToGroupRequest,
    user_id: int = Depends(_get_current_user_id),
):
    invite = get_party_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["host_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your invite")
    add_group_to_invite(invite["id"], body.group_id)
    event = get_event(invite["event_id"])
    members = await _get_group_members(body.group_id)
    _add_pending_attendees(invite["event_id"], members)
    await _notify_invite_to_group(body.group_id, invite["event_id"], event["title"], token)
    return {"ok": True, "group_id": body.group_id}


@host_router.post("/{token}/cover/upload-url")
async def cover_upload_url(
    token: str, body: CoverUploadRequest,
    user_id: int = Depends(_get_current_user_id),
):
    invite = get_party_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["host_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your invite")
    ext = body.filename.rsplit(".", 1)[-1].lower() if "." in body.filename else "jpg"
    if ext not in _ALLOWED_IMG_EXT:
        raise HTTPException(status_code=400, detail="Invalid file extension")
    if body.content_type not in _ALLOWED_IMG_MIME:
        raise HTTPException(status_code=400, detail="Invalid content type")
    object_name = f"party-invites/{token}/cover.{ext}"
    upload_url = storage.presigned_upload_url(storage.BUCKET_EVENTS, object_name, body.content_type)
    public_url = storage.public_object_url(storage.BUCKET_EVENTS, object_name)
    return {"upload_url": upload_url, "public_url": public_url, "object_name": object_name}


@host_router.post("/{token}/invite-users")
async def invite_users(
    token: str, body: InviteUsersRequest,
    user_id: int = Depends(_get_current_user_id),
):
    invite = get_party_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["host_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your invite")
    event = get_event(invite["event_id"])
    internal = os.getenv("INTERNAL_API_SECRET", "")
    added = []

    async with httpx.AsyncClient(timeout=5.0) as client:
        for uid in body.user_ids:
            try:
                prof_r = await client.get(
                    f"{GATEWAY_URL}/internal/users/{uid}/profile",
                    headers={"x-internal-secret": internal},
                )
                if prof_r.status_code != 200:
                    continue
                profile = prof_r.json()
                email = profile.get("email", "")
                if not email:
                    continue
                add_member_invite(invite["id"], email=email, user_id=uid)
                upsert_email_notification(
                    invite["id"],
                    email=email,
                    user_id=uid,
                    notification_type="invite",
                    status="pending",
                )
                _add_pending_attendees(invite["event_id"], [{"user_id": uid}])
                await client.post(
                    f"{GATEWAY_URL}/internal/notify/push",
                    json={
                        "user_id": uid,
                        "title": f"You're invited: {event['title']}",
                        "body": f"From {profile.get('full_name', 'a friend')} — tap to RSVP",
                        "link_type": "party_invite",
                        "link_id": token,
                    },
                    headers={"x-internal-secret": internal},
                )
                added.append({"type": "user", "user_id": uid, "email": email})
            except Exception:
                pass

        app_url = os.getenv("APP_URL", "http://localhost:3000")
        for email in body.emails:
            email = email.strip().lower()
            if not email:
                continue
            try:
                profile = {}
                try:
                    prof_r = await client.get(
                        f"{GATEWAY_URL}/internal/users/email-profile",
                        params={"email": email},
                        headers={"x-internal-secret": internal},
                    )
                    if prof_r.status_code == 200:
                        profile = prof_r.json() or {}
                except Exception:
                    profile = {}
                matched_user_id = profile.get("id")
                add_member_invite(invite["id"], email=email, user_id=matched_user_id)
                upsert_email_notification(
                    invite["id"],
                    email=email,
                    user_id=matched_user_id,
                    notification_type="invite",
                    status="pending",
                )
                if matched_user_id:
                    _add_pending_attendees(invite["event_id"], [{"user_id": matched_user_id}])
                    await client.post(
                        f"{GATEWAY_URL}/internal/notify/push",
                        json={
                            "user_id": matched_user_id,
                            "title": f"You're invited: {event['title']}",
                            "body": "Tap to RSVP",
                            "link_type": "party_invite",
                            "link_id": token,
                        },
                        headers={"x-internal-secret": internal},
                    )
                email_result = await client.post(
                    f"{GATEWAY_URL}/internal/notify/party-invite-email",
                    json={
                        "to_email": email,
                        "event_title": event["title"],
                        "host_name": "",
                        "scheduled_date": str(event.get("scheduled_date") or ""),
                        "location": event.get("location") or "",
                        "accent_color": invite.get("accent_color") or "#f43f5e",
                        "rsvp_url": f"{app_url}/p/{token}",
                    },
                    headers={"x-internal-secret": internal},
                )
                upsert_email_notification(
                    invite["id"],
                    email=email,
                    user_id=matched_user_id,
                    notification_type="invite",
                    status="sent" if email_result.status_code < 400 else "failed",
                    last_error=None if email_result.status_code < 400 else email_result.text[:500],
                )
                added.append({"type": "email", "email": email, "user_id": matched_user_id})
            except Exception:
                upsert_email_notification(
                    invite["id"],
                    email=email,
                    notification_type="invite",
                    status="failed",
                    last_error="Failed to send invite email",
                )
                pass

    return {"added": added}


@host_router.get("/{token}/member-invites")
async def get_member_invites_endpoint(
    token: str, user_id: int = Depends(_get_current_user_id)
):
    invite = get_party_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite["host_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your invite")
    members = get_member_invites(invite["id"])
    conn = get_db()
    cursor = conn.cursor()
    for m in members:
        if m.get("user_id"):
            cursor.execute(
                "SELECT status FROM event_attendees WHERE event_id = %s AND user_id = %s",
                (invite["event_id"], m["user_id"])
            )
            ea = cursor.fetchone()
            m["rsvp_status"] = ea["status"] if ea else "pending"
        else:
            cursor.execute(
                "SELECT rsvp_status FROM party_invite_guests WHERE party_invite_id = %s AND email = %s",
                (invite["id"], m["email"])
            )
            g = cursor.fetchone()
            m["rsvp_status"] = g["rsvp_status"] if g else "pending"
    conn.close()
    return members


# ── Public routes ─────────────────────────────────────────────────────────────

@public_router.get("/{token}")
async def get_public_invite(token: str, request: Request):
    invite = get_party_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    ip = request.client.host if request.client else "unknown"
    ua = request.headers.get("user-agent", "")
    increment_view_count(invite["id"], _fp(ip, ua))

    event = get_event(invite["event_id"])
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    groups  = get_invite_groups(invite["id"])
    items   = get_invite_items(invite["id"])
    host    = await _get_host_profile(invite["host_user_id"])

    # Turn reveal: check if host is current rotator in any attached group
    is_turn_reveal = False
    for g in groups:
        rotation = await _get_group_rotation(g["group_id"])
        if rotation.get("current_user_id") == invite["host_user_id"]:
            is_turn_reveal = True
            break

    # Per-group going counts (clubPal members)
    group_counts = []
    for g in groups:
        members = await _get_group_members(g["group_id"])
        member_ids = [m["user_id"] for m in members]
        if member_ids:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """SELECT COUNT(*) AS cnt FROM event_attendees
                       WHERE event_id = %s AND status = 'going' AND user_id = ANY(%s)""",
                    (invite["event_id"], member_ids)
                )
                row = cursor.fetchone()
                group_counts.append({"group_id": g["group_id"], "going_count": int(row["cnt"] or 0)})
        else:
            group_counts.append({"group_id": g["group_id"], "going_count": 0})

    # Strip internal id from public response
    public_invite = {k: v for k, v in invite.items() if k != "id"}
    return {
        **public_invite,
        "event": {
            "title": event["title"],
            "scheduled_date": event.get("scheduled_date"),
            "location": event.get("location"),
            "description": event.get("description"),
            "activity_type": event.get("activity_type"),
            "max_attendees": event.get("max_attendees"),
        },
        "host": host,
        "is_turn_reveal": is_turn_reveal,
        "group_counts": group_counts,
        "items": items,
    }


@public_router.post("/{token}/rsvp")
async def public_rsvp(token: str, body: GuestRsvpCreate, request: Request):
    ip = request.client.host if request.client else "unknown"
    _check_rate_limit(ip)

    invite = get_party_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    guest = create_guest_rsvp(
        party_invite_id=invite["id"],
        name=body.name,
        email=body.email,
        status=body.status,
        bring_note=body.bring_note,
        claim_item_id=body.claim_item_id,
        email_opt_in=body.email_opt_in,
        plus_ones=body.plus_ones,
    )
    # Register an RSVP-time item pick as a unified claim (shared capacity).
    if body.claim_item_id:
        ev_item = bring_sync.event_item_for_invite_item(body.claim_item_id, invite["id"])
        if ev_item:
            try:
                bring_sync.set_claim(ev_item, guest_id=guest["id"], quantity=1, note=body.bring_note)
            except ValueError:
                pass

    if body.email_opt_in:
        upsert_email_notification(
            invite["id"],
            email=body.email,
            notification_type="event_updates",
            status="pending",
            guest_id=guest["id"],
        )

    # Notify host via push
    event = get_event(invite["event_id"])
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(
                f"{GATEWAY_URL}/internal/notify/push",
                json={
                    "user_id": invite["host_user_id"],
                    "title": f"{body.name} RSVPd to {event['title']}",
                    "body": f"Status: {body.status.replace('_', ' ')}",
                    "link_type": "event",
                    "link_id": invite["event_id"],
                },
                headers={"x-internal-secret": os.getenv("INTERNAL_API_SECRET", "")},
            )
    except Exception:
        pass

    return {"guest_id": guest["id"], "edit_token": _guest_edit_token(guest["id"], token), "nudge_signup": True}


@public_router.patch("/{token}/rsvp/{guest_id}")
async def update_public_rsvp(token: str, guest_id: int, body: GuestRsvpPatch):
    invite = get_party_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    guest = get_guest_rsvp(guest_id)
    if not guest or guest["party_invite_id"] != invite["id"]:
        raise HTTPException(status_code=404, detail="RSVP not found")
    if not body.edit_token or not hmac.compare_digest(
        body.edit_token, _guest_edit_token(guest_id, token)
    ):
        raise HTTPException(status_code=403, detail="Invalid edit token")
    kwargs = {k: v for k, v in body.dict().items() if v is not None and k != "edit_token"}
    updated = update_guest_rsvp(guest_id, **kwargs)
    # Mirror a single-item pick into the unified claims table.
    if body.claim_item_id:
        ev_item = bring_sync.event_item_for_invite_item(body.claim_item_id, invite["id"])
        if ev_item:
            try:
                bring_sync.set_claim(ev_item, guest_id=guest_id, quantity=1, note=body.bring_note)
            except ValueError:
                pass
    return {
        "ok": True,
        "guest": {k: updated[k] for k in ("id", "rsvp_status", "bring_note", "claim_item_id")},
    }


@public_router.put("/{token}/items/{item_id}/claim")
async def public_claim_item(token: str, item_id: int, body: GuestItemClaim):
    """Tap-to-claim for guests: set (or release, with quantity 0) the requesting
    guest's quantity on a bring item, against the shared capacity."""
    invite = get_party_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if not guest_has_rsvpd(invite["id"], body.guest_id) or not hmac.compare_digest(
        body.edit_token, _guest_edit_token(body.guest_id, token)
    ):
        raise HTTPException(status_code=403, detail="Invalid RSVP access")
    ev_item = bring_sync.event_item_for_invite_item(item_id, invite["id"])
    if not ev_item:
        raise HTTPException(status_code=404, detail="Item not found")
    try:
        item = bring_sync.set_claim(ev_item, guest_id=body.guest_id, quantity=body.quantity, note=body.note)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {
        "ok": True,
        "item_id": item_id,
        "claimed_count": item["claimed_count"] if item else 0,
        "max_claims": item["max_claims"] if item else 0,
    }


@public_router.get("/{token}/guests")
async def get_public_guests(
    token: str,
    guest_id: Optional[int] = Query(None),
    edit_token: Optional[str] = Query(None),
):
    invite = get_party_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if not guest_id or not edit_token:
        raise HTTPException(status_code=403, detail="RSVP first to see who else is going")
    if not guest_has_rsvpd(invite["id"], guest_id) or not hmac.compare_digest(
        edit_token, _guest_edit_token(guest_id, token)
    ):
        raise HTTPException(status_code=403, detail="Invalid RSVP access")

    groups    = get_invite_groups(invite["id"])
    guests_raw = get_all_guests(invite["id"])

    # Expose first name only, never email
    guests_safe = [
        {"id": g["id"], "name": g["name"].split()[0], "status": g["rsvp_status"]}
        for g in guests_raw if g["rsvp_status"] == "going"
    ]

    # Who's bringing what — unified claims (members + guests) grouped by invite item id.
    # my_claims carries the requesting guest's own quantities so the UI can show steppers.
    items = get_invite_items(invite["id"])
    event_to_invite = {it["event_item_id"]: it["id"] for it in items if it.get("event_item_id")}
    item_brings: dict = {}
    my_claims: dict = {}
    if event_to_invite:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """SELECT c.event_item_id, c.user_id, c.guest_id, c.quantity, c.note,
                          g.name AS guest_name, g.rsvp_status AS guest_status
                   FROM event_bring_item_claims c
                   LEFT JOIN party_invite_guests g ON g.id = c.guest_id
                   WHERE c.event_item_id = ANY(%s)
                   ORDER BY c.created_at ASC""",
                (list(event_to_invite.keys()),)
            )
            for r in cursor.fetchall():
                r = dict(r)
                inv_id = event_to_invite.get(r["event_item_id"])
                if not inv_id:
                    continue
                if r["guest_id"] is not None:
                    name = r["guest_name"].split()[0] if r.get("guest_name") else "Guest"
                else:
                    name = "A member"
                qty = int(r["quantity"] or 1)
                item_brings.setdefault(str(inv_id), []).append(
                    {"name": name, "note": r["note"], "quantity": qty}
                )
                if r["guest_id"] == guest_id:
                    my_claims[str(inv_id)] = {"quantity": qty, "note": r["note"]}

    # Freeform "also bringing" notes from going guests who didn't claim a specific item.
    free_brings: list = []
    for g in guests_raw:
        if g["rsvp_status"] != "going":
            continue
        fname = g["name"].split()[0] if g.get("name") else "Guest"
        note = (g.get("bring_note") or "").strip() or None
        if note and not g.get("claim_item_id"):
            free_brings.append({"name": fname, "note": note})

    # ClubPal members going per group
    member_groups = []
    for g in groups:
        members = await _get_group_members(g["group_id"])
        member_ids = [m["user_id"] for m in members]
        if member_ids:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """SELECT user_id, status FROM event_attendees
                       WHERE event_id = %s AND status = 'going' AND user_id = ANY(%s)""",
                    (invite["event_id"], member_ids)
                )
                member_groups.append({
                    "group_id": g["group_id"],
                    "members": [dict(r) for r in cursor.fetchall()],
                })
        else:
            member_groups.append({"group_id": g["group_id"], "members": []})

    return {
        "guests": guests_safe,
        "member_groups": member_groups,
        "item_brings": item_brings,
        "my_claims": my_claims,
        "free_brings": free_brings,
    }


def _verify_guest_access(invite: dict, token: str, guest_id: Optional[int], edit_token: Optional[str]) -> None:
    """Raise 403 unless the caller is a guest who has RSVPd to this invite."""
    if not guest_id or not edit_token:
        raise HTTPException(status_code=403, detail="RSVP first to view this")
    if not guest_has_rsvpd(invite["id"], guest_id) or not hmac.compare_digest(
        edit_token, _guest_edit_token(guest_id, token)
    ):
        raise HTTPException(status_code=403, detail="Invalid RSVP access")


@public_router.get("/{token}/comments")
async def get_public_comments(
    token: str,
    guest_id: Optional[int] = Query(None),
    edit_token: Optional[str] = Query(None),
):
    """Read-only comment thread for a public invite. Gated behind RSVP; guests cannot post."""
    invite = get_party_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    _verify_guest_access(invite, token, guest_id, edit_token)

    comments = get_comments(invite["event_id"])
    profiles: dict = {}
    for uid in {c["user_id"] for c in comments if c.get("user_id")}:
        profiles[uid] = await _get_host_profile(uid)
    return {
        "comments": [
            {
                "id": c["id"],
                "content": c["content"],
                "created_at": c.get("created_at"),
                "author": {
                    "full_name": profiles.get(c["user_id"], {}).get("full_name"),
                    "avatar_url": profiles.get(c["user_id"], {}).get("avatar_url"),
                },
            }
            for c in comments
        ],
        "can_post": False,
        "nudge_signup": True,
    }
