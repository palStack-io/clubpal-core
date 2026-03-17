import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import StatusChip from '../ui/StatusChip'
import AnimatedBackground from '../ui/AnimatedBackground'

const activityMeta = {
  dining:  { emoji: '🍽️', bg: 'rgba(244,63,94,0.1)' },
  movies:  { emoji: '🎬', bg: 'rgba(99,102,241,0.1)' },
  books:   { emoji: '📚', bg: 'rgba(34,211,160,0.1)' },
  gaming:  { emoji: '🎮', bg: 'rgba(168,85,247,0.1)' },
  hiking:  { emoji: '🥾', bg: 'rgba(20,184,166,0.1)' },
  arts:    { emoji: '🎨', bg: 'rgba(245,158,11,0.1)' },
}

const statusMap = {
  upcoming: 'pending',
  scheduled: 'pending',
  in_progress: 'turn-now',
  completed: 'going',
  cancelled: 'not-going',
}

export default function EventListRow({ event }) {
  const navigate = useNavigate()
  const type = event.activity_type?.toLowerCase() || 'dining'
  const meta = activityMeta[type] || activityMeta.dining
  const rawDate = event.event_date || event.scheduled_date
  const dateStr = rawDate
    ? format(new Date(rawDate), 'MMM d · h:mm a')
    : 'TBD'

  return (
    <div
      onClick={() => navigate(`/events/${event.id}`)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        background: 'var(--s2)',
        border: '1px solid var(--glass)',
        borderRadius: '12px',
        padding: '14px 18px',
        marginBottom: '8px',
        cursor: 'pointer',
        transition: 'border-color 0.12s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--glass-hover)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--glass)'}
    >
      {/* Thumbnail */}
      {event.bg_scope === 'cards_hero' && event.bg_type && event.bg_type !== 'default' ? (
        <div style={{ width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
          <AnimatedBackground bgType={event.bg_type} bgValue={event.bg_value} />
          <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', fontSize: '20px' }}>
            {meta.emoji}
          </span>
        </div>
      ) : event.cover_url ? (
        <img
          src={event.cover_url}
          alt=""
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: meta.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            flexShrink: 0,
          }}
        >
          {meta.emoji}
        </div>
      )}

      {/* Meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {event.title || event.venue_name || 'Event'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--t3)', marginTop: '2px' }}>
          {event.group_name || 'Group'} · {dateStr}
        </div>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <StatusChip variant={statusMap[event.status] || 'pending'}>
          {event.status || 'upcoming'}
        </StatusChip>
        <span style={{ fontSize: '12px', color: 'var(--rose-soft)', fontWeight: 600 }}>
          View →
        </span>
      </div>
    </div>
  )
}
