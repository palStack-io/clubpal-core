# ClubPal Core

**ClubPal** is a social events app for recurring friend groups — track whose turn it is to host, schedule outings, rate experiences, and keep everyone in the loop.

This repository contains the full self-hosted stack: seven FastAPI microservices, a React web UI, PostgreSQL, local filesystem object storage, and Nginx — all orchestrated with Docker Compose.

---

## What's inside

| Layer | Stack |
|---|---|
| Web UI | React 18 · Vite 5 · Tailwind CSS |
| API services | Python 3.11 · FastAPI · uvicorn |
| Database | PostgreSQL 15 (one database per service) |
| Object storage | Local filesystem (shared Docker volume) |
| Reverse proxy | Nginx 1.25 |
| Containerisation | Docker Compose |
| CI | GitHub Actions → ghcr.io |

Everything runs on a **single host port** — `9000` — behind Nginx.

---

## Quick start

### Prerequisites

- Docker ≥ 24 and Docker Compose ≥ 2.20
- (optional) Node 20 + npm for local frontend dev with hot reload

### 1. Clone and configure

```bash
git clone https://github.com/<your-org>/clubpal_core
cd clubpal_core
cp .env.example .env
# Edit .env — set SMTP credentials and change passwords for production
```

### 2. Start the stack

```bash
docker compose up --build -d
```

First boot initialises all six databases and creates the local storage directories automatically. Give it ~30 seconds.

### 3. Open the app

| URL | What you get |
|---|---|
| `http://localhost:9000` | ClubPal web UI |
| `http://localhost:9000/docs/auth` | API Gateway Swagger |
| `http://localhost:9000/docs/groups` | Groups Service Swagger |
| `http://localhost:9000/docs/events` | Events Service Swagger |
| `http://localhost:9000/docs/ratings` | Ratings Service Swagger |
| `http://localhost:9000/docs/activities` | Activities Service Swagger |
| `http://localhost:9000/docs/enrich` | Enrichment Service Swagger |

---

## Repository layout

```
clubpal_core/
├── docker-compose.yml          # Full stack orchestration
├── .env.example                # Environment variable reference
├── .gitignore
├── .dockerignore
│
├── nginx/
│   ├── Dockerfile              # Multi-stage: Node builds web → Nginx serves it
│   └── nginx.conf              # Reverse proxy + rate limiting + SPA fallback
│
├── web/                        # React + Vite frontend
│   ├── src/
│   │   ├── api/                # Axios clients (one per service)
│   │   ├── components/         # Shared UI components
│   │   └── pages/              # Route-level page components
│   ├── index.html
│   └── package.json
│
├── backend/
│   ├── pg-init/
│   │   └── init-databases.sh   # Creates all 6 PostgreSQL databases at first boot
│   └── services/
│       ├── api-gateway/        # :8001 — auth, users, invites, file uploads
│       ├── groups-service/     # :8002 — groups, members, rotation, comments
│       ├── events-service/     # :8003 — events, attendees, comments, images
│       ├── ratings-service/    # :8004 — ratings, stats, leaderboard
│       ├── activities-service/ # :8005 — activity types and categories
│       └── enrichment-service/ # :8006 — external API cache (Places, TMDB, IGDB)
│
├── docs/
│   └── ARCHITECTURE.md         # Deep-dive: services, schemas, auth, env vars
│
└── .github/
    └── workflows/
        └── docker-build.yml    # Build + push to ghcr.io on push to main
```

Each service folder follows the same structure:

```
<service>/
├── Dockerfile
├── requirements.txt
└── app/
    ├── main.py       # FastAPI app + routes
    ├── models.py     # Pydantic request/response models
    ├── database.py   # psycopg2 data access layer
    └── storage.py    # local filesystem storage helpers (where applicable)
```

---

## Services

### API Gateway — `/api/gateway/` → `:8001`

Owns all user identity concerns.

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Register + auto-login |
| POST | `/auth/login` | — | Login, returns session token |
| POST | `/auth/logout` | Bearer | Invalidate session |
| GET | `/auth/me` | Bearer | Current user profile |
| POST | `/auth/verify-email` | — | Confirm email token |
| POST | `/auth/forgot-password` | — | Request password reset link |
| POST | `/auth/reset-password` | — | Apply new password via token |
| POST | `/invites/send` | Bearer | Send group invite by email |
| POST | `/invites/validate` | — | Check invite token details |
| POST | `/invites/accept` | — | Accept invite, creates account if needed |
| POST | `/users/me/avatar/upload-url` | Bearer | Pre-signed PUT URL for avatar upload |
| GET/PUT | `/admin/integrations` | Bearer (admin) | Manage backend API keys |

