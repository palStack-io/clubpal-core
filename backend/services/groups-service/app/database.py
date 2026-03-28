import psycopg2
import psycopg2.extras
import os
from typing import Optional, List
from datetime import datetime
import random
import string

# Database URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://clubpal:clubpal@db:5432/clubpal_groups")


def init_db():
    """Initialize database with schema."""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()

    # Groups table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS groups (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            rotation_type TEXT DEFAULT 'round_robin',
            activity_type TEXT,
            banner_url TEXT,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Group members table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS group_members (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            role TEXT DEFAULT 'member',
            rotation_order INTEGER DEFAULT NULL,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
            UNIQUE(group_id, user_id)
        )
    """)

    # Migrations for existing databases
    for table, col, definition in [
        ("groups", "banner_url", "TEXT"),
        ("groups", "activity_type", "TEXT"),
        ("group_members", "rotation_order", "INTEGER DEFAULT NULL"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {definition}")
        except Exception:
            pass

    # Rotation state table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rotation_state (
            id SERIAL PRIMARY KEY,
            group_id INTEGER UNIQUE NOT NULL,
            current_user_id INTEGER,
            current_turn_index INTEGER DEFAULT 0,
            last_rotation_at TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        )
    """)

    # Group comments table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS group_comments (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        )
    """)

    # Background personalization migrations
    for table_col in [
        ("groups", "bg_type", "TEXT DEFAULT 'default'"),
        ("groups", "bg_value", "TEXT"),
        ("groups", "bg_scope", "TEXT DEFAULT 'hero'"),
    ]:
        try:
            cursor.execute(f"ALTER TABLE {table_col[0]} ADD COLUMN IF NOT EXISTS {table_col[1]} {table_col[2]}")
        except Exception:
            pass

    # join_behavior on groups
    try:
        cursor.execute("ALTER TABLE groups ADD COLUMN IF NOT EXISTS join_behavior TEXT DEFAULT 'instant'")
    except Exception:
        pass

    # custom_options on polls
    try:
        cursor.execute("ALTER TABLE group_polls ADD COLUMN IF NOT EXISTS custom_options JSONB")
    except Exception:
        pass

    # creator_username on polls
    try:
        cursor.execute("ALTER TABLE group_polls ADD COLUMN IF NOT EXISTS creator_username TEXT")
    except Exception:
        pass

    # Polls tables
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS group_polls (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL,
            created_by INTEGER NOT NULL,
            activity_name TEXT NOT NULL,
            activity_type TEXT,
            activity_id INTEGER,
            note TEXT,
            deadline TIMESTAMP NOT NULL,
            status TEXT DEFAULT 'open',
            converted_event_id INTEGER,
            custom_options JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS group_poll_responses (
            id SERIAL PRIMARY KEY,
            poll_id INTEGER NOT NULL REFERENCES group_polls(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL,
            response TEXT NOT NULL,
            responded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(poll_id, user_id)
        )
    """)

    # Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_members_group ON group_members(group_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_members_user ON group_members(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rotation_group ON rotation_state(group_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_group_comments_group ON group_comments(group_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_polls_group ON group_polls(group_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_polls_status ON group_polls(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_poll_responses_poll ON group_poll_responses(poll_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_poll_responses_user ON group_poll_responses(user_id)")

    # Invite codes table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS invite_codes (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL,
            code TEXT UNIQUE NOT NULL,
            join_behavior TEXT NOT NULL,
            expiry_type TEXT NOT NULL DEFAULT 'never',
            expiry_days INTEGER DEFAULT NULL,
            expires_at TIMESTAMPTZ DEFAULT NULL,
            used_count INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            regenerated_at TIMESTAMPTZ DEFAULT NULL,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        )
    """)

    # Join requests table (approval-mode only)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS join_requests (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            invite_code_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            requested_at TIMESTAMPTZ DEFAULT NOW(),
            reviewed_at TIMESTAMPTZ DEFAULT NULL,
            reviewed_by INTEGER DEFAULT NULL,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
            FOREIGN KEY (invite_code_id) REFERENCES invite_codes(id) ON DELETE CASCADE,
            UNIQUE(group_id, user_id, invite_code_id)
        )
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_invite_codes_group ON invite_codes(group_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_join_requests_group ON join_requests(group_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_join_requests_status ON join_requests(status)")

    conn.commit()
    conn.close()


def get_db():
    """Get database connection with dict cursor."""
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    return conn


# ===== Group CRUD =====

def create_group(name: str, created_by: int, description: str = None,
                rotation_type: str = "round_robin", activity_type: str = None) -> int:
    """Create a new group and add creator as owner."""
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Create group
        cursor.execute(
            """INSERT INTO groups (name, description, rotation_type, activity_type, created_by)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (name, description, rotation_type, activity_type, created_by)
        )
        group_id = cursor.fetchone()['id']

        # Add creator as owner
        cursor.execute(
            """INSERT INTO group_members (group_id, user_id, role)
               VALUES (%s, %s, 'owner')""",
            (group_id, created_by)
        )

        # Initialize rotation state
        cursor.execute(
            """INSERT INTO rotation_state (group_id, current_user_id, current_turn_index)
               VALUES (%s, %s, 0)""",
            (group_id, created_by)
        )

        conn.commit()
        return group_id
    except psycopg2.IntegrityError as e:
        conn.rollback()
        raise ValueError(f"Failed to create group: {str(e)}")
    finally:
        conn.close()


