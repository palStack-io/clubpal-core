import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { isThisWeek, isThisMonth, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isSameMonth, format, addMonths, subMonths } from 'date-fns'
import AppShell from '../../components/shell/AppShell'
import PageHero from '../../components/shell/PageHero'
import Button from '../../components/ui/Button'
import CreateEventModal from '../../components/modals/CreateEventModal'
import ActivityPill from '../../components/ui/ActivityPill'
import EventListRow from '../../components/events/EventListRow'
import { eventsApi } from '../../api/events'
import { ratingsApi } from '../../api/ratings'
import { useAuth } from '../../contexts/AuthContext'
import { resolveActivity } from '../../constants/activities'

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

function EventGroup({ title, events, ratingsMap = {} }) {
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
      {events.map(ev => <EventListRow key={ev.id} event={ev} avgRating={ratingsMap[ev.id] ?? null} />)}
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '12px', padding: '14px 18px', marginBottom: '8px', height: '72px', animation: 'pulse 1.5s ease-in-out infinite' }} />
  )
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function CalendarView({ events, onEventClick }) {
  const today = useMemo(() => new Date(), [])
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDay, setSelectedDay] = useState(null)

  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
    const end   = endOfWeek(endOfMonth(month),     { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [month])

  const getDate = e => e.event_date || e.scheduled_date

  const eventsByDay = useMemo(() => {
    const map = {}
    events.forEach(ev => {
      const raw = getDate(ev)
      if (!raw) return
      const key = format(new Date(raw), 'yyyy-MM-dd')
      if (!map[key]) map[key] = []
      map[key].push(ev)
    })
    return map
  }, [events])

  const selectedEvents = selectedDay
    ? (eventsByDay[format(selectedDay, 'yyyy-MM-dd')] || [])
    : []

  return (
    <div style={{ padding: '20px 24px 40px' }}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button
          onClick={() => setMonth(m => subMonths(m, 1))}
          style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '8px', color: 'var(--t2)', fontSize: '14px', padding: '6px 12px', cursor: 'pointer' }}
        >
          ‹
        </button>
        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t1)' }}>
          {format(month, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setMonth(m => addMonths(m, 1))}
          style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '8px', color: 'var(--t2)', fontSize: '14px', padding: '6px 12px', cursor: 'pointer' }}
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
        {DOW.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {gridDays.map(day => {
          const key      = format(day, 'yyyy-MM-dd')
          const dayEvs   = eventsByDay[key] || []
          const isToday  = isSameDay(day, today)
          const isCurMon = isSameMonth(day, month)
          const isSel    = selectedDay && isSameDay(day, selectedDay)
          const dots     = dayEvs.slice(0, 3)

          return (
            <div
              key={key}
              onClick={() => setSelectedDay(isSel ? null : day)}
              style={{
                minHeight: '68px',
                borderRadius: '10px',
                border: `1px solid ${isSel ? 'var(--rose)' : isToday ? 'rgba(244,63,94,0.3)' : 'var(--glass)'}`,
                background: isSel ? 'rgba(244,63,94,0.08)' : isToday ? 'rgba(244,63,94,0.04)' : 'var(--s1)',
                padding: '6px 6px 5px',
                cursor: dayEvs.length > 0 || true ? 'pointer' : 'default',
                opacity: isCurMon ? 1 : 0.35,
                transition: 'border-color 0.12s, background 0.12s',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px',
              }}
            >
              <span style={{
                fontSize: '11px', fontWeight: isToday ? 800 : 600,
                color: isToday ? 'var(--rose)' : isCurMon ? 'var(--t2)' : 'var(--t4)',
                lineHeight: 1,
              }}>
                {format(day, 'd')}
              </span>

              {/* Event dots / labels */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                {dots.map(ev => {
                  const color = resolveActivity(ev.activity_type).color
                  return (
                    <div
                      key={ev.id}
                      onClick={e => { e.stopPropagation(); onEventClick(ev.id) }}
                      title={ev.title || ev.venue_name}
                      style={{
                        fontSize: '9px', fontWeight: 700,
                        color: '#fff', /* intentional: text on activity-colored bg */
                        background: color,
                        borderRadius: '4px',
                        padding: '1px 4px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        cursor: 'pointer',
                      }}
                    >
                      {ev.title || ev.venue_name || 'Event'}
                    </div>
                  )
                })}
                {dayEvs.length > 3 && (
                  <div style={{ fontSize: '9px', color: 'var(--t3)', fontWeight: 600 }}>
                    +{dayEvs.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected day panel */}
      {selectedDay && (
        <div style={{ marginTop: '20px', borderTop: '1px solid var(--glass)', paddingTop: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t2)', marginBottom: '10px' }}>
            {format(selectedDay, 'EEEE, MMMM d')}
            {selectedEvents.length === 0 && (
              <span style={{ fontWeight: 400, color: 'var(--t4)', marginLeft: '8px' }}>— no events</span>
            )}
          </div>
          {selectedEvents.map(ev => <EventListRow key={ev.id} event={ev} />)}
        </div>
      )}
    </div>
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
  const [viewMode, setViewMode] = useState('list')
  const [ratingsMap, setRatingsMap] = useState({})

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    eventsApi.getUserEvents(user.id)
      .then(data => setEvents(Array.isArray(data) ? data : data?.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [user?.id])

  useEffect(() => {
    if (statusFilter !== 'Completed' || events.length === 0) return
    const completedIds = events
      .filter(e => {
        const s = e.status
        if (s === 'completed') return true
        if (s === 'scheduled' || s === 'in_progress') {
          const d = e.scheduled_date || e.event_date
          return d && new Date(d) < new Date()
        }
        return false
      })
      .map(e => e.id)
    if (completedIds.length === 0) return
    Promise.allSettled(
      completedIds.map(id => ratingsApi.getEventStats(id).then(s => ({ id, avg: s?.average_score ?? null, count: s?.total_ratings ?? 0 })))
    ).then(results => {
      const map = {}
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value.count > 0) map[r.value.id] = r.value.avg
      })
      setRatingsMap(map)
    })
  }, [statusFilter, events])

  const now = new Date()
  const effectiveStatus = (e) => {
    if (e.status === 'scheduled' || e.status === 'in_progress') {
      const d = e.scheduled_date || e.event_date
      if (d && new Date(d) < now) return 'completed'
    }
    return e.status
  }

  let filtered = events

  if (statusFilter === 'Upcoming') {
    filtered = filtered.filter(e => effectiveStatus(e) === 'scheduled' || effectiveStatus(e) === 'in_progress')
  } else if (statusFilter === 'Completed') {
    filtered = filtered.filter(e => effectiveStatus(e) === 'completed')
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

  // Completed: single newest-first list. Others: week/month/later buckets.
  const sortedCompleted = statusFilter === 'Completed'
    ? [...filtered].sort((a, b) => new Date(getDate(b) || 0) - new Date(getDate(a) || 0))
    : []
  const thisWeek  = statusFilter !== 'Completed' ? filtered.filter(e => getDate(e) && isThisWeek(new Date(getDate(e)), { weekStartsOn: 1 })) : []
  const thisMonth = statusFilter !== 'Completed' ? filtered.filter(e => getDate(e) && !isThisWeek(new Date(getDate(e)), { weekStartsOn: 1 }) && isThisMonth(new Date(getDate(e)))) : []
  const other     = statusFilter !== 'Completed' ? filtered.filter(e => !getDate(e) || (!isThisWeek(new Date(getDate(e)), { weekStartsOn: 1 }) && !isThisMonth(new Date(getDate(e))))) : []

  const upcoming   = events.filter(e => effectiveStatus(e) === 'scheduled' || effectiveStatus(e) === 'in_progress').length
  const completed  = events.filter(e => effectiveStatus(e) === 'completed').length

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
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ Event</Button>
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
        {/* Search + status + view toggle row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1,
              background: 'var(--glass)',
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
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
            {[
              { mode: 'list',     icon: '☰' },
              { mode: 'calendar', icon: '▦' },
            ].map(({ mode, icon }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={mode === 'list' ? 'List view' : 'Calendar view'}
                style={{
                  padding: '5px 10px',
                  fontSize: '13px',
                  background: viewMode === mode ? 'rgba(244,63,94,0.15)' : 'transparent',
                  color: viewMode === mode ? 'var(--rose-soft)' : 'var(--t3)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.12s, color 0.12s',
                }}
              >
                {icon}
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

      {/* Events list / calendar */}
      {viewMode === 'calendar' ? (
        loading ? (
          <div style={{ padding: '20px 24px 24px' }}>
            {[1,2,3].map(i => <Skeleton key={i} />)}
          </div>
        ) : (
          <CalendarView events={filtered} onEventClick={id => navigate(`/events/${id}`)} />
        )
      ) : (
        <div style={{ padding: '20px 24px 24px' }}>
          {loading ? (
            [1, 2, 3, 4].map(i => <Skeleton key={i} />)
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 32px', color: 'var(--t3)' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📅</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t2)', marginBottom: '6px' }}>No events found</div>
              <div style={{ fontSize: '13px' }}>Try a different filter or create a new event</div>
            </div>
          ) : statusFilter === 'Completed' ? (
            <EventGroup title="Past Events" events={sortedCompleted} ratingsMap={ratingsMap} />
          ) : (
            <>
              <EventGroup title="This Week" events={thisWeek} />
              <EventGroup title="This Month" events={thisMonth} />
              <EventGroup title={statusFilter === 'Upcoming' ? 'Later' : statusFilter} events={other} />
            </>
          )}
        </div>
      )}

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
