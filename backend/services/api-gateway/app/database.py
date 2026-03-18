import psycopg2
import psycopg2.extras
import os
from datetime import datetime, timedelta
import secrets
from passlib.context import CryptContext

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Database URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://clubpal:clubpal@db:5432/clubpal_gateway")


def init_db():
    """Initialize database with schema."""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()

    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            full_name TEXT,
            password_hash TEXT NOT NULL,
            is_admin INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            email_verified INTEGER DEFAULT 0,
            avatar_url TEXT,
            password_changed INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login_at TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Migrations for existing databases
    for col, definition in [
        ("avatar_url", "TEXT"),
        ("is_active", "INTEGER DEFAULT 1"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col} {definition}")
        except Exception:
            pass

    try:
        cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed INTEGER DEFAULT 1")
    except Exception:
        pass

    # OIDC — store the provider:sub identifier (e.g. "google:1234567890")
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS oidc_sub TEXT")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oidc_sub ON users(oidc_sub) WHERE oidc_sub IS NOT NULL")
    except Exception:
        pass

    # Short-lived tokens for pending OIDC account-link confirmations (Apple only)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS oidc_pending_links (
            token      TEXT PRIMARY KEY,
            oidc_sub   TEXT NOT NULL,
            email      TEXT NOT NULL,
            full_name  TEXT,
            avatar_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL
        )
    """)

    # Sessions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            session_token TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            last_used_at TIMESTAMP,
            ip_address TEXT,
            user_agent TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    # Migrations for existing sessions table
    for col, definition in [
        ("last_used_at", "TIMESTAMP"),
        ("ip_address", "TEXT"),
        ("user_agent", "TEXT"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE sessions ADD COLUMN IF NOT EXISTS {col} {definition}")
        except Exception:
            pass

    # Invite tokens table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS invite_tokens (
            id SERIAL PRIMARY KEY,
            email TEXT NOT NULL,
            invited_by INTEGER NOT NULL,
            group_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            accepted INTEGER DEFAULT 0,
            FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Email verification tokens
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS verification_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            used INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Password reset tokens
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reset_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            used INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # System integrations — stores external API keys set via admin UI
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_integrations (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # User notification preferences
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_notification_prefs (
            user_id INTEGER PRIMARY KEY,
            notify_rotation INTEGER DEFAULT 1,
            notify_events INTEGER DEFAULT 1,
            notify_reminders INTEGER DEFAULT 1,
            notify_invites INTEGER DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # User discover preferences (onboarding)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id          INTEGER PRIMARY KEY,
            location_address TEXT,
            location_lat     REAL,
            location_lng     REAL,
            radius_dining    INTEGER DEFAULT 10,
            radius_hiking    INTEGER DEFAULT 25,
            radius_arts      INTEGER DEFAULT 10,
            activities       TEXT DEFAULT '["dining","movies","books","hiking","gaming","arts"]',
            book_genres      TEXT DEFAULT '[]',
            movie_genres     TEXT DEFAULT '[]',
            game_types       TEXT DEFAULT '["video_game","board_game"]',
            onboarding_complete INTEGER DEFAULT 0,
            last_loaded_at   TIMESTAMP,
            updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Push tokens (Expo)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_push_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL,
            platform TEXT DEFAULT 'unknown',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, token),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # In-app notifications
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT,
            link_type TEXT,
            link_id INTEGER,
            read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Saved / wishlist items
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS saved_items (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            item_type TEXT NOT NULL,
            item_id TEXT NOT NULL,
            item_name TEXT NOT NULL,
            item_meta JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, item_type, item_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON invite_tokens(token)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_invite_tokens_email ON invite_tokens(email)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON reset_tokens(token)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON user_push_tokens(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user ON user_notifications(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_notifications_read ON user_notifications(user_id, read)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_saved_items_user ON saved_items(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_saved_items_lookup ON saved_items(user_id, item_type, item_id)")

    conn.commit()
    conn.close()


# ── System integrations helpers ──────────────────────────────────────────────

def get_all_integrations() -> dict:
    """Return all stored integration keys as {key: value}."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM system_integrations")
    rows = cursor.fetchall()
    conn.close()
    return {row["key"]: row["value"] for row in rows}


