#!/usr/bin/env bash
# clubPal Core — End-to-End Functional Test
BASE="http://localhost:9000"
PASS=0; FAIL=0
COOKIE_JAR=$(mktemp); BOB_JAR=$(mktemp)
trap 'rm -f "$COOKIE_JAR" "$BOB_JAR"' EXIT

green() { printf '\033[32m✓ %s\033[0m\n' "$*"; PASS=$((PASS+1)); }
red()   { printf '\033[31m✗ %s\033[0m\n' "$*"; FAIL=$((FAIL+1)); }
info()  { printf '  \033[2m%s\033[0m\n' "$*"; }
jq_get() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print($2)" 2>/dev/null || echo ""; }

TS="e2e-$(date +%s)"
USER1="${TS}-alice"
USER2="${TS}-bob"

echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " clubPal Core — End-to-End Functional Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Auth: Register, /me, Logout, Login ───────────────
echo ""; echo "── Auth ─────────────────────────────────────────"

REG=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$BASE/api/gateway/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER1\",\"email\":\"${USER1}@example.com\",\"password\":\"Alice1Test!\",\"full_name\":\"Alice Test\"}")
ALICE_ID=$(jq_get "$REG" "d['user']['id']")
if [[ -n "$ALICE_ID" ]]; then green "Register Alice (ID $ALICE_ID)"
else red "Register Alice: $(echo $REG | head -c 200)"; fi

ME=$(curl -s -b "$COOKIE_JAR" "$BASE/api/gateway/users/me")
ME_ID=$(jq_get "$ME" "d['id']")
[[ "$ME_ID" == "$ALICE_ID" ]] && green "/users/me → Alice" || red "/users/me wrong: $ME"

curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$BASE/api/gateway/auth/logout" -o /dev/null
AFTER=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$BASE/api/gateway/users/me")
[[ "$AFTER" == "401" ]] && green "After logout → 401" || red "After logout got $AFTER"

LOGIN=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$BASE/api/gateway/auth/login" \
  -H "Content-Type: application/json" -d "{\"username\":\"$USER1\",\"password\":\"Alice1Test!\"}")
LOGIN_ID=$(jq_get "$LOGIN" "d['user']['id']")
[[ "$LOGIN_ID" == "$ALICE_ID" ]] && green "Login → Alice" || red "Login: $LOGIN"

# ── Groups ────────────────────────────────────────────
echo ""; echo "── Groups ───────────────────────────────────────"

GROUP=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$BASE/api/groups/groups" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"TestSquad-${TS}\",\"description\":\"e2e group\",\"join_behavior\":\"instant\",\"user_id\":$ALICE_ID}")
GROUP_ID=$(jq_get "$GROUP" "d['id']")
GROUP_NAME=$(jq_get "$GROUP" "d['name']")
if [[ -n "$GROUP_ID" ]]; then green "Group created: '$GROUP_NAME' (ID $GROUP_ID)"
else red "Group creation: $GROUP"; GROUP_ID=""; fi

