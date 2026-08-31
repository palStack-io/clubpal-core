# ClubPal Core — Architecture

## Overview

ClubPal Core is a containerised, microservice-based backend with a co-located React web UI. Every external request (browser or mobile client) enters through a single Nginx reverse proxy on port 9000, which routes to the appropriate service based on URL prefix.

```
                          ┌──────────────────────────────────────────────────────────┐
                          │                    Host port 9000                        │
                          │                                                          │
  Browser / Mobile ──────►│                    nginx :80                             │
                          │                                                          │
                          │  /api/gateway/    ──► api-gateway       :8001             │
                          │  /api/groups/     ──► groups-service    :8002             │
                          │  /api/events/     ──► events-service    :8003             │
                          │  /api/ratings/    ──► ratings-service   :8004             │
                          │  /api/activities/ ──► activities-svc    :8005             │
                          │  /api/enrich/     ──► enrichment-svc    :8006             │
                          │  /storage/        ──► local filesystem (shared volume)     │
                          │  /                ──► static files (React SPA)            │
                          └──────────────────────────────────────────────────────────┘

  All services ───────────────────────────────────────────────────► PostgreSQL :5432
```

---

## Service Responsibilities

### Nginx
- Single entry point; every connection comes through here
- Serves the React SPA from `/usr/share/nginx/html` with SPA fallback (`try_files`)
- Prefix-strips each `/api/<service>/` path before forwarding (e.g. `/api/groups/groups/1` → `groups-service/groups/1`)
- Serves `/storage/` directly from the shared `storage_data` volume (local filesystem, image extensions only)
- Rate limiting: auth routes 10 req/min, general API 100–500 req/min
- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`
- Caches static assets with 1-year `immutable` headers

### API Gateway (`:8001`)
Owns all user identity concerns:
- Registration, login, session management (opaque bearer tokens stored in DB)
- Email verification and password reset flows (sends emails via SMTP)
- Group invite lifecycle: generate token → email → validate → accept
- Admin user management and integration key storage
- Avatar upload: direct multipart upload to local storage
- **In-app notifications**: stores per-user notification feed (`user_notifications`); exposes read/mark-read endpoints consumed by mobile and web
- **Push notifications**: stores Expo push tokens (`user_push_tokens`); sends batch push messages to group members via the Expo Push API on events such as new events, rotation alerts, and new polls
- **Internal notification fanout** (`POST /internal/notify/event`): called by groups-service and events-service; creates in-app notifications for all group members, sends Expo push messages, and dispatches email to opted-in members

### Groups Service (`:8002`)
Owns social graph and hosting rotation:
- CRUD for groups and group membership (roles: `owner`, `admin`, `member`)
- Rotation engine: tracks whose turn it is to host; supports sequential, random, and manual modes
- Rotation state is stored per-group; can be advanced, reset, or set to a specific member
- Group comments thread (add, list, delete)
- Custom backgrounds: `bg_type`, `bg_value`, `bg_scope` columns for group personalisation
- Group banner/cover image: direct multipart upload to local storage
- **Group Pulse (pre-event polls)**: picker creates a poll for an activity; group members tap one of four responses (in / done_loved / done_pass / cant_make_it); results are hidden until the user has responded; picker can convert a poll directly into a scheduled event or link it to an existing recurring series
- **Most-visited ordering** (added July 2026): `group_members.visit_count` + `last_visited_at` track how often/recently each member opens a club; `POST /groups/{group_id}/visit` bumps them (no-op for non-members); the web dashboard and My Clubs list order clubs most-visited first

### Events Service (`:8003`)
Owns everything about a scheduled outing:
- Event creation (auto-assigns host from rotation if not specified)
- Attendee management with status tracking (`attending`, `maybe`, `declined`)
- Comments thread per event with GIF support (`[gif:URL]` inline format)
- Event audit history log
- Event cover image / custom backgrounds: direct multipart upload to local storage
- Calls Groups Service to resolve the current rotation user
- Calls Activities Service to resolve activity names for display
- **Recurring schedules**: `recurring_schedules` table tracks repeating outings (weekly/biweekly/monthly with optional end date); a daily APScheduler job (`spawn_recurring_instances`) auto-creates the next event instance when `next_occurrence` is due
- **Poll → Event conversion**: when a Group Pulse poll is converted to an event, the caller may pass `parent_recurring_id`; the service links the new event to the recurring series and advances `next_occurrence` to prevent the daily job from creating a duplicate

### Ratings Service (`:8004`)
Owns post-event feedback:
- Ratings are per `(rater_user_id, rated_user_id, event_id)` — prevents duplicates
- Maintains pre-computed `user_stats` table (total ratings, average score, hosted count)
- Group leaderboard: ordered user stats filtered to a given group's member list

### Activities Service (`:8005`)
Owns a shared library of activity types:
- Activities have a name, category, and usage count
- Seeds ~30 default activities on first boot (sport, social, outdoor, etc.)
- Provides search and "popular activities" endpoints for the UI picker

### Enrichment Service (`:8006`)
Caches and serves external API data, decoupling third-party calls from the frontend:
- **Google Places** — venue/restaurant search and geocoding
- **Google Books** — book search and metadata
- **TMDB** — movie and TV metadata (movies + TV shows)
- **IGDB** — video game metadata
- **Radarr** — read-only movie library check (`GET /library/radarr` → list of TMDB IDs, 5 min cache)
- **Sonarr** — read-only TV library check (`GET /library/sonarr` → list of TMDB IDs, 5 min cache)
- Images are cached to local storage with configurable TTLs (search: 24 h, detail: 7 d, geocode: 30 d)
- Admin API key management: store/retrieve/remove external API keys via `PUT /admin/integrations`
- API usage tracking: call counts and cache-hit rate per service (`GET /api-usage`)

**Radarr / Sonarr are system-wide integrations.** An admin configures a single Radarr URL+key and a single Sonarr URL+key for the whole deployment (via Settings → Integrations or env vars). The resulting "In Library" badge is shown to **all users** on the discover pages — it reflects the server's shared media library, not per-user or per-group ownership. If neither service is configured, no badges appear and no errors are raised.

---

## Data Architecture

Each service has its own PostgreSQL database — they share the same Postgres instance but never share tables. Inter-service data is fetched at query time via internal HTTP calls (no shared foreign keys across services).

```
PostgreSQL :5432
├── clubpal_gateway      # users, sessions, invite_tokens, verification_tokens, reset_tokens
│                        # user_push_tokens, user_notifications
├── clubpal_groups       # groups, group_members, rotation_state, group_comments
│                        # group_polls, group_poll_responses
├── clubpal_events       # events, event_attendees, event_comments, event_history
│                        # recurring_schedules, event_photos
├── clubpal_ratings      # ratings, user_stats
├── clubpal_activities   # activities
└── clubpal_enrichment   # api_keys, api_usage_stats (image cache stored on local storage)
```

All databases are created by `backend/pg-init/init-databases.sh`, which runs automatically on the first Postgres container boot via the `docker-entrypoint-initdb.d` mechanism.

### Schema highlights

**api-gateway / `clubpal_gateway`**
```
users               id, username, email, password_hash, full_name, is_admin,
                    email_verified, avatar_url, created_at, last_login_at
