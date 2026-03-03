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

export default function UpcomingEventsCard({ events = [], loading = false }) {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState('all')

  const filtered =
    activeFilter === 'all'
      ? events
      : events.filter(e => {
          const t = e.activity_type?.toLowerCase() || ''
          const aliases = TYPE_ALIASES[activeFilter] || [activeFilter]
          return aliases.includes(t)
        })

  return (
    <Card>
      <Card.Header
        title="Upcoming Events"
        action={
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {PILLS.map(p => (
              <ActivityPill
                key={p.value}
                label={p.label}
                active={activeFilter === p.value}
                onClick={() => setActiveFilter(p.value)}
              />
            ))}
          </div>
        }
      />
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
              onClick={() => navigate('/events/new')}
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
            {filtered.map(event => (
              <EventItem
                key={event.id}
                event={event}
                onClick={() => navigate(`/events/${event.id}`)}
              />
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
