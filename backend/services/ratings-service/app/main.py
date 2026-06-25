from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import ENCODERS_BY_TYPE
from typing import List, Optional
from datetime import datetime
ENCODERS_BY_TYPE[datetime] = lambda dt: dt.strftime('%Y-%m-%dT%H:%M:%SZ') if dt else None
import httpx
import os
import logging

logger = logging.getLogger(__name__)

from app.models import (
    RatingCreate, RatingUpdate, RatingResponse,
    UserStatsResponse, EventStatsResponse,
    GroupLeaderboardResponse, LeaderboardEntry
)
from app.database import (
    init_db, create_rating, get_rating, get_rating_by_event_and_rater,
    get_ratings_for_event, get_ratings_by_rater, get_ratings_for_user,
    update_rating, delete_rating, get_user_stats, get_event_stats,
    get_group_leaderboard, increment_hosted_events, get_group_event_avg_rating
)

app = FastAPI(title="ClubPal Ratings Service", version="1.0.0")

# CORS
_CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://localhost").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service URLs
GROUPS_SERVICE_URL = os.getenv("GROUPS_SERVICE_URL", "http://groups-service:8002")
EVENTS_SERVICE_URL = os.getenv("EVENTS_SERVICE_URL", "http://events-service:8003")
GATEWAY_URL = os.getenv("GATEWAY_URL", "http://api-gateway:8001")
INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET", "")


