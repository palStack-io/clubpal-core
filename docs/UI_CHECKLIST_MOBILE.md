# clubPal Mobile App — QA Checklist

Use this checklist to verify every screen and interaction on the iOS and Android builds.
The mobile app is built with Expo Router (React Native). Test on a real device where possible — simulator is acceptable for layout checks but use a real device for haptics, biometrics, push notifications, and camera/image picker.

---

## How to use this doc

- **Tester A** — Auth, Home, Groups, Events
- **Tester B** — Discover, Stats, Profile, Notifications, Edge Cases
- Work through each section top-to-bottom on **both iOS and Android** unless noted.
- Note failures with: screen name + steps to reproduce + platform (iOS / Android / both).
- Re-run failed items after a fix before closing the build.

**Test accounts to set up before starting:**

| Account | Role | Purpose |
|---|---|---|
| `admin / admin` | Admin | Admin-only flows |
| `user1` | Member | Normal user flows |
| `user2` | Member | Multi-user interactions (polls, RSVP, ratings) |

**Devices to cover:**

| Device | Purpose |
|---|---|
| iPhone (notch or Dynamic Island) | Safe area insets, Face ID |
| iPhone SE / small screen | Ensure nothing clips at 375pt wide |
| Android mid-range | Bottom nav bar, back gesture, Touch ID |
| iPad (if supported) | Layout doesn't break on large screen |

---

## 1. Auth

### 1.1 Login Screen
- [ ] Screen renders on launch when unauthenticated
- [ ] Username and password fields present
- [ ] Keyboard appears on tap; input is tappable across full width
- [ ] "Forgot password?" link visible and tappable
- [ ] Wrong credentials → inline error message shown, no crash
- [ ] Valid credentials → navigates to Home tab
- [ ] "Register" / sign-up link navigates to register screen
- [ ] Keyboard dismisses on scroll or tapping outside field
- [ ] **Biometric quick sign-in** — shown only when `biometric_enabled` SecureStore key is set and hardware is enrolled
  - [ ] Face ID label + scan icon on iPhone with Face ID
  - [ ] Touch ID label + fingerprint icon on other devices
  - [ ] Successful biometric → navigates to Home tab
  - [ ] Failed biometric → error message shown, password form remains available

**Google Sign-In** (requires `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS` / `ANDROID` / `WEB` set in `.env`)
- [ ] "Sign in with Google" button visible below password form
- [ ] Tapping opens Google OAuth browser session
- [ ] Successful Google auth → navigates to Home tab, haptic success
- [ ] Failure / cancel → inline error shown (no crash on cancel)
- [ ] **Android:** requires `EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID` set and SHA-1 fingerprint registered in Google Cloud Console
- [ ] **OAuth consent screen** must be published in Google Cloud Console (not "Testing") for non-test-users

**Apple Sign-In** (iOS physical device only — dev build or production required)
- [ ] Apple button visible on iOS (hidden on Android)
- [ ] Tapping triggers native Apple Sign In sheet
- [ ] First sign-in: name + email returned by Apple; subsequent sign-ins: email only (expected)
- [ ] Successful auth → navigates to Home tab, haptic success
- [ ] User cancels → no error shown, stays on login screen
- [ ] **Account link prompt:** if Apple email matches an existing account, "Link your Apple account?" modal shown
  - [ ] "Link Account" button links and signs in
  - [ ] "Cancel" dismisses without signing in
- [ ] **Requires:** `expo-apple-authentication` native module (dev build / production — NOT Expo Go)

### 1.2 Register Screen
- [ ] All fields present (username, email, full name, password)
- [ ] Empty submit → validation errors shown per field
- [ ] Mismatched passwords → error shown
- [ ] Valid data → account created, navigated to Home
- [ ] Duplicate username / email → error shown

### 1.3 Forgot Password Screen
- [ ] Email field renders
- [ ] Submit → success message shown
- [ ] Back navigation works

### 1.4 Accept Invite (`/invite/[token]`)
- [ ] Invite details shown (group name, inviter)
- [ ] Accept as existing user → joined, navigated to group
- [ ] Accept as new user → account creation flow shown
- [ ] Expired/invalid token → error message, no crash

### 1.5 Session Persistence
- [ ] Close and reopen app → stays logged in (token persisted in SecureStore)
- [ ] Token expiry → redirected to login, not a crash or blank screen

---

## 2. Navigation Shell

