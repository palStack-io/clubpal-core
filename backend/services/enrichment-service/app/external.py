"""
External API clients for enrichment-service.
All functions return normalized Python dicts/lists.
Functions return empty results (not raise) when API keys are not configured.
"""
import os
from datetime import datetime
from typing import Optional
import httpx

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
TMDB_API_KEY = os.getenv("TMDB_API_KEY", "")
IGDB_CLIENT_ID = os.getenv("IGDB_CLIENT_ID", "")
IGDB_CLIENT_SECRET = os.getenv("IGDB_CLIENT_SECRET", "")
RADARR_URL = os.getenv("RADARR_URL", "")
RADARR_API_KEY = os.getenv("RADARR_API_KEY", "")
SONARR_URL = os.getenv("SONARR_URL", "")
SONARR_API_KEY = os.getenv("SONARR_API_KEY", "")

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://api-gateway:8001")
INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET", "")


def load_keys_from_gateway():
    """Fetch any DB-stored API keys from gateway and override module-level vars.
    Env vars take precedence — only fills in keys that are blank."""
    global GOOGLE_API_KEY, TMDB_API_KEY, IGDB_CLIENT_ID, IGDB_CLIENT_SECRET, \
           RADARR_URL, RADARR_API_KEY, SONARR_URL, SONARR_API_KEY
    try:
        headers = {"X-Internal-Secret": INTERNAL_API_SECRET} if INTERNAL_API_SECRET else {}
        with httpx.Client(timeout=5.0) as client:
            r = client.get(f"{GATEWAY_URL}/internal/integrations", headers=headers)
            if r.status_code == 200:
                data = r.json()
                if not GOOGLE_API_KEY and data.get("google_api_key"):
                    GOOGLE_API_KEY = data["google_api_key"]
                if not TMDB_API_KEY and data.get("tmdb_api_key"):
                    TMDB_API_KEY = data["tmdb_api_key"]
                if not IGDB_CLIENT_ID and data.get("igdb_client_id"):
                    IGDB_CLIENT_ID = data["igdb_client_id"]
                if not IGDB_CLIENT_SECRET and data.get("igdb_client_secret"):
                    IGDB_CLIENT_SECRET = data["igdb_client_secret"]
                if not RADARR_URL and data.get("radarr_url"):
                    RADARR_URL = data["radarr_url"]
                if not RADARR_API_KEY and data.get("radarr_api_key"):
                    RADARR_API_KEY = data["radarr_api_key"]
                if not SONARR_URL and data.get("sonarr_url"):
                    SONARR_URL = data["sonarr_url"]
                if not SONARR_API_KEY and data.get("sonarr_api_key"):
                    SONARR_API_KEY = data["sonarr_api_key"]
    except Exception:
        pass  # Env vars remain as-is

GOOGLE_PLACES_BASE = "https://maps.googleapis.com/maps/api/place"  # legacy Places API
GOOGLE_GEOCODE_BASE = "https://maps.googleapis.com/maps/api/geocode/json"
GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1"
TMDB_BASE = "https://api.themoviedb.org/3"
IGDB_BASE = "https://api.igdb.com/v4"

# IGDB token stored in memory; fetched on startup and refreshed on 401
_igdb_token: Optional[str] = None


async def refresh_igdb_token() -> Optional[str]:
    global _igdb_token
    if not IGDB_CLIENT_ID or not IGDB_CLIENT_SECRET:
        return None
    async with httpx.AsyncClient(timeout=10.0) as c:
        resp = await c.post(
            "https://id.twitch.tv/oauth2/token",
            params={
                "client_id": IGDB_CLIENT_ID,
                "client_secret": IGDB_CLIENT_SECRET,
                "grant_type": "client_credentials",
            }
        )
        if resp.status_code == 200:
            _igdb_token = resp.json().get("access_token")
    return _igdb_token


