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
            email_opt_in       BOOLEAN DEFAULT FALSE,
            email_opt_in_at    TIMESTAMPTZ,
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

    # Migrations — safe to re-run
    cursor.execute(
        "ALTER TABLE party_invites ADD COLUMN IF NOT EXISTS style VARCHAR(20) DEFAULT 'glass'"
    )
    cursor.execute(
        "ALTER TABLE party_invite_guests ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN DEFAULT FALSE"
    )
    cursor.execute(
        "ALTER TABLE party_invite_guests ADD COLUMN IF NOT EXISTS email_opt_in_at TIMESTAMPTZ"
    )

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS party_invite_members (
            id               SERIAL PRIMARY KEY,
            party_invite_id  INTEGER NOT NULL REFERENCES party_invites(id) ON DELETE CASCADE,
            user_id          INTEGER,
            email            VARCHAR(255) NOT NULL,
            status           VARCHAR(20) DEFAULT 'pending',
            notified_at      TIMESTAMPTZ,
            created_at       TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(party_invite_id, email)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS party_invite_email_notifications (
            id               SERIAL PRIMARY KEY,
            party_invite_id  INTEGER NOT NULL REFERENCES party_invites(id) ON DELETE CASCADE,
            guest_id         INTEGER REFERENCES party_invite_guests(id) ON DELETE SET NULL,
            user_id          INTEGER,
            email            VARCHAR(255) NOT NULL,
            notification_type VARCHAR(50) NOT NULL DEFAULT 'invite',
            status           VARCHAR(20) NOT NULL DEFAULT 'pending',
            sent_at          TIMESTAMPTZ,
            last_error       TEXT,
            created_at       TIMESTAMPTZ DEFAULT NOW(),
            updated_at       TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(party_invite_id, email, notification_type)
        )
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pi_token ON party_invites(token)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pi_event ON party_invites(event_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pig_invite ON party_invite_groups(party_invite_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_piguests_invite ON party_invite_guests(party_invite_id)")
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_pim_invite ON party_invite_members(party_invite_id)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_pi_email_notifications_invite ON party_invite_email_notifications(party_invite_id)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_pi_email_notifications_status ON party_invite_email_notifications(status, notification_type)"
    )

    # Migrations
    cursor.execute(
        "ALTER TABLE party_invite_guests ADD COLUMN IF NOT EXISTS plus_ones INTEGER DEFAULT 0"
    )
    cursor.execute(
        "ALTER TABLE party_invites ADD COLUMN IF NOT EXISTS cover_image_position VARCHAR(50) DEFAULT '50% 50%'"
    )

    # ── Unified bring list ───────────────────────────────────────────────────
    # Each party_invite_item is mirrored 1:1 to a canonical event_bring_items row.
    # event_item_id links the two; claims for both surfaces live in a single
    # event_bring_item_claims table keyed on the event item (shared capacity).
    cursor.execute(
        "ALTER TABLE party_invite_items ADD COLUMN IF NOT EXISTS event_item_id "
        "INTEGER REFERENCES event_bring_items(id) ON DELETE CASCADE"
    )
    cursor.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_items_event_item "
        "ON party_invite_items(event_item_id) WHERE event_item_id IS NOT NULL"
    )

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS event_bring_item_claims (
            id              SERIAL PRIMARY KEY,
            event_item_id   INTEGER NOT NULL REFERENCES event_bring_items(id) ON DELETE CASCADE,
            user_id         INTEGER,
            guest_id        INTEGER REFERENCES party_invite_guests(id) ON DELETE CASCADE,
            quantity        INTEGER NOT NULL DEFAULT 1,
            note            VARCHAR(500),
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    cursor.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_ebic_item_user "
        "ON event_bring_item_claims(event_item_id, user_id) WHERE user_id IS NOT NULL"
    )
    cursor.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_ebic_item_guest "
        "ON event_bring_item_claims(event_item_id, guest_id) WHERE guest_id IS NOT NULL"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_ebic_item ON event_bring_item_claims(event_item_id)"
    )

    # ── Backfill: link existing party_invite_items to canonical event items ───
    # For any invite item not yet mirrored, create a matching event_bring_items
    # row, link it, and enable the event's bring list so the event page shows it.
    # INNER JOIN events so orphaned invites (event since deleted — party_invites
    # has no FK on event_id) are skipped; inserting their event_id would violate
    # the event_bring_items FK and crash startup.
    cursor.execute("""
        SELECT pii.id, pii.party_invite_id, pii.label, pii.emoji,
               pii.max_claims, pii.sort_order, pi.event_id
        FROM party_invite_items pii
        JOIN party_invites pi ON pi.id = pii.party_invite_id
        JOIN events e ON e.id = pi.event_id
        WHERE pii.event_item_id IS NULL
    """)
    for r in cursor.fetchall():
        cursor.execute(
            """INSERT INTO event_bring_items (event_id, label, emoji, max_claims, sort_order)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (r["event_id"], r["label"], r["emoji"] or "", r["max_claims"] or 1, r["sort_order"] or 0)
        )
        ev_item_id = cursor.fetchone()["id"]
        cursor.execute(
            "UPDATE party_invite_items SET event_item_id = %s WHERE id = %s",
            (ev_item_id, r["id"])
        )
        cursor.execute(
            "UPDATE events SET bring_list_enabled = TRUE WHERE id = %s",
            (r["event_id"],)
        )

    # ── Backfill: migrate legacy single-claims into the unified claims table ──
    # Idempotent — ON CONFLICT DO NOTHING against the per-claimant unique indexes.
    cursor.execute("""
        INSERT INTO event_bring_item_claims (event_item_id, user_id, quantity)
        SELECT ea.claim_item_id, ea.user_id, 1
        FROM event_attendees ea
        JOIN event_bring_items ebi ON ebi.id = ea.claim_item_id
        WHERE ea.claim_item_id IS NOT NULL
        ON CONFLICT DO NOTHING
    """)
    cursor.execute("""
        INSERT INTO event_bring_item_claims (event_item_id, guest_id, quantity)
        SELECT pii.event_item_id, g.id, 1
        FROM party_invite_guests g
        JOIN party_invite_items pii ON pii.id = g.claim_item_id
        WHERE g.claim_item_id IS NOT NULL AND pii.event_item_id IS NOT NULL
        ON CONFLICT DO NOTHING
    """)
    cursor.execute("""
        INSERT INTO event_bring_item_claims (event_item_id, user_id, guest_id, quantity, note)
        SELECT pii.event_item_id, c.clubpal_user_id, c.guest_id, 1, c.note
        FROM party_invite_item_claims c
        JOIN party_invite_items pii ON pii.id = c.item_id
        WHERE pii.event_item_id IS NOT NULL
          AND (c.clubpal_user_id IS NOT NULL OR c.guest_id IS NOT NULL)
        ON CONFLICT DO NOTHING
    """)

    conn.commit()
    conn.close()


def create_party_invite(event_id: int, host_user_id: int, token: str,
                        theme_activity_type: str = "other", theme_variant: str = "default",
                        bg_animation: str = "confetti", accent_color: str = None,
                        bring_list_enabled: bool = False, bring_list_type: str = "freeform",
                        style: str = "glass", group_ids: list = None) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO party_invites
            (event_id, host_user_id, token, theme_activity_type, theme_variant,
             bg_animation, accent_color, bring_list_enabled, bring_list_type, style)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
    """, (event_id, host_user_id, token, theme_activity_type, theme_variant,
          bg_animation, accent_color, bring_list_enabled, bring_list_type, style))
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
        "cover_image_url", "cover_image_position", "sticker_data",
        "bring_list_enabled", "bring_list_type", "style",
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
                      claim_item_id: int = None, email_opt_in: bool = False,
                      plus_ones: int = 0) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    # Upsert: if same email already RSVPd, return existing record
    cursor.execute(
        "SELECT * FROM party_invite_guests WHERE party_invite_id = %s AND email = %s",
        (party_invite_id, email.strip().lower())
    )
    existing = cursor.fetchone()
    if existing:
        cursor.execute("""
            UPDATE party_invite_guests
            SET name = %s,
                rsvp_status = %s,
                bring_note = %s,
                claim_item_id = %s,
                email_opt_in = party_invite_guests.email_opt_in OR %s,
                email_opt_in_at = CASE
                    WHEN %s AND party_invite_guests.email_opt_in_at IS NULL THEN NOW()
                    ELSE party_invite_guests.email_opt_in_at
                END
            WHERE id = %s
            RETURNING *
        """, (
            name.strip(), status, bring_note, claim_item_id,
            bool(email_opt_in), bool(email_opt_in), existing["id"],
        ))
        updated = dict(cursor.fetchone())
        conn.commit()
        conn.close()
        return updated
    cursor.execute("""
        INSERT INTO party_invite_guests
            (party_invite_id, name, email, rsvp_status, bring_note, claim_item_id, email_opt_in, email_opt_in_at, plus_ones)
        VALUES (%s, %s, %s, %s, %s, %s, %s, CASE WHEN %s THEN NOW() ELSE NULL END, %s)
        RETURNING *
    """, (
        party_invite_id, name.strip(), email.strip().lower(), status, bring_note,
        claim_item_id, bool(email_opt_in), bool(email_opt_in), int(plus_ones or 0),
    ))
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


