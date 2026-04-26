from fastapi import FastAPI, HTTPException, Header, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import ENCODERS_BY_TYPE
from typing import List, Optional
from datetime import datetime
ENCODERS_BY_TYPE[datetime] = lambda dt: dt.strftime('%Y-%m-%dT%H:%M:%SZ') if dt else None
import uuid
import httpx
import os

from app.models import (
    GroupCreate, GroupUpdate, GroupResponse, GroupDetailResponse,
    MemberAdd, MemberUpdateRole, MemberResponse,
    RotationTurnResponse, RotationAdvanceRequest, RotationResetRequest,
    RotationSetTurnRequest, RotationSkipRequest, RotationReorderRequest, CompleteTurnRequest,
    BannerUploadRequest, UploadUrlResponse,
    GroupCommentCreate, GroupCommentResponse,
    PollCreate, PollRespond, PollConvert, PollResponseModel,
    InviteCodeCreate, InviteCodeResponse, InviteCodePreview,
    JoinRequestResponse, JoinRequestAction,
)
from app.database import (
    init_db, create_group, get_group, get_groups_by_user, update_group, delete_group,
    add_member, get_member, get_members, update_member_role, remove_member, remove_user_from_all_groups,
    is_member, is_admin_or_owner, get_rotation_state, advance_rotation,
    reset_rotation, set_rotation_turn, skip_rotation, reorder_rotation,
    set_picked_event, get_group_id_by_picked_event,
    add_group_comment, get_group_comments, get_group_comment, delete_group_comment,
    create_poll, get_poll, get_polls_for_group, get_pending_polls_for_user, get_my_active_polls,
    upsert_poll_response, get_poll_responses, get_poll_response,
    close_poll, convert_poll, auto_close_expired_polls,
    create_invite_code, get_active_invite_code, get_invite_code_by_code,
    validate_invite_code, increment_invite_used_count,
    create_join_request, get_pending_join_requests, get_join_request,
    get_pending_join_request_by_user, update_join_request,
    get_pending_join_requests_count,
)
from app import storage

GATEWAY_SERVICE_URL = os.getenv("GATEWAY_SERVICE_URL", "http://api-gateway:8001")
EVENTS_SERVICE_URL = os.getenv("EVENTS_SERVICE_URL", "http://events-service:8003")


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Validate Bearer token against gateway and return the full user dict."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization")
    try:
        r = httpx.get(
            f"{GATEWAY_SERVICE_URL}/auth/me",
            headers={"Authorization": authorization},
            timeout=5.0,
        )
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    raise HTTPException(status_code=401, detail="Invalid or expired session")


def get_current_user_id(user: dict = Depends(get_current_user)) -> int:
    """Return just the authenticated user's ID (backward-compat shim)."""
    return user["id"]

app = FastAPI(title="ClubPal Groups Service", version="1.0.0")

# CORS
_CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://localhost").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    """Initialize database on startup."""
    init_db()
    storage.ensure_buckets()
    print("Groups service started")


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "groups-service"}


# ===== Group Endpoints =====