### 2.1 Floating Tab Bar
- [ ] Floating tab bar visible on all main tab screens (Home, Groups, Discover, Events, Profile)
- [ ] Tab bar floats above bottom safe area with correct padding (does not overlap system home indicator on iPhone or nav bar on Android)
- [ ] Active tab: filled icon + rose tinted background pill
- [ ] Inactive tabs: outline icon + `tabInactive` colour (visible on both light and dark themes)
- [ ] Tapping a tab navigates correctly and triggers haptic feedback (`selectionAsync`)
- [ ] Tab labels uppercase: HOME, GROUPS, DISCOVER, EVENTS, PROFILE
- [ ] Tab bar does not cover the last item in any scrollable list (check `paddingBottom`)

### 2.2 Theme — Light & Dark
- [ ] App respects system colour scheme by default
- [ ] **Dark mode:** gradient background (`bgGradient`), surface cards, borders, text all use correct dark tokens
- [ ] **Light mode:** same screens readable with correct contrast
- [ ] `tabInactive` colour is clearly visible in both modes (not near-black in dark mode)
- [ ] StatusBar style adapts to system theme (text light on dark background, dark on light)
- [ ] No hardcoded dark-only colours causing invisible elements in light mode
- [ ] LinearGradient backgrounds render on both platforms without flicker

### 2.3 Safe Area
- [ ] Content does not overlap status bar or notch on iPhone
- [ ] Content does not overlap Dynamic Island on iPhone 14 Pro+
- [ ] Bottom content not hidden behind home indicator / system gesture bar
- [ ] Android: content not behind status bar or navigation bar

---

## 3. Home Tab (`/(tabs)/index`)

### 3.1 Header
- [ ] Dynamic greeting: "Up late / Good morning / Good afternoon / Good evening / Good night 👋" updates based on hour (refreshes every 60 s while screen is focused)
- [ ] When user has turns in multiple groups: header shows "You have X picks due" + "Your Turns" title
- [ ] User initials avatar (top-right) renders with rose background
- [ ] Tapping avatar navigates to Profile tab
- [ ] Notification bell icon (top-right) navigates to `/notifications`
- [ ] **Unread badge:** red/rose circle with count appears when there are unread notifications
  - [ ] Badge shows exact count up to 9; shows "9+" for 10 or more
  - [ ] Badge absent when all notifications are read
  - [ ] Bell icon switches to filled variant + rose colour when unread count > 0
  - [ ] Badge count updates automatically (React Query `staleTime: 30 s`, shared with Notifications screen — marking as read on that screen also clears the badge)

### 3.2 Turn Card (single group — it's your turn)
- [ ] Full TurnCard shown with group name, activity emoji, member count
- [ ] Activity colour/background reflects the group's activity type
- [ ] "Browse [Activity] →" CTA button navigates to the correct discover category
- [ ] "or skip my turn" text visible below CTA
- [ ] Tapping CTA triggers medium haptic impact

### 3.3 Turn Mini Cards (multiple groups — your turn in several)
- [ ] One TurnMiniCard per group where it's your turn
- [ ] Each card shows group name, activity label, member count
- [ ] "Pick →" button navigates to correct discover category
- [ ] Haptic on tap

### 3.4 Quick Votes (Pending Polls)
- [ ] Section visible only when user has polls to respond to
- [ ] "💬 Quick Votes" heading shown
- [ ] PollCard renders for each pending poll (activity name, group name, 4 response options)
- [ ] Tapping a response option records it (card updates to show result)
- [ ] Section disappears after all polls responded to
- [ ] Section absent when no pending polls (no blank space or heading)

### 3.5 Activity Filter Pills
- [ ] Horizontal scrollable pill row with "🍽️ All" + all activity categories
- [ ] Tapping a pill filters upcoming events list
- [ ] Active pill has accent background; inactive pill has surface background
- [ ] Haptic on pill tap

### 3.6 Upcoming Events
- [ ] "Upcoming" heading + "See all →" link (navigates to Events tab)
- [ ] Each EventCard shows: activity emoji, event title, date/time, attendee count, RSVP status chip
- [ ] Location shown if set
- [ ] "✓ Going" chip (green) vs "RSVP" chip (amber) reflects user's current RSVP status
- [ ] "View Details" button (if going) → navigates to event detail
- [ ] "RSVP Now" button (if not responded) → opens RSVPModal
- [ ] Empty state: 📅 icon + "Nothing coming up" or "[activity] events" message when list is empty

