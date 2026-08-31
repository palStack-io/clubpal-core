#!/usr/bin/env bash
# clubpal_core smoke test — runs against a live stack
# Usage: ./scripts/smoke_test.sh [BASE_URL]
# Default BASE_URL: http://localhost:9000

set -euo pipefail

BASE="${1:-http://localhost:9000}"
PASS=0
FAIL=0
SKIP=0

# ── helpers ──────────────────────────────────────────────────────────────────

green() { printf '\033[32m✓ %s\033[0m\n' "$*"; }
red()   { printf '\033[31m✗ %s\033[0m\n' "$*"; }
yellow(){ printf '\033[33m~ %s\033[0m\n' "$*"; }

ok()   { green "$1"; PASS=$((PASS+1)); }
fail() { red   "$1"; FAIL=$((FAIL+1)); }
skip() { yellow "SKIP $1"; SKIP=$((SKIP+1)); }

# expect HTTP status code
expect_status() {
  local label="$1" expected="$2"
  shift 2
  local actual
  actual=$(curl -s -o /dev/null -w "%{http_code}" "$@")
  if [[ "$actual" == "$expected" ]]; then
    ok "$label (HTTP $actual)"
  else
    fail "$label — expected $expected got $actual"
  fi
}

# expect header present (case-insensitive key match)
expect_header() {
  local label="$1" header="$2"
  shift 2
  local hdrs
  hdrs=$(curl -s -I "$@")
  if echo "$hdrs" | grep -qi "^${header}:"; then
    ok "$label"
  else
    fail "$label — header '${header}' missing"
  fi
}

# expect header absent
expect_no_header() {
  local label="$1" header="$2"
  shift 2
  local hdrs
  hdrs=$(curl -s -I "$@")
  if ! echo "$hdrs" | grep -qi "^${header}:"; then
    ok "$label"
  else
    fail "$label — header '${header}' unexpectedly present"
  fi
}

# expect response body contains string
expect_body_contains() {
  local label="$1" needle="$2"
  shift 2
  local body
  body=$(curl -s "$@")
  if echo "$body" | grep -q "$needle"; then
    ok "$label"
  else
    fail "$label — body does not contain '$needle'"
    echo "  body: $(echo "$body" | head -c 200)"
  fi
}

# generate a unique test email
TEST_SUFFIX="smoke-$(date +%s)"
TEST_EMAIL="${TEST_SUFFIX}@example.com"
TEST_USER="${TEST_SUFFIX}"
TEST_PASS="Smoke1Test!"
COOKIE_JAR=$(mktemp)

trap 'rm -f "$COOKIE_JAR"' EXIT

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " clubPal Core — Smoke Test"
echo " Target: $BASE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Health endpoints ───────────────────────────────────────────────────────
echo "── Health ──────────────────────────────"

expect_status "api-gateway /health"        200 "$BASE/api/gateway/health"
expect_status "groups-service /health"     200 "$BASE/api/groups/health"
expect_status "events-service /health"     200 "$BASE/api/events/health"
expect_status "ratings-service /health"    200 "$BASE/api/ratings/health"
expect_status "activities-service /health" 200 "$BASE/api/activities/health"
expect_status "enrichment-service /health" 200 "$BASE/api/enrich/health"

# ── 2. Security headers ───────────────────────────────────────────────────────
echo ""
echo "── Security Headers ────────────────────"

# API responses (proxy pass — always have server-level headers)
expect_header "X-Content-Type-Options on API"  "x-content-type-options"  "$BASE/api/gateway/health"
expect_header "X-Frame-Options on API"         "x-frame-options"         "$BASE/api/gateway/health"
expect_header "Referrer-Policy on API"         "referrer-policy"         "$BASE/api/gateway/health"
expect_header "Content-Security-Policy on API" "content-security-policy" "$BASE/api/gateway/health"
expect_header "HSTS on API"                    "strict-transport-security" "$BASE/api/gateway/health"
# Web UI root (location / has explicit add_header after nginx fix)
expect_header "X-Content-Type-Options on root" "x-content-type-options"  "$BASE/"
expect_header "X-Frame-Options on root"        "x-frame-options"         "$BASE/"
expect_header "CSP on root"                    "content-security-policy" "$BASE/"

