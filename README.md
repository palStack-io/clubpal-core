# clubPal Core

> ⚠️ **clubPal is under active development — run it at your own risk.** Expect breaking changes between releases, and back up your data before you upgrade.

**clubPal** is a social events app for recurring friend groups: track whose turn it is to host, schedule outings, rate them afterwards, and keep everyone in the loop.

This repository is **clubPal Core**, the free self-hosted edition. It runs as six FastAPI microservices plus a React web UI, PostgreSQL, local-filesystem object storage, a backup service and Nginx, all under Docker Compose and all on **one host port (`9000`)**.

| | Status |
|---|---|
| **Web app** (this repo) | ✅ Ready to self-host |
| **Mobile app** (iOS + Android) | 🧪 **Under testing.** It is not in the App Store or Google Play yet |
| **Hosted Premium edition** | 🌐 Try the live demo at **<https://clubdemo.palstack.io>**. No sign-up is needed: pick a demo persona. The data resets nightly |

---

## Quick start

### Prerequisites

- Docker ≥ 24 and Docker Compose ≥ 2.20
- (optional) Node 20 and npm, for frontend development with hot reload

### 1. Clone and configure

```bash
git clone https://github.com/palStack-io/clubpal-core.git
cd clubpal-core
cp .env.example .env
```

Edit `.env`. For anything beyond a local trial, set at least these:

| Variable | Why |
|---|---|
| `POSTGRES_PASSWORD` | The database password (defaults to `clubpal` in dev) |
| `INTERNAL_API_SECRET` | Protects service-to-service calls. Generate one with `openssl rand -hex 32` |
| `STORAGE_PUBLIC_URL` | Public URL for uploaded images, e.g. `https://clubs.example.com/storage` |
| `FRONTEND_URL` | Public URL of the app. Links in emails point here |