@app.post("/groups", response_model=GroupResponse, status_code=201)
async def create_group_endpoint(group_data: GroupCreate, user_id: int = Depends(get_current_user_id)):
    """Create a new group."""
    if not group_data.join_behavior:
        raise HTTPException(status_code=400, detail="join_behavior is required (instant or approval)")
    try:
        group_id = create_group(
            name=group_data.name,
            created_by=user_id,
            description=group_data.description,
            rotation_type=group_data.rotation_type,
            activity_type=group_data.activity_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Auto-generate invite code
    try:
        create_invite_code(
            group_id=group_id,
            group_name=group_data.name,
            join_behavior=group_data.join_behavior,
            expiry_type=group_data.expiry_type or "never",
            expiry_days=group_data.expiry_days,
        )
    except Exception:
        pass  # non-blocking — group still created

    group = get_group(group_id)
    return GroupResponse(**group)


@app.get("/groups/{group_id}", response_model=GroupDetailResponse)
async def get_group_endpoint(group_id: int, user_id: int = Depends(get_current_user_id)):
    """Get group details with members. Caller must be a member of the group."""
    group = get_group(group_id)

    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if not is_member(group_id, user_id):
        raise HTTPException(status_code=403, detail="You are not a member of this group")

    members = get_members(group_id)
    member_responses = [MemberResponse(**member) for member in members]

    return GroupDetailResponse(**group, members=member_responses)


@app.get("/users/{user_id}/groups", response_model=List[GroupResponse])
async def get_user_groups(user_id: int, current_user_id: int = Depends(get_current_user_id)):
    """Get all groups for a user. Caller may only fetch their own groups."""
    if current_user_id != user_id:
        raise HTTPException(status_code=403, detail="Cannot access another user's groups")
    groups = get_groups_by_user(user_id)
    return [GroupResponse(**group) for group in groups]


@app.patch("/groups/{group_id}", response_model=GroupResponse)
async def update_group_endpoint(group_id: int, group_data: GroupUpdate, user_id: int = Depends(get_current_user_id)):
    """Update group details."""
    # Check if user is admin or owner
    if not is_admin_or_owner(group_id, user_id):
        raise HTTPException(status_code=403, detail="Only admins and owners can update groups")

    # Check if group exists
    if not get_group(group_id):
        raise HTTPException(status_code=404, detail="Group not found")

    # If switching to instant, auto-approve any pending join requests
    old_group = get_group(group_id)
    switching_to_instant = (
        group_data.join_behavior == "instant"
        and old_group
        and old_group.get("join_behavior") == "approval"
    )

    # Update group
    success = update_group(
        group_id,
        name=group_data.name,
        description=group_data.description,
        rotation_type=group_data.rotation_type,
        banner_url=group_data.banner_url,
        bg_type=group_data.bg_type,
        bg_value=group_data.bg_value,
        bg_scope=group_data.bg_scope,
        activity_type=group_data.activity_type,
        join_behavior=group_data.join_behavior,
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update group")

    # Auto-approve pending requests when switching to instant join
    if switching_to_instant:
        pending = get_pending_join_requests(group_id)
        group = get_group(group_id)
        group_name = group["name"] if group else f"Group {group_id}"
        internal_secret = os.getenv("INTERNAL_API_SECRET", "")
        for req in pending:
            try:
                update_join_request(req["id"], "approved", user_id)
                add_member(group_id, req["user_id"])
                await _auto_rsvp_new_member(group_id, req["user_id"])
                async with httpx.AsyncClient() as client:
                    try:
                        await client.post(
                            f"{GATEWAY_SERVICE_URL}/internal/notify/event",
                            json={
                                "user_ids": [req["user_id"]],
                                "group_id": group_id,
                                "event_title": f"🎉 You're in! Welcome to {group_name}",
                                "group_name": group_name,
                                "type": "invite",
                            },
                            headers={"x-internal-secret": internal_secret},
                            timeout=5.0,
                        )
                    except Exception:
                        pass
            except Exception:
                pass

    group = get_group(group_id)
    return GroupResponse(**group)


@app.delete("/groups/{group_id}", status_code=204)
async def delete_group_endpoint(group_id: int, user_id: int = Depends(get_current_user_id)):
    """Delete a group."""
    # Check if user is owner
    member = get_member(group_id, user_id)

    if not member or member["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can delete a group")

    success = delete_group(group_id)

    if not success:
        raise HTTPException(status_code=404, detail="Group not found")


# ===== Member Endpoints =====

async def _auto_rsvp_new_member(group_id: int, user_id: int):
    """After adding a member, RSVP them to all scheduled/in-progress events for the group.
    Fire-and-forget: failures are logged but never block member addition."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                f"{EVENTS_SERVICE_URL}/groups/{group_id}/events",
                params={"status": "scheduled"},
            )
            if r.status_code == 200:
                for event in r.json():
                    try:
                        await client.post(
                            f"{EVENTS_SERVICE_URL}/events/{event['id']}/attendees",
                            json={"user_id": user_id},
                        )
                    except Exception:
                        pass
    except Exception as e:
        print(f"Warning: auto-RSVP failed for user {user_id} in group {group_id}: {e}")


@app.post("/groups/{group_id}/members", response_model=MemberResponse, status_code=201)
async def add_member_endpoint(group_id: int, member_data: MemberAdd):
    """Add a member to a group."""
    if not get_group(group_id):
        raise HTTPException(status_code=404, detail="Group not found")

    success = add_member(group_id, member_data.user_id)
    if not success:
        raise HTTPException(status_code=400, detail="User is already a member")

    await _auto_rsvp_new_member(group_id, member_data.user_id)

    # Notify new member they were added
    group = get_group(group_id)
    group_name = group["name"] if group else f"Group {group_id}"
    internal_secret = os.getenv("INTERNAL_API_SECRET", "")
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{GATEWAY_SERVICE_URL}/internal/notify/event",
                json={
                    "user_ids": [member_data.user_id],
                    "group_id": group_id,
                    "event_title": f"🤝 You've been added to {group_name}",
                    "group_name": group_name,
                    "type": "invite",
                },
                headers={"x-internal-secret": internal_secret},
                timeout=5.0,
            )
            if resp.status_code >= 400:
                print(f"[WARN] member-add notify failed HTTP {resp.status_code}: {resp.text[:300]}")
        except Exception as e:
            print(f"[WARN] member-add notify exception: {e}")

    member = get_member(group_id, member_data.user_id)
    return MemberResponse(**member)


@app.get("/groups/{group_id}/members", response_model=List[MemberResponse])
async def get_members_endpoint(group_id: int):
    """Get all members of a group."""
    # Check if group exists
    if not get_group(group_id):
        raise HTTPException(status_code=404, detail="Group not found")

    members = get_members(group_id)
    return [MemberResponse(**member) for member in members]


@app.get("/groups/{group_id}/members/{user_id}", response_model=MemberResponse)
async def get_member_endpoint(group_id: int, user_id: int):
    """Get a specific member."""
    member = get_member(group_id, user_id)

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    return MemberResponse(**member)


@app.patch("/groups/{group_id}/members/{user_id}", response_model=MemberResponse)
async def update_member_role_endpoint(group_id: int, user_id: int,
                                     role_data: MemberUpdateRole,
                                     requester_id: int = Depends(get_current_user_id)):
    """Update a member's role."""
    # Check if requester is admin or owner
    if not is_admin_or_owner(group_id, requester_id):
        raise HTTPException(status_code=403, detail="Only admins and owners can update member roles")

    # Check if member exists
    if not get_member(group_id, user_id):
        raise HTTPException(status_code=404, detail="Member not found")

    # Update role
    success = update_member_role(group_id, user_id, role_data.role)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update member role")

    member = get_member(group_id, user_id)
    return MemberResponse(**member)


@app.delete("/groups/{group_id}/members/{user_id}", status_code=204)
async def remove_member_endpoint(group_id: int, user_id: int, requester_id: int = Depends(get_current_user_id)):
    """Remove a member from a group."""
    # User can remove themselves, or admin/owner can remove others
    if user_id != requester_id and not is_admin_or_owner(group_id, requester_id):
        raise HTTPException(status_code=403, detail="Not authorized to remove this member")

    # Check if member is owner
    member = get_member(group_id, user_id)
    if member and member["role"] == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the owner")

    success = remove_member(group_id, user_id)

    if not success:
        raise HTTPException(status_code=404, detail="Member not found")


# ===== Internal / Admin Endpoints =====

@app.delete("/users/{user_id}/memberships", status_code=200)
async def remove_user_from_all_groups_endpoint(user_id: int, x_internal_secret: str = Header(None)):
    """Internal: remove a deleted user from all groups (called by gateway on account deletion)."""
    internal_secret = os.getenv("INTERNAL_API_SECRET", "")
    if not internal_secret or x_internal_secret != internal_secret:
        raise HTTPException(status_code=403, detail="Forbidden")
    count = remove_user_from_all_groups(user_id)
    return {"removed_from_groups": count}


# ===== Rotation Endpoints =====

@app.get("/groups/{group_id}/rotation", response_model=RotationTurnResponse)
async def get_rotation_endpoint(group_id: int):
    """Get current rotation state."""
    # Check if group exists
    if not get_group(group_id):
        raise HTTPException(status_code=404, detail="Group not found")

    state = get_rotation_state(group_id)

    if not state:
        raise HTTPException(status_code=404, detail="Rotation state not found")

    # Get rotation type
    group = get_group(group_id)

    return RotationTurnResponse(
        group_id=group_id,
        user_id=state["current_user_id"],
        turn_index=state["current_turn_index"],
        rotation_type=group["rotation_type"],
        picked_event_id=state.get("picked_event_id"),
    )


@app.post("/groups/{group_id}/rotation/advance", response_model=RotationTurnResponse)
async def advance_rotation_endpoint(group_id: int, user_id: int = Depends(get_current_user_id)):
    """Advance to the next person in rotation."""
    # Check if user is admin or owner
    if not is_admin_or_owner(group_id, user_id):
        raise HTTPException(status_code=403, detail="Only admins and owners can advance rotation")

    result = advance_rotation(group_id)

    if not result:
        raise HTTPException(status_code=404, detail="Group not found or has no members")

    rotation_type = result.get("rotation_type")
    group = get_group(group_id)
    group_name = group["name"] if group else f"Group {group_id}"
    internal_secret = os.getenv("INTERNAL_API_SECRET", "")

    if rotation_type == "none":
        # Manual rotation: notify all members to vote on who picks next
        members = get_members(group_id)
        member_ids = [m["user_id"] for m in members]
        async with httpx.AsyncClient() as client:
            try:
                await client.post(
                    f"{GATEWAY_SERVICE_URL}/internal/notify/event",
                    json={
                        "group_id": group_id,
                        "user_ids": member_ids,
                        "event_title": f"🗳️ Vote: Who picks next in {group_name}?",
                        "group_name": group_name,
                        "event_date": "",
                        "type": "poll",
                    },
                    headers={"x-internal-secret": internal_secret},
                    timeout=5.0,
                )
            except Exception:
                pass  # non-blocking — rotation still advances
    else:
        # Sequential rotation (round_robin / random): notify the new picker
        new_user_id = result.get("user_id")
        if new_user_id:
            async with httpx.AsyncClient() as client:
                try:
                    await client.post(
                        f"{GATEWAY_SERVICE_URL}/internal/notify/rotation",
                        json={
                            "user_id": new_user_id,
                            "group_name": group_name,
                            "group_id": group_id,
                        },
                        headers={"x-internal-secret": internal_secret},
                        timeout=5.0,
                    )
                except Exception:
                    pass  # non-blocking

    return RotationTurnResponse(**result)


@app.post("/groups/{group_id}/rotation/complete-turn", response_model=RotationTurnResponse)
async def complete_turn_endpoint(group_id: int, body: Optional[CompleteTurnRequest] = None, user_id: int = Depends(get_current_user_id)):
    """Called by the current picker after creating/picking an event.

    If body.event_id is provided the turn is held until that event ends — rotation
    does NOT advance immediately. If no event_id is given (Already Picked), the
    turn advances right away.
    """
    state = get_rotation_state(group_id)
    if not state:
        raise HTTPException(status_code=404, detail="Rotation state not found")
    if str(state.get("current_user_id")) != str(user_id):
        raise HTTPException(status_code=403, detail="Not your turn")

    event_id = body.event_id if body else None

    if event_id:
        # Store the picked event and hold the turn — advance happens when the event ends
        set_picked_event(group_id, event_id)
        state = get_rotation_state(group_id)
        return RotationTurnResponse(
            group_id=group_id,
            user_id=state["current_user_id"],
            turn_index=state["current_turn_index"],
            rotation_type=state.get("rotation_type", "round_robin") or "round_robin",
            picked_event_id=event_id,
        )

    # No event linked — advance immediately (Already Picked fallback)
    result = advance_rotation(group_id)
    if not result:
        raise HTTPException(status_code=404, detail="Group not found or has no members")

    await _notify_next_picker(group_id, result)
    return RotationTurnResponse(**result)


async def _notify_next_picker(group_id: int, result: dict):
    """Send rotation notification to the next picker (non-blocking)."""
    if result.get("rotation_type") == "none":
        return
    new_user_id = result.get("user_id")
    if not new_user_id:
        return
    group = get_group(group_id)
    group_name = group["name"] if group else f"Group {group_id}"
    internal_secret = os.getenv("INTERNAL_API_SECRET", "")
    async with httpx.AsyncClient() as client:
        try:
            await client.post(
                f"{GATEWAY_SERVICE_URL}/internal/notify/rotation",
                json={"user_id": new_user_id, "group_name": group_name, "group_id": group_id},
                headers={"x-internal-secret": internal_secret},
                timeout=5.0,
            )
        except Exception:
            pass


@app.post("/internal/rotation/finalize-turn", status_code=200)
async def finalize_turn_endpoint(event_id: int, x_internal_secret: Optional[str] = Header(None)):
    """Internal: advance rotation for the group that picked the given event_id.
    Called by events-service when an event is completed or cancelled.
    """
    internal_secret = os.getenv("INTERNAL_API_SECRET", "")
    if not internal_secret or x_internal_secret != internal_secret:
        raise HTTPException(status_code=403, detail="Internal access only")

    group_id = get_group_id_by_picked_event(event_id)
    if not group_id:
        return {"message": "No rotation pending for this event"}

    result = advance_rotation(group_id)
    if not result:
        return {"message": "Could not advance rotation"}

    await _notify_next_picker(group_id, result)
    return {"message": "Rotation advanced", "group_id": group_id}


@app.post("/groups/{group_id}/rotation/reset", response_model=RotationTurnResponse)
async def reset_rotation_endpoint(group_id: int, user_id: int = Depends(get_current_user_id)):
    """Reset rotation to the first member."""
    # Check if user is admin or owner
    if not is_admin_or_owner(group_id, user_id):
        raise HTTPException(status_code=403, detail="Only admins and owners can reset rotation")

    result = reset_rotation(group_id)

    if not result:
        raise HTTPException(status_code=404, detail="Group not found or has no members")

    return RotationTurnResponse(**result)


@app.post("/groups/{group_id}/rotation/set", response_model=RotationTurnResponse)
async def set_rotation_endpoint(group_id: int, turn_data: RotationSetTurnRequest, user_id: int = Depends(get_current_user_id)):
    """Set rotation to a specific user."""
    # Check if user is admin or owner
    if not is_admin_or_owner(group_id, user_id):
        raise HTTPException(status_code=403, detail="Only admins and owners can set rotation")

    result = set_rotation_turn(group_id, turn_data.user_id)

    if not result:
        raise HTTPException(status_code=400, detail="Invalid user or group")

    return RotationTurnResponse(**result)


@app.post("/groups/{group_id}/rotation/skip", response_model=RotationTurnResponse)
async def skip_rotation_endpoint(group_id: int, skip_data: RotationSkipRequest, user_id: int = Depends(get_current_user_id)):
    """Skip current picker and advance to the next person."""
    if not is_admin_or_owner(group_id, user_id):
        raise HTTPException(status_code=403, detail="Only admins and owners can skip rotation")

    result = skip_rotation(group_id, reason=skip_data.reason)

    if not result:
        raise HTTPException(status_code=404, detail="Group not found or has no members")

    return RotationTurnResponse(**result)


@app.patch("/groups/{group_id}/rotation/reorder", response_model=RotationTurnResponse)
async def reorder_rotation_endpoint(group_id: int, reorder_data: RotationReorderRequest,
                                     user_id: int = Depends(get_current_user_id)):
    """Reorder the rotation queue (drag-and-drop)."""
    if not is_admin_or_owner(group_id, user_id):
        raise HTTPException(status_code=403, detail="Only admins and owners can reorder rotation")

    # Verify all user_ids are members
    members = get_members(group_id)
    member_ids = {m["user_id"] for m in members}

    for uid in reorder_data.user_ids:
        if uid not in member_ids:
            raise HTTPException(status_code=400, detail=f"User {uid} is not a member")

    success = reorder_rotation(group_id, reorder_data.user_ids)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to reorder rotation")

    # Return updated rotation state
    state = get_rotation_state(group_id)
    group = get_group(group_id)

    return RotationTurnResponse(
        group_id=group_id,
        user_id=state["current_user_id"],
        turn_index=state["current_turn_index"],
        rotation_type=group["rotation_type"]
    )


@app.post("/groups/{group_id}/invite")
async def send_group_invite(group_id: int, email: str, group_name: str, user_id: int = Depends(get_current_user_id)):
    """Send an email invite for the group (proxies to api-gateway)."""
    if not is_admin_or_owner(group_id, user_id):
        raise HTTPException(status_code=403, detail="Only admins and owners can send invites")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{GATEWAY_SERVICE_URL}/invites/send",
                json={
                    "email": email,
                    "group_id": group_id,
                    "group_name": group_name,
                    "invited_by": user_id,
                }
            )
            if response.status_code not in [200, 201]:
                raise HTTPException(status_code=response.status_code,
                                    detail=response.json().get("detail", "Failed to send invite"))
            return response.json()
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail="Gateway service unavailable")