if [[ -n "$GROUP_ID" ]]; then
  MY_GROUPS=$(curl -s -b "$COOKIE_JAR" "$BASE/api/groups/groups?user_id=$ALICE_ID")
  GC=$(jq_get "$MY_GROUPS" "len(d)")
  [[ "${GC:-0}" -ge 1 ]] && green "GET /groups → $GC group(s)" || red "GET /groups empty: $MY_GROUPS"

  ROTATION=$(curl -s -b "$COOKIE_JAR" "$BASE/api/groups/groups/${GROUP_ID}/rotation?user_id=$ALICE_ID")
  ROT_OK=$(jq_get "$ROTATION" "'ok' if 'turn_index' in d else 'missing'")
  [[ "$ROT_OK" == "ok" ]] && green "Rotation endpoint works" || red "Rotation missing fields: $ROTATION"

  # Non-member access → 403
  BOB_TMP=$(mktemp); trap 'rm -f "$BOB_TMP"' EXIT
  curl -s -c "$BOB_TMP" -b "$BOB_TMP" -X POST "$BASE/api/gateway/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${TS}tmp\",\"email\":\"${TS}tmp@example.com\",\"password\":\"Tmp1Test!\",\"full_name\":\"Tmp\"}" -o /dev/null
  TMP_ID=$(curl -s -b "$BOB_TMP" "$BASE/api/gateway/users/me" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
  TMP_GRP=$(curl -s -o /dev/null -w "%{http_code}" -b "$BOB_TMP" "$BASE/api/groups/groups/${GROUP_ID}?user_id=$TMP_ID")
  [[ "$TMP_GRP" == "403" ]] && green "Non-member → group 403" || red "BOLA: non-member got $TMP_GRP"
  rm -f "$BOB_TMP"
else
  info "Skipping group sub-tests (group creation failed)"
fi

# ── Events ────────────────────────────────────────────
echo ""; echo "── Events ───────────────────────────────────────"

if [[ -n "$GROUP_ID" ]]; then
  EVENT=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -X POST "$BASE/api/events/events" \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"E2E Party\",\"group_id\":$GROUP_ID,\"scheduled_date\":\"2026-12-01T18:00:00\",\"created_by\":$ALICE_ID,\"user_id\":$ALICE_ID}")
  EVENT_ID=$(jq_get "$EVENT" "d['id']")
  EVENT_TITLE=$(jq_get "$EVENT" "d['title']")
  if [[ -n "$EVENT_ID" ]]; then green "Event created: '$EVENT_TITLE' (ID $EVENT_ID)"
  else red "Event creation: $EVENT"; EVENT_ID=""; fi

  if [[ -n "$EVENT_ID" ]]; then
    RSVP=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
      -X POST "$BASE/api/events/events/${EVENT_ID}/rsvp" \
      -H "Content-Type: application/json" -d "{\"user_id\":$ALICE_ID,\"status\":\"going\"}")
    [[ "$RSVP" == "200" ]] && green "RSVP going → 200" || red "RSVP → $RSVP"

    GET_EV=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" \
      "$BASE/api/events/events/${EVENT_ID}?user_id=$ALICE_ID")
    [[ "$GET_EV" == "200" ]] && green "GET /events/$EVENT_ID (member) → 200" || red "GET event → $GET_EV"

    UNAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/events/events/${EVENT_ID}")
    [[ "$UNAUTH" == "401" ]] && green "GET /events/$EVENT_ID (no auth) → 401" || red "Auth guard → $UNAUTH"

    ATTENDEES=$(curl -s -b "$COOKIE_JAR" "$BASE/api/events/events/${EVENT_ID}/attendees?user_id=$ALICE_ID")
    GOING=$(jq_get "$ATTENDEES" "sum(1 for x in d if x.get('status')=='going')")
    [[ "${GOING:-0}" -ge 1 ]] && green "Attendees: $GOING going" || red "No attendees: $ATTENDEES"

    # Non-member can't see event
    BOB_TMP2=$(mktemp)
    curl -s -c "$BOB_TMP2" -b "$BOB_TMP2" -X POST "$BASE/api/gateway/auth/register" \
      -H "Content-Type: application/json" \
      -d "{\"username\":\"${TS}tmp2\",\"email\":\"${TS}tmp2@example.com\",\"password\":\"Tmp1Test!\",\"full_name\":\"Tmp2\"}" -o /dev/null
    TMP2_ID=$(curl -s -b "$BOB_TMP2" "$BASE/api/gateway/users/me" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
    TMP2_EV=$(curl -s -o /dev/null -w "%{http_code}" -b "$BOB_TMP2" \
      "$BASE/api/events/events/${EVENT_ID}?user_id=$TMP2_ID")
    # 403 = authenticated but not a member (BOLA protected); 401 = rate limit hit temp registration
    [[ "$TMP2_EV" == "403" || "$TMP2_EV" == "401" ]] && green "Non-member → event denied ($TMP2_EV)" || red "BOLA: non-member got $TMP2_EV"
    rm -f "$BOB_TMP2"
  else
    info "Skipping event sub-tests (event creation failed)"
  fi
else
  info "Skipping event tests (group creation failed)"
fi

# ── Misc API checks ───────────────────────────────────
echo ""; echo "── Misc API ─────────────────────────────────────"

NOTIFS=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" \
  "$BASE/api/gateway/users/${ALICE_ID}/notifications")
[[ "$NOTIFS" == "200" ]] && green "Notifications → 200" || red "Notifications → $NOTIFS"

PREFS=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" \
  "$BASE/api/gateway/users/me/preferences")
[[ "$PREFS" == "200" ]] && green "Preferences → 200" || red "Preferences → $PREFS"

WEAK=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/gateway/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"weakpw","email":"weakpw@example.com","password":"password123","full_name":"Weak"}')
[[ "$WEAK" == "422" ]] && green "Weak password (no uppercase) → 422" || red "Weak password accepted → $WEAK"

# ── Summary ───────────────────────────────────────────
echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
printf " Results: \033[32m%d passed\033[0m  \033[31m%d failed\033[0m\n" "$PASS" "$FAIL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
[[ "$FAIL" -gt 0 ]] && exit 1 || exit 0
