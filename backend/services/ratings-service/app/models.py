from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# Rating models
class RatingCreate(BaseModel):
    event_id: int
    rated_user_id: int
    score: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=500)


class RatingUpdate(BaseModel):
    score: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=500)


class RatingResponse(BaseModel):
    id: int
    event_id: int
    rater_user_id: int
    rated_user_id: int
    score: int
    comment: Optional[str]
    created_at: datetime
    updated_at: datetime


# User stats models
class UserStatsResponse(BaseModel):
    user_id: int
    total_ratings: int
    average_score: float
    score_1_count: int
    score_2_count: int
    score_3_count: int
    score_4_count: int
    score_5_count: int
    total_hosted_events: int


# Event stats models
class EventStatsResponse(BaseModel):
    event_id: int
    total_ratings: int
    average_score: float
    host_user_id: int


# Group leaderboard models
class LeaderboardEntry(BaseModel):
    user_id: int
    total_ratings: int
    average_score: float
    total_hosted_events: int
    rank: int


class GroupLeaderboardResponse(BaseModel):
    group_id: int
    leaderboard: list[LeaderboardEntry]
