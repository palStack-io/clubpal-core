# ClubPal Core — Code Audit Report

**Date:** 2026-03-02
**Scope:** Full stack — all six backend services + React web UI
**Auditor:** Automated static analysis

---

## Summary

| Severity | Count |
|---|---|
| 🔴 CRITICAL | 4 |
| 🟠 HIGH | 8 |
| 🟡 MEDIUM | 10 |
| 🔵 LOW | 7 |
| **Total** | **29** |

Issues are ordered by severity within each category. Each entry includes the exact file path and line number, a description of the risk, and a concrete fix.

---

## 🔴 CRITICAL

---

### C-1 — Hardcoded default admin credentials seeded on every boot

**File:** `backend/services/api-gateway/app/main.py:65–68`

```python
if not get_user_by_username("admin"):
    create_user("admin", "admin@clubpal.local", "admin",
                full_name="Admin", is_admin=True, email_verified=True)
    print("Seeded default admin user (admin/admin)")
```

**Risk:** Every fresh deployment automatically creates a fully-privileged `admin` account with the password `admin`. If an operator forgets to change it (common in homelab setups), any attacker who discovers the instance gains full admin access — can read all API keys from `GET /admin/integrations`, deactivate any user, and manage all integrations.

**Fix:** Remove the automatic seed entirely. Instead:
1. Print a one-time setup URL or token on first boot (e.g., `FIRST_RUN_TOKEN` in the logs).
2. Or read admin credentials from required env vars (`ADMIN_USERNAME`, `ADMIN_PASSWORD`) with no defaults, and refuse to start if they are empty.

```python
# Option A — env-var driven seed, no defaults
admin_user = os.environ.get("ADMIN_USERNAME")
admin_pass = os.environ.get("ADMIN_PASSWORD")
if admin_user and admin_pass and not get_user_by_username(admin_user):
    create_user(admin_user, f"{admin_user}@clubpal.local", admin_pass,
                full_name="Admin", is_admin=True, email_verified=True)
    print(f"Seeded admin user '{admin_user}'")
```

---

### C-2 — Unauthenticated internal endpoint exposes all stored API keys

**File:** `backend/services/api-gateway/app/main.py:1090–1093`

```python
@app.get("/internal/integrations")
async def internal_integrations():
    """Internal-only: return stored API key values for enrichment-service reload.
    No auth — only reachable inside the Docker network."""
```

**Risk:** This endpoint returns plaintext values for every stored integration key (Google API key, TMDB key, IGDB credentials, Radarr/Sonarr API keys). The Docker-network-only assumption is fragile — a misconfigured Nginx rule, SSRF vulnerability in any service, or an inadvertent host-port binding could expose it publicly. There is no authentication whatsoever.

**Fix:** ✅ Implemented. The endpoint now checks an `X-Internal-Secret` header against the `INTERNAL_API_SECRET` environment variable. The enrichment service sends this header automatically when the variable is set.

**`INTERNAL_API_SECRET` is optional** — if left blank in `.env`, the endpoint behaves as before (no header check), which is acceptable for LAN-only homelab deployments where the Docker network is not reachable externally. Set it for any internet-facing instance:

```bash
# Generate a strong value and add it to .env
openssl rand -hex 32
```

Both `api-gateway` and `enrichment-service` must have the same value. The gateway logs a warning at startup if the variable is not set.

---

### C-3 — Push token and notification endpoints have no authentication

> ✅ **Implemented** — All four endpoints now require `Depends(get_current_user)` with an ownership check (`current_user["id"] == user_id`). Unauthenticated or cross-user requests return HTTP 403.

**File:** `backend/services/api-gateway/app/main.py:836–862`

```python
@app.post("/users/{user_id}/push-token", status_code=204)
async def save_push_token(user_id: int, data: dict):
    ...

@app.get("/users/{user_id}/notifications")
async def get_user_notifications(user_id: int):
    ...

@app.put("/users/{user_id}/notifications/{notif_id}/read", status_code=204)
async def mark_notif_read(user_id: int, notif_id: int):
    ...

@app.put("/users/{user_id}/notifications/read-all", status_code=204)
async def mark_all_notifs_read(user_id: int):
    ...
```