@app.post("/groups/{group_id}/banner/upload-url", response_model=UploadUrlResponse)
async def get_banner_upload_url(group_id: int, request: BannerUploadRequest, user_id: int = Depends(get_current_user_id)):
    """Get a pre-signed URL to upload a group banner image."""
    group = get_group(group_id)

    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if not is_admin_or_owner(group_id, user_id):
        raise HTTPException(status_code=403, detail="Only admins and owners can update the banner")

    ext = request.filename.rsplit(".", 1)[-1].lower() if "." in request.filename else "jpg"
    object_name = f"groups/{group_id}/banner-{uuid.uuid4().hex[:8]}.{ext}"

    upload_url = storage.presigned_upload_url(
        storage.BUCKET_EVENTS,
        object_name,
        content_type=request.content_type,
    )
    public_url = storage.public_object_url(storage.BUCKET_EVENTS, object_name)

    return UploadUrlResponse(
        upload_url=upload_url,
        public_url=public_url,
        object_name=object_name,
    )


@app.post("/groups/{group_id}/banner/upload")
async def upload_group_banner(group_id: int, file: UploadFile = File(...), user_id: int = Depends(get_current_user_id)):
    """Upload a group banner image directly (no presigned URL required)."""
    if not get_group(group_id):
        raise HTTPException(status_code=404, detail="Group not found")
    if not is_admin_or_owner(group_id, user_id):
        raise HTTPException(status_code=403, detail="Only admins and owners can update the banner")
    ext = (file.filename or "banner.jpg").rsplit(".", 1)[-1].lower()
    object_name = f"groups/{group_id}/banner-{uuid.uuid4().hex[:8]}.{ext}"
    content = await file.read()
    public_url = storage.upload_bytes(storage.BUCKET_EVENTS, object_name, content, file.content_type or "image/jpeg")
    update_group(group_id, banner_url=public_url)
    return {"banner_url": public_url}