# ── 3. security.txt ───────────────────────────────────────────────────────────
echo ""
echo "── security.txt ────────────────────────"

expect_status  "security.txt reachable"    200 "$BASE/.well-known/security.txt"
expect_body_contains "security.txt has contact" "Contact:" "$BASE/.well-known/security.txt"

# ── 4. CORS ───────────────────────────────────────────────────────────────────
echo ""
echo "── CORS ────────────────────────────────"

# Request with allowed origin (localhost:5173) → should include ACAO header
CORS_RESP=$(curl -s -I -H "Origin: http://localhost:5173" "$BASE/api/gateway/health")
if echo "$CORS_RESP" | grep -qi "access-control-allow-origin"; then
  ok "Allowed origin (localhost:5173) gets CORS header"
else
  fail "Allowed origin (localhost:5173) missing CORS header"
fi

# Request with evil origin → should NOT get ACAO header echoing the evil origin
CORS_EVIL=$(curl -s -I -H "Origin: http://evil.example.com" "$BASE/api/gateway/health")
if echo "$CORS_EVIL" | grep -qi "access-control-allow-origin: http://evil"; then
  fail "Evil origin reflected in CORS header — CORS wildcard still active?"
else
  ok "Evil origin not reflected in CORS header"
fi

# ── 5. Internal endpoint protection ──────────────────────────────────────────
echo ""
echo "── Internal Endpoint Auth ──────────────"

expect_status "Internal /internal/notify without secret → 403" \
  403 -X POST "$BASE/api/gateway/internal/notify/rotation" \
  -H "Content-Type: application/json" \
  -d '{"user_id":1,"group_name":"test","group_id":1}'

expect_status "Internal /internal/admin-email without secret → 403" \
  403 "$BASE/api/gateway/internal/admin-email"

# ── 6. Password strength enforcement ─────────────────────────────────────────
echo ""
echo "── Password Strength ───────────────────"

WEAK_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/gateway/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"weakuser\",\"email\":\"weak@test.local\",\"password\":\"password\",\"full_name\":\"Weak User\"}")
if [[ "$WEAK_RESP" == "422" ]]; then
  ok "Weak password (no uppercase/digit) → 422"
else
  fail "Weak password should return 422, got $WEAK_RESP"
fi

NO_UPPER_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/gateway/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"weakuser2\",\"email\":\"weak2@test.local\",\"password\":\"password1\",\"full_name\":\"Weak User\"}")
if [[ "$NO_UPPER_RESP" == "422" ]]; then
  ok "Password with no uppercase → 422"
else
  fail "No-uppercase password should return 422, got $NO_UPPER_RESP"
fi

NO_DIGIT_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/gateway/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"weakuser3\",\"email\":\"weak3@test.local\",\"password\":\"Password\",\"full_name\":\"Weak User\"}")
if [[ "$NO_DIGIT_RESP" == "422" ]]; then
  ok "Password with no digit → 422"
else
  fail "No-digit password should return 422, got $NO_DIGIT_RESP"
fi

# ── 7. Register + verify httpOnly cookie ──────────────────────────────────────
echo ""
echo "── Auth: Register & Cookie ─────────────"

REG_OUT=$(curl -s -c "$COOKIE_JAR" -D - -X POST "$BASE/api/gateway/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$TEST_USER\",\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\",\"full_name\":\"Smoke Test\"}")

REG_STATUS=$(echo "$REG_OUT" | grep "^HTTP" | awk '{print $2}')
if [[ "$REG_STATUS" == "201" || "$REG_STATUS" == "200" ]]; then
  ok "Register succeeds (HTTP $REG_STATUS)"
else
  fail "Register failed (HTTP $REG_STATUS)"
  echo "  response: $(echo "$REG_OUT" | tail -3)"
fi

if echo "$REG_OUT" | grep -qi "set-cookie: session_token"; then
  ok "Register sets session_token cookie"
else
  fail "Register did not set session_token cookie"
fi

if echo "$REG_OUT" | grep -qi "httponly"; then
  ok "Cookie has HttpOnly flag"