**Risk (push-token endpoint):** Any unauthenticated caller can register an arbitrary Expo push token for any `user_id`. An attacker can silently replace a victim's push token with their own, hijacking all future push notifications for that user (turn notifications, event alerts, poll results).

**Risk (notification endpoints):** Any unauthenticated caller can read any user's in-app notifications or mark them as read, leaking group names, event titles, and activity content.

**Fix:** Add `current_user: dict = Depends(get_current_user)` to all four handlers, then verify `current_user["id"] == user_id`:

```python
@app.post("/users/{user_id}/push-token", status_code=204)
async def save_push_token(user_id: int, data: dict,
                          current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    ...
```

---

### C-4 — Backend services accept `user_id` as an untrusted query parameter

> ✅ **Implemented** — groups-service and events-service now use a `get_current_user_id` FastAPI dependency that validates the Bearer token against the gateway (`GET /auth/me`) and returns the authenticated user ID. All mutating endpoints in both services have been updated. The `user_id` query parameter is no longer accepted from callers. (`ratings-service` endpoints are read-only and lower risk; tracked separately.)

**Files:**
- `backend/services/groups-service/app/main.py:62,100,130,186,208,251`
- `backend/services/events-service/app/main.py:288,415,446,728`
- `backend/services/ratings-service/app/main.py` (multiple endpoints)

```python
@app.post("/groups", response_model=GroupResponse, status_code=201)
async def create_group_endpoint(group_data: GroupCreate, user_id: int):
    ...

@app.delete("/events/{event_id}", status_code=204)
async def delete_event_endpoint(event_id: int, user_id: int):
    ...
```

**Risk:** Groups-service, events-service, and ratings-service do not implement authentication. They accept `user_id` as a raw query/body parameter and trust it completely. The only protection is that Nginx exposes these services through `/api/groups/`, `/api/events/`, etc. rather than directly. However:

1. Any misconfiguration in Nginx (or future changes to `nginx.conf`) immediately exposes full write access to any resource as any user.
2. Any SSRF vulnerability in any backend service can be used to impersonate arbitrary users against sibling services.
3. There is no guarantee that the API gateway actually validated the user before proxying — services simply trust whatever `user_id` they receive.

**Fix (short-term):** Add a shared internal `X-Clubpal-User-Id` header that the API gateway sets after authentication, and have the backend services read identity from that header only — never from query params or request bodies. Validate the header is present and non-zero on all mutating endpoints.

**Fix (long-term):** Pass the original JWT through to each service and have each service validate it. Or implement a gateway-signed assertion (e.g., a short-lived HMAC token containing user_id + timestamp).

---

## 🟠 HIGH

---

### H-1 — IGDB query body injects unvalidated `min_rating` float into raw query string

**File:** `backend/services/enrichment-service/app/external.py:461–466`

```python
if min_rating:
    where.append(f"total_rating >= {min_rating}")
body = (
    f'search "{query}"; '
    f'fields id,...; '
    f'where {" & ".join(where)}; limit 20;'
)
```

**Risk:** `min_rating` arrives from the HTTP query parameter `GET /games/search?min_rating=X`. Although it is typed as `Optional[float]` by FastAPI, the raw IGDB query string is built with f-string interpolation. If FastAPI's type coercion is bypassed (e.g., via crafted requests), an attacker could inject arbitrary IGDB query language tokens. Additionally, the `query` string in `search "{query}"` is interpolated directly — a value containing a double-quote character terminates the string and injects additional IGDB query clauses.

**Fix:**

```python
# Sanitize query: remove double-quotes
safe_query = query.replace('"', '')

if min_rating is not None:
    # Already coerced to float by FastAPI, but clamp to valid range
    clamped = max(0.0, min(100.0, float(min_rating)))
    where.append(f"total_rating >= {clamped}")

body = f'search "{safe_query}"; fields ...; where {" & ".join(where)}; limit 20;'
```

---