async def _igdb_headers() -> Optional[dict]:
    global _igdb_token
    if not IGDB_CLIENT_ID:
        return None
    if not _igdb_token:
        await refresh_igdb_token()
    if not _igdb_token:
        return None
    return {"Client-ID": IGDB_CLIENT_ID, "Authorization": f"Bearer {_igdb_token}"}


# ===== Google Places (New API) =====

async def places_text_search(
    query: str, place_type: Optional[str] = None, radius: int = 5000
) -> list:
    if not GOOGLE_API_KEY:
        return []
    params: dict = {"query": query, "radius": radius, "key": GOOGLE_API_KEY}
    if place_type:
        params["type"] = place_type
    async with httpx.AsyncClient(timeout=10.0) as c:
        resp = await c.get(f"{GOOGLE_PLACES_BASE}/textsearch/json", params=params)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") in ("OK", "ZERO_RESULTS"):
                return _normalize_places(data.get("results", []))
    return []


async def places_nearby(lat: float, lng: float,
                        place_type: str = "restaurant", radius: int = 2000) -> list:
    if not GOOGLE_API_KEY:
        return []
    params = {
        "location": f"{lat},{lng}",
        "radius": radius,
        "type": place_type,
        "key": GOOGLE_API_KEY,
    }
    async with httpx.AsyncClient(timeout=10.0) as c:
        resp = await c.get(f"{GOOGLE_PLACES_BASE}/nearbysearch/json", params=params)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") in ("OK", "ZERO_RESULTS"):
                return _normalize_places(data.get("results", []))
    return []


async def place_detail(place_id: str) -> Optional[dict]:
    if not GOOGLE_API_KEY:
        return None
    params = {
        "place_id": place_id,
        "fields": "place_id,name,geometry,formatted_address,formatted_phone_number,website,rating,price_level,opening_hours,photos",
        "key": GOOGLE_API_KEY,
    }
    async with httpx.AsyncClient(timeout=10.0) as c:
        resp = await c.get(f"{GOOGLE_PLACES_BASE}/details/json", params=params)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "OK":
                p = data["result"]
                loc = p.get("geometry", {}).get("location", {})
                hours = p.get("opening_hours", {})
                return {
                    "place_id": p.get("place_id"),
                    "name": p.get("name"),
                    "lat": loc.get("lat"),
                    "lng": loc.get("lng"),
                    "address": p.get("formatted_address"),
                    "phone": p.get("formatted_phone_number"),
                    "website": p.get("website"),
                    "rating": p.get("rating"),
                    "price_level": p.get("price_level"),
                    "hours": {
                        "openNow": hours.get("open_now"),
                        "weekdayDescriptions": hours.get("weekday_text", []),
                    },
                    "photo_refs": [ph.get("photo_reference") for ph in p.get("photos", [])[:5]],
                }
    return None


def place_photo_url(photo_ref: str, max_width: int = 800) -> str:
    """Build a Google Places photo URL using the legacy API."""
    return f"{GOOGLE_PLACES_BASE}/photo?maxwidth={max_width}&photo_reference={photo_ref}&key={GOOGLE_API_KEY}"


def _normalize_places(places: list) -> list:
    result = []
    for p in places:
        loc = p.get("geometry", {}).get("location", {})
        photos = p.get("photos", [])
        hours = p.get("opening_hours", {})
        result.append({
            "place_id": p.get("place_id"),
            "name": p.get("name"),
            "lat": loc.get("lat"),
            "lng": loc.get("lng"),
            "address": p.get("vicinity") or p.get("formatted_address"),
            "rating": p.get("rating"),
            "price_level": p.get("price_level"),
            "is_open": hours.get("open_now"),
            "photo_ref": photos[0].get("photo_reference") if photos else None,
        })
    return result


# ===== Google Geocoding =====

async def places_autocomplete(input_text: str, types: str = "(cities)") -> list:
    if not GOOGLE_API_KEY:
        return []
    async with httpx.AsyncClient(timeout=10.0) as c:
        resp = await c.get(
            f"{GOOGLE_PLACES_BASE}/autocomplete/json",
            params={"input": input_text, "types": types, "key": GOOGLE_API_KEY},
        )
        if resp.status_code == 200:
            predictions = resp.json().get("predictions", [])
            return [{"description": p["description"], "place_id": p["place_id"]} for p in predictions]
    return []