# ===== Comment Endpoints =====

@app.post("/groups/{group_id}/comments", response_model=GroupCommentResponse, status_code=201)
async def add_comment_endpoint(group_id: int, comment_data: GroupCommentCreate, user_id: int = Depends(get_current_user_id)):
    """Add a comment to a group."""
    if not get_group(group_id):
        raise HTTPException(status_code=404, detail="Group not found")

    if not is_member(group_id, user_id):
        raise HTTPException(status_code=403, detail="Only members can comment")

    comment_id = add_group_comment(group_id, user_id, comment_data.content)
    comment = get_group_comment(comment_id)
    return GroupCommentResponse(**comment)


@app.get("/groups/{group_id}/comments", response_model=List[GroupCommentResponse])
async def get_comments_endpoint(group_id: int):
    """Get all comments for a group."""
    if not get_group(group_id):
        raise HTTPException(status_code=404, detail="Group not found")

    comments = get_group_comments(group_id)
    return [GroupCommentResponse(**c) for c in comments]


@app.delete("/groups/{group_id}/comments/{comment_id}", status_code=204)
async def delete_comment_endpoint(group_id: int, comment_id: int, user_id: int = Depends(get_current_user_id)):
    """Delete a group comment (author only)."""
    comment = get_group_comment(comment_id)

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Only the author can delete this comment")

    delete_group_comment(comment_id, deleted_by=user_id)