def set_integration(key: str, value: str):
    """Upsert a single integration key."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO system_integrations (key, value, updated_at)
        VALUES (%s, %s, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    """, (key, value))
    conn.commit()
    conn.close()


def delete_integration(key: str):
    """Remove a stored integration key."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM system_integrations WHERE key = %s", (key,))
    conn.commit()
    conn.close()


def get_db():
    """Get database connection with dict cursor."""
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    return conn


# User functions
def create_user(username: str, email: str, password: str, full_name: str = None,
                is_admin: bool = False, email_verified: bool = False,
                password_changed: bool = True) -> int:
    """Create a new user."""
    conn = get_db()
    cursor = conn.cursor()

    password_hash = pwd_context.hash(password)

    try:
        cursor.execute(
            """INSERT INTO users (username, email, password_hash, full_name, is_admin, email_verified, password_changed)
               VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (username, email, password_hash, full_name, int(is_admin), int(email_verified), int(password_changed))
        )
        user_id = cursor.fetchone()['id']
        conn.commit()
        return user_id
    except psycopg2.IntegrityError as e:
        conn.rollback()
        raise ValueError(f"User already exists: {str(e)}")
    finally:
        conn.close()


def get_user_by_username(username: str) -> dict:
    """Get user by username or email."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM users WHERE username = %s OR email = %s",
        (username.lower(), username.lower())
    )
    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def get_user_by_email(email: str) -> dict:
    """Get user by email."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM users WHERE email = %s", (email.lower(),))
    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def get_user_count() -> int:
    """Return the total number of registered users."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) AS count FROM users")
    return cursor.fetchone()["count"]


def get_user_by_id(user_id: int) -> dict:
    """Get user by ID (includes onboarding_complete from user_preferences)."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT u.*, COALESCE(p.onboarding_complete, 0) AS onboarding_complete
        FROM users u
        LEFT JOIN user_preferences p ON u.id = p.user_id
        WHERE u.id = %s
    """, (user_id,))
    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verify password against hash."""
    return pwd_context.verify(plain_password, password_hash)


def update_last_login(user_id: int):
    """Update user's last login timestamp."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = %s",
        (user_id,)
    )

    conn.commit()
    conn.close()


def update_user_email_verified(user_id: int):
    """Mark user's email as verified."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("UPDATE users SET email_verified = 1 WHERE id = %s", (user_id,))

    conn.commit()
    conn.close()


def update_user_password(user_id: int, new_password: str):
    """Update user's password and mark it as changed."""
    conn = get_db()
    cursor = conn.cursor()

    password_hash = pwd_context.hash(new_password)
    cursor.execute(
        "UPDATE users SET password_hash = %s, password_changed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
        (password_hash, user_id)
    )

    conn.commit()
    conn.close()


# Session functions
def create_session(user_id: int) -> tuple[str, datetime]:
    """Create a new session token (30-day expiry)."""
    conn = get_db()
    cursor = conn.cursor()

    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=30)

    cursor.execute(
        "INSERT INTO sessions (user_id, session_token, expires_at) VALUES (%s, %s, %s)",
        (user_id, session_token, expires_at)
    )

    conn.commit()
    conn.close()

    return session_token, expires_at


def get_user_by_session(session_token: str) -> dict:
    """Get user by session token (includes onboarding_complete)."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT u.*, COALESCE(p.onboarding_complete, 0) AS onboarding_complete
        FROM users u
        JOIN sessions s ON u.id = s.user_id
        LEFT JOIN user_preferences p ON u.id = p.user_id
        WHERE s.session_token = %s AND s.expires_at > CURRENT_TIMESTAMP
    """, (session_token,))

    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def delete_session(session_token: str):
    """Delete a session (logout)."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM sessions WHERE session_token = %s", (session_token,))

    conn.commit()
    conn.close()


def cleanup_expired_sessions():
    """Remove expired sessions."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP")

    conn.commit()
    conn.close()


# Invite token functions
def create_invite_token(email: str, invited_by: int, group_id: int) -> tuple[str, datetime]:
    """Create an invite token (7-day expiry)."""
    conn = get_db()
    cursor = conn.cursor()

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=7)

    cursor.execute(
        """INSERT INTO invite_tokens (email, invited_by, group_id, token, expires_at)
           VALUES (%s, %s, %s, %s, %s)""",
        (email.lower(), invited_by, group_id, token, expires_at)
    )

    conn.commit()
    conn.close()

    return token, expires_at


