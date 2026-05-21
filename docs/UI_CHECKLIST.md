# clubPal Web UI — QA Checklist

Use this checklist to verify every screen and interaction after a deploy or significant change.
Check off items as you go. Items marked **[admin]** require an admin account.

---

## How to use this doc

- **Tester A** — Auth, Onboarding, Dashboard, Groups, Events
- **Tester B** — Discover (all categories), Stats, Leaderboard, Profile, Settings
- Work through each section top-to-bottom. Note any failures with a URL + description.
- Re-run failed items after a fix before closing the build.

**Test accounts to set up before starting:**

| Account | Role | Purpose |
|---|---|---|
| `admin / admin` | Admin | Integration keys, admin-only sections |
| `user1` | Member | Normal user flows |
| `user2` | Member | Multi-user interactions (invites, polls, ratings) |

---

## 1. Auth

### 1.1 Register
- [ ] Navigate to `/register` — form renders (username, email, full name, password)
- [ ] Submit empty form — all required-field errors appear
- [ ] Submit mismatched passwords — error shown
- [ ] Submit valid data — account created, redirected to `/dashboard`
- [ ] Register with existing email — error shown, no duplicate created
- [ ] Register with existing username — error shown
- [ ] Verification email sent (check inbox or server logs)

### 1.2 Email Verification
- [ ] Click verification link from email → `/verify-email/:token` → success message
- [ ] Click same link again → expired/used token message (no crash)

### 1.3 Login
- [ ] Navigate to `/login` — form renders
- [ ] Submit with wrong password — error shown
- [ ] Submit with unverified account — appropriate error or warning shown
- [ ] Submit valid credentials — redirected to `/dashboard`
- [ ] "Forgot password?" link visible and navigates to `/forgot-password`
- [ ] **Google Sign-In** (requires `GOOGLE_CLIENT_ID` env var set at build time)
  - [ ] "or continue with" divider and Google button visible when `VITE_GOOGLE_CLIENT_ID` is set
  - [ ] Google button hidden when env var is not set (no error shown)
  - [ ] Clicking Google button opens Google OAuth popup
  - [ ] Successful Google auth → redirected to `/dashboard`
  - [ ] Google auth failure → inline error shown

### 1.4 Forgot Password
- [ ] Submit email that exists — success message shown
- [ ] Submit email that doesn't exist — no error leak (generic message)
- [ ] Reset link received in email

### 1.5 Reset Password
- [ ] Navigate to reset link → `/reset-password/:token` — form renders
- [ ] Submit mismatched passwords — error shown
- [ ] Submit valid new password — success, redirected to login
- [ ] Attempt same reset link again — expired/used message

### 1.6 Accept Invite
- [ ] Navigate to `/invite/:token` — invite details shown (group name, inviter)
- [ ] Accept as existing user — joined group, redirected
- [ ] Accept as new user — account creation form shown inline
- [ ] Expired invite token — error message, no crash

### 1.7 Logout
- [ ] Click Sign Out in Settings — session cleared, redirected to `/login`
- [ ] After logout, navigating to a protected route redirects to `/login`

---

## 2. Shell / Navigation

### 2.1 Sidebar
- [ ] Sidebar renders at 220px on all protected pages
- [ ] User avatar + name + @username shown at top
- [ ] Clicking top user area navigates to `/settings`
- [ ] **Main nav** — Dashboard, My Groups, Events, Stats, Leaderboard all navigate correctly
- [ ] **Discover section** — collapsible; clicking the label toggles open/closed
- [ ] Discover items: Restaurants, Movies, TV Shows, Books, Hikes, Games, Arts, Activities — all navigate correctly
- [ ] Active nav item has visible active style
- [ ] **Settings nav** — navigates to `/settings`
- [ ] clubPal logo and palStack branding visible at sidebar bottom
- [ ] No horizontal overflow or layout breaks

### 2.2 Topbar
- [ ] 56px sticky header present on all AppShell pages
- [ ] Page title shown correctly per page
- [ ] Bell / notification icon visible
- [ ] Custom topbar content (e.g. Refresh button on Movies) renders inline

### 2.3 Theme — Dark Mode
- [ ] App defaults to system color scheme preference
- [ ] Dark mode: `--bg`, `--s1`–`--s4` surface layers visible and correctly layered
- [ ] All text readable in dark mode (no white-on-white or black-on-black)
- [ ] Rose accent (`--rose`) visible on buttons, active pills, badges
- [ ] Light mode: all cards, inputs, and text readable with correct contrast
- [ ] Theme toggle (if exposed in Settings) switches correctly without page reload