# ===== Poll Helpers =====

def _build_poll_summary(poll_id: int, user_id: int, member_count: int) -> dict:
    """Build response summary for a poll."""
    poll = get_poll(poll_id)
    responses = get_poll_responses(poll_id)
    my_response = get_poll_response(poll_id, user_id)
    responded_count = len(responses)
    has_responded = my_response is not None
    poll_is_closed = poll and poll['status'] != 'open'

    # Build counts keyed by option value — dynamic for custom options, fixed for default
    custom_opts = poll.get('custom_options') if poll else None
    if custom_opts:
        counts = {opt.get('value', f"opt_{i}"): 0 for i, opt in enumerate(custom_opts)}
    else:
        counts = {'in': 0, 'done_loved': 0, 'done_pass': 0, 'cant_make_it': 0}

    if has_responded or poll_is_closed:
        for r in responses:
            key = r['response']
            counts[key] = counts.get(key, 0) + 1

    return {
        'total_members': member_count,
        'responded': responded_count,
        'has_responded': has_responded,
        'user_response': dict(my_response) if my_response else None,
        'counts': counts,
    }


def _poll_to_model(poll: dict, summary: dict) -> PollResponseModel:
    return PollResponseModel(
        id=poll['id'],
        group_id=poll['group_id'],
        created_by=poll['created_by'],
        creator_username=poll.get('creator_username'),
        activity_name=poll['activity_name'],
        activity_type=poll.get('activity_type'),
        activity_id=poll.get('activity_id'),
        note=poll.get('note'),
        deadline=poll['deadline'],
        status=poll['status'],
        converted_event_id=poll.get('converted_event_id'),
        created_at=poll['created_at'],
        summary=summary,
        custom_options=poll.get('custom_options'),
    )


