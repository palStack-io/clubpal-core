from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uuid
import httpx
import logging
from datetime import date, datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.models import (
    EventCreate, EventUpdate, EventResponse, EventDetailResponse,
    AttendeeAdd, AttendeeRSVP, AttendeeUpdateStatus, AttendeeResponse,
    CommentCreate, CommentResponse, EventHistoryResponse,
    PhotoConfirmRequest, PhotoResponse,
    RecurringScheduleCreate, RecurringScheduleResponse,
)
from app.database import (
    init_db, get_db, create_event, get_event, get_events_by_group, get_events_by_user,
    get_events_by_host, update_event, delete_event,
    add_attendee, upsert_attendee, get_attendee, get_attendees, update_attendee_status, remove_attendee,
    add_comment, get_comment, get_comments, delete_comment, get_event_history,
    add_photo, get_photo, get_photos, delete_photo,
    create_recurring_schedule, get_due_recurring_schedules,
    advance_recurring_schedule, deactivate_recurring_schedule,
    get_recurring_schedules_for_group, get_recurring_schedule_by_id
)
from app import storage

logger = logging.getLogger(__name__)

app = FastAPI(title="ClubPal Events Service", version="1.0.0")
scheduler = AsyncIOScheduler()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service URLs
GROUPS_SERVICE_URL     = "http://groups-service:8002"
ACTIVITIES_SERVICE_URL = "http://activities-service:8005"
GATEWAY_URL            = "http://api-gateway:8001"


def get_current_user_id(authorization: Optional[str] = Header(None)) -> int:
    """Validate Bearer token against gateway and return the authenticated user's ID."""
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


def _next_occurrence(rule: str, day_of_week: Optional[int], from_date: date) -> date:
    """Calculate the next occurrence date from a given date."""
    if rule == 'weekly':
        target_dow = day_of_week if day_of_week is not None else from_date.weekday()
        days_ahead = (target_dow - from_date.weekday()) % 7 or 7
        return from_date + timedelta(days=days_ahead)
    elif rule == 'biweekly':
        target_dow = day_of_week if day_of_week is not None else from_date.weekday()
        days_ahead = (target_dow - from_date.weekday()) % 7 or 7
        return from_date + timedelta(days=days_ahead + 7)
    elif rule == 'monthly':
        # Same day next month
        month = from_date.month + 1 if from_date.month < 12 else 1
        year  = from_date.year + (1 if from_date.month == 12 else 0)
        import calendar
        last_day = calendar.monthrange(year, month)[1]
        return date(year, month, min(from_date.day, last_day))
    return from_date + timedelta(days=7)


async def _notify_group_members(group_id: int, event_id: int, event_title: str,
                                 event_date: str, event_type: str = 'event',
                                 deadline: str = None):
    """Hit the internal gateway notify endpoint for all group members."""
    try:
        payload = {
            "group_id": group_id,
            "event_id": event_id,
            "event_title": event_title,
            "event_date": event_date,
            "type": event_type,
        }
        if deadline:
            payload["deadline"] = deadline
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{GATEWAY_URL}/internal/notify/event",
                json=payload
            )
    except Exception as e:
        logger.warning(f"Failed to notify members for event {event_id}: {e}")


