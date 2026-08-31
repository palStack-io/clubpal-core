from fastapi import FastAPI, HTTPException, Header, Depends, UploadFile, File, Request, Response, Cookie
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import ENCODERS_BY_TYPE
from pydantic import BaseModel, Field, validator
from datetime import datetime
ENCODERS_BY_TYPE[datetime] = lambda dt: dt.strftime('%Y-%m-%dT%H:%M:%SZ') if dt else None
from typing import Optional, List
import os
import uuid
import json
import httpx
from datetime import datetime, timedelta
import jwt as pyjwt
from cachetools import TTLCache
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.models import (
    UserCreate, UserLogin, UserResponse, SessionResponse,
    InviteSendRequest, InviteValidateRequest, InviteAcceptRequest,
    InviteResponse, InviteValidateResponse, InviteAcceptResponse,
    EmailVerifyRequest, ForgotPasswordRequest, ResetPasswordRequest,
    AdminUserCreate, UserProfileUpdate, UserAdminUpdate, SessionInfo,
    UserPreferencesUpdate, UserPreferencesResponse,
    OIDCAuthRequest,
)
from app.database import (
    init_db, create_user, get_user_count, get_user_by_username, get_user_by_email,
    get_user_by_id, verify_password, update_last_login, create_session,
    get_user_by_session, delete_session, cleanup_expired_sessions, refresh_session,
    create_invite_token, get_invite_by_token, mark_invite_accepted, get_pending_invites_for_group,
    create_verification_token, verify_email_token,
    create_reset_token, verify_reset_token, update_user_password,
    update_user_profile, get_sessions_for_user, delete_session_by_token_for_user,
    delete_sessions_except, delete_all_sessions,
    get_all_users, admin_update_user, deactivate_user, get_admin_emails,
    get_all_integrations, set_integration, delete_integration, log_admin_action,
    get_notification_prefs, set_notification_prefs,
    upsert_push_token, get_push_tokens_for_users, delete_push_token,
    create_notification, get_notifications_for_user,
    mark_notification_read, mark_all_notifications_read,
    get_user_preferences, upsert_user_preferences,
    get_user_by_oidc_sub, link_oidc_sub, create_oidc_user, unlink_oidc_sub,
    create_pending_link, consume_pending_link,
    get_saved_items, get_saved_item, save_item, delete_saved_item,
    search_users_by_username,
    log_invite_send, count_recent_domain_invites,
    get_inactive_users, get_unverified_users,
)
from app.email_service import email_service
from app import storage

limiter = Limiter(key_func=get_remote_address)
_IS_PRODUCTION = os.environ.get("APP_ENV", "development") == "production"
scheduler = AsyncIOScheduler()


def _apply_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=_IS_PRODUCTION,   # Secure flag in production (HTTPS), off in dev (HTTP)
        samesite="strict",
        max_age=7776000,          # 90 days
        path="/",
    )


