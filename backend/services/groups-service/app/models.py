from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class RotationType(str, Enum):
    ROUND_ROBIN = "round_robin"
    RANDOM = "random"
    NONE = "none"


class MemberRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


# Group models
class GroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    rotation_type: RotationType = RotationType.ROUND_ROBIN
    activity_type: Optional[str] = None
    join_behavior: Optional[str] = Field(None, pattern="^(instant|approval)$")
    expiry_type: Optional[str] = Field("never", pattern="^(never|days)$")
    expiry_days: Optional[int] = Field(None, ge=1, le=365)


class GroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    rotation_type: Optional[RotationType] = None
    banner_url: Optional[str] = None
    bg_type: Optional[str] = None
    bg_value: Optional[str] = None
    bg_scope: Optional[str] = None
    activity_type: Optional[str] = None
    join_behavior: Optional[str] = Field(None, pattern="^(instant|approval)$")


class GroupResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    banner_url: Optional[str] = None
    bg_type: Optional[str] = "default"
    bg_value: Optional[str] = None
    bg_scope: Optional[str] = "hero"
    rotation_type: RotationType
    activity_type: Optional[str] = None
    join_behavior: Optional[str] = None
    created_by: int
    created_at: datetime
    updated_at: datetime
    member_count: int


class GroupDetailResponse(GroupResponse):
    members: List['MemberResponse']


# Member models
class MemberAdd(BaseModel):
    user_id: int


class MemberUpdateRole(BaseModel):
    role: MemberRole


class MemberResponse(BaseModel):
    user_id: int
    group_id: int
    role: MemberRole
    rotation_order: Optional[int] = None
    joined_at: datetime


# Rotation models
class RotationTurnResponse(BaseModel):
    group_id: int
    user_id: int
    turn_index: int
    rotation_type: RotationType
    picked_event_id: Optional[int] = None


class RotationAdvanceRequest(BaseModel):
    pass  # No body needed, just POST to advance


class CompleteTurnRequest(BaseModel):
    event_id: Optional[int] = None  # If set, hold the turn until this event ends


class RotationResetRequest(BaseModel):
    pass  # No body needed, just POST to reset


class RotationSetTurnRequest(BaseModel):
    user_id: int


class RotationSkipRequest(BaseModel):
    reason: Optional[str] = None


class RotationReorderRequest(BaseModel):
    user_ids: List[int]


class GroupCommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)


class GroupCommentResponse(BaseModel):
    id: int
    group_id: int
    user_id: int
    content: str
    created_at: datetime


class BannerUploadRequest(BaseModel):
    filename: str
    content_type: str = "image/jpeg"


class UploadUrlResponse(BaseModel):
    upload_url: str
    public_url: str
    object_name: str


# Poll models
class PollCreate(BaseModel):
    activity_name: str = Field(..., min_length=1, max_length=200)
    activity_type: Optional[str] = None
    activity_id: Optional[int] = None
    note: Optional[str] = Field(None, max_length=500)
    deadline: datetime
    custom_options: Optional[List[dict]] = None


class PollRespond(BaseModel):
    user_id: int
    response: str = Field(..., min_length=1, max_length=200)


class PollUpdate(BaseModel):
    activity_name: Optional[str] = Field(None, min_length=1, max_length=200)
    note: Optional[str] = Field(None, max_length=500)
    deadline: Optional[datetime] = None


class PollAddOption(BaseModel):
    user_id: int
    label: str = Field(..., min_length=1, max_length=120)
    emoji: str = Field('⭐', max_length=10)


class PollConvert(BaseModel):
    user_id: int
    scheduled_date: Optional[datetime] = None
    location: Optional[str] = None
    recurring_schedule_id: Optional[int] = None  # Link event to a recurring series
    max_attendees: Optional[int] = Field(None, ge=1)


class PollResponseModel(BaseModel):
    id: int
    group_id: int
    created_by: int
    creator_username: Optional[str] = None
    activity_name: str
    activity_type: Optional[str]
    activity_id: Optional[int]
    note: Optional[str]
    deadline: datetime
    status: str
    converted_event_id: Optional[int]
    created_at: datetime
    summary: Optional[dict] = None
    custom_options: Optional[List[dict]] = None


# Invite code models
class InviteCodeCreate(BaseModel):
    join_behavior: str = Field(..., pattern="^(instant|approval)$")
    expiry_type: str = Field("never", pattern="^(never|days)$")
    expiry_days: Optional[int] = Field(None, ge=1, le=365)


class InviteCodeResponse(BaseModel):
    id: int
    group_id: int
    code: str
    join_behavior: str
    expiry_type: str
    expiry_days: Optional[int]
    expires_at: Optional[datetime]
    used_count: int
    created_at: datetime
    regenerated_at: Optional[datetime] = None


class InviteCodePreview(BaseModel):
    """Public info returned by GET /invite-codes/:code"""
    code: str
    group_id: int
    group_name: str
    activity_type: Optional[str]
    member_count: int
    join_behavior: str
    valid: bool
    error: Optional[str] = None


class JoinRequestResponse(BaseModel):
    id: int
    group_id: int
    user_id: int
    invite_code_id: int
    status: str
    requested_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[int] = None


class JoinRequestAction(BaseModel):
    action: str = Field(..., pattern="^(approve|decline)$")


# Update forward references
GroupDetailResponse.model_rebuild()
