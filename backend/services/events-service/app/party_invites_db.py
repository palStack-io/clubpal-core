# Party invite DB layer — tables and CRUD.
import os
from typing import Optional
from app.database import get_db


def init_party_invite_tables():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS party_invites (
            id                  SERIAL PRIMARY KEY,
            event_id            INTEGER UNIQUE NOT NULL,
            token               VARCHAR(32) UNIQUE NOT NULL,
            host_user_id        INTEGER NOT NULL,
            theme_activity_type VARCHAR(50) DEFAULT 'other',
            theme_variant       VARCHAR(50) DEFAULT 'default',
            bg_animation        VARCHAR(50) DEFAULT 'confetti',
            accent_color        VARCHAR(20),
            cover_image_url     TEXT,
            sticker_data        JSONB DEFAULT '[]',
            bring_list_enabled  BOOLEAN DEFAULT FALSE,
            bring_list_type     VARCHAR(20) DEFAULT 'freeform',
            view_count          INTEGER DEFAULT 0,
            created_at          TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS party_invite_groups (
            id               SERIAL PRIMARY KEY,
            party_invite_id  INTEGER NOT NULL REFERENCES party_invites(id) ON DELETE CASCADE,
            group_id         INTEGER NOT NULL,
            UNIQUE(party_invite_id, group_id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS party_invite_items (
            id               SERIAL PRIMARY KEY,
            party_invite_id  INTEGER NOT NULL REFERENCES party_invites(id) ON DELETE CASCADE,
            label            VARCHAR(200) NOT NULL,
            emoji            VARCHAR(10) DEFAULT '',
            max_claims       INTEGER DEFAULT 1,
            sort_order       INTEGER DEFAULT 0
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS party_invite_guests (
            id                 SERIAL PRIMARY KEY,
            party_invite_id    INTEGER NOT NULL REFERENCES party_invites(id) ON DELETE CASCADE,
            name               VARCHAR(200) NOT NULL,
            email              VARCHAR(255) NOT NULL,
            rsvp_status        VARCHAR(20) DEFAULT 'going',
            bring_note         TEXT,
            claim_item_id      INTEGER REFERENCES party_invite_items(id) ON DELETE SET NULL,
            account_nudge_sent BOOLEAN DEFAULT FALSE,
            created_at         TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS party_invite_item_claims (
            id               SERIAL PRIMARY KEY,
            item_id          INTEGER NOT NULL REFERENCES party_invite_items(id) ON DELETE CASCADE,
            clubpal_user_id  INTEGER,
            guest_id         INTEGER REFERENCES party_invite_guests(id) ON DELETE CASCADE,
            note             VARCHAR(500)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS party_invite_views (
            id               SERIAL PRIMARY KEY,
            party_invite_id  INTEGER NOT NULL REFERENCES party_invites(id) ON DELETE CASCADE,
            fingerprint      VARCHAR(128) NOT NULL,
            viewed_at        TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(party_invite_id, fingerprint)
        )
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pi_token ON party_invites(token)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pi_event ON party_invites(event_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pig_invite ON party_invite_groups(party_invite_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_piguests_invite ON party_invite_guests(party_invite_id)")

    conn.commit()
    conn.close()


def create_party_invite(event_id: int, host_user_id: int, token: str,
                        theme_activity_type: str = "other", theme_variant: str = "default",
                        bg_animation: str = "confetti", accent_color: str = None,
                        bring_list_enabled: bool = False, bring_list_type: str = "freeform",
                        group_ids: list = None) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO party_invites
            (event_id, host_user_id, token, theme_activity_type, theme_variant,
             bg_animation, accent_color, bring_list_enabled, bring_list_type)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
    """, (event_id, host_user_id, token, theme_activity_type, theme_variant,
          bg_animation, accent_color, bring_list_enabled, bring_list_type))
    invite = dict(cursor.fetchone())
    if group_ids:
        for gid in group_ids:
            try:
                cursor.execute(
                    "INSERT INTO party_invite_groups (party_invite_id, group_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (invite["id"], gid)
                )
            except Exception:
                pass
    conn.commit()
    conn.close()
    return invite


def get_party_invite_by_token(token: str) -> Optional[dict]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM party_invites WHERE token = %s", (token,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_party_invite_by_event_id(event_id: int) -> Optional[dict]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM party_invites WHERE event_id = %s", (event_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def update_party_invite(token: str, **kwargs) -> Optional[dict]:
    allowed = {
        "theme_activity_type", "theme_variant", "bg_animation", "accent_color",
        "cover_image_url", "sticker_data", "bring_list_enabled", "bring_list_type",
    }
    updates = {k: v for k, v in kwargs.items() if k in allowed and v is not None}
    if not updates:
        return get_party_invite_by_token(token)
    conn = get_db()
    cursor = conn.cursor()
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    params = list(updates.values()) + [token]
    cursor.execute(f"UPDATE party_invites SET {set_clause} WHERE token = %s RETURNING *", params)
    row = cursor.fetchone()
    conn.commit()
    conn.close()
    return dict(row) if row else None


def add_group_to_invite(party_invite_id: int, group_id: int) -> None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO party_invite_groups (party_invite_id, group_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (party_invite_id, group_id)
    )
    conn.commit()
    conn.close()


def get_invite_groups(party_invite_id: int) -> list:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM party_invite_groups WHERE party_invite_id = %s", (party_invite_id,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


def create_guest_rsvp(party_invite_id: int, name: str, email: str,
                      status: str = "going", bring_note: str = None,
                      claim_item_id: int = None) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    # Upsert: if same email already RSVPd, return existing record
    cursor.execute(
        "SELECT * FROM party_invite_guests WHERE party_invite_id = %s AND email = %s",
        (party_invite_id, email.strip().lower())
    )
    existing = cursor.fetchone()
    if existing:
        conn.close()
        return dict(existing)
    cursor.execute("""
        INSERT INTO party_invite_guests
            (party_invite_id, name, email, rsvp_status, bring_note, claim_item_id)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING *
    """, (party_invite_id, name.strip(), email.strip().lower(), status, bring_note, claim_item_id))
    row = dict(cursor.fetchone())
    conn.commit()
    conn.close()
    return row


def get_guest_rsvp(guest_id: int) -> Optional[dict]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM party_invite_guests WHERE id = %s", (guest_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def update_guest_rsvp(guest_id: int, **kwargs) -> Optional[dict]:
    allowed = {"rsvp_status", "bring_note", "claim_item_id"}
    updates = {k: v for k, v in kwargs.items() if k in allowed}
    if not updates:
        return get_guest_rsvp(guest_id)
    conn = get_db()
    cursor = conn.cursor()
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    params = list(updates.values()) + [guest_id]
    cursor.execute(f"UPDATE party_invite_guests SET {set_clause} WHERE id = %s RETURNING *", params)
    row = cursor.fetchone()
    conn.commit()
    conn.close()
    return dict(row) if row else None


def get_all_guests(party_invite_id: int) -> list:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM party_invite_guests WHERE party_invite_id = %s ORDER BY created_at ASC",
        (party_invite_id,)
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


def create_invite_item(party_invite_id: int, label: str, emoji: str = "",
                       max_claims: int = 1, sort_order: int = 0) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO party_invite_items (party_invite_id, label, emoji, max_claims, sort_order)
        VALUES (%s, %s, %s, %s, %s) RETURNING *
    """, (party_invite_id, label.strip(), emoji, max_claims, sort_order))
    row = dict(cursor.fetchone())
    conn.commit()
    conn.close()
    return row


def delete_invite_item(item_id: int, party_invite_id: int) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM party_invite_items WHERE id = %s AND party_invite_id = %s",
        (item_id, party_invite_id)
    )
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def get_invite_items(party_invite_id: int) -> list:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM party_invite_items WHERE party_invite_id = %s ORDER BY sort_order ASC, id ASC",
        (party_invite_id,)
    )
    items = [dict(r) for r in cursor.fetchall()]
    for item in items:
        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM party_invite_item_claims WHERE item_id = %s",
            (item["id"],)
        )
        item["claim_count"] = int(cursor.fetchone()["cnt"])
    conn.close()
    return items


def claim_item(item_id: int, clubpal_user_id: int = None, guest_id: int = None,
               note: str = None) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT max_claims FROM party_invite_items WHERE id = %s", (item_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise ValueError("Item not found")
    cursor.execute("SELECT COUNT(*) AS cnt FROM party_invite_item_claims WHERE item_id = %s", (item_id,))
    if int(cursor.fetchone()["cnt"]) >= row["max_claims"]:
        conn.close()
        raise ValueError("Item fully claimed")
    cursor.execute("""
        INSERT INTO party_invite_item_claims (item_id, clubpal_user_id, guest_id, note)
        VALUES (%s, %s, %s, %s) RETURNING *
    """, (item_id, clubpal_user_id, guest_id, note))
    claim = dict(cursor.fetchone())
    conn.commit()
    conn.close()
    return claim


def get_item_claims(item_id: int) -> list:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM party_invite_item_claims WHERE item_id = %s", (item_id,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


def increment_view_count(party_invite_id: int, fingerprint: str) -> None:
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO party_invite_views (party_invite_id, fingerprint) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (party_invite_id, fingerprint)
        )
        if cursor.rowcount > 0:
            cursor.execute(
                "UPDATE party_invites SET view_count = view_count + 1 WHERE id = %s",
                (party_invite_id,)
            )
        conn.commit()
    except Exception:
        pass
    finally:
        conn.close()