### H-2 — CORS `allow_origins=["*"]` with `allow_credentials=True` on all services

**Files:**
- `api-gateway/app/main.py:39–45`
- `groups-service/app/main.py:35–41`
- `events-service/app/main.py:36–42`
- `ratings-service/app/main.py:21–27`
- `activities-service/app/main.py:17–23`
- `enrichment-service/app/main.py:27–33`

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Risk:** `allow_origins=["*"]` with `allow_credentials=True` is technically rejected by the CORS spec and current browsers (they treat it as an error), but this combination signals a misconfigured intent. More importantly, for all internal services that should never receive cross-origin requests at all, wildcard CORS allows any web page to probe them via JavaScript if they are ever reachable on a non-standard port.

**Fix:** For all backend services, CORS is unnecessary (they are called only by Nginx/gateway on the internal Docker network). Remove the middleware entirely from groups, events, ratings, activities, and enrichment services. For the API gateway, restrict to your deployment origin:

```python
# api-gateway only
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:9000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

Add `ALLOWED_ORIGINS=https://your-domain.com` to your `.env`.

---

### H-3 — No authentication on activity CRUD endpoints

**File:** `backend/services/activities-service/app/main.py:42–129`

```python
@app.post("/activities", response_model=ActivityResponse, status_code=201)
async def create_activity_endpoint(activity_data: ActivityCreate):
    ...

@app.patch("/activities/{activity_id}", response_model=ActivityResponse)
async def update_activity_endpoint(activity_id: int, activity_data: ActivityUpdate):
    ...

@app.delete("/activities/{activity_id}", status_code=204)
async def delete_activity_endpoint(activity_id: int):
    ...
```

**Risk:** These endpoints have no authentication. Any caller (including unauthenticated requests) can create, rename, or delete activity types that all groups and events depend on. Deleting a referenced activity type would corrupt all events that reference it.

**Fix:** At minimum add an internal-network shared secret header (see C-2 fix) checked on POST/PATCH/DELETE. The increment-usage endpoint (`/activities/{id}/increment-usage`) is called by events-service and can stay unauthenticated on the internal network. For the write endpoints, validate the caller is either an admin (via gateway forwarded header) or an internal service.

---

### H-4 — No authentication on recurring schedule delete

**File:** `backend/services/events-service/app/main.py:727–730`

```python
@app.delete("/recurring-schedules/{schedule_id}", status_code=204)
async def cancel_recurring_schedule(schedule_id: int, user_id: int):
    """Deactivate a recurring schedule (stops future event generation)."""
    deactivate_recurring_schedule(schedule_id)
```

**Risk:** The `user_id` parameter is accepted but **never used or validated** — the handler calls `deactivate_recurring_schedule(schedule_id)` without checking whether `user_id` owns that schedule. Any caller who knows a schedule ID can silently cancel recurring events they do not own.

**Fix:** Fetch the schedule, check it belongs to `user_id`, then deactivate:

```python
schedule = get_recurring_schedule(schedule_id)
if not schedule:
    raise HTTPException(status_code=404, detail="Schedule not found")
if schedule["created_by"] != user_id:
    raise HTTPException(status_code=403, detail="Not your schedule")
deactivate_recurring_schedule(schedule_id)
```

---

### H-5 — File upload content-type is not validated

**File:** `backend/services/api-gateway/app/main.py:524–526`

```python
class AvatarUploadRequest(BaseModel):
    filename: str
    content_type: str = "image/jpeg"
```

**Risk:** The `content_type` sent by the client is passed directly to MinIO as the pre-signed URL's content type with no validation. An attacker can request a pre-signed URL with `content_type: "text/html"` or `content_type: "application/javascript"`, upload a malicious HTML/JS file, then serve it from the public `/storage/` path. Since MinIO serves the file with the caller-supplied content type, this is a stored XSS vector if any user visits the URL directly.

The same issue exists for event and group image upload URL endpoints.

**Fix:** Validate content-type against an allowlist:

