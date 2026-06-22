import psycopg2
import psycopg2.extras
import psycopg2.pool
import os
import threading
import json
from typing import Optional, List, Dict, Any

# Database URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://clubpal:clubpal@db:5432/clubpal_activities")

_pool = None
_pool_lock = threading.Lock()


def _get_pool():
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = psycopg2.pool.ThreadedConnectionPool(2, 10, dsn=DATABASE_URL)
    return _pool


class _PooledConn:
    def __init__(self, conn):
        self._conn = conn

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def close(self):
        try:
            self._conn.rollback()
        except Exception:
            pass
        _get_pool().putconn(self._conn)


def init_db():
    """Initialize database with schema and seed data."""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()

    # Activities table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS activities (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            category TEXT,
            icon TEXT,
            metadata TEXT,
            usage_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_activities_name ON activities(name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_activities_usage ON activities(usage_count)")

    conn.commit()

    # Seed default activities if table is empty
    cursor.execute("SELECT COUNT(*) FROM activities")
    if cursor.fetchone()[0] == 0:
        seed_default_activities(cursor)
        conn.commit()

    conn.close()


def seed_default_activities(cursor):
    """Seed database with default activities."""
    default_activities = [
        ("Dinner", "Host a dinner party", "Food & Drink", "🍽️", {"duration": "2-3 hours"}),
        ("Lunch", "Host a lunch gathering", "Food & Drink", "🥗", {"duration": "1-2 hours"}),
        ("Breakfast", "Host a breakfast meetup", "Food & Drink", "🥞", {"duration": "1 hour"}),
        ("Coffee", "Grab coffee together", "Food & Drink", "☕", {"duration": "30-60 minutes"}),
        ("Movie Night", "Watch a movie together", "Entertainment", "🎬", {"duration": "2-3 hours"}),
        ("Game Night", "Play board games or video games", "Entertainment", "🎮", {"duration": "2-4 hours"}),
        ("Hiking", "Go for a hike", "Outdoors", "🥾", {"duration": "2-4 hours", "location_type": "outdoor"}),
        ("Sports", "Play sports together", "Outdoors", "⚽", {"duration": "1-2 hours"}),
        ("Book Club", "Discuss a book", "Cultural", "📚", {"duration": "1-2 hours"}),
        ("Study Session", "Study or work together", "Productivity", "📝", {"duration": "2-3 hours"}),
        ("Barbecue", "Host a BBQ", "Food & Drink", "🍖", {"duration": "3-4 hours", "location_type": "outdoor"}),
        ("Picnic", "Have a picnic", "Outdoors", "🧺", {"duration": "2-3 hours", "location_type": "outdoor"}),
        ("Karaoke", "Sing karaoke together", "Entertainment", "🎤", {"duration": "2-3 hours"}),
        ("Bowling", "Go bowling", "Entertainment", "🎳", {"duration": "1-2 hours"}),
        ("Concert", "Attend a concert", "Entertainment", "🎵", {"duration": "3-4 hours"}),
        ("Museum Visit", "Visit a museum", "Cultural", "🏛️", {"duration": "2-3 hours"}),
        ("Beach Day", "Spend a day at the beach", "Outdoors", "🏖️", {"duration": "4-6 hours", "location_type": "outdoor"}),
        ("Cycling", "Go for a bike ride", "Outdoors", "🚴", {"duration": "1-3 hours"}),
        ("Yoga Session", "Practice yoga together", "Wellness", "🧘", {"duration": "1 hour"}),
        ("Brunch", "Have brunch together", "Food & Drink", "🥂", {"duration": "1-2 hours"}),
    ]

    for name, description, category, icon, metadata in default_activities:
        cursor.execute(
            """INSERT INTO activities (name, description, category, icon, metadata)
               VALUES (%s, %s, %s, %s, %s)""",
            (name, description, category, icon, json.dumps(metadata))
        )


def get_db():
    """Get a pooled database connection with dict cursor."""
    conn = _get_pool().getconn()
    conn.cursor_factory = psycopg2.extras.RealDictCursor
    return _PooledConn(conn)


def _serialize_activity(row: dict) -> dict:
    """Parse JSON metadata field in an activity row."""
    activity = dict(row)
    if activity.get("metadata"):
        try:
            activity["metadata"] = json.loads(activity["metadata"])
        except json.JSONDecodeError:
            activity["metadata"] = None
    return activity


# ===== Activity CRUD =====

def create_activity(name: str, description: str = None, category: str = None,
                   icon: str = None, metadata: Dict[str, Any] = None) -> int:
    """Create a new activity."""
    conn = get_db()
    cursor = conn.cursor()

    metadata_json = json.dumps(metadata) if metadata else None

    try:
        cursor.execute(
            """INSERT INTO activities (name, description, category, icon, metadata)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (name, description, category, icon, metadata_json)
        )

        activity_id = cursor.fetchone()['id']
        conn.commit()
        conn.close()
        return activity_id
    except psycopg2.IntegrityError as e:
        conn.rollback()
        conn.close()
        raise ValueError(f"Activity already exists: {str(e)}")


def get_activity(activity_id: int) -> Optional[dict]:
    """Get activity by ID."""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM activities WHERE id = %s", (activity_id,))
        row = cursor.fetchone()
        return _serialize_activity(row) if row else None
    finally:
        conn.close()


def get_activity_by_name(name: str) -> Optional[dict]:
    """Get activity by name."""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM activities WHERE name = %s", (name,))
        row = cursor.fetchone()
        return _serialize_activity(row) if row else None
    finally:
        conn.close()


def get_all_activities(category: str = None, limit: int = 100, offset: int = 0) -> List[dict]:
    """Get all activities, optionally filtered by category."""
    conn = get_db()
    try:
        cursor = conn.cursor()
        if category:
            cursor.execute(
                """SELECT * FROM activities
                   WHERE category = %s
                   ORDER BY usage_count DESC, name ASC
                   LIMIT %s OFFSET %s""",
                (category, limit, offset)
            )
        else:
            cursor.execute(
                """SELECT * FROM activities
                   ORDER BY usage_count DESC, name ASC
                   LIMIT %s OFFSET %s""",
                (limit, offset)
            )
        return [_serialize_activity(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def search_activities(query: str, limit: int = 20) -> List[dict]:
    """Search activities by name or description."""
    conn = get_db()
    try:
        cursor = conn.cursor()
        search_term = f"%{query}%"
        cursor.execute(
            """SELECT * FROM activities
               WHERE name LIKE %s OR description LIKE %s
               ORDER BY usage_count DESC, name ASC
               LIMIT %s""",
            (search_term, search_term, limit)
        )
        return [_serialize_activity(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def update_activity(activity_id: int, name: str = None, description: str = None,
                   category: str = None, icon: str = None,
                   metadata: Dict[str, Any] = None) -> bool:
    """Update activity details."""
    conn = get_db()
    try:
        cursor = conn.cursor()

        updates = []
        params = []

        if name is not None:
            updates.append("name = %s")
            params.append(name)

        if description is not None:
            updates.append("description = %s")
            params.append(description)

        if category is not None:
            updates.append("category = %s")
            params.append(category)

        if icon is not None:
            updates.append("icon = %s")
            params.append(icon)

        if metadata is not None:
            updates.append("metadata = %s")
            params.append(json.dumps(metadata))

        if not updates:
            return True

        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(activity_id)

        cursor.execute(
            f"UPDATE activities SET {', '.join(updates)} WHERE id = %s",
            params
        )

        success = cursor.rowcount > 0
        conn.commit()
        return success
    finally:
        conn.close()


def delete_activity(activity_id: int) -> bool:
    """Delete an activity."""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM activities WHERE id = %s", (activity_id,))
        success = cursor.rowcount > 0
        conn.commit()
        return success
    finally:
        conn.close()


def increment_usage_count(activity_id: int):
    """Increment usage count for an activity."""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE activities SET usage_count = usage_count + 1 WHERE id = %s",
            (activity_id,)
        )
        conn.commit()
    finally:
        conn.close()


# ===== Category Functions =====

def get_all_categories() -> List[dict]:
    """Get all categories with activity counts."""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT category, COUNT(*) as count
               FROM activities
               WHERE category IS NOT NULL
               GROUP BY category
               ORDER BY count DESC, category ASC"""
        )
        return [{"category": row['category'], "count": row['count']} for row in cursor.fetchall()]
    finally:
        conn.close()


def get_popular_activities(limit: int = 10) -> List[dict]:
    """Get most popular activities by usage count."""
    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """SELECT * FROM activities
               WHERE usage_count > 0
               ORDER BY usage_count DESC, name ASC
               LIMIT %s""",
            (limit,)
        )
        return [_serialize_activity(row) for row in cursor.fetchall()]
    finally:
        conn.close()