async def geocode_address(address: str) -> Optional[dict]:
    if not GOOGLE_API_KEY:
        return None
    async with httpx.AsyncClient(timeout=10.0) as c:
        resp = await c.get(
            GOOGLE_GEOCODE_BASE,
            params={"address": address, "key": GOOGLE_API_KEY},
        )
        if resp.status_code == 200:
            results = resp.json().get("results", [])
            if results:
                r = results[0]
                loc = r.get("geometry", {}).get("location", {})
                return {
                    "lat": loc.get("lat"),
                    "lng": loc.get("lng"),
                    "formatted_address": r.get("formatted_address"),
                }
    return None


# ===== Google Books =====

async def books_search(query: str, lang_restrict: Optional[str] = None,
                       max_results: int = 20) -> list:
    params: dict = {"q": query, "maxResults": min(max_results, 40)}
    if lang_restrict:
        params["langRestrict"] = lang_restrict
    if GOOGLE_API_KEY:
        params["key"] = GOOGLE_API_KEY
    async with httpx.AsyncClient(timeout=10.0) as c:
        resp = await c.get(f"{GOOGLE_BOOKS_BASE}/volumes", params=params)
        if resp.status_code == 200:
            return [_normalize_book(item) for item in resp.json().get("items", [])]
    return []


async def book_detail(volume_id: str) -> Optional[dict]:
    params = {}
    if GOOGLE_API_KEY:
        params["key"] = GOOGLE_API_KEY
    async with httpx.AsyncClient(timeout=10.0) as c:
        resp = await c.get(f"{GOOGLE_BOOKS_BASE}/volumes/{volume_id}", params=params)
        if resp.status_code == 200:
            return _normalize_book(resp.json())
    return None


def _normalize_book(item: dict) -> dict:
    vi = item.get("volumeInfo", {})
    imgs = vi.get("imageLinks", {})
    cover = (imgs.get("thumbnail") or imgs.get("smallThumbnail") or "").replace("http://", "https://")
    # Fallback: construct Google Books cover URL from volume ID when imageLinks is absent
    if not cover and item.get("id"):
        cover = f"https://books.google.com/books/content?id={item['id']}&printsec=frontcover&img=1&zoom=1&source=gbs_api"
    isbn_list = vi.get("industryIdentifiers", [])
    isbn = next((i["identifier"] for i in isbn_list if i.get("type") in ("ISBN_13", "ISBN_10")), None)
    return {
        "volume_id": item.get("id"),
        "title": vi.get("title"),
        "authors": vi.get("authors", []),
        "description": vi.get("description"),
        "cover_url": cover or None,
        "page_count": vi.get("pageCount"),
        "publisher": vi.get("publisher"),
        "published_date": vi.get("publishedDate"),
        "rating": vi.get("averageRating"),
        "isbn": isbn,
        "preview_link": vi.get("previewLink"),
    }


# ===== TMDB =====

async def tmdb_search(query: str, year: Optional[int] = None) -> list:
    if not TMDB_API_KEY:
        return []
    params: dict = {"api_key": TMDB_API_KEY, "query": query, "language": "en-US"}
    if year:
        params["year"] = year
    async with httpx.AsyncClient(timeout=10.0) as c:
        resp = await c.get(f"{TMDB_BASE}/search/movie", params=params)
        if resp.status_code == 200:
            return [_normalize_tmdb_movie(m) for m in resp.json().get("results", [])]
    return []