```python
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}

class AvatarUploadRequest(BaseModel):
    filename: str
    content_type: str = "image/jpeg"

    @validator("content_type")
    def must_be_image(cls, v):
        if v not in ALLOWED_IMAGE_TYPES:
            raise ValueError("content_type must be an image MIME type")
        return v
```

Apply the same validator to `EventImageUploadRequest` and group banner upload request models.

---

### H-6 — Internal notification trigger endpoints have no authentication

**File:** `backend/services/api-gateway/app/main.py:887–1087`

```python
# ===== Internal Notification Trigger =====
# Called by groups/events services over the internal Docker network — no auth required.

@app.post("/internal/notify/rotation")
async def notify_rotation(req: RotationNotifyRequest):
    ...

@app.post("/internal/notify/event")
async def notify_event(req: EventNotifyRequest):
    ...
```

**Risk:** These endpoints dispatch push notifications to real users and insert in-app notification records. Any caller who can reach the API gateway (internal or otherwise) can spam push notifications to any user, flood the notifications table, or trigger misleading alerts (e.g., falsely notifying someone "it's your turn").

**Fix:** Apply the same internal secret header approach as C-2. The groups and events services already call these — simply have them include `X-Internal-Secret` in those requests.

---

### H-7 — Unbounded list queries with no server-side pagination on several endpoints

**Files:**
- `backend/services/groups-service/app/main.py` — `GET /groups/{id}/comments` returns all comments
- `backend/services/events-service/app/main.py` — `GET /events/{id}/comments`, `GET /events/{id}/attendees` return all rows
- `backend/services/ratings-service/app/main.py` — `GET /events/{id}/ratings` returns all ratings

**Risk:** A group or event with thousands of comments or attendees will return the entire table in a single response. This can cause high memory usage in both the service and the browser, and can be used as an amplification vector (request one endpoint, get megabytes back).

**Fix:** Add `limit` and `offset` parameters to all list endpoints with sensible defaults and maximums. For comments, a default of 50 and max of 200 is reasonable:

```python
@app.get("/groups/{group_id}/comments")
async def get_comments(
    group_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    return get_group_comments(group_id, limit=limit, offset=offset)
```

---

### H-8 — No rate limiting on authentication endpoints

**File:** `backend/services/api-gateway/app/main.py` — `/auth/login`, `/auth/register`, `/auth/forgot-password`

**Risk:** The login endpoint has no brute-force protection. An attacker can attempt unlimited password guesses against any known username. The forgot-password endpoint has no rate limit either, allowing email flooding of any user.

Nginx does have `limit_req_zone` configured, but it applies a global rate limit to all requests rather than targeting auth specifically, and burst allowances may be too generous for credential stuffing.

**Fix (application-level):** Track failed login attempts per username in the database or an in-memory cache. Lock the account temporarily after N failures (e.g., 5 attempts → 15 minute lockout). Return `429 Too Many Requests` during lockout.

**Fix (Nginx-level):** Add a dedicated stricter zone for auth paths in `nginx.conf`:

```nginx
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

location /api/gateway/auth/ {
    limit_req zone=auth burst=3 nodelay;
    proxy_pass http://api-gateway:8001;
}
```

---

## 🟡 MEDIUM

---

### M-1 — N+1 database queries when listing polls for a group

**File:** `backend/services/groups-service/app/main.py:524–526`

```python
polls = get_polls_for_group(group_id)
member_count = group['member_count']
return [_poll_to_model(p, _build_poll_summary(p['id'], user_id, member_count)) for p in polls]
```

`_build_poll_summary` at line 438 makes **3 separate database round-trips** per poll (get_poll, get_poll_responses, get_poll_response). A group with 20 open polls triggers 60+ queries per page load.

**Fix:** Replace `_build_poll_summary` with a single batched query that fetches all responses for all poll IDs in one `WHERE poll_id = ANY(%s)` query, then aggregates in Python.

---

### M-2 — Race condition in rotation advancement

**File:** `backend/services/groups-service/app/database.py` — `advance_rotation()`

**Risk:** If two members click "advance rotation" simultaneously, both requests read the same `current_turn_index`, compute `next_index = current + 1`, and both write back the same value. The rotation advances only once instead of twice. Under high concurrency this silently corrupts rotation state.