sessions            token, user_id, expires_at, created_at
invite_tokens       token, email, invited_by, group_id, accepted, expires_at
verification_tokens token, user_id, expires_at, used
reset_tokens        token, user_id, expires_at, used
user_push_tokens    id, user_id, token, platform, updated_at
                    — stores Expo push tokens per device; UNIQUE(user_id, token)
user_notifications  id, user_id, type, title, body, link_type, link_id,
                    read, created_at
                    — in-app notification feed; link_type ∈ event|group|poll
```

**groups-service / `clubpal_groups`**
```
groups              id, name, description, activity_type, rotation_type,
                    bg_type, bg_value, bg_scope,
                    banner_url, created_by, created_at, updated_at
group_members       group_id, user_id, role, rotation_order, joined_at
rotation_state      group_id, current_user_id, current_turn_index, updated_at
group_comments      id, group_id, user_id, content, created_at
group_polls         id, group_id, created_by, activity_name, activity_type,
                    activity_id, note, deadline, status, converted_event_id,
                    created_at
                    — status ∈ open|closed|converted
group_poll_responses  id, poll_id, user_id, response, responded_at
                    — response ∈ in|done_loved|done_pass|cant_make_it
                    — UNIQUE(poll_id, user_id)
```

**events-service / `clubpal_events`**
```
events              id, group_id, activity_type, title, description,
                    scheduled_date, location, host_user_id,
                    status, cover_url, bg_type, bg_value, bg_scope,
                    parent_recurring_id,
                    created_by, created_at, updated_at