def guest_has_rsvpd(party_invite_id: int, guest_id: int) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id FROM party_invite_guests WHERE id = %s AND party_invite_id = %s",
        (guest_id, party_invite_id)
    )
    row = cursor.fetchone()
    conn.close()
    return bool(row)


def upsert_email_notification(
    party_invite_id: int,
    email: str,
    notification_type: str = "invite",
    status: str = "pending",
    guest_id: int = None,
    user_id: int = None,
    last_error: str = None,
) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    sent_at_expr = "NOW()" if status == "sent" else "NULL"
    cursor.execute(f"""
        INSERT INTO party_invite_email_notifications
            (party_invite_id, guest_id, user_id, email, notification_type, status, sent_at, last_error)
        VALUES (%s, %s, %s, %s, %s, %s, {sent_at_expr}, %s)
        ON CONFLICT (party_invite_id, email, notification_type) DO UPDATE
            SET guest_id = COALESCE(EXCLUDED.guest_id, party_invite_email_notifications.guest_id),
                user_id = COALESCE(EXCLUDED.user_id, party_invite_email_notifications.user_id),
                status = EXCLUDED.status,
                sent_at = CASE WHEN EXCLUDED.status = 'sent' THEN NOW() ELSE party_invite_email_notifications.sent_at END,
                last_error = EXCLUDED.last_error,
                updated_at = NOW()
        RETURNING *
    """, (
        party_invite_id,
        guest_id,
        user_id,
        email.strip().lower(),
        notification_type,
        status,
        last_error,
    ))
    row = dict(cursor.fetchone())
    conn.commit()
    conn.close()
    return row