def get_group(group_id: int) -> Optional[dict]:
    """Get group by ID."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM groups WHERE id = %s", (group_id,))
    row = cursor.fetchone()

    if row:
        group = dict(row)
        # Get member count
        cursor.execute("SELECT COUNT(*) FROM group_members WHERE group_id = %s", (group_id,))
        group["member_count"] = cursor.fetchone()['count']
        conn.close()
        return group

    conn.close()
    return None


def get_groups_by_user(user_id: int) -> List[dict]:
    """Get all groups a user is a member of."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT g.*, COUNT(gm2.id) as member_count
        FROM groups g
        JOIN group_members gm ON g.id = gm.group_id
        LEFT JOIN group_members gm2 ON g.id = gm2.group_id
        WHERE gm.user_id = %s
        GROUP BY g.id
        ORDER BY g.created_at DESC
    """, (user_id,))

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def update_group(group_id: int, name: str = None, description: str = None,
                rotation_type: str = None, banner_url: str = None,
                bg_type: str = None, bg_value: str = None, bg_scope: str = None,
                activity_type: str = None, join_behavior: str = None) -> bool:
    """Update group details."""
    conn = get_db()
    cursor = conn.cursor()

    updates = []
    params = []

    if name is not None:
        updates.append("name = %s")
        params.append(name)
    if description is not None:
        updates.append("description = %s")
        params.append(description)
    if rotation_type is not None:
        updates.append("rotation_type = %s")
        params.append(rotation_type)
    if banner_url is not None:
        updates.append("banner_url = %s")
        params.append(banner_url)
    if bg_type is not None:
        updates.append("bg_type = %s")
        params.append(bg_type)
    if bg_value is not None:
        updates.append("bg_value = %s")
        params.append(bg_value)
    if bg_scope is not None:
        updates.append("bg_scope = %s")
        params.append(bg_scope)
    if activity_type is not None:
        updates.append("activity_type = %s")
        params.append(activity_type)
    if join_behavior is not None:
        updates.append("join_behavior = %s")
        params.append(join_behavior)

    if not updates:
        conn.close()
        return True

    updates.append("updated_at = CURRENT_TIMESTAMP")
    params.append(group_id)

    cursor.execute(
        f"UPDATE groups SET {', '.join(updates)} WHERE id = %s",
        params
    )

    success = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return success


def delete_group(group_id: int) -> bool:
    """Delete a group."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM groups WHERE id = %s", (group_id,))

    success = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return success


# ===== Member Management =====

def add_member(group_id: int, user_id: int, role: str = "member") -> bool:
    """Add a member to a group."""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """INSERT INTO group_members (group_id, user_id, role)
               VALUES (%s, %s, %s)""",
            (group_id, user_id, role)
        )
        conn.commit()
        conn.close()
        return True
    except psycopg2.IntegrityError:
        conn.rollback()
        conn.close()
        return False