### 3.7 RSVPModal
- [ ] Modal slides up from bottom
- [ ] Event title and date shown
- [ ] Three RSVP options (Attending, Maybe, Declined) selectable
- [ ] Submitting RSVP → modal closes, EventCard updates status chip
- [ ] Dismiss by tapping backdrop or swipe down

### 3.8 Pull-to-Refresh
- [ ] Pull down on Home → spinner with rose tint → groups, events, and polls all refetch
- [ ] Content updates after refresh

---

## 4. Groups Tab (`/(tabs)/groups`)

### 4.1 Groups List
- [ ] "My Groups" heading + "+ New" button (rose, with shadow)
- [ ] Activity filter pills (emoji-only) horizontal scroll
- [ ] Filtering by activity type filters group cards correctly
- [ ] Loading state: 3 skeleton placeholder cards (faded surface)
- [ ] Empty state: "No groups yet" with "Create Group" button

### 4.2 GroupCard
- [ ] Banner image shown if set (full-width, with dark overlay)
- [ ] Fallback: activity-coloured background with emoji and subtle circle glow
- [ ] Group name, activity label, member count shown over banner
- [ ] Turn badge: "Your Turn!" (accent colour) or "[Name]'s Turn" (semi-transparent)
- [ ] Stats row: Events / Avg ★ / Members — all three cells with separator lines
- [ ] Footer: AvatarStack (up to 3 overlapping initials + "+N" overflow) + "Open →" link
- [ ] Tapping card navigates to group detail, haptic on tap

### 4.3 Group Detail (`/groups/[id]`)
- [ ] Pull-to-refresh works
- [ ] Group hero: banner image or gradient background
- [ ] Group name, activity type, description shown
- [ ] Rotation section: shows current person's name + "Your turn!" badge if applicable
- [ ] Members section: all members listed with initials avatars and roles
- [ ] Upcoming events section: scrollable event list, tap navigates to event detail
- [ ] Polls section: active polls shown via PollCard
- [ ] Past events section with ratings/stars if available
- [ ] Leaderboard section shows ranked member list with scores
- [ ] Edit button (pencil icon) navigates to `/groups/[id]/edit` (visible to owner/admin)
- [ ] Invite button navigates to `/groups/[id]/invite`
- [ ] Create Poll button navigates to `/groups/[id]/poll`

### 4.4 Create Group (`/groups/new`)
- [ ] Form: name, description, activity type picker, rotation type
- [ ] Activity type shows visual picker (emoji tiles)
- [ ] Submit empty name → validation error
- [ ] Valid submit → group created, navigated back to Groups list
- [ ] New group appears in list

### 4.5 Edit Group (`/groups/[id]/edit`)
- [ ] Form pre-populated with current group data
- [ ] BannerPicker: can select/upload group banner image
- [ ] Save → updated, navigated back

### 4.6 Invite Member (`/groups/[id]/invite`)
- [ ] Email input renders
- [ ] Invalid email → error
- [ ] Valid email → success toast/message, invite sent

### 4.7 Create Poll (`/groups/[id]/poll` or `/groups/poll`)
- [ ] Activity name, optional note, deadline picker
- [ ] Submit → poll created, appears in group detail polls section
- [ ] All group members see poll in Quick Votes on their Home screen

### 4.8 PollCard
- [ ] Activity name and group shown
- [ ] 4 response buttons: 🙌 I'm in!, ❤️ Done it loved it, 👎 Done it pass, 🚫 Can't make it
- [ ] Selecting response → result breakdown appears (vote counts per option)
- [ ] "X of Y responded" count visible at all times
- [ ] Already-responded poll shows result, not response buttons
- [ ] "Convert to Event" button visible to poll creator after responding

---

## 5. Events Tab (`/(tabs)/events`)

### 5.1 Events List
- [ ] Lists events the user is attending
- [ ] Filter tabs or pills (upcoming / past / all) work
- [ ] Each row shows activity emoji, title, date, group name, RSVP chip
- [ ] Tapping an event navigates to event detail

### 5.2 Event Detail (`/events/[id]`)
- [ ] Loads event data with pull-to-refresh
- [ ] Hero section: cover image or gradient, event title, date/time, host name
- [ ] Location shown if set
- [ ] Attendee list with avatars and RSVP status chips
- [ ] RSVP actions visible (Attending / Maybe / Declined)
- [ ] Comments section: existing comments listed
- [ ] Post a comment → comment appears immediately
- [ ] Delete own comment (long-press or delete icon)
- [ ] Photos section: tap to view, upload available (camera or library)
- [ ] Rating section visible if event is completed