# ===== Poll Endpoints =====

@app.post("/groups/{group_id}/polls", response_model=PollResponseModel, status_code=201)
async def create_poll_endpoint(group_id: int, data: PollCreate, user: dict = Depends(get_current_user)):
    """Create a poll for a group (picker only)."""
    user_id = user["id"]
    creator_username = user.get("username") or user.get("full_name") or f"#{user_id}"

    group = get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if not is_member(group_id, user_id):
        raise HTTPException(status_code=403, detail="Only members can create polls")

    # Stamp each custom option with a stable value key (index-based)
    opts = None
    if data.custom_options:
        opts = [dict(opt, value=f"opt_{i}") for i, opt in enumerate(data.custom_options)]

    poll_id = create_poll(
        group_id=group_id,
        created_by=user_id,
        activity_name=data.activity_name,
        activity_type=data.activity_type,
        activity_id=data.activity_id,
        note=data.note,
        deadline=data.deadline,
        custom_options=opts,
        creator_username=creator_username,
    )

    # Notify group via gateway (best-effort)
    async with httpx.AsyncClient() as client:
        try:
            await client.post(
                f"{GATEWAY_SERVICE_URL}/internal/notify/event",
                json={"group_id": group_id, "type": "poll",
                      "event_title": data.activity_name, "event_id": poll_id,
                      "creator_id": user_id},
                headers={"x-internal-secret": os.getenv("INTERNAL_API_SECRET", "")},
                timeout=3.0,
            )
        except Exception:
            pass

    poll = get_poll(poll_id)
    member_count = group['member_count']
    summary = _build_poll_summary(poll_id, user_id, member_count)
    return _poll_to_model(poll, summary)


@app.get("/groups/{group_id}/polls", response_model=List[PollResponseModel])
async def list_group_polls(group_id: int, user_id: int = Depends(get_current_user_id)):
    """List all polls for a group with per-user summary."""
    group = get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    auto_close_expired_polls()

    polls = get_polls_for_group(group_id)
    member_count = group['member_count']
    return [_poll_to_model(p, _build_poll_summary(p['id'], user_id, member_count)) for p in polls]


@app.get("/polls/{poll_id}", response_model=PollResponseModel)
async def get_poll_endpoint(poll_id: int, user_id: int = Depends(get_current_user_id)):
    """Get a single poll with summary."""
    poll = get_poll(poll_id)
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")

    group = get_group(poll['group_id'])
    member_count = group['member_count'] if group else 0
    summary = _build_poll_summary(poll_id, user_id, member_count)
    return _poll_to_model(poll, summary)


@app.post("/polls/{poll_id}/respond", response_model=PollResponseModel)
async def respond_to_poll(poll_id: int, data: PollRespond, user_id: int = Depends(get_current_user_id)):
    """Submit or update a response to a poll."""
    poll = get_poll(poll_id)
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    if poll['status'] != 'open':
        raise HTTPException(status_code=400, detail="Poll is not open")

    upsert_poll_response(poll_id, user_id, data.response)

    group = get_group(poll['group_id'])
    member_count = group['member_count'] if group else 0
    poll = get_poll(poll_id)
    summary = _build_poll_summary(poll_id, user_id, member_count)
    return _poll_to_model(poll, summary)


@app.put("/polls/{poll_id}/close", response_model=PollResponseModel)
async def close_poll_endpoint(poll_id: int, user_id: int = Depends(get_current_user_id)):
    """Close a poll (creator only)."""
    poll = get_poll(poll_id)
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    if poll['created_by'] != user_id:
        raise HTTPException(status_code=403, detail="Only the creator can close this poll")

    close_poll(poll_id)

    group = get_group(poll['group_id'])
    member_count = group['member_count'] if group else 0
    poll = get_poll(poll_id)
    summary = _build_poll_summary(poll_id, user_id, member_count)
    return _poll_to_model(poll, summary)


