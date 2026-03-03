import hashlib
import json
import os
from typing import Optional, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.database import (
    init_db,
    cache_get, cache_set, cache_delete_by_type, cache_stats,
    get_place, upsert_place,
    get_book, upsert_book,
    get_movie, upsert_movie,
    get_show, upsert_show,
    get_game, upsert_game,
    get_geocode, upsert_geocode,
    track_call, get_api_usage,
    get_api_limits, set_api_limit, get_today_live_calls, is_quota_exceeded,
    get_user_items, upsert_user_item, clear_user_items,
)
from app import storage, external

app = FastAPI(title="ClubPal Enrichment Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CACHE_TTL_SEARCH = int(os.getenv("CACHE_TTL_SEARCH", "86400"))    # 24h
CACHE_TTL_DETAIL = int(os.getenv("CACHE_TTL_DETAIL", "604800"))   # 7 days
CACHE_TTL_SHORT = 21600                                            # 6h
CACHE_TTL_GEOCODE = int(os.getenv("CACHE_TTL_GEOCODE", "2592000"))  # 30 days


def _ck(prefix: str, **kwargs) -> str:
    """Build a deterministic cache key from a prefix + sorted kwargs."""
    h = hashlib.md5(json.dumps(kwargs, sort_keys=True).encode()).hexdigest()[:12]
    return f"{prefix}:{h}"


@app.on_event("startup")
async def startup():
    init_db()
    storage.ensure_buckets()
    external.load_keys_from_gateway()   # pull DB-stored keys before IGDB token refresh
    await external.refresh_igdb_token()
    print("Enrichment service started")


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "enrichment-service"}


@app.get("/config")
async def get_config():
    """Return which API keys are currently active (values never exposed)."""
    return {
        "google_api_key": {"configured": bool(external.GOOGLE_API_KEY)},
        "tmdb_api_key":   {"configured": bool(external.TMDB_API_KEY)},
        "igdb_client_id": {"configured": bool(external.IGDB_CLIENT_ID)},
        "igdb_client_secret": {"configured": bool(external.IGDB_CLIENT_SECRET)},
        "radarr_url":     {"configured": bool(external.RADARR_URL)},
        "radarr_api_key": {"configured": bool(external.RADARR_API_KEY)},
        "sonarr_url":     {"configured": bool(external.SONARR_URL)},
        "sonarr_api_key": {"configured": bool(external.SONARR_API_KEY)},
    }


@app.post("/admin/reload-config")
async def reload_config():
    """Called by gateway after admin saves new integration keys."""
    external.load_keys_from_gateway()
    await external.refresh_igdb_token()
    return {
        "ok": True,
        "google_api_key": bool(external.GOOGLE_API_KEY),
        "tmdb_api_key":   bool(external.TMDB_API_KEY),
        "igdb_client_id": bool(external.IGDB_CLIENT_ID),
        "igdb_client_secret": bool(external.IGDB_CLIENT_SECRET),
        "radarr_url":     bool(external.RADARR_URL),
        "radarr_api_key": bool(external.RADARR_API_KEY),
        "sonarr_url":     bool(external.SONARR_URL),
        "sonarr_api_key": bool(external.SONARR_API_KEY),
    }


# ========== PLACES ==========

@app.get("/places/search")
async def search_places(
    query: str,
    location: Optional[str] = None,
    type: str = "restaurant",
    radius: int = 5000,
    open_now: bool = False,
    min_rating: Optional[float] = None,
    price_level: Optional[int] = None,
):
    ck = _ck("places:search", query=query, location=location, type=type,
             radius=radius, open_now=open_now, min_rating=min_rating, price_level=price_level)
    cached = cache_get(ck)
    if cached:
        track_call("google_places", True)
        return cached

    track_call("google_places", False)
    results = await external.places_text_search(query, place_type=type, radius=radius)

    # Apply client-side filters (Places API free-tier doesn't support all filters)
    if open_now:
        results = [r for r in results if r.get("is_open")]
    if min_rating is not None:
        results = [r for r in results if (r.get("rating") or 0) >= min_rating]
    if price_level is not None:
        results = [r for r in results if r.get("price_level") == price_level]

    payload = {"results": results}
    cache_set(ck, "places", payload, CACHE_TTL_SEARCH)
    return payload


