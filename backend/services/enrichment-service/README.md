# Enrichment Service

FastAPI microservice that aggregates external APIs (TMDB, Radarr, Sonarr, Google Places/Books, IGDB) and exposes a unified enrichment layer to the clubPal frontend.

Port: **8006** (proxied via api-gateway)

---

## Configuration

All keys are loaded from environment variables **or** fetched from the api-gateway's `integrations` store on startup. Env vars take precedence.

| Variable | Description |
|---|---|
| `TMDB_API_KEY` | The Movie Database API key |
| `RADARR_URL` | Base URL of self-hosted Radarr (e.g. `http://192.168.1.10:7878`) |
| `RADARR_API_KEY` | Radarr API key |
| `SONARR_URL` | Base URL of self-hosted Sonarr (e.g. `http://192.168.1.10:8989`) |
| `SONARR_API_KEY` | Sonarr API key |
| `GOOGLE_API_KEY` | Google Places + Books + Geocoding key |
| `IGDB_CLIENT_ID` | IGDB (Twitch) client ID |
| `IGDB_CLIENT_SECRET` | IGDB (Twitch) client secret |
| `GATEWAY_URL` | Internal gateway base URL (default `http://api-gateway:8001`) |
| `INTERNAL_API_SECRET` | Shared secret for internal gateway calls |

To reload keys after an admin saves new credentials in the UI, the gateway calls `POST /admin/reload-config`.

---

## Data Source Priority

### Movies

`GET /movies/library` uses a **Radarr-first** strategy:

1. **Radarr configured** → fetch full library from Radarr, overlay any cached TMDB metadata (posters/ratings/overview), return with `in_library: true`
2. **Radarr not configured, TMDB configured** → return TMDB popular movies
3. **Neither configured** → return empty list

### TV Shows

`GET /shows/library` uses the same **Sonarr-first** strategy:

1. **Sonarr configured** → fetch full library from Sonarr, overlay cached TMDB metadata, return with `in_library: true`
2. **Sonarr not configured, TMDB configured** → return TMDB popular shows
3. **Neither configured** → return empty list

The `source` field in the response indicates which system provided the data (`"radarr"`, `"sonarr"`, `"tmdb"`, or `"none"`).

TMDB-only endpoints (`/movies/popular`, `/movies/now-playing`, etc.) remain available as supplemental browse tabs when TMDB is configured.

---

## Endpoints

### Health / Config

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `GET` | `/config` | Which API keys are active (values never exposed) |
| `POST` | `/admin/reload-config` | Reload keys from gateway DB |

### Movies

| Method | Path | Description |
|---|---|---|
| `GET` | `/movies/library` | **Primary** — Radarr library or TMDB popular fallback |
| `GET` | `/movies/search?query=&year=` | Search TMDB |
| `GET` | `/movies/popular` | TMDB popular |
| `GET` | `/movies/now-playing` | TMDB now playing |
| `GET` | `/movies/upcoming` | TMDB upcoming |
| `GET` | `/movies/{tmdb_id}` | Full TMDB movie detail (poster/backdrop cached in MinIO) |

#### Movie item shape

```json
{
  "tmdb_id": 550,
  "title": "Fight Club",
  "overview": "...",
  "release_date": "1999-10-15",
  "rating": 8.4,
  "genres": ["Drama", "Thriller"],
  "poster_url": "https://...",
  "backdrop_url": "https://...",
  "in_library": true,
  "has_file": true
}
```

`in_library` and `has_file` are only present on items sourced from Radarr.

### TV Shows

| Method | Path | Description |
|---|---|---|
| `GET` | `/shows/library` | **Primary** — Sonarr library or TMDB popular fallback |
| `GET` | `/shows/search?query=&year=` | Search TMDB |
| `GET` | `/shows/popular` | TMDB popular |
| `GET` | `/shows/top-rated` | TMDB top rated |
| `GET` | `/shows/airing-today` | TMDB airing today |
| `GET` | `/shows/{tmdb_id}` | Full TMDB show detail |

#### Show item shape (Sonarr source)

```json
{
  "tmdb_id": 1396,
  "tvdb_id": 81189,
  "title": "Breaking Bad",
  "overview": "...",
  "first_air_date": "2008-01-20",
  "rating": 9.5,
  "genres": ["Drama", "Crime"],
  "poster_url": "https://...",
  "backdrop_url": "https://...",
  "in_library": true
}
```