def get_invite_by_token(token: str) -> dict:
    """Get invite by token."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM invite_tokens
        WHERE token = %s AND expires_at > CURRENT_TIMESTAMP AND accepted = 0
    """, (token,))

    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def mark_invite_accepted(token: str):
    """Mark invite as accepted."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("UPDATE invite_tokens SET accepted = 1 WHERE token = %s", (token,))

    conn.commit()
    conn.close()


def get_pending_invites_for_group(group_id: int) -> list:
    """Get pending (unaccepted, non-expired) email invites for a group."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT email, invited_by, created_at, expires_at
        FROM invite_tokens
        WHERE group_id = %s AND accepted = 0 AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
    """, (group_id,))

    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


# Email verification functions
def create_verification_token(user_id: int) -> tuple[str, datetime]:
    """Create email verification token (24-hour expiry)."""
    conn = get_db()
    cursor = conn.cursor()

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=24)

    cursor.execute(
        "INSERT INTO verification_tokens (user_id, token, expires_at) VALUES (%s, %s, %s)",
        (user_id, token, expires_at)
    )

    conn.commit()
    conn.close()

    return token, expires_at


def verify_email_token(token: str) -> int:
    """Verify email token and return user_id."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT user_id FROM verification_tokens
        WHERE token = %s AND expires_at > CURRENT_TIMESTAMP AND used = 0
    """, (token,))

    row = cursor.fetchone()

    if row:
        user_id = row['user_id']
        cursor.execute("UPDATE verification_tokens SET used = 1 WHERE token = %s", (token,))
        conn.commit()
        conn.close()
        return user_id

    conn.close()
    return None


# Password reset functions
def create_reset_token(user_id: int) -> tuple[str, datetime]:
    """Create password reset token (1-hour expiry)."""
    conn = get_db()
    cursor = conn.cursor()

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=1)

    cursor.execute(
        "INSERT INTO reset_tokens (user_id, token, expires_at) VALUES (%s, %s, %s)",
        (user_id, token, expires_at)
    )

    conn.commit()
    conn.close()

    return token, expires_at


def verify_reset_token(token: str) -> int:
    """Verify reset token and return user_id."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT user_id FROM reset_tokens
        WHERE token = %s AND expires_at > CURRENT_TIMESTAMP AND used = 0
    """, (token,))

    row = cursor.fetchone()

    if row:
        user_id = row['user_id']
        cursor.execute("UPDATE reset_tokens SET used = 1 WHERE token = %s", (token,))
        conn.commit()
        conn.close()
        return user_id

    conn.close()
    return None


# Profile update
def update_user_profile(user_id: int, full_name: str = None, username: str = None,
                         email: str = None, avatar_url: str = None) -> bool:
    """Update user profile fields."""
    conn = get_db()
    cursor = conn.cursor()

    updates = []
    params = []

    if full_name is not None:
        updates.append("full_name = %s")
        params.append(full_name)
    if username is not None:
        updates.append("username = %s")
        params.append(username.lower())
    if email is not None:
        updates.append("email = %s")
        params.append(email.lower())
    if avatar_url is not None:
        updates.append("avatar_url = %s")
        params.append(avatar_url)

    if not updates:
        conn.close()
        return True

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(user_id)

    try:
        cursor.execute(
            f"UPDATE users SET {', '.join(updates)} WHERE id = %s",
            params
        )
        success = cursor.rowcount > 0
        conn.commit()
        return success
    except psycopg2.IntegrityError:
        conn.rollback()
        raise ValueError("Username or email already taken")
    finally:
        conn.close()


# Session management
def get_sessions_for_user(user_id: int) -> list:
    """Get all active sessions for a user."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT session_token, created_at, expires_at, last_used_at, ip_address, user_agent
        FROM sessions
        WHERE user_id = %s AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
    """, (user_id,))

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def delete_sessions_except(user_id: int, keep_token: str) -> int:
    """Delete all sessions for a user except the specified one (used on password change)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM sessions WHERE user_id = %s AND session_token != %s",
        (user_id, keep_token)
    )
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted


def delete_session_by_token_for_user(token: str, user_id: int) -> bool:
    """Delete a session owned by the given user."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "DELETE FROM sessions WHERE session_token = %s AND user_id = %s",
        (token, user_id)
    )

    success = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return success


# Admin user management
def get_admin_emails() -> list:
    """Return email addresses of all admin users, oldest first.
    Used as fallback alert recipients when ADMIN_EMAIL env var is not set."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT email FROM users WHERE is_admin = 1 AND is_active = 1 ORDER BY created_at ASC"
    )
    rows = cursor.fetchall()
    conn.close()
    return [row["email"] for row in rows if row["email"]]


def get_all_users(limit: int = 100, offset: int = 0) -> list:
    """Get all users (admin only)."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM users ORDER BY created_at DESC LIMIT %s OFFSET %s",
        (limit, offset)
    )

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def admin_update_user(user_id: int, full_name: str = None, is_admin: bool = None,
                       email_verified: bool = None, is_active: bool = None) -> bool:
    """Admin: update any user's fields."""
    conn = get_db()
    cursor = conn.cursor()

    updates = []
    params = []

    if full_name is not None:
        updates.append("full_name = %s")
        params.append(full_name)
    if is_admin is not None:
        updates.append("is_admin = %s")
        params.append(int(is_admin))
    if email_verified is not None:
        updates.append("email_verified = %s")
        params.append(int(email_verified))
    if is_active is not None:
        updates.append("is_active = %s")
        params.append(int(is_active))

    if not updates:
        conn.close()
        return True

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(user_id)

    cursor.execute(
        f"UPDATE users SET {', '.join(updates)} WHERE id = %s",
        params
    )

    success = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return success


def deactivate_user(user_id: int) -> bool:
    """Admin: deactivate a user account (soft delete)."""
    return admin_update_user(user_id, is_active=False)


# ── Notification preferences ─────────────────────────────────────────────────

_DEFAULT_PREFS = {
    "notify_rotation":  True,
    "notify_events":    True,
    "notify_reminders": True,
    "notify_invites":   True,
}


