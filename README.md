<div align="center">
  <img width="120" height="120" alt="gatherPal" src="web/public/clubPal.png" />
  <h1>gatherPal Core</h1>
  <p><strong>Your friend group, without the admin.</strong></p>
  <p>
    <a href="#quick-start">Quick start</a> ·
    <a href="https://palstack.io/gatherpal">Website</a> ·
    <a href="https://clubdemo.palstack.io">Live demo (hosted)</a> ·
    <a href="https://discord.gg/mcgcp7RdYs">Discord</a>
  </p>
  <p><a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue"></a></p>
</div>

> [!CAUTION]
> **Known security issues: do not expose gatherPal Core to the internet yet.**
> Some routes in this version do not check who is calling. In particular, any request that can reach the server can
> add an account to a group, and the enrichment service (`/api/enrich/`, used for place, book and film lookups) has no
> authentication. These are fixed in the hosted edition and **we are working on bringing the fixes to Core**.
> Until then, run Core only on a private network you trust (your home network or a VPN such as Tailscale or
> WireGuard), and do not put it behind a public domain. Watch this repository for the fix.

gatherPal (formerly clubPal) is a social app for recurring friend groups: whose turn it is to host, plans and
invites, rotations, ratings afterwards, and keeping everyone in the loop.

This repository is **gatherPal Core**, the free self-hosted edition. The code, image names and folders still say
`clubpal`; the product is called gatherPal. It runs as six FastAPI services, a React web UI, PostgreSQL, local file
storage, a backup service and nginx under Docker Compose, all on one port (`9000`).

> [!NOTE]
> Core is behind the hosted edition, which has a newer design and more features. The
> [live demo](https://clubdemo.palstack.io) shows the hosted edition.

## Quick start

You need Docker 24+ with the Compose plugin. The production compose file pulls prebuilt images from GHCR.

```bash
git clone https://github.com/palStack-io/clubpal-core.git && cd clubpal-core
cp .env.example .env

# Generate your own secrets
for key in POSTGRES_PASSWORD INTERNAL_API_SECRET; do
  sed -i.bak "s|^$key=[^ ]*|$key=$(openssl rand -hex 32)|" .env
done && rm .env.bak

docker compose -f docker-compose.prod.yml up -d
```

Give it about 30 seconds on first start (it creates six databases). Open **http://localhost:9000** and register.
**The first account becomes the admin**, so register yourself before you share the address.

- Another port: set `APP_PORT` in `.env`.
- Images and email links: set `STORAGE_PUBLIC_URL` and `FRONTEND_URL` in `.env` to the address people use.
- Build from source instead: `docker compose up --build -d` (uses `docker-compose.yml`).
- Portainer: paste `docker-compose.portainer.yml` into **Stacks → Add stack** and replace every `CHANGEME`.
- Pin a release: `IMAGE_TAG=<git-sha> docker compose -f docker-compose.prod.yml up -d`.
- Check it: `./scripts/smoke_test.sh` (defaults to http://localhost:9000).

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

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `FROM_EMAIL` and `FROM_NAME`. Without them, gatherPal sends no invite or password-reset emails.

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
└── docs/ARCHITECTURE.md           # services, schemas, auth flow, nginx routing
```

## CI / CD

Every push to `main` builds and pushes all eight images (nginx, backup and the six services) to `ghcr.io/palstack-io/clubpal-<name>`, tagged `latest` and `<git-sha>`. Pull requests build the images but do not push them.

## Stopping and resetting

```bash
docker compose down        # stop; keeps your data
docker compose down -v     # stop AND delete all databases, uploads and local backups
```

## Core and hosted

| | Core (this repository) | Hosted |
|---|---|---|
| Groups, hosting rotation, events and invites, ratings, activities | Yes | Yes |
| Security fixes from 2026-11 (see the caution above) | Coming | Yes |
| Newer design, bill splitting and other recent features | No | Yes |
| Phone app | No | In testing |
| Where your data lives | Your server | palStack's servers |

## Contributing

We have paused code contributions while we work out how to review AI-assisted changes well. Bug reports, ideas and
questions are very welcome: open an [issue](https://github.com/palStack-io/clubpal-core/issues) or join us on
[Discord](https://discord.gg/mcgcp7RdYs).

Found a security problem? Please report it privately; see [SECURITY.md](https://github.com/palStack-io/.github/blob/main/SECURITY.md).

## License

gatherPal Core is licensed under the [GNU Affero General Public License v3.0](LICENSE). You can use, change and
self-host it freely. If you run a modified version as a network service, you must publish your changes under the
same licence.

gatherPal is built for personal use with your family and friends. To run it commercially, or as a service without
the AGPL's obligations, contact **support@palstack.io** about a commercial licence.

---

<div align="center">
  <sub>Part of <a href="https://palstack.io">palStack.io</a>: everyday tools for food, money, home and friends.</sub>
</div>