Note: Sonarr items without a `tmdbId` are filtered out (TVDB-only shows cannot be linked to the TMDB detail page).

### Self-hosted Library (ID-only, for badge overlay)

| Method | Path | Description |
|---|---|---|
| `GET` | `/library/radarr` | `{ "tmdb_ids": [...] }` — list of TMDB IDs in Radarr (5 min cache) |
| `GET` | `/library/sonarr` | `{ "tmdb_ids": [...] }` — list of TMDB IDs in Sonarr (5 min cache) |

These are used by the frontend to overlay "IN LIBRARY" badges on TMDB-sourced browse tabs (Popular, Now Playing, etc.).

### Places / Dining / Hiking / Arts

| Method | Path | Description |
|---|---|---|
| `GET` | `/places/search` | Text search via Google Places |
| `GET` | `/places/nearby` | Nearby search via Google Places |
| `GET` | `/places/{place_id}` | Place detail + photos (cached in MinIO) |
| `GET` | `/hikes/search` | Park/trail search |
| `GET` | `/hikes/nearby` | Nearby parks |
| `GET` | `/hikes/{place_id}` | Hike detail |
| `GET` | `/arts/search` | Museum/gallery search |
| `GET` | `/arts/{place_id}` | Arts venue detail |
| `GET` | `/geocode?address=` | Address → lat/lng |

### Books

| Method | Path | Description |
|---|---|---|
| `GET` | `/books/search?query=` | Search Google Books |
| `GET` | `/books/isbn/{isbn}` | Lookup by ISBN |
| `GET` | `/books/{volume_id}` | Book detail (cover cached in MinIO) |

### Games

| Method | Path | Description |
|---|---|---|
| `GET` | `/games/search?query=` | Search IGDB |
| `GET` | `/games/popular` | Popular games from IGDB |
| `GET` | `/games/{igdb_id}` | Game detail (cover cached in MinIO) |

### Personalized Discover Feed

| Method | Path | Description |
|---|---|---|
| `POST` | `/preferences/load` | Bulk-fetch and cache items for all user activities |
| `GET` | `/users/{user_id}/discover/{activity_type}` | Return cached discover feed for user |

`activity_type` values: `dining`, `hiking`, `arts`, `movies`, `books`, `gaming`

### API Usage & Cache Admin

| Method | Path | Description |
|---|---|---|
| `GET` | `/api-usage?days=30` | Per-API call counts, totals, limits |
| `PUT` | `/api-usage/limits` | Update daily call limits |
| `GET` | `/cache/stats` | Cache hit/miss stats |
| `DELETE` | `/cache/{type}` | Flush cache by type |

Valid cache types: `places`, `books`, `movies`, `shows`, `games`, `hikes`, `arts`, `library`

---

## Caching

| Data type | TTL |
|---|---|
| Search results | 24 hours |
| Detail records (movie/show/book/game/place) | 7 days (PostgreSQL) |
| List results (popular, now playing, etc.) | 6 hours |
| Radarr/Sonarr library (ID lists) | 5 minutes |
| `/movies/library` + `/shows/library` | 5 minutes |
| Geocode results | 30 days |

Images (posters, backdrops, covers, place photos) are fetched once and stored permanently in MinIO.

---

## Frontend Integration

The web discover pages (`DiscoverMovies.jsx`, `DiscoverShows.jsx`) call `GET /config` on mount to determine which integrations are active, then build tabs dynamically:

| Configuration | Default tab | Available tabs |
|---|---|---|
| Radarr + TMDB | Library | Library, My Feed, Popular, Now Playing, Upcoming |
| Radarr only | Library | Library, My Feed |
| TMDB only | My Feed | My Feed, Popular, Now Playing, Upcoming |
| Neither | My Feed | My Feed |

Same logic applies to shows with Sonarr in place of Radarr.

The `in_library` field on items returned from `/movies/library` and `/shows/library` drives the green "IN LIBRARY" badge directly — no separate `/library/radarr` fetch needed for those tabs. The ID-only endpoints are still used to badge items on TMDB browse tabs.