def get_notification_prefs(user_id: int) -> dict:
    """Return notification preferences for a user (defaults if not yet set)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM user_notification_prefs WHERE user_id = %s", (user_id,)
    )
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "notify_rotation":  bool(row["notify_rotation"]),
            "notify_events":    bool(row["notify_events"]),
            "notify_reminders": bool(row["notify_reminders"]),
            "notify_invites":   bool(row["notify_invites"]),
        }
    return dict(_DEFAULT_PREFS)


def set_notification_prefs(user_id: int, notify_rotation: bool = True,
                            notify_events: bool = True, notify_reminders: bool = True,
                            notify_invites: bool = True) -> None:
    """Upsert notification preferences for a user."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO user_notification_prefs
            (user_id, notify_rotation, notify_events, notify_reminders, notify_invites, updated_at)
        VALUES (%s, %s, %s, %s, %s, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            notify_rotation  = EXCLUDED.notify_rotation,
            notify_events    = EXCLUDED.notify_events,
            notify_reminders = EXCLUDED.notify_reminders,
            notify_invites   = EXCLUDED.notify_invites,
            updated_at       = NOW()
    """, (user_id, int(notify_rotation), int(notify_events),
          int(notify_reminders), int(notify_invites)))
    conn.commit()
    conn.close()


# ── Discover preferences ──────────────────────────────────────────────────────

_DEFAULT_DISCOVER_PREFS = {
    "location_address": None,
    "location_lat": None,
    "location_lng": None,
    "radius_dining": 10,
    "radius_hiking": 25,
    "radius_arts": 10,
    "activities": ["dining", "movies", "books", "hiking", "gaming", "arts"],
    "book_genres": [],
    "movie_genres": [],
    "game_types": ["video_game", "board_game"],
    "onboarding_complete": False,
    "last_loaded_at": None,
}


def get_user_preferences(user_id: int) -> dict:
    """Return discover preferences for a user (defaults if not yet set)."""
    import json
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM user_preferences WHERE user_id = %s", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "user_id": row["user_id"],
            "location_address": row["location_address"],
            "location_lat": row["location_lat"],
            "location_lng": row["location_lng"],
            "radius_dining": row["radius_dining"],
            "radius_hiking": row["radius_hiking"],
            "radius_arts": row["radius_arts"],
            "activities": json.loads(row["activities"] or '["dining","movies","books","hiking","gaming","arts"]'),
            "book_genres": json.loads(row["book_genres"] or '[]'),
            "movie_genres": json.loads(row["movie_genres"] or '[]'),
            "game_types": json.loads(row["game_types"] or '["video_game","board_game"]'),
            "onboarding_complete": bool(row["onboarding_complete"]),
            "last_loaded_at": row["last_loaded_at"],
        }
    return {"user_id": user_id, **_DEFAULT_DISCOVER_PREFS}


def upsert_user_preferences(user_id: int, **fields) -> dict:
    """Upsert discover preferences for a user and return updated row."""
    import json
    if not fields:
        return get_user_preferences(user_id)

    conn = get_db()
    cursor = conn.cursor()

    # Serialize list fields
    for list_field in ("activities", "book_genres", "movie_genres", "game_types"):
        if list_field in fields and isinstance(fields[list_field], list):
            fields[list_field] = json.dumps(fields[list_field])

    set_clauses = [f"{k} = %s" for k in fields]
    set_clauses.append("updated_at = CURRENT_TIMESTAMP")
    values = list(fields.values())

    cursor.execute(f"""
        INSERT INTO user_preferences (user_id, {', '.join(fields.keys())}, updated_at)
        VALUES (%s, {', '.join(['%s'] * len(fields))}, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET
            {', '.join(set_clauses)}
    """, [user_id] + values + values)

    conn.commit()
    conn.close()
    return get_user_preferences(user_id)


# ── Push tokens ───────────────────────────────────────────────────────────────

def upsert_push_token(user_id: int, token: str, platform: str = "unknown") -> None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO user_push_tokens (user_id, token, platform, updated_at)
        VALUES (%s, %s, %s, NOW())
        ON CONFLICT (user_id, token) DO UPDATE SET platform = EXCLUDED.platform, updated_at = NOW()
    """, (user_id, token, platform))
    conn.commit()
    conn.close()


def get_push_tokens_for_users(user_ids: list) -> list:
    """Return all Expo push tokens for a list of user IDs."""
    if not user_ids:
        return []
    conn = get_db()
    cursor = conn.cursor()
    placeholders = ','.join(['%s'] * len(user_ids))
    cursor.execute(f"SELECT token FROM user_push_tokens WHERE user_id IN ({placeholders})", user_ids)
    rows = cursor.fetchall()
    conn.close()
    return [r["token"] for r in rows]


# ── In-app notifications ──────────────────────────────────────────────────────

def create_notification(user_id: int, type: str, title: str, body: str = None,
                        link_type: str = None, link_id: int = None) -> int:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO user_notifications (user_id, type, title, body, link_type, link_id)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
    """, (user_id, type, title, body, link_type, link_id))
    notif_id = cursor.fetchone()["id"]
    conn.commit()
    conn.close()
    return notif_id


def get_notifications_for_user(user_id: int, limit: int = 50) -> list:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM user_notifications WHERE user_id = %s
        ORDER BY created_at DESC LIMIT %s
    """, (user_id, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def mark_notification_read(notif_id: int, user_id: int) -> None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE user_notifications SET read = 1 WHERE id = %s AND user_id = %s",
                   (notif_id, user_id))
    conn.commit()
    conn.close()


def mark_all_notifications_read(user_id: int) -> None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE user_notifications SET read = 1 WHERE user_id = %s", (user_id,))
    conn.commit()
    conn.close()


# ── OIDC helpers ──────────────────────────────────────────────────────────────

import re as _re


def get_user_by_oidc_sub(oidc_sub: str):
    """Get user by OIDC subject identifier (e.g. 'google:1234567890')."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE oidc_sub = %s", (oidc_sub,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def link_oidc_sub(user_id: int, oidc_sub: str) -> None:
    """Associate an OIDC subject identifier with an existing user."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET oidc_sub = %s WHERE id = %s", (oidc_sub, user_id))
    conn.commit()
    conn.close()