@app.get("/places/nearby")
async def nearby_places(lat: float, lng: float, type: str = "restaurant", radius: int = 2000):
    ck = _ck("places:nearby", lat=lat, lng=lng, type=type, radius=radius)
    cached = cache_get(ck)
    if cached:
        track_call("google_places", True)
        return cached

    track_call("google_places", False)
    results = await external.places_nearby(lat, lng, place_type=type, radius=radius)
    payload = {"results": results}
    cache_set(ck, "places", payload, CACHE_TTL_SEARCH)
    return payload


@app.get("/places/{place_id}")
async def get_place_detail(place_id: str):
    # Check detail cache
    row = get_place(place_id)
    if row:
        track_call("google_places", True)
        return row

    track_call("google_places", False)
    data = await external.place_detail(place_id)
    if not data:
        raise HTTPException(status_code=404, detail="Place not found")

    # Cache photos in MinIO
    photo_keys = []
    for i, photo_ref in enumerate(data.get("photo_refs", [])[:5]):
        if not external.GOOGLE_API_KEY:
            break
        ext_url = external.place_photo_url(photo_ref)
        object_key = f"places/{place_id}/photo_{i}.jpg"
        cached_url = await storage.fetch_and_cache_image(ext_url, object_key)
        if cached_url:
            photo_keys.append({"object_key": object_key, "url": cached_url})

    data["photo_object_keys"] = photo_keys
    data.pop("photo_refs", None)
    upsert_place(place_id, data)
    return data


@app.get("/places/{place_id}/photos")
async def get_place_photos(place_id: str):
    row = get_place(place_id)
    if row:
        return {"photos": row.get("photo_object_keys", [])}
    # Trigger a full detail fetch which caches photos
    await get_place_detail(place_id)
    row = get_place(place_id)
    return {"photos": row.get("photo_object_keys", []) if row else []}


# ========== BOOKS ==========

@app.get("/books/search")
async def search_books(
    query: str, langRestrict: Optional[str] = None, maxResults: int = 20
):
    ck = _ck("books:search", query=query, lang=langRestrict, max=maxResults)
    cached = cache_get(ck)
    if cached:
        track_call("google_books", True)
        return cached

    track_call("google_books", False)
    results = await external.books_search(query, lang_restrict=langRestrict, max_results=maxResults)
    payload = {"results": results}
    cache_set(ck, "books", payload, CACHE_TTL_SEARCH)
    return payload


@app.get("/books/isbn/{isbn}")
async def get_book_by_isbn(isbn: str):
    results = await external.books_search(f"isbn:{isbn}", max_results=1)
    if not results:
        raise HTTPException(status_code=404, detail="Book not found")
    return results[0]


@app.get("/books/{volume_id}")
async def get_book_detail(volume_id: str):
    row = get_book(volume_id)
    if row:
        return row

    data = await external.book_detail(volume_id)
    if not data:
        raise HTTPException(status_code=404, detail="Book not found")

    # Cache cover in MinIO
    cover_url = data.get("cover_url")
    if cover_url:
        object_key = f"books/{volume_id}/cover.jpg"
        cached_url = await storage.fetch_and_cache_image(cover_url, object_key)
        if cached_url:
            data["cover_url"] = cached_url
            data["cover_object_key"] = object_key

    upsert_book(volume_id, data)
    return data


# ========== MOVIES ==========