app = FastAPI(
    title="ClubPal API Gateway",
    version="1.0.0",
    docs_url=None if _IS_PRODUCTION else "/docs",
    redoc_url=None if _IS_PRODUCTION else "/redoc",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

from fastapi import Request as _Request
from fastapi.responses import JSONResponse as _JSONResponse
from fastapi.exception_handlers import http_exception_handler as _http_exception_handler
from starlette.exceptions import HTTPException as _StarletteHTTPException

@app.exception_handler(Exception)
async def _unhandled_exception_handler(req: _Request, exc: Exception):
    if isinstance(exc, _StarletteHTTPException):
        return await _http_exception_handler(req, exc)
    import logging, traceback
    logging.getLogger("api-gateway").error("Unhandled exception: %s", traceback.format_exc())
    msg = "An internal error occurred" if _IS_PRODUCTION else str(exc)
    return _JSONResponse(status_code=500, content={"detail": msg})

# CORS
_CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://localhost").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service URLs
GROUPS_SERVICE_URL = "http://groups-service:8002"
EVENTS_SERVICE_URL = "http://events-service:8003"
ENRICHMENT_SERVICE_URL = "http://enrichment-service:8006"

# Internal service secret — shared with enrichment-service to protect /internal/* endpoints
INTERNAL_API_SECRET = os.environ.get("INTERNAL_API_SECRET", "")

# Admin alert email — receives quota-exceeded notifications
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")

# ── OIDC configuration ────────────────────────────────────────────────────────
# GOOGLE_CLIENT_ID — set this env var to enable Google sign-in.
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
# OIDC_PROVIDERS — JSON array of additional providers, e.g.:
#   [{"name":"myidp","client_id":"...","discovery_url":"https://.../.well-known/openid-configuration"}]
_OIDC_PROVIDERS_JSON = os.environ.get("OIDC_PROVIDERS", "[]")

# Cache for OIDC discovery docs and JWKS (TTL=1 hour)
_oidc_cache: TTLCache = TTLCache(maxsize=32, ttl=3600)


async def _oidc_provider_config(provider_name: str) -> dict:
    """Return config dict for the requested OIDC provider."""
    if provider_name == "google" and GOOGLE_CLIENT_ID:
        return {
            "name": "google",
            "client_id": GOOGLE_CLIENT_ID,
            "discovery_url": "https://accounts.google.com/.well-known/openid-configuration",
        }
    try:
        extra = json.loads(_OIDC_PROVIDERS_JSON)
    except Exception:
        extra = []
    for p in extra:
        if p.get("name") == provider_name:
            return p
    raise HTTPException(status_code=400, detail=f"Unknown or unconfigured OIDC provider: {provider_name}")


async def _fetch_jwks(discovery_url: str) -> list:
    """Fetch JWKS keys from the provider's discovery document. Cached for 1 h."""
    cache_key = f"jwks:{discovery_url}"
    if cache_key in _oidc_cache:
        return _oidc_cache[cache_key]
    async with httpx.AsyncClient(timeout=10) as client:
        disc_resp = await client.get(discovery_url)
        disc_resp.raise_for_status()
        jwks_uri = disc_resp.json()["jwks_uri"]
        jwks_resp = await client.get(jwks_uri)
        jwks_resp.raise_for_status()
        keys = jwks_resp.json().get("keys", [])
    _oidc_cache[cache_key] = keys
    return keys


async def _verify_id_token(id_token: str, provider: dict) -> dict:
    """Verify an OIDC ID token (RS256). Returns claims dict."""
    keys = await _fetch_jwks(provider["discovery_url"])
    # Select matching key by kid header
    try:
        header = pyjwt.get_unverified_header(id_token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Malformed ID token: {exc}")
    kid = header.get("kid")
    # Pin to RS256 — never trust the algorithm from the untrusted JWT header.
    matching = next((k for k in keys if not kid or k.get("kid") == kid), None)
    if not matching:
        raise HTTPException(status_code=401, detail="No matching JWKS key found for token")
    try:
        public_key = pyjwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(matching))
        claims = pyjwt.decode(
            id_token, public_key, algorithms=["RS256"], audience=provider["client_id"]
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"ID token verification failed: {exc}")
    return claims


async def _fetch_userinfo(access_token: str, discovery_url: str) -> dict:
    """Fetch userinfo from the provider's userinfo endpoint."""
    cache_key = f"disc:{discovery_url}"
    if cache_key in _oidc_cache:
        userinfo_endpoint = _oidc_cache[cache_key]
    else:
        async with httpx.AsyncClient(timeout=10) as client:
            disc_resp = await client.get(discovery_url)
            disc_resp.raise_for_status()
            userinfo_endpoint = disc_resp.json()["userinfo_endpoint"]
        _oidc_cache[cache_key] = userinfo_endpoint
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            userinfo_endpoint, headers={"Authorization": f"Bearer {access_token}"}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Access token rejected by OIDC provider")
        return resp.json()


# Integration key names (stored in DB)
INTEGRATION_KEYS = [
    "google_api_key", "tmdb_api_key", "igdb_client_id", "igdb_client_secret",
    "radarr_url", "radarr_api_key", "sonarr_url", "sonarr_api_key",
    "giphy_api_key",
]


async def _session_cleanup_loop():
    while True:
        await asyncio.sleep(3600)  # every hour
        try:
            cleanup_expired_sessions()
        except Exception:
            pass


async def _send_reengagement_notifications():
    """Weekly job: push + email users who haven't logged in for 14-60 days."""
    print("[REENGAGEMENT] Starting re-engagement job")
    try:
        inactive = get_inactive_users(days_min=14, days_max=60)
    except Exception as e:
        print(f"[REENGAGEMENT] Failed to fetch inactive users: {e}")
        return

    print(f"[REENGAGEMENT] Found {len(inactive)} inactive user(s)")
    for user in inactive:
        user_id = user["id"]
        username = user.get("full_name") or user["username"]
        try:
            prefs = get_notification_prefs(user_id)
            tokens = get_push_tokens_for_users([user_id])
            if tokens and prefs.get("push_enabled", True):
                await _send_push(
                    tokens,
                    title="We miss you! 👋",
                    body="Your clubs have new activity — come check what you've missed.",
                    data={"link_type": "home"},
                )
            if prefs.get("notify_reminders", True):
                email_service.send_reengagement(user["email"], username)
        except Exception as e:
            print(f"[REENGAGEMENT] Error notifying user {user_id}: {e}")

    print(f"[REENGAGEMENT] Job complete — notified {len(inactive)} user(s)")


async def _send_verification_reminders():
    """Weekly job: remind accounts 1-30 days old that still haven't verified
    their email. A fresh token is minted per send since the link expires in 24h."""
    print("[VERIFY-REMINDER] Starting verification reminder job")
    try:
        unverified = get_unverified_users(days_min=1, days_max=30)
    except Exception as e:
        print(f"[VERIFY-REMINDER] Failed to fetch unverified users: {e}")
        return

    print(f"[VERIFY-REMINDER] Found {len(unverified)} unverified user(s)")
    for user in unverified:
        user_id = user["id"]
        username = user.get("full_name") or user["username"]
        try:
            token, _ = create_verification_token(user_id)
            email_service.send_verification_reminder(user["email"], username, token)
        except Exception as e:
            print(f"[VERIFY-REMINDER] Error notifying user {user_id}: {e}")

    print(f"[VERIFY-REMINDER] Job complete — notified {len(unverified)} user(s)")


@app.on_event("startup")
async def startup():
    """Initialize database on startup."""
    init_db()
    cleanup_expired_sessions()
    storage.ensure_buckets()
    if not INTERNAL_API_SECRET:
        import sys
        print("CRITICAL: INTERNAL_API_SECRET is not set — /internal/* endpoints are UNPROTECTED", file=sys.stderr)
    asyncio.create_task(_session_cleanup_loop())
    scheduler.add_job(_send_reengagement_notifications, 'cron', day_of_week='mon', hour=10, minute=0,
                      id='reengagement', replace_existing=True)
    scheduler.add_job(_send_verification_reminders, 'cron', day_of_week='thu', hour=10, minute=0,
                      id='verification-reminder', replace_existing=True)
    scheduler.start()
    print("API Gateway started")


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Dependency to get current user from session token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")
    user = get_user_by_session(token)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return user


def get_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    """Dependency to verify admin user."""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def user_to_response(user: dict) -> UserResponse:
    """Convert database user to response model."""
    oidc_sub = user.get("oidc_sub") or ""
    linked_providers = [oidc_sub.split(":")[0]] if oidc_sub else []
    return UserResponse(
        id=user["id"],
        username=user["username"],
        email=user["email"],
        full_name=user.get("full_name"),
        avatar_url=user.get("avatar_url"),
        is_admin=bool(user["is_admin"]),
        is_active=bool(user.get("is_active", 1)),
        email_verified=bool(user["email_verified"]),
        onboarding_complete=bool(user.get("onboarding_complete", 0)),
        password_changed=bool(user.get("password_changed", 1)),
        created_at=user["created_at"],
        last_login_at=user.get("last_login_at"),
        linked_providers=linked_providers,
        has_password=bool(user.get("password_hash", "")),
    )


# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "api-gateway"}


# ===== Release Notes =====

@app.get("/releases/latest")
async def get_latest_release():
    """Return the latest release notes (read from releases.json).
    To publish a new release: edit releases.json and redeploy.
    """
    try:
        releases_path = os.path.join(os.path.dirname(__file__), "releases.json")
        with open(releases_path) as f:
            return json.load(f)
    except Exception:
        return None


# ===== Authentication Endpoints =====

@app.post("/auth/register", response_model=SessionResponse, status_code=201)
@limiter.limit("5/minute")
async def register(request: Request, user_data: UserCreate, response: Response):
    """Register a new user."""
    # Check if username or email already taken (unified message prevents enumeration)
    if get_user_by_username(user_data.username) or get_user_by_email(user_data.email):
        raise HTTPException(status_code=400, detail="An account with that username or email already exists")

    # First user to register becomes admin automatically
    is_first_user = get_user_count() == 0

    # Create user
    try:
        user_id = create_user(
            username=user_data.username,
            email=user_data.email,
            password=user_data.password,
            full_name=user_data.full_name,
            is_admin=is_first_user,
            email_verified=is_first_user,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Get user
    user = get_user_by_id(user_id)

    # Send verification email
    verification_token, _ = create_verification_token(user_id)
    email_service.send_verification(user["email"], user["username"], verification_token)

    # Create session
    session_token, expires_at = create_session(user_id)
    _apply_session_cookie(response, session_token)
    update_last_login(user_id)

    return SessionResponse(
        user=user_to_response(user),
        session_token=session_token,
        expires_at=expires_at
    )


@app.post("/auth/login", response_model=SessionResponse)
@limiter.limit("10/minute")
async def login(request: Request, credentials: UserLogin, response: Response):
    """Login user."""
    # Get user
    user = get_user_by_username(credentials.username)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # OIDC-only accounts have no password — direct them to the right sign-in method
    if not user.get("password_hash"):
        provider = user.get("oidc_sub", "").split(":")[0] if user.get("oidc_sub") else "social"
        raise HTTPException(
            status_code=401,
            detail=f"This account was created with {provider.capitalize()} sign-in. Please use that option to log in."
        )

    try:
        password_ok = verify_password(credentials.password, user["password_hash"])
    except Exception:
        password_ok = False

    if not password_ok:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Create session
    session_token, expires_at = create_session(user["id"])
    _apply_session_cookie(response, session_token)
    update_last_login(user["id"])

    return SessionResponse(
        user=user_to_response(user),
        session_token=session_token,
        expires_at=expires_at
    )


@app.post("/auth/oidc", response_model=SessionResponse)
async def oidc_login(req: OIDCAuthRequest, response: Response):
    """Sign in or register using an OIDC provider (Google, etc.).

    Send either `id_token` (preferred — a signed JWT from the provider) or
    `access_token` (the provider's opaque access token; the backend will call
    the userinfo endpoint to exchange it for profile data).
    """
    provider = await _oidc_provider_config(req.provider)

    if req.id_token:
        claims = await _verify_id_token(req.id_token, provider)
        sub = claims.get("sub")
        email = claims.get("email", "")
        full_name = claims.get("name")
        avatar_url = claims.get("picture")
    elif req.access_token:
        info = await _fetch_userinfo(req.access_token, provider["discovery_url"])
        sub = info.get("sub")
        email = info.get("email", "")
        full_name = info.get("name")
        avatar_url = info.get("picture")
    else:
        raise HTTPException(status_code=400, detail="Provide id_token or access_token")

    if not sub:
        raise HTTPException(status_code=401, detail="OIDC provider did not return a subject claim")
    if not email:
        raise HTTPException(status_code=400, detail="OIDC provider did not return an email address")

    oidc_sub = f"{req.provider}:{sub}"

    # 1. Find user by OIDC sub (already linked)
    user = get_user_by_oidc_sub(oidc_sub)

    # 2. Email matches an existing account — always require explicit confirmation before linking,
    #    regardless of provider. This prevents account takeover if a provider account is compromised.
    if not user:
        existing = get_user_by_email(email)
        if existing:
            link_token = create_pending_link(oidc_sub, email, full_name, avatar_url)
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "LINK_REQUIRED",
                    "link_token": link_token,
                    "email": email,
                    "provider": req.provider,
                    "message": (
                        f"An account with this email already exists. "
                        f"Confirm to link your {req.provider.capitalize()} account."
                    ),
                },
            )

    # 3. Create brand-new OIDC-only user
    if not user:
        try:
            user_id = create_oidc_user(email, full_name, oidc_sub, avatar_url)
            user = get_user_by_id(user_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    if not user.get("is_active", 1):
        raise HTTPException(status_code=403, detail="Account is disabled")

    session_token, expires_at = create_session(user["id"])
    _apply_session_cookie(response, session_token)
    update_last_login(user["id"])

    return SessionResponse(
        user=user_to_response(user),
        session_token=session_token,
        expires_at=expires_at,
    )


@app.post("/auth/oidc/confirm-link", response_model=SessionResponse)
async def confirm_oidc_link(body: dict, response: Response):
    """Consume a pending OIDC link token (issued during Apple sign-in) and link the accounts.

    Body: { "link_token": "<token>" }
    Returns a full session just like /auth/oidc would.
    """
    link_token = body.get("link_token", "").strip()
    if not link_token:
        raise HTTPException(status_code=400, detail="link_token is required")

    pending = consume_pending_link(link_token)
    if not pending:
        raise HTTPException(status_code=410, detail="Link token is invalid or has expired. Please sign in again.")

    oidc_sub   = pending["oidc_sub"]
    email      = pending["email"]
    full_name  = pending.get("full_name")
    avatar_url = pending.get("avatar_url")

    # Find the existing account by email and link it
    existing = get_user_by_email(email)
    if not existing:
        # Edge case: account was deleted between token creation and confirmation → create fresh
        try:
            user_id = create_oidc_user(email, full_name, oidc_sub, avatar_url)
            user = get_user_by_id(user_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
    else:
        link_oidc_sub(existing["id"], oidc_sub)
        user = get_user_by_id(existing["id"])

    if not user.get("is_active", 1):
        raise HTTPException(status_code=403, detail="Account is disabled")

    session_token, expires_at = create_session(user["id"])
    _apply_session_cookie(response, session_token)
    update_last_login(user["id"])
    return SessionResponse(
        user=user_to_response(user),
        session_token=session_token,
        expires_at=expires_at,
    )


@app.post("/auth/link", response_model=UserResponse)
async def link_oidc_account(req: OIDCAuthRequest, current_user: dict = Depends(get_current_user)):
    """Link an OIDC provider (Google, Apple) to the currently logged-in account."""
    provider = await _oidc_provider_config(req.provider)

    if req.id_token:
        claims = await _verify_id_token(req.id_token, provider)
        sub = claims.get("sub")
    elif req.access_token:
        info = await _fetch_userinfo(req.access_token, provider["discovery_url"])
        sub = info.get("sub")
    else:
        raise HTTPException(status_code=400, detail="Provide id_token or access_token")

    if not sub:
        raise HTTPException(status_code=401, detail="OIDC provider did not return a subject claim")

    oidc_sub = f"{req.provider}:{sub}"

    # Make sure this sub isn't already linked to a different account
    existing = get_user_by_oidc_sub(oidc_sub)
    if existing and existing["id"] != current_user["id"]:
        raise HTTPException(status_code=409, detail="This social account is already linked to a different user")

    link_oidc_sub(current_user["id"], oidc_sub)
    updated_user = get_user_by_id(current_user["id"])
    return user_to_response(updated_user)


@app.delete("/auth/link/{provider}", status_code=200)
async def unlink_oidc_account(provider: str, current_user: dict = Depends(get_current_user)):
    """Remove an OIDC provider link from the current account."""
    oidc_sub = current_user.get("oidc_sub") or ""
    if not oidc_sub.startswith(f"{provider}:"):
        raise HTTPException(status_code=404, detail=f"{provider} is not linked to this account")
    unlink_oidc_sub(current_user["id"])
    return {"message": f"Unlinked {provider} successfully"}


@app.post("/auth/logout")
async def logout(
    response: Response,
    current_user: dict = Depends(get_current_user),
    authorization: Optional[str] = Header(None),
):
    """Logout user."""
    if authorization and authorization.startswith("Bearer "):
        delete_session(authorization.removeprefix("Bearer "))
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out successfully"}


@app.post("/auth/refresh", response_model=SessionResponse)
async def refresh_session_endpoint(
    response: Response,
    authorization: Optional[str] = Header(None),
):
    """Silently renew a session token without requiring a full re-login."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization[len("Bearer "):]
    new_token, user_id, expires_at = refresh_session(token)
    if not new_token or not user_id:
        raise HTTPException(status_code=401, detail="Session expired or not found")

    user = get_user_by_id(user_id)
    if not user or not user.get("is_active", 1):
        raise HTTPException(status_code=401, detail="Account is disabled or not found")

    _apply_session_cookie(response, new_token)

    return SessionResponse(
        user=user_to_response(user),
        session_token=new_token,
        expires_at=expires_at,
    )


@app.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information."""
    return user_to_response(current_user)


@app.get("/users/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user (spec-aligned alias for /auth/me)."""
    return user_to_response(current_user)


@app.patch("/users/me", response_model=UserResponse)
async def update_profile(profile: UserProfileUpdate,
                          current_user: dict = Depends(get_current_user)):
    """Update current user's profile."""
    # Check username uniqueness if changing
    if profile.username and profile.username != current_user["username"]:
        if get_user_by_username(profile.username):
            raise HTTPException(status_code=400, detail="Username already taken")

    # Check email uniqueness if changing
    if profile.email and profile.email != current_user["email"]:
        if get_user_by_email(profile.email):
            raise HTTPException(status_code=400, detail="Email already registered")

    try:
        update_user_profile(
            current_user["id"],
            full_name=profile.full_name,
            username=profile.username,
            email=profile.email,
            avatar_url=profile.avatar_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    user = get_user_by_id(current_user["id"])
    return user_to_response(user)


# ===== Invite Endpoints =====

@app.post("/invites/send", response_model=InviteResponse)
@limiter.limit("20/hour")
async def send_invite(request: Request, invite_data: InviteSendRequest, current_user: dict = Depends(get_current_user)):
    """Send a group invitation."""
    # Verify user has access to this group via groups service
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{GROUPS_SERVICE_URL}/groups/{invite_data.group_id}/members/{current_user['id']}"
            )
            if response.status_code != 200:
                raise HTTPException(status_code=403, detail="Not authorized to send invites for this group")
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail="Groups service unavailable")

    # Domain abuse check — block if sender already sent 10+ invites to this domain in past hour
    if count_recent_domain_invites(current_user["id"], invite_data.email) >= 10:
        raise HTTPException(status_code=429, detail="Too many invites to this domain — try again later")

    # Check if user with email exists
    existing_user = get_user_by_email(invite_data.email)
    user_exists = existing_user is not None

    # Create invite token
    token, expires_at = create_invite_token(
        email=invite_data.email,
        invited_by=current_user["id"],
        group_id=invite_data.group_id
    )

    # Send email
    inviter_name = current_user.get("full_name") or current_user["username"]
    email_service.send_invite(
        to_email=invite_data.email,
        group_name=invite_data.group_name,
        invited_by_name=inviter_name,
        invite_token=token,
        user_exists=user_exists
    )

    log_invite_send(current_user["id"], invite_data.email)

    return InviteResponse(
        invite_token=token,
        expires_at=expires_at,
        user_exists=user_exists
    )


@app.get("/groups/{group_id}/pending-invites")
async def list_pending_invites(group_id: int, current_user: dict = Depends(get_current_user)):
    """List pending (unaccepted) email invites for a group."""
    return get_pending_invites_for_group(group_id)


@app.get("/auth/invite/{token}", response_model=InviteValidateResponse)
async def get_invite_context(token: str):
    """GET invite context by token (used by AcceptInvite page on load)."""
    invite = get_invite_by_token(token)

    if not invite:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation")

    inviter = get_user_by_id(invite["invited_by"])
    inviter_name = inviter.get("full_name") or inviter["username"]

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{GROUPS_SERVICE_URL}/groups/{invite['group_id']}")
            group_name = response.json().get("name", "Unknown Group") if response.status_code == 200 else "Unknown Group"
        except httpx.RequestError:
            group_name = "Unknown Group"

    existing_user = get_user_by_email(invite["email"])

    return InviteValidateResponse(
        valid=True,
        email=invite["email"],
        group_name=group_name,
        invited_by_name=inviter_name,
        user_exists=existing_user is not None,
        expires_at=invite["expires_at"]
    )


@app.post("/auth/invite/join", response_model=InviteAcceptResponse)
async def join_via_invite(request: InviteAcceptRequest, response: Response):
    """Existing user joins a group via invite token (no registration needed)."""
    invite = get_invite_by_token(request.token)

    if not invite:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation")

    user = get_user_by_email(invite["email"])

    if not user:
        raise HTTPException(status_code=404, detail="No account found for this email. Use /auth/invite/accept to register.")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{GROUPS_SERVICE_URL}/groups/{invite['group_id']}/members",
                json={"user_id": user["id"]}
            )
            if response.status_code not in [200, 201]:
                raise HTTPException(status_code=500, detail="Failed to add user to group")
            group_data = response.json()
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail="Groups service unavailable")

    mark_invite_accepted(request.token)
    session_token, expires_at = create_session(user["id"])
    _apply_session_cookie(response, session_token)
    update_last_login(user["id"])

    return InviteAcceptResponse(
        user=user_to_response(user),
        session_token=session_token,
        group=group_data
    )