### Groups Service — `/api/groups/` → `:8002`

| Method | Path | Description |
|---|---|---|
| POST | `/groups` | Create group |
| GET | `/groups/{id}` | Group detail + member count |
| GET | `/users/{id}/groups` | Groups a user belongs to |
| PATCH | `/groups/{id}` | Update group (including background) |
| DELETE | `/groups/{id}` | Delete group |
| POST | `/groups/{id}/members` | Add member |
| GET/PATCH/DELETE | `/groups/{id}/members/{uid}` | Manage member |
| GET | `/groups/{id}/rotation` | Current rotation turn |
| POST | `/groups/{id}/rotation/advance` | Move to next person |
| POST | `/groups/{id}/rotation/reset` | Restart rotation |
| POST | `/groups/{id}/rotation/set` | Set specific person as current |
| POST | `/groups/{id}/comments` | Add comment |
| GET | `/groups/{id}/comments` | List comments |
| DELETE | `/groups/{id}/comments/{cid}` | Delete comment (author only) |
| POST | `/groups/{id}/banner/upload-url` | Pre-signed PUT URL for group banner |

### Events Service — `/api/events/` → `:8003`

| Method | Path | Description |
|---|---|---|
| POST | `/events` | Create event |
| GET | `/events/{id}` | Event detail + attendees + activity name |
| PATCH | `/events/{id}` | Update event (including background) |
| DELETE | `/events/{id}` | Delete event (host/creator only) |
| GET | `/groups/{id}/events` | Events for a group |
| GET | `/users/{id}/events` | Events a user is attending |
| POST | `/events/{id}/attendees` | Add attendee |
| GET/PATCH/DELETE | `/events/{id}/attendees/{uid}` | Manage attendee |
| POST | `/events/{id}/comments` | Add comment (supports `[gif:URL]` inline GIFs) |
| GET | `/events/{id}/comments` | List comments |
| DELETE | `/events/{id}/comments/{cid}` | Delete comment (author only) |
| POST | `/events/{id}/image/upload-url` | Pre-signed PUT URL for event cover image |
| GET | `/events/{id}/history` | Audit log |

### Ratings Service — `/api/ratings/` → `:8004`

| Method | Path | Description |
|---|---|---|
| POST | `/ratings` | Submit a rating |
| GET/PATCH/DELETE | `/ratings/{id}` | Manage rating |
| GET | `/events/{id}/ratings` | All ratings for an event |
| GET | `/users/{id}/stats` | Aggregate stats for a user |
| GET | `/events/{id}/stats` | Aggregate stats for an event |
| GET | `/groups/{id}/leaderboard` | Ranked member stats |

### Activities Service — `/api/activities/` → `:8005`

| Method | Path | Description |
|---|---|---|
| GET | `/activities` | List all activity types |
| GET | `/activities/search` | Search by name/category |
| GET | `/activities/popular` | Top N by usage |
| POST | `/activities/{id}/increment-usage` | Record usage |

### Enrichment Service — `/api/enrich/` → `:8006`

| Method | Path | Description |
|---|---|---|
| GET | `/places/search` | Venue/restaurant search (Google Places) |
| GET | `/places/{id}` | Place detail |
| GET | `/movies/search` | Movie search (TMDB) |
| GET | `/movies/{id}` | Movie detail |
| GET | `/shows/search` | TV show search (TMDB) |
| GET | `/shows/popular` | Popular TV shows (TMDB) |
| GET | `/shows/top-rated` | Top-rated TV shows (TMDB) |
| GET | `/shows/airing-today` | Currently airing shows (TMDB) |
| GET | `/shows/{id}` | TV show detail |
| GET | `/library/radarr` | TMDB IDs of movies in Radarr (system-wide, 5 min cache) |
| GET | `/library/sonarr` | TMDB IDs of shows in Sonarr (system-wide, 5 min cache) |
| GET | `/books/search` | Book search (Google Books) |
| GET | `/games/search` | Game search (IGDB) |
| GET | `/geocode` | Address → coordinates (Google) |
| GET | `/api-usage` | Call counts and cache-hit rate per API |
| GET/PUT/DELETE | `/admin/integrations` | Manage API keys (admin only) |

---

## Environment variables

Copy `.env.example` to `.env` before running. Defaults work for local dev.

### Core (required)

| Variable | Default | Used by |
|---|---|---|
| `POSTGRES_PASSWORD` | `clubpal` | db |
| `STORAGE_PUBLIC_URL` | `http://localhost:9000/storage` | api-gateway, groups, events, enrichment |
| `FRONTEND_URL` | `http://localhost:9000` | api-gateway (email links) |