**Fix:** Use a `SELECT ... FOR UPDATE` lock or optimistic concurrency (update with a WHERE clause that includes the expected current value and check rowcount):

```sql
UPDATE group_rotation
SET current_turn_index = %s, current_user_id = %s, updated_at = NOW()
WHERE group_id = %s AND current_turn_index = %s  -- optimistic check
```

If `rowcount == 0`, retry or return a 409.

---

### M-3 — Comment text has no length limit

**Files:**
- `backend/services/groups-service/app/main.py` — `POST /groups/{id}/comments`
- `backend/services/events-service/app/main.py` — `POST /events/{id}/comments`

**Risk:** No maximum length is enforced on comment bodies. Users can POST megabyte-sized comment strings, consuming database storage and causing slow queries. The `[gif:URL]` inline GIF feature in event comments also accepts unbounded URLs.

**Fix:** Add `max_length` constraints to the comment Pydantic models:

```python
class CommentCreate(BaseModel):
    user_id: int
    text: str = Field(..., min_length=1, max_length=2000)
```

For GIF URLs embedded in text, strip or reject values where the extracted URL exceeds a reasonable length (e.g., 512 chars).

---

### M-4 — `activity_id` not validated on event creation

**File:** `backend/services/events-service/app/main.py:288`

**Risk:** Events are created with an `activity_id` that is stored but never validated against the activities service. Foreign key integrity isn't enforced across services. An event can be created with a non-existent or deleted activity ID, resulting in `null` activity names in event detail responses and potential issues in stats aggregations.

**Fix:** Before inserting the event, call the activities service to verify the `activity_id` exists:

```python
activity_resp = httpx.get(f"{ACTIVITIES_URL}/activities/{event_data.activity_id}")
if activity_resp.status_code == 404:
    raise HTTPException(status_code=400, detail="Invalid activity_id")
```

---

### M-5 — No group membership verification before creating an event

**File:** `backend/services/events-service/app/main.py:288`

**Risk:** The `create_event` handler accepts a `group_id` but never checks whether the creating user (`user_id`) is actually a member of that group. Any authenticated user can create events in any group they are not a member of.

**Fix:** Call the groups service to verify membership before creating:

```python
member_resp = httpx.get(f"{GROUPS_URL}/groups/{event_data.group_id}/members/{user_id}")
if member_resp.status_code != 200:
    raise HTTPException(status_code=403, detail="You are not a member of this group")
```

---

### M-6 — 30-day session tokens never rotate

**File:** `backend/services/api-gateway/app/database.py:361`

```python
expires_at = datetime.utcnow() + timedelta(days=30)
```

**Risk:** Session tokens are static for 30 days with no rotation. A stolen token is valid for the full 30-day window. There is also no mechanism to invalidate all sessions on password change (only the current session is destroyed on logout).

**Fix (token rotation):** Issue a new session token on each login response and rotate it on each authenticated request (or at minimum every 24 hours). Return the new token in a `X-Refreshed-Token` header.

**Fix (revoke on password change):** Call `delete_sessions_except` with the current session when a user changes their password, forcing all other devices to re-authenticate.

---

### M-7 — Error messages leak implementation details

**Files:** Multiple — e.g., `api-gateway/app/main.py` passes raw exception `str(e)` in several places

```python
except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
```

**Risk:** Uncaught exceptions expose internal paths, SQL query fragments, and library version strings in API responses. This helps attackers map the system.

**Fix:** Log the full exception server-side and return a generic message to clients:

```python
except Exception as e:
    logger.exception("Unexpected error in endpoint")
    raise HTTPException(status_code=500, detail="Internal server error")
```

---

### M-8 — Missing database indexes on high-cardinality foreign keys

**Files:** `database.py` across groups, events, ratings services

The following columns are used in frequent WHERE clauses but lack explicit indexes in the `CREATE TABLE` statements:

| Table | Column | Used by |
|---|---|---|
| `group_members` | `user_id` | `GET /users/{id}/groups` |
| `events` | `group_id` | `GET /groups/{id}/events` |
| `event_attendees` | `user_id` | `GET /users/{id}/events` |
| `ratings` | `event_id` | `GET /events/{id}/ratings` |
| `sessions` | `session_token` | Every authenticated request |
| `group_polls` | `group_id` | `GET /groups/{id}/polls` |

**Fix:** Add `CREATE INDEX IF NOT EXISTS` statements in each service's `init_db()`:

```sql
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_events_group_id ON events(group_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id ON event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_event_id ON ratings(event_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
```

---

### M-9 — Poll management endpoints accept `user_id` without session validation

**File:** `backend/services/groups-service/app/main.py:530,543,561,579`

```python
@app.get("/polls/{poll_id}", response_model=PollResponseModel)
async def get_poll_endpoint(poll_id: int, user_id: int):
    ...

@app.post("/polls/{poll_id}/respond", response_model=PollResponseModel)
async def respond_to_poll(poll_id: int, data: PollRespond):
    ...
```

**Risk:** `user_id` is accepted as a query parameter with no session validation. Any caller can submit poll responses as any user, read poll results as any user, and close/convert polls by impersonating the creator.

**Fix:** Follow the same pattern as C-4 — derive user identity from a trusted header set by the gateway, not from a caller-supplied parameter.

---

### M-10 — No HTTPS enforcement at the application level

**File:** `nginx/nginx.conf`

**Risk:** The default configuration runs entirely over HTTP on port 9000. Session tokens are transmitted in plain text. There is no HTTP → HTTPS redirect or `Strict-Transport-Security` header configured.