@app.post("/invites/validate", response_model=InviteValidateResponse)
async def validate_invite(request: InviteValidateRequest):
    """Validate an invite token."""
    invite = get_invite_by_token(request.token)

    if not invite:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation")

    # Get inviter info
    inviter = get_user_by_id(invite["invited_by"])
    inviter_name = inviter.get("full_name") or inviter["username"]

    # Get group info
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{GROUPS_SERVICE_URL}/groups/{invite['group_id']}")
            if response.status_code == 200:
                group_data = response.json()
                group_name = group_data.get("name", "Unknown Group")
            else:
                group_name = "Unknown Group"
        except httpx.RequestError:
            group_name = "Unknown Group"

    # Check if user exists
    existing_user = get_user_by_email(invite["email"])
    user_exists = existing_user is not None

    return InviteValidateResponse(
        valid=True,
        email=invite["email"],
        group_name=group_name,
        invited_by_name=inviter_name,
        user_exists=user_exists,
        expires_at=invite["expires_at"]
    )


@app.post("/invites/accept", response_model=InviteAcceptResponse)
async def accept_invite(request: InviteAcceptRequest, response: Response):
    """Accept an invitation."""
    invite = get_invite_by_token(request.token)

    if not invite:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation")

    # Check if user exists
    user = get_user_by_email(invite["email"])

    if not user:
        # Create new user
        if not request.username or not request.password:
            raise HTTPException(status_code=400, detail="Username and password required for new users")

        try:
            user_id = create_user(
                username=request.username,
                email=invite["email"],
                password=request.password,
                email_verified=True  # Email is verified through invite
            )
            user = get_user_by_id(user_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    # Add user to group via groups service
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{GROUPS_SERVICE_URL}/groups/{invite['group_id']}/members",
                json={"user_id": user["id"]}
            )
            if response.status_code not in [200, 201]:
                raise HTTPException(status_code=500, detail="Failed to add user to group")

            group_data = response.json()
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail="Groups service unavailable")

    # Mark invite as accepted
    mark_invite_accepted(request.token)

    # Create session
    session_token, expires_at = create_session(user["id"])
    _apply_session_cookie(response, session_token)
    update_last_login(user["id"])

    return InviteAcceptResponse(
        user=user_to_response(user),
        session_token=session_token,
        group=group_data
    )


