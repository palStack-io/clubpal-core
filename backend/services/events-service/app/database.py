import psycopg2
import psycopg2.extras
import psycopg2.pool
import os
import threading
from typing import Optional, List
from datetime import datetime

# Database URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://clubpal:clubpal@db:5432/clubpal_events")

_pool = None
_pool_lock = threading.Lock()


def _get_pool():
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = psycopg2.pool.ThreadedConnectionPool(2, 20, dsn=DATABASE_URL)
    return _pool


class _PooledConn:
    def __init__(self, conn):
        self._conn = conn
        self._closed = False

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def close(self):
        if self._closed:
            return
        self._closed = True
        try:
            self._conn.rollback()
        except Exception:
            pass
        _get_pool().putconn(self._conn)

    def __del__(self):
        if not self._closed:
            self.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


def init_db():
    """Initialize database with schema."""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()

    # Events table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL,
            activity_id INTEGER,
            activity_type TEXT,
            title TEXT NOT NULL,
            description TEXT,
            scheduled_date TIMESTAMP,
            location TEXT,
            host_user_id INTEGER NOT NULL,
            status TEXT DEFAULT 'scheduled',
            cover_url TEXT,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Event attendees table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS event_attendees (
            id SERIAL PRIMARY KEY,
            event_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            status TEXT DEFAULT 'going',
            responded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
            UNIQUE(event_id, user_id)
        )
    """)

    # Event comments table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS event_comments (
            id SERIAL PRIMARY KEY,
            event_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        )
    """)

    # Event history/audit log
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS event_history (
            id SERIAL PRIMARY KEY,
            event_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        )
    """)

    # Event photos
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS event_photos (
            id SERIAL PRIMARY KEY,
            event_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            object_key TEXT NOT NULL,
            public_url TEXT NOT NULL,
            caption TEXT,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        )
    """)

    # Recurring schedules table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS recurring_schedules (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL,
            activity_id INTEGER,
            title TEXT NOT NULL,
            description TEXT,
            location TEXT,
            host_user_id INTEGER NOT NULL,
            created_by INTEGER NOT NULL,
            recurrence_rule TEXT NOT NULL,
            day_of_week INTEGER,
            time_of_day TEXT DEFAULT '18:00',
            next_occurrence DATE NOT NULL,
            end_date DATE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Migrations for existing databases
    try:
        cursor.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_url TEXT")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS parent_recurring_id INTEGER")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS rsvp_deadline TIMESTAMP")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS deadline_notification_sent BOOLEAN DEFAULT FALSE")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS activity_type TEXT")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS max_attendees INTEGER")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS bill_split_enabled BOOLEAN DEFAULT FALSE")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS ratings_enabled BOOLEAN DEFAULT TRUE")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS bring_list_enabled BOOLEAN DEFAULT FALSE")
        cursor.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS bring_list_type TEXT DEFAULT 'freeform'")
        cursor.execute("ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS bring_note TEXT")
        cursor.execute("ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS claim_item_id INTEGER")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT FALSE")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN DEFAULT FALSE")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS rating_prompt_sent BOOLEAN DEFAULT FALSE")
    except Exception:
        pass

    try:
        cursor.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS rsvp_reminder_sent BOOLEAN DEFAULT FALSE")
    except Exception:
        pass

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS event_bring_items (
            id SERIAL PRIMARY KEY,
            event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            label TEXT NOT NULL,
            emoji TEXT DEFAULT '',
            max_claims INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Background personalization migrations
    for col, defn in [
        ("bg_type", "TEXT DEFAULT 'default'"),
        ("bg_value", "TEXT"),
        ("bg_scope", "TEXT DEFAULT 'hero'"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE events ADD COLUMN IF NOT EXISTS {col} {defn}")
        except Exception:
            pass

    # Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_group ON events(group_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_activity ON events(activity_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_host ON events(host_user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_status ON events(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_date ON events(scheduled_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_attendees_event ON event_attendees(event_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_attendees_user ON event_attendees(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_comments_event ON event_comments(event_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_history_event ON event_history(event_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_photos_event ON event_photos(event_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_photos_user ON event_photos(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_event_bring_items_event ON event_bring_items(event_id)")

    conn.commit()
    conn.close()


def get_db():
    """Get a pooled database connection with dict cursor."""
    conn = _get_pool().getconn()
    conn.cursor_factory = psycopg2.extras.RealDictCursor
    return _PooledConn(conn)


# ===== Recurring Schedule CRUD =====

def create_recurring_schedule(group_id, activity_id, title, description, location,
                               host_user_id, created_by, recurrence_rule,
                               day_of_week, time_of_day, next_occurrence, end_date) -> int:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO recurring_schedules
               (group_id, activity_id, title, description, location, host_user_id, created_by,
                recurrence_rule, day_of_week, time_of_day, next_occurrence, end_date)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
            (group_id, activity_id, title, description, location, host_user_id, created_by,
             recurrence_rule, day_of_week, time_of_day, next_occurrence, end_date)
        )
        schedule_id = cursor.fetchone()['id']
        conn.commit()
        return schedule_id


def get_due_recurring_schedules():
    """Return active schedules whose next_occurrence is today or in the past."""
    from datetime import date
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT * FROM recurring_schedules
               WHERE is_active = TRUE
                 AND next_occurrence <= CURRENT_DATE
                 AND (end_date IS NULL OR end_date >= CURRENT_DATE)"""
        )
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


def advance_recurring_schedule(schedule_id: int, new_next_occurrence):
    """Update next_occurrence after spawning an event instance."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE recurring_schedules SET next_occurrence = %s WHERE id = %s",
            (new_next_occurrence, schedule_id)
        )
        conn.commit()


def deactivate_recurring_schedule(schedule_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE recurring_schedules SET is_active = FALSE WHERE id = %s", (schedule_id,))
        conn.commit()


def get_recurring_schedules_for_group(group_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM recurring_schedules WHERE group_id = %s ORDER BY created_at DESC", (group_id,))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]


# ===== Event CRUD =====

def get_recurring_schedule_by_id(schedule_id: int):
    """Get a single recurring schedule by ID."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM recurring_schedules WHERE id = %s", (schedule_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def create_event(group_id: int, activity_id: Optional[int], title: str, scheduled_date,
                created_by: int, host_user_id: int, description: str = None,
                location: str = None, rsvp_deadline=None, parent_recurring_id: int = None,
                activity_type: str = None, max_attendees: int = None,
                cover_url: str = None, bill_split_enabled: bool = False,
                ratings_enabled: bool = True, bring_list_enabled: bool = False,
                bring_list_type: str = "freeform") -> int:
    """Create a new event."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """INSERT INTO events (group_id, activity_id, activity_type, title, description, scheduled_date,
                                  location, host_user_id, created_by, rsvp_deadline, parent_recurring_id,
                                  max_attendees, cover_url, bill_split_enabled, ratings_enabled,
                                  bring_list_enabled, bring_list_type)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (group_id, activity_id, activity_type, title, description, scheduled_date, location,
             host_user_id, created_by, rsvp_deadline, parent_recurring_id, max_attendees, cover_url,
             bill_split_enabled, ratings_enabled, bring_list_enabled, bring_list_type)
        )

        event_id = cursor.fetchone()['id']

        # Log creation
        cursor.execute(
            """INSERT INTO event_history (event_id, user_id, action, details)
               VALUES (%s, %s, 'created', %s)""",
            (event_id, created_by, f"Event '{title}' created")
        )

        conn.commit()

        return event_id


def get_event(event_id: int) -> Optional[dict]:
    """Get event by ID."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM events WHERE id = %s", (event_id,))
        row = cursor.fetchone()

        return dict(row) if row else None


def get_events_by_group(group_id: int, status: str = None) -> List[dict]:
    """Get all events for a group, optionally filtered by status."""
    with get_db() as conn:
        cursor = conn.cursor()

        if status:
            cursor.execute(
                """SELECT * FROM events WHERE group_id = %s AND status = %s
                   ORDER BY scheduled_date ASC""",
                (group_id, status)
            )
        else:
            cursor.execute(
                "SELECT * FROM events WHERE group_id = %s ORDER BY scheduled_date ASC",
                (group_id,)
            )

        rows = cursor.fetchall()

        return [dict(row) for row in rows]


def get_events_by_user(user_id: int, status: str = None) -> List[dict]:
    """Get all events a user is attending, including their RSVP status."""
    with get_db() as conn:
        cursor = conn.cursor()

        if status:
            cursor.execute(
                """SELECT e.*, ea.status AS my_rsvp_status,
                      (SELECT COUNT(*) FROM event_attendees
                       WHERE event_id = e.id AND status = 'going') AS attendee_count
                   FROM events e
                   JOIN event_attendees ea ON e.id = ea.event_id
                   WHERE ea.user_id = %s AND e.status = %s
                   ORDER BY e.scheduled_date ASC""",
                (user_id, status)
            )
        else:
            cursor.execute(
                """SELECT e.*, ea.status AS my_rsvp_status,
                      (SELECT COUNT(*) FROM event_attendees
                       WHERE event_id = e.id AND status = 'going') AS attendee_count
                   FROM events e
                   JOIN event_attendees ea ON e.id = ea.event_id
                   WHERE ea.user_id = %s
                   ORDER BY e.scheduled_date ASC""",
                (user_id,)
            )

        rows = cursor.fetchall()

        return [dict(row) for row in rows]


def get_events_by_host(host_user_id: int, status: str = None) -> List[dict]:
    """Get all events hosted by a user."""
    with get_db() as conn:
        cursor = conn.cursor()

        if status:
            cursor.execute(
                """SELECT * FROM events WHERE host_user_id = %s AND status = %s
                   ORDER BY scheduled_date ASC""",
                (host_user_id, status)
            )
        else:
            cursor.execute(
                "SELECT * FROM events WHERE host_user_id = %s ORDER BY scheduled_date ASC",
                (host_user_id,)
            )

        rows = cursor.fetchall()

        return [dict(row) for row in rows]


def update_event(event_id: int, title: str = None, description: str = None,
                scheduled_date: datetime = None, location: str = None,
                host_user_id: int = None, status: str = None,
                cover_url: str = None, updated_by: int = None,
                rsvp_deadline=None, max_attendees: int = None,
                bg_type: str = None, bg_value: str = None, bg_scope: str = None,
                ratings_enabled: bool = None, bill_split_enabled: bool = None,
                bring_list_enabled: bool = None, bring_list_type: str = None) -> bool:
    """Update event details."""
    with get_db() as conn:
        cursor = conn.cursor()

        updates = []
        params = []
        changes = []

        if title is not None:
            updates.append("title = %s")
            params.append(title)
            changes.append(f"title changed to '{title}'")

        if description is not None:
            updates.append("description = %s")
            params.append(description)
            changes.append("description updated")

        if scheduled_date is not None:
            updates.append("scheduled_date = %s")
            params.append(scheduled_date)
            changes.append(f"date changed to {scheduled_date}")

        if location is not None:
            updates.append("location = %s")
            params.append(location)
            changes.append(f"location changed to '{location}'")

        if host_user_id is not None:
            updates.append("host_user_id = %s")
            params.append(host_user_id)
            changes.append(f"host changed to user {host_user_id}")

        if status is not None:
            updates.append("status = %s")
            params.append(status)
            changes.append(f"status changed to '{status}'")

        if cover_url is not None:
            updates.append("cover_url = %s")
            params.append(cover_url)
            changes.append("cover image updated")

        if rsvp_deadline is not None:
            updates.append("rsvp_deadline = %s")
            params.append(rsvp_deadline)
            changes.append(f"RSVP deadline set to {rsvp_deadline}")

        if max_attendees is not None:
            updates.append("max_attendees = %s")
            params.append(max_attendees)
            changes.append(f"max attendees set to {max_attendees}")

        if bg_type is not None:
            updates.append("bg_type = %s")
            params.append(bg_type)
            changes.append(f"background type changed to '{bg_type}'")

        if bg_value is not None:
            updates.append("bg_value = %s")
            params.append(bg_value)
            changes.append("background value updated")

        if bg_scope is not None:
            updates.append("bg_scope = %s")
            params.append(bg_scope)
            changes.append(f"background scope changed to '{bg_scope}'")

        if ratings_enabled is not None:
            updates.append("ratings_enabled = %s")
            params.append(ratings_enabled)
            changes.append(f"ratings_enabled set to {ratings_enabled}")

        if bill_split_enabled is not None:
            updates.append("bill_split_enabled = %s")
            params.append(bill_split_enabled)
            changes.append(f"bill_split_enabled set to {bill_split_enabled}")

        if bring_list_enabled is not None:
            updates.append("bring_list_enabled = %s")
            params.append(bring_list_enabled)
            changes.append(f"bring_list_enabled set to {bring_list_enabled}")

        if bring_list_type is not None:
            updates.append("bring_list_type = %s")
            params.append(bring_list_type)
            changes.append(f"bring_list_type set to {bring_list_type}")

        if not updates:
            return True

        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(event_id)

        cursor.execute(
            f"UPDATE events SET {', '.join(updates)} WHERE id = %s",
            params
        )

        success = cursor.rowcount > 0

        # Log update
        if success and updated_by and changes:
            cursor.execute(
                """INSERT INTO event_history (event_id, user_id, action, details)
                   VALUES (%s, %s, 'updated', %s)""",
                (event_id, updated_by, "; ".join(changes))
            )

        conn.commit()

        return success


def delete_event(event_id: int, deleted_by: int = None) -> bool:
    """Delete an event."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Get event title for logging
        if deleted_by:
            cursor.execute("SELECT title FROM events WHERE id = %s", (event_id,))
            row = cursor.fetchone()
            title = row['title'] if row else "Unknown"

            cursor.execute(
                """INSERT INTO event_history (event_id, user_id, action, details)
                   VALUES (%s, %s, 'deleted', %s)""",
                (event_id, deleted_by, f"Event '{title}' deleted")
            )

        cursor.execute("DELETE FROM events WHERE id = %s", (event_id,))

        success = cursor.rowcount > 0
        conn.commit()

        return success


# ===== Attendee Management =====

def upsert_attendee(event_id: int, user_id: int, status: str) -> dict:
    """Insert or update an attendee's RSVP status (upsert)."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """INSERT INTO event_attendees (event_id, user_id, status)
               VALUES (%s, %s, %s)
               ON CONFLICT (event_id, user_id)
               DO UPDATE SET status = EXCLUDED.status, responded_at = CURRENT_TIMESTAMP
               RETURNING *""",
            (event_id, user_id, status)
        )
        row = dict(cursor.fetchone())

        cursor.execute(
            """INSERT INTO event_history (event_id, user_id, action, details)
               VALUES (%s, %s, 'rsvp', %s)""",
            (event_id, user_id, f"User {user_id} RSVP'd as {status}")
        )

        conn.commit()
        return row


def add_attendee(event_id: int, user_id: int, status: str = "going") -> bool:
    """Add an attendee to an event."""
    with get_db() as conn:
        cursor = conn.cursor()

        try:
            cursor.execute(
                """INSERT INTO event_attendees (event_id, user_id, status)
                   VALUES (%s, %s, %s)""",
                (event_id, user_id, status)
            )

            # Log attendance
            cursor.execute(
                """INSERT INTO event_history (event_id, user_id, action, details)
                   VALUES (%s, %s, 'attendee_added', %s)""",
                (event_id, user_id, f"User {user_id} marked as {status}")
            )

            conn.commit()
            return True
        except psycopg2.IntegrityError:
            conn.rollback()
            return False


def get_attendee(event_id: int, user_id: int) -> Optional[dict]:
    """Get a specific attendee."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT * FROM event_attendees WHERE event_id = %s AND user_id = %s",
            (event_id, user_id)
        )

        row = cursor.fetchone()

        return dict(row) if row else None


def get_attendees(event_id: int) -> List[dict]:
    """Get all attendees for an event."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT * FROM event_attendees WHERE event_id = %s ORDER BY responded_at ASC",
            (event_id,)
        )

        rows = cursor.fetchall()

        return [dict(row) for row in rows]


def update_attendee_status(event_id: int, user_id: int, status: str) -> bool:
    """Update an attendee's status."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """UPDATE event_attendees SET status = %s, responded_at = CURRENT_TIMESTAMP
               WHERE event_id = %s AND user_id = %s""",
            (status, event_id, user_id)
        )

        success = cursor.rowcount > 0

        if success:
            # Log status change
            cursor.execute(
                """INSERT INTO event_history (event_id, user_id, action, details)
                   VALUES (%s, %s, 'attendee_status_changed', %s)""",
                (event_id, user_id, f"Status changed to {status}")
            )

        conn.commit()

        return success


def remove_attendee(event_id: int, user_id: int) -> bool:
    """Remove an attendee from an event."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "DELETE FROM event_attendees WHERE event_id = %s AND user_id = %s",
            (event_id, user_id)
        )

        success = cursor.rowcount > 0

        if success:
            # Log removal
            cursor.execute(
                """INSERT INTO event_history (event_id, user_id, action, details)
                   VALUES (%s, %s, 'attendee_removed', %s)""",
                (event_id, user_id, f"User {user_id} removed from event")
            )

        conn.commit()

        return success


