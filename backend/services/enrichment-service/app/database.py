import os
import json
import threading
from typing import Optional
import psycopg2
import psycopg2.pool
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://clubpal:clubpal@db:5432/clubpal_enrichment")

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


def get_conn():
    return _PooledConn(_get_pool().getconn())


def init_db():
    conn = get_conn()
    cur = conn.cursor()

    # Generic KV cache for all search results
    cur.execute("""
        CREATE TABLE IF NOT EXISTS enrichment_cache (
            id SERIAL PRIMARY KEY,
            cache_key TEXT UNIQUE NOT NULL,
            activity_type TEXT NOT NULL,
            payload JSONB NOT NULL,
            cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_cache_key ON enrichment_cache(cache_key)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_cache_type ON enrichment_cache(activity_type)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_cache_expires ON enrichment_cache(expires_at)")

    # Cached Google Place objects
    cur.execute("""
        CREATE TABLE IF NOT EXISTS place_details (
            place_id TEXT PRIMARY KEY,
            name TEXT,
            lat REAL,
            lng REAL,
            address TEXT,
            phone TEXT,
            website TEXT,
            rating REAL,
            price_level INTEGER,
            photo_object_keys JSONB DEFAULT '[]',
            hours JSONB DEFAULT '{}',
            cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)

    # Cached Google Books volumes
    cur.execute("""
        CREATE TABLE IF NOT EXISTS book_details (
            volume_id TEXT PRIMARY KEY,
            title TEXT,
            authors JSONB DEFAULT '[]',
            description TEXT,
            cover_object_key TEXT,
            cover_url TEXT,
            page_count INTEGER,
            publisher TEXT,
            published_date TEXT,
            rating REAL,
            isbn TEXT,
            cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)

    # Cached TMDB movies
    cur.execute("""
        CREATE TABLE IF NOT EXISTS movie_details (
            tmdb_id INTEGER PRIMARY KEY,
            title TEXT,
            overview TEXT,
            poster_object_key TEXT,
            poster_url TEXT,
            backdrop_object_key TEXT,
            backdrop_url TEXT,
            release_date TEXT,
            runtime INTEGER,
            genres JSONB DEFAULT '[]',
            cast_list JSONB DEFAULT '[]',
            rating REAL,
            trailer_key TEXT,
            cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)

    # Cached TMDB TV shows
    cur.execute("""
        CREATE TABLE IF NOT EXISTS show_details (
            tmdb_id INTEGER PRIMARY KEY,
            title TEXT,
            overview TEXT,
            poster_object_key TEXT,
            poster_url TEXT,
            backdrop_object_key TEXT,
            backdrop_url TEXT,
            first_air_date TEXT,
            number_of_seasons INTEGER,
            number_of_episodes INTEGER,
            genres JSONB DEFAULT '[]',
            cast_list JSONB DEFAULT '[]',
            rating REAL,
            trailer_key TEXT,
            cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)

    # Cached IGDB games
    cur.execute("""
        CREATE TABLE IF NOT EXISTS game_details (
            igdb_id INTEGER PRIMARY KEY,
            name TEXT,
            cover_object_key TEXT,
            cover_url TEXT,
            summary TEXT,
            rating REAL,
            genres JSONB DEFAULT '[]',
            platforms JSONB DEFAULT '[]',
            release_date TEXT,
            cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)

    # Geocode cache (30-day TTL enforced at query time)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS geocode_cache (
            query TEXT PRIMARY KEY,
            lat REAL,
            lng REAL,
            formatted_address TEXT,
            cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)

    # Per-user discover feed cache (maps user → cached item IDs)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS user_discover_cache (
            user_id       INTEGER NOT NULL,
            activity_type TEXT NOT NULL,
            item_id       TEXT NOT NULL,
            item_type     TEXT NOT NULL,
            loaded_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            PRIMARY KEY (user_id, activity_type, item_id)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_udc_user_activity ON user_discover_cache(user_id, activity_type)")

    # API usage tracking
    cur.execute("""
        CREATE TABLE IF NOT EXISTS api_usage (
            api_name TEXT NOT NULL,
            call_date DATE NOT NULL DEFAULT CURRENT_DATE,
            live_calls INTEGER DEFAULT 0,
            cache_hits INTEGER DEFAULT 0,
            PRIMARY KEY (api_name, call_date)
        )
    """)

    # Per-API daily call limits (soft cap — prevents runaway usage)
    # Defaults are conservative to stay within Google's $200/month free credit:
    #   Places Nearby/Text Search: $0.032/req → 150/day ≈ $144/month worst-case
    #   Place Details:             $0.017/req → 150/day
    #   Geocoding:                 $0.005/req → 200/day ≈ $30/month
    #   TMDB / Books / IGDB: effectively unlimited free tiers
    cur.execute("""
        CREATE TABLE IF NOT EXISTS api_daily_limits (
            api_name TEXT PRIMARY KEY,
            daily_limit INTEGER NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)
    # Seed defaults (won't overwrite existing values)
    for api, limit in [
        ("google_places",   150),
        ("google_geocoding", 200),
        ("google_books",    500),
        ("tmdb",            1000),
        ("igdb",            200),
    ]:
        cur.execute("""
            INSERT INTO api_daily_limits (api_name, daily_limit)
            VALUES (%s, %s)
            ON CONFLICT (api_name) DO NOTHING
        """, (api, limit))

    # Quota-exceeded blocks — persists until admin explicitly approves resumption
    cur.execute("""
        CREATE TABLE IF NOT EXISTS api_quota_blocks (
            api_name      TEXT PRIMARY KEY,
            blocked_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            alert_sent_at TIMESTAMP WITH TIME ZONE,
            unblocked_at  TIMESTAMP WITH TIME ZONE,
            unblocked_by  TEXT
        )
    """)

    conn.commit()
    cur.close()
    conn.close()


# ===== API Quota Blocks =====

def is_api_blocked(api_name: str) -> bool:
    """Return True if this API is currently blocked pending admin approval."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT 1 FROM api_quota_blocks
        WHERE api_name = %s AND unblocked_at IS NULL
    """, (api_name,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row is not None


def block_api(api_name: str):
    """Record a quota-exceeded block for this API (idempotent)."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO api_quota_blocks (api_name, blocked_at)
        VALUES (%s, NOW())
        ON CONFLICT (api_name) DO UPDATE SET
            blocked_at   = NOW(),
            unblocked_at = NULL,
            unblocked_by = NULL,
            alert_sent_at = NULL
        WHERE api_quota_blocks.unblocked_at IS NOT NULL
    """, (api_name,))
    conn.commit()
    cur.close()
    conn.close()


def unblock_api(api_name: str, unblocked_by: str = "admin"):
    """Admin approval — lift the block so API calls can resume."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        UPDATE api_quota_blocks
        SET unblocked_at = NOW(), unblocked_by = %s
        WHERE api_name = %s
    """, (unblocked_by, api_name))
    conn.commit()
    cur.close()
    conn.close()


def should_send_quota_alert(api_name: str) -> bool:
    """Return True if we haven't sent an alert email for this block yet."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT alert_sent_at FROM api_quota_blocks
        WHERE api_name = %s AND unblocked_at IS NULL
    """, (api_name,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    if row is None:
        return False
    return row[0] is None  # alert_sent_at is NULL → haven't sent yet


def mark_quota_alert_sent(api_name: str):
    """Record that the quota alert email has been dispatched."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        UPDATE api_quota_blocks SET alert_sent_at = NOW()
        WHERE api_name = %s AND unblocked_at IS NULL
    """, (api_name,))
    conn.commit()
    cur.close()
    conn.close()


def get_api_blocks() -> list:
    """Return all current (unresolved) quota blocks."""
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT api_name, blocked_at, alert_sent_at, unblocked_at, unblocked_by
        FROM api_quota_blocks
        ORDER BY blocked_at DESC
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


# ===== API Usage Tracking =====

def track_call(api_name: str, cached: bool):
    """Increment live_calls or cache_hits for today's api_name row."""
    conn = get_conn()
    cur = conn.cursor()
    if cached:
        cur.execute("""
            INSERT INTO api_usage (api_name, call_date, cache_hits)
            VALUES (%s, CURRENT_DATE, 1)
            ON CONFLICT (api_name, call_date) DO UPDATE SET
                cache_hits = api_usage.cache_hits + 1
        """, (api_name,))
    else:
        cur.execute("""
            INSERT INTO api_usage (api_name, call_date, live_calls)
            VALUES (%s, CURRENT_DATE, 1)
            ON CONFLICT (api_name, call_date) DO UPDATE SET
                live_calls = api_usage.live_calls + 1
        """, (api_name,))
    conn.commit()
    cur.close()
    conn.close()


def get_api_usage(days: int = 30) -> list:
    """Return per-day usage rows for the last N days."""
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT api_name, call_date, live_calls, cache_hits
        FROM api_usage
        WHERE call_date >= CURRENT_DATE - (%s || ' days')::interval
        ORDER BY api_name, call_date DESC
    """, (days,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


def get_api_limits() -> dict:
    """Return {api_name: daily_limit} for all configured APIs."""
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT api_name, daily_limit FROM api_daily_limits")
    rows = {r["api_name"]: r["daily_limit"] for r in cur.fetchall()}
    cur.close()
    conn.close()
    return rows


def set_api_limit(api_name: str, daily_limit: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO api_daily_limits (api_name, daily_limit, updated_at)
        VALUES (%s, %s, NOW())
        ON CONFLICT (api_name) DO UPDATE SET
            daily_limit = EXCLUDED.daily_limit,
            updated_at = NOW()
    """, (api_name, daily_limit))
    conn.commit()
    cur.close()
    conn.close()


def get_today_live_calls(api_name: str) -> int:
    """Return today's live (non-cached) call count for one API."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT COALESCE(live_calls, 0) FROM api_usage
        WHERE api_name = %s AND call_date = CURRENT_DATE
    """, (api_name,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row[0] if row else 0


def is_quota_exceeded(api_name: str) -> bool:
    """Return True if today's live calls have hit the configured daily limit."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT
            COALESCE(u.live_calls, 0) >= COALESCE(l.daily_limit, 9999999)
        FROM api_daily_limits l
        LEFT JOIN api_usage u
            ON u.api_name = l.api_name AND u.call_date = CURRENT_DATE
        WHERE l.api_name = %s
    """, (api_name,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return bool(row[0]) if row else False


# ===== Generic Search Cache =====

def cache_get(key: str) -> Optional[dict]:
    """Return cached payload if not expired, else None."""
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "SELECT payload FROM enrichment_cache WHERE cache_key = %s AND expires_at > NOW()",
        (key,)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row["payload"] if row else None


def cache_set(key: str, activity_type: str, payload: dict, ttl_seconds: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO enrichment_cache (cache_key, activity_type, payload, expires_at)
        VALUES (%s, %s, %s, NOW() + (%s || ' seconds')::interval)
        ON CONFLICT (cache_key) DO UPDATE SET
            payload = EXCLUDED.payload,
            cached_at = NOW(),
            expires_at = NOW() + (%s || ' seconds')::interval
    """, (key, activity_type, json.dumps(payload), ttl_seconds, ttl_seconds))
    conn.commit()
    cur.close()
    conn.close()


def cache_delete_by_type(activity_type: str) -> int:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM enrichment_cache WHERE activity_type = %s", (activity_type,))
    deleted = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()
    return deleted


def cache_stats() -> dict:
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT
            activity_type,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE expires_at > NOW()) as active,
            COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired
        FROM enrichment_cache
        GROUP BY activity_type
        ORDER BY activity_type
    """)
    by_type = [dict(r) for r in cur.fetchall()]
    cur.execute("SELECT COUNT(*) as total FROM enrichment_cache WHERE expires_at > NOW()")
    total_active = cur.fetchone()["total"]
    cur.close()
    conn.close()
    return {"by_type": by_type, "total_active": total_active}


# ===== Place Details =====

def get_place(place_id: str) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM place_details WHERE place_id = %s", (place_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def upsert_place(place_id: str, data: dict):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO place_details
            (place_id, name, lat, lng, address, phone, website,
             rating, price_level, photo_object_keys, hours)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (place_id) DO UPDATE SET
            name = EXCLUDED.name, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
            address = EXCLUDED.address, phone = EXCLUDED.phone,
            website = EXCLUDED.website, rating = EXCLUDED.rating,
            price_level = EXCLUDED.price_level,
            photo_object_keys = EXCLUDED.photo_object_keys,
            hours = EXCLUDED.hours, cached_at = NOW()
    """, (
        place_id, data.get("name"), data.get("lat"), data.get("lng"),
        data.get("address"), data.get("phone"), data.get("website"),
        data.get("rating"), data.get("price_level"),
        json.dumps(data.get("photo_object_keys", [])),
        json.dumps(data.get("hours", {}))
    ))
    conn.commit()
    cur.close()
    conn.close()


# ===== Book Details =====

def get_book(volume_id: str) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM book_details WHERE volume_id = %s", (volume_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def upsert_book(volume_id: str, data: dict):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO book_details
            (volume_id, title, authors, description, cover_object_key,
             cover_url, page_count, publisher, published_date, rating, isbn)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (volume_id) DO UPDATE SET
            title = EXCLUDED.title, authors = EXCLUDED.authors,
            description = EXCLUDED.description,
            cover_object_key = EXCLUDED.cover_object_key,
            cover_url = EXCLUDED.cover_url, page_count = EXCLUDED.page_count,
            publisher = EXCLUDED.publisher, published_date = EXCLUDED.published_date,
            rating = EXCLUDED.rating, isbn = EXCLUDED.isbn, cached_at = NOW()
    """, (
        volume_id, data.get("title"), json.dumps(data.get("authors", [])),
        data.get("description"), data.get("cover_object_key"),
        data.get("cover_url"), data.get("page_count"),
        data.get("publisher"), data.get("published_date"),
        data.get("rating"), data.get("isbn")
    ))
    conn.commit()
    cur.close()
    conn.close()


# ===== Movie Details =====

def get_movie(tmdb_id: int) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM movie_details WHERE tmdb_id = %s", (tmdb_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def upsert_movie(tmdb_id: int, data: dict):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO movie_details
            (tmdb_id, title, overview, poster_object_key, poster_url,
             backdrop_object_key, backdrop_url, release_date, runtime,
             genres, cast_list, rating, trailer_key)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (tmdb_id) DO UPDATE SET
            title = EXCLUDED.title, overview = EXCLUDED.overview,
            poster_object_key = EXCLUDED.poster_object_key,
            poster_url = EXCLUDED.poster_url,
            backdrop_object_key = EXCLUDED.backdrop_object_key,
            backdrop_url = EXCLUDED.backdrop_url,
            release_date = EXCLUDED.release_date, runtime = EXCLUDED.runtime,
            genres = EXCLUDED.genres, cast_list = EXCLUDED.cast_list,
            rating = EXCLUDED.rating, trailer_key = EXCLUDED.trailer_key,
            cached_at = NOW()
    """, (
        tmdb_id, data.get("title"), data.get("overview"),
        data.get("poster_object_key"), data.get("poster_url"),
        data.get("backdrop_object_key"), data.get("backdrop_url"),
        data.get("release_date"), data.get("runtime"),
        json.dumps(data.get("genres", [])),
        json.dumps(data.get("cast_list", [])),
        data.get("rating"), data.get("trailer_key")
    ))
    conn.commit()
    cur.close()
    conn.close()


# ===== Show Details =====

def get_show(tmdb_id: int) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM show_details WHERE tmdb_id = %s", (tmdb_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def upsert_show(tmdb_id: int, data: dict):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO show_details
            (tmdb_id, title, overview, poster_object_key, poster_url,
             backdrop_object_key, backdrop_url, first_air_date,
             number_of_seasons, number_of_episodes,
             genres, cast_list, rating, trailer_key)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (tmdb_id) DO UPDATE SET
            title = EXCLUDED.title, overview = EXCLUDED.overview,
            poster_object_key = EXCLUDED.poster_object_key,
            poster_url = EXCLUDED.poster_url,
            backdrop_object_key = EXCLUDED.backdrop_object_key,
            backdrop_url = EXCLUDED.backdrop_url,
            first_air_date = EXCLUDED.first_air_date,
            number_of_seasons = EXCLUDED.number_of_seasons,
            number_of_episodes = EXCLUDED.number_of_episodes,
            genres = EXCLUDED.genres, cast_list = EXCLUDED.cast_list,
            rating = EXCLUDED.rating, trailer_key = EXCLUDED.trailer_key,
            cached_at = NOW()
    """, (
        tmdb_id, data.get("title"), data.get("overview"),
        data.get("poster_object_key"), data.get("poster_url"),
        data.get("backdrop_object_key"), data.get("backdrop_url"),
        data.get("first_air_date"),
        data.get("number_of_seasons"), data.get("number_of_episodes"),
        json.dumps(data.get("genres", [])),
        json.dumps(data.get("cast_list", [])),
        data.get("rating"), data.get("trailer_key")
    ))
    conn.commit()
    cur.close()
    conn.close()


# ===== Game Details =====

def get_game(igdb_id: int) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM game_details WHERE igdb_id = %s", (igdb_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def upsert_game(igdb_id: int, data: dict):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO game_details
            (igdb_id, name, cover_object_key, cover_url, summary,
             rating, genres, platforms, release_date)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (igdb_id) DO UPDATE SET
            name = EXCLUDED.name,
            cover_object_key = EXCLUDED.cover_object_key,
            cover_url = EXCLUDED.cover_url, summary = EXCLUDED.summary,
            rating = EXCLUDED.rating, genres = EXCLUDED.genres,
            platforms = EXCLUDED.platforms, release_date = EXCLUDED.release_date,
            cached_at = NOW()
    """, (
        igdb_id, data.get("name"),
        data.get("cover_object_key"), data.get("cover_url"),
        data.get("summary"), data.get("rating"),
        json.dumps(data.get("genres", [])),
        json.dumps(data.get("platforms", [])),
        data.get("release_date")
    ))
    conn.commit()
    cur.close()
    conn.close()


# ===== Geocode Cache =====

def get_geocode(query: str) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """SELECT lat, lng, formatted_address FROM geocode_cache
           WHERE query = %s AND cached_at > NOW() - INTERVAL '30 days'""",
        (query.lower().strip(),)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def upsert_geocode(query: str, lat: float, lng: float, formatted_address: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO geocode_cache (query, lat, lng, formatted_address)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (query) DO UPDATE SET
            lat = EXCLUDED.lat, lng = EXCLUDED.lng,
            formatted_address = EXCLUDED.formatted_address,
            cached_at = NOW()
    """, (query.lower().strip(), lat, lng, formatted_address))
    conn.commit()
    cur.close()
    conn.close()


# ===== User Discover Cache =====

def get_user_items(user_id: int, activity_type: str) -> list:
    """Return list of item_ids for a user+activity_type."""
    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "SELECT item_id, item_type FROM user_discover_cache WHERE user_id = %s AND activity_type = %s ORDER BY loaded_at DESC",
        (user_id, activity_type)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


def upsert_user_item(user_id: int, activity_type: str, item_id: str, item_type: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO user_discover_cache (user_id, activity_type, item_id, item_type, loaded_at)
        VALUES (%s, %s, %s, %s, NOW())
        ON CONFLICT (user_id, activity_type, item_id) DO UPDATE SET
            item_type = EXCLUDED.item_type, loaded_at = NOW()
    """, (user_id, activity_type, item_id, item_type))
    conn.commit()
    cur.close()
    conn.close()


def clear_user_items(user_id: int, activity_type: Optional[str] = None):
    conn = get_conn()
    cur = conn.cursor()
    if activity_type:
        cur.execute(
            "DELETE FROM user_discover_cache WHERE user_id = %s AND activity_type = %s",
            (user_id, activity_type)
        )
    else:
        cur.execute("DELETE FROM user_discover_cache WHERE user_id = %s", (user_id,))
    conn.commit()
    cur.close()
    conn.close()