# ===== Email Verification Endpoints =====

@app.post("/auth/verify-email")
async def verify_email(request: EmailVerifyRequest):
    """Verify email with token."""
    user_id = verify_email_token(request.token)

    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    return {"message": "Email verified successfully"}


@app.post("/auth/resend-verification")
async def resend_verification(current_user: dict = Depends(get_current_user)):
    """Resend verification email."""
    if current_user.get("email_verified"):
        raise HTTPException(status_code=400, detail="Email already verified")

    verification_token, _ = create_verification_token(current_user["id"])
    email_service.send_verification(
        current_user["email"],
        current_user["username"],
        verification_token
    )

    return {"message": "Verification email sent"}


# ===== Password Reset Endpoints =====

@app.post("/auth/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, body: ForgotPasswordRequest):
    """Request password reset."""
    user = get_user_by_email(body.email)

    if not user:
        # Don't reveal if user exists
        return {"message": "If the email exists, a reset link will be sent"}

    reset_token, _ = create_reset_token(user["id"])
    email_service.send_password_reset(user["email"], user["username"], reset_token)

    return {"message": "If the email exists, a reset link will be sent"}


@app.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password with token."""
    user_id = verify_reset_token(request.token)

    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    update_user_password(user_id, request.new_password)

    # A password reset implies the account may have been compromised — unlike an
    # in-app password change, there's no "current" session to preserve here.
    delete_all_sessions(user_id)

    return {"message": "Password reset successfully"}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


@app.post("/auth/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    authorization: str = Header(...),
):
    """Change password for the authenticated user, then revoke all other sessions."""
    if not verify_password(request.current_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    update_user_password(current_user["id"], request.new_password)

    # Revoke all other sessions so other devices are logged out
    token = authorization.replace("Bearer ", "")
    delete_sessions_except(current_user["id"], token)

    return {"message": "Password changed successfully"}


class SetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8)

    @validator('new_password')
    def password_strength(cls, v):
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one number')
        return v


@app.post("/auth/set-password")
async def set_password(
    request: SetPasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    """Set a password for an OIDC-only account that has no password yet."""
    if current_user.get("password_hash", ""):
        raise HTTPException(status_code=400, detail="Account already has a password — use change-password instead")
    update_user_password(current_user["id"], request.new_password)
    return {"message": "Password set successfully"}


# ===== Admin Endpoints =====

# ===== Storage Endpoints =====

_AVATAR_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
_ALLOWED_IMAGE_MAGIC = {
    b"\xff\xd8\xff": "jpg",       # JPEG
    b"\x89PNG\r\n\x1a\n": "png",  # PNG
    b"GIF87a": "gif",             # GIF
    b"GIF89a": "gif",
    b"RIFF": "webp",              # WebP (RIFF....WEBP)
}

def _detect_image_type(data: bytes) -> str:
    """Return detected image extension or raise HTTPException if not a safe image type."""
    for magic, ext in _ALLOWED_IMAGE_MAGIC.items():
        if data[:len(magic)].startswith(magic):
            if ext == "webp" and data[8:12] != b"WEBP":
                continue
            return ext
    raise HTTPException(status_code=415, detail="Unsupported image type. Allowed: JPEG, PNG, GIF, WebP")


def _strip_exif(data: bytes, ext: str) -> bytes:
    """Re-encode image through Pillow to strip EXIF/metadata."""
    try:
        from PIL import Image
        import io as _io
        img = Image.open(_io.BytesIO(data))
        out = _io.BytesIO()
        fmt = {"jpg": "JPEG", "jpeg": "JPEG", "png": "PNG", "gif": "GIF", "webp": "WEBP"}.get(ext, "JPEG")
        if fmt == "JPEG" and img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        img.save(out, format=fmt)
        return out.getvalue()
    except Exception:
        return data  # if strip fails, upload original


@app.post("/users/me/avatar/upload")
async def upload_avatar(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Upload a user avatar image directly (no presigned URL required)."""
    content = await file.read(_AVATAR_MAX_BYTES + 1)
    if len(content) > _AVATAR_MAX_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 5 MB)")
    ext = _detect_image_type(content)
    content = _strip_exif(content, ext)
    object_name = f"user-{current_user['id']}-{uuid.uuid4().hex[:8]}.{ext}"
    mime = {"jpg": "image/jpeg", "png": "image/png", "gif": "image/gif", "webp": "image/webp"}[ext]
    public_url = storage.upload_bytes(storage.BUCKET_AVATARS, object_name, content, mime)
    update_user_profile(current_user["id"], avatar_url=public_url)
    return {"avatar_url": public_url}



# ===== Admin Endpoints =====

# ===== Session Management =====

@app.get("/users/me/sessions", response_model=List[SessionInfo])
async def list_sessions(current_user: dict = Depends(get_current_user)):
    """List all active sessions for the current user."""
    sessions = get_sessions_for_user(current_user["id"])
    return [SessionInfo(**s) for s in sessions]


@app.delete("/users/me/sessions/{token}", status_code=204)
async def revoke_session(token: str, current_user: dict = Depends(get_current_user)):
    """Revoke a specific session."""
    success = delete_session_by_token_for_user(token, current_user["id"])
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")


# ===== Admin User Management =====

@app.get("/users", response_model=List[UserResponse])
async def list_users(limit: int = 100, offset: int = 0,
                      admin: dict = Depends(get_admin_user)):
    """Admin: list all users."""
    users = get_all_users(limit=limit, offset=offset)
    return [user_to_response(u) for u in users]


@app.get("/users/search")
@limiter.limit("30/minute")
async def search_users(request: Request, username: str, current_user: dict = Depends(get_current_user)):
    """Search users by partial username match. Returns id, username, full_name, avatar_url."""
    if not username or len(username.strip()) < 1:
        return []
    results = search_users_by_username(username.strip(), limit=10)
    return results