---

## 3. Onboarding Wizard

> Triggered automatically for any user with `onboarding_complete = false`.

- [ ] Wizard overlays the page on first login (not a redirect — content behind it)
- [ ] Can step forward through all wizard steps
- [ ] Can step backward without losing data
- [ ] Completing wizard sets `onboarding_complete = true` — wizard no longer appears on next login
- [ ] Dismissing or skipping wizard (if supported) does not break the session

---

## 4. Dashboard (`/dashboard`)

### 4.1 Layout
- [ ] Page loads without error
- [ ] Greeting ("Good morning / afternoon / evening, [name]") shown with correct time-of-day
- [ ] Stat cards row renders (groups count, events count, hosted count, rating)

### 4.2 Hero Banner
- [ ] **When it's your turn:** HeroBanner visible with "Your Turn" CTA
- [ ] **When it's not your turn:** HeroBanner not shown (null renders cleanly)
- [ ] CTA button on HeroBanner navigates or opens pick flow

### 4.3 Upcoming Events Card
- [ ] Lists upcoming events for the user's groups
- [ ] Activity filter pills shown; clicking a pill filters the list
- [ ] "No upcoming events" empty state shown when list is empty
- [ ] Clicking an event row navigates to `/events/:id`

### 4.4 Turn Queue Card
- [ ] Shows rotation queue for primary group
- [ ] Current turn member highlighted
- [ ] Member names and avatars render correctly
- [ ] "No group yet" empty state if user has no groups

### 4.5 Pick CTA Card
- [ ] Shown when it's the user's turn
- [ ] Opens pick/create event flow on click

### 4.6 Pending Polls Card
- [ ] Shows polls the user hasn't responded to
- [ ] "All caught up" empty state when no pending polls
- [ ] Clicking a poll navigates to the group page

### 4.7 Activity Feed Card
- [ ] Recent group activity shown (events created, members joined, etc.)
- [ ] Empty state when no recent activity

---

## 5. Groups

### 5.1 Groups List (`/groups`)
- [ ] Lists all groups the user belongs to
- [ ] Each GroupCard shows group name, activity type, member count, rotation status
- [ ] "Create a group" button navigates to `/groups/new`
- [ ] Empty state shown when user has no groups
- [ ] Clicking a GroupCard navigates to `/groups/:id`

### 5.2 Create Group (`/groups/new`)
- [ ] Form renders (name, description, activity type, rotation type)
- [ ] ActivityTypePicker shows all activity categories and is selectable
- [ ] Submit with empty name — validation error
- [ ] Submit valid form — group created, redirected to new group detail page
- [ ] New group appears in Groups List

### 5.3 Group Detail (`/groups/:id`)
- [ ] GroupHeroCard renders (name, banner/cover, activity badge, member count)
- [ ] Custom group background (gradient/color/image) renders if set
- [ ] RotationQueueCard shows current turn and queue order
- [ ] MembersCard lists all members with roles and avatars
- [ ] GroupEventsCard lists group events; clicking navigates to event detail
- [ ] PollCard section shows active polls; respond button works
- [ ] Group comments section: add a comment → appears in list
- [ ] Delete own comment → removed from list
- [ ] Cannot delete another user's comment
- [ ] "Invite member" button opens InviteMemberModal

### 5.4 InviteMemberModal (unified username + email)
**Username flow:**
- [ ] Typing a username (no `@`) triggers debounced search after 300 ms
- [ ] Dropdown shows matching users not already in the group
- [ ] Selecting a user shows preview card with "Will be added directly"
- [ ] Click "Add Member" → user added immediately, success screen shown
- [ ] Success screen: user avatar, name, "✓ Added to club" chip
- [ ] "Add Another" resets modal; "Done" closes it

**Email invite flow:**
- [ ] Typing a value containing `@` switches input icon to `✉` and shows `+ Add` button
- [ ] Press Enter or click `+ Add` with a valid email → email added to pending list as a chip
- [ ] Invalid email format → inline error shown
- [ ] Multiple emails can be queued; each shows `×` to remove
- [ ] Footer button label updates to "Send N Invite(s)"
- [ ] Click "Send N Invite(s)" → all invites sent via `/invites/send`; success screen shows list of addresses
- [ ] "They'll receive an email link to join the club" note visible on success screen

