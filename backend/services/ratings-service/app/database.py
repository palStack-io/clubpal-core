import psycopg2
import psycopg2.extras
import os
from typing import Optional, List

# Database URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://clubpal:clubpal@db:5432/clubpal_ratings")


def init_db():
    """Initialize database with schema."""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()

    # Ratings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ratings (
            id SERIAL PRIMARY KEY,
            event_id INTEGER NOT NULL,
            rater_user_id INTEGER NOT NULL,
            rated_user_id INTEGER,
            score INTEGER NOT NULL CHECK(score >= 1 AND score <= 10),
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(event_id, rater_user_id)
        )
    """)
    # Migrate existing constraint: drop old 3-column unique, add 2-column unique
    cursor.execute("ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_event_id_rater_user_id_rated_user_id_key")
    cursor.execute("ALTER TABLE ratings ALTER COLUMN rated_user_id DROP NOT NULL")
    cursor.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'ratings_event_id_rater_user_id_key'
            ) THEN
                ALTER TABLE ratings ADD CONSTRAINT ratings_event_id_rater_user_id_key UNIQUE(event_id, rater_user_id);
            END IF;
        END $$
    """)

    # User statistics cache table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_stats (
            user_id INTEGER PRIMARY KEY,
            total_ratings INTEGER DEFAULT 0,
            average_score REAL DEFAULT 0.0,
            score_1_count INTEGER DEFAULT 0,
            score_2_count INTEGER DEFAULT 0,
            score_3_count INTEGER DEFAULT 0,
            score_4_count INTEGER DEFAULT 0,
            score_5_count INTEGER DEFAULT 0,
            score_6_count INTEGER DEFAULT 0,
            score_7_count INTEGER DEFAULT 0,
            score_8_count INTEGER DEFAULT 0,
            score_9_count INTEGER DEFAULT 0,
            score_10_count INTEGER DEFAULT 0,
            total_hosted_events INTEGER DEFAULT 0,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    for i in range(6, 11):
        cursor.execute(f"ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS score_{i}_count INTEGER DEFAULT 0")

    cursor.execute("ALTER TABLE ratings ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'")
    # Widen score range from 1-5 to 1-10
    cursor.execute("ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_score_check")
    cursor.execute("ALTER TABLE ratings ADD CONSTRAINT ratings_score_check CHECK(score >= 1 AND score <= 10)")

    # Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ratings_event ON ratings(event_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ratings_rater ON ratings(rater_user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ratings_rated ON ratings(rated_user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ratings_score ON ratings(score)")

    conn.commit()
    conn.close()


def get_db():
    """Get database connection with dict cursor."""
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    return conn


# ===== Rating CRUD =====