@app.get("/users/{user_id}/profile")
async def get_user_public_profile(user_id: int, current_user: dict = Depends(get_current_user)):
    """Get a user's public profile (id, username, full_name, avatar_url)."""
    user = get_user_by_id(user_id)
    if not user:
        return {"id": user_id, "username": "Deleted User", "full_name": "Deleted User", "avatar_url": None}
    return {
        "id": user["id"],
        "username": user["username"],
        "full_name": user.get("full_name"),
        "avatar_url": user.get("avatar_url"),
    }


@app.patch("/users/{user_id}", response_model=UserResponse)
async def admin_update_user_endpoint(user_id: int, data: UserAdminUpdate,
                                      admin: dict = Depends(get_admin_user)):
    """Admin: update any user."""
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    admin_update_user(
        user_id,
        full_name=data.full_name,
        is_admin=data.is_admin,
        email_verified=data.email_verified,
        is_active=data.is_active,
    )
    log_admin_action(admin["id"], admin["username"], "user.update",
                     target_user_id=user_id, target_email=user.get("email"),
                     detail=data.model_dump(exclude_none=True))

    user = get_user_by_id(user_id)
    return user_to_response(user)


@app.delete("/users/{user_id}", status_code=204)
async def admin_deactivate_user(user_id: int, admin: dict = Depends(get_admin_user)):
    """Admin: deactivate a user account."""
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    deactivate_user(user_id)
    log_admin_action(admin["id"], admin["username"], "user.deactivate",
                     target_user_id=user_id, target_email=user.get("email"))
    # Remove from all groups and events (best-effort — don't fail the deletion if these error)
    internal_secret = os.getenv("INTERNAL_API_SECRET", "")
    async with httpx.AsyncClient() as client:
        try:
            await client.delete(
                f"{GROUPS_SERVICE_URL}/users/{user_id}/memberships",
                headers={"x-internal-secret": internal_secret},
                timeout=5.0,
            )
        except Exception:
            pass
        try:
            await client.delete(
                f"{EVENTS_SERVICE_URL}/users/{user_id}/attendances",
                headers={"x-internal-secret": internal_secret},
                timeout=5.0,
            )
        except Exception:
            pass


