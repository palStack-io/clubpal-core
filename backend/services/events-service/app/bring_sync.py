"""
Unified bring-list logic shared by the event page and the public party invite.

Item definitions live in two mirrored tables — event_bring_items (canonical) and
party_invite_items — linked by party_invite_items.event_item_id. Claims for BOTH
surfaces live in one table, event_bring_item_claims, keyed on the event item, so
clubPal members and external guests draw down a single shared capacity (max_claims).

This module is the single seam for create / update / delete / claim so the two
surfaces never drift. It imports from both database.py and party_invites_db.py;
neither of those imports this module, so there is no circular import.
"""
from typing import Optional

from app.database import (
    get_db, get_event_bring_items, create_event_bring_item,
    update_event_bring_item, delete_event_bring_item, update_event,
)
from app.party_invites_db import get_party_invite_by_event_id, delete_invite_item


# ── Item definition sync (event-anchored) ────────────────────────────────────

def create_linked_item(event_id: int, label: str, emoji: str = "",
                       max_claims: int = 1, sort_order: Optional[int] = None) -> dict:
    """Create a canonical event item and, if the event has a party invite, a
    linked mirror invite item. Returns the event item (with claim info)."""
    if sort_order is None:
        sort_order = len(get_event_bring_items(event_id))
    ev = create_event_bring_item(event_id, label, emoji, max_claims, sort_order)
    invite = get_party_invite_by_event_id(event_id)
    if invite:
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO party_invite_items
                       (party_invite_id, label, emoji, max_claims, sort_order, event_item_id)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (invite["id"], (label or "").strip(), emoji or "", max_claims or 1, sort_order, ev["id"])
            )
            conn.commit()
    return next((it for it in get_event_bring_items(event_id) if it["id"] == ev["id"]), ev)


def update_linked_item(event_id: int, event_item_id: int, label: str = None,
                       emoji: str = None, max_claims: int = None) -> Optional[dict]:
    """Update the canonical event item and propagate label/emoji/max_claims to the
    mirrored invite item."""
    row = update_event_bring_item(event_id, event_item_id, label=label, emoji=emoji, max_claims=max_claims)
    if row is None:
        return None
    sets, params = [], []
    if label is not None:
        sets.append("label = %s"); params.append(label)
    if emoji is not None:
        sets.append("emoji = %s"); params.append(emoji)
    if max_claims is not None:
        sets.append("max_claims = %s"); params.append(max_claims)
    if sets:
        params.append(event_item_id)
        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                f"UPDATE party_invite_items SET {', '.join(sets)} WHERE event_item_id = %s",
                tuple(params)
            )
            conn.commit()
    return row


def delete_linked_item(event_id: int, event_item_id: int) -> bool:
    """Delete the canonical event item. The mirrored invite item and all claims
    cascade away via their foreign keys."""
    return delete_event_bring_item(event_id, event_item_id)


# ── Invite-anchored wrappers (translate to the canonical event item) ──────────

def add_item_from_invite(invite: dict, label: str, emoji: str = "",
                         max_claims: int = 1, sort_order: int = 0) -> dict:
    """Add an item from the party-invite surface. Creates the linked pair and
    ensures the event's bring list is enabled. Returns the invite item row."""
    ev = create_linked_item(invite["event_id"], label, emoji, max_claims, sort_order)
    update_event(invite["event_id"], bring_list_enabled=True)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM party_invite_items WHERE event_item_id = %s", (ev["id"],))
        row = cur.fetchone()
    return dict(row) if row else {"id": None, **ev}


def delete_item_from_invite(invite: dict, invite_item_id: int) -> bool:
    """Delete an item from the party-invite surface, removing its linked event item."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT event_item_id FROM party_invite_items WHERE id = %s AND party_invite_id = %s",
            (invite_item_id, invite["id"])
        )
        r = cur.fetchone()
    if r and r["event_item_id"]:
        return delete_event_bring_item(invite["event_id"], r["event_item_id"])
    return delete_invite_item(invite_item_id, invite["id"])


def event_item_for_invite_item(invite_item_id: int, party_invite_id: int) -> Optional[int]:
    """Resolve an invite item id to its canonical event item id (scoped to the invite)."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT event_item_id FROM party_invite_items WHERE id = %s AND party_invite_id = %s",
            (invite_item_id, party_invite_id)
        )
        r = cur.fetchone()
    return r["event_item_id"] if r and r["event_item_id"] else None


# ── Claims (one shared table, per-person quantity, shared capacity) ───────────

def set_claim(event_item_id: int, *, user_id: int = None, guest_id: int = None,
              quantity: int = 1, note: str = None) -> dict:
    """Upsert one claimant's claim on an item (quantity <= 0 releases it).
    Enforces shared capacity: sum of everyone's quantity must not exceed max_claims.
    Raises ValueError on a missing item or over-claim. Returns the updated item."""
    if (user_id is None) == (guest_id is None):
        raise ValueError("Exactly one of user_id / guest_id is required")
    col = "user_id" if user_id is not None else "guest_id"
    val = user_id if user_id is not None else guest_id

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
                f"DELETE FROM event_bring_item_claims WHERE event_item_id = %s AND {col} = %s",
                (event_item_id, val)
            )
            conn.commit()
            return next((it for it in get_event_bring_items(event_id) if it["id"] == event_item_id), None)

        cur.execute(
            f"""SELECT COALESCE(SUM(quantity), 0) AS others
                FROM event_bring_item_claims
                WHERE event_item_id = %s AND ({col} IS DISTINCT FROM %s)""",
            (event_item_id, val)
        )
        others = int(cur.fetchone()["others"])
        if others + quantity > max_claims:
            raise ValueError("Not enough remaining for that quantity")

        cur.execute(
            f"SELECT id FROM event_bring_item_claims WHERE event_item_id = %s AND {col} = %s",
            (event_item_id, val)
        )
        existing = cur.fetchone()
        if existing:
            cur.execute(
                "UPDATE event_bring_item_claims SET quantity = %s, note = %s WHERE id = %s",
                (quantity, note, existing["id"])
            )
        else:
            cur.execute(
                f"""INSERT INTO event_bring_item_claims (event_item_id, {col}, quantity, note)
                    VALUES (%s, %s, %s, %s)""",
                (event_item_id, val, quantity, note)
            )
        conn.commit()
    return next((it for it in get_event_bring_items(event_id) if it["id"] == event_item_id), None)