### 5.5 Edit Group (`/groups/:id/edit`)
- [ ] Form pre-populated with current values
- [ ] Can change name, description, rotation type
- [ ] BackgroundPicker: can select gradient, solid color, or upload image
- [ ] BannerUpload: can upload a group banner image; preview shown after upload
- [ ] Save → group updated, changes reflected on detail page
- [ ] Cancel → no changes saved

### 5.6 Manage Members (`/groups/:id/members`)
- [ ] All members listed with roles
- [ ] Can change member role (owner/admin/member) — **[admin or owner only]**
- [ ] Can remove a member — confirmation prompt shown
- [ ] Cannot remove the last owner

### 5.7 Rotation Controls
- [ ] Advance rotation — moves to next member, UI updates
- [ ] Reset rotation — returns to first member
- [ ] Set specific member as current — dropdown/picker works
- [ ] SkipTurnModal: skip turn with reason → rotation advances, reason saved

### 5.8 Group Pulse Polls
- [ ] Create a poll from GroupDetail (picker role) — CreatePollModal opens
- [ ] Poll appears in PollCard for all group members
- [ ] Respond to a poll — all four response options (🙌 In, ❤️ Done/loved, 👎 Done/pass, 🚫 Can't make it) selectable
- [ ] Results shown after responding (hidden before)
- [ ] "X of Y responded" count always visible
- [ ] Close poll early — status changes to "closed"
- [ ] Convert poll to event — EventDetail page created, poll status = "converted"

---

## 6. Events

### 6.1 Events List (`/events`)
- [ ] Lists all events the user is associated with
- [ ] Filter/tabs work (upcoming, past, all)
- [ ] EventListRow shows title, date, group, status chip
- [ ] Clicking a row navigates to `/events/:id`
- [ ] "Create event" button navigates to `/events/new`

### 6.2 Create Event (`/events/new`)
- [ ] Form renders (title, group picker, date/time, location, activity type)
- [ ] Group picker only shows groups the user belongs to
- [ ] Submit with empty required fields — validation errors shown
- [ ] Submit valid form — event created, redirected to event detail
- [ ] Rotation host auto-assigned when creating via rotation flow

### 6.3 Event Detail (`/events/:id`)
- [ ] EventHero / EventHeroCard renders (title, cover image or gradient, date, host)
- [ ] Custom background (gradient/color/image) renders if set
- [ ] EventMetaCard shows location, activity type, group name, host name
- [ ] AttendanceCard: RSVP buttons — Attending / Maybe / Declined
- [ ] RSVP status chip updates immediately after response
- [ ] AvatarStack of attendees visible
- [ ] CommentsCard: post a comment → appears immediately
- [ ] GifPicker: click GIF button → picker opens → select GIF → appears inline in comment
- [ ] EmojiPicker: add emoji to comment text
- [ ] Delete own comment → removed
- [ ] PhotoGalleryCard: upload a photo — preview appears in gallery
- [ ] RatingCard: visible after event date has passed (or status = completed)
- [ ] Event history / audit log visible to owner/admin

### 6.4 Edit Event
- [ ] Edit button opens EditEventModal
- [ ] Can change title, date, location, description
- [ ] BackgroundPicker and cover image upload work same as group edit
- [ ] Save → changes reflected on detail page

### 6.5 Rate Event (`/events/:id/rate`)
- [ ] StarRating component — can select 1–5 stars
- [ ] Can leave optional comment
- [ ] Submit → rating saved, user stats updated
- [ ] Cannot rate the same event twice (submit disabled / error shown)
- [ ] Can rate other attendees separately from the event

### 6.6 RSVPModal
- [ ] Opens from event detail
- [ ] Selecting status and saving updates AttendanceCard without page reload

### 6.7 Bill Split — Claim Page (`/claim/:token`, public — no login required)

> This page is accessible to anyone with the claim URL. No auth required.

**Unauthenticated visitor (first visit, no prior guest session):**
- [ ] Choice screen renders: "Log in to your account" button, "Create a free account" button, a divider, and "Continue as Guest →" button
- [ ] "Log in to your account" → navigates to `/login?redirect=/claim/{token}`; after login, redirected back to the claim page as authenticated user
- [ ] "Create a free account" → navigates to `/register?redirect=/claim/{token}`; same redirect after registration
- [ ] "Continue as Guest →" → transitions to guest name input screen

**Guest claiming view:**
- [ ] Name input field renders with `autoFocus`
- [ ] "Have an account? Log in instead →" link navigates to `/login?redirect=/claim/{token}`
- [ ] Submitting with empty name → inline validation error shown
- [ ] Items list: each item shows name and price; checkbox to claim it
- [ ] Submit button disabled while submitting
- [ ] Successful submit → success message shown; `guest_token` persisted to `localStorage` under key `claim_guest_{token}`
- [ ] Re-visiting the same URL with a prior `guest_token` in localStorage → skips choice screen, goes straight to guest form with prior selections pre-filled
- [ ] Re-submitting before finalization → updates existing claim (no duplicate row)

**Authenticated view:**
- [ ] Items list shown directly (no name prompt)
- [ ] Submit → success message; claim stored with `user_id` for proper settlement tracking
- [ ] Logged-in non-attendee who claims via URL is auto-included in finalization (gets a bill share row)

---

## 7. Discover — General (applies to all categories)

- [ ] SearchHero renders on every discover page (eyebrow, headline, search bar, suggestion chips)
- [ ] Clicking a suggestion chip populates and executes search
- [ ] Typing in search bar and submitting returns results
- [ ] Clearing search returns to the selected tab's default results
- [ ] ActivityPill tabs render; clicking a tab loads the correct data
- [ ] Loading state: skeleton cards animate while fetching
- [ ] Empty state: icon + message when no results
- [ ] ResultCard: poster/image, title, subtitle (year/rating), rating star shown
- [ ] Clicking a ResultCard navigates to the detail page
- [ ] **Pick button** on each card: opens PickModal
- [ ] **Poll button** on each card: opens CreatePollModal pre-filled with activity name
- [ ] PickModal: select group → confirm → event created
- [ ] CreatePollModal: fill in note and deadline → submit → poll created for group

---

## 8. Discover — Movies (`/discover/movies`)

- [ ] Tabs: My Feed, Popular, Now Playing, Upcoming
- [ ] **My Feed tab**: personal feed loads from user preferences; SetupBanner shown if feed not configured
- [ ] SetupBanner "Set Up Feed →" navigates to `/settings`
- [ ] **Refresh button** in Topbar: re-fetches preferences and reloads feed
- [ ] Popular / Now Playing / Upcoming tabs load correct TMDB data
- [ ] Movie cards show poster, title, year
- [ ] **[Radarr configured]** "IN LIBRARY" green badge appears on top-right of poster for movies present in Radarr
- [ ] **[Radarr not configured]** No badges shown, no error in console
- [ ] Badge is visible to all users (not just admin)

### Movie Detail (`/discover/movies/:tmdbId`)
- [ ] Backdrop image fills top of page
- [ ] Poster thumbnail shown alongside title, year, runtime, rating, genres
- [ ] Overview text shown
- [ ] Trailer embed (YouTube iframe) shows if trailer available
- [ ] Cast list shows up to 6 cast members with character names
- [ ] "Pick This Movie" button → PickModal opens
- [ ] "Poll Group" button → CreatePollModal opens
- [ ] Back button returns to `/discover/movies`

---

## 9. Discover — TV Shows (`/discover/shows`)

- [ ] Page loads and renders correctly
- [ ] "TV Shows" title shown in Topbar
- [ ] SearchHero headline: "What's your group binge-watching?"
- [ ] Tabs: Popular, Top Rated, Airing Today — all load TMDB TV data
- [ ] Switching tabs loads correct content
- [ ] Show cards display poster, title, first air year, rating
- [ ] **[Sonarr configured]** "IN LIBRARY" green badge on shows present in Sonarr
- [ ] **[Sonarr not configured]** No badges shown, no errors
- [ ] Badge is visible to all users (not just admin) — Sonarr is system-wide
- [ ] Search returns relevant shows
- [ ] Pick / Poll buttons work same as other discover pages

### Show Detail (`/discover/shows/:tmdbId`)
- [ ] Backdrop image fills top
- [ ] Poster shown; "IN LIBRARY" badge on poster if show is in Sonarr
- [ ] Title, first air year, season count, episode count shown
- [ ] Star rating shown
- [ ] Genres shown as pills
- [ ] Overview text shown
- [ ] Trailer embed shows if available
- [ ] Cast list shows up to 6 cast members
- [ ] "Pick This Show" button → PickModal opens
- [ ] "Poll Group" button → CreatePollModal opens
- [ ] Back button returns to `/discover/shows`

---

## 10. Discover — Restaurants (`/discover/restaurants`)

- [ ] Tabs: My Feed, Nearby, Search
- [ ] Nearby requires location permission — prompt shown if denied
- [ ] Restaurant cards show photo, name, rating, price level, open/closed status
- [ ] Clicking a card navigates to `/discover/restaurants/:placeId`

### Restaurant Detail
- [ ] Place name, address, phone, website shown
- [ ] Photos gallery (up to 5 photos)
- [ ] Opening hours shown
- [ ] Map or coordinates shown if available
- [ ] Pick / Poll buttons work

---

## 11. Discover — Books (`/discover/books`)

- [ ] Tabs: My Feed, Popular (bestsellers), Search
- [ ] Book cards show cover, title, author(s), year
- [ ] Clicking a card navigates to `/discover/books/:volumeId`

### Book Detail
- [ ] Cover image, title, authors, publisher, published date shown
- [ ] Description shown
- [ ] Page count shown if available
- [ ] ISBN shown if available
- [ ] Google Books preview link works (opens external)
- [ ] Pick / Poll buttons work

---

## 12. Discover — Games (`/discover/games`)

- [ ] Tabs: My Feed, Popular, Search
- [ ] Games cards show cover, name, platform(s), rating, release year
- [ ] Clicking a card navigates to `/discover/games/:igdbId`

### Game Detail
- [ ] Cover image, name, platforms, genres shown
- [ ] Summary text shown
- [ ] Rating shown
- [ ] Release date shown
- [ ] Pick / Poll buttons work

---

## 13. Discover — Hikes (`/discover/hikes`)

- [ ] Search and Nearby tabs work (same location permission note as Restaurants)
- [ ] Results show park/trail name, distance, rating
- [ ] Hike Detail page shows place detail (reuses place detail structure)
- [ ] Pick / Poll buttons work

---

## 14. Discover — Arts & Culture (`/discover/arts`)

- [ ] Default search shows museums/galleries
- [ ] Cards show venue name, rating, photo
- [ ] Arts Detail shows venue details
- [ ] Pick / Poll buttons work

---

## 15. Activity Picker (`/activities`)

- [ ] Lists all activity types grouped by category
- [ ] Search/filter by name works
- [ ] Clicking an activity shows detail or usage count
- [ ] "Popular" activities highlighted

---

## 16. Stats (`/stats`)

- [ ] StatsHero shows user's headline stats (total events, average rating, hosted count)
- [ ] KpiCard row shows individual KPIs
- [ ] MonthlyBarCard shows events per month bar chart
- [ ] ActivityDonutCard shows breakdown by activity type
- [ ] AchievementsCard lists earned achievements / badges
- [ ] All charts render without overflow or clipping
- [ ] Empty states shown gracefully for new users with no data

---

## 17. Leaderboard (`/leaderboard`)

- [ ] Group selector shown (user's groups)
- [ ] Selecting a group loads that group's leaderboard
- [ ] Ranked list shows member name, avatar, score, hosted count
- [ ] Current user row highlighted
- [ ] Ties handled gracefully (same rank shown)
- [ ] Empty state for groups with no ratings

---

## 18. Profile (`/profile`)

- [ ] Avatar shown (initials fallback if no photo)
- [ ] Full name, username, email shown
- [ ] "Upload avatar" flow: click avatar → file picker → upload → new avatar shown
- [ ] User stats summary shown (events, rating, hosted)
- [ ] Edit profile fields: change full name → saved correctly

---

## 19. Settings (`/settings`)

### 19.1 Profile Settings
- [ ] Full name, username fields editable
- [ ] Password change: current password + new password + confirm → saved
- [ ] Incorrect current password → error shown
- [ ] New passwords mismatch → error shown

### 19.2 Notifications
- [ ] Notification preferences shown (email on/off per event type)
- [ ] Toggling a preference saves without page reload

### 19.3 Integrations — GIF Search (Tenor) [all users]
- [ ] Tenor API key field visible to all users
- [ ] "Configured" badge shown when key is saved
- [ ] Saving a key → "✓ Saved!" feedback shown
- [ ] Removing key → badge resets to "Not set"
- [ ] GIF picker in event comments uses saved key

### 19.4 Integrations — Backend API Keys [admin only]

> These fields are only visible when logged in as an admin account.

- [ ] Admin-only section hidden for non-admin users
- [ ] **Google APIs** — paste a key → save → "✓ Configured" badge shown
- [ ] **TMDB (Movies)** — paste a key → save → badge shown
- [ ] **IGDB (Games)** — paste client ID and client secret → save → badges shown
- [ ] **Radarr (Movies Library)**
  - [ ] Radarr URL field renders as plain text input (not password masked)
  - [ ] Radarr API Key field renders as password input
  - [ ] Enter Radarr URL (e.g. `http://192.168.1.10:7878`) → URL shown in field
  - [ ] Enter API key → save → both show "✓ Configured"
  - [ ] Description reads: "Connect your self-hosted Radarr instance to overlay 'In Library' badges on movie cards."
  - [ ] After save, navigate to `/discover/movies` — IN LIBRARY badges appear on matching movies (all users, not just admin)
  - [ ] Remove Radarr URL key → badge resets → badges disappear from movie cards
- [ ] **Sonarr (TV Library)**
  - [ ] Sonarr URL field renders as plain text input (not password masked)
  - [ ] Sonarr API Key field renders as password input
  - [ ] Enter Sonarr URL (e.g. `http://192.168.1.10:8989`) → URL shown in field
  - [ ] Enter API key → save → both show "✓ Configured"
  - [ ] Description reads: "Connect your self-hosted Sonarr instance to overlay 'In Library' badges on TV show cards."
  - [ ] After save, navigate to `/discover/shows` — IN LIBRARY badges appear on matching shows (all users, not just admin)
  - [ ] Remove Sonarr URL key → badge resets → badges disappear from show cards
- [ ] Saving keys shows "✓ Saved!" feedback and status badges refresh without page reload
- [ ] Env-var-sourced keys show "via env var" label and no Remove button
- [ ] DB-sourced keys show a "Remove" button

### 19.5 API Usage [admin only]
- [ ] "View API Usage" section expandable
- [ ] Usage table shows per-API call counts and cache-hit rates
- [ ] Daily limits editable inline and saveable
- [ ] Quota-exceeded APIs shown with warning indicator

### 19.6 Session
- [ ] "Sign Out" button visible in Session section
- [ ] Clicking Sign Out → logged out, redirected to `/login`

---

## 20. Error States & Edge Cases

- [ ] **404** — navigate to `/unknown-route` → NotFound page renders correctly
- [ ] **Unauthenticated access** — navigating to any protected route when logged out redirects to `/login`
- [ ] **Guest-only routes** — navigating to `/login` when already authenticated redirects to `/dashboard`
- [ ] **Backend offline** — enrichment service down → discover pages show empty state, no crash; error toast or message shown
- [ ] **API key not configured** — e.g. TMDB not set → movies pages show empty results, no uncaught errors in console
- [ ] **Radarr/Sonarr unreachable** — connection times out → no IN LIBRARY badges, no error in UI, no console error
- [ ] **Empty group** — group with no events/members renders empty states, not blank or crashed
- [ ] **Long content** — very long group name / event title / comment doesn't overflow layout
- [ ] **Network slow** — loading skeletons show during all async fetches, not blank content
- [ ] **Form re-submit** — double-clicking a save button doesn't submit twice (button disabled while saving)

---

## 21. Cross-browser & Viewport

- [ ] Chrome (latest) — full regression
- [ ] Firefox (latest) — spot-check all pages
- [ ] Safari (latest) — spot-check; pay attention to CSS variables and flexbox edge cases
- [ ] 1440px wide — standard desktop layout
- [ ] 1024px wide — sidebar still fits, content not clipped
- [ ] 768px wide — sidebar collapses or stays usable; no horizontal scroll on main content

---

## Sign-off

| Section | Tester | Date | Pass / Fail |
|---|---|---|---|
| Auth | | | |
| Shell / Navigation | | | |
| Onboarding | | | |
| Dashboard | | | |
| Groups | | | |
| Events | | | |
| Discover — Movies | | | |
| Discover — TV Shows | | | |
| Discover — Restaurants | | | |
| Discover — Books | | | |
| Discover — Games | | | |
| Discover — Hikes | | | |
| Discover — Arts | | | |
| Stats | | | |
| Leaderboard | | | |
| Profile | | | |
| Settings | | | |
| Error States | | | |
| Cross-browser | | | |
