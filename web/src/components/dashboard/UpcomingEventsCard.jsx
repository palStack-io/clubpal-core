import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../ui/Card'
import ActivityPill from '../ui/ActivityPill'
import EventItem from './EventItem'

const PILLS = [
  { label: 'All',       value: 'all' },
  { label: '🍽️ Dining', value: 'dining' },
  { label: '🎬 Movies', value: 'movies' },
  { label: '📚 Books',  value: 'books' },
  { label: '🎮 Games',  value: 'gaming' },
  { label: '🥾 Hiking', value: 'hiking' },
]

const TYPE_ALIASES = {
  dining:  ['dining', 'dining_out'],
  movies:  ['movies', 'movie'],
  books:   ['books', 'book'],
  gaming:  ['gaming', 'game'],
  hiking:  ['hiking', 'hike'],
  arts:    ['arts', 'arts_culture'],
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--s3)' }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: '13px', width: '60%', borderRadius: '6px', background: 'var(--s3)', marginBottom: '6px' }} />
        <div style={{ height: '11px', width: '40%', borderRadius: '6px', background: 'var(--s4)' }} />
      </div>
      <div style={{ width: '50px', height: '20px', borderRadius: '100px', background: 'var(--s3)' }} />
    </div>
  )
}

const VISIBLE_COUNT = 5

export default function UpcomingEventsCard({ events = [], loading = false, onNewEvent }) {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState('all')
  const [expanded, setExpanded] = useState(false)

  const filtered =
    activeFilter === 'all'
      ? events
      : events.filter(e => {
          const t = e.activity_type?.toLowerCase() || ''
          const aliases = TYPE_ALIASES[activeFilter] || [activeFilter]
          return aliases.includes(t)
        })

  const visible = expanded ? filtered : filtered.slice(0, VISIBLE_COUNT)
  const hasMore = filtered.length > VISIBLE_COUNT

  return (
    <Card>
      <div style={{
        padding: '12px 16px 10px',
        borderBottom: '1px solid var(--card-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{
          flex: 1,
          fontSize: 'var(--text-base)',
          fontWeight: 700,
          color: 'var(--t1)',
          letterSpacing: '-0.2px',
        }}>
          Upcoming Events
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => navigate('/events')}
            style={{
              fontSize: '11px', fontWeight: 600, color: 'var(--rose-soft)',
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
            }}
          >
            View all →
          </button>
        </div>
      </div>
      {/* Filter pills — own row below header */}
      <div style={{
        display: 'flex', gap: '4px', padding: '10px 16px 8px',
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {PILLS.map(p => (
          <ActivityPill
            key={p.value}
            label={p.label}
            active={activeFilter === p.value}
            onClick={() => { setActiveFilter(p.value); setExpanded(false) }}
          />
        ))}
      </div>
      <Card.Body>
        {loading ? (
          <div>{[0, 1, 2, 3].map(i => <SkeletonRow key={i} />)}</div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '24px 0',
              color: 'var(--t3)',
              fontSize: '13px',
            }}
          >
            No upcoming events.{' '}
            <button
              onClick={() => onNewEvent ? onNewEvent() : navigate('/events/new')}
              style={{
                color: 'var(--rose)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              + New Event
            </button>
          </div>
        ) : (
          <div>
            {visible.map(event => (
              <EventItem
                key={event.id}
                event={event}
                onClick={() => navigate(`/events/${event.id}`)}
              />
            ))}
            {hasMore && (
              <button
                onClick={() => setExpanded(v => !v)}
                style={{
                  width: '100%', padding: '10px', marginTop: '4px',
                  fontSize: '12px', fontWeight: 700, color: 'var(--t3)',
                  background: 'var(--s3)', border: '1px solid var(--glass)',
                  borderRadius: '10px', cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
              >
                {expanded ? 'Show less' : `Show ${filtered.length - VISIBLE_COUNT} more`}
              </button>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