### Email (optional — leave blank to disable)

| Variable | Default |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | _(empty)_ |
| `SMTP_PASSWORD` | _(empty)_ |
| `FROM_EMAIL` | `noreply@clubpal.app` |
| `FROM_NAME` | `clubPal` |

### Enrichment / external APIs (all optional)

| Variable | Enables |
|---|---|
| `GOOGLE_API_KEY` | Venue search, book search, geocoding |
| `TMDB_API_KEY` | Movie and TV metadata |
| `IGDB_CLIENT_ID` + `IGDB_CLIENT_SECRET` | Video game metadata |
| `RADARR_URL` | "In Library" badge on movie cards (e.g. `http://192.168.1.10:7878`) |
| `RADARR_API_KEY` | Radarr authentication |
| `SONARR_URL` | "In Library" badge on TV show cards (e.g. `http://192.168.1.10:8989`) |
| `SONARR_API_KEY` | Sonarr authentication |

> All external keys can also be set at runtime by an admin user via **Admin Panel → Integrations** in the web UI — no restart required.

> **Radarr / Sonarr are system-wide.** A single admin configures one Radarr instance and one Sonarr instance for the entire ClubPal deployment. The "In Library" badge is visible to **all users** on the discover pages — it reflects a shared server library, not a per-user or per-group collection.

### GIF search (Tenor)

End users can add their own free Tenor API key via **Settings → Integrations**. The key is saved to `localStorage` in their browser. You can also set `VITE_TENOR_API_KEY` at build time as a shared fallback. Without any key, the GIF picker shows a curated category grid and supports pasting direct URLs.

Get a free key: <https://developers.google.com/tenor/guides/quickstart>

---

## Object storage

Three buckets are created automatically at startup:

| Bucket | Access | Contents | Upload endpoint |
|---|---|---|---|
| `clubpal-avatars` | public read | User profile photos | `POST /api/gateway/users/me/avatar/upload-url` |
| `clubpal-events` | public read | Event/group cover images | `POST /api/events/events/{id}/image/upload-url` |
| `clubpal-cache` | private | Enrichment API response cache | — (internal) |

**Upload flow:**
1. Client calls the upload-url endpoint → receives `{ upload_url, public_url, object_name }`
2. Client PUTs the file directly to `upload_url` (pre-signed, 15 min TTL)
3. Client saves `public_url` to the record via a separate PATCH call
4. Anyone can GET `public_url` — served through nginx at `/storage/`

---

## Development

### Local frontend dev (hot reload)

```bash
cd web
npm install
npm run dev
# Vite dev server at http://localhost:5173
# Assumes the full stack is running via docker compose on :9000
```

### Run a single backend service locally

```bash
cd backend/services/api-gateway
pip install -r requirements.txt
DATABASE_URL=postgresql://clubpal:clubpal@localhost:5432/clubpal_gateway \
  uvicorn app.main:app --reload --port 8001
```

### Rebuild only changed services

```bash
docker compose up --build api-gateway -d
docker compose up --build nginx -d        # also rebuilds the React frontend
```

### View logs

```bash
docker compose logs -f api-gateway
docker compose logs -f nginx
```

---

## CI / CD

On every push to `main`, GitHub Actions builds and pushes all Docker images to the GitHub Container Registry (`ghcr.io`). On pull requests, the workflow builds but does not push (validates Dockerfiles only).

| Image | Tags |
|---|---|
| `ghcr.io/<owner>/clubpal-nginx` | `latest`, `<git-sha>` |
| `ghcr.io/<owner>/clubpal-api-gateway` | `latest`, `<git-sha>` |
| `ghcr.io/<owner>/clubpal-groups-service` | `latest`, `<git-sha>` |
| `ghcr.io/<owner>/clubpal-events-service` | `latest`, `<git-sha>` |
| `ghcr.io/<owner>/clubpal-ratings-service` | `latest`, `<git-sha>` |
| `ghcr.io/<owner>/clubpal-activities-service` | `latest`, `<git-sha>` |
| `ghcr.io/<owner>/clubpal-enrichment-service` | `latest`, `<git-sha>` |

The workflow uses `GITHUB_TOKEN` — no extra secrets required. All six service builds run in parallel via a matrix job.

---

## Stopping and resetting

```bash
# Stop without removing data
docker compose down

# Stop and wipe all data (databases + object storage)
docker compose down -v
```

---

## Further reading

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — deep-dive into every service, database schema, auth flow, nginx routing, and environment variables
