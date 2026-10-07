import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { groupsApi } from '../api/groups'
import { eventsApi } from '../api/events'

import AppShell from '../components/shell/AppShell'
import Topbar from '../components/shell/Topbar'
import Button from '../components/ui/Button'
import HeroCarousel from '../components/dashboard/HeroCarousel'
import AttentionBand from '../components/dashboard/AttentionBand'
import MyClubsCard from '../components/dashboard/MyClubsCard'
import PendingPollsCard from '../components/dashboard/PendingPollsCard'
import UpcomingEventsCard from '../components/dashboard/UpcomingEventsCard'
import TurnQueueCard from '../components/dashboard/TurnQueueCard'
import ActivityFeedCard from '../components/dashboard/ActivityFeedCard'
import CreateGroupModal from '../components/modals/CreateGroupModal'
import CreateEventModal from '../components/modals/CreateEventModal'
import { useTour } from '../components/onboarding/useTour'
import TourOverlay from '../components/onboarding/TourOverlay'
import { tourSteps } from '../components/onboarding/tourSteps'
import { useToast } from '../components/ui/Toast'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function eventsThisMonth(events) {
  const now = new Date()
  return events.filter(e => {
    if (!e.scheduled_date) return false
    try {
      const d = new Date(e.scheduled_date)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    } catch { return false }
  }).length
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [groups, setGroups] = useState([])
  const [events, setEvents] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [rotation, setRotation] = useState(null)
  const [allRotations, setAllRotations] = useState([])
  const [primaryGroupId, setPrimaryGroupId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pendingPolls, setPendingPolls] = useState([])
  const [myPolls, setMyPolls] = useState([])
  const [rsvpNeeded, setRsvpNeeded] = useState([])
  const [activityItems, setActivityItems] = useState([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const { active: tourActive, step: tourStep, next: tourNext, prev: tourPrev, goTo: tourGoTo, end: tourEnd } = useTour(user)

  useEffect(() => {
    if (!user?.id) return
    load()
  }, [user?.id])

  async function load() {
    setLoading(true)
    try {
      const [groupsData, eventsData] = await Promise.all([
        groupsApi.getUserGroups(user.id).catch(() => []),
        eventsApi.getUserEvents(user.id).catch(() => []),
      ])

      const g = groupsData || []
      const e = eventsData || []
      setGroups(g)

      setAllEvents(e)
      const upcoming = e.filter(ev => ev.status === 'scheduled' || ev.status === 'in_progress')
      setEvents(upcoming)

      // Events where user hasn't responded yet (include maybe — they haven't committed)
      setRsvpNeeded(upcoming.filter(ev =>
        !ev.my_rsvp_status || ev.my_rsvp_status === 'pending' || ev.my_rsvp_status === 'maybe'
      ))

      // Check ALL groups for whose turn it is — skip manual-rotation groups
      if (g.length > 0) {
        const rotations = await Promise.all(
          g.map(grp => groupsApi.getRotation(grp.id).catch(() => null))
        )
        setAllRotations(rotations)
        const myTurnIdx = rotations.findIndex((r, i) =>
          String(r?.user_id) === String(user?.id) && g[i]?.rotation_type !== 'none'
        )
        const firstNonManualIdx = g.findIndex(grp => grp.rotation_type !== 'none')
        const activeIdx = myTurnIdx >= 0 ? myTurnIdx : (firstNonManualIdx >= 0 ? firstNonManualIdx : 0)
        setRotation(rotations[activeIdx])
        setPrimaryGroupId(g[activeIdx].id)
      }

      // Pending polls + my active polls (non-blocking, parallel)
      Promise.all([
        groupsApi.getPendingPolls(user.id).catch(() => []),
        groupsApi.getMyActivePolls(user.id).catch(() => []),
      ]).then(([pending, mine]) => {
        setPendingPolls(Array.isArray(pending) ? pending : [])
        setMyPolls(Array.isArray(mine) ? mine : [])
      })

      // Activity feed: recent comments from each group (up to 5 groups)
      loadActivityFeed(g.slice(0, 5))
    } catch (err) {
      toast.error('We couldn\'t load your dashboard. Refresh and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function loadActivityFeed(groupList) {
    setActivityLoading(true)
    try {
      const results = await Promise.allSettled(
        groupList.map(group =>
          groupsApi.getComments(group.id).then(comments => ({
            groupId: group.id,
            groupName: group.name,
            comments: Array.isArray(comments) ? comments : [],
          }))
        )
      )

      const commentItems = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(({ value }) =>
          value.comments.slice(0, 5).map(c => ({
            id: c.id,
            type: 'comment',
            groupName: value.groupName,
            groupId: value.groupId,
            actor: c.username || c.full_name || '',
            content: c.content,
            created_at: c.created_at,
          }))
        )

      // Merge + sort by newest first, cap at 12
      const all = [...commentItems].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      ).slice(0, 12)

      setActivityItems(all)
    } catch {
      setActivityItems([])
    } finally {
      setActivityLoading(false)
    }
  }

  async function handlePollRespond(pollId, response) {
    try {
      await groupsApi.respondToPoll(pollId, user.id, response)
      setPendingPolls(prev => prev.filter(p => p.id !== pollId))
    } catch {}
  }

  function handleRsvpResponded(eventId) {
    setRsvpNeeded(prev => prev.filter(e => e.id !== eventId))
  }

  const primaryGroupObj = groups.find(g => g.id === primaryGroupId)
  const memberCount = primaryGroupObj?.member_count || 0
  const activeTurn =
    String(rotation?.user_id) === String(user?.id) && primaryGroupId &&
    primaryGroupObj?.rotation_type !== 'none' && memberCount > 1
      ? {
          groupId: primaryGroupId,
          groupName: primaryGroupObj?.name || 'Your Group',
          activityEmoji: rotation?.activity_emoji || primaryGroupObj?.activity_emoji || '🔄',
          activityType: rotation?.activity_type || primaryGroupObj?.activity_type || '',
          dueDate: rotation?.due_date || null,
          memberCount,
          pickedEventId: rotation?.picked_event_id || null,
        }
      : null

  const monthEvents = eventsThisMonth(allEvents)
  const activeGroups = groups.length

  const turnPosition = activeTurn ? '1st 🔄' : (rotation?.turn_index != null ? ordinal(rotation.turn_index + 1) : '—')

  const greeting = `${getGreeting()}, ${user?.full_name?.split(' ')[0] || user?.username}`

  const subtitle = `${activeGroups} group${activeGroups !== 1 ? 's' : ''} · ${events.length} upcoming`

  const stats = [
    { label: 'Groups',      value: loading ? '—' : activeGroups },
    { label: 'Upcoming',   value: loading ? '—' : events.length },
    { label: 'This Month', value: loading ? '—' : monthEvents },
    { label: activeTurn ? 'Your Turn' : 'Turn', value: loading ? '—' : turnPosition, highlight: !!activeTurn },
  ]

  // Hero carousel — confirmed upcoming events, greeting fallback.
  // Exclude un-RSVP'd events (they live in the attention band, per design) — no duplicates.
  const rsvpNeededIds = new Set(rsvpNeeded.map(e => e.id))
  const heroEvents = [...events]
    .filter(ev => !rsvpNeededIds.has(ev.id))
    .sort((a, b) => new Date(a.scheduled_date || 0) - new Date(b.scheduled_date || 0))
  const heroSlides = [
    ...heroEvents.map(ev => ({ kind: 'event', event: ev, key: `ev-${ev.id}` })),
  ]
  if (heroSlides.length === 0) {
    heroSlides.push({
      kind: 'greeting',
      title: "Let's plan something",
      subtitle: 'Your upcoming events and invites will headline here.',
      key: 'greet',
    })
  }

  return (
    <AppShell activeRoute="/dashboard" user={user} groupCount={groups.length}>
      <Topbar title={greeting}>
        <Button variant="ghost" size="sm" onClick={() => setShowCreateEvent(true)}>+ Event</Button>
        <Button variant="primary" size="sm" onClick={() => setShowCreateGroup(true)}>+ Group</Button>
      </Topbar>

      {/* Cinematic hero carousel */}
      <HeroCarousel id="tour-hero" slides={heroSlides} userId={user?.id} onRsvp={handleRsvpResponded} />

      {/* Floating stats */}
      <div className="cp-dashboard-stats">
        {stats.map(stat => (
          <div key={stat.label} className={`cp-stat-tile${stat.highlight ? ' turn' : ''}`}>
            <div className="cp-stat-tile-value">{stat.value}</div>
            <div className="cp-stat-tile-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Attention band — action-first: your turn + RSVP needed.
          Only mounted (with its tour anchor) when there's something to act on,
          so the guided tour skips it gracefully when the band is empty. */}
      {!loading && (activeTurn || rsvpNeeded.length > 0) && (
        <div id="tour-turn" className="cp-dashboard-content" style={{ paddingBottom: 0 }}>
          <AttentionBand
            activeTurn={activeTurn}
            primaryGroupId={primaryGroupId}
            onSkip={async () => { await groupsApi.skipRotation(primaryGroupId); await load() }}
            onAlreadyPicked={async () => { await groupsApi.completeTurn(primaryGroupId); await load() }}
            rsvpNeeded={rsvpNeeded}
            userId={user?.id}
            onRsvpResponded={handleRsvpResponded}
          />
        </div>
      )}

      {/* Main content */}
      <div className="cp-dashboard-content">
        <div className="cp-dashboard-grid">

          {/* Left column */}
          <div className="cp-dashboard-main-stack">
            <div id="tour-clubs">
              <MyClubsCard
                groups={groups}
                loading={loading}
                onCreate={() => setShowCreateGroup(true)}
              />
            </div>

            <div id="tour-polls">
              <PendingPollsCard
                polls={pendingPolls}
                myPolls={myPolls}
                groups={groups}
                loading={loading}
                onRespond={handlePollRespond}
              />
            </div>
          </div>

          {/* Right column */}
          <div className="cp-dashboard-side-stack">
            <div id="tour-queue">
              <TurnQueueCard
                groups={groups}
                rotations={allRotations}
                currentUserId={user?.id}
                currentUser={user}
              />
            </div>
            <div id="tour-events">
              <UpcomingEventsCard events={events} loading={loading} onNewEvent={() => setShowCreateEvent(true)} />
            </div>
            <ActivityFeedCard
              items={activityItems}
              loading={activityLoading}
            />
          </div>

        </div>
      </div>

      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={(groupId) => { setShowCreateGroup(false); navigate(`/groups/${groupId}`) }}
      />
      <CreateEventModal
        isOpen={showCreateEvent}
        onClose={() => setShowCreateEvent(false)}
        onCreated={(eventId) => { setShowCreateEvent(false); if (eventId) navigate(`/events/${eventId}`) }}
      />

      {tourActive && (
        <TourOverlay
          step={tourStep}
          total={tourSteps.length}
          onNext={tourNext}
          onPrev={tourPrev}
          onGoTo={tourGoTo}
          onEnd={tourEnd}
        />
      )}

      {import.meta.env.DEV && (
        <button
          onClick={() => { localStorage.removeItem('clubpal_tour_done'); window.location.reload() }}
          style={{
            position: 'fixed', bottom: 12, right: 12, zIndex: 9999,
            fontSize: '10px', padding: '4px 8px', opacity: 0.35,
            background: 'var(--s3)', border: '1px solid var(--glass)',
            borderRadius: '6px', color: 'var(--t3)', cursor: 'pointer',
          }}
        >
          Reset tour
        </button>
      )}
    </AppShell>
  )
}
