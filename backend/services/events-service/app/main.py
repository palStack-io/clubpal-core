from fastapi import FastAPI, HTTPException, Header, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import ENCODERS_BY_TYPE
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
ENCODERS_BY_TYPE[datetime] = lambda dt: dt.strftime('%Y-%m-%dT%H:%M:%SZ') if dt else None
import os
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
    remove_user_from_all_events,
    add_comment, get_comment, get_comments, delete_comment, get_event_history,
    add_photo, get_photo, get_photos, delete_photo,
    create_recurring_schedule, get_due_recurring_schedules,
    advance_recurring_schedule, deactivate_recurring_schedule,
    get_recurring_schedules_for_group, get_recurring_schedule_by_id
)
from app import storage

logger = logging.getLogger(__name__)

_STORAGE_PREFIX = f"{storage.MINIO_PUBLIC_URL}/{storage.BUCKET_EVENTS}/"


def _cover_object_key(cover_url: str) -> Optional[str]:
    """Extract the MinIO object key from a public cover URL, or None if external."""
    if cover_url and cover_url.startswith(_STORAGE_PREFIX):
        return cover_url[len(_STORAGE_PREFIX):]
    return None


async def _mirror_external_cover(event_id: int, url: str) -> str:
    """Fetch an external image URL and upload it to MinIO. Returns the MinIO public URL."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url, follow_redirects=True)
            r.raise_for_status()
        content_type = r.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        ext = {"image/png": "png", "image/gif": "gif", "image/webp": "webp"}.get(content_type, "jpg")
        object_name = f"events/{event_id}/cover-{uuid.uuid4().hex[:8]}.{ext}"
        return storage.upload_bytes(storage.BUCKET_EVENTS, object_name, r.content, content_type)
    except Exception as e:
        logger.warning(f"Could not mirror cover image for event {event_id}: {e}")
        return url  # fall back to external URL if fetch fails

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
RATINGS_SERVICE_URL    = "http://ratings-service:8004"


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
                                 deadline: str = None, creator_id: int = None,
                                 has_rsvp: bool = True, hours_until: int = None):
    """Hit the internal gateway notify endpoint for all group members."""
    try:
        payload = {
            "group_id": group_id,
            "event_id": event_id,
            "event_title": event_title,
            "event_date": event_date,
            "type": event_type,
            "has_rsvp": has_rsvp,
        }
        if deadline:
            payload["deadline"] = deadline
        if creator_id:
            payload["creator_id"] = creator_id
        if hours_until is not None:
            payload["hours_until"] = hours_until
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


async def send_event_reminders():
    """Hourly job: send 24h and 1h pre-event push + email reminders to all group members."""
    conn = get_db()
    cursor = conn.cursor()

    # 24-hour window: events starting between 23h and 25h from now
    cursor.execute("""
        SELECT * FROM events
        WHERE status = 'scheduled'
          AND scheduled_date IS NOT NULL
          AND scheduled_date BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours'
          AND (reminder_24h_sent IS NULL OR reminder_24h_sent = FALSE)
    """)
    events_24h = [dict(r) for r in cursor.fetchall()]

    # 1-hour window: events starting between 45 min and 75 min from now
    cursor.execute("""
        SELECT * FROM events
        WHERE status = 'scheduled'
          AND scheduled_date IS NOT NULL
          AND scheduled_date BETWEEN NOW() + INTERVAL '45 minutes' AND NOW() + INTERVAL '75 minutes'
          AND (reminder_1h_sent IS NULL OR reminder_1h_sent = FALSE)
    """)
    events_1h = [dict(r) for r in cursor.fetchall()]
    conn.close()

    for event in events_24h:
        try:
            sched = event.get('scheduled_date')
            event_date_str = sched.strftime('%A, %b %-d at %-I:%M %p') if sched else ''
            await _notify_group_members(
                group_id=event['group_id'],
                event_id=event['id'],
                event_title=event['title'],
                event_date=event_date_str,
                event_type='reminder',
                hours_until=24,
            )
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("UPDATE events SET reminder_24h_sent = TRUE WHERE id = %s", (event['id'],))
            conn.commit()
            conn.close()
            logger.info(f"Sent 24h reminder for event {event['id']}")
        except Exception as e:
            logger.error(f"Failed to send 24h reminder for event {event['id']}: {e}")

    for event in events_1h:
        try:
            sched = event.get('scheduled_date')
            event_date_str = sched.strftime('%A, %b %-d at %-I:%M %p') if sched else ''
            await _notify_group_members(
                group_id=event['group_id'],
                event_id=event['id'],
                event_title=event['title'],
                event_date=event_date_str,
                event_type='reminder',
                hours_until=1,
            )
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("UPDATE events SET reminder_1h_sent = TRUE WHERE id = %s", (event['id'],))
            conn.commit()
            conn.close()
            logger.info(f"Sent 1h reminder for event {event['id']}")
        except Exception as e:
            logger.error(f"Failed to send 1h reminder for event {event['id']}: {e}")


async def auto_complete_past_events():
    """Hourly job: mark scheduled events as completed 10 hours after their start time."""
    logger.info("Running auto-complete past events job")
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE events
        SET status = 'completed', updated_at = NOW()
        WHERE status = 'scheduled'
          AND scheduled_date IS NOT NULL
          AND scheduled_date < NOW() - INTERVAL '10 hours'
    """)
    count = cursor.rowcount
    conn.commit()
    conn.close()
    if count:
        logger.info(f"Auto-completed {count} past events")


