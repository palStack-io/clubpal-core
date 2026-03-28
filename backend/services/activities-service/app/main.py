from fastapi import FastAPI, HTTPException, Query, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import os

from app.models import (
    ActivityCreate, ActivityUpdate, ActivityResponse, CategoryResponse
)
from app.database import (
    init_db, create_activity, get_activity, get_activity_by_name,
    get_all_activities, search_activities, update_activity, delete_activity,
    increment_usage_count, get_all_categories, get_popular_activities
)

INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET", "")

app = FastAPI(title="ClubPal Activities Service", version="1.0.0")

# CORS
_ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _require_internal(x_internal_secret: Optional[str] = Header(None)):
    """Dependency: allow only calls carrying the internal service secret."""
    if not INTERNAL_API_SECRET or x_internal_secret != INTERNAL_API_SECRET:
        raise HTTPException(status_code=403, detail="Internal access only")


@app.on_event("startup")
async def startup():
    """Initialize database on startup."""
    init_db()
    print("Activities service started")


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "activities-service"}


# ===== Activity Endpoints =====

@app.post("/activities", response_model=ActivityResponse, status_code=201)
async def create_activity_endpoint(activity_data: ActivityCreate, _: None = Depends(_require_internal)):
    """Create a new activity."""
    try:
        activity_id = create_activity(
            name=activity_data.name,
            description=activity_data.description,
            category=activity_data.category,
            icon=activity_data.icon,
            metadata=activity_data.metadata
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    activity = get_activity(activity_id)
    return ActivityResponse(**activity)


@app.get("/activities", response_model=List[ActivityResponse])
async def get_activities(
    category: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0)
):
    """Get all activities, optionally filtered by category."""
    activities = get_all_activities(category, limit, offset)
    return [ActivityResponse(**activity) for activity in activities]


@app.get("/activities/search", response_model=List[ActivityResponse])
async def search_activities_endpoint(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100)
):
    """Search activities by name or description."""
    activities = search_activities(q, limit)
    return [ActivityResponse(**activity) for activity in activities]


@app.get("/activities/popular", response_model=List[ActivityResponse])
async def get_popular_activities_endpoint(limit: int = Query(10, ge=1, le=50)):
    """Get most popular activities."""
    activities = get_popular_activities(limit)
    return [ActivityResponse(**activity) for activity in activities]


@app.get("/activities/{activity_id}", response_model=ActivityResponse)
async def get_activity_endpoint(activity_id: int):
    """Get activity by ID."""
    activity = get_activity(activity_id)

    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    return ActivityResponse(**activity)


@app.patch("/activities/{activity_id}", response_model=ActivityResponse)
async def update_activity_endpoint(activity_id: int, activity_data: ActivityUpdate, _: None = Depends(_require_internal)):
    """Update activity details."""
    # Check if activity exists
    if not get_activity(activity_id):
        raise HTTPException(status_code=404, detail="Activity not found")

    # Update activity
    success = update_activity(
        activity_id,
        name=activity_data.name,
        description=activity_data.description,
        category=activity_data.category,
        icon=activity_data.icon,
        metadata=activity_data.metadata
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update activity")

    activity = get_activity(activity_id)
    return ActivityResponse(**activity)


@app.delete("/activities/{activity_id}", status_code=204)
async def delete_activity_endpoint(activity_id: int, _: None = Depends(_require_internal)):
    """Delete an activity."""
    success = delete_activity(activity_id)

    if not success:
        raise HTTPException(status_code=404, detail="Activity not found")


@app.post("/activities/{activity_id}/increment-usage", status_code=200)
async def increment_usage_endpoint(activity_id: int, _: None = Depends(_require_internal)):
    """Increment usage count for an activity (called by events service)."""
    if not get_activity(activity_id):
        raise HTTPException(status_code=404, detail="Activity not found")

    increment_usage_count(activity_id)
    return {"message": "Usage count incremented"}


# ===== Category Endpoints =====

@app.get("/categories", response_model=List[CategoryResponse])
async def get_categories():
    """Get all activity categories with counts."""
    categories = get_all_categories()
    return [CategoryResponse(**category) for category in categories]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