@app.post("/polls/{poll_id}/convert", response_model=PollResponseModel)
async def convert_poll_endpoint(poll_id: int, data: PollConvert, user_id: int = Depends(get_current_user_id)):
    """Convert a poll to an event (creator only)."""
    poll = get_poll(poll_id)
    if not poll:
        raise HTTPException(status_code=404, detail="Poll not found")
    if poll['created_by'] != user_id:
        raise HTTPException(status_code=403, detail="Only the creator can convert this poll")
    if poll['status'] == 'converted':
        raise HTTPException(status_code=400, detail="Poll already converted")

    event_id = None
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{EVENTS_SERVICE_URL}/events",
                params={"user_id": user_id},
                json={
                    "group_id": poll['group_id'],
                    "title": poll['activity_name'],
                    "scheduled_date": data.scheduled_date.isoformat() if data.scheduled_date else None,
                    "location": data.location or poll['activity_name'],
                    "created_by": poll['created_by'],
                    "host_user_id": poll['created_by'],
                    "parent_recurring_id": data.recurring_schedule_id,
                    "max_attendees": data.max_attendees,
                },
                timeout=10.0,
            )
            if resp.status_code in (200, 201):
                event_data = resp.json()
                event_id = event_data.get('id')
        except Exception:
            raise HTTPException(status_code=503, detail="Events service unavailable")

    if event_id:
        convert_poll(poll_id, event_id)

    group = get_group(poll['group_id'])
    member_count = group['member_count'] if group else 0
    poll = get_poll(poll_id)
    summary = _build_poll_summary(poll_id, user_id, member_count)
    return _poll_to_model(poll, summary)


@app.get("/users/{user_id}/polls/pending", response_model=List[PollResponseModel])
async def get_pending_polls(user_id: int):
    """Get open polls the user hasn't responded to yet (excluding ones they created)."""
    auto_close_expired_polls()
    polls = get_pending_polls_for_user(user_id)
    result = []
    for p in polls:
        group = get_group(p['group_id'])
        member_count = group['member_count'] if group else 0
        summary = _build_poll_summary(p['id'], user_id, member_count)
        result.append(_poll_to_model(p, summary))
    return result


@app.get("/users/{user_id}/polls/created", response_model=List[PollResponseModel])
async def get_my_polls(user_id: int):
    """Get open polls created by the user, with response progress."""
    auto_close_expired_polls()
    polls = get_my_active_polls(user_id)
    result = []
    for p in polls:
        member_count = p.get('member_count', 0)
        summary = _build_poll_summary(p['id'], user_id, member_count)
        result.append(_poll_to_model(p, summary))
    return result


# ===== Invite Code Endpoints =====

@app.post("/groups/{group_id}/invite-codes", response_model=InviteCodeResponse, status_code=201)
async def generate_invite_code(
    group_id: int,
    data: InviteCodeCreate,
    user_id: int = Depends(get_current_user_id),
):
    """Generate (or regenerate) invite code for a group. Admin/owner only."""
    if not is_admin_or_owner(group_id, user_id):
        raise HTTPException(status_code=403, detail="Only admins and owners can manage invite codes")
    group = get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    row = create_invite_code(
        group_id=group_id,
        group_name=group["name"],
        join_behavior=data.join_behavior,
        expiry_type=data.expiry_type,
        expiry_days=data.expiry_days,
    )
    return InviteCodeResponse(**row)