async def tmdb_movie_detail(tmdb_id: int) -> Optional[dict]:
    if not TMDB_API_KEY:
        return None
    async with httpx.AsyncClient(timeout=10.0) as c:
        resp = await c.get(
            f"{TMDB_BASE}/movie/{tmdb_id}",
            params={"api_key": TMDB_API_KEY, "append_to_response": "credits,videos", "language": "en-US"},
        )
        if resp.status_code == 200:
            m = resp.json()
            trailer_key = next(
                (v["key"] for v in m.get("videos", {}).get("results", [])
                 if v.get("type") == "Trailer" and v.get("site") == "YouTube"),
                None
            )
            cast = [
                {"name": c["name"], "character": c.get("character")}
                for c in m.get("credits", {}).get("cast", [])[:10]
            ]
            base = _normalize_tmdb_movie(m)
            base.update({
                "overview": m.get("overview"),
                "runtime": m.get("runtime"),
                "cast_list": cast,
                "trailer_key": trailer_key,
                "genres": [g["name"] for g in m.get("genres", [])],
            })
            return base
    return None


async def tmdb_list(list_type: str) -> list:
    """list_type: now_playing | popular | upcoming"""
    if not TMDB_API_KEY:
        return []
    async with httpx.AsyncClient(timeout=10.0) as c:
        resp = await c.get(
            f"{TMDB_BASE}/movie/{list_type}",
            params={"api_key": TMDB_API_KEY, "language": "en-US", "page": 1},
        )
        if resp.status_code == 200:
            return [_normalize_tmdb_movie(m) for m in resp.json().get("results", [])]
    return []


def _normalize_tmdb_movie(m: dict) -> dict:
    poster = m.get("poster_path")
    backdrop = m.get("backdrop_path")
    return {
        "tmdb_id": m.get("id"),
        "title": m.get("title"),
        "overview": m.get("overview", ""),
        "release_date": m.get("release_date"),
        "rating": m.get("vote_average"),
        "genres": [g["name"] for g in m.get("genres", [])] if "genres" in m else [],
        "poster_url": f"https://image.tmdb.org/t/p/w500{poster}" if poster else None,
        "backdrop_url": f"https://image.tmdb.org/t/p/w1280{backdrop}" if backdrop else None,
    }


# ===== TMDB TV Shows =====

async def tmdb_tv_search(query: str, year: Optional[int] = None) -> list:
    if not TMDB_API_KEY:
        return []
    params: dict = {"api_key": TMDB_API_KEY, "query": query, "language": "en-US"}
    if year:
        params["first_air_date_year"] = year
    async with httpx.AsyncClient(timeout=10.0) as c:
        resp = await c.get(f"{TMDB_BASE}/search/tv", params=params)
        if resp.status_code == 200:
            return [_normalize_tmdb_show(s) for s in resp.json().get("results", [])]
    return []


async def tmdb_tv_detail(tmdb_id: int) -> Optional[dict]:
    if not TMDB_API_KEY:
        return None
    async with httpx.AsyncClient(timeout=10.0) as c:
        resp = await c.get(
            f"{TMDB_BASE}/tv/{tmdb_id}",
            params={"api_key": TMDB_API_KEY, "append_to_response": "credits,videos", "language": "en-US"},
        )
        if resp.status_code == 200:
            s = resp.json()
            trailer_key = next(
                (v["key"] for v in s.get("videos", {}).get("results", [])
                 if v.get("type") == "Trailer" and v.get("site") == "YouTube"),
                None
            )
            cast = [
                {"name": c["name"], "character": c.get("character")}
                for c in s.get("credits", {}).get("cast", [])[:10]
            ]
            base = _normalize_tmdb_show(s)
            base.update({
                "number_of_seasons": s.get("number_of_seasons"),
                "number_of_episodes": s.get("number_of_episodes"),
                "cast_list": cast,
                "trailer_key": trailer_key,
                "genres": [g["name"] for g in s.get("genres", [])],
            })
            return base
    return None


async def tmdb_tv_list(list_type: str) -> list:
    """list_type: popular | top_rated | airing_today"""
    if not TMDB_API_KEY:
        return []
    async with httpx.AsyncClient(timeout=10.0) as c:
        resp = await c.get(
            f"{TMDB_BASE}/tv/{list_type}",
            params={"api_key": TMDB_API_KEY, "language": "en-US", "page": 1},
        )
        if resp.status_code == 200:
            return [_normalize_tmdb_show(s) for s in resp.json().get("results", [])]
    return []