async def send_rsvp_deadline_reminders():
    """Hourly job: send reminder emails for events whose RSVP deadline is within 25 hours."""
    logger.info("Running RSVP deadline reminder job")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM events
        WHERE rsvp_deadline BETWEEN NOW() AND NOW() + INTERVAL '25 hours'
          AND rsvp_deadline > NOW()
          AND status = 'scheduled'
    """)
    events = [dict(r) for r in cursor.fetchall()]
    conn.close()

    for event in events:
        try:
            deadline = event.get('rsvp_deadline')
            deadline_str = deadline.strftime('%A, %b %-d at %-I:%M %p') if deadline else ''
            sched = event.get('scheduled_date')
            event_date_str = sched.strftime('%A, %b %-d at %-I:%M %p') if sched else ''
            await _notify_group_members(
                group_id=event['group_id'],
                event_id=event['id'],
                event_title=event['title'],
                event_date=event_date_str,
                event_type='rsvp_reminder',
                deadline=deadline_str,
            )
        except Exception as e:
            logger.error(f"Failed to send RSVP reminder for event {event['id']}: {e}")


async def send_rsvp_deadline_final_counts():
    """Hourly job: after RSVP deadline passes, send final headcount to event creator."""
    logger.info("Running RSVP deadline final-count job")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM events
        WHERE rsvp_deadline IS NOT NULL
          AND rsvp_deadline <= NOW()
          AND deadline_notification_sent = FALSE
          AND status = 'scheduled'
    """)
    events = [dict(r) for r in cursor.fetchall()]
    conn.close()

    for event in events:
        try:
            conn2 = get_db()
            cur2 = conn2.cursor()
            # Count attendees by status
            cur2.execute("""
                SELECT rsvp_status, COUNT(*) AS cnt
                FROM event_attendees
                WHERE event_id = %s
                GROUP BY rsvp_status
            """, (event['id'],))
            counts = {row['rsvp_status']: row['cnt'] for row in cur2.fetchall()}
            going = counts.get('going', 0)
            maybe = counts.get('maybe', 0)
            not_going = counts.get('not_going', 0)

            sched = event.get('scheduled_date')
            event_date_str = sched.strftime('%A, %b %-d at %-I:%M %p') if sched else ''

            # Only notify the creator
            creator_id = event.get('created_by') or event.get('host_user_id')
            payload = {
                "user_ids": [creator_id] if creator_id else [],
                "group_id": event['group_id'],
                "event_id": event['id'],
                "event_title": event['title'],
                "event_date": event_date_str,
                "type": "rsvp_deadline_final",
                "going_count": going,
                "maybe_count": maybe,
                "not_going_count": not_going,
            }
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(f"{GATEWAY_URL}/internal/notify/event", json=payload)

            # Mark as sent so we don't re-send
            cur2.execute(
                "UPDATE events SET deadline_notification_sent = TRUE WHERE id = %s",
                (event['id'],)
            )
            conn2.commit()
            conn2.close()
        except Exception as e:
            logger.error(f"Failed to send deadline final count for event {event['id']}: {e}")


async def spawn_recurring_instances():
    """Daily job: create event instances for all due recurring schedules."""
    logger.info("Running recurring events scheduler")
    due = get_due_recurring_schedules()
    for schedule in due:
        try:
            sched_date = datetime.combine(
                schedule['next_occurrence'],
                datetime.strptime(schedule.get('time_of_day', '18:00'), '%H:%M').time()
            )
            event_id = create_event(
                group_id=schedule['group_id'],
                activity_id=schedule['activity_id'],
                title=schedule['title'],
                description=schedule.get('description'),
                scheduled_date=sched_date,
                location=schedule.get('location'),
                host_user_id=schedule['host_user_id'],
                created_by=schedule['created_by'],
            )
            logger.info(f"Created recurring event {event_id} from schedule {schedule['id']}")

            # Notify group members
            await _notify_group_members(
                group_id=schedule['group_id'],
                event_id=event_id,
                event_title=schedule['title'],
                event_date=sched_date.strftime('%A, %b %-d at %-I:%M %p'),
                event_type='recurring',
            )

            # Calculate next occurrence
            next_occ = _next_occurrence(
                schedule['recurrence_rule'],
                schedule.get('day_of_week'),
                schedule['next_occurrence']
            )

            # Deactivate if past end_date
            if schedule.get('end_date') and next_occ > schedule['end_date']:
                deactivate_recurring_schedule(schedule['id'])
            else:
                advance_recurring_schedule(schedule['id'], next_occ)

        except Exception as e:
            logger.error(f"Failed to spawn event from schedule {schedule['id']}: {e}")


@app.on_event("startup")
async def startup():
    """Initialize database on startup."""
    init_db()
    storage.ensure_buckets()
    # Schedule daily recurring event generation at 07:00
    scheduler.add_job(spawn_recurring_instances, 'cron', hour=7, minute=0,
                      id='recurring_events', replace_existing=True)
    # Schedule hourly RSVP deadline reminders
    scheduler.add_job(send_rsvp_deadline_reminders, 'cron', minute=0,
                      id='rsvp_deadline_reminders', replace_existing=True)
    # Schedule hourly final headcount notifications after RSVP deadline
    scheduler.add_job(send_rsvp_deadline_final_counts, 'cron', minute=5,
                      id='rsvp_deadline_final_counts', replace_existing=True)
    scheduler.start()
    print("Events service started")


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "events-service"}