event_attendees     event_id, user_id, rsvp_status, responded_at
event_comments      id, event_id, user_id, content, created_at
event_history       id, event_id, action, changed_by, details, created_at
event_photos        id, event_id, user_id, object_key, public_url, created_at
recurring_schedules id, group_id, activity_id, title, description, location,
                    host_user_id, created_by, recurrence_rule, day_of_week,
                    time_of_day, next_occurrence, end_date, is_active
                    — recurrence_rule ∈ weekly|biweekly|monthly
```

**ratings-service / `clubpal_ratings`**
```
ratings             id, event_id, rater_user_id, rated_user_id,
                    score, comment, created_at, updated_at
user_stats          user_id, total_ratings, average_score, total_hosted_events,
                    score_1..5_count, last_updated
```

**activities-service / `clubpal_activities`**
```
activities          id, name, category, description, usage_count,
                    created_at, updated_at
```

**enrichment-service / `clubpal_enrichment`**
```
api_keys            key_name, encrypted_value, source, updated_at
api_usage_stats     api_name, total_calls, cache_hits, last_called_at
```

---

## Object Storage

Uploaded files live on a local filesystem, on a single Docker volume (`storage_data`) shared read-write by api-gateway, groups-service, events-service, and enrichment-service, and mounted read-only into nginx. There is no S3-compatible store — each service's `app/storage.py` writes bytes straight to `/data/storage/<bucket>/<object>` and nginx serves that same path back out under `/storage/`.

### Buckets (subdirectories)

| Bucket | Contents |
|---|---|
| `clubpal-avatars` | User profile photos |
| `clubpal-events` | Event cover images and group banners |
| `clubpal-cache` | Enrichment service's cached poster/backdrop/cover images |

### Upload flow

```
1. Client → POST /api/gateway/users/me/avatar/upload   (multipart/form-data)

2. api-gateway:
   - sniffs the file's magic bytes to confirm it's really JPEG/PNG/GIF/WebP
   - strips EXIF metadata by re-encoding through Pillow
   - generates a server-side object name (uuid + validated extension —
     never derived from the client-supplied filename)
   - writes the bytes to /data/storage/clubpal-avatars/<object_name>
   - updates the user's avatar_url in the DB

3. Returns: { avatar_url: public_url }
```

Every write path validates the object name against a strict `[A-Za-z0-9/_.-]+` pattern and a fixed image-extension whitelist before touching disk (`app/storage.py:_safe_path` in each service) — this is what stands in for S3 key-namespacing now that writes go straight to a real filesystem.

### Public URL pattern

```
http://<host>:9000/storage/<bucket>/<object>
         ↕ nginx alias (read-only mount of storage_data)
/data/storage/<bucket>/<object>
```

nginx additionally restricts `/storage/` to the same image-extension whitelist (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`) — any other file on the volume 404s rather than being served/rendered.

---

## Authentication

The api-gateway issues opaque session tokens (UUID v4) stored in the `sessions` table with an expiry timestamp. There is no JWT — the gateway validates the token on every request by doing a DB lookup.

Services other than the api-gateway do **not** validate tokens. They trust the `user_id` query parameter passed by the frontend directly. In production behind a trusted nginx, this is acceptable; for hardened deployments, add a gateway-forwarded header or move auth to nginx middleware.

### Session lifecycle

```
Register/Login → create_session() → Bearer token returned to client
Request        → get_user_by_session(token) → user dict or 401
Logout         → delete_session(token)
Startup        → cleanup_expired_sessions() (prunes old rows)
```

### Social / OIDC Login (Google + Apple)

The api-gateway supports sign-in via external identity providers using the OIDC standard.

**Endpoint:** `POST /auth/oidc`
**Body:** `{ "provider": "google"|"apple", "id_token": "...", "access_token": "..." }`

