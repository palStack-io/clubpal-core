import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isThisWeek, isThisMonth } from 'date-fns'
import AppShell from '../../components/shell/AppShell'
import PageHero from '../../components/shell/PageHero'
import Button from '../../components/ui/Button'
import CreateEventModal from '../../components/modals/CreateEventModal'
import ActivityPill from '../../components/ui/ActivityPill'
import EventListRow from '../../components/events/EventListRow'
import { eventsApi } from '../../api/events'
import { useAuth } from '../../contexts/AuthContext'

const ACTIVITY_PILLS = [
  { id: 'all',    label: 'All' },
  { id: 'dining', label: '🍽️ Dining' },
  { id: 'movies', label: '🎬 Movies' },
  { id: 'books',  label: '📚 Books' },
  { id: 'gaming', label: '🎮 Gaming' },
  { id: 'arts',   label: '🎨 Arts' },
  { id: 'hiking', label: '🥾 Hiking' },
]

const STATUS_FILTERS = ['Upcoming', 'Completed', 'Cancelled']

function EventGroup({ title, events }) {
  if (events.length === 0) return null
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {title}
        </span>
        <span style={{ padding: '2px 8px', borderRadius: '100px', background: 'var(--s3)', fontSize: '10px', fontWeight: 700, color: 'var(--t3)' }}>
          {events.length}
        </span>
      </div>
      {events.map(ev => <EventListRow key={ev.id} event={ev} />)}
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '12px', padding: '14px 18px', marginBottom: '8px', height: '72px', animation: 'pulse 1.5s ease-in-out infinite' }} />
  )
}

export default function EventsList() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [activityFilter, setActivityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('Upcoming')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    eventsApi.getUserEvents(user.id)
      .then(data => setEvents(Array.isArray(data) ? data : data?.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [user?.id])

  let filtered = events

  if (statusFilter === 'Upcoming') {
    filtered = filtered.filter(e => e.status === 'scheduled' || e.status === 'in_progress' || e.status === 'upcoming')
  } else if (statusFilter === 'Completed') {
    filtered = filtered.filter(e => e.status === 'completed')
  } else if (statusFilter === 'Cancelled') {
    filtered = filtered.filter(e => e.status === 'cancelled')
  }

  if (activityFilter !== 'all') {
    filtered = filtered.filter(e => e.activity_type?.toLowerCase() === activityFilter)
  }

  if (search.trim()) {
    const q = search.toLowerCase()
    filtered = filtered.filter(e =>
      (e.title || '').toLowerCase().includes(q) ||
      (e.venue_name || '').toLowerCase().includes(q) ||
      (e.group_name || '').toLowerCase().includes(q)
    )
  }

  const getDate = e => e.event_date || e.scheduled_date
  const thisWeek  = filtered.filter(e => getDate(e) && isThisWeek(new Date(getDate(e)), { weekStartsOn: 1 }))
  const thisMonth = filtered.filter(e => getDate(e) && !isThisWeek(new Date(getDate(e)), { weekStartsOn: 1 }) && isThisMonth(new Date(getDate(e))))
  const other     = filtered.filter(e => !getDate(e) || (!isThisWeek(new Date(getDate(e)), { weekStartsOn: 1 }) && !isThisMonth(new Date(getDate(e)))))

  const upcoming   = events.filter(e => e.status === 'scheduled' || e.status === 'in_progress').length
  const completed  = events.filter(e => e.status === 'completed').length

  const stats = [
    { label: 'Total',     value: loading ? '—' : events.length },
    { label: 'Upcoming',  value: loading ? '—' : upcoming },
    { label: 'Completed', value: loading ? '—' : completed },
  ]

  return (
    <AppShell activeRoute="/events">
      <PageHero
        label="Events"
        title={loading ? 'Events' : `${events.length} Event${events.length !== 1 ? 's' : ''}`}
        subtitle="Your upcoming and past outings"
        hasStats
      >
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ New</Button>
      </PageHero>

      {/* Floating stats */}
      <div className="cp-floating-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {stats.map(stat => (
          <div key={stat.label} className="cp-stat-tile">
            <div className="cp-stat-tile-value">{stat.value}</div>
            <div className="cp-stat-tile-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Sticky filter bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: '10px 20px',
          background: 'var(--bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--glass)',
        }}
      >
        {/* Search + status row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--glass)',
              borderRadius: '10px',
              padding: '6px 12px',
              fontSize: '12px',
              color: 'var(--t2)',
              outline: 'none',
            }}
            placeholder="🔍 Search events..."
          />
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '100px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: `1px solid ${statusFilter === s ? 'rgba(244,63,94,0.22)' : 'var(--glass)'}`,
                  background: statusFilter === s ? 'rgba(244,63,94,0.15)' : 'var(--s3)',
                  color: statusFilter === s ? 'var(--rose-soft)' : 'var(--t3)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {/* Activity pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '2px' }}>
          {ACTIVITY_PILLS.map(p => (
            <ActivityPill
              key={p.id}
              label={p.label}
              active={activityFilter === p.id}
              onClick={() => setActivityFilter(p.id)}
            />
          ))}
        </div>
      </div>

      {/* Events list */}
      <div style={{ padding: '20px 24px 24px' }}>
        {loading ? (
          [1, 2, 3, 4].map(i => <Skeleton key={i} />)
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 32px', color: 'var(--t3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📅</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t2)', marginBottom: '6px' }}>No events found</div>
            <div style={{ fontSize: '13px' }}>Try a different filter or create a new event</div>
          </div>
        ) : (
          <>
            <EventGroup title="This Week" events={thisWeek} />
            <EventGroup title="This Month" events={thisMonth} />
            <EventGroup title={statusFilter === 'Upcoming' ? 'Later' : statusFilter} events={other} />
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:0.4; } 50% { opacity:0.7; } }
      `}</style>

      <CreateEventModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(eventId) => { setShowCreate(false); if (eventId) navigate(`/events/${eventId}`) }}
      />
    </AppShell>
  )
}