def get_email_notifications(party_invite_id: int) -> list:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT * FROM party_invite_email_notifications
           WHERE party_invite_id = %s
           ORDER BY created_at ASC""",
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
        # Unified count: sum of per-person quantities (members + guests) drawn
        # against the canonical event item's shared capacity.
        if item.get("event_item_id"):
            cursor.execute(
                "SELECT COALESCE(SUM(quantity), 0) AS cnt FROM event_bring_item_claims WHERE event_item_id = %s",
                (item["event_item_id"],)
            )
            item["claim_count"] = int(cursor.fetchone()["cnt"] or 0)
        else:
            item["claim_count"] = 0
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


def add_member_invite(party_invite_id: int, email: str,
                      user_id: int = None) -> dict:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO party_invite_members (party_invite_id, user_id, email, notified_at)
        VALUES (%s, %s, %s, NOW())
        ON CONFLICT (party_invite_id, email) DO UPDATE
            SET notified_at = NOW()
        RETURNING *
    """, (party_invite_id, user_id, email.strip().lower()))
    row = dict(cursor.fetchone())
    conn.commit()
    conn.close()
    return row


def get_member_invites(party_invite_id: int) -> list:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM party_invite_members WHERE party_invite_id = %s ORDER BY created_at ASC",
        (party_invite_id,)
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows
