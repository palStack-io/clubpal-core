# clubPal Core — AI Context

## Stack
- **Web:** Vite + React 18 + React Router v6 + axios + Tailwind 3 (class-based dark mode)
- **Backend:** FastAPI microservices (Python), SQLite, Docker
- **Services:** gateway :8001 · groups :8002 · events :8003 · enrichment :8006 · bill-split :8007

---

## Web — Key Paths
```
web/src/api/client.js           — all API clients (never re-declare)
web/src/contexts/AuthContext.jsx — useAuth() → { user }
web/src/contexts/ThemeContext.jsx — dark mode, class on html.dark
web/src/components/shell/       — AppShell, Sidebar, Topbar (wrap every page)
web/src/components/ui/          — Avatar, AvatarStack, Button, Card, StatusChip, ActivityPill
web/src/components/events/      — EventHeroCard, RatingCard, AttendanceCard, PhotoGalleryCard,
                                   CommentsCard, EventMetaCard, RateEventModal
web/src/components/groups/      — GroupEventsCard, MembersCard, etc.
web/src/components/dashboard/   — StatCard, EventItem, UpcomingEventsCard, TurnQueueCard, HeroBanner
web/src/components/modals/      — EditEventModal, BillSplitModal
web/src/pages/                  — one file per route
```

## Web — API Clients
```js
import { gatewayClient, groupsClient, eventsClient,
         ratingsClient, activitiesClient, enrichClient, billSplitClient } from '../../api/client'
```
- `gatewayClient` → `/api/gateway` — auth, users, notifications, invites, saved items
- `groupsClient` → `/api/groups` — groups, members, rotation, polls (injects `user_id` param)
- `eventsClient` → `/api/events` — events, attendees, rsvp, photos, comments (injects `user_id`)
- `ratingsClient` → `/api/ratings`
- `activitiesClient` → `/api/activities` — discover
- `enrichClient` → `/api/enrich`
- `billSplitClient` → `/api/bill-splits`
- Auth header auto-injected from `localStorage.session_token`; 401 → redirect to /login

## Web — Auth & Theme
```js
const { user } = useAuth()           // user.id is key for all user-scoped calls
// Dark mode via html.dark class — never toggle manually, ThemeContext handles it
```

## Web — CSS Tokens (index.css .dark)
```
Backgrounds: --bg #08080a  --s1 #0e0e12  --s2 #131318  --s3 #1a1a22  --s4 #22222c
Text:        --t1 #fff     --t2 #9898b0  --t3 #55556a  --t4 #38383f
Accent:      --rose #f43f5e  --rose-soft #fb7185  --rose-dim #fda4af
             --rose-glow rgba(244,63,94,0.12)  --rose-border rgba(244,63,94,0.22)
Others:      --green #22d3a0  --amber #f59e0b  --blue #6366f1  --purple #a855f7
             --glass rgba(255,255,255,0.08)  --glass-hover rgba(255,255,255,0.05)
```

## Web — Components Quick Reference
```
Button variants:  primary | ghost | subtle | hero | hero-ghost | secondary | danger | link
Card:    <Card><Card.Header>…</Card.Header><Card.Body>…</Card.Body></Card>
Avatar:  user={obj} or name="string"; size="sm|md|lg"  (sm=24 md=30 lg=38px)
StatusChip variants: going | not-going | maybe | turn-now | pending | date-chip | date-warning
```

---

## Backend — Key Paths
```
backend/services/api-gateway/app/main.py        — all gateway routes (auth, users, notifs)
backend/services/api-gateway/app/email_service.py — transactional emails (uses APP_URL env var)
backend/services/api-gateway/app/database.py    — SQLite helpers
backend/services/groups-service/                — groups, members, rotation, polls
backend/services/events-service/                — events, attendees, rsvp, photos, comments
backend/services/ratings-service/               — event ratings
backend/services/enrichment-service/            — discover / activity enrichment
backend/services/bill-split-service/            — bill splitting
```

## Backend — Auth Pattern
```python
current_user: dict = Depends(get_current_user)   # raises 401 if not authed
admin: dict = Depends(get_admin_user)             # raises 403 if not admin
# current_user keys: id, username, email, full_name, avatar_url, is_admin
```

## Backend — Notification System
- **In-app:** `create_notification(user_id, type, title, body, link_type, link_id)`
- **Push:** `await _send_push(tokens, title, body, {"link_type": ..., "link_id": ...})`
- **Email:** `email_service.send_*(...)` — all use `self.app_url` (env: `APP_URL`)
- **Internal trigger:** `POST /internal/notify/event` (called by groups/events services)
- Notification types: `rotation | event | invite | reminder | rating | poll | mention | system`

---

## Gateway API Reference

### Auth  `/auth/...`
```
POST /auth/register              → SessionResponse  (first user becomes admin)
POST /auth/login                 → SessionResponse
POST /auth/oidc                  → SessionResponse  (id_token or access_token)
POST /auth/oidc/confirm-link     body: {link_token}  → SessionResponse
POST /auth/link                  link OIDC to current account
DELETE /auth/link/{provider}     unlink OIDC provider
POST /auth/logout
GET  /auth/me                    → UserResponse
GET  /auth/invite/{token}        → InviteValidateResponse (GET version)
POST /auth/invite/join           existing user joins via token
POST /auth/verify-email          body: {token}
POST /auth/resend-verification
POST /auth/forgot-password       body: {email}
POST /auth/reset-password        body: {token, new_password}
POST /auth/change-password       body: {current_password, new_password}  (revokes other sessions)
POST /auth/set-password          body: {new_password}  (OIDC-only accounts)
```

### Users  `/users/...`
```
GET    /users/me                               → UserResponse
PATCH  /users/me                               body: {full_name, username, email, avatar_url}
POST   /users/me/avatar/upload                 multipart/form-data
POST   /users/me/avatar/upload-url             body: {filename, content_type} → {upload_url, public_url, object_name}
GET    /users/me/sessions                      → [SessionInfo]
DELETE /users/me/sessions/{token}
GET    /users/me/notification-prefs
PUT    /users/me/notification-prefs            body: {notify_rotation, notify_events, notify_reminders, notify_invites, push_enabled}
GET    /users/me/preferences                   → UserPreferencesResponse
PUT    /users/me/preferences                   triggers enrichment bulk-load
POST   /users/me/onboarding/complete
POST   /users/me/preferences/refresh           re-trigger enrichment without changing prefs
GET    /users/me/saved?item_type=              → [SavedItemResponse]
GET    /users/me/saved/{item_type}/{item_id}
POST   /users/me/saved                         body: {item_type, item_id, item_name, item_meta}
DELETE /users/me/saved/{item_type}/{item_id}
GET    /users/search?username=                 → [{id, username, full_name, avatar_url}]
GET    /users/{user_id}/profile                → {id, username, full_name, avatar_url}
POST   /users/{user_id}/push-token             body: {token, platform}
GET    /users/{user_id}/notifications          → newest-first list
PUT    /users/{user_id}/notifications/{id}/read
PUT    /users/{user_id}/notifications/read-all
```

### Invites
```
POST /invites/send               body: {email, group_id, group_name} → InviteResponse
POST /invites/validate           body: {token} → InviteValidateResponse
POST /invites/accept             body: {token, username?, password?} → InviteAcceptResponse
GET  /groups/{group_id}/pending-invites
```

### Mentions / Push
```
POST /comments/mention           body: {mentioned_user_ids, link_type, link_id, comment_preview}
                                  → {notified: N}  (auth required; skips self)
```

### Admin
```
GET    /users?limit&offset        (admin)
POST   /admin/users               body: {username, email, password, full_name, is_admin, email_verified}
GET    /admin/users/{user_id}
PATCH  /users/{user_id}           body: {full_name, is_admin, email_verified, is_active}
DELETE /users/{user_id}           deactivates + removes from all groups/events
GET    /admin/integrations        → {key: {configured, source}}
PUT    /admin/integrations        body: {google_api_key, tmdb_api_key, giphy_api_key, ...}
DELETE /admin/integrations/{key}
POST   /admin/api-blocks/{api_name}/approve
GET    /integrations/giphy-key    → {key}  (auth required, for mobile GIF picker)
```