### 5.3 Rate Event (`/events/[id]/rate`)
- [ ] Star rating component (1–5 stars) tappable
- [ ] Optional comment field
- [ ] Submit → success, navigated back
- [ ] Already rated → shows existing rating (no duplicate)

---

## 6. Discover Tab (`/(tabs)/stats` → Discover Index)

> Note: the "stats" tab slot is used for the Discover entry point.

### 6.1 Discover Index (`/discover/index`)
- [ ] "Discover" heading via ScreenHeader
- [ ] "What does your group want to do?" subtitle
- [ ] 2-column grid of activity category cards
- [ ] Cards present: Restaurants 🍽️, Movies 🎬, Books 📚, Hikes 🥾, Games 🎮, Arts & Culture 🎨
- [ ] Each card has gradient icon tile, label, and description
- [ ] Tapping a card navigates to the correct discover sub-screen
- [ ] No TV Shows card in mobile discover index (feature not yet ported to mobile)

### 6.2 Movies (`/discover/movies`)
- [ ] DiscoverHero component renders (search bar, heading)
- [ ] Search field accepts input, executes search on submit
- [ ] ActivityPill tabs: Popular, Now Playing, Upcoming (or similar)
- [ ] Movie cards show poster, title, year, rating
- [ ] Tapping card navigates to movie detail (if implemented)
- [ ] Pick / Poll actions available per card

### 6.3 Books (`/discover/books`)
- [ ] Search works
- [ ] Book cards show cover, title, authors
- [ ] Tapping navigates to book detail (if implemented)

### 6.4 Restaurants (`/discover/restaurants`)
- [ ] Location permission prompt on first load (if not previously granted)
- [ ] Nearby results shown if permission granted
- [ ] Search by name works
- [ ] Restaurant cards show photo, name, rating, cuisine type
- [ ] Tapping navigates to restaurant detail

### 6.5 Hikes (`/discover/hikes`)
- [ ] Location permission prompt appears
- [ ] Nearby trails/parks shown
- [ ] Search works
- [ ] Cards show park name, distance/rating

### 6.6 Games (`/discover/games`)
- [ ] Popular games shown by default
- [ ] Search works
- [ ] Game cards show cover art, name, rating

### 6.7 Arts & Culture (`/discover/arts`)
- [ ] Museums/galleries shown
- [ ] Search works
- [ ] Cards show venue name, photo, rating

### 6.8 Discover — General (all categories)
- [ ] DiscoverHero search bar present on all discover screens
- [ ] Suggestion chips (if present) populate and execute search on tap
- [ ] Loading state shown during fetch (skeleton or spinner)
- [ ] Empty state shown when no results (icon + message)
- [ ] Pull-to-refresh where available
- [ ] Content clears bottom tab bar (sufficient `paddingBottom`)

---

## 7. Stats Tab (`/(tabs)/stats`)

> In the tab bar this slot is labelled "Discover" and leads to the discover index. The actual user stats are shown on the Profile screen. Verify the tab routes correctly.

- [ ] Tapping the "Discover" (search icon) tab navigates to `/discover/index`
- [ ] Stats visible on Profile screen (not in a separate tab unless changed)

---

## 8. Profile Tab (`/(tabs)/profile`)

### 8.1 Profile Header
- [ ] User initials avatar (rose circle with shadow)
- [ ] Full name and @username shown
- [ ] Admin badge shown for admin accounts (`· Admin`)
- [ ] 4-stat row: Events, Avg ★, Groups, Picks — all populated or showing "—"

### 8.2 Activity Breakdown
- [ ] Grid of activity tiles (one per category)
- [ ] Count shown per activity type
- [ ] All tiles visible without scrolling conflict

### 8.3 Achievements
- [ ] "X / Y" count shown
- [ ] Unlocked achievements: full opacity, rose glow background, rose border
- [ ] Locked achievements: 28% opacity, no glow
- [ ] Correct emoji for each badge