@app.get("/movies/search")
async def search_movies(query: str, year: Optional[int] = None):
    ck = _ck("movies:search", query=query, year=year)
    cached = cache_get(ck)
    if cached:
        track_call("tmdb", True)
        return cached

    track_call("tmdb", False)
    results = await external.tmdb_search(query, year=year)
    payload = {"results": results}
    cache_set(ck, "movies", payload, CACHE_TTL_SEARCH)
    return payload


@app.get("/movies/now-playing")
async def movies_now_playing():
    ck = "movies:now_playing"
    cached = cache_get(ck)
    if cached:
        track_call("tmdb", True)
        return cached
    track_call("tmdb", False)
    results = await external.tmdb_list("now_playing")
    payload = {"results": results}
    cache_set(ck, "movies", payload, CACHE_TTL_SHORT)
    return payload


@app.get("/movies/popular")
async def movies_popular():
    ck = "movies:popular"
    cached = cache_get(ck)
    if cached:
        track_call("tmdb", True)
        return cached
    track_call("tmdb", False)
    results = await external.tmdb_list("popular")
    payload = {"results": results}
    cache_set(ck, "movies", payload, CACHE_TTL_SHORT)
    return payload


@app.get("/movies/upcoming")
async def movies_upcoming():
    ck = "movies:upcoming"
    cached = cache_get(ck)
    if cached:
        track_call("tmdb", True)
        return cached
    track_call("tmdb", False)
    results = await external.tmdb_list("upcoming")
    payload = {"results": results}
    cache_set(ck, "movies", payload, CACHE_TTL_SHORT)
    return payload


@app.get("/movies/{tmdb_id}")
async def get_movie_detail(tmdb_id: int):
    row = get_movie(tmdb_id)
    if row:
        return row

    data = await external.tmdb_movie_detail(tmdb_id)
    if not data:
        raise HTTPException(status_code=404, detail="Movie not found")

    # Cache poster in MinIO
    if data.get("poster_url"):
        ok = f"movies/{tmdb_id}/poster.jpg"
        url = await storage.fetch_and_cache_image(data["poster_url"], ok)
        if url:
            data["poster_url"] = url
            data["poster_object_key"] = ok

    # Cache backdrop in MinIO
    if data.get("backdrop_url"):
        ok = f"movies/{tmdb_id}/backdrop.jpg"
        url = await storage.fetch_and_cache_image(data["backdrop_url"], ok)
        if url:
            data["backdrop_url"] = url
            data["backdrop_object_key"] = ok

    upsert_movie(tmdb_id, data)
    return data


# ========== TV SHOWS ==========

CACHE_TTL_LIBRARY = 300  # 5 minutes for library reads


@app.get("/shows/search")
async def search_shows(query: str, year: Optional[int] = None):
    ck = _ck("shows:search", query=query, year=year)
    cached = cache_get(ck)
    if cached:
        track_call("tmdb", True)
        return cached
    track_call("tmdb", False)
    results = await external.tmdb_tv_search(query, year=year)
    payload = {"results": results}
    cache_set(ck, "shows", payload, CACHE_TTL_SEARCH)
    return payload


@app.get("/shows/popular")
async def shows_popular():
    ck = "shows:popular"
    cached = cache_get(ck)
    if cached:
        track_call("tmdb", True)
        return cached
    track_call("tmdb", False)
    results = await external.tmdb_tv_list("popular")
    payload = {"results": results}
    cache_set(ck, "shows", payload, CACHE_TTL_SHORT)
    return payload


@app.get("/shows/top-rated")
async def shows_top_rated():
    ck = "shows:top_rated"
    cached = cache_get(ck)
    if cached:
        track_call("tmdb", True)
        return cached
    track_call("tmdb", False)
    results = await external.tmdb_tv_list("top_rated")
    payload = {"results": results}
    cache_set(ck, "shows", payload, CACHE_TTL_SHORT)
    return payload