def get_member(group_id: int, user_id: int) -> Optional[dict]:
    """Get a specific member."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, user_id)
    )

    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def get_members(group_id: int) -> List[dict]:
    """Get all members of a group."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM group_members WHERE group_id = %s ORDER BY rotation_order ASC NULLS LAST, joined_at ASC",
        (group_id,)
    )

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def update_member_role(group_id: int, user_id: int, role: str) -> bool:
    """Update a member's role."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "UPDATE group_members SET role = %s WHERE group_id = %s AND user_id = %s",
        (role, group_id, user_id)
    )

    success = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return success


def remove_member(group_id: int, user_id: int) -> bool:
    """Remove a member from a group and adjust rotation state if they were on turn."""
    conn = get_db()
    cursor = conn.cursor()

    # Snapshot rotation state and member order before removal
    cursor.execute(
        "SELECT current_user_id, current_turn_index FROM rotation_state WHERE group_id = %s",
        (group_id,)
    )
    rotation = cursor.fetchone()

    cursor.execute(
        """SELECT user_id FROM group_members WHERE group_id = %s
           ORDER BY rotation_order ASC NULLS LAST, joined_at ASC""",
        (group_id,)
    )
    members_before = [row['user_id'] for row in cursor.fetchall()]

    # Delete the member
    cursor.execute(
        "DELETE FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, user_id)
    )
    success = cursor.rowcount > 0

    if success and rotation:
        current_user_id = rotation['current_user_id']
        current_turn_index = rotation['current_turn_index']

        # Get remaining members after removal
        cursor.execute(
            """SELECT user_id FROM group_members WHERE group_id = %s
               ORDER BY rotation_order ASC NULLS LAST, joined_at ASC""",
            (group_id,)
        )
        members_after = [row['user_id'] for row in cursor.fetchall()]

        if members_after:
            if current_user_id == user_id:
                # Removed user was on turn — pass turn to whoever is now at that position
                removed_pos = members_before.index(user_id) if user_id in members_before else 0
                new_index = removed_pos % len(members_after)
                new_user_id = members_after[new_index]
            elif current_user_id in members_after:
                # Current user still exists — recalculate their index
                new_index = members_after.index(current_user_id)
                new_user_id = current_user_id
            else:
                new_index = 0
                new_user_id = members_after[0]

            cursor.execute(
                """UPDATE rotation_state SET current_user_id = %s, current_turn_index = %s,
                   last_rotation_at = CURRENT_TIMESTAMP WHERE group_id = %s""",
                (new_user_id, new_index, group_id)
            )

    conn.commit()
    conn.close()

    return success


def is_member(group_id: int, user_id: int) -> bool:
    """Check if user is a member of group."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT 1 FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, user_id)
    )

    result = cursor.fetchone() is not None
    conn.close()

    return result


def is_admin_or_owner(group_id: int, user_id: int) -> bool:
    """Check if user is admin or owner of group."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT role FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, user_id)
    )

    row = cursor.fetchone()
    conn.close()

    if row:
        role = row['role']
        return role in ["owner", "admin"]

    return False


# ===== Rotation Management =====

def get_rotation_state(group_id: int) -> Optional[dict]:
    """Get current rotation state for a group."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM rotation_state WHERE group_id = %s", (group_id,))

    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def advance_rotation(group_id: int) -> Optional[dict]:
    """Advance to the next person in rotation."""
    conn = get_db()
    cursor = conn.cursor()

    # Get group rotation type
    cursor.execute("SELECT rotation_type FROM groups WHERE id = %s", (group_id,))
    group_row = cursor.fetchone()

    if not group_row:
        conn.close()
        return None

    rotation_type = group_row['rotation_type']

    # Get all members — custom rotation_order first, then join date
    cursor.execute(
        """SELECT user_id FROM group_members WHERE group_id = %s
           ORDER BY rotation_order ASC NULLS LAST, joined_at ASC""",
        (group_id,)
    )
    members = [row['user_id'] for row in cursor.fetchall()]

    if not members:
        conn.close()
        return None

    # Get current state
    cursor.execute("SELECT current_turn_index FROM rotation_state WHERE group_id = %s", (group_id,))
    state_row = cursor.fetchone()

    if not state_row:
        conn.close()
        return None

    current_index = state_row['current_turn_index']

    # Calculate next user
    if rotation_type == "round_robin":
        next_index = (current_index + 1) % len(members)
        next_user_id = members[next_index]
    elif rotation_type == "random":
        next_index = random.randint(0, len(members) - 1)
        next_user_id = members[next_index]
    else:  # none
        next_index = current_index
        next_user_id = members[next_index] if members else None

    # Update rotation state
    cursor.execute(
        """UPDATE rotation_state
           SET current_user_id = %s, current_turn_index = %s, last_rotation_at = CURRENT_TIMESTAMP
           WHERE group_id = %s""",
        (next_user_id, next_index, group_id)
    )

    conn.commit()
    conn.close()

    return {
        "group_id": group_id,
        "user_id": next_user_id,
        "turn_index": next_index,
        "rotation_type": rotation_type
    }