### 8.4 Settings Rows
- [ ] **Edit Profile** → navigates to `/profile/edit`
- [ ] **Notifications** → row tappable (navigates or opens modal)
- [ ] **Integrations** → row tappable
- [ ] **Biometric Login** (Face ID / Touch ID)
  - [ ] Row only visible if device has biometric hardware enrolled
  - [ ] Label shows "Face ID" on Face ID devices, "Touch ID" on fingerprint devices
  - [ ] Enabling: triggers biometric prompt → on success, toggle turns on
  - [ ] Enabling: cancelling prompt → toggle stays off
  - [ ] Disabling: toggle turns off without re-authentication
  - [ ] Setting persisted in SecureStore across app restarts
- [ ] **Dark Mode** toggle row visible (functional or placeholder)
- [ ] **Server Config** row visible only in `__DEV__` builds, hidden in production
- [ ] **Sign Out** row — red label, heavy haptic on tap → logs out and returns to auth screen
- [ ] Version string "clubPal · v1.0.0 · palStack.io" visible at bottom

### 8.5 Edit Profile (`/profile/edit`)
- [ ] Form pre-populated with current full name, username
- [ ] Changing values and saving → profile updates, navigated back
- [ ] Avatar upload: tap avatar → image picker (camera / library) → new avatar shown

---

## 9. Bill Split (`/events/[id]/billsplit/...`)

> Bill split is initiated from the event detail screen by the payer. The claiming flow is accessible to anyone with the claim URL (no login required).

### 9.1 Assign Screen (`/events/[id]/billsplit/assign`)
- [ ] Receipt items list renders from OCR or manual entry
- [ ] Each item row shows name + price
- [ ] Attendees shown as selectable chips per item
- [ ] Submitting assignment → navigates to claiming screen
- [ ] "Cancel" returns to event detail without saving

### 9.2 Claiming Screen (`/events/[id]/billsplit/claiming`)
- [ ] "SHARE LINK" card visible at top of screen
  - [ ] Claim URL rendered as readable text (truncated if long)
  - [ ] "Copy Link" button — tapping copies URL to clipboard via `expo-clipboard`; button text briefly changes to "Copied!" feedback
  - [ ] "Share" button — tapping opens native iOS/Android share sheet with the claim URL
- [ ] Member list renders showing all RSVP'd attendees
  - [ ] Each row shows avatar initials, name, items claimed (or "—" if none yet), submitted timestamp
  - [ ] Members with `is_guest=true` show a purple "GUEST" badge next to their name
  - [ ] Submitted members show claimed items in a readable list
- [ ] Progress indicator shows how many of N members have submitted
- [ ] Pull-to-refresh updates submission status
- [ ] "Finalize" button visible to payer; disabled until sufficient members have submitted
- [ ] Tapping "Finalize" opens confirmation; on confirm, bill shares are computed and members notified

### 9.3 Claim Page — Web (public, no login required)
> Tested in browser, not native app — included here for cross-platform reference.
- [ ] Unauthenticated visitor sees **choice screen**: "Log in to your account", "Create a free account", and "Continue as Guest →"
- [ ] "Log in" link → `/login?redirect=/claim/{token}`; after login, redirects back to claim page
- [ ] "Create account" link → `/register?redirect=/claim/{token}`; same redirect after register
- [ ] "Continue as Guest →" shows guest name input form with `autoFocus`
- [ ] Guest name required; submit without name → validation error shown
- [ ] "Have an account? Log in instead →" link visible on guest form
- [ ] Authenticated visitor sees items list directly (no name prompt)
- [ ] Items list: each item shows name, price, checkbox to select
- [ ] Submitting items → success message; re-visiting with same `guest_token` (localStorage) pre-fills prior selection
- [ ] Guest token persisted in `localStorage` under `claim_guest_{token}` key; re-submitting before finalization updates selection (no duplicate)

---

## 10. Notifications (`/notifications`)

- [ ] Screen accessible via bell icon on Home header
- [ ] Notification list renders (or empty state "All caught up")
- [ ] Each notification shows: type icon, title, body, timestamp
- [ ] Tapping a notification navigates to the correct link (event, group, or poll)
- [ ] Unread notifications visually distinct from read ones
- [ ] "Mark all read" action available
- [ ] Pull-to-refresh works

### Push Notifications (on device only)
- [ ] Permission prompt shown on first launch (iOS)
- [ ] Expo push token registered successfully (check server logs)
- [ ] New event created → push notification received on other group members' devices
- [ ] Rotation advance → "Your turn!" push received by next picker
- [ ] New poll → "Vote now" push received by group members
- [ ] Tapping push notification deep-links to the correct screen

---

## 11. Dev Settings (`/dev-settings`)

