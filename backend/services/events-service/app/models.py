from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class EventStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


# Event models
class EventCreate(BaseModel):
    group_id: int
    activity_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    scheduled_date: Optional[datetime] = None
    location: Optional[str] = Field(None, max_length=200)
    host_user_id: Optional[int] = None  # If None, use rotation
    created_by: Optional[int] = None    # Passed explicitly from web UI
    rsvp_deadline: Optional[datetime] = None
    # Link to an existing recurring schedule (poll → recurring event conversion)
    parent_recurring_id: Optional[int] = None
    # Recurring fields (only used when is_recurring=True)
    is_recurring: bool = False
    recurrence_rule: Optional[str] = None        # weekly | biweekly | monthly
    recurrence_day_of_week: Optional[int] = None # 0=Mon … 6=Sun
    recurrence_time: Optional[str] = None        # HH:MM
    recurrence_end_date: Optional[str] = None    # YYYY-MM-DD


class RecurringScheduleCreate(BaseModel):
    group_id: int
    activity_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    location: Optional[str] = Field(None, max_length=200)
    host_user_id: Optional[int] = None
    recurrence_rule: str                  # weekly | biweekly | monthly
    day_of_week: Optional[int] = None    # required unless monthly
    time_of_day: str = "18:00"
    end_date: str                         # YYYY-MM-DD


class RecurringScheduleResponse(BaseModel):
    id: int
    group_id: int
    activity_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    host_user_id: Optional[int] = None
    created_by: int
    recurrence_rule: str
    day_of_week: Optional[int] = None
    time_of_day: str
    end_date: Optional[str] = None
    next_occurrence: str
    is_active: bool
    created_at: datetime


class EventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    scheduled_date: Optional[datetime] = None
    location: Optional[str] = Field(None, max_length=200)
    host_user_id: Optional[int] = None
    status: Optional[EventStatus] = None
    rsvp_deadline: Optional[datetime] = None
    bg_type: Optional[str] = None
    bg_value: Optional[str] = None
    bg_scope: Optional[str] = None


class EventResponse(BaseModel):
    id: int
    group_id: int
    activity_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    location: Optional[str] = None
    cover_url: Optional[str] = None
    bg_type: Optional[str] = "default"
    bg_value: Optional[str] = None
    bg_scope: Optional[str] = "hero"
    host_user_id: int
    status: EventStatus
    created_by: int
    created_at: datetime
    updated_at: datetime
    rsvp_deadline: Optional[datetime] = None


class EventDetailResponse(EventResponse):
    attendees: List['AttendeeResponse']
    activity_name: Optional[str] = None
    photo_count: int = 0


# Attendee models
class AttendeeAdd(BaseModel):
    user_id: int


class AttendeeRSVP(BaseModel):
    user_id: int
    status: str = Field(..., pattern="^(going|maybe|not_going)$")


class AttendeeUpdateStatus(BaseModel):
    status: str = Field(..., pattern="^(going|maybe|not_going)$")


class AttendeeResponse(BaseModel):
    event_id: int
    user_id: int
    status: str
    responded_at: datetime


# Event comment models
class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)


class CommentResponse(BaseModel):
    id: int
    event_id: int
    user_id: int
    content: str
    created_at: datetime


# Event history models
class EventHistoryResponse(BaseModel):
    id: int
    event_id: int
    user_id: int
    action: str
    details: Optional[str]
    created_at: datetime


# Event photo models
class PhotoConfirmRequest(BaseModel):
    object_key: str
    public_url: str
    caption: Optional[str] = Field(None, max_length=200)


class PhotoResponse(BaseModel):
    id: int
    event_id: int
    user_id: int
    object_key: str
    public_url: str
    caption: Optional[str]
    uploaded_at: datetime


# Cover upload models (reuse UploadUrlResponse from main.py)

# Update forward references
EventDetailResponse.model_rebuild()