@app.get("/groups/{group_id}/invite-codes/active", response_model=InviteCodeResponse)
async def get_group_invite_code(group_id: int, user_id: int = Depends(get_current_user_id)):
    """Get current active invite code for a group. Admin/owner only."""
    if not is_admin_or_owner(group_id, user_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    row = get_active_invite_code(group_id)
    if not row:
        raise HTTPException(status_code=404, detail="No invite code found")
    return InviteCodeResponse(**row)


@app.get("/invite-codes/{code}", response_model=InviteCodePreview)
async def preview_invite_code(code: str):
    """Public endpoint — preview a group via invite code (no auth required)."""
    result = validate_invite_code(code)
    if not result["valid"]:
        return InviteCodePreview(
            code=code, group_id=0, group_name="", activity_type=None,
            member_count=0, join_behavior="instant", valid=False, error=result["error"]
        )
    row = result["row"]
    return InviteCodePreview(
        code=code,
        group_id=row["group_id"],
        group_name=row["group_name"],
        activity_type=row.get("activity_type"),
        member_count=row["member_count"],
        join_behavior=row["join_behavior"],
        valid=True,
    )


@app.post("/invite-codes/{code}/join")
async def join_via_invite_code(code: str, user_id: int = Depends(get_current_user_id)):
    """Join a group via invite code. Instant or approval depending on join_behavior."""
    result = validate_invite_code(code)
    if not result["valid"]:
        raise HTTPException(status_code=400, detail=result["error"])

    row = result["row"]
    group_id = row["group_id"]

    # Already a member?
    if is_member(group_id, user_id):
        raise HTTPException(status_code=409, detail="You are already a member of this group")

    group = get_group(group_id)
    group_name = group["name"] if group else f"Group {group_id}"
    members = get_members(group_id)
    admin_ids = [m["user_id"] for m in members if m["role"] in ("owner", "admin")]
    internal_secret = os.getenv("INTERNAL_API_SECRET", "")

    if row["join_behavior"] == "instant":
        success = add_member(group_id, user_id)
        if not success:
            raise HTTPException(status_code=409, detail="Could not add member")
        increment_invite_used_count(row["id"])
        await _auto_rsvp_new_member(group_id, user_id)

        # Notify admins that someone new joined
        async with httpx.AsyncClient() as client:
            try:
                await client.post(
                    f"{GATEWAY_SERVICE_URL}/internal/notify/event",
                    json={
                        "user_ids": admin_ids,
                        "group_id": group_id,
                        "event_title": f"🤝 New member joined {group_name}",
                        "group_name": group_name,
                        "type": "invite",
                    },
                    headers={"x-internal-secret": internal_secret},
                    timeout=5.0,
                )
            except Exception:
                pass

        return {"joined": True, "group_id": group_id}

    else:  # approval
        # Check for existing pending request
        existing = get_pending_join_request_by_user(group_id, user_id)
        if existing:
            raise HTTPException(status_code=409, detail="You already have a pending request to join this group")

        req = create_join_request(group_id, user_id, row["id"])
        increment_invite_used_count(row["id"])

        # Notify group admin(s) — pending approval needed
        async with httpx.AsyncClient() as client:
            try:
                await client.post(
                    f"{GATEWAY_SERVICE_URL}/internal/notify/event",
                    json={
                        "user_ids": admin_ids,
                        "group_id": group_id,
                        "event_title": f"✋ Join request for {group_name}",
                        "group_name": group_name,
                        "type": "invite",
                    },
                    headers={"x-internal-secret": internal_secret},
                    timeout=5.0,
                )
            except Exception:
                pass

        return {"requested": True, "request_id": req["id"]}


@app.get("/groups/{group_id}/join-requests", response_model=List[JoinRequestResponse])
async def list_join_requests(group_id: int, user_id: int = Depends(get_current_user_id)):
    """Get pending join requests. Admin/owner only."""
    if not is_admin_or_owner(group_id, user_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    rows = get_pending_join_requests(group_id)
    return [JoinRequestResponse(**r) for r in rows]


@app.get("/groups/{group_id}/join-requests/count")
async def join_requests_count(group_id: int, user_id: int = Depends(get_current_user_id)):
    """Return pending join request count for badge display."""
    if not is_admin_or_owner(group_id, user_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    return {"count": get_pending_join_requests_count(group_id)}


@app.post("/groups/{group_id}/notify-join-request", status_code=200)
async def notify_join_request(group_id: int, user_id: int = Depends(get_current_user_id)):
    """Notify group admins that a join request was submitted. Best-effort."""
    group = get_group(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    admins = [m for m in get_members(group_id) if m['role'] in ('owner', 'admin')]
    async with httpx.AsyncClient() as client:
        for admin in admins:
            try:
                await client.post(
                    f"{GATEWAY_SERVICE_URL}/internal/notify/push",
                    json={
                        "user_id": admin['user_id'],
                        "title": f"New join request — {group['name']}",
                        "body": "Someone wants to join your club. Tap to review.",
                        "link_type": "group",
                        "link_id": group_id,
                    },
                    headers={"x-internal-secret": os.getenv("INTERNAL_API_SECRET", "")},
                    timeout=3.0,
                )
            except Exception:
                pass
    return {"notified": len(admins)}


@app.patch("/join-requests/{request_id}", response_model=JoinRequestResponse)
async def review_join_request(
    request_id: int,
    data: JoinRequestAction,
    user_id: int = Depends(get_current_user_id),
):
    """Approve or decline a join request. Admin/owner only."""
    req = get_join_request(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if not is_admin_or_owner(req["group_id"], user_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    if req["status"] != "pending":
        raise HTTPException(status_code=409, detail="Request already reviewed")

    new_status = "approved" if data.action == "approve" else "declined"
    updated = update_join_request(request_id, new_status, user_id)

    if data.action == "approve":
        add_member(req["group_id"], req["user_id"])
        await _auto_rsvp_new_member(req["group_id"], req["user_id"])

    # Notify requester
    group = get_group(req["group_id"])
    group_name = group["name"] if group else f"Group {req['group_id']}"
    if data.action == "approve":
        notif_title = f"You're in! Welcome to {group_name}"
        link_type = "group"
    else:
        notif_title = f"Your request to join {group_name} was declined"
        link_type = "group"

    internal_secret = os.getenv("INTERNAL_API_SECRET", "")
    async with httpx.AsyncClient() as client:
        try:
            await client.post(
                f"{GATEWAY_SERVICE_URL}/internal/notify/event",
                json={
                    "user_ids": [req["user_id"]],
                    "group_id": req["group_id"],
                    "event_title": notif_title,
                    "group_name": group_name,
                    "type": "invite",
                },
                headers={"x-internal-secret": internal_secret},
                timeout=5.0,
            )
        except Exception:
            pass

    return JoinRequestResponse(**updated)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
