from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import httpx

from app.models import (
    RatingCreate, RatingUpdate, RatingResponse,
    UserStatsResponse, EventStatsResponse,
    GroupLeaderboardResponse, LeaderboardEntry
)
from app.database import (
    init_db, create_rating, get_rating, get_rating_by_event_and_users,
    get_ratings_for_event, get_ratings_by_rater, get_ratings_for_user,
    update_rating, delete_rating, get_user_stats, get_event_stats,
    get_group_leaderboard, increment_hosted_events
)

app = FastAPI(title="ClubPal Ratings Service", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service URLs
GROUPS_SERVICE_URL = "http://groups-service:8002"
EVENTS_SERVICE_URL = "http://events-service:8003"


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
async def create_rating_endpoint(rating_data: RatingCreate, user_id: int):
    """Create a new rating."""
    # Prevent self-rating
    if user_id == rating_data.rated_user_id:
        raise HTTPException(status_code=400, detail="Cannot rate yourself")

    # Verify event exists via events service
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{EVENTS_SERVICE_URL}/events/{rating_data.event_id}")
            if response.status_code != 200:
                raise HTTPException(status_code=404, detail="Event not found")
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail="Events service unavailable")

    # Check if rating already exists
    existing = get_rating_by_event_and_users(
        rating_data.event_id,
        user_id,
        rating_data.rated_user_id
    )

    if existing:
        raise HTTPException(status_code=400, detail="Rating already exists for this event and user")

    # Create rating
    try:
        rating_id = create_rating(
            event_id=rating_data.event_id,
            rater_user_id=user_id,
            rated_user_id=rating_data.rated_user_id,
            score=rating_data.score,
            comment=rating_data.comment
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
async def update_rating_endpoint(rating_id: int, rating_data: RatingUpdate, user_id: int):
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
        comment=rating_data.comment
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update rating")

    rating = get_rating(rating_id)
    return RatingResponse(**rating)


@app.delete("/ratings/{rating_id}", status_code=204)
async def delete_rating_endpoint(rating_id: int, user_id: int):
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
async def get_event_stats_endpoint(event_id: int):
    """Get rating statistics for an event."""
    # Verify event exists and get host
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{EVENTS_SERVICE_URL}/events/{event_id}")
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
async def get_group_leaderboard_endpoint(group_id: int):
    """Get leaderboard for a group."""
    # Get group members from groups service
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{GROUPS_SERVICE_URL}/groups/{group_id}/members")
            if response.status_code != 200:
                raise HTTPException(status_code=404, detail="Group not found")

            members = response.json()
            member_ids = [member["user_id"] for member in members]
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail="Groups service unavailable")

    # Get leaderboard
    leaderboard_data = get_group_leaderboard(group_id, member_ids)
    leaderboard = [LeaderboardEntry(**entry) for entry in leaderboard_data]

    return GroupLeaderboardResponse(
        group_id=group_id,
        leaderboard=leaderboard
    )


@app.post("/users/{user_id}/hosted-events/increment", status_code=200)
async def increment_hosted_events_endpoint(user_id: int):
    """Increment hosted events count for a user (called by events service)."""
    increment_hosted_events(user_id)
    return {"message": "Hosted events count incremented"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