def get_current_user_id(authorization: Optional[str] = Header(None)) -> int:
    """Validate Bearer token against gateway and return the authenticated user's ID."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization")
    try:
        r = httpx.get(
            f"{GATEWAY_URL}/auth/me",
            headers={"Authorization": authorization},
            timeout=5.0,
        )
        if r.status_code == 200:
            return r.json()["id"]
    except Exception:
        logger.warning("Could not reach gateway for auth validation")
    raise HTTPException(status_code=401, detail="Invalid or expired session")


@app.on_event("startup")
async def startup():
    """Initialize database on startup."""
    init_db()
    print("Ratings service started")


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "ratings-service"}


# ===== Rating Endpoints =====

@app.post("/ratings", response_model=RatingResponse, status_code=201)
async def create_rating_endpoint(
    rating_data: RatingCreate,
    authorization: Optional[str] = Header(None),
    user_id: int = Depends(get_current_user_id),
):
    """Create a new rating."""
    # Verify event exists and is rateable via events service
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{EVENTS_SERVICE_URL}/events/{rating_data.event_id}",
                headers={"Authorization": authorization} if authorization else {},
            )
            if response.status_code != 200:
                raise HTTPException(status_code=404, detail="Event not found")
            event = response.json()
            status = event.get("status")
            scheduled = event.get("scheduled_date")
            started = (
                status in ("completed", "in_progress")
                or (status == "scheduled" and scheduled and scheduled < datetime.utcnow().isoformat())
            )
            if not started:
                raise HTTPException(status_code=403, detail="Ratings open once the event starts")
            if not event.get("ratings_enabled", False):
                raise HTTPException(status_code=403, detail="Ratings are not enabled for this event")
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail="Events service unavailable")

    # Check if rating already exists (one per user per event)
    existing = get_rating_by_event_and_rater(rating_data.event_id, user_id)
    if existing:
        raise HTTPException(status_code=400, detail="Rating already exists for this event and user")

    # Create rating
    try:
        rating_id = create_rating(
            event_id=rating_data.event_id,
            rater_user_id=user_id,
            rated_user_id=rating_data.rated_user_id,
            score=rating_data.score,
            comment=rating_data.comment,
            tags=rating_data.tags
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    rating = get_rating(rating_id)
    return RatingResponse(**rating)


@app.get("/ratings/{rating_id}", response_model=RatingResponse)
async def get_rating_endpoint(rating_id: int):
    """Get a specific rating."""
    rating = get_rating(rating_id)

    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")

    return RatingResponse(**rating)


@app.get("/events/{event_id}/ratings", response_model=List[RatingResponse])
async def get_event_ratings(event_id: int):
    """Get all ratings for an event."""
    ratings = get_ratings_for_event(event_id)
    return [RatingResponse(**rating) for rating in ratings]


@app.get("/users/{user_id}/ratings", response_model=List[RatingResponse])
async def get_user_ratings(user_id: int):
    """Get all ratings received by a user (alias for /received)."""
    ratings = get_ratings_for_user(user_id)
    return [RatingResponse(**rating) for rating in ratings]


@app.get("/users/{user_id}/ratings/given", response_model=List[RatingResponse])
async def get_user_ratings_given(user_id: int):
    """Get all ratings given by a user."""
    ratings = get_ratings_by_rater(user_id)
    return [RatingResponse(**rating) for rating in ratings]


@app.get("/users/{user_id}/ratings/received", response_model=List[RatingResponse])
async def get_user_ratings_received(user_id: int):
    """Get all ratings received by a user."""
    ratings = get_ratings_for_user(user_id)
    return [RatingResponse(**rating) for rating in ratings]


@app.patch("/ratings/{rating_id}", response_model=RatingResponse)
async def update_rating_endpoint(rating_id: int, rating_data: RatingUpdate, user_id: int = Depends(get_current_user_id)):
    """Update a rating."""
    # Get existing rating
    rating = get_rating(rating_id)

    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")

    # Only the rater can update
    if rating["rater_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this rating")

    # Update rating
    success = update_rating(
        rating_id,
        score=rating_data.score,
        comment=rating_data.comment,
        tags=rating_data.tags,
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update rating")

    rating = get_rating(rating_id)
    return RatingResponse(**rating)


@app.delete("/ratings/{rating_id}", status_code=204)
async def delete_rating_endpoint(rating_id: int, user_id: int = Depends(get_current_user_id)):
    """Delete a rating."""
    # Get existing rating
    rating = get_rating(rating_id)

    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")

    # Only the rater can delete
    if rating["rater_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this rating")

    success = delete_rating(rating_id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete rating")


# ===== Statistics Endpoints =====

@app.get("/users/{user_id}/stats", response_model=UserStatsResponse)
async def get_user_stats_endpoint(user_id: int):
    """Get rating statistics for a user."""
    stats = get_user_stats(user_id)

    if not stats:
        # Return default stats
        return UserStatsResponse(
            user_id=user_id,
            total_ratings=0,
            average_score=0.0,
            score_1_count=0,
            score_2_count=0,
            score_3_count=0,
            score_4_count=0,
            score_5_count=0,
            total_hosted_events=0
        )

    return UserStatsResponse(**stats)


@app.get("/events/{event_id}/stats", response_model=EventStatsResponse)
async def get_event_stats_endpoint(event_id: int, authorization: Optional[str] = Header(None)):
    """Get rating statistics for an event."""
    # Verify event exists and get host — forward caller's auth token
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{EVENTS_SERVICE_URL}/events/{event_id}",
                headers={"Authorization": authorization} if authorization else {},
            )
            if response.status_code != 200:
                raise HTTPException(status_code=404, detail="Event not found")

            event_data = response.json()
            host_user_id = event_data.get("host_user_id")
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail="Events service unavailable")

    stats = get_event_stats(event_id)

    if not stats:
        # Return default stats
        return EventStatsResponse(
            event_id=event_id,
            total_ratings=0,
            average_score=0.0,
            host_user_id=host_user_id
        )

    stats["host_user_id"] = host_user_id
    return EventStatsResponse(**stats)


@app.get("/groups/{group_id}/leaderboard", response_model=GroupLeaderboardResponse)
async def get_group_leaderboard_endpoint(group_id: int, event_ids: Optional[str] = None):
    """Get leaderboard for a group.

    event_ids: optional comma-separated event IDs to compute group avg rating.
    When provided the ratings service skips the inter-service call to events service.
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{GROUPS_SERVICE_URL}/groups/{group_id}/members")
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Group not found")
            if response.status_code != 200:
                raise HTTPException(status_code=503, detail="Groups service unavailable")
            members = response.json()
            member_ids = [member["user_id"] for member in members]
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail="Groups service unavailable")

        # Resolve event IDs: prefer caller-supplied list, fall back to events service
        parsed_event_ids: List[int] = []
        if event_ids:
            parsed_event_ids = [int(x) for x in event_ids.split(",") if x.strip().isdigit()]
        else:
            try:
                ev_resp = await client.get(f"{EVENTS_SERVICE_URL}/groups/{group_id}/events")
                if ev_resp.status_code == 200:
                    parsed_event_ids = [e["id"] for e in ev_resp.json() if e.get("id")]
            except httpx.RequestError:
                pass

    leaderboard_data = get_group_leaderboard(group_id, member_ids)
    leaderboard = [LeaderboardEntry(**entry) for entry in leaderboard_data]
    group_avg_rating = get_group_event_avg_rating(parsed_event_ids) if parsed_event_ids else None

    return GroupLeaderboardResponse(
        group_id=group_id,
        leaderboard=leaderboard,
        group_avg_rating=group_avg_rating,
    )


@app.post("/users/{user_id}/hosted-events/increment", status_code=200)
async def increment_hosted_events_endpoint(user_id: int, x_internal_secret: Optional[str] = Header(None)):
    """Increment hosted events count for a user (called by events service)."""
    if not INTERNAL_API_SECRET or x_internal_secret != INTERNAL_API_SECRET:
        raise HTTPException(status_code=403, detail="Internal access only")
    increment_hosted_events(user_id)
    return {"message": "Hosted events count incremented"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