async def get_rotation_user(group_id: int) -> Optional[int]:
    """Get the current rotation user from groups service."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{GROUPS_SERVICE_URL}/groups/{group_id}/rotation")
            if response.status_code == 200:
                data = response.json()
                return data.get("user_id")
        except httpx.RequestError:
            pass
    return None


async def get_activity_name(activity_id: int) -> Optional[str]:
    """Get activity name from activities service."""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{ACTIVITIES_SERVICE_URL}/activities/{activity_id}")
            if response.status_code == 200:
                data = response.json()
                return data.get("name")
        except httpx.RequestError:
            pass
    return None


# ===== Event Endpoints =====

@app.post("/events", response_model=EventResponse, status_code=201)
async def create_event_endpoint(event_data: EventCreate, user_id: int = Depends(get_current_user_id)):
    """Create a new event. If is_recurring=True, also registers a recurring schedule."""
    # creator may be passed explicitly from the web UI payload
    creator_id = event_data.created_by or user_id

    # Determine host user
    host_user_id = event_data.host_user_id
    if not host_user_id:
        rotation_user_id = await get_rotation_user(event_data.group_id)
        if not rotation_user_id:
            raise HTTPException(status_code=400, detail="Could not determine host from rotation")
        host_user_id = rotation_user_id

    # Create the (first) event instance
    event_id = create_event(
        group_id=event_data.group_id,
        activity_id=event_data.activity_id,
        activity_type=event_data.activity_type,
        title=event_data.title,
        description=event_data.description,
        scheduled_date=event_data.scheduled_date,
        location=event_data.location,
        host_user_id=host_user_id,
        created_by=creator_id,
        rsvp_deadline=event_data.rsvp_deadline,
        parent_recurring_id=event_data.parent_recurring_id,
        max_attendees=event_data.max_attendees,
    )

    # If linked to an existing recurring schedule, advance it so the daily job
    # doesn't spawn a duplicate for this occurrence
    if event_data.parent_recurring_id:
        try:
            sched = get_recurring_schedule_by_id(event_data.parent_recurring_id)
            if sched and sched.get('is_active'):
                next_occ = _next_occurrence(
                    sched['recurrence_rule'],
                    sched.get('day_of_week'),
                    sched['next_occurrence']
                )
                if sched.get('end_date') and next_occ > sched['end_date']:
                    deactivate_recurring_schedule(event_data.parent_recurring_id)
                else:
                    advance_recurring_schedule(event_data.parent_recurring_id, next_occ)
        except Exception as e:
            logger.warning(f"Could not advance recurring schedule {event_data.parent_recurring_id}: {e}")

    # If recurring, register the schedule so the scheduler spawns future instances
    if event_data.is_recurring and event_data.recurrence_rule and event_data.recurrence_end_date:
        try:
            import calendar
            first_occ = (event_data.scheduled_date.date()
                         if event_data.scheduled_date else date.today())
            second_occ = _next_occurrence(
                event_data.recurrence_rule,
                event_data.recurrence_day_of_week,
                first_occ,
            )
            end_dt = date.fromisoformat(event_data.recurrence_end_date)
            if second_occ <= end_dt:
                create_recurring_schedule(
                    group_id=event_data.group_id,
                    activity_id=event_data.activity_id,
                    title=event_data.title,
                    description=event_data.description,
                    location=event_data.location,
                    host_user_id=host_user_id,
                    created_by=creator_id,
                    recurrence_rule=event_data.recurrence_rule,
                    day_of_week=event_data.recurrence_day_of_week,
                    time_of_day=event_data.recurrence_time or "18:00",
                    next_occurrence=second_occ,
                    end_date=end_dt,
                )
        except Exception as e:
            logger.error(f"Failed to create recurring schedule for event {event_id}: {e}")

    event = get_event(event_id)
    return EventResponse(**event)


@app.get("/events/{event_id}", response_model=EventDetailResponse)
async def get_event_endpoint(event_id: int):
    """Get event details with attendees."""
    event = get_event(event_id)

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Get attendees
    attendees = get_attendees(event_id)
    attendee_responses = [AttendeeResponse(**attendee) for attendee in attendees]

    # Get activity name
    activity_name = await get_activity_name(event["activity_id"])

    # Get photo count
    photos = get_photos(event_id)

    return EventDetailResponse(
        **event,
        attendees=attendee_responses,
        activity_name=activity_name,
        photo_count=len(photos)
    )


@app.get("/groups/{group_id}/events", response_model=List[EventResponse])
async def get_group_events(group_id: int, status: Optional[str] = None):
    """Get all events for a group."""
    events = get_events_by_group(group_id, status)
    return [EventResponse(**event) for event in events]


@app.get("/users/{user_id}/events", response_model=List[EventResponse])
async def get_user_events(user_id: int, status: Optional[str] = None):
    """Get all events a user is attending."""
    events = get_events_by_user(user_id, status)
    return [EventResponse(**event) for event in events]


@app.get("/users/{user_id}/hosting", response_model=List[EventResponse])
async def get_user_hosting_events(user_id: int, status: Optional[str] = None):
    """Get all events hosted by a user."""
    events = get_events_by_host(user_id, status)
    return [EventResponse(**event) for event in events]


@app.patch("/events/{event_id}", response_model=EventResponse)
async def update_event_endpoint(event_id: int, event_data: EventUpdate, user_id: int = Depends(get_current_user_id)):
    """Update event details."""
    # Check if event exists
    event = get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Update event
    success = update_event(
        event_id,
        title=event_data.title,
        description=event_data.description,
        scheduled_date=event_data.scheduled_date,
        location=event_data.location,
        host_user_id=event_data.host_user_id,
        status=event_data.status,
        updated_by=user_id,
        rsvp_deadline=event_data.rsvp_deadline,
        max_attendees=event_data.max_attendees,
        bg_type=event_data.bg_type,
        bg_value=event_data.bg_value,
        bg_scope=event_data.bg_scope,
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update event")

    event = get_event(event_id)
    return EventResponse(**event)


@app.delete("/events/{event_id}", status_code=204)
async def delete_event_endpoint(event_id: int, user_id: int = Depends(get_current_user_id)):
    """Delete an event."""
    event = get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Only creator or host can delete
    if event["created_by"] != user_id and event["host_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this event")

    success = delete_event(event_id, user_id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete event")


# ===== Attendee Endpoints =====

@app.post("/events/{event_id}/rsvp", response_model=AttendeeResponse)
async def rsvp_event(event_id: int, rsvp_data: AttendeeRSVP, user_id: int = Depends(get_current_user_id)):
    """Upsert an RSVP for an event — creates or updates the attendee record."""
    event = get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Enforce seat cap when RSVPing as "going"
    if rsvp_data.status == "going" and event.get("max_attendees"):
        existing = get_attendee(event_id, user_id)
        # Only check capacity if the user isn't already "going"
        if not existing or existing["status"] != "going":
            attendees = get_attendees(event_id)
            going_count = sum(1 for a in attendees if a["status"] == "going")
            if going_count >= event["max_attendees"]:
                raise HTTPException(status_code=409, detail="This event is full")

    attendee = upsert_attendee(event_id, user_id, rsvp_data.status)
    return AttendeeResponse(**attendee)


@app.post("/events/{event_id}/attendees", response_model=AttendeeResponse, status_code=201)
async def add_attendee_endpoint(event_id: int, attendee_data: AttendeeAdd):
    """Add an attendee to an event."""
    # Check if event exists
    if not get_event(event_id):
        raise HTTPException(status_code=404, detail="Event not found")

    # Add attendee
    success = add_attendee(event_id, attendee_data.user_id)

    if not success:
        raise HTTPException(status_code=400, detail="User is already an attendee")

    attendee = get_attendee(event_id, attendee_data.user_id)
    return AttendeeResponse(**attendee)


@app.get("/events/{event_id}/attendees", response_model=List[AttendeeResponse])
async def get_attendees_endpoint(event_id: int):
    """Get all attendees for an event."""
    # Check if event exists
    if not get_event(event_id):
        raise HTTPException(status_code=404, detail="Event not found")

    attendees = get_attendees(event_id)
    return [AttendeeResponse(**attendee) for attendee in attendees]


@app.get("/events/{event_id}/attendees/{user_id}", response_model=AttendeeResponse)
async def get_attendee_endpoint(event_id: int, user_id: int):
    """Get a specific attendee."""
    attendee = get_attendee(event_id, user_id)

    if not attendee:
        raise HTTPException(status_code=404, detail="Attendee not found")

    return AttendeeResponse(**attendee)


@app.patch("/events/{event_id}/attendees/{user_id}", response_model=AttendeeResponse)
async def update_attendee_status_endpoint(event_id: int, user_id: int,
                                         status_data: AttendeeUpdateStatus):
    """Update an attendee's status."""
    # Check if attendee exists
    if not get_attendee(event_id, user_id):
        raise HTTPException(status_code=404, detail="Attendee not found")

    # Update status
    success = update_attendee_status(event_id, user_id, status_data.status)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update attendee status")

    attendee = get_attendee(event_id, user_id)
    return AttendeeResponse(**attendee)


