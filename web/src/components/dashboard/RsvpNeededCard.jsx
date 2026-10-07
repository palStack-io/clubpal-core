import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../ui/Card'
import { eventsApi } from '../../api/events'

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff < 0) return null
  const days = Math.ceil(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `in ${days}d`
}

function RsvpRow({ event, userId, onResponded }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(null)
  const when = daysUntil(event.scheduled_date)

  const rsvp = async (status) => {
    setLoading(status)
    try {
      await eventsApi.rsvp(event.id, userId, status)
      onResponded(event.id)
    } catch {
      setLoading(null)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 0', borderBottom: '1px solid var(--glass)',
    }}>
      {/* Activity icon */}
      <div style={{
        width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
        background: 'var(--s3)', border: '1px solid var(--glass)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
      }}>
        {ACTIVITY_EMOJI[event.activity_type?.toLowerCase()] || '📅'}
      </div>

      {/* Title + date */}
      <div
        style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
        onClick={() => navigate(`/events/${event.id}`)}
      >
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {event.title}
        </div>
        {when && (
          <div style={{ fontSize: '11px', color: 'var(--amber)', fontWeight: 600, marginTop: '1px' }}>
            {when}
          </div>
        )}
      </div>

      {/* RSVP buttons */}
      <div style={{ display: 'flex', gap: '5px', flexShrink: 0, alignItems: 'center' }}>
        {event.my_rsvp_status === 'maybe' && !loading && (
          <span style={{
            fontSize: '10px', fontWeight: 700, color: 'var(--amber)',
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: '8px', padding: '3px 7px', marginRight: '2px',
          }}>
            Maybe
          </span>
        )}
        <button
          onClick={() => rsvp('going')}
          disabled={!!loading}
          style={{
            padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
            background: loading === 'going' ? 'rgba(34,211,160,0.2)' : 'rgba(34,211,160,0.1)',
            border: '1px solid rgba(34,211,160,0.25)', color: '#22d3a0',
            cursor: loading ? 'default' : 'pointer', opacity: loading && loading !== 'going' ? 0.4 : 1,
          }}
        >
          ✓ Going
        </button>
        <button
          onClick={() => rsvp('not_going')}
          disabled={!!loading}
          style={{
            padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
            background: loading === 'not_going' ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.04)',
            border: '1px solid var(--glass)', color: 'var(--t3)',
            cursor: loading ? 'default' : 'pointer', opacity: loading && loading !== 'not_going' ? 0.4 : 1,
          }}
        >
          ✕ Skip
        </button>
      </div>
    </div>
  )
}

const ACTIVITY_EMOJI = {
  dining: '🍽️', dining_out: '🍽️',
  movies: '🎬', movie: '🎬',
  books: '📚', book: '📚',
  gaming: '🎮', game: '🎮',
  hiking: '🥾', hike: '🥾',
  arts: '🎨', arts_culture: '🎨',
}

export default function RsvpNeededCard({ events = [], userId, onResponded }) {
  return (
    <Card>
      <Card.Header
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            RSVP Needed
            <span style={{
              fontSize: '11px', fontWeight: 700, color: 'var(--amber)',
              background: 'rgba(245,158,11,0.12)', borderRadius: '99px', padding: '2px 8px',
              border: '1px solid rgba(245,158,11,0.2)',
            }}>
              {events.length}
            </span>
          </span>
        }
        action={<span style={{ fontSize: '11px', color: 'var(--t3)' }}>
          {events.some(e => e.my_rsvp_status === 'maybe') ? 'Includes maybe replies' : 'Quick respond'}
        </span>}
      />
      <Card.Body>
        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '28px', marginBottom: '6px' }}>📬</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t3)' }}>All caught up!</div>
            <div style={{ fontSize: '11px', color: 'var(--t4)', marginTop: '2px' }}>Events needing your RSVP will appear here</div>
          </div>
        ) : (
          <div>
            {events.slice(0, 4).map(event => (
              <RsvpRow
                key={event.id}
                event={event}
                userId={userId}
                onResponded={onResponded}
              />
            ))}
            {events.length > 4 && (
              <div style={{ fontSize: '11px', color: 'var(--t3)', textAlign: 'center', paddingTop: '8px' }}>
                +{events.length - 4} more event{events.length - 4 !== 1 ? 's' : ''} need a response
              </div>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