async def send_rating_prompts():
    """Hourly job: 3h after auto-complete, prompt 'going' attendees who haven't rated."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM events
        WHERE status = 'completed'
          AND ratings_enabled = TRUE
          AND (rating_prompt_sent IS NULL OR rating_prompt_sent = FALSE)
          AND updated_at BETWEEN NOW() - INTERVAL '3.5 hours' AND NOW() - INTERVAL '2.5 hours'
    """)
    events = [dict(r) for r in cursor.fetchall()]
    conn.close()

    for event in events:
        try:
            attendees = get_attendees(event["id"])
            going_ids = [a["user_id"] for a in attendees if a["status"] == "going"]
            if not going_ids:
                continue

            # Check who hasn't rated yet via ratings service
            rated_ids = set()
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    r = await client.get(f"{RATINGS_SERVICE_URL}/events/{event['id']}/ratings")
                    if r.status_code == 200:
                        rated_ids = {rating["user_id"] for rating in r.json()}
            except Exception:
                pass

            unrated_ids = [uid for uid in going_ids if uid not in rated_ids]
            if unrated_ids:
                sched = event.get("scheduled_date")
                event_date_str = sched.strftime("%A, %b %-d at %-I:%M %p") if sched else ""
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        f"{GATEWAY_URL}/internal/notify/event",
                        json={
                            "user_ids": unrated_ids,
                            "event_id": event["id"],
                            "event_title": event["title"],
                            "event_date": event_date_str,
                            "group_id": event["group_id"],
                            "type": "rating_prompt",
                        },
                    )

            # Mark as sent regardless to avoid re-processing
            conn2 = get_db()
            cur2 = conn2.cursor()
            cur2.execute("UPDATE events SET rating_prompt_sent = TRUE WHERE id = %s", (event["id"],))
            conn2.commit()
            conn2.close()
            logger.info(f"Sent rating prompts for event {event['id']}")
        except Exception as e:
            logger.error(f"Failed to send rating prompts for event {event['id']}: {e}")


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
    # Schedule hourly auto-complete of past events
    scheduler.add_job(auto_complete_past_events, 'cron', minute=15,
                      id='auto_complete_events', replace_existing=True)
    # Schedule hourly RSVP deadline reminders
    scheduler.add_job(send_rsvp_deadline_reminders, 'cron', minute=0,
                      id='rsvp_deadline_reminders', replace_existing=True)
    # Schedule hourly final headcount notifications after RSVP deadline
    scheduler.add_job(send_rsvp_deadline_final_counts, 'cron', minute=5,
                      id='rsvp_deadline_final_counts', replace_existing=True)
    # Schedule hourly 24h and 1h pre-event reminders
    scheduler.add_job(send_event_reminders, 'cron', minute=30,
                      id='event_reminders', replace_existing=True)
    # Schedule hourly post-event rating prompts (3h after completion)
    scheduler.add_job(send_rating_prompts, 'cron', minute=45,
                      id='rating_prompts', replace_existing=True)
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

    # Create the event first (no cover yet — we need event_id for proper MinIO path)
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
        cover_url=None,
        bill_split_enabled=event_data.bill_split_enabled,
        ratings_enabled=event_data.ratings_enabled,
    )

    # Mirror cover into MinIO under the real event path
    if event_data.banner_url:
        if event_data.banner_url.startswith(_STORAGE_PREFIX):
            # Already in our MinIO — just store it
            update_event(event_id, cover_url=event_data.banner_url)
        else:
            # External URL — fetch and upload to MinIO
            cover_url = await _mirror_external_cover(event_id, event_data.banner_url)
            update_event(event_id, cover_url=cover_url)

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

    # Auto-RSVP the creator and host as "going" so the event appears in their list
    already_rsvped = {creator_id}
    try:
        upsert_attendee(event_id, creator_id, "going")
        if host_user_id and host_user_id != creator_id:
            upsert_attendee(event_id, host_user_id, "going")
            already_rsvped.add(host_user_id)
    except Exception as e:
        logger.warning(f"Could not auto-RSVP creator for event {event_id}: {e}")

    # Add all other group members as "pending" so the event appears on their dashboards
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{GROUPS_SERVICE_URL}/groups/{event_data.group_id}/members")
            if r.status_code == 200:
                for member in r.json():
                    uid = member.get("user_id")
                    if uid and uid not in already_rsvped:
                        try:
                            upsert_attendee(event_id, uid, "pending")
                        except Exception as e:
                            logger.warning(f"Could not add pending attendee {uid} for event {event_id}: {e}")
    except Exception as e:
        logger.warning(f"Could not fetch group members to add pending attendees for event {event_id}: {e}")

    # Increment hosted-events counter in ratings service
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(f"{RATINGS_SERVICE_URL}/users/{host_user_id}/hosted-events/increment")
    except Exception as e:
        logger.warning(f"Could not increment hosted events for user {host_user_id}: {e}")

    # Notify all group members to RSVP for the new event
    sched_str = ''
    if event_data.scheduled_date:
        try:
            sched_str = event_data.scheduled_date.strftime('%A, %b %-d at %-I:%M %p')
        except Exception:
            sched_str = str(event_data.scheduled_date)
    deadline_str = None
    if event_data.rsvp_deadline:
        try:
            deadline_str = event_data.rsvp_deadline.strftime('%A, %b %-d at %-I:%M %p')
        except Exception:
            deadline_str = str(event_data.rsvp_deadline)
    await _notify_group_members(
        group_id=event_data.group_id,
        event_id=event_id,
        event_title=event_data.title,
        event_date=sched_str,
        event_type='created',
        deadline=deadline_str,
        creator_id=creator_id,
        has_rsvp=bool(event_data.rsvp_deadline),
    )

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

    # Capture fields before update to detect silent edits
    old_scheduled_date = event.get("scheduled_date")
    old_location = event.get("location") or ""

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
        cover_url=event_data.cover_url,
        bg_type=event_data.bg_type,
        bg_value=event_data.bg_value,
        bg_scope=event_data.bg_scope,
        ratings_enabled=event_data.ratings_enabled,
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update event")

    event = get_event(event_id)

    # Silent edit alert: notify "going" attendees if date or location changed
    date_changed = (event_data.scheduled_date is not None and
                    event_data.scheduled_date != old_scheduled_date)
    location_changed = (event_data.location is not None and
                        (event_data.location or "") != old_location)
    if date_changed or location_changed:
        try:
            attendees = get_attendees(event_id)
            notify_ids = [a["user_id"] for a in attendees
                          if a["status"] == "going" and a["user_id"] != user_id]
            if notify_ids:
                sched = event.get("scheduled_date")
                event_date_str = sched.strftime("%A, %b %-d at %-I:%M %p") if sched else ""
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        f"{GATEWAY_URL}/internal/notify/event",
                        json={
                            "user_ids": notify_ids,
                            "event_id": event_id,
                            "event_title": event["title"],
                            "event_date": event_date_str,
                            "group_id": event["group_id"],
                            "type": "event_edit",
                        },
                    )
        except Exception as e:
            logger.warning(f"Failed to send edit alerts for event {event_id}: {e}")

    return EventResponse(**event)