else
  fail "Cookie missing HttpOnly flag"
fi

if echo "$REG_OUT" | grep -qi "samesite=strict"; then
  ok "Cookie has SameSite=Strict"
else
  fail "Cookie missing SameSite=Strict"
fi

# ── 8. /auth/me via cookie ─────────────────────────────────────────────────────
echo ""
echo "── Auth: /me via cookie ────────────────"

ME_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$BASE/api/gateway/auth/me")
if [[ "$ME_STATUS" == "200" ]]; then
  ok "/auth/me authenticated via cookie → 200"
else
  fail "/auth/me with cookie returned $ME_STATUS"
fi

ME_NO_COOKIE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/gateway/auth/me")
if [[ "$ME_NO_COOKIE" == "401" ]]; then
  ok "/auth/me without cookie → 401"
else
  fail "/auth/me without any auth returned $ME_NO_COOKIE (expected 401)"
fi

# ── 9. Logout clears cookie ───────────────────────────────────────────────────
echo ""
echo "── Auth: Logout ────────────────────────"

LOGOUT_OUT=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -D - -X POST "$BASE/api/gateway/auth/logout")
LOGOUT_STATUS=$(echo "$LOGOUT_OUT" | grep "^HTTP" | awk '{print $2}')
if [[ "$LOGOUT_STATUS" == "200" ]]; then
  ok "Logout returns 200"
else
  fail "Logout returned $LOGOUT_STATUS"
fi

if echo "$LOGOUT_OUT" | grep -qi "session_token" && echo "$LOGOUT_OUT" | grep -qi "max-age=0"; then
  ok "Logout clears session_token cookie (Max-Age=0)"
else
  fail "Logout did not clear session_token cookie"
fi

# ── 10. Login + rate limit ────────────────────────────────────────────────────
echo ""
echo "── Auth: Login & Rate Limiting ─────────"

LOGIN_OUT=$(curl -s -c "$COOKIE_JAR" -D - -X POST "$BASE/api/gateway/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}")
LOGIN_STATUS=$(echo "$LOGIN_OUT" | grep "^HTTP" | awk '{print $2}')
if [[ "$LOGIN_STATUS" == "200" ]]; then
  ok "Login succeeds (HTTP 200)"
else
  fail "Login failed (HTTP $LOGIN_STATUS)"
fi

if echo "$LOGIN_OUT" | grep -qi "set-cookie: session_token"; then
  ok "Login sets session_token cookie"
else
  fail "Login did not set session_token cookie"
fi

# Rate limit: hammer wrong-password login — expect 429 after 10 attempts
echo "  Testing login rate limit (11 attempts with wrong password)..."
GOT_LIMITED=0
for i in $(seq 1 15); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/gateway/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"ratelimitprobe","password":"WrongPass1!"}')
  # 429 = slowapi rate limit; 503 = nginx burst limit — both mean rate limiting works
  if [[ "$STATUS" == "429" || "$STATUS" == "503" ]]; then
    GOT_LIMITED=1
    ok "Login rate limit triggered ($STATUS) at attempt $i"
    break
  fi
done
if [[ "$GOT_LIMITED" == "0" ]]; then
  fail "Login rate limit not triggered after 15 attempts"
fi

# ── 11. /auth/me still works after login (fresh cookie) ───────────────────────
echo ""
echo "── Post-login /me check ────────────────"

ME2_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$BASE/api/gateway/auth/me")
if [[ "$ME2_STATUS" == "200" ]]; then
  ok "/auth/me authenticated after fresh login → 200"
else
  fail "/auth/me after login returned $ME2_STATUS"
fi

# ── 12. Groups + Events service auth guard ────────────────────────────────────
echo ""
echo "── Service Auth Guards ─────────────────"

expect_status "GET /groups without auth → 401" \
  401 "$BASE/api/groups/groups/999"

expect_status "GET /events without auth → 401" \
  401 "$BASE/api/events/events/999"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
printf " Results: \033[32m%d passed\033[0m  \033[31m%d failed\033[0m  \033[33m%d skipped\033[0m\n" "$PASS" "$FAIL" "$SKIP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