@app.get("/shows/airing-today")
async def shows_airing_today():
    ck = "shows:airing_today"
    cached = cache_get(ck)
    if cached:
        track_call("tmdb", True)
        return cached
    track_call("tmdb", False)
    results = await external.tmdb_tv_list("airing_today")
    payload = {"results": results}
    cache_set(ck, "shows", payload, CACHE_TTL_SHORT)
    return payload


@app.get("/shows/{tmdb_id}")
async def get_show_detail(tmdb_id: int):
    row = get_show(tmdb_id)
    if row:
        return row

    data = await external.tmdb_tv_detail(tmdb_id)
    if not data:
        raise HTTPException(status_code=404, detail="Show not found")

    # Cache poster in MinIO
    if data.get("poster_url"):
        ok = f"shows/{tmdb_id}/poster.jpg"
        url = await storage.fetch_and_cache_image(data["poster_url"], ok)
        if url:
            data["poster_url"] = url
            data["poster_object_key"] = ok

    # Cache backdrop in MinIO
    if data.get("backdrop_url"):
        ok = f"shows/{tmdb_id}/backdrop.jpg"
        url = await storage.fetch_and_cache_image(data["backdrop_url"], ok)
        if url:
            data["backdrop_url"] = url
            data["backdrop_object_key"] = ok

    upsert_show(tmdb_id, data)
    return data


# ========== SELF-HOSTED LIBRARY ==========

@app.get("/library/radarr")
async def library_radarr():
    ck = "library:radarr"
    cached = cache_get(ck)
    if cached:
        return cached
    tmdb_ids = await external.radarr_library()
    payload = {"tmdb_ids": tmdb_ids}
    cache_set(ck, "library", payload, CACHE_TTL_LIBRARY)
    return payload


@app.get("/library/sonarr")
async def library_sonarr():
    ck = "library:sonarr"
    cached = cache_get(ck)
    if cached:
        return cached
    tmdb_ids = await external.sonarr_library()
    payload = {"tmdb_ids": tmdb_ids}
    cache_set(ck, "library", payload, CACHE_TTL_LIBRARY)
    return payload


# ========== HIKES (Google Places — parks/trails) ==========

@app.get("/hikes/search")
async def search_hikes(query: str, location: Optional[str] = None, radius: int = 10000):
    ck = _ck("hikes:search", query=query, location=location, radius=radius)
    cached = cache_get(ck)
    if cached:
        track_call("google_places", True)
        return cached

    track_call("google_places", False)
    results = await external.places_text_search(
        query or "hiking trail park", place_type="park", radius=radius
    )
    payload = {"results": results}
    cache_set(ck, "hikes", payload, CACHE_TTL_SEARCH)
    return payload


@app.get("/hikes/nearby")
async def nearby_hikes(lat: float, lng: float, radius: int = 10000):
    ck = _ck("hikes:nearby", lat=lat, lng=lng, radius=radius)
    cached = cache_get(ck)
    if cached:
        track_call("google_places", True)
        return cached
    track_call("google_places", False)
    results = await external.places_nearby(lat, lng, place_type="park", radius=radius)
    payload = {"results": results}
    cache_set(ck, "hikes", payload, CACHE_TTL_SEARCH)
    return payload


@app.get("/hikes/{place_id}")
async def get_hike_detail(place_id: str):
    # Reuse place_details table — same data structure
    return await get_place_detail(place_id)


# ========== GAMING ==========

@app.get("/games/search")
async def search_games(
    query: str,
    category: Optional[str] = None,
    min_rating: Optional[float] = None,
):
    ck = _ck("games:search", query=query, category=category, min_rating=min_rating)
    cached = cache_get(ck)
    if cached:
        track_call("igdb", True)
        return cached

    track_call("igdb", False)
    results = await external.igdb_search(query, category=category, min_rating=min_rating)
    payload = {"results": results}
    cache_set(ck, "games", payload, CACHE_TTL_SEARCH)
    return payload