def reset_rotation(group_id: int) -> Optional[dict]:
    """Reset rotation to the first member."""
    conn = get_db()
    cursor = conn.cursor()

    # Get group rotation type
    cursor.execute("SELECT rotation_type FROM groups WHERE id = %s", (group_id,))
    group_row = cursor.fetchone()

    if not group_row:
        conn.close()
        return None

    rotation_type = group_row['rotation_type']

    # Get first member (respect rotation_order)
    cursor.execute(
        """SELECT user_id FROM group_members WHERE group_id = %s
           ORDER BY rotation_order ASC NULLS LAST, joined_at ASC LIMIT 1""",
        (group_id,)
    )
    member_row = cursor.fetchone()

    if not member_row:
        conn.close()
        return None

    first_user_id = member_row['user_id']

    # Update rotation state
    cursor.execute(
        """UPDATE rotation_state
           SET current_user_id = %s, current_turn_index = 0, last_rotation_at = CURRENT_TIMESTAMP
           WHERE group_id = %s""",
        (first_user_id, group_id)
    )

    conn.commit()
    conn.close()

    return {
        "group_id": group_id,
        "user_id": first_user_id,
        "turn_index": 0,
        "rotation_type": rotation_type
    }


def set_rotation_turn(group_id: int, user_id: int) -> Optional[dict]:
    """Set rotation to a specific user."""
    conn = get_db()
    cursor = conn.cursor()

    # Verify user is a member
    cursor.execute(
        "SELECT 1 FROM group_members WHERE group_id = %s AND user_id = %s",
        (group_id, user_id)
    )

    if not cursor.fetchone():
        conn.close()
        return None

    # Get group rotation type
    cursor.execute("SELECT rotation_type FROM groups WHERE id = %s", (group_id,))
    group_row = cursor.fetchone()

    if not group_row:
        conn.close()
        return None

    rotation_type = group_row['rotation_type']

    # Get user's index (respect rotation_order)
    cursor.execute(
        """SELECT user_id FROM group_members WHERE group_id = %s
           ORDER BY rotation_order ASC NULLS LAST, joined_at ASC""",
        (group_id,)
    )
    members = [row['user_id'] for row in cursor.fetchall()]

    if user_id not in members:
        conn.close()
        return None

    turn_index = members.index(user_id)

    # Update rotation state
    cursor.execute(
        """UPDATE rotation_state
           SET current_user_id = %s, current_turn_index = %s, last_rotation_at = CURRENT_TIMESTAMP
           WHERE group_id = %s""",
        (user_id, turn_index, group_id)
    )

    conn.commit()
    conn.close()

    return {
        "group_id": group_id,
        "user_id": user_id,
        "turn_index": turn_index,
        "rotation_type": rotation_type
    }


def skip_rotation(group_id: int, reason: str = None) -> Optional[dict]:
    """Skip the current picker and advance to the next (same as advance_rotation)."""
    return advance_rotation(group_id)


def reorder_rotation(group_id: int, user_ids: List[int]) -> bool:
    """Set a custom rotation order by assigning rotation_order indexes."""
    conn = get_db()
    cursor = conn.cursor()

    try:
        for index, user_id in enumerate(user_ids):
            cursor.execute(
                """UPDATE group_members SET rotation_order = %s
                   WHERE group_id = %s AND user_id = %s""",
                (index, group_id, user_id)
            )

        # Update current_turn_index to reflect new order of current user
        cursor.execute(
            "SELECT current_user_id FROM rotation_state WHERE group_id = %s",
            (group_id,)
        )
        state = cursor.fetchone()

        if state and state['current_user_id'] in user_ids:
            new_index = user_ids.index(state['current_user_id'])
            cursor.execute(
                "UPDATE rotation_state SET current_turn_index = %s WHERE group_id = %s",
                (new_index, group_id)
            )

        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        conn.close()


# ===== Group Comments =====

def add_group_comment(group_id: int, user_id: int, content: str) -> int:
    """Add a comment to a group."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO group_comments (group_id, user_id, content) VALUES (%s, %s, %s) RETURNING id",
        (group_id, user_id, content)
    )

    comment_id = cursor.fetchone()['id']
    conn.commit()
    conn.close()

    return comment_id


def get_group_comments(group_id: int) -> List[dict]:
    """Get all comments for a group."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM group_comments WHERE group_id = %s ORDER BY created_at ASC",
        (group_id,)
    )

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def get_group_comment(comment_id: int) -> Optional[dict]:
    """Get a comment by ID."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM group_comments WHERE id = %s", (comment_id,))
    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def delete_group_comment(comment_id: int, deleted_by: int = None) -> bool:
    """Delete a group comment."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM group_comments WHERE id = %s", (comment_id,))

    success = cursor.rowcount > 0
    conn.commit()
    conn.close()

    return success


