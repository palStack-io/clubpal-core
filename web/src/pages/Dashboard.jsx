import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { groupsApi } from '../api/groups'
import { eventsApi } from '../api/events'

import AppShell from '../components/shell/AppShell'
import PageHero from '../components/shell/PageHero'
import Button from '../components/ui/Button'
import PickCTACard from '../components/dashboard/PickCTACard'
import PendingPollsCard from '../components/dashboard/PendingPollsCard'
import UpcomingEventsCard from '../components/dashboard/UpcomingEventsCard'
import TurnQueueCard from '../components/dashboard/TurnQueueCard'
import ActivityFeedCard from '../components/dashboard/ActivityFeedCard'
import RsvpNeededCard from '../components/dashboard/RsvpNeededCard'
import CreateGroupModal from '../components/modals/CreateGroupModal'
import CreateEventModal from '../components/modals/CreateEventModal'

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

  const [groups, setGroups] = useState([])
  const [events, setEvents] = useState([])
  const [rotation, setRotation] = useState(null)
  const [primaryGroupId, setPrimaryGroupId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pendingPolls, setPendingPolls] = useState([])
  const [myPolls, setMyPolls] = useState([])
  const [rsvpNeeded, setRsvpNeeded] = useState([])
  const [activityItems, setActivityItems] = useState([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showCreateEvent, setShowCreateEvent] = useState(false)

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

      const upcoming = e.filter(ev => ev.status === 'scheduled' || ev.status === 'in_progress')
      setEvents(upcoming)

      // Events where user hasn't responded yet
      setRsvpNeeded(upcoming.filter(ev =>
        !ev.my_rsvp_status || ev.my_rsvp_status === 'pending'
      ))

      // Check ALL groups for whose turn it is — use the first group where it's your turn
      if (g.length > 0) {
        const rotations = await Promise.all(
          g.map(grp => groupsApi.getRotation(grp.id).catch(() => null))
        )
        const myTurnIdx = rotations.findIndex(r => r?.current_user_id === user?.id)
        const activeIdx = myTurnIdx >= 0 ? myTurnIdx : 0
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
      console.error('Dashboard load error', err)
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

  const activeTurn =
    rotation?.current_user_id === user?.id && primaryGroupId
      ? {
          groupId: primaryGroupId,
          groupName: groups.find(g => g.id === primaryGroupId)?.name || 'Your Group',
          activityEmoji: rotation?.activity_emoji || '🔄',
          activityType: rotation?.activity_type || 'dining',
          dueDate: rotation?.due_date || null,
          memberCount: rotation?.members?.length || 0,
        }
      : null

  const monthEvents = eventsThisMonth(events)
  const activeGroups = groups.length

  let turnPosition = '—'
  if (rotation?.members?.length) {
    const idx = rotation.members.findIndex(m => (m.user_id || m.id) === user?.id)
    if (idx >= 0) {
      const pos = (idx - (rotation.current_turn_index ?? 0) + rotation.members.length) % rotation.members.length
      turnPosition = pos === 0 ? '1st 🔄' : ordinal(pos + 1)
    }
  }

  const primaryGroup = groups.find(g => g.id === primaryGroupId)
  const greeting = `${getGreeting()}, ${user?.full_name?.split(' ')[0] || user?.username} 👋`

  const stats = [
    { label: 'Groups',     value: loading ? '—' : activeGroups },
    { label: 'Upcoming',   value: loading ? '—' : events.length },
    { label: 'This Month', value: loading ? '—' : monthEvents },
    { label: 'Turn',       value: loading ? '—' : turnPosition },
  ]

  return (
    <AppShell activeRoute="/dashboard" user={user} groupCount={groups.length}>
      <PageHero
        label="clubPal"
        title={greeting}
        subtitle={`${activeGroups} group${activeGroups !== 1 ? 's' : ''} · ${events.length} upcoming`}
        hasStats
      >
        <Button variant="ghost" size="sm" onClick={() => setShowCreateEvent(true)}>+ Event</Button>
        <Button variant="primary" size="sm" onClick={() => setShowCreateGroup(true)}>+ Group</Button>
      </PageHero>

      {/* Floating stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
          padding: '0 20px',
          transform: 'translateY(-28px)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {stats.map(stat => (
          <div
            key={stat.label}
            style={{
              background: 'var(--s2)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '14px',
              padding: '14px 10px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--t1)', letterSpacing: '-0.8px', lineHeight: 1 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '5px' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ padding: '0 24px 24px', marginTop: '-8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: '14px' }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* 1. Pick CTA — only when it's your turn */}
            {!loading && activeTurn && (
              <PickCTACard
                turn={activeTurn}
                groupId={primaryGroupId}
                onSkip={() => groupsApi.skipRotation(primaryGroupId).then(load)}
              />
            )}

            {/* 2. RSVP needed */}
            <RsvpNeededCard
              events={rsvpNeeded}
              userId={user?.id}
              onResponded={handleRsvpResponded}
            />

            {/* 3. Pending polls + my active polls */}
            <PendingPollsCard
              polls={pendingPolls}
              myPolls={myPolls}
              groups={groups}
              loading={loading}
              onRespond={handlePollRespond}
            />

            {/* 4. Upcoming events */}
            <UpcomingEventsCard events={events} loading={loading} />
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <TurnQueueCard
              groupId={primaryGroupId}
              groupName={primaryGroup?.name}
              currentUserId={user?.id}
            />
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
    </AppShell>
  )
}