**Fix:** For production:
1. Add a TLS termination block in `nginx.conf` (Let's Encrypt / Certbot recommended).
2. Add an HTTP → HTTPS redirect server block.
3. Add `add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;`.

For the `.env.example`, add `FRONTEND_URL=https://your-domain.com` and note that HTTP is only appropriate for local LAN deployments.

---

## 🔵 LOW

---

### L-1 — Hardcoded default credentials in `.env.example`

**File:** `.env.example`

```
POSTGRES_PASSWORD=clubpal
MINIO_ROOT_USER=clubpal
MINIO_ROOT_PASSWORD=clubpalpassword
```

**Risk:** These defaults are checked into the repository. Operators who deploy without changing them (very common) expose database and object storage to anyone who knows the defaults.

**Fix:** Replace defaults with obvious placeholder values that force the operator to fill them in:

```
POSTGRES_PASSWORD=CHANGE_ME
MINIO_ROOT_USER=CHANGE_ME
MINIO_ROOT_PASSWORD=CHANGE_ME_LONG_RANDOM_STRING
```

Add a startup check in the API gateway that refuses to start if these env vars still hold the placeholder values.

---

### L-2 — Weak password policy — length only, no complexity

**File:** `backend/services/api-gateway/app/models.py:10`

```python
password: str = Field(..., min_length=8)
```

**Risk:** A minimum of 8 characters with no complexity requirement allows common passwords like `password`, `12345678`, or `aaaaaaaa`.

**Fix:** Add a custom validator that checks for at least one letter and one non-letter character, or integrate `zxcvbn` for entropy-based scoring:

```python
@validator("password")
def password_strength(cls, v):
    if not any(c.isalpha() for c in v):
        raise ValueError("Password must contain at least one letter")
    if not any(not c.isalpha() for c in v):
        raise ValueError("Password must contain at least one number or symbol")
    return v
```

---

### L-3 — No security event logging

**Files:** All backend services

**Risk:** There is no structured logging for security-relevant events: failed logins, permission-denied responses, admin actions, token invalidations, or integration key changes. This makes incident investigation and anomaly detection impossible.

**Fix:** Add a lightweight security logger that writes structured JSON events to stdout (captured by Docker):

```python
import logging, json

security_log = logging.getLogger("security")

# On failed login
security_log.warning(json.dumps({
    "event": "login_failed", "username": username,
    "ip": request.client.host, "ts": datetime.utcnow().isoformat()
}))

# On admin action
security_log.info(json.dumps({
    "event": "admin_action", "action": "deactivate_user",
    "target_user_id": user_id, "admin_id": current_user["id"]
}))
```

---

### L-4 — Missing Content-Security-Policy and security headers

**File:** `nginx/nginx.conf`

**Risk:** The app serves no `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy` headers. This allows clickjacking, MIME sniffing, and increases XSS blast radius.

**Fix:** Add to the Nginx server block:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; img-src 'self' data: https: blob:; media-src 'self' blob:; frame-ancestors 'none';" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

Note: CSP `script-src 'self'` may need `'unsafe-inline'` adjustment if Vite inlines scripts — audit the build output first.

---

### L-5 — No request timeout on outbound HTTP calls in some services

**Files:**
- `backend/services/api-gateway/app/main.py` — `httpx.AsyncClient` calls to enrichment service lack explicit timeouts in some paths
- `backend/services/groups-service/app/main.py` — internal notify calls use default httpx timeout

**Risk:** If a downstream service hangs, the caller waits indefinitely, exhausting the worker process and causing cascading failures.

**Fix:** Always specify `timeout=` on every `httpx.AsyncClient` instantiation or request:

```python
async with httpx.AsyncClient(timeout=5.0) as client:
    resp = await client.post(url, json=payload)
```

The enrichment service already does this correctly (uses `timeout=10.0` throughout) — apply the same discipline to gateway → enrichment and gateway → internal notify calls.

---

### L-6 — Expired sessions are only cleaned up at startup

**File:** `backend/services/api-gateway/app/main.py:62`

```python
@app.on_event("startup")
async def startup():
    cleanup_expired_sessions()
```

**Risk:** Sessions accumulate in the database between deployments. A long-running instance (months without restart) could have millions of stale session rows, degrading query performance on the `sessions` table.

**Fix:** Schedule periodic cleanup using FastAPI's background scheduler or a simple APScheduler:

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()
scheduler.add_job(cleanup_expired_sessions, "interval", hours=6)

@app.on_event("startup")
async def startup():
    cleanup_expired_sessions()
    scheduler.start()
```

---

### L-7 — Groups and events are hard-deleted; no soft-delete or audit trail

**Files:**
- `backend/services/groups-service/app/database.py:270–281` — `DELETE FROM groups`
- `backend/services/events-service/app/database.py` — `DELETE FROM events`

**Risk:** Deleting a group or event permanently removes all associated comments, attendees, ratings references, and rotation history with no recovery path. A single misclick by an owner destroys data permanently. There is an `event_history` audit log table for events but it does not record the delete action itself.

**Fix:** Add `is_deleted BOOLEAN DEFAULT FALSE` and `deleted_at TIMESTAMP` columns. Replace `DELETE` with `UPDATE ... SET is_deleted = TRUE, deleted_at = NOW()`. Filter deleted records with `WHERE is_deleted = FALSE` in all query functions. Implement a purge job that hard-deletes records older than 90 days.

---

## Prioritisation Matrix

| Priority | Issues to fix first | Rationale |
|---|---|---|
| P0 — Fix immediately | C-1 | Active data exposure / account takeover on any running instance |
| ✅ Done | C-2, C-3, C-4 | Implemented — see individual entries above |
| P1 — Fix before public access | H-3, H-4, H-6 | Auth bypass on write endpoints |
| P2 — Fix in next sprint | H-1, H-2, H-5, H-7, H-8 | Security hardening + performance |
| P3 — Backlog | M-1 through M-10 | Code quality and robustness |
| P4 — Nice to have | L-1 through L-7 | Defence-in-depth and ops improvements |

---

## Notes on Scope

- **Mobile app** (`/mobile/`) was not included in this audit — push token handling in the mobile client should be reviewed in conjunction with C-3 above.
- **Frontend (web)** was reviewed for obvious client-side issues only; a dedicated XSS/DOM audit against the React app is recommended separately.
- **Dependency versions** were not scanned — run `pip audit` against each service's `requirements.txt` and `npm audit` against `web/package.json` as a separate step.