### Internal (service-to-service, x-internal-secret header)
```
POST /internal/notify/rotation   body: {user_id, group_name, group_id}
POST /internal/notify/event      body: {user_ids|group_id, event_title, type, event_id, ...}
                                  types: created|recurring|reminder|rsvp_reminder|rsvp_nudge|
                                         rsvp_deadline_final|poll|invite|event_cancelled|
                                         event_edit|social_rsvp|rating_prompt|
                                         bill_split_assigned|bill_split_claiming
POST /internal/notify/push       body: {user_id, title, body, link_type?, link_id?}
GET  /internal/integrations
GET  /internal/admin-email
GET  /internal/users/{user_id}/profile
```

---

## Core ↔ Premium Sync

**Premium is a superset of core.** The microservices are near-identical codebases. Every bug fix or feature added here almost certainly needs to be applied to premium too.

### After any backend change — run this checklist
1. Is the changed file under `backend/services/`?
2. Find the counterpart at `../clubpal_premium/backend/services/<same relative path>`
3. Is premium's version identical, or does it have vault/adminPal additions?
   - **Identical** → apply the exact same change
   - **Has additions** → apply the change around the additions; never remove `vault_client`, `admin_auth`, or `require_palstack_*` references
4. Apply the change to premium too

### What counts as a premium-only change — DO NOT mirror to core
If a change in premium touches any of the following, it stays in premium only:
- `vault_client` — any import or `get_key()` call
- `admin_auth` — any import or `require_palstack_*` dependency
- `CLUBPAL_PREMIUM_SERVICE_SECRET` or `PALSTACK_MANAGER_URL` references
- `GET /admin/stats` or `POST /admin/reload-keys` endpoints
- Startup vault loading (`await vault_client.load_vault_keys()`)

Everything else (bug fixes, new notification types, new user endpoints, service logic) is shared.

### Shared file map (changes in core → must mirror in premium)
```
backend/services/api-gateway/app/database.py       → premium: same path
backend/services/api-gateway/app/email_service.py  → premium: same path
backend/services/api-gateway/app/models.py         → premium: same path
backend/services/api-gateway/app/storage.py        → premium: same path
backend/services/api-gateway/app/main.py           → premium: same path (⚠ premium has vault additions — preserve them)
backend/services/groups-service/                   → premium: same path (entire directory)
backend/services/events-service/                   → premium: same path (entire directory)
backend/services/ratings-service/                  → premium: same path (entire directory)
backend/services/activities-service/               → premium: same path (entire directory)
backend/services/enrichment-service/               → premium: same path (entire directory)
backend/services/bill-split-service/               → premium: same path (entire directory)
```

### Premium-only files — never create or modify these in core
```
backend/services/api-gateway/app/vault_client.py
backend/services/api-gateway/app/admin_auth.py
```

---

## Docs — When to Update

| Change type | Update these docs |
|---|---|
| New/changed notification | `docs/NOTIFICATIONS.md` |
| New/changed UI component or page | `docs/UI_CHECKLIST.md` |
| Mobile UI change | `docs/UI_CHECKLIST_MOBILE.md` |
| Bug fixed | `docs/BUG_TRACKER.md` |
| Architecture change (new service, new pattern) | `docs/ARCHITECTURE.md` |
| This CLAUDE.md is outdated | Update it inline |

---

## Rules — Never Do These
- **Never run git commands** — user handles all git operations
- Never create a new API client; always import from `web/src/api/client.js`
- Never use raw `<div>` for content panels — use `<Card>`
- Never hardcode colors — use CSS variables
- Never add a new web page without wrapping it in `<AppShell>`
- Prefer `Edit` over `Write` for existing files
- Never add error handling for things that can't happen; trust internal guarantees
- Never add features beyond what was asked