@app.get("/games/popular")
async def popular_games():
    ck = "games:popular"
    cached = cache_get(ck)
    if cached:
        track_call("igdb", True)
        return cached
    track_call("igdb", False)
    results = await external.igdb_popular()
    payload = {"results": results}
    cache_set(ck, "games", payload, CACHE_TTL_SHORT)
    return payload


@app.get("/games/{igdb_id}")
async def get_game_detail(igdb_id: int):
    row = get_game(igdb_id)
    if row:
        return row

    data = await external.igdb_game_detail(igdb_id)
    if not data:
        raise HTTPException(status_code=404, detail="Game not found")

    # Cache cover in MinIO
    if data.get("cover_url"):
        ok = f"games/{igdb_id}/cover.jpg"
        url = await storage.fetch_and_cache_image(data["cover_url"], ok)
        if url:
            data["cover_url"] = url
            data["cover_object_key"] = ok

    upsert_game(igdb_id, data)
    return data


# ========== ARTS (Google Places — museums/galleries) ==========

@app.get("/arts/search")
async def search_arts(
    query: str = "museum art gallery",
    location: Optional[str] = None,
    type: str = "museum",
    radius: int = 5000,
):
    ck = _ck("arts:search", query=query, location=location, type=type, radius=radius)
    cached = cache_get(ck)
    if cached:
        track_call("google_places", True)
        return cached

    track_call("google_places", False)
    results = await external.places_text_search(query, place_type=type, radius=radius)
    payload = {"results": results}
    cache_set(ck, "arts", payload, CACHE_TTL_SEARCH)
    return payload


@app.get("/arts/{place_id}")
async def get_arts_detail(place_id: str):
    return await get_place_detail(place_id)


# ========== GEOCODE ==========

@app.get("/geocode")
async def geocode(address: str):
    cached = get_geocode(address)
    if cached:
        track_call("google_geocoding", True)
        return cached

    track_call("google_geocoding", False)
    result = await external.geocode_address(address)
    if not result:
        raise HTTPException(status_code=404, detail="Address not found")

    upsert_geocode(address, result["lat"], result["lng"], result["formatted_address"])
    return result


# ========== API USAGE ==========

@app.get("/api-usage")
async def api_usage(days: int = 30):
    """Return per-day API call counts, totals, today's usage, and daily limits."""
    rows = get_api_usage(days)
    limits = get_api_limits()

    totals: dict = {}
    for r in rows:
        name = r["api_name"]
        if name not in totals:
            totals[name] = {"api_name": name, "total_live": 0, "total_cached": 0, "days": []}
        totals[name]["total_live"] += r["live_calls"]
        totals[name]["total_cached"] += r["cache_hits"]
        totals[name]["days"].append(r)

    # Merge in limits + today's live calls for each API
    all_apis = set(totals.keys()) | set(limits.keys())
    summary = []
    for name in sorted(all_apis):
        entry = totals.get(name, {"api_name": name, "total_live": 0, "total_cached": 0, "days": []})
        entry["daily_limit"] = limits.get(name, 9999999)
        entry["today_live"] = get_today_live_calls(name)
        entry["quota_exceeded"] = is_quota_exceeded(name)
        summary.append(entry)

    return {"summary": summary, "rows": rows}


class ApiLimitsUpdate(BaseModel):
    limits: dict  # {api_name: daily_limit}


@app.put("/api-usage/limits")
async def update_api_limits(body: ApiLimitsUpdate):
    """Update daily call limits for one or more APIs."""
    for api_name, limit in body.limits.items():
        if isinstance(limit, int) and limit > 0:
            set_api_limit(api_name, limit)
    return get_api_limits()


# ========== CACHE ADMIN ==========

@app.get("/cache/stats")
async def get_cache_stats():
    return cache_stats()


@app.delete("/cache/{type}", status_code=204)
async def flush_cache(type: str):
    valid = {"places", "books", "movies", "shows", "games", "hikes", "arts", "library"}
    if type not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {', '.join(valid)}")
    cache_delete_by_type(type)


