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
    label: Optional[str] = None  # e.g. "Dinner", "Bar tab"


class BillItemResponse(BaseModel):
    id: int
    name: str
    price: float
    assigned_to: list[int]


class ClaimItemResponse(BaseModel):
    id: int
    name: str
    price: float
    assigned_to: list[int]
    claimed_by_names: list[str]  # other users who have already submitted a claim for this item


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
    round_number: int = 1
    label: Optional[str] = None
    paid_by_user_id: int
    paid_by_name: str
    subtotal: float
    tax_amount: float
    tip_amount: float
    total_amount: float
    payment_note: Optional[str]
    status: str
    claim_token: Optional[str] = None
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


class StartClaimingResponse(BaseModel):
    claim_token: str
    claim_url: str


class ClaimItemsRequest(BaseModel):
    claimed_items: list[int]  # list of item IDs this user claims


class ClaimStatusMember(BaseModel):
    user_id: int
    full_name: str
    avatar_url: Optional[str]
    submitted: bool
    submitted_at: Optional[str]
    claimed_items: list[int]


class ClaimStatusResponse(BaseModel):
    split_id: int
    status: str  # 'claiming'
    claim_token: str
    claim_url: str
    total_members: int
    submitted_count: int
    members: list[ClaimStatusMember]


class ClaimViewResponse(BaseModel):
    split_id: int
    event_id: int
    event_name: str
    payer_name: str
    payment_note: Optional[str]
    items: list[ClaimItemResponse]
    tax_amount: float
    tip_amount: float
    total_amount: float
    # current user's existing claim (if any)
    my_claimed_items: list[int]
    already_submitted: bool
