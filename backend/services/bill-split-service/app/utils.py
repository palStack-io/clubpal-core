from decimal import Decimal, ROUND_HALF_UP


def compute_shares(
    items: list[dict],
    tax: float,
    tip: float,
    attending_user_ids: list[int],
    paid_by_user_id: int,
) -> list[dict]:
    """
    Rules:
    1. Tax and tip split EQUALLY. Last member absorbs rounding remainder.
    2. Unassigned items (assigned_to=[]) split EQUALLY. Last member absorbs remainder.
    3. Payer's share marked paid=True automatically.
    """
    count = len(attending_user_ids)
    if count == 0:
        return []

    two = Decimal("0.01")

    def to_d(v):
        return Decimal(str(v))

    tax_d = to_d(tax)
    tip_d = to_d(tip)

    tax_per = (tax_d / count).quantize(two, ROUND_HALF_UP)
    tip_per = (tip_d / count).quantize(two, ROUND_HALF_UP)
    tax_remainder = tax_d - tax_per * (count - 1)
    tip_remainder = tip_d - tip_per * (count - 1)

    unassigned_total = sum(to_d(i["price"]) for i in items if not i.get("assigned_to"))
    unassigned_per = (
        (unassigned_total / count).quantize(two, ROUND_HALF_UP)
        if unassigned_total
        else Decimal("0")
    )
    unassigned_remainder = unassigned_total - unassigned_per * (count - 1)

    shares = []
    for idx, uid in enumerate(attending_user_ids):
        is_last = idx == count - 1
        assigned = sum(
            to_d(i["price"])
            for i in items
            if uid in (i.get("assigned_to") or [])
        )
        items_sub = assigned + (unassigned_remainder if is_last else unassigned_per)
        t_share = tax_remainder if is_last else tax_per
        tp_share = tip_remainder if is_last else tip_per
        total = items_sub + t_share + tp_share
        shares.append(
            {
                "user_id": uid,
                "items_subtotal": float(items_sub.quantize(two)),
                "tax_share": float(t_share.quantize(two)),
                "tip_share": float(tp_share.quantize(two)),
                "total_owed": float(total.quantize(two)),
                "paid": uid == paid_by_user_id,
            }
        )
    return shares