# ========== PERSONALIZED DISCOVER FEED ==========

# TMDB genre name → ID mapping (subset of common genres)
TMDB_GENRE_MAP = {
    "action": 28, "adventure": 12, "animation": 16, "comedy": 35,
    "crime": 80, "documentary": 99, "drama": 18, "family": 10751,
    "fantasy": 14, "history": 36, "horror": 27, "music": 10402,
    "mystery": 9648, "romance": 10749, "sci-fi": 878, "thriller": 53,
    "war": 10752, "western": 37,
}


class PreferencesLoadRequest(BaseModel):
    user_id: int
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_dining: int = 10
    radius_hiking: int = 25
    radius_arts: int = 10
    activities: List[str] = []
    book_genres: List[str] = []
    movie_genres: List[str] = []
    game_types: List[str] = ["video_game", "board_game"]


async def _cache_place_detail(place_id: str, activity_type: str, user_id: int):
    """Fetch full place detail, cache images, store in DB, link to user."""
    row = get_place(place_id)
    if not row:
        try:
            data = await external.place_detail(place_id)
            if not data:
                return
            photo_keys = []
            for i, photo_ref in enumerate(data.get("photo_refs", [])[:3]):
                if not external.GOOGLE_API_KEY:
                    break
                ext_url = external.place_photo_url(photo_ref)
                object_key = f"places/{place_id}/photo_{i}.jpg"
                cached_url = await storage.fetch_and_cache_image(ext_url, object_key)
                if cached_url:
                    photo_keys.append({"object_key": object_key, "url": cached_url})
            data["photo_object_keys"] = photo_keys
            data.pop("photo_refs", None)
            upsert_place(place_id, data)
        except Exception as e:
            print(f"Warning: failed to cache place {place_id}: {e}")
            return
    upsert_user_item(user_id, activity_type, place_id, "place")


async def _cache_movie_detail(tmdb_id: int, user_id: int):
    """Fetch full movie detail, cache images, store in DB, link to user."""
    row = get_movie(tmdb_id)
    if not row:
        try:
            data = await external.tmdb_movie_detail(tmdb_id)
            if not data:
                return
            if data.get("poster_url"):
                ok = f"movies/{tmdb_id}/poster.jpg"
                url = await storage.fetch_and_cache_image(data["poster_url"], ok)
                if url:
                    data["poster_url"] = url
                    data["poster_object_key"] = ok
            if data.get("backdrop_url"):
                ok = f"movies/{tmdb_id}/backdrop.jpg"
                url = await storage.fetch_and_cache_image(data["backdrop_url"], ok)
                if url:
                    data["backdrop_url"] = url
                    data["backdrop_object_key"] = ok
            upsert_movie(tmdb_id, data)
        except Exception as e:
            print(f"Warning: failed to cache movie {tmdb_id}: {e}")
            return
    upsert_user_item(user_id, "movies", str(tmdb_id), "movie")


async def _cache_book_detail(volume_id: str, user_id: int):
    """Fetch full book detail, cache cover, store in DB, link to user."""
    row = get_book(volume_id)
    if not row:
        try:
            data = await external.book_detail(volume_id)
            if not data:
                return
            cover_url = data.get("cover_url")
            if cover_url:
                object_key = f"books/{volume_id}/cover.jpg"
                cached_url = await storage.fetch_and_cache_image(cover_url, object_key)
                if cached_url:
                    data["cover_url"] = cached_url
                    data["cover_object_key"] = object_key
            upsert_book(volume_id, data)
        except Exception as e:
            print(f"Warning: failed to cache book {volume_id}: {e}")
            return
    upsert_user_item(user_id, "books", volume_id, "book")


async def _cache_game_detail(igdb_id: int, user_id: int):
    """Fetch full game detail, cache cover, store in DB, link to user."""
    row = get_game(igdb_id)
    if not row:
        try:
            data = await external.igdb_game_detail(igdb_id)
            if not data:
                return
            if data.get("cover_url"):
                ok = f"games/{igdb_id}/cover.jpg"
                url = await storage.fetch_and_cache_image(data["cover_url"], ok)
                if url:
                    data["cover_url"] = url
                    data["cover_object_key"] = ok
            upsert_game(igdb_id, data)
        except Exception as e:
            print(f"Warning: failed to cache game {igdb_id}: {e}")
            return
    upsert_user_item(user_id, "gaming", str(igdb_id), "game")


@app.post("/preferences/load")
async def load_user_preferences(req: PreferencesLoadRequest):
    """Bulk-fetch items for all user activities and cache them."""
    user_id = req.user_id
    loaded: dict = {}

    # Clear existing user cache so refresh gives fresh results
    clear_user_items(user_id)

    activities = set(req.activities)

    # ── DINING ────────────────────────────────────────────────────────────────
    if "dining" in activities and req.lat is not None and req.lng is not None:
        if is_quota_exceeded("google_places"):
            loaded["dining"] = 0
        else:
            track_call("google_places", False)
            places = await external.places_nearby(
                req.lat, req.lng, place_type="restaurant", radius=req.radius_dining * 1609
            )
            count = 0
            for p in places[:20]:
                pid = p.get("place_id")
                if pid:
                    await _cache_place_detail(pid, "dining", user_id)
                    count += 1
            loaded["dining"] = count

    # ── HIKING ────────────────────────────────────────────────────────────────
    if "hiking" in activities and req.lat is not None and req.lng is not None:
        if is_quota_exceeded("google_places"):
            loaded["hiking"] = 0
        else:
            track_call("google_places", False)
            places = await external.places_nearby(
                req.lat, req.lng, place_type="park", radius=req.radius_hiking * 1609
            )
            count = 0
            for p in places[:20]:
                pid = p.get("place_id")
                if pid:
                    await _cache_place_detail(pid, "hiking", user_id)
                    count += 1
            loaded["hiking"] = count

    # ── ARTS ──────────────────────────────────────────────────────────────────
    if "arts" in activities and req.lat is not None and req.lng is not None:
        if is_quota_exceeded("google_places"):
            loaded["arts"] = 0
        else:
            track_call("google_places", False)
            places = await external.places_nearby(
                req.lat, req.lng, place_type="museum", radius=req.radius_arts * 1609
            )
            count = 0
            for p in places[:20]:
                pid = p.get("place_id")
                if pid:
                    await _cache_place_detail(pid, "arts", user_id)
                    count += 1
            loaded["arts"] = count

    # ── MOVIES ────────────────────────────────────────────────────────────────
    if "movies" in activities:
        genre_ids = [TMDB_GENRE_MAP[g.lower()] for g in req.movie_genres if g.lower() in TMDB_GENRE_MAP]
        movie_ids_seen: set = set()
        all_movies: list = []
        if external.TMDB_API_KEY and not is_quota_exceeded("tmdb"):
            import httpx as _httpx
            for page in (1, 2):
                params = {"api_key": external.TMDB_API_KEY, "language": "en-US", "page": page}
                if genre_ids:
                    params["with_genres"] = ",".join(str(g) for g in genre_ids)
                async with _httpx.AsyncClient(timeout=15.0) as c:
                    resp = await c.get(f"{external.TMDB_BASE}/movie/popular", params=params)
                    if resp.status_code == 200:
                        for m in resp.json().get("results", []):
                            mid = m.get("id")
                            if mid and mid not in movie_ids_seen:
                                movie_ids_seen.add(mid)
                                all_movies.append(mid)
            track_call("tmdb", False)
        count = 0
        for mid in all_movies[:40]:
            await _cache_movie_detail(mid, user_id)
            count += 1
        loaded["movies"] = count

    # ── BOOKS ─────────────────────────────────────────────────────────────────
    if "books" in activities:
        seen_ids: set = set()
        book_ids: list = []
        if not is_quota_exceeded("google_books"):
            genres_to_fetch = req.book_genres if req.book_genres else ["fiction", "nonfiction"]
            for genre in genres_to_fetch[:4]:
                results = await external.books_search(f"subject:{genre}", max_results=10)
                for b in results:
                    vid = b.get("volume_id")
                    if vid and vid not in seen_ids:
                        seen_ids.add(vid)
                        book_ids.append(vid)
            if len(book_ids) < 20:
                popular = await external.books_search("bestseller fiction", max_results=20)
                for b in popular:
                    vid = b.get("volume_id")
                    if vid and vid not in seen_ids and len(book_ids) < 30:
                        seen_ids.add(vid)
                        book_ids.append(vid)
        count = 0
        for vid in book_ids[:30]:
            await _cache_book_detail(vid, user_id)
            count += 1
        loaded["books"] = count

    # ── GAMING ────────────────────────────────────────────────────────────────
    if "gaming" in activities:
        headers = await external._igdb_headers()
        game_ids = []
        seen_games = set()

        if headers:
            import httpx as _httpx
            game_types = req.game_types or ["video_game", "board_game"]
            categories = []
            if "video_game" in game_types:
                categories.append(0)
            if "board_game" in game_types:
                categories.append(26)

            cat_filter = " | ".join(f"category = {c}" for c in categories)
            body = (
                f'fields id,name,cover.image_id,summary,total_rating,genres.name,platforms.name,first_release_date; '
                f'where ({cat_filter}) & total_rating > 70 & total_rating_count > 50 & version_parent = null; '
                f'sort total_rating desc; limit 20;'
            )
            async with _httpx.AsyncClient(timeout=15.0) as c:
                resp = await c.post(f"{external.IGDB_BASE}/games", headers=headers, content=body)
                if resp.status_code == 200:
                    for g in resp.json():
                        gid = g.get("id")
                        if gid and gid not in seen_games:
                            seen_games.add(gid)
                            game_ids.append(gid)
            track_call("igdb", False)

        count = 0
        for gid in game_ids[:20]:
            await _cache_game_detail(gid, user_id)
            count += 1
        loaded["gaming"] = count

    return {"loaded": loaded}