@app.post("/events/{event_id}/end", response_model=EventResponse)
async def end_event(event_id: int, user_id: int = Depends(get_current_user_id)):
    """Host or creator manually marks an event as completed."""
    event = get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event["created_by"] != user_id and event["host_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Only the host or creator can end this event")
    if event["status"] not in ("scheduled", "in_progress"):
        raise HTTPException(status_code=400, detail="Event is already completed or cancelled")
    update_event(event_id, status="completed")
    return EventResponse(**get_event(event_id))


@app.delete("/events/{event_id}/cover", status_code=204)
async def delete_event_cover(event_id: int, user_id: int = Depends(get_current_user_id)):
    """Remove the cover image from an event and delete it from storage."""
    event = get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event["created_by"] != user_id and event["host_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    cover_url = event.get("cover_url")
    if cover_url:
        key = _cover_object_key(cover_url)
        if key:
            storage.delete_object(storage.BUCKET_EVENTS, key)
        update_event(event_id, cover_url="")  # clear in DB


@app.delete("/events/{event_id}", status_code=204)
async def delete_event_endpoint(event_id: int, user_id: int = Depends(get_current_user_id)):
    """Delete an event."""
    event = get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Only creator or host can delete
    if event["created_by"] != user_id and event["host_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this event")

    # Notify going/maybe attendees before deletion
    try:
        attendees = get_attendees(event_id)
        notify_ids = [a["user_id"] for a in attendees
                      if a["status"] in ("going", "maybe") and a["user_id"] != user_id]
        if notify_ids:
            sched = event.get("scheduled_date")
            event_date_str = sched.strftime("%A, %b %-d at %-I:%M %p") if sched else ""
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    f"{GATEWAY_URL}/internal/notify/event",
                    json={
                        "user_ids": notify_ids,
                        "event_id": event_id,
                        "event_title": event["title"],
                        "event_date": event_date_str,
                        "group_id": event["group_id"],
                        "type": "event_cancelled",
                    },
                )
    except Exception as e:
        logger.warning(f"Failed to send cancellation notifications for event {event_id}: {e}")

    # Clean up cover image from MinIO
    cover_url = event.get("cover_url")
    if cover_url:
        key = _cover_object_key(cover_url)
        if key:
            storage.delete_object(storage.BUCKET_EVENTS, key)

    # Clean up all event photos from MinIO
    for photo in get_photos(event_id):
        if photo.get("object_key"):
            storage.delete_object(storage.BUCKET_EVENTS, photo["object_key"])

    success = delete_event(event_id, user_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete event")


# ===== Attendee Endpoints =====

@app.post("/events/{event_id}/rsvp-reminder", status_code=202)
async def send_rsvp_reminder(event_id: int, user_id: int = Depends(get_current_user_id)):
    """Event creator nudges all group members who haven't RSVPed 'going'."""
    event = get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event["created_by"] != user_id:
        raise HTTPException(status_code=403, detail="Only the event creator can send reminders")

    # Get group members
    group_member_ids: List[int] = []
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{GROUPS_SERVICE_URL}/groups/{event['group_id']}/members")
            if r.status_code == 200:
                group_member_ids = [m["user_id"] for m in r.json()]
    except Exception:
        pass

    # Exclude those already going + the creator
    going_ids = {a["user_id"] for a in get_attendees(event_id) if a["status"] == "going"}
    target_ids = [uid for uid in group_member_ids if uid != user_id and uid not in going_ids]

    if not target_ids:
        return {"nudged": 0, "message": "Everyone has already RSVPed going."}

    sched = event.get("scheduled_date")
    event_date_str = sched.strftime("%A, %b %-d at %-I:%M %p") if sched else ""

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{GATEWAY_URL}/internal/notify/event",
                json={
                    "user_ids": target_ids,
                    "event_id": event_id,
                    "event_title": event["title"],
                    "event_date": event_date_str,
                    "group_id": event["group_id"],
                    "creator_id": user_id,
                    "type": "rsvp_nudge",
                },
            )
    except Exception as e:
        logger.warning(f"Failed to send RSVP nudge for event {event_id}: {e}")

    return {"nudged": len(target_ids)}