Either `id_token` (a signed JWT) or `access_token` (opaque — the gateway calls the provider's userinfo endpoint) may be sent. The mobile app sends an **access token** for Google (via `expo-auth-session`) and an **id_token** for Apple (via `expo-apple-authentication`). The web app sends an **id_token** for Google (via `@react-oauth/google`).

**Provider configuration:**

| Provider | How to enable | Config location |
|---|---|---|
| Google | Set `GOOGLE_CLIENT_ID` env var | api-gateway environment |
| Apple | Add to `OIDC_PROVIDERS` JSON array | api-gateway environment |
| Other OIDC | Add to `OIDC_PROVIDERS` JSON array | api-gateway environment |

`OIDC_PROVIDERS` format:
```json
[{"name":"apple","client_id":"io.palstack.clubpal","discovery_url":"https://appleid.apple.com/.well-known/openid-configuration"}]
```

**Account linking behaviour:**
- **Google:** if the provider email matches an existing account, the accounts are auto-linked (Google is a trusted email-verified provider).
- **Apple + others:** a `409` response is returned with a `link_token`. The client presents a confirmation prompt; the user confirms by calling `POST /auth/oidc/confirm-link` with `{ link_token }`.

**Web frontend:** Google button only renders when `VITE_GOOGLE_CLIENT_ID` is set at Vite build time (passed as a Docker build arg from `GOOGLE_CLIENT_ID`). No Google button = `VITE_GOOGLE_CLIENT_ID` is empty.

**Mobile:** Google uses `expo-auth-session`; Apple uses `expo-apple-authentication` (native module — requires dev build or production binary, not Expo Go). Apple Sign In requires the `com.apple.developer.applesignin` entitlement in `app.json` and "Sign In with Apple" capability enabled in the Apple Developer portal for bundle ID `io.palstack.clubpal`.

### Member invite flows

Two parallel flows for adding someone to a group:

| Flow | Trigger | Backend call | Result |
|---|---|---|---|
| **Username search → direct add** | Admin types username in "Add Member" modal, selects from dropdown | `POST /groups/{id}/members { user_id }` | User added immediately; "Added to Group" notification sent |
| **Email invite** | Admin types an email address in the same modal, queues it, clicks "Send Invites" | `POST /invites/send { email, group_id, group_name }` (api-gateway) | Invite email sent with a join link; user added when they accept |

Both flows share the same unified `InviteMemberModal` component (web) — the input auto-detects username vs email based on whether the typed value contains `@`.

### Email flows

All email is sent from the api-gateway via SMTP. Templates are embedded in `email_service.py`.

| Trigger | Email sent |
|---|---|
| Register | Verification link |
| Resend verification | New verification link |
| Forgot password | Password reset link |
| Group invite | Invite link (different template if user already exists) |
| New event / recurring event created | "New event" email to opted-in group members |
| Rotation advance | "Your turn!" email to next picker |
| RSVP deadline approaching (<25 h) | Reminder to non-responders |
| RSVP deadline passed | Final headcount to event creator |
| New Group Pulse poll created | "Vote now" email with 4 response options to opted-in members |

---

## Nginx Routing Detail

```nginx
/api/gateway/     → proxy_pass http://api_gateway/;        # strips /api/gateway/
/api/groups/      → proxy_pass http://groups_service/;     # strips /api/groups/
/api/events/      → proxy_pass http://events_service/;     # strips /api/events/
/api/ratings/     → proxy_pass http://ratings_service/;    # strips /api/ratings/
/api/activities/  → proxy_pass http://activities_service/;
/api/enrich/      → proxy_pass http://enrichment_service/;
/storage/         → alias /data/storage/;                   # local filesystem, image types only
/                 → static files with SPA fallback
```

Swagger UI is proxied for development convenience:

```
/docs/auth        → api-gateway /docs
/docs/groups      → groups-service /docs
/docs/events      → events-service /docs
/docs/ratings     → ratings-service /docs
/docs/activities  → activities-service /docs
/docs/enrich      → enrichment-service /docs
```

Rate limit zones:
- `auth_limit` (10 req/min) — applied to `/api/gateway/`
- `general_limit` (100–500 req/min) — applied to all other API routes

---

## Environment Variables Reference

### Required for local dev (defaults in `.env.example` work as-is)

| Variable | Default | Service | Purpose |
|---|---|---|---|
| `POSTGRES_PASSWORD` | `clubpal` | db | PostgreSQL password for the `clubpal` user |
| `STORAGE_PUBLIC_URL` | `http://localhost:9000/storage` | api-gateway, groups, events, enrichment | Base URL browsers use to load uploaded files |
| `FRONTEND_URL` | `http://localhost:9000` | api-gateway | Base URL used in email links |

### Security (optional but recommended for internet-facing deployments)

| Variable | Default | Service | Purpose |
|---|---|---|---|
| `INTERNAL_API_SECRET` | _(empty)_ | api-gateway, enrichment-service | Shared secret that protects internal endpoints. When set, the enrichment service must include it as an `X-Internal-Secret` header; requests without a matching header are rejected with 403. Safe to leave blank on a private LAN — the gateway will log a warning at startup as a reminder. Generate a value with `openssl rand -hex 32`. |

### Social / OIDC login (optional — app works without it)

| Variable | Default | Service | Purpose |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | _(empty)_ | api-gateway | Web OAuth 2.0 client ID — enables Google Sign-In. Also passed as the Vite build arg `VITE_GOOGLE_CLIENT_ID` so the web login page renders the Google button. Without this, the Google button is hidden on the web and the backend rejects Google tokens. |
| `OIDC_PROVIDERS` | `[]` | api-gateway | JSON array of additional OIDC providers. **Required for Apple Sign-In.** Format: `[{"name":"apple","client_id":"io.palstack.clubpal","discovery_url":"https://appleid.apple.com/.well-known/openid-configuration"}]`. Without this, Apple login returns `400 Unknown or unconfigured OIDC provider: apple`. |

### Email delivery (optional — app works without it)

| Variable | Default | Purpose |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP port (587 = STARTTLS, 465 = SSL) |
| `SMTP_USER` | _(empty)_ | SMTP username / email address |
| `SMTP_PASSWORD` | _(empty)_ | SMTP password or app password |
| `FROM_EMAIL` | `noreply@clubpal.app` | Sender address on outgoing emails |
| `FROM_NAME` | `clubPal` | Sender display name |

### Enrichment service — external APIs (all optional)

| Variable | Default | Enables |
|---|---|---|
| `GOOGLE_API_KEY` | _(empty)_ | Venue/restaurant search (Places), book search, geocoding |
| `TMDB_API_KEY` | _(empty)_ | Movie and TV metadata search |
| `IGDB_CLIENT_ID` | _(empty)_ | Video game search (requires Twitch account) |
| `IGDB_CLIENT_SECRET` | _(empty)_ | Video game search (requires Twitch account) |
| `RADARR_URL` | _(empty)_ | Radarr base URL — enables "In Library" badges on movie cards (system-wide) |
| `RADARR_API_KEY` | _(empty)_ | Radarr API key |
| `SONARR_URL` | _(empty)_ | Sonarr base URL — enables "In Library" badges on TV show cards (system-wide) |
| `SONARR_API_KEY` | _(empty)_ | Sonarr API key |
| `CACHE_TTL_SEARCH` | `86400` | Search result cache TTL in seconds (24 h) |
| `CACHE_TTL_DETAIL` | `604800` | Item detail cache TTL in seconds (7 d) |
| `CACHE_TTL_GEOCODE` | `2592000` | Geocode cache TTL in seconds (30 d) |

All Radarr/Sonarr vars can alternatively be set at runtime by an admin via **Settings → Integrations** — no restart required. See the [Radarr/Sonarr system-wide note](#enrichment-service-8006) above.

### Build-time (frontend / nginx image)

| Variable | Default | Purpose |
|---|---|---|
| `VITE_GATEWAY_URL` | `/api/gateway` | API Gateway base URL used by the React app |
| `VITE_GROUPS_URL` | `/api/groups` | Groups Service base URL |
| `VITE_EVENTS_URL` | `/api/events` | Events Service base URL |
| `VITE_RATINGS_URL` | `/api/ratings` | Ratings Service base URL |
| `VITE_ACTIVITIES_URL` | `/api/activities` | Activities Service base URL |
| `VITE_ENRICH_URL` | `/api/enrich` | Enrichment Service base URL |
| `VITE_GOOGLE_CLIENT_ID` | _(empty)_ | Google OAuth client ID — when set, renders the Google Sign-In button on `/login`. Automatically sourced from `GOOGLE_CLIENT_ID` by the Docker build arg in `docker-compose.yml`. |
| `VITE_TENOR_API_KEY` | _(empty)_ | Tenor GIF search — alternative to per-user localStorage key |

> **Note on Tenor:** end users can also supply their own Tenor API key via **Settings → Integrations** in the UI. The key is saved to `localStorage` in the browser and takes precedence over the build-time env var. This means GIF search works per-user without a server restart.

---

## React Web UI

### Tech stack
- Vite 5 build tool
- React 18 with React Router v6 (client-side routing)
- Tailwind CSS utilities (layout) + inline styles (component-level theming)
- Axios for API calls (via `web/src/api/client.js`)
- No external state management library

### Route map

| Path | Component | Auth required |
|---|---|---|
| `/` | Redirect to `/dashboard` | — |
| `/login` | Login | Guest only |
| `/register` | Register | Guest only |
| `/forgot-password` | ForgotPassword | Guest only |
| `/dashboard` | Dashboard | Yes |
| `/groups` | GroupsList | Yes |
| `/groups/new` | CreateGroup | Yes |
| `/groups/:id` | GroupDetail | Yes |
| `/events/new` | CreateEvent | Yes |
| `/events/:id` | EventDetail | Yes |
| `/events/:id/rate` | RateEvent | Yes |
| `/leaderboard` | Leaderboard | Yes |
| `/activities` | ActivityPicker | Yes |
| `/discover/restaurants` | DiscoverRestaurants | Yes |
| `/discover/restaurants/:id` | RestaurantDetail | Yes |
| `/discover/movies` | DiscoverMovies | Yes |
| `/discover/movies/:id` | MovieDetail | Yes |
| `/discover/books` | DiscoverBooks | Yes |
| `/discover/books/:id` | BookDetail | Yes |
| `/discover/games` | DiscoverGames | Yes |
| `/discover/games/:id` | GameDetail | Yes |
| `/discover/hikes` | DiscoverHikes | Yes |
| `/discover/hikes/:id` | HikeDetail | Yes |
| `/discover/arts` | DiscoverArts | Yes |
| `/discover/arts/:id` | ArtsDetail | Yes |
| `/discover/shows` | DiscoverShows | Yes |
| `/discover/shows/:id` | ShowDetail | Yes |
| `/profile` | Profile | Yes |
| `/settings` | Settings | Yes |
| `*` | NotFound | — |

### API client configuration

The web app uses relative paths so it works identically in dev (Vite proxy) and production (Nginx):

```js
const GATEWAY_URL    = import.meta.env.VITE_GATEWAY_URL    || '/api/gateway'
const GROUPS_URL     = import.meta.env.VITE_GROUPS_URL     || '/api/groups'
const EVENTS_URL     = import.meta.env.VITE_EVENTS_URL     || '/api/events'
const RATINGS_URL    = import.meta.env.VITE_RATINGS_URL    || '/api/ratings'
const ACTIVITIES_URL = import.meta.env.VITE_ACTIVITIES_URL || '/api/activities'
const ENRICH_URL     = import.meta.env.VITE_ENRICH_URL     || '/api/enrich'
```

---

## Docker Build

### Nginx image (multi-stage)

```dockerfile
# Stage 1 — build web UI
FROM node:20-alpine AS web-builder
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ .
RUN npm run build          # output → /web/dist

# Stage 2 — serve with Nginx
FROM nginx:1.25-alpine
COPY --from=web-builder /web/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
```

Build context must be the repo root (`.`) so both `web/` and `nginx/` are accessible.

### Service images

Each backend service has its own minimal Dockerfile:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "80XX"]
```

### Startup order

```
db (postgres healthcheck)
  └── api-gateway
  └── groups-service
  └── activities-service
  └── enrichment-service
       └── events-service (needs groups + activities healthy)
            └── ratings-service (needs groups + events healthy)

storage_data (shared Docker volume, mounted into api-gateway, groups-service,
              events-service, enrichment-service, and read-only into nginx)

nginx (starts last, depends on all services)
```

---

## CI/CD Pipeline

File: `.github/workflows/docker-build.yml`

Triggers:
- `push` to `main` — builds **and pushes** images to `ghcr.io`
- `pull_request` targeting `main` — builds only (no push), validates Dockerfiles
- `workflow_dispatch` — manual trigger from GitHub Actions UI

```
push to main / PR / manual
    │
    ├── build-nginx (single job)
    │       context: . (repo root)
    │       file: nginx/Dockerfile
    │       tags: ghcr.io/<owner>/clubpal-nginx:latest + :<sha>
    │       cache: type=gha, scope=nginx
    │
    └── build-services (matrix: 6 parallel jobs)
            for each of: api-gateway, groups-service, events-service,
                         ratings-service, activities-service, enrichment-service
            context: backend/services/<service>
            tags: ghcr.io/<owner>/clubpal-<service>:latest + :<sha>
            cache: type=gha, scope=<service>
```

Authentication uses `GITHUB_TOKEN` automatically — no extra secrets required.

---

## Inter-Service Communication

Services call each other over the internal Docker network using container hostnames. All calls are fire-and-forget with graceful degradation on failure.

| Caller | Callee | Purpose |
|---|---|---|
| events-service | groups-service | Resolve rotation user when creating event |
| events-service | activities-service | Resolve activity name for event detail response |
| api-gateway | groups-service | Verify user is a group member before sending invite |
| api-gateway | groups-service | Add user to group when accepting invite |
| api-gateway | groups-service | Fetch group members for notification fanout |
| groups-service | api-gateway | Send notification fanout on new poll (`POST /internal/notify/event`) |
| groups-service | events-service | Create event when converting a poll (`POST /events`) |
| groups-service | events-service | Advance recurring schedule after poll → event conversion |
| ratings-service | groups-service | Fetch group member IDs for leaderboard query |
| ratings-service | events-service | Verify event exists when creating a rating |
| enrichment-service | api-gateway | Fetch admin-stored API keys on startup (`GET /internal/integrations`) — sends `X-Internal-Secret` header if `INTERNAL_API_SECRET` is set |

---

## Feature: Group Pulse (Pre-Event Polls)

The picker can send a quick vibe-check to group members before committing to an activity.

### Response vocabulary (universal across all activity types)

| Value | Label | Meaning |
|---|---|---|
| `in` | 🙌 I'm in! | Yes, enthusiastically |
| `done_loved` | ❤️ Done it, loved it | Been there — positive |
| `done_pass` | 👎 Done it, pass | Been there — wouldn't repeat |
| `cant_make_it` | 🚫 Can't make it | Scheduling conflict only |

### Poll lifecycle

```
Picker creates poll (POST /groups/{id}/polls)
  → gateway fanout: in-app notification + Expo push + email to each member
  → poll status = "open"

Members respond (POST /polls/{id}/respond)
  → response is recorded; result breakdown visible after responding
  → "X of Y responded" count always visible

Deadline passes
  → auto-close on next fetch (GET /groups/{id}/polls calls auto_close_expired_polls())
  → status = "closed"

Picker converts (POST /polls/{id}/convert)
  → calls events-service POST /events
  → optional: pass recurring_schedule_id to link event to a recurring series
    (events-service advances next_occurrence immediately to prevent daily-job duplicate)
  → status = "converted", converted_event_id set
```

### Endpoints (groups-service)

| Method | Path | Description |
|---|---|---|
| POST | `/groups/{id}/polls` | Create a poll (picker only) |
| GET | `/groups/{id}/polls` | List polls for a group with per-user summary |
| GET | `/polls/{id}` | Get a single poll + summary |
| POST | `/polls/{id}/respond` | Submit or update a response |
| PUT | `/polls/{id}/close` | Close poll early (creator only) |
| POST | `/polls/{id}/convert` | Convert to event (creator only) |
| GET | `/users/{id}/polls/pending` | Open polls the user hasn't responded to |

---

## Feature: In-App Notifications & Push

### In-app notification feed

Stored in `user_notifications` (gateway DB). Every significant action fans out a notification row per affected user.

| `type` | `link_type` | Trigger |
|---|---|---|
| `event` | `event` | New event created for a group |
| `recurring` | `event` | New recurring event instance spawned |
| `reminder` | `event` | Event day-of reminder |
| `rotation` | `group` | Rotation advances (it's your turn) |
| `poll` | `group` | New Group Pulse poll in your group |

### Expo push notifications

The mobile app registers an Expo push token on login (`POST /users/{id}/push-token`). Tokens are stored in `user_push_tokens` and deduplicated by `(user_id, token)`.

The gateway sends batch push messages via `https://exp.host/--/api/v2/push/send`. Only `ExponentPushToken[…]` format tokens are sent; invalid tokens are silently skipped.

### Notification API (gateway)

| Method | Path | Description |
|---|---|---|
| POST | `/users/{id}/push-token` | Register or refresh a push token |
| GET | `/users/{id}/notifications` | Fetch notification feed (last 50) |
| PUT | `/users/{id}/notifications/{nid}/read` | Mark single notification read |
| PUT | `/users/{id}/notifications/read-all` | Mark all notifications read |

---

## Feature: Recurring Events

A recurring schedule defines a repeating outing template. A daily APScheduler job checks for due schedules and creates the next event instance automatically.

### Recurrence rules

| Rule | Behaviour |
|---|---|
| `weekly` | Spawns every 7 days on `day_of_week` |
| `biweekly` | Spawns every 14 days on `day_of_week` |
| `monthly` | Spawns on the same day-of-month each month |

### Endpoints (events-service)

| Method | Path | Description |
|---|---|---|
| POST | `/groups/{id}/recurring-schedules` | Create a recurring schedule |
| GET | `/groups/{id}/recurring-schedules` | List schedules for a group |
| DELETE | `/recurring-schedules/{id}` | Deactivate a schedule |

### Poll → recurring event conversion

When converting a poll to an event, the frontend may pass `recurring_schedule_id`. The events-service:
1. Creates the event with `parent_recurring_id` set
2. Immediately advances `next_occurrence` on the schedule (or deactivates it if past `end_date`)

This prevents the daily spawner from creating a duplicate for that occurrence.

---

## Discover & Activity Browsing

The web UI offers seven discovery categories, each backed by the Enrichment Service:

| Category | Enrichment source | Endpoint prefix |
|---|---|---|
| Restaurants | Google Places | `/api/enrich/places` |
| Movies | TMDB | `/api/enrich/movies` |
| TV Shows | TMDB | `/api/enrich/shows` |
| Books | Google Books | `/api/enrich/books` |
| Games | IGDB | `/api/enrich/games` |
| Hikes | Google Places (parks) | `/api/enrich/hikes` |
| Arts & Culture | Google Places (arts) | `/api/enrich/arts` |

From any discover item the user can:
- **Pick for Group** — directly creates an event via the Rotation flow
- **Poll Group** — opens CreatePollModal pre-filled with the activity name and type

### "In Library" badges

When Radarr and/or Sonarr are configured, a green **IN LIBRARY** pill badge overlays matching cards on the Movies and TV Shows discover pages respectively. This is a read-only, system-wide feature:

- One Radarr instance → one shared movie library → badges visible to **all users**
- One Sonarr instance → one shared TV library → badges visible to **all users**
- Per-user or per-group library scoping is not supported — this is designed for a household/homelab setup where everyone shares the same Plex/Arr server
- Library lists are cached for 5 minutes (`/library/radarr`, `/library/sonarr`)
- If a service is not configured, the endpoint returns `{"tmdb_ids": []}` silently — no badges, no errors

---

## Deployment Checklist

1. Set a strong `POSTGRES_PASSWORD` in `.env`
2. Set `STORAGE_PUBLIC_URL` to your public domain (e.g. `https://example.com/storage`)
3. Set `FRONTEND_URL` to your domain (used in email links)
4. Configure SMTP credentials for email delivery
5. Optionally add enrichment API keys (`GOOGLE_API_KEY`, `TMDB_API_KEY`, `IGDB_CLIENT_ID/SECRET`)
6. **For internet-facing deployments:** set `INTERNAL_API_SECRET` to a random value (`openssl rand -hex 32`) — protects the internal API key sync endpoint between services. Optional for LAN-only installs.
7. **Change the default admin password** on first login — the web UI will show a red warning banner until this is done.
8. Point a reverse proxy / load balancer at port 9000 (or map directly)
9. For HTTPS: terminate TLS at the outer proxy and pass `X-Forwarded-Proto: https`
10. Back up the `storage_data` Docker volume alongside Postgres — the `backup` service snapshots both on a schedule
