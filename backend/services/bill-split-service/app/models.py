from pydantic import BaseModel
from typing import Optional


class BillItemInput(BaseModel):
    name: str
    price: float
    assigned_to: list[int] = []


class CreateBillSplitRequest(BaseModel):
    event_id: int
    items: list[BillItemInput]
    tax_amount: float = 0.0
    tip_amount: float = 0.0
    payment_note: Optional[str] = None
    attending_user_ids: list[int]  # validated against events-service


class BillItemResponse(BaseModel):
    id: int
    name: str
    price: float
    assigned_to: list[int]


class BillShareResponse(BaseModel):
    user_id: int
    full_name: str
    avatar_url: Optional[str]
    items_subtotal: float
    tax_share: float
    tip_share: float
    total_owed: float
    paid: bool
    paid_at: Optional[str]


class BillSplitResponse(BaseModel):
    id: int
    event_id: int
    paid_by_user_id: int
    paid_by_name: str
    subtotal: float
    tax_amount: float
    tip_amount: float
    total_amount: float
    payment_note: Optional[str]
    status: str
    items: list[BillItemResponse]
    shares: list[BillShareResponse]
    created_at: str


class OCRStatsResponse(BaseModel):
    calls_today: int
    calls_this_month: int
    success_rate_pct: float
    avg_items_extracted: float
    avg_duration_ms: float
    high_confidence_pct: float
    estimated_cost_usd: float
    key_configured: bool