@app.post("/events/{event_id}/rsvp", response_model=AttendeeResponse)
async def rsvp_event(event_id: int, rsvp_data: AttendeeRSVP, user_id: int = Depends(get_current_user_id)):
    """Upsert an RSVP for an event — creates or updates the attendee record."""
    event = get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Enforce seat cap when RSVPing as "going"
    previously_going = False
    if rsvp_data.status == "going" and event.get("max_attendees"):
        existing = get_attendee(event_id, user_id)
        if existing and existing["status"] == "going":
            previously_going = True
        elif existing is None or existing["status"] != "going":
            attendees = get_attendees(event_id)
            going_count = sum(1 for a in attendees if a["status"] == "going")
            if going_count >= event["max_attendees"]:
                raise HTTPException(status_code=409, detail="This event is full")
    else:
        existing = get_attendee(event_id, user_id)
        previously_going = existing and existing["status"] == "going"

    attendee = upsert_attendee(event_id, user_id, rsvp_data.status)

    # Post-RSVP notifications (fire-and-forget)
    if rsvp_data.status == "going" and not previously_going:
        try:
            all_attendees = get_attendees(event_id)
            going_count = sum(1 for a in all_attendees if a["status"] == "going")
            sched = event.get("scheduled_date")
            event_date_str = sched.strftime("%A, %b %-d at %-I:%M %p") if sched else ""

            # Get group member count for social nudge threshold
            group_member_count = 0
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    r = await client.get(f"{GROUPS_SERVICE_URL}/groups/{event['group_id']}/members")
                    if r.status_code == 200:
                        group_member_count = len(r.json())
            except Exception:
                pass

            # Social RSVP nudge to other "going" attendees (skip if group > 15)
            if group_member_count <= 15:
                other_going_ids = [a["user_id"] for a in all_attendees
                                   if a["status"] == "going" and a["user_id"] != user_id]
                if other_going_ids:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        await client.post(
                            f"{GATEWAY_URL}/internal/notify/event",
                            json={
                                "user_ids": other_going_ids,
                                "event_id": event_id,
                                "event_title": event["title"],
                                "event_date": event_date_str,
                                "group_id": event["group_id"],
                                "creator_id": user_id,
                                "type": "social_rsvp",
                            },
                        )

            # Event-full notification to host when max_attendees just reached
            if event.get("max_attendees") and going_count >= event["max_attendees"]:
                host_id = event.get("host_user_id") or event.get("created_by")
                if host_id and host_id != user_id:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        await client.post(
                            f"{GATEWAY_URL}/internal/notify/push",
                            json={
                                "user_id": host_id,
                                "title": f"🎉 {event['title']} is full!",
                                "body": f"All {event['max_attendees']} spots are taken",
                                "link_type": "event",
                                "link_id": event_id,
                            },
                        )
        except Exception as e:
            logger.warning(f"Failed to send post-RSVP notifications for event {event_id}: {e}")

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


@app.post("/events/{event_id}/cover/upload")
async def upload_event_cover(event_id: int, file: UploadFile = File(...), user_id: int = Depends(get_current_user_id)):
    """Upload an event cover image directly (no presigned URL required)."""
    event = get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    ext = (file.filename or "cover.jpg").rsplit(".", 1)[-1].lower()
    object_name = f"events/{event_id}/cover-{uuid.uuid4().hex[:8]}.{ext}"
    content = await file.read()
    public_url = storage.upload_bytes(storage.BUCKET_EVENTS, object_name, content, file.content_type or "image/jpeg")
    update_event(event_id, cover_url=public_url)
    return {"cover_url": public_url}


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


# ===== Internal Endpoints =====

@app.delete("/users/{user_id}/attendances", status_code=200)
async def remove_user_attendances_endpoint(user_id: int, x_internal_secret: str = Header(None)):
    """Internal: remove a deleted user from all event attendee records (called by gateway on account deletion)."""
    internal_secret = os.getenv("INTERNAL_API_SECRET", "")
    if not internal_secret or x_internal_secret != internal_secret:
        raise HTTPException(status_code=403, detail="Forbidden")
    count = remove_user_from_all_events(user_id)
    return {"removed_from_events": count}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