# ===== Poll CRUD =====

def create_poll(group_id: int, created_by: int, activity_name: str,
                activity_type: str = None, activity_id: int = None,
                note: str = None, deadline: datetime = None,
                custom_options: list = None, creator_username: str = None) -> int:
    """Create a new group poll."""
    import json
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """INSERT INTO group_polls (group_id, created_by, activity_name, activity_type,
           activity_id, note, deadline, custom_options, creator_username)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
        (group_id, created_by, activity_name, activity_type, activity_id, note, deadline,
         json.dumps(custom_options) if custom_options else None, creator_username)
    )
    poll_id = cursor.fetchone()['id']
    conn.commit()
    conn.close()
    return poll_id


def get_poll(poll_id: int) -> Optional[dict]:
    """Get a poll by ID."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM group_polls WHERE id = %s", (poll_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_polls_for_group(group_id: int) -> List[dict]:
    """Get all polls for a group — open first, then closed/converted, newest first."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT * FROM group_polls WHERE group_id = %s
           ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, created_at DESC""",
        (group_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_my_active_polls(user_id: int) -> List[dict]:
    """Get open polls created by the user, with response counts."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT gp.*,
                  COUNT(gpr.id) AS responded_count,
                  COUNT(gm.user_id) AS member_count
           FROM group_polls gp
           JOIN group_members gm ON gp.group_id = gm.group_id
           LEFT JOIN group_poll_responses gpr ON gpr.poll_id = gp.id
           WHERE gp.created_by = %s AND gp.status = 'open'
           GROUP BY gp.id
           ORDER BY gp.created_at DESC""",
        (user_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_pending_polls_for_user(user_id: int) -> List[dict]:
    """Get open polls in user's groups where user hasn't responded and isn't creator."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT gp.* FROM group_polls gp
           JOIN group_members gm ON gp.group_id = gm.group_id
           WHERE gm.user_id = %s
             AND gp.status = 'open'
             AND gp.created_by != %s
             AND NOT EXISTS (
               SELECT 1 FROM group_poll_responses gpr
               WHERE gpr.poll_id = gp.id AND gpr.user_id = %s
             )
           ORDER BY gp.created_at DESC""",
        (user_id, user_id, user_id)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def upsert_poll_response(poll_id: int, user_id: int, response: str) -> dict:
    """Insert or update a poll response."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO group_poll_responses (poll_id, user_id, response)
           VALUES (%s, %s, %s)
           ON CONFLICT (poll_id, user_id) DO UPDATE SET response = EXCLUDED.response,
           responded_at = CURRENT_TIMESTAMP
           RETURNING *""",
        (poll_id, user_id, response)
    )
    row = cursor.fetchone()
    conn.commit()
    conn.close()
    return dict(row)


def get_poll_responses(poll_id: int) -> List[dict]:
    """Get all responses for a poll."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM group_poll_responses WHERE poll_id = %s", (poll_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_poll_response(poll_id: int, user_id: int) -> Optional[dict]:
    """Get a specific user's response for a poll."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM group_poll_responses WHERE poll_id = %s AND user_id = %s",
        (poll_id, user_id)
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def close_poll(poll_id: int) -> bool:
    """Close a poll."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE group_polls SET status = 'closed' WHERE id = %s AND status = 'open'",
        (poll_id,)
    )
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


def convert_poll(poll_id: int, event_id: int) -> bool:
    """Mark poll as converted and link to the created event."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE group_polls SET status = 'converted', converted_event_id = %s WHERE id = %s",
        (event_id, poll_id)
    )
    success = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return success


def auto_close_expired_polls() -> int:
    """Close open polls that have passed their deadline. Returns count closed."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE group_polls SET status = 'closed' WHERE status = 'open' AND deadline < CURRENT_TIMESTAMP"
    )
    count = cursor.rowcount
    conn.commit()
    conn.close()
    return count


# ===== Invite Code Utilities =====

import re as _re

def _generate_code_str(group_name: str) -> str:
    """Generate XXX-0000 code: 3 random letters + random 4-digit number."""
    prefix = ''.join(random.choices(string.ascii_uppercase, k=3))
    suffix = str(random.randint(1000, 9999))
    return f"{prefix}-{suffix}"


def generate_unique_code(group_name: str) -> str:
    """Generate a collision-free invite code."""
    conn = get_db()
    cursor = conn.cursor()
    for _ in range(20):
        code = _generate_code_str(group_name)
        cursor.execute("SELECT id FROM invite_codes WHERE code = %s", (code,))
        if not cursor.fetchone():
            conn.close()
            return code
    conn.close()
    raise ValueError("Could not generate unique invite code")


def create_invite_code(group_id: int, group_name: str, join_behavior: str,
                       expiry_type: str = "never", expiry_days: int = None) -> dict:
    """Create a new invite code (latest row = active code)."""
    from datetime import timezone, timedelta
    conn = get_db()
    cursor = conn.cursor()
    code = generate_unique_code(group_name)
    expires_at = None
    if expiry_type == "days" and expiry_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=expiry_days)
    cursor.execute("""
        INSERT INTO invite_codes (group_id, code, join_behavior, expiry_type, expiry_days, expires_at)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING *
    """, (group_id, code, join_behavior, expiry_type, expiry_days, expires_at))
    row = dict(cursor.fetchone())
    conn.commit()
    conn.close()
    return row


def get_active_invite_code(group_id: int) -> Optional[dict]:
    """Return the most recently created invite code for the group."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM invite_codes WHERE group_id = %s
        ORDER BY created_at DESC LIMIT 1
    """, (group_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_invite_code_by_code(code: str) -> Optional[dict]:
    """Lookup invite code row by code string."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT ic.*, g.name AS group_name, g.activity_type,
               (SELECT COUNT(*) FROM group_members WHERE group_id = ic.group_id) AS member_count,
               ic.id = (SELECT id FROM invite_codes WHERE group_id = ic.group_id ORDER BY created_at DESC LIMIT 1) AS is_active
        FROM invite_codes ic
        JOIN groups g ON g.id = ic.group_id
        WHERE ic.code = %s
    """, (code,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def validate_invite_code(code: str) -> dict:
    """Returns {valid, error?, row?}."""
    from datetime import timezone
    if not code:
        return {"valid": False, "error": "No code provided"}
    row = get_invite_code_by_code(code)
    if not row:
        return {"valid": False, "error": "Invalid code"}
    if not row.get("is_active"):
        return {"valid": False, "error": "This invite link has been replaced"}
    if row.get("expiry_type") == "days" and row.get("expires_at"):
        exp = row["expires_at"]
        if exp.tzinfo is None:
            from datetime import timezone as _tz
            exp = exp.replace(tzinfo=_tz.utc)
        if exp < datetime.now(timezone.utc):
            return {"valid": False, "error": "This invite has expired"}
    return {"valid": True, "row": row}


def increment_invite_used_count(invite_code_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE invite_codes SET used_count = used_count + 1 WHERE id = %s", (invite_code_id,))
    conn.commit()
    conn.close()


# ===== Join Requests =====

def create_join_request(group_id: int, user_id: int, invite_code_id: int) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO join_requests (group_id, user_id, invite_code_id)
        VALUES (%s, %s, %s) RETURNING *
    """, (group_id, user_id, invite_code_id))
    row = dict(cursor.fetchone())
    conn.commit()
    conn.close()
    return row


def get_pending_join_requests(group_id: int) -> list:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM join_requests WHERE group_id = %s AND status = 'pending'
        ORDER BY requested_at ASC
    """, (group_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_join_request(request_id: int) -> Optional[dict]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM join_requests WHERE id = %s", (request_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_pending_join_request_by_user(group_id: int, user_id: int) -> Optional[dict]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM join_requests WHERE group_id = %s AND user_id = %s AND status = 'pending'
    """, (group_id, user_id))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def update_join_request(request_id: int, status: str, reviewed_by: int) -> Optional[dict]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE join_requests
        SET status = %s, reviewed_at = NOW(), reviewed_by = %s
        WHERE id = %s RETURNING *
    """, (status, reviewed_by, request_id))
    row = cursor.fetchone()
    conn.commit()
    conn.close()
    return dict(row) if row else None


def get_pending_join_requests_count(group_id: int) -> int:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) AS cnt FROM join_requests WHERE group_id = %s AND status = 'pending'", (group_id,))
    row = cursor.fetchone()
    conn.close()
    return row["cnt"] if row else 0