# ===== Event Bring List =====

def create_event_bring_item(event_id: int, label: str, emoji: str = "", max_claims: int = 1, sort_order: int = 0) -> dict:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO event_bring_items (event_id, label, emoji, max_claims, sort_order)
               VALUES (%s, %s, %s, %s, %s) RETURNING *""",
            (event_id, label, emoji or "", max_claims or 1, sort_order)
        )
        row = dict(cursor.fetchone())
        conn.commit()
        return row


def delete_event_bring_item(event_id: int, item_id: int) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE event_attendees SET claim_item_id = NULL WHERE event_id = %s AND claim_item_id = %s", (event_id, item_id))
        cursor.execute("DELETE FROM event_bring_items WHERE event_id = %s AND id = %s", (event_id, item_id))
        success = cursor.rowcount > 0
        conn.commit()
        return success


def update_event_bring_item(event_id: int, item_id: int, label: str = None, emoji: str = None, max_claims: int = None) -> dict:
    """Update a bring-list item's label/emoji/max_claims. Returns the updated item (with claim info) or None if not found."""
    sets, params = [], []
    if label is not None:
        sets.append("label = %s"); params.append(label)
    if emoji is not None:
        sets.append("emoji = %s"); params.append(emoji)
    if max_claims is not None:
        sets.append("max_claims = %s"); params.append(max_claims)
    if sets:
        with get_db() as conn:
            cursor = conn.cursor()
            params.extend([event_id, item_id])
            cursor.execute(
                f"UPDATE event_bring_items SET {', '.join(sets)} WHERE event_id = %s AND id = %s",
                tuple(params)
            )
            updated = cursor.rowcount > 0
            conn.commit()
        if not updated:
            return None
    return next((it for it in get_event_bring_items(event_id) if it["id"] == item_id), None)


def get_event_bring_items(event_id: int) -> List[dict]:
    """Bring-list items with unified claim info. claimed_count is the sum of
    per-person quantities across BOTH clubPal members and external party guests
    (event_bring_item_claims), counted against the single shared max_claims."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT ebi.*,
                      COALESCE(SUM(c.quantity), 0) AS claimed_count
               FROM event_bring_items ebi
               LEFT JOIN event_bring_item_claims c ON c.event_item_id = ebi.id
               WHERE ebi.event_id = %s
               GROUP BY ebi.id
               ORDER BY ebi.sort_order ASC, ebi.id ASC""",
            (event_id,)
        )
        items = [dict(row) for row in cursor.fetchall()]
        for item in items:
            item["claimed_count"] = int(item.get("claimed_count") or 0)
            cursor.execute(
                """SELECT c.user_id, c.guest_id, c.quantity, c.note, g.name AS guest_name
                   FROM event_bring_item_claims c
                   LEFT JOIN party_invite_guests g ON g.id = c.guest_id
                   WHERE c.event_item_id = %s
                   ORDER BY c.created_at ASC""",
                (item["id"],)
            )
            claimers = []
            for row in cursor.fetchall():
                row = dict(row)
                is_guest = row["guest_id"] is not None
                claimers.append({
                    "user_id": row["user_id"],
                    "guest_id": row["guest_id"],
                    "is_guest": is_guest,
                    "name": (row["guest_name"].split()[0] if is_guest and row.get("guest_name") else None),
                    "quantity": int(row["quantity"] or 1),
                    "note": row["note"],
                })
            item["claimed_by"] = claimers
        return items


def update_attendee_bring(event_id: int, user_id: int, bring_note: str = None, claim_item_id: int = None) -> dict:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO event_attendees (event_id, user_id, status, bring_note, claim_item_id)
               VALUES (%s, %s, 'going', %s, %s)
               ON CONFLICT (event_id, user_id)
               DO UPDATE SET bring_note = EXCLUDED.bring_note,
                             claim_item_id = EXCLUDED.claim_item_id,
                             responded_at = CURRENT_TIMESTAMP
               RETURNING *""",
            (event_id, user_id, bring_note, claim_item_id)
        )
        row = dict(cursor.fetchone())
        conn.commit()
        return row


def remove_user_from_all_events(user_id: int) -> int:
    """Remove a deleted user from all event_attendees records."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM event_attendees WHERE user_id = %s", (user_id,))
        count = cursor.rowcount
        conn.commit()
        return count


# ===== Comment Management =====

def add_comment(event_id: int, user_id: int, content: str) -> int:
    """Add a comment to an event."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "INSERT INTO event_comments (event_id, user_id, content) VALUES (%s, %s, %s) RETURNING id",
            (event_id, user_id, content)
        )

        comment_id = cursor.fetchone()['id']

        # Log comment
        cursor.execute(
            """INSERT INTO event_history (event_id, user_id, action, details)
               VALUES (%s, %s, 'comment_added', %s)""",
            (event_id, user_id, "Comment added")
        )

        conn.commit()

        return comment_id


def get_comment(comment_id: int) -> Optional[dict]:
    """Get a comment by ID."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM event_comments WHERE id = %s", (comment_id,))
        row = cursor.fetchone()

        return dict(row) if row else None


def get_comments(event_id: int) -> List[dict]:
    """Get all comments for an event."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT * FROM event_comments WHERE event_id = %s ORDER BY created_at ASC",
            (event_id,)
        )

        rows = cursor.fetchall()

        return [dict(row) for row in rows]


def delete_comment(comment_id: int, deleted_by: int = None) -> bool:
    """Delete a comment."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Get event_id for logging
        if deleted_by:
            cursor.execute("SELECT event_id FROM event_comments WHERE id = %s", (comment_id,))
            row = cursor.fetchone()
            if row:
                event_id = row['event_id']
                cursor.execute(
                    """INSERT INTO event_history (event_id, user_id, action, details)
                       VALUES (%s, %s, 'comment_deleted', %s)""",
                    (event_id, deleted_by, f"Comment {comment_id} deleted")
                )

        cursor.execute("DELETE FROM event_comments WHERE id = %s", (comment_id,))

        success = cursor.rowcount > 0
        conn.commit()

        return success


# ===== Event History =====

def get_event_history(event_id: int) -> List[dict]:
    """Get event history/audit log."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT * FROM event_history WHERE event_id = %s ORDER BY created_at DESC",
            (event_id,)
        )

        rows = cursor.fetchall()

        return [dict(row) for row in rows]


# ===== Event Photos =====

def add_photo(event_id: int, user_id: int, object_key: str,
              public_url: str, caption: str = None) -> int:
    """Save a confirmed photo upload to the database."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute(
            """INSERT INTO event_photos (event_id, user_id, object_key, public_url, caption)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (event_id, user_id, object_key, public_url, caption)
        )

        photo_id = cursor.fetchone()['id']

        cursor.execute(
            """INSERT INTO event_history (event_id, user_id, action, details)
               VALUES (%s, %s, 'photo_added', %s)""",
            (event_id, user_id, f"Photo uploaded by user {user_id}")
        )

        conn.commit()

        return photo_id


def get_photo(photo_id: int) -> Optional[dict]:
    """Get a single photo by ID."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM event_photos WHERE id = %s", (photo_id,))
        row = cursor.fetchone()

        return dict(row) if row else None


def get_photos(event_id: int) -> List[dict]:
    """Get all photos for an event."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute(
            "SELECT * FROM event_photos WHERE event_id = %s ORDER BY uploaded_at ASC",
            (event_id,)
        )

        rows = cursor.fetchall()

        return [dict(row) for row in rows]


def delete_photo(photo_id: int, deleted_by: int = None) -> bool:
    """Delete a photo record from the database."""
    with get_db() as conn:
        cursor = conn.cursor()

        if deleted_by:
            cursor.execute("SELECT event_id FROM event_photos WHERE id = %s", (photo_id,))
            row = cursor.fetchone()
            if row:
                cursor.execute(
                    """INSERT INTO event_history (event_id, user_id, action, details)
                       VALUES (%s, %s, 'photo_deleted', %s)""",
                    (row['event_id'], deleted_by, f"Photo {photo_id} deleted")
                )

        cursor.execute("DELETE FROM event_photos WHERE id = %s", (photo_id,))

        success = cursor.rowcount > 0
        conn.commit()

        return success