> Only visible in development builds (`__DEV__ === true`). Should not appear in production.

- [ ] Screen accessible from Profile → Server Config
- [ ] Can enter a custom server URL (for pointing at local dev backend)
- [ ] Saving URL persists across app restarts
- [ ] Reset to default works
- [ ] **Not visible** in production / release builds

---

## 12. Deep Links & Navigation

- [ ] `/invite/[token]` — invite deep link opens correct screen from outside the app
- [ ] Back navigation (swipe-back on iOS, hardware back on Android) works on all stack screens
- [ ] Android back button on tabs navigates within tab, not out of app unexpectedly
- [ ] Navigating away from a screen and back does not reset scroll position where it should be preserved

---

## 13. Haptics

> All haptic calls should fire on real devices. Skip on simulator.

- [ ] Tab bar tap → `selectionAsync` (light tap)
- [ ] Filter pill tap → `selectionAsync`
- [ ] Group card tap → `selectionAsync`
- [ ] "Browse [Activity] →" CTA on TurnCard → `impactAsync(Medium)`
- [ ] "+ New" group button → `impactAsync(Medium)`
- [ ] Sign Out → `impactAsync(Heavy)`
- [ ] Settings row taps → `selectionAsync`
- [ ] No haptics firing unexpectedly on passive renders

---

## 14. Offline & Error States

- [ ] **No network:** app launches without crash; screens show empty states or stale cached data
- [ ] **API unreachable:** discover screens show empty results, not a crash or blank white screen
- [ ] **Slow network:** loading skeletons / spinners visible during all async operations
- [ ] **Image load failure:** broken image handled gracefully (no blank white box, fallback shown)
- [ ] **Auth token expired mid-session:** next API call returns 401 → user redirected to login, not a crash
- [ ] **Long text:** event title / group name with 80+ characters doesn't overflow card bounds (`numberOfLines` or `ellipsizeMode`)
- [ ] **Empty group / event list:** correct empty state shown, no "undefined" text visible

---

## 15. Keyboard Behaviour

- [ ] Text inputs in modals/forms scroll above keyboard when focused (KeyboardAvoidingView or equivalent)
- [ ] Keyboard dismisses on scroll in long forms
- [ ] "Return" / "Done" key on keyboard behaves as expected (dismiss or move to next field)
- [ ] No inputs hidden permanently behind keyboard on small devices (iPhone SE)

---

## 16. Platform-Specific

### iOS
- [ ] Dynamic Island / notch — no content clipped at top
- [ ] Bottom home indicator — tab bar floats above it with correct inset
- [ ] Face ID prompt title is descriptive ("Enable Face ID" / biometric auth prompt)
- [ ] Swipe-back gesture works on all navigation stack screens
- [ ] Modal sheets dismiss on downward swipe

### Android
- [ ] Android hardware back button works on all screens
- [ ] Status bar text colour adapts to light/dark mode
- [ ] Bottom navigation bar (gesture or buttons) — tab bar does not overlap it
- [ ] Touch ID / fingerprint prompt works if device has biometric enrolled
- [ ] No missing fonts (ensure bundled correctly in APK)
- [ ] `elevation` / shadow props render (Android uses elevation, not box shadow)

---

## 16. Performance

- [ ] Home tab loads within ~2 seconds on Wi-Fi (groups + events + polls in parallel)
- [ ] Scrolling group list smooth at 60fps (no jank on mid-range Android)
- [ ] Images load with `expo-image` transition (300ms fade-in, not hard-pop)
- [ ] No `VirtualizedList` warnings in console for nested scroll views
- [ ] Re-renders don't cause visible flicker on tab switch

---

## Sign-off

| Section | Tester | iOS | Android | Notes |
|---|---|---|---|---|
| Auth | | | | |
| Navigation Shell | | | | |
| Home Tab | | | | |
| Groups Tab | | | | |
| Events Tab | | | | |
| Discover Index | | | | |
| Discover — Movies | | | | |
| Discover — Books | | | | |
| Discover — Restaurants | | | | |
| Discover — Hikes | | | | |
| Discover — Games | | | | |
| Discover — Arts | | | | |
| Bill Split | | | | |
| Profile Tab | | | | |
| Notifications | | | | |
| Haptics | | | | |
| Offline / Error States | | | | |
| Keyboard Behaviour | | | | |
| iOS Specific | | | | |
| Android Specific | | | | |
| Performance | | | | |