def create_rating(event_id: int, rater_user_id: int, rated_user_id: int,
                 score: int, comment: str = None, tags: list = None) -> int:
    """Create a new rating."""
    import json
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """INSERT INTO ratings (event_id, rater_user_id, rated_user_id, score, comment, tags)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (event_id, rater_user_id, rated_user_id, score, comment, json.dumps(tags or []))
        )

        rating_id = cursor.fetchone()['id']
        conn.commit()
        conn.close()

        # Update stats for the rater (tracks ratings given per user)
        update_user_stats(rater_user_id)

        return rating_id
    except psycopg2.IntegrityError as e:
        conn.rollback()
        conn.close()
        raise ValueError(f"Rating already exists or invalid data: {str(e)}")


def get_rating(rating_id: int) -> Optional[dict]:
    """Get rating by ID."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM ratings WHERE id = %s", (rating_id,))
    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def get_rating_by_event_and_rater(event_id: int, rater_user_id: int) -> Optional[dict]:
    """Get rating by event and rater (one rating per user per event)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM ratings WHERE event_id = %s AND rater_user_id = %s",
        (event_id, rater_user_id)
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_rating_by_event_and_users(event_id: int, rater_user_id: int,
                                  rated_user_id: int) -> Optional[dict]:
    """Get rating by event and users."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """SELECT * FROM ratings
           WHERE event_id = %s AND rater_user_id = %s AND rated_user_id = %s""",
        (event_id, rater_user_id, rated_user_id)
    )

    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def get_ratings_for_event(event_id: int) -> List[dict]:
    """Get all ratings for an event."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM ratings WHERE event_id = %s ORDER BY created_at DESC",
        (event_id,)
    )

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def get_ratings_by_rater(rater_user_id: int) -> List[dict]:
    """Get all ratings given by a user."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM ratings WHERE rater_user_id = %s ORDER BY created_at DESC",
        (rater_user_id,)
    )

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def get_ratings_for_user(rated_user_id: int) -> List[dict]:
    """Get all ratings received by a user."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM ratings WHERE rated_user_id = %s ORDER BY created_at DESC",
        (rated_user_id,)
    )

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def update_rating(rating_id: int, score: int = None, comment: str = None) -> bool:
    """Update a rating."""
    conn = get_db()
    cursor = conn.cursor()

    # Get rater_user_id for stats update
    cursor.execute("SELECT rater_user_id FROM ratings WHERE id = %s", (rating_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return False

    rater_user_id = row['rater_user_id']

    updates = []
    params = []

    if score is not None:
        updates.append("score = %s")
        params.append(score)

    if comment is not None:
        updates.append("comment = %s")
        params.append(comment)

    if not updates:
        conn.close()
        return True

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(rating_id)

    cursor.execute(
        f"UPDATE ratings SET {', '.join(updates)} WHERE id = %s",
        params
    )

    success = cursor.rowcount > 0
    conn.commit()
    conn.close()

    if success:
        update_user_stats(rater_user_id)

    return success


def delete_rating(rating_id: int) -> bool:
    """Delete a rating."""
    conn = get_db()
    cursor = conn.cursor()

    # Get rater_user_id for stats update
    cursor.execute("SELECT rater_user_id FROM ratings WHERE id = %s", (rating_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return False

    rater_user_id = row['rater_user_id']

    cursor.execute("DELETE FROM ratings WHERE id = %s", (rating_id,))

    success = cursor.rowcount > 0
    conn.commit()
    conn.close()

    if success:
        update_user_stats(rater_user_id)

    return success


# ===== Statistics Functions =====

def update_user_stats(user_id: int):
    """Update cached statistics for a user."""
    conn = get_db()
    cursor = conn.cursor()

    # Calculate stats from ratings
    cursor.execute(
        """SELECT
               COUNT(*) as total_ratings,
               AVG(score) as average_score,
               SUM(CASE WHEN score = 1  THEN 1 ELSE 0 END) as score_1_count,
               SUM(CASE WHEN score = 2  THEN 1 ELSE 0 END) as score_2_count,
               SUM(CASE WHEN score = 3  THEN 1 ELSE 0 END) as score_3_count,
               SUM(CASE WHEN score = 4  THEN 1 ELSE 0 END) as score_4_count,
               SUM(CASE WHEN score = 5  THEN 1 ELSE 0 END) as score_5_count,
               SUM(CASE WHEN score = 6  THEN 1 ELSE 0 END) as score_6_count,
               SUM(CASE WHEN score = 7  THEN 1 ELSE 0 END) as score_7_count,
               SUM(CASE WHEN score = 8  THEN 1 ELSE 0 END) as score_8_count,
               SUM(CASE WHEN score = 9  THEN 1 ELSE 0 END) as score_9_count,
               SUM(CASE WHEN score = 10 THEN 1 ELSE 0 END) as score_10_count
           FROM ratings
           WHERE rater_user_id = %s""",
        (user_id,)
    )

    stats = cursor.fetchone()

    total_ratings = stats['total_ratings'] if stats['total_ratings'] else 0
    average_score = stats['average_score'] if stats['average_score'] else 0.0

    # Insert or update stats
    cursor.execute(
        """INSERT INTO user_stats
               (user_id, total_ratings, average_score,
                score_1_count, score_2_count, score_3_count, score_4_count, score_5_count,
                score_6_count, score_7_count, score_8_count, score_9_count, score_10_count,
                last_updated)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id) DO UPDATE SET
               total_ratings = EXCLUDED.total_ratings,
               average_score = EXCLUDED.average_score,
               score_1_count = EXCLUDED.score_1_count,
               score_2_count = EXCLUDED.score_2_count,
               score_3_count = EXCLUDED.score_3_count,
               score_4_count = EXCLUDED.score_4_count,
               score_5_count = EXCLUDED.score_5_count,
               score_6_count = EXCLUDED.score_6_count,
               score_7_count = EXCLUDED.score_7_count,
               score_8_count = EXCLUDED.score_8_count,
               score_9_count = EXCLUDED.score_9_count,
               score_10_count = EXCLUDED.score_10_count,
               last_updated = CURRENT_TIMESTAMP""",
        (user_id, total_ratings, average_score,
         stats['score_1_count'] or 0, stats['score_2_count'] or 0,
         stats['score_3_count'] or 0, stats['score_4_count'] or 0, stats['score_5_count'] or 0,
         stats['score_6_count'] or 0, stats['score_7_count'] or 0, stats['score_8_count'] or 0,
         stats['score_9_count'] or 0, stats['score_10_count'] or 0)
    )

    conn.commit()
    conn.close()


def increment_hosted_events(user_id: int):
    """Increment the hosted events count for a user."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """INSERT INTO user_stats (user_id, total_hosted_events, last_updated)
           VALUES (%s, 1, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id) DO UPDATE SET
               total_hosted_events = user_stats.total_hosted_events + 1,
               last_updated = CURRENT_TIMESTAMP""",
        (user_id,)
    )

    conn.commit()
    conn.close()


def get_user_stats(user_id: int) -> Optional[dict]:
    """Get statistics for a user."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """SELECT user_id, total_ratings, average_score,
                  COALESCE(score_1_count, 0)  AS score_1_count,
                  COALESCE(score_2_count, 0)  AS score_2_count,
                  COALESCE(score_3_count, 0)  AS score_3_count,
                  COALESCE(score_4_count, 0)  AS score_4_count,
                  COALESCE(score_5_count, 0)  AS score_5_count,
                  COALESCE(score_6_count, 0)  AS score_6_count,
                  COALESCE(score_7_count, 0)  AS score_7_count,
                  COALESCE(score_8_count, 0)  AS score_8_count,
                  COALESCE(score_9_count, 0)  AS score_9_count,
                  COALESCE(score_10_count, 0) AS score_10_count,
                  total_hosted_events, last_updated
           FROM user_stats WHERE user_id = %s""",
        (user_id,)
    )
    row = cursor.fetchone()

    if row:
        conn.close()
        return dict(row)

    # If no stats exist, calculate and cache them
    conn.close()
    update_user_stats(user_id)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT user_id, total_ratings, average_score,
                  COALESCE(score_1_count, 0)  AS score_1_count,
                  COALESCE(score_2_count, 0)  AS score_2_count,
                  COALESCE(score_3_count, 0)  AS score_3_count,
                  COALESCE(score_4_count, 0)  AS score_4_count,
                  COALESCE(score_5_count, 0)  AS score_5_count,
                  COALESCE(score_6_count, 0)  AS score_6_count,
                  COALESCE(score_7_count, 0)  AS score_7_count,
                  COALESCE(score_8_count, 0)  AS score_8_count,
                  COALESCE(score_9_count, 0)  AS score_9_count,
                  COALESCE(score_10_count, 0) AS score_10_count,
                  total_hosted_events, last_updated
           FROM user_stats WHERE user_id = %s""",
        (user_id,)
    )
    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def get_event_stats(event_id: int) -> Optional[dict]:
    """Get rating statistics for an event."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """SELECT
               COUNT(*) as total_ratings,
               AVG(score) as average_score
           FROM ratings
           WHERE event_id = %s""",
        (event_id,)
    )

    row = cursor.fetchone()
    conn.close()

    if row and row['total_ratings'] > 0:
        return {
            "event_id": event_id,
            "total_ratings": row['total_ratings'],
            "average_score": round(row['average_score'], 2) if row['average_score'] else 0.0
        }

    return None


def get_group_leaderboard(group_id: int, member_ids: List[int]) -> List[dict]:
    """Get leaderboard for a group based on member IDs."""
    if not member_ids:
        return []

    conn = get_db()
    cursor = conn.cursor()

    placeholders = ','.join(['%s'] * len(member_ids))

    cursor.execute(
        f"""SELECT
                user_id,
                total_ratings,
                average_score,
                total_hosted_events
            FROM user_stats
            WHERE user_id IN ({placeholders}) AND total_ratings > 0
            ORDER BY average_score DESC, total_ratings DESC""",
        member_ids
    )

    rows = cursor.fetchall()
    conn.close()

    # Add ranking
    leaderboard = []
    for rank, row in enumerate(rows, start=1):
        leaderboard.append({
            "user_id": row['user_id'],
            "total_ratings": row['total_ratings'],
            "average_score": round(row['average_score'], 2) if row['average_score'] else 0.0,
            "total_hosted_events": row['total_hosted_events'],
            "rank": rank
        })

    return leaderboard