def _normalize_place_row(row: dict) -> dict:
    """Add photo_url field for places."""
    photos = row.get("photo_object_keys") or []
    if isinstance(photos, list) and photos:
        first = photos[0]
        photo_url = first.get("url") if isinstance(first, dict) else None
    else:
        photo_url = None
    return {**row, "photo_url": photo_url}


@app.get("/users/{user_id}/discover/{activity_type}")
async def get_user_discover(user_id: int, activity_type: str):
    """Return the user's personalized discover feed for a given activity type."""
    valid_types = {"dining", "hiking", "arts", "movies", "books", "gaming"}
    if activity_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid activity_type. Must be one of: {', '.join(valid_types)}")

    items = get_user_items(user_id, activity_type)

    if not items:
        return {"results": [], "setup_required": True}

    results = []
    if activity_type in ("dining", "hiking", "arts"):
        for item in items:
            row = get_place(item["item_id"])
            if row:
                results.append(_normalize_place_row(row))
    elif activity_type == "movies":
        for item in items:
            try:
                row = get_movie(int(item["item_id"]))
                if row:
                    results.append(row)
            except (ValueError, TypeError):
                pass
    elif activity_type == "books":
        for item in items:
            row = get_book(item["item_id"])
            if row:
                results.append(row)
    elif activity_type == "gaming":
        for item in items:
            try:
                row = get_game(int(item["item_id"]))
                if row:
                    results.append(row)
            except (ValueError, TypeError):
                pass

    return {"results": results, "setup_required": False}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