All other settings are optional (see [Configuration](#configuration)).

### 2. Start the stack

Pick **one** of the three compose files:

| File | Use it when | Command |
|---|---|---|
| `docker-compose.yml` | You want to build from source (development, or trying it out) | `docker compose up --build -d` |
| `docker-compose.prod.yml` | You want pre-built images from GHCR (production) | `docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d` |
| `docker-compose.portainer.yml` | You deploy through Portainer | Paste it into **Portainer → Stacks → Add stack**, then replace every `CHANGEME` and set `x-app-host` |

`docker-compose.prod.yml` **refuses to start** until `POSTGRES_PASSWORD`, `INTERNAL_API_SECRET` and `STORAGE_PUBLIC_URL` are set. To pin a release instead of `latest`, run `IMAGE_TAG=<git-sha> docker compose -f docker-compose.prod.yml up -d`.

> While the GHCR packages are private, log in before you pull:
> `echo $GITHUB_TOKEN | docker login ghcr.io -u <your-github-user> --password-stdin`

On first boot the stack creates all six databases and the storage directories. Give it about 30 seconds.

### 3. Create your admin account

Open **<http://localhost:9000>** and register. **The first account registered becomes the admin** and is marked email-verified automatically, so register yourself before you share the URL.

### 4. Check it works

```bash
./scripts/smoke_test.sh                     # defaults to http://localhost:9000
./scripts/smoke_test.sh https://clubs.example.com
```

---

## What's inside

| Layer | Stack |
|---|---|
| Web UI | React 18 · Vite 5 · Tailwind CSS |
| API services | Python 3.11 · FastAPI · uvicorn |
| Database | PostgreSQL 15, one database per service |
| Object storage | Local filesystem on a shared Docker volume, served by Nginx at `/storage/` |
| Backups | A built-in `backup` container: scheduled `pg_dump` and storage archives, with optional rclone upload |
| Reverse proxy | Nginx 1.25, with rate limiting and SPA fallback |
| CI | GitHub Actions pushes images to `ghcr.io/palstack-io/clubpal-*` |

### Services

| Service | Internal port | Public prefix | Owns |
|---|---|---|---|
| api-gateway | 8001 | `/api/gateway/` | Accounts, sessions, invites, avatars, admin integrations |
| groups-service | 8002 | `/api/groups/` | Clubs, members, hosting rotation, polls, comments, banners |
| events-service | 8003 | `/api/events/` | Events, RSVPs, comments, cover images and photos |
| ratings-service | 8004 | `/api/ratings/` | Ratings, stats, leaderboards |
| activities-service | 8005 | `/api/activities/` | The activity catalogue |
| enrichment-service | 8006 | `/api/enrich/` | Cached lookups: Google Places/Books, TMDB, IGDB, Radarr/Sonarr |

Only Nginx is published on the host. The internal ports are reachable only inside the Docker network.

### API reference

Each service serves live Swagger docs, and those are the source of truth for endpoints:

| URL | Service |
|---|---|
| `http://localhost:9000/docs/auth` | API Gateway |
| `http://localhost:9000/docs/groups` | Groups |
| `http://localhost:9000/docs/events` | Events |
| `http://localhost:9000/docs/ratings` | Ratings |
| `http://localhost:9000/docs/activities` | Activities |
| `http://localhost:9000/docs/enrich` | Enrichment |

For schemas, the auth flow and the Nginx routing, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**Auth** uses opaque session tokens rather than JWTs, validated by the API gateway. **Uploads** are plain multipart `POST`s to the owning service, for example `POST /api/gateway/users/me/avatar/upload`. Nginx serves only whitelisted image types from `/storage/`.

---

## Configuration

Everything is set in `.env`, and `.env.example` documents every variable.

### Email (optional — leave blank to disable)

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `FROM_EMAIL` and `FROM_NAME`. Without them, clubPal sends no invite or password-reset emails.

### External APIs (all optional)

| Variable | Enables |
|---|---|
| `GOOGLE_API_KEY` | Venue search, book search, geocoding |
| `TMDB_API_KEY` | Movie and TV metadata |
| `IGDB_CLIENT_ID` + `IGDB_CLIENT_SECRET` | Video game metadata |

Without a key, the matching search returns empty results; nothing errors. An admin can also set these keys at runtime under **Admin → Integrations**, with no restart. That page also sets up **Radarr / Sonarr**, which show "In Library" badges. They are **system-wide**: one library shared by every user on the server.

**GIF search (Tenor):** users can add their own free Tenor key under **Settings → Integrations**, which is stored in their browser. You can also set `VITE_TENOR_API_KEY` at build time as a shared fallback.

### Backups

The `backup` service runs by default:

| Variable | Default |
|---|---|
| `BACKUP_PG_SCHEDULE` | `0 3 * * *` (Postgres, 03:00 UTC) |
| `BACKUP_STORAGE_SCHEDULE` | `0 4 * * *` (uploads, 04:00 UTC) |
| `BACKUP_PG_RETENTION_DAYS` / `BACKUP_STORAGE_RETENTION_DAYS` | `14` / `7` |
| `BACKUP_REMOTE_BUCKET` | empty, so backups stay local only |
| `RCLONE_CONFIG_REMOTE_*` | Backblaze B2, Cloudflare R2 or AWS S3 (see `.env.example`) |
| `BACKUP_HEALTHCHECK_URL` | Optional dead-man's-switch ping, e.g. healthchecks.io |

> Local-only backups sit on the same disk as your data. Set a remote bucket if the data matters to you.

---

## Development

```bash
# Frontend with hot reload (expects the stack running on :9000)
cd web && npm install && npm run dev        # http://localhost:5173

# Rebuild one service after a change
docker compose up --build -d api-gateway
docker compose up --build -d nginx          # also rebuilds the web UI

# Logs
docker compose logs -f api-gateway
```

Every backend service has the same layout: `Dockerfile`, `requirements.txt` and an `app/` directory holding `main.py` (routes), `models.py` (Pydantic), `database.py` (psycopg2 data access) and, where needed, `storage.py`.

```
clubpal-core/
├── docker-compose.yml             # build from source
├── docker-compose.prod.yml        # pull pre-built images from GHCR
├── docker-compose.portainer.yml   # Portainer stack
├── .env.example
├── backend/
│   ├── pg-init/                   # creates the six databases on first boot
│   └── services/                  # the six FastAPI services
├── web/                           # React + Vite frontend
├── nginx/                         # multi-stage build: web UI + reverse proxy
├── backup/                        # scheduled pg_dump + storage backups
├── scripts/                       # smoke_test.sh, e2e_test.sh, security_audit.sh
└── docs/                          # ARCHITECTURE.md, CODE_AUDIT.md, UI checklists
```

## CI / CD

Every push to `main` builds and pushes all eight images (nginx, backup and the six services) to `ghcr.io/palstack-io/clubpal-<name>`, tagged `latest` and `<git-sha>`. Pull requests build the images but do not push them.

## Stopping and resetting

```bash
docker compose down        # stop; keeps your data
docker compose down -v     # stop AND delete all databases, uploads and local backups
```

---

## Core vs Premium

This repository is the open, self-hosted **Core** edition. **clubPal Premium** is the hosted edition, with extra features on top (bill splitting, among others). To see it without installing anything, open the demo at **<https://clubdemo.palstack.io>**.
