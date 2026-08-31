"""
Bring-list logic for event bring lists: create / update / delete items,
and per-user claims against a shared capacity (max_claims).
"""
from typing import Optional

from app.database import (
    get_db, get_event_bring_items, create_event_bring_item,
    update_event_bring_item, delete_event_bring_item,
)


# ── Item definitions ──────────────────────────────────────────────────────────

def create_linked_item(event_id: int, label: str, emoji: str = "",
                       max_claims: int = 1, sort_order: Optional[int] = None) -> dict:
    """Create a bring-list item for an event. Returns the item (with claim info)."""
    if sort_order is None:
        sort_order = len(get_event_bring_items(event_id))
    ev = create_event_bring_item(event_id, label, emoji, max_claims, sort_order)
    return next((it for it in get_event_bring_items(event_id) if it["id"] == ev["id"]), ev)


def update_linked_item(event_id: int, event_item_id: int, label: str = None,
                       emoji: str = None, max_claims: int = None) -> Optional[dict]:
    """Update a bring-list item's label/emoji/max_claims."""
    return update_event_bring_item(event_id, event_item_id, label=label, emoji=emoji, max_claims=max_claims)


def delete_linked_item(event_id: int, event_item_id: int) -> bool:
    """Delete a bring-list item. Its claims cascade away via foreign key."""
    return delete_event_bring_item(event_id, event_item_id)


# ── Claims (one shared table, per-person quantity, shared capacity) ───────────

def set_claim(event_item_id: int, *, user_id: int, quantity: int = 1, note: str = None) -> dict:
    """Upsert a user's claim on an item (quantity <= 0 releases it).
    Enforces shared capacity: sum of everyone's quantity must not exceed max_claims.
    Raises ValueError on a missing item or over-claim. Returns the updated item."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT event_id, max_claims FROM event_bring_items WHERE id = %s", (event_item_id,))
        item = cur.fetchone()
        if not item:
            raise ValueError("Item not found")
        event_id = item["event_id"]
        max_claims = item["max_claims"] or 1

        if quantity <= 0:
            cur.execute(
                "DELETE FROM event_bring_item_claims WHERE event_item_id = %s AND user_id = %s",
                (event_item_id, user_id)
            )
            conn.commit()
            return next((it for it in get_event_bring_items(event_id) if it["id"] == event_item_id), None)

        cur.execute(
            """SELECT COALESCE(SUM(quantity), 0) AS others
                FROM event_bring_item_claims
                WHERE event_item_id = %s AND user_id IS DISTINCT FROM %s""",
            (event_item_id, user_id)
        )
        others = int(cur.fetchone()["others"])
        if others + quantity > max_claims:
            raise ValueError("Not enough remaining for that quantity")

        cur.execute(
            "SELECT id FROM event_bring_item_claims WHERE event_item_id = %s AND user_id = %s",
            (event_item_id, user_id)
        )
        existing = cur.fetchone()
        if existing:
            cur.execute(
                "UPDATE event_bring_item_claims SET quantity = %s, note = %s WHERE id = %s",
                (quantity, note, existing["id"])
            )
        else:
            cur.execute(
                """INSERT INTO event_bring_item_claims (event_item_id, user_id, quantity, note)
                    VALUES (%s, %s, %s, %s)""",
                (event_item_id, user_id, quantity, note)
            )
        conn.commit()
    return next((it for it in get_event_bring_items(event_id) if it["id"] == event_item_id), None)