def _normalize_tmdb_show(s: dict) -> dict:
    poster = s.get("poster_path")
    backdrop = s.get("backdrop_path")
    return {
        "tmdb_id": s.get("id"),
        "title": s.get("name"),
        "overview": s.get("overview", ""),
        "first_air_date": s.get("first_air_date"),
        "rating": s.get("vote_average"),
        "genres": [g["name"] for g in s.get("genres", [])] if "genres" in s else [],
        "poster_url": f"https://image.tmdb.org/t/p/w500{poster}" if poster else None,
        "backdrop_url": f"https://image.tmdb.org/t/p/w1280{backdrop}" if backdrop else None,
    }


# ===== Radarr / Sonarr Library =====

async def radarr_library() -> list:
    """Return list of TMDB IDs from Radarr. Empty list if not configured."""
    if not RADARR_URL or not RADARR_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(
                f"{RADARR_URL.rstrip('/')}/api/v3/movie",
                headers={"X-Api-Key": RADARR_API_KEY},
            )
            if resp.status_code == 200:
                return [m["tmdbId"] for m in resp.json() if m.get("tmdbId")]
    except Exception:
        pass
    return []


async def radarr_library_full() -> list:
    """Return full normalized movie list from Radarr. Empty list if not configured."""
    if not RADARR_URL or not RADARR_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            resp = await c.get(
                f"{RADARR_URL.rstrip('/')}/api/v3/movie",
                headers={"X-Api-Key": RADARR_API_KEY},
            )
            if resp.status_code == 200:
                return [_normalize_radarr_movie(m) for m in resp.json() if m.get("tmdbId")]
    except Exception:
        pass
    return []


def _normalize_radarr_movie(m: dict) -> dict:
    ratings = m.get("ratings") or {}
    rating = None
    if isinstance(ratings, dict):
        if "tmdb" in ratings:
            rating = (ratings["tmdb"] or {}).get("value")
        elif "value" in ratings:
            rating = ratings.get("value")

    poster = m.get("remotePoster")
    backdrop = None
    for img in (m.get("images") or []):
        if not poster and img.get("coverType") == "poster":
            poster = img.get("remoteUrl") or img.get("url")
        if not backdrop and img.get("coverType") == "fanart":
            backdrop = img.get("remoteUrl") or img.get("url")

    year = m.get("year")
    release_date = (
        m.get("digitalRelease") or m.get("physicalRelease") or m.get("releaseDate")
        or (f"{year}-01-01" if year else None)
    )
    return {
        "tmdb_id": m.get("tmdbId"),
        "title": m.get("title"),
        "overview": m.get("overview", ""),
        "release_date": release_date,
        "rating": rating,
        "genres": m.get("genres") or [],
        "poster_url": poster,
        "backdrop_url": backdrop,
        "in_library": True,
        "has_file": m.get("hasFile", False),
    }


async def sonarr_library() -> list:
    """Return list of TMDB IDs from Sonarr. Empty list if not configured."""
    if not SONARR_URL or not SONARR_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            resp = await c.get(
                f"{SONARR_URL.rstrip('/')}/api/v3/series",
                headers={"X-Api-Key": SONARR_API_KEY},
            )
            if resp.status_code == 200:
                return [s["tmdbId"] for s in resp.json() if s.get("tmdbId")]
    except Exception:
        pass
    return []


async def sonarr_library_full() -> list:
    """Return full normalized show list from Sonarr. Empty list if not configured."""
    if not SONARR_URL or not SONARR_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            resp = await c.get(
                f"{SONARR_URL.rstrip('/')}/api/v3/series",
                headers={"X-Api-Key": SONARR_API_KEY},
            )
            if resp.status_code == 200:
                return [_normalize_sonarr_show(s) for s in resp.json() if s.get("tmdbId")]
    except Exception:
        pass
    return []