@app.delete("/events/{event_id}/attendees/{user_id}", status_code=204)
async def remove_attendee_endpoint(event_id: int, user_id: int):
    """Remove an attendee from an event."""
    success = remove_attendee(event_id, user_id)

    if not success:
        raise HTTPException(status_code=404, detail="Attendee not found")


# ===== Comment Endpoints =====

@app.post("/events/{event_id}/comments", response_model=CommentResponse, status_code=201)
async def add_comment_endpoint(event_id: int, comment_data: CommentCreate, user_id: int = Depends(get_current_user_id)):
    """Add a comment to an event."""
    # Check if event exists
    if not get_event(event_id):
        raise HTTPException(status_code=404, detail="Event not found")

    # Add comment
    comment_id = add_comment(event_id, user_id, comment_data.content)

    comment = get_comment(comment_id)
    return CommentResponse(**comment)


@app.get("/events/{event_id}/comments", response_model=List[CommentResponse])
async def get_comments_endpoint(event_id: int):
    """Get all comments for an event."""
    # Check if event exists
    if not get_event(event_id):
        raise HTTPException(status_code=404, detail="Event not found")

    comments = get_comments(event_id)
    return [CommentResponse(**comment) for comment in comments]


@app.delete("/events/{event_id}/comments/{comment_id}", status_code=204)
async def delete_comment_endpoint(event_id: int, comment_id: int, user_id: int = Depends(get_current_user_id)):
    """Delete a comment."""
    comment = get_comment(comment_id)

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    # Only comment author can delete
    if comment["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

    success = delete_comment(comment_id, user_id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete comment")


# ===== Storage / Photo Endpoints =====

class EventImageUploadRequest(BaseModel):
    filename: str
    content_type: str = "image/jpeg"

class UploadUrlResponse(BaseModel):
    upload_url: str
    public_url: str
    object_name: str


@app.post("/events/{event_id}/cover/upload-url", response_model=UploadUrlResponse)
async def get_event_cover_upload_url(event_id: int, request: EventImageUploadRequest,
                                      user_id: int = Depends(get_current_user_id)):
    """Get a pre-signed URL to upload an event cover image."""
    event = get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event["host_user_id"] != user_id and event["created_by"] != user_id:
        raise HTTPException(status_code=403, detail="Only the host can update the cover image")

    ext = request.filename.rsplit(".", 1)[-1].lower() if "." in request.filename else "jpg"
    object_name = f"events/{event_id}/cover-{uuid.uuid4().hex[:8]}.{ext}"

    upload_url = storage.presigned_upload_url(
        storage.BUCKET_EVENTS, object_name, content_type=request.content_type,
    )
    public_url = storage.public_object_url(storage.BUCKET_EVENTS, object_name)

    return UploadUrlResponse(upload_url=upload_url, public_url=public_url, object_name=object_name)


@app.post("/events/{event_id}/photos/upload-url", response_model=UploadUrlResponse)
async def get_photo_upload_url(event_id: int, request: EventImageUploadRequest, user_id: int = Depends(get_current_user_id)):
    """Get a pre-signed URL to upload a member photo for an event."""
    if not get_event(event_id):
        raise HTTPException(status_code=404, detail="Event not found")

    ext = request.filename.rsplit(".", 1)[-1].lower() if "." in request.filename else "jpg"
    object_name = f"events/{event_id}/photos/{user_id}/{uuid.uuid4().hex}.{ext}"

    upload_url = storage.presigned_upload_url(
        storage.BUCKET_EVENTS, object_name, content_type=request.content_type,
    )
    public_url = storage.public_object_url(storage.BUCKET_EVENTS, object_name)

    return UploadUrlResponse(upload_url=upload_url, public_url=public_url, object_name=object_name)


@app.post("/events/{event_id}/photos/confirm", response_model=PhotoResponse, status_code=201)
async def confirm_photo_upload(event_id: int, body: PhotoConfirmRequest, user_id: int = Depends(get_current_user_id)):
    """Save a photo to the DB after the client has PUT it to MinIO."""
    if not get_event(event_id):
        raise HTTPException(status_code=404, detail="Event not found")

    photo_id = add_photo(
        event_id=event_id,
        user_id=user_id,
        object_key=body.object_key,
        public_url=body.public_url,
        caption=body.caption,
    )

    photo = get_photo(photo_id)
    return PhotoResponse(**photo)


@app.get("/events/{event_id}/photos", response_model=List[PhotoResponse])
async def list_photos(event_id: int):
    """List all photos for an event."""
    if not get_event(event_id):
        raise HTTPException(status_code=404, detail="Event not found")

    return [PhotoResponse(**p) for p in get_photos(event_id)]


@app.delete("/events/{event_id}/photos/{photo_id}", status_code=204)
async def remove_photo(event_id: int, photo_id: int, user_id: int = Depends(get_current_user_id)):
    """Delete a photo — only the uploader can delete their own photos."""
    photo = get_photo(photo_id)

    if not photo or photo["event_id"] != event_id:
        raise HTTPException(status_code=404, detail="Photo not found")

    if photo["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own photos")

    storage.delete_object(storage.BUCKET_EVENTS, photo["object_key"])
    delete_photo(photo_id, deleted_by=user_id)


# ===== Recurring Schedule Endpoints =====

@app.post("/recurring-schedules", response_model=RecurringScheduleResponse, status_code=201)
async def create_recurring_schedule_endpoint(data: RecurringScheduleCreate, user_id: int = Depends(get_current_user_id)):
    """Directly create a recurring schedule (without creating the first event instance)."""
    end_dt = date.fromisoformat(data.end_date)
    first_occ = _next_occurrence(data.recurrence_rule, data.day_of_week, date.today())
    if first_occ > end_dt:
        raise HTTPException(status_code=400, detail="end_date is before the first occurrence")

    sched_id = create_recurring_schedule(
        group_id=data.group_id,
        activity_id=data.activity_id,
        title=data.title,
        description=data.description,
        location=data.location,
        host_user_id=data.host_user_id,
        created_by=user_id,
        recurrence_rule=data.recurrence_rule,
        day_of_week=data.day_of_week,
        time_of_day=data.time_of_day,
        next_occurrence=first_occ,
        end_date=end_dt,
    )

    rows = get_recurring_schedules_for_group(data.group_id)
    sched = next((r for r in rows if r["id"] == sched_id), None)
    if not sched:
        raise HTTPException(status_code=500, detail="Failed to retrieve created schedule")

    return RecurringScheduleResponse(
        **{k: (str(v) if isinstance(v, date) else v) for k, v in sched.items()
           if k in RecurringScheduleResponse.model_fields}
    )


@app.get("/groups/{group_id}/recurring-schedules", response_model=List[RecurringScheduleResponse])
async def list_recurring_schedules(group_id: int):
    """List all recurring schedules for a group."""
    rows = get_recurring_schedules_for_group(group_id)
    result = []
    for r in rows:
        result.append(RecurringScheduleResponse(
            **{k: (str(v) if isinstance(v, date) else v) for k, v in r.items()
               if k in RecurringScheduleResponse.model_fields}
        ))
    return result


@app.delete("/recurring-schedules/{schedule_id}", status_code=204)
async def cancel_recurring_schedule(schedule_id: int, user_id: int = Depends(get_current_user_id)):
    """Deactivate a recurring schedule (stops future event generation)."""
    deactivate_recurring_schedule(schedule_id)


# ===== History Endpoint =====

@app.get("/events/{event_id}/history", response_model=List[EventHistoryResponse])
async def get_event_history_endpoint(event_id: int):
    """Get event history/audit log."""
    # Check if event exists
    if not get_event(event_id):
        raise HTTPException(status_code=404, detail="Event not found")

    history = get_event_history(event_id)
    return [EventHistoryResponse(**entry) for entry in history]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
