"""
Party Invite module — host management routes and public /p/ routes.
Both routers are registered in main.py via app.include_router().
"""
import os
import secrets
import hashlib
import time
import httpx
from collections import defaultdict
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Header, Depends, Request
from pydantic import BaseModel, Field

from app import storage
from app.database import get_db, get_event, update_event
from app.party_invites_db import (
    create_party_invite, get_party_invite_by_token, get_party_invite_by_event_id,
    update_party_invite, add_group_to_invite, get_invite_groups,
    create_guest_rsvp, get_guest_rsvp, update_guest_rsvp, get_all_guests,
    create_invite_item, delete_invite_item, get_invite_items,
    claim_item, increment_view_count,
    add_member_invite, get_member_invites,
)

GROUPS_SERVICE_URL = "http://groups-service:8002"
GATEWAY_URL        = "http://api-gateway:8001"

_ACTIVITY_DEFAULTS = {
    "dining":  {"variant": "warm",      "bg_animation": "fireflies", "accent_color": "#f59e0b"},
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
    items: List[dict] = Field(default_factory=list)


class PartyInvitePatch(BaseModel):
    theme_activity_type: Optional[str] = None
    theme_variant: Optional[str] = None
    bg_animation: Optional[str] = None
    accent_color: Optional[str] = None
    cover_image_url: Optional[str] = None
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


class GuestRsvpPatch(BaseModel):
    status: Optional[str] = Field(None, pattern="^(going|maybe|not_going)$")
    bring_note: Optional[str] = Field(None, max_length=500)
    claim_item_id: Optional[int] = None


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

    for i, item in enumerate(body.items):
        create_invite_item(
            party_invite_id=invite["id"],
            label=item.get("label", ""),
            emoji=item.get("emoji", ""),
            max_claims=item.get("max_claims", 1),
            sort_order=i,
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
        SELECT pi.token, pi.accent_color, pi.style, pi.cover_image_url,
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
    return create_invite_item(invite["id"], body.label, body.emoji, body.max_claims, body.sort_order)


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
    delete_invite_item(item_id, invite["id"])


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
                add_member_invite(invite["id"], email=email, user_id=None)
                await client.post(
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
                added.append({"type": "email", "email": email})
            except Exception:
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
    conn = get_db()
    cursor = conn.cursor()
    group_counts = []
    for g in groups:
        cursor.execute(
            """SELECT COUNT(*) AS cnt FROM event_attendees ea
               JOIN group_members gm ON gm.user_id = ea.user_id AND gm.group_id = %s
               WHERE ea.event_id = %s AND ea.status = 'going'""",
            (g["group_id"], invite["event_id"])
        )
        row = cursor.fetchone()
        group_counts.append({"group_id": g["group_id"], "going_count": int(row["cnt"] or 0)})
    conn.close()

    # Strip internal id from public response
    public_invite = {k: v for k, v in invite.items() if k != "id"}
    return {
        **public_invite,
        "event": {
            "title": event["title"],
            "scheduled_date": event.get("scheduled_date"),
            "location": event.get("location"),
            "activity_type": event.get("activity_type"),
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

    return {"guest_id": guest["id"], "nudge_signup": True}


@public_router.patch("/{token}/rsvp/{guest_id}")
async def update_public_rsvp(token: str, guest_id: int, body: GuestRsvpPatch):
    invite = get_party_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    guest = get_guest_rsvp(guest_id)
    if not guest or guest["party_invite_id"] != invite["id"]:
        raise HTTPException(status_code=404, detail="RSVP not found")
    kwargs = {k: v for k, v in body.dict().items() if v is not None}
    updated = update_guest_rsvp(guest_id, **kwargs)
    return {
        "ok": True,
        "guest": {k: updated[k] for k in ("id", "rsvp_status", "bring_note", "claim_item_id")},
    }


@public_router.get("/{token}/guests")
async def get_public_guests(token: str):
    invite = get_party_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    groups    = get_invite_groups(invite["id"])
    guests_raw = get_all_guests(invite["id"])

    # Expose first name only, never email
    guests_safe = [
        {"id": g["id"], "name": g["name"].split()[0], "status": g["rsvp_status"]}
        for g in guests_raw if g["rsvp_status"] == "going"
    ]

    # ClubPal members going per group
    conn = get_db()
    cursor = conn.cursor()
    member_groups = []
    for g in groups:
        cursor.execute(
            """SELECT ea.user_id, ea.status FROM event_attendees ea
               JOIN group_members gm ON gm.user_id = ea.user_id AND gm.group_id = %s
               WHERE ea.event_id = %s AND ea.status = 'going'""",
            (g["group_id"], invite["event_id"])
        )
        member_groups.append({
            "group_id": g["group_id"],
            "members": [dict(r) for r in cursor.fetchall()],
        })
    conn.close()

    return {"guests": guests_safe, "member_groups": member_groups}