@app.post("/admin/users", response_model=UserResponse, status_code=201)
async def admin_create_user(user_data: AdminUserCreate, admin: dict = Depends(get_admin_user)):
    """Admin: Create a user."""
    if get_user_by_username(user_data.username):
        raise HTTPException(status_code=400, detail="Username already exists")

    if get_user_by_email(user_data.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        user_id = create_user(
            username=user_data.username,
            email=user_data.email,
            password=user_data.password,
            full_name=user_data.full_name,
            is_admin=user_data.is_admin,
            email_verified=user_data.email_verified
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    user = get_user_by_id(user_id)
    log_admin_action(admin["id"], admin["username"], "user.create",
                     target_user_id=user_id, target_email=user_data.email)
    return user_to_response(user)


@app.get("/admin/users/{user_id}", response_model=UserResponse)
async def admin_get_user(user_id: int, admin: dict = Depends(get_admin_user)):
    """Admin: Get user by ID."""
    user = get_user_by_id(user_id)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user_to_response(user)


# ── External Integrations ─────────────────────────────────────────────────────

class IntegrationsUpdate(BaseModel):
    google_api_key: Optional[str] = None
    tmdb_api_key: Optional[str] = None
    igdb_client_id: Optional[str] = None
    igdb_client_secret: Optional[str] = None
    radarr_url: Optional[str] = None
    radarr_api_key: Optional[str] = None
    sonarr_url: Optional[str] = None
    sonarr_api_key: Optional[str] = None
    giphy_api_key: Optional[str] = None


def _integration_status(key: str, stored: dict) -> dict:
    """Return configured/source status for one key without exposing its value."""
    import os
    in_db = bool(stored.get(key))
    in_env = bool(os.getenv(key.upper(), ""))
    return {
        "configured": in_db or in_env,
        "source": "db" if in_db else ("env" if in_env else "none"),
    }


@app.get("/admin/integrations")
async def get_integrations(admin: dict = Depends(get_admin_user)):
    """Admin: return which integration keys are configured (values masked)."""
    stored = get_all_integrations()
    return {k: _integration_status(k, stored) for k in INTEGRATION_KEYS}


@app.put("/admin/integrations")
async def update_integrations(data: IntegrationsUpdate, admin: dict = Depends(get_admin_user)):
    """Admin: save integration API keys to DB then reload enrichment service."""
    for field, value in data.model_dump(exclude_none=True).items():
        if value.strip():
            set_integration(field, value.strip())
    # Notify enrichment service to reload keys
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(f"{ENRICHMENT_SERVICE_URL}/admin/reload-config")
    except Exception:
        pass
    stored = get_all_integrations()
    return {k: _integration_status(k, stored) for k in INTEGRATION_KEYS}


@app.get("/integrations/giphy-key")
async def get_giphy_key_for_client(current_user: dict = Depends(get_current_user)):
    """Return the GIPHY API key value for authenticated users (used by mobile GIF picker)."""
    stored = get_all_integrations()
    key = stored.get("giphy_api_key", "") or os.getenv("GIPHY_API_KEY", "")
    return {"key": key or ""}


@app.delete("/admin/integrations/{key}")
async def remove_integration(key: str, admin: dict = Depends(get_admin_user)):
    """Admin: remove a stored integration key (falls back to env var)."""
    if key not in INTEGRATION_KEYS:
        raise HTTPException(status_code=400, detail="Unknown integration key")
    delete_integration(key)
    return {"ok": True}


# ===== API Quota Block Management =====

@app.post("/admin/api-blocks/{api_name}/approve")
async def approve_api_block(api_name: str, admin: dict = Depends(get_admin_user)):
    """Admin: lift a quota-exceeded block so the API can resume calls."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{ENRICHMENT_SERVICE_URL}/api-usage/unblock/{api_name}",
                params={"unblocked_by": admin.get("email", admin.get("username", "admin"))}
            )
            resp.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach enrichment service: {e}")

    return {"api_name": api_name, "approved_by": admin.get("email", admin.get("username")), "unblocked": True}


# ===== Notification Preferences =====

class NotificationPrefsUpdate(BaseModel):
    notify_rotation:  Optional[bool] = None
    notify_events:    Optional[bool] = None
    notify_reminders: Optional[bool] = None
    notify_invites:   Optional[bool] = None
    push_enabled:     Optional[bool] = None


@app.get("/users/me/notification-prefs")
async def get_my_notification_prefs(current_user: dict = Depends(get_current_user)):
    """Get the current user's notification preferences."""
    return get_notification_prefs(current_user["id"])


@app.put("/users/me/notification-prefs")
async def update_my_notification_prefs(
    prefs: NotificationPrefsUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update the current user's notification preferences."""
    existing = get_notification_prefs(current_user["id"])
    merged = {
        "notify_rotation":  prefs.notify_rotation  if prefs.notify_rotation  is not None else existing["notify_rotation"],
        "notify_events":    prefs.notify_events    if prefs.notify_events    is not None else existing["notify_events"],
        "notify_reminders": prefs.notify_reminders if prefs.notify_reminders is not None else existing["notify_reminders"],
        "notify_invites":   prefs.notify_invites   if prefs.notify_invites   is not None else existing["notify_invites"],
        "push_enabled":     prefs.push_enabled     if prefs.push_enabled     is not None else existing.get("push_enabled", True),
    }
    set_notification_prefs(current_user["id"], **merged)
    return merged


# ===== Discover Preferences =====

@app.get("/users/me/preferences", response_model=UserPreferencesResponse)
async def get_my_preferences(current_user: dict = Depends(get_current_user)):
    """Get the current user's discover preferences."""
    return get_user_preferences(current_user["id"])


@app.put("/users/me/preferences", response_model=UserPreferencesResponse)
async def update_my_preferences(
    data: UserPreferencesUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Save discover preferences then trigger enrichment bulk-load."""
    user_id = current_user["id"]

    # Build fields to upsert (only non-None values)
    fields = {}
    for field, value in data.model_dump(exclude_none=True).items():
        fields[field] = value

    # Save preferences
    prefs = upsert_user_preferences(user_id, **fields)

    # Fire-and-wait bulk load from enrichment service
    load_result = None
    if prefs.get("location_lat") is not None or any(
        a in (prefs.get("activities") or []) for a in ("movies", "books", "gaming")
    ):
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{ENRICHMENT_SERVICE_URL}/preferences/load",
                    json={
                        "user_id": user_id,
                        "lat": prefs.get("location_lat"),
                        "lng": prefs.get("location_lng"),
                        "radius_dining": prefs.get("radius_dining", 10),
                        "radius_hiking": prefs.get("radius_hiking", 25),
                        "radius_arts": prefs.get("radius_arts", 10),
                        "activities": prefs.get("activities", []),
                        "book_genres": prefs.get("book_genres", []),
                        "movie_genres": prefs.get("movie_genres", []),
                        "game_types": prefs.get("game_types", []),
                    }
                )
                if resp.status_code == 200:
                    load_result = resp.json()
        except Exception as e:
            print(f"Enrichment load error: {e}")

    # Mark onboarding complete and update last_loaded_at
    complete_fields = {"onboarding_complete": 1}
    if load_result:
        from datetime import datetime
        complete_fields["last_loaded_at"] = datetime.utcnow().isoformat()
    prefs = upsert_user_preferences(user_id, **complete_fields)

    return prefs


@app.post("/users/me/onboarding/complete")
async def complete_onboarding(current_user: dict = Depends(get_current_user)):
    """Mark onboarding as complete without blocking on enrichment."""
    upsert_user_preferences(current_user["id"], onboarding_complete=1)
    return {"onboarding_complete": True}


@app.post("/users/me/preferences/refresh")
async def refresh_my_preferences(current_user: dict = Depends(get_current_user)):
    """Re-trigger bulk enrichment load without changing preferences."""
    user_id = current_user["id"]
    prefs = get_user_preferences(user_id)

    if not prefs.get("onboarding_complete"):
        raise HTTPException(status_code=400, detail="Complete onboarding first")

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{ENRICHMENT_SERVICE_URL}/preferences/load",
                json={
                    "user_id": user_id,
                    "lat": prefs.get("location_lat"),
                    "lng": prefs.get("location_lng"),
                    "radius_dining": prefs.get("radius_dining", 10),
                    "radius_hiking": prefs.get("radius_hiking", 25),
                    "radius_arts": prefs.get("radius_arts", 10),
                    "activities": prefs.get("activities", []),
                    "book_genres": prefs.get("book_genres", []),
                    "movie_genres": prefs.get("movie_genres", []),
                    "game_types": prefs.get("game_types", []),
                }
            )
            if resp.status_code == 200:
                from datetime import datetime
                upsert_user_preferences(user_id, last_loaded_at=datetime.utcnow().isoformat())
                return {"ok": True, "loaded": resp.json().get("loaded", {})}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Enrichment service error: {e}")

    raise HTTPException(status_code=502, detail="Enrichment load failed")


# ===== Push token + In-app notification endpoints =====

@app.post("/users/{user_id}/push-token", status_code=204)
async def save_push_token(user_id: int, data: dict, current_user: dict = Depends(get_current_user)):
    """Store an Expo push token for a user (called from mobile on login/register)."""
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    token = data.get("token", "")
    platform = data.get("platform", "unknown")
    if token:
        upsert_push_token(user_id, token, platform)


@app.get("/users/{user_id}/notifications")
async def get_user_notifications(user_id: int, current_user: dict = Depends(get_current_user)):
    """Fetch in-app notifications for a user (newest first)."""
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    notifs = get_notifications_for_user(user_id)
    return [
        {**n, "read": bool(n["read"])}
        for n in notifs
    ]


@app.put("/users/{user_id}/notifications/{notif_id}/read", status_code=204)
async def mark_notif_read(user_id: int, notif_id: int, current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    mark_notification_read(notif_id, user_id)


@app.put("/users/{user_id}/notifications/read-all", status_code=204)
async def mark_all_notifs_read(user_id: int, current_user: dict = Depends(get_current_user)):
    if current_user["id"] != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    mark_all_notifications_read(user_id)


async def _send_push(tokens: list, title: str, body: str, data: dict = None):
    """Fire Expo push notifications — best effort, no raise on failure.

    Parses the Expo response to remove DeviceNotRegistered tokens so stale
    tokens (from reinstalled apps) don't accumulate indefinitely.
    """
    if not tokens:
        return
    valid_tokens = [t for t in tokens if t.startswith("ExponentPushToken")]
    if not valid_tokens:
        return
    messages = [
        {"to": t, "title": title, "body": body, "sound": "default",
         "data": data or {}, "channelId": "default"}
        for t in valid_tokens
    ]
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=messages,
                headers={"Accept": "application/json", "Content-Type": "application/json"},
            )
        results = resp.json().get("data", [])
        for i, result in enumerate(results):
            if result.get("status") == "error":
                details = result.get("details", {})
                error_type = details.get("error", "")
                print(f"[PUSH] token={valid_tokens[i]!r} error={error_type}: {result.get('message', '')}")
                if error_type == "DeviceNotRegistered" and i < len(valid_tokens):
                    delete_push_token(valid_tokens[i])
    except Exception as e:
        print(f"[PUSH] Failed to deliver notifications: {e}")


# ===== Internal Notification Trigger =====
# Called by groups/events services over the internal Docker network — no auth required.

class RotationNotifyRequest(BaseModel):
    user_id: int
    group_name: str
    group_id: int

class EventNotifyRequest(BaseModel):
    # Provide either an explicit list of user IDs or a group_id (gateway fetches members)
    user_ids: Optional[List[int]] = None
    group_id: Optional[int] = None
    event_title: str
    event_date: str = ""
    group_name: Optional[str] = None
    creator_name: Optional[str] = None
    creator_id: Optional[int] = None   # used to look up name + exclude from poll notifs
    event_id: int = 0
    type: str = "created"      # "created" | "recurring" | "reminder" | "rsvp_reminder" | "rsvp_deadline_final" | "poll" | "poll_result" | "invite" | "event_cancelled" | "event_edit" | "social_rsvp" | "rating_prompt"
    hours_until: Optional[int] = None
    deadline: Optional[str] = None
    going_count: Optional[int] = None
    has_rsvp: bool = True   # False when event has no RSVP deadline — changes email framing
    maybe_count: Optional[int] = None
    not_going_count: Optional[int] = None
    winner_text: Optional[str] = None   # for poll_result
    result_summary: Optional[str] = None
    responded_count: Optional[int] = None
    total_count: Optional[int] = None


@app.post("/internal/notify/rotation", status_code=202)
async def notify_rotation(req: RotationNotifyRequest, x_internal_secret: Optional[str] = Header(None)):
    """Internal: send rotation-alert email + push + in-app to a user if opted in."""
    if not INTERNAL_API_SECRET or x_internal_secret != INTERNAL_API_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    user = get_user_by_id(req.user_id)
    if not user or not user.get("email"):
        return {"sent": False, "reason": "user not found"}
    prefs = get_notification_prefs(req.user_id)

    # Always create in-app notification
    create_notification(
        req.user_id, "rotation",
        f"🎯 Your turn in {req.group_name}",
        "It's your turn to pick the next activity!",
        link_type="group", link_id=req.group_id,
    )

    # Push notification (respects push_enabled pref)
    if prefs.get("push_enabled", True):
        tokens = get_push_tokens_for_users([req.user_id])
        await _send_push(tokens, f"🎯 Your turn in {req.group_name}",
                         "It's your turn to pick the next activity!",
                         {"link_type": "group", "link_id": req.group_id})

    if not prefs["notify_rotation"]:
        return {"sent": False, "reason": "opted out of email"}

    sent = email_service.send_rotation_alert(
        user["email"],
        user.get("full_name") or user["username"],
        req.group_name,
        req.group_id,
    )
    return {"sent": sent}


class MentionNotifyRequest(BaseModel):
    mentioned_user_ids: List[int]
    link_type: str          # 'event' or 'group'
    link_id: int
    comment_preview: Optional[str] = None


@app.post("/comments/mention", status_code=202)
async def notify_mention(req: MentionNotifyRequest, current_user: dict = Depends(get_current_user)):
    """Notify users mentioned in a comment via in-app + push."""
    import re as _re
    sender_name = current_user.get("full_name") or current_user.get("username") or "Someone"
    raw_preview = (req.comment_preview or "").strip()
    # Strip HTML tags from user-supplied comment preview before sending in notifications
    safe_preview = _re.sub(r"<[^>]+>", "", raw_preview)
    title = f"💬 {sender_name} mentioned you"
    body = safe_preview[:80] if safe_preview else "You were mentioned in a comment"
    notified = 0
    for uid in req.mentioned_user_ids:
        if uid == current_user["id"]:
            continue  # don't notify yourself
        create_notification(uid, "mention", title, body, link_type=req.link_type, link_id=req.link_id)
        prefs = get_notification_prefs(uid)
        if prefs.get("push_enabled", True):
            tokens = get_push_tokens_for_users([uid])
            await _send_push(tokens, title, body, {"link_type": req.link_type, "link_id": req.link_id})
        notified += 1
    return {"notified": notified}


class PushNotifyRequest(BaseModel):
    user_id: int
    title: str = Field(..., max_length=200)
    body: str = Field(..., max_length=500)
    link_type: Optional[str] = None
    link_id: Optional[int] = None


@app.post("/internal/notify/push", status_code=202)
async def notify_push(req: PushNotifyRequest, x_internal_secret: Optional[str] = Header(None)):
    """Internal: send a one-off push + in-app notification to a single user."""
    if not INTERNAL_API_SECRET or x_internal_secret != INTERNAL_API_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    create_notification(
        req.user_id, "system",
        req.title, req.body,
        link_type=req.link_type, link_id=req.link_id,
    )
    # Respect push_enabled pref
    prefs = get_notification_prefs(req.user_id)
    if prefs.get("push_enabled", True):
        tokens = get_push_tokens_for_users([req.user_id])
        await _send_push(tokens, req.title, req.body,
                         {"link_type": req.link_type, "link_id": req.link_id})
    return {"sent": True}


@app.post("/internal/notify/event", status_code=202)
async def notify_event(req: EventNotifyRequest, x_internal_secret: Optional[str] = Header(None)):
    """Internal: send event/poll notifications (email + push + in-app).

    Accepts either an explicit ``user_ids`` list or a ``group_id`` — in the
    latter case the gateway fetches the current member list from groups-service.
    """
    if not INTERNAL_API_SECRET or x_internal_secret != INTERNAL_API_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    # ── Resolve recipient list ───────────────────────────────────────────────
    user_ids = req.user_ids or []
    group_name = req.group_name or "your group"

    if not user_ids and req.group_id:
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                r = await client.get(f"{GROUPS_SERVICE_URL}/groups/{req.group_id}/members")
                if r.status_code == 200:
                    user_ids = [m["user_id"] for m in r.json()]
            except Exception:
                pass
        if not req.group_name:
            async with httpx.AsyncClient(timeout=5.0) as client:
                try:
                    r = await client.get(f"{GROUPS_SERVICE_URL}/groups/{req.group_id}")
                    if r.status_code == 200:
                        group_name = r.json().get("name", group_name)
                except Exception:
                    pass

    # Look up creator name if creator_id provided
    creator_name = req.creator_name or "Someone"
    if req.creator_id and not req.creator_name:
        c = get_user_by_id(req.creator_id)
        if c:
            creator_name = c.get("full_name") or c["username"]

    # For polls: exclude the creator from recipients
    if req.type == "poll" and req.creator_id:
        user_ids = [uid for uid in user_ids if uid != req.creator_id]

    # ── Send per-user ────────────────────────────────────────────────────────
    results = []
    push_prefs: dict = {}   # uid → push_enabled bool, collected during loop
    push_tokens_all = get_push_tokens_for_users(user_ids) if user_ids else []

    for uid in user_ids:
        try:
            user = get_user_by_id(uid)
            if not user:
                continue
            prefs = get_notification_prefs(uid)
            push_prefs[uid] = prefs.get("push_enabled", True)
            name = user.get("full_name") or user["username"]

            if req.type == "poll":
                # In-app notification (always)
                create_notification(
                    uid, "poll",
                    f"🗳️ Vote: {req.event_title}",
                    f"{creator_name} wants your opinion in {group_name}",
                    link_type="group", link_id=req.group_id,
                )
                # Email (if opted in)
                if prefs["notify_events"] and user.get("email"):
                    email_service.send_poll_created(
                        user["email"], name, req.event_title,
                        group_name, creator_name, req.group_id or 0,
                    )

            elif req.type == "poll_result":
                result_line = req.result_summary or "No responses yet"
                winner_line = req.winner_text or "No responses yet"
                create_notification(
                    uid, "poll",
                    f"📊 Poll result: {req.event_title}",
                    f"Winner: {winner_line}",
                    link_type="group", link_id=req.group_id,
                )
                if prefs["notify_events"] and user.get("email"):
                    email_service.send_poll_result(
                        user["email"], name, req.event_title, group_name,
                        winner_line, result_line, req.responded_count or 0,
                        req.total_count or 0, req.group_id or 0,
                    )

            elif req.type == "rsvp_deadline_final":
                create_notification(uid, "event", f"📊 Final RSVP: {req.event_title}",
                                    f"{req.going_count or 0} going · {req.maybe_count or 0} maybe",
                                    link_type="event", link_id=req.event_id)
                if prefs["notify_events"] and user.get("email"):
                    email_service.send_rsvp_deadline_final_count(
                        user["email"], name, req.event_title, req.event_date, group_name,
                        req.going_count or 0, req.maybe_count or 0, req.not_going_count or 0,
                        req.event_id,
                    )

            elif req.type == "rsvp_nudge":
                create_notification(uid, "reminder", f"📅 RSVP needed: {req.event_title}",
                                    f"{creator_name} is asking — are you in?",
                                    link_type="event", link_id=req.event_id)
                if prefs["notify_reminders"] and user.get("email"):
                    email_service.send_rsvp_nudge(
                        user["email"], name, req.event_title, req.event_date or "", group_name,
                        creator_name, req.event_id,
                    )

            elif req.type == "rsvp_reminder":
                create_notification(uid, "reminder", f"⏰ RSVP closes soon: {req.event_title}",
                                    f"Deadline: {req.deadline or 'soon'}",
                                    link_type="event", link_id=req.event_id)
                if prefs["notify_reminders"] and user.get("email"):
                    email_service.send_rsvp_deadline_reminder(
                        user["email"], name, req.event_title, req.event_date, group_name,
                        req.deadline or "", req.event_id,
                    )

            elif req.type == "reminder":
                create_notification(uid, "reminder", f"⏰ Coming up: {req.event_title}",
                                    f"Starting in {req.hours_until or 24} hours",
                                    link_type="event", link_id=req.event_id)
                if prefs["notify_reminders"] and user.get("email"):
                    email_service.send_event_reminder(
                        user["email"], name, req.event_title, req.event_date, group_name,
                        req.hours_until or 24, req.event_id,
                    )

            elif req.type == "recurring":
                create_notification(uid, "event", f"🔁 {req.event_title}",
                                    f"Recurring event scheduled in {group_name}",
                                    link_type="event", link_id=req.event_id)
                if prefs["notify_events"] and user.get("email"):
                    email_service.send_recurring_event_created(
                        user["email"], name, req.event_title, req.event_date, group_name,
                        req.event_id,
                    )

            elif req.type == "invite":
                # Membership notifications (new member, join request, approval) — always in-app + push
                create_notification(
                    uid, "invite",
                    req.event_title,
                    req.group_name or "your group",
                    link_type="group", link_id=req.group_id,
                )
                # Email for member-facing invite notifications (added, approved, declined)
                if prefs.get("notify_invites", True) and user.get("email") and req.group_id:
                    invite_title = req.event_title or ""
                    # Only send email for notifications directed at the member (not admin alerts)
                    is_member_facing = any(kw in invite_title for kw in ("added", "in!", "Welcome", "declined", "Your request"))
                    if is_member_facing:
                        email_service.send_group_membership(
                            user["email"], name,
                            req.group_name or group_name,
                            req.group_id,
                            invite_title,
                        )

            elif req.type == "event_cancelled":
                # Event cancellation — always in-app + push; email respects notify_events pref
                create_notification(
                    uid, "event",
                    f"❌ Cancelled: {req.event_title}",
                    f"This event has been cancelled",
                    link_type="group", link_id=req.group_id,
                )
                if prefs.get("notify_events", True) and user.get("email") and req.group_id:
                    email_service.send_event_cancelled(
                        user["email"], name, req.event_title,
                        req.event_date, group_name, req.group_id,
                    )

            elif req.type == "event_edit":
                # Date/location change alert — always in-app + push
                create_notification(
                    uid, "event",
                    f"✏️ Updated: {req.event_title}",
                    f"Date or location has changed — check the details",
                    link_type="event", link_id=req.event_id,
                )

            elif req.type == "social_rsvp":
                # Someone RSVPed going — in-app only, no push
                create_notification(
                    uid, "event",
                    f"👋 {creator_name} is going!",
                    f"Check who's attending {req.event_title}",
                    link_type="event", link_id=req.event_id,
                )
                # Note: social_rsvp intentionally skips push (high-volume, low-priority)
                results.append(uid)
                continue

            elif req.type == "rating_prompt":
                # Post-event rating prompt — push + in-app
                create_notification(
                    uid, "event",
                    f"⭐ How was {req.event_title}?",
                    "Leave a rating for this event",
                    link_type="event", link_id=req.event_id,
                )

            else:  # "created"
                # Skip the creator — they made the event, no need to notify themselves
                if req.creator_id and uid == req.creator_id:
                    continue
                if req.has_rsvp:
                    notif_body = f"{creator_name} scheduled an event in {group_name} — RSVP now"
                else:
                    notif_body = f"{creator_name} scheduled an event in {group_name}"
                create_notification(uid, "event", f"📅 New event: {req.event_title}",
                                    notif_body,
                                    link_type="event", link_id=req.event_id)
                if prefs["notify_events"] and user.get("email"):
                    email_service.send_event_created(
                        user["email"], name, req.event_title, req.event_date, group_name,
                        creator_name, req.event_id, has_rsvp=req.has_rsvp,
                    )

            results.append(uid)

        except Exception as e:
            print(f"[WARN] notify_event failed for user {uid}: {e}")

    # ── Push notifications (batch) ────────────────────────────────────────────
    if results and push_tokens_all:
        # Filter out users who have disabled push notifications
        push_uids = {uid for uid in results if push_prefs.get(uid, True)}
        push_tokens = get_push_tokens_for_users(list(push_uids))
        if req.type == "poll":
            await _send_push(push_tokens, f"🗳️ Vote in {group_name}",
                             f"{creator_name}: {req.event_title}?",
                             {"link_type": "group", "link_id": req.group_id})
        elif req.type == "poll_result":
            await _send_push(push_tokens, f"📊 Poll result: {req.event_title}",
                             f"Winner: {req.winner_text or 'No responses yet'}",
                             {"link_type": "group", "link_id": req.group_id})
        elif req.type in ("created", "recurring"):
            await _send_push(push_tokens, f"📅 {group_name}",
                             f"New event: {req.event_title}",
                             {"link_type": "event", "link_id": req.event_id})
        elif req.type == "rsvp_reminder":
            await _send_push(push_tokens, f"⏰ RSVP closes soon: {req.event_title}",
                             f"Deadline: {req.deadline or 'soon'}",
                             {"link_type": "event", "link_id": req.event_id})
        elif req.type == "rsvp_deadline_final":
            await _send_push(push_tokens, f"📊 Final RSVP: {req.event_title}",
                             f"{req.going_count or 0} going · {req.maybe_count or 0} maybe",
                             {"link_type": "event", "link_id": req.event_id})
        elif req.type == "rsvp_nudge":
            await _send_push(push_tokens, f"📅 RSVP needed: {req.event_title}",
                             f"{creator_name} is asking — are you in?",
                             {"link_type": "event", "link_id": req.event_id})
        elif req.type == "reminder":
            await _send_push(push_tokens, f"⏰ {req.event_title}",
                             f"Starting in {req.hours_until or 24}h — {group_name}",
                             {"link_type": "event", "link_id": req.event_id})
        elif req.type == "invite":
            await _send_push(push_tokens, req.event_title,
                             req.group_name or "your group",
                             {"link_type": "group", "link_id": req.group_id})
        elif req.type == "event_cancelled":
            await _send_push(push_tokens, f"❌ Cancelled: {req.event_title}",
                             "This event has been cancelled",
                             {"link_type": "group", "link_id": req.group_id})
        elif req.type == "event_edit":
            await _send_push(push_tokens, f"✏️ Updated: {req.event_title}",
                             "Date or location has changed",
                             {"link_type": "event", "link_id": req.event_id})
        elif req.type == "rating_prompt":
            await _send_push(push_tokens, f"⭐ How was {req.event_title}?",
                             "Leave a rating for this event",
                             {"link_type": "event", "link_id": req.event_id})

    return {"notified": results}


@app.get("/internal/integrations")
async def internal_integrations(x_internal_secret: Optional[str] = Header(None)):
    """Internal-only: return stored API key values for enrichment-service reload."""
    if not INTERNAL_API_SECRET or x_internal_secret != INTERNAL_API_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    stored = get_all_integrations()
    return {k: v for k, v in stored.items() if k in INTEGRATION_KEYS}


@app.get("/internal/admin-email")
async def internal_admin_email(x_internal_secret: Optional[str] = Header(None)):
    """Internal-only: return alert recipient emails (ADMIN_EMAIL env var or first admin user)."""
    if not INTERNAL_API_SECRET or x_internal_secret != INTERNAL_API_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    # Explicit env var takes priority; otherwise use the first admin user's email
    if ADMIN_EMAIL:
        return {"emails": [ADMIN_EMAIL]}
    emails = get_admin_emails()
    return {"emails": emails}


@app.get("/internal/users/{user_id}/profile")
async def internal_get_user_profile(
    user_id: int,
    x_internal_secret: Optional[str] = Header(None),
):
    """Internal-only: fetch a user's profile for service-to-service calls (no user auth required)."""
    if not INTERNAL_API_SECRET or x_internal_secret != INTERNAL_API_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    user = get_user_by_id(user_id)
    if not user:
        # Return a graceful fallback so callers don't have to handle 404
        return {"id": user_id, "username": None, "full_name": None, "avatar_url": None, "email": ""}
    return {
        "id": user["id"],
        "username": user.get("username"),
        "full_name": user.get("full_name"),
        "avatar_url": user.get("avatar_url"),
        "email": user.get("email", ""),
    }


@app.get("/internal/users/email-profile")
async def internal_get_user_profile_by_email(
    email: str,
    x_internal_secret: Optional[str] = Header(None),
):
    """Internal-only: fetch a user's profile by email for service-to-service calls."""
    if not INTERNAL_API_SECRET or x_internal_secret != INTERNAL_API_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    user = get_user_by_email(email.strip().lower())
    if not user:
        return {"id": None, "username": None, "full_name": None, "avatar_url": None, "email": email.strip().lower()}
    return {
        "id": user["id"],
        "username": user.get("username"),
        "full_name": user.get("full_name"),
        "avatar_url": user.get("avatar_url"),
        "email": user.get("email", ""),
    }


# ===== Saved Items (Wishlist) =====

class SaveItemRequest(BaseModel):
    item_type: str = Field(..., max_length=50)
    item_id: str = Field(..., max_length=100)
    item_name: str = Field(..., max_length=500)
    item_meta: Optional[dict] = None


class SavedItemResponse(BaseModel):
    id: int
    user_id: int
    item_type: str
    item_id: str
    item_name: str
    item_meta: Optional[dict] = None
    created_at: datetime


@app.get("/users/me/saved", response_model=List[SavedItemResponse])
async def list_saved_items(
    item_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List the current user's saved/bookmarked items, optionally filtered by type."""
    items = get_saved_items(current_user["id"], item_type)
    return [SavedItemResponse(**i) for i in items]


@app.get("/users/me/saved/{item_type}/{item_id}", response_model=SavedItemResponse)
async def check_saved_item(
    item_type: str,
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Check if a specific item is saved. Returns 404 if not saved."""
    item = get_saved_item(current_user["id"], item_type, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Not saved")
    return SavedItemResponse(**item)


@app.post("/users/me/saved", response_model=SavedItemResponse, status_code=201)
async def create_saved_item(
    body: SaveItemRequest,
    current_user: dict = Depends(get_current_user)
):
    """Save/bookmark an item."""
    item = save_item(
        user_id=current_user["id"],
        item_type=body.item_type,
        item_id=body.item_id,
        item_name=body.item_name,
        item_meta=body.item_meta or {},
    )
    return SavedItemResponse(**item)


@app.delete("/users/me/saved/{item_type}/{item_id}", status_code=204)
async def remove_saved_item(
    item_type: str,
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a saved/bookmarked item."""
    deleted = delete_saved_item(current_user["id"], item_type, item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Saved item not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