def _normalize_sonarr_show(s: dict) -> dict:
    ratings = s.get("ratings") or {}
    rating = ratings.get("value") if isinstance(ratings, dict) else None

    poster = s.get("remotePoster")
    backdrop = None
    for img in (s.get("images") or []):
        if not poster and img.get("coverType") == "poster":
            poster = img.get("remoteUrl") or img.get("url")
        if not backdrop and img.get("coverType") == "fanart":
            backdrop = img.get("remoteUrl") or img.get("url")

    year = s.get("year")
    first_air_date = s.get("firstAired") or (f"{year}-01-01" if year else None)
    return {
        "tmdb_id": s.get("tmdbId") or None,
        "tvdb_id": s.get("tvdbId"),
        "title": s.get("title"),
        "overview": s.get("overview", ""),
        "first_air_date": first_air_date,
        "rating": rating,
        "genres": s.get("genres") or [],
        "poster_url": poster,
        "backdrop_url": backdrop,
        "in_library": True,
    }


# ===== IGDB =====

async def igdb_search(query: str, category: Optional[str] = None,
                      min_rating: Optional[float] = None) -> list:
    headers = await _igdb_headers()
    if not headers:
        return []
    where = ["version_parent = null"]
    if category == "board_game":
        where.append("category = 26")
    else:
        where.append("category = 0")
    if min_rating:
        where.append(f"total_rating >= {min_rating}")
    body = (
        f'search "{query}"; '
        f'fields id,name,cover.image_id,summary,total_rating,genres.name,platforms.name,first_release_date; '
        f'where {" & ".join(where)}; limit 20;'
    )
    async with httpx.AsyncClient(timeout=10.0) as c:
        resp = await c.post(f"{IGDB_BASE}/games", headers=headers, content=body)
        if resp.status_code == 401:
            await refresh_igdb_token()
            headers = await _igdb_headers()
            if headers:
                resp = await c.post(f"{IGDB_BASE}/games", headers=headers, content=body)
        if resp.status_code == 200:
            return [_normalize_igdb_game(g) for g in resp.json()]
    return []


async def igdb_game_detail(igdb_id: int) -> Optional[dict]:
    headers = await _igdb_headers()
    if not headers:
        return None
    body = (
        f'fields id,name,cover.image_id,summary,total_rating,genres.name,platforms.name,first_release_date; '
        f'where id = {igdb_id};'
    )
    async with httpx.AsyncClient(timeout=10.0) as c:
        resp = await c.post(f"{IGDB_BASE}/games", headers=headers, content=body)
        if resp.status_code == 200 and resp.json():
            return _normalize_igdb_game(resp.json()[0])
    return None


async def igdb_popular() -> list:
    headers = await _igdb_headers()
    if not headers:
        return []
    body = (
        'fields id,name,cover.image_id,summary,total_rating,genres.name,platforms.name,first_release_date; '
        'where total_rating > 75 & total_rating_count > 100 & category = 0; '
        'sort total_rating desc; limit 20;'
    )
    async with httpx.AsyncClient(timeout=10.0) as c:
        resp = await c.post(f"{IGDB_BASE}/games", headers=headers, content=body)
        if resp.status_code == 200:
            return [_normalize_igdb_game(g) for g in resp.json()]
    return []


def _normalize_igdb_game(g: dict) -> dict:
    cover = g.get("cover") or {}
    image_id = cover.get("image_id")
    cover_url = (
        f"https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.jpg"
        if image_id else None
    )
    release_date = None
    if g.get("first_release_date"):
        try:
            release_date = datetime.utcfromtimestamp(g["first_release_date"]).strftime("%Y-%m-%d")
        except (ValueError, OSError):
            pass
    return {
        "igdb_id": g.get("id"),
        "name": g.get("name"),
        "cover_url": cover_url,
        "summary": g.get("summary"),
        "rating": g.get("total_rating"),
        "genres": [gen.get("name") for gen in (g.get("genres") or [])],
        "platforms": [p.get("name") for p in (g.get("platforms") or [])],
        "release_date": release_date,
    }