def unlink_oidc_sub(user_id: int) -> None:
    """Remove the OIDC subject identifier from a user."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET oidc_sub = NULL WHERE id = %s", (user_id,))
    conn.commit()
    conn.close()


def _unique_username(base: str, cursor) -> str:
    """Generate a unique username derived from `base`."""
    # Strip non-alphanumeric chars (keep _ -)
    clean = _re.sub(r'[^a-z0-9_-]', '', base.lower())[:30] or 'user'
    candidate = clean
    suffix = 1
    while True:
        cursor.execute("SELECT id FROM users WHERE username = %s", (candidate,))
        if not cursor.fetchone():
            return candidate
        candidate = f"{clean}{suffix}"
        suffix += 1


def create_pending_link(oidc_sub: str, email: str, full_name: str = None, avatar_url: str = None) -> str:
    """Store a short-lived token for a pending OIDC link confirmation (5-min TTL)."""
    import secrets
    token = secrets.token_urlsafe(32)
    conn = get_db()
    cursor = conn.cursor()
    # Clean up expired tokens first
    cursor.execute("DELETE FROM oidc_pending_links WHERE expires_at < NOW()")
    cursor.execute("""
        INSERT INTO oidc_pending_links (token, oidc_sub, email, full_name, avatar_url, expires_at)
        VALUES (%s, %s, %s, %s, %s, NOW() + INTERVAL '5 minutes')
        ON CONFLICT (token) DO NOTHING
    """, (token, oidc_sub, email, full_name, avatar_url))
    conn.commit()
    conn.close()
    return token


def consume_pending_link(token: str) -> dict:
    """Return and delete the pending link record if it exists and hasn't expired."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        DELETE FROM oidc_pending_links
        WHERE token = %s AND expires_at > NOW()
        RETURNING oidc_sub, email, full_name, avatar_url
    """, (token,))
    row = cursor.fetchone()
    conn.commit()
    conn.close()
    return dict(row) if row else None


def create_oidc_user(email: str, full_name: str, oidc_sub: str, avatar_url: str = None) -> int:
    """Create a user that signed up via OIDC. No password needed."""
    conn = get_db()
    cursor = conn.cursor()
    # Derive username from email prefix
    base = email.split('@')[0]
    username = _unique_username(base, cursor)
    try:
        cursor.execute(
            """INSERT INTO users
               (username, email, password_hash, full_name, email_verified,
                password_changed, oidc_sub, avatar_url)
               VALUES (%s, %s, %s, %s, 1, 1, %s, %s)
               RETURNING id""",
            (username, email.lower(), '', full_name, oidc_sub, avatar_url)
        )
        user_id = cursor.fetchone()['id']
        conn.commit()
        return user_id
    except psycopg2.IntegrityError as e:
        conn.rollback()
        raise ValueError(f"OIDC user creation failed: {e}")
    finally:
        conn.close()


# ── Saved items (wishlist) ────────────────────────────────────────────────────

def get_saved_items(user_id: int, item_type: str = None) -> list:
    conn = get_db()
    cursor = conn.cursor()
    if item_type:
        cursor.execute(
            "SELECT * FROM saved_items WHERE user_id = %s AND item_type = %s ORDER BY created_at DESC",
            (user_id, item_type)
        )
    else:
        cursor.execute(
            "SELECT * FROM saved_items WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,)
        )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


def get_saved_item(user_id: int, item_type: str, item_id: str) -> dict | None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM saved_items WHERE user_id = %s AND item_type = %s AND item_id = %s",
        (user_id, item_type, item_id)
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def save_item(user_id: int, item_type: str, item_id: str, item_name: str, item_meta: dict = None) -> dict:
    import json
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO saved_items (user_id, item_type, item_id, item_name, item_meta)
           VALUES (%s, %s, %s, %s, %s)
           ON CONFLICT (user_id, item_type, item_id) DO UPDATE SET item_name = EXCLUDED.item_name, item_meta = EXCLUDED.item_meta
           RETURNING *""",
        (user_id, item_type, item_id, item_name, json.dumps(item_meta or {}))
    )
    row = dict(cursor.fetchone())
    conn.commit()
    conn.close()
    return row


def delete_saved_item(user_id: int, item_type: str, item_id: str) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM saved_items WHERE user_id = %s AND item_type = %s AND item_id = %s",
        (user_id, item_type, item_id)
    )
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted
