import json
import os
from typing import Optional

import psycopg2
import psycopg2.extras

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://clubpal:clubpal@db:5432/clubpal_billsplit",
)


def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def init_db():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS bill_splits (
            id              SERIAL PRIMARY KEY,
            event_id        INTEGER NOT NULL UNIQUE,
            paid_by_user_id INTEGER NOT NULL,
            subtotal        NUMERIC(10,2) NOT NULL,
            tax_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
            tip_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
            total_amount    NUMERIC(10,2) NOT NULL,
            payment_note    TEXT,
            status          TEXT NOT NULL DEFAULT 'draft',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS bill_items (
            id          SERIAL PRIMARY KEY,
            split_id    INTEGER NOT NULL REFERENCES bill_splits(id) ON DELETE CASCADE,
            name        TEXT NOT NULL,
            price       NUMERIC(10,2) NOT NULL,
            assigned_to JSONB NOT NULL DEFAULT '[]'
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS bill_shares (
            id              SERIAL PRIMARY KEY,
            split_id        INTEGER NOT NULL REFERENCES bill_splits(id) ON DELETE CASCADE,
            user_id         INTEGER NOT NULL,
            items_subtotal  NUMERIC(10,2) NOT NULL DEFAULT 0,
            tax_share       NUMERIC(10,2) NOT NULL DEFAULT 0,
            tip_share       NUMERIC(10,2) NOT NULL DEFAULT 0,
            total_owed      NUMERIC(10,2) NOT NULL,
            payment_token   TEXT NOT NULL UNIQUE,
            paid            BOOLEAN NOT NULL DEFAULT FALSE,
            paid_at         TIMESTAMPTZ,
            UNIQUE(split_id, user_id)
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS ocr_log (
            id          SERIAL PRIMARY KEY,
            called_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            event_id    INTEGER,
            user_id     INTEGER,
            success     BOOLEAN NOT NULL,
            item_count  INTEGER,
            confidence  TEXT,
            error_msg   TEXT,
            duration_ms INTEGER
        )
    """)

    cur.execute("ALTER TABLE bill_splits ADD COLUMN IF NOT EXISTS claim_token TEXT UNIQUE")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS bill_claims (
            id           SERIAL PRIMARY KEY,
            split_id     INTEGER NOT NULL REFERENCES bill_splits(id) ON DELETE CASCADE,
            user_id      INTEGER NOT NULL,
            claimed_items JSONB NOT NULL DEFAULT '[]',
            submitted_at TIMESTAMPTZ,
            UNIQUE(split_id, user_id)
        )
    """)

    cur.execute("CREATE INDEX IF NOT EXISTS idx_bill_splits_event ON bill_splits(event_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_bill_items_split ON bill_items(split_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_bill_shares_split ON bill_shares(split_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_bill_shares_token ON bill_shares(payment_token)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_ocr_log_called_at ON ocr_log(called_at)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_bill_claims_split ON bill_claims(split_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_bill_splits_claim_token ON bill_splits(claim_token)")

    conn.commit()
    cur.close()
    conn.close()


def create_bill_split(
    event_id: int,
    paid_by_user_id: int,
    subtotal: float,
    tax_amount: float,
    tip_amount: float,
    total_amount: float,
    payment_note: Optional[str],
) -> dict:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO bill_splits
            (event_id, paid_by_user_id, subtotal, tax_amount, tip_amount,
             total_amount, payment_note)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (event_id, paid_by_user_id, subtotal, tax_amount, tip_amount,
         total_amount, payment_note),
    )
    row = dict(cur.fetchone())
    conn.commit()
    cur.close()
    conn.close()
    return row


def create_bill_item(
    split_id: int,
    name: str,
    price: float,
    assigned_to: list,
) -> dict:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO bill_items (split_id, name, price, assigned_to)
        VALUES (%s, %s, %s, %s)
        RETURNING *
        """,
        (split_id, name, price, json.dumps(assigned_to)),
    )
    row = dict(cur.fetchone())
    conn.commit()
    cur.close()
    conn.close()
    row["assigned_to"] = row["assigned_to"] if isinstance(row["assigned_to"], list) else json.loads(row["assigned_to"])
    return row


def create_bill_share(
    split_id: int,
    user_id: int,
    items_subtotal: float,
    tax_share: float,
    tip_share: float,
    total_owed: float,
    payment_token: str,
    paid: bool,
) -> dict:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO bill_shares
            (split_id, user_id, items_subtotal, tax_share, tip_share,
             total_owed, payment_token, paid)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (split_id, user_id, items_subtotal, tax_share, tip_share,
         total_owed, payment_token, paid),
    )
    row = dict(cur.fetchone())
    conn.commit()
    cur.close()
    conn.close()
    return row


def get_split_by_event(event_id: int) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM bill_splits WHERE event_id = %s", (event_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def get_split_by_id(split_id: int) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM bill_splits WHERE id = %s", (split_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def get_items_by_split(split_id: int) -> list:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM bill_items WHERE split_id = %s ORDER BY id", (split_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        if not isinstance(d.get("assigned_to"), list):
            d["assigned_to"] = json.loads(d["assigned_to"]) if d["assigned_to"] else []
        result.append(d)
    return result


def get_shares_by_split(split_id: int) -> list:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM bill_shares WHERE split_id = %s ORDER BY id", (split_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [dict(r) for r in rows]


def get_share_by_token(payment_token: str) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM bill_shares WHERE payment_token = %s", (payment_token,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def get_share_by_split_user(split_id: int, user_id: int) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT * FROM bill_shares WHERE split_id = %s AND user_id = %s",
        (split_id, user_id),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def mark_share_paid(share_id: int) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "UPDATE bill_shares SET paid = TRUE, paid_at = NOW() WHERE id = %s",
        (share_id,),
    )
    conn.commit()
    cur.close()
    conn.close()


def update_split_status(split_id: int, status: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "UPDATE bill_splits SET status = %s, updated_at = NOW() WHERE id = %s",
        (status, split_id),
    )
    conn.commit()
    cur.close()
    conn.close()


def log_ocr(
    event_id: Optional[int],
    user_id: Optional[int],
    success: bool,
    item_count: Optional[int] = None,
    confidence: Optional[str] = None,
    error_msg: Optional[str] = None,
    duration_ms: Optional[int] = None,
) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO ocr_log
            (event_id, user_id, success, item_count, confidence, error_msg, duration_ms)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (event_id, user_id, success, item_count, confidence, error_msg, duration_ms),
    )
    conn.commit()
    cur.close()
    conn.close()


def set_claim_token(split_id: int, token: str) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "UPDATE bill_splits SET claim_token = %s, updated_at = NOW() WHERE id = %s",
        (token, split_id),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_split_by_claim_token(claim_token: str) -> Optional[dict]:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM bill_splits WHERE claim_token = %s", (claim_token,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def submit_claim(split_id: int, user_id: int, claimed_items: list) -> dict:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO bill_claims (split_id, user_id, claimed_items, submitted_at)
        VALUES (%s, %s, %s, NOW())
        ON CONFLICT (split_id, user_id) DO UPDATE
            SET claimed_items = EXCLUDED.claimed_items,
                submitted_at = NOW()
        RETURNING *
        """,
        (split_id, user_id, json.dumps(claimed_items)),
    )
    row = dict(cur.fetchone())
    conn.commit()
    cur.close()
    conn.close()
    if not isinstance(row.get("claimed_items"), list):
        row["claimed_items"] = json.loads(row["claimed_items"]) if row["claimed_items"] else []
    return row


def get_claims_by_split(split_id: int) -> list:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM bill_claims WHERE split_id = %s ORDER BY id", (split_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        if not isinstance(d.get("claimed_items"), list):
            d["claimed_items"] = json.loads(d["claimed_items"]) if d["claimed_items"] else []
        result.append(d)
    return result


def apply_claims_to_items(split_id: int, item_assignments: dict) -> None:
    """item_assignments: {item_id: [user_id, ...]}"""
    conn = get_conn()
    cur = conn.cursor()
    for item_id, user_ids in item_assignments.items():
        cur.execute(
            "UPDATE bill_items SET assigned_to = %s WHERE id = %s AND split_id = %s",
            (json.dumps(user_ids), int(item_id), split_id),
        )
    conn.commit()
    cur.close()
    conn.close()


def delete_shares_by_split(split_id: int) -> None:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM bill_shares WHERE split_id = %s", (split_id,))
    conn.commit()
    cur.close()
    conn.close()


def get_ocr_stats() -> dict:
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT COUNT(*) AS calls_today
        FROM ocr_log
        WHERE called_at >= CURRENT_DATE
    """)
    calls_today = cur.fetchone()["calls_today"]

    cur.execute("""
        SELECT
            COUNT(*) AS total_count_month,
            COUNT(*) FILTER (WHERE success = TRUE) AS success_count_month,
            COALESCE(AVG(item_count) FILTER (WHERE success = TRUE), 0) AS avg_items,
            COALESCE(AVG(duration_ms) FILTER (WHERE duration_ms IS NOT NULL), 0) AS avg_duration_ms,
            COUNT(*) FILTER (WHERE confidence = 'high') AS high_confidence_count
        FROM ocr_log
        WHERE called_at >= DATE_TRUNC('month', NOW())
    """)
    row = dict(cur.fetchone())

    cur.close()
    conn.close()

    return {
        "calls_today": calls_today,
        "calls_this_month": row["total_count_month"],
        "success_count_month": row["success_count_month"],
        "total_count_month": row["total_count_month"],
        "avg_items": float(row["avg_items"]),
        "avg_duration_ms": float(row["avg_duration_ms"]),
        "high_confidence_count": row["high_confidence_count"],
    }
