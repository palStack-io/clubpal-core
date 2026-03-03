import { format } from 'date-fns'
import StatusChip from '../ui/StatusChip'

// Light-mode-friendly tints — opacity keeps them subtle on white too
const activityBg = {
  dining:       'rgba(244,63,94,0.08)',
  dining_out:   'rgba(244,63,94,0.08)',
  movies:       'rgba(99,102,241,0.08)',
  movie:        'rgba(99,102,241,0.08)',
  books:        'rgba(16,185,129,0.08)',
  book:         'rgba(16,185,129,0.08)',
  gaming:       'rgba(168,85,247,0.08)',
  game:         'rgba(168,85,247,0.08)',
  hiking:       'rgba(20,184,166,0.08)',
  hike:         'rgba(20,184,166,0.08)',
  arts:         'rgba(245,158,11,0.08)',
  arts_culture: 'rgba(245,158,11,0.08)',
}

const activityEmoji = {
  dining:       '🍽️',
  dining_out:   '🍽️',
  movies:       '🎬',
  movie:        '🎬',
  books:        '📚',
  book:         '📚',
  gaming:       '🎮',
  game:         '🎮',
  hiking:       '🥾',
  hike:         '🥾',
  arts:         '🎨',
  arts_culture: '🎨',
}

export default function EventItem({ event, onClick }) {
  const actType = event.activity_type?.toLowerCase() || ''
  const emoji = activityEmoji[actType] || '📅'
  const bg = activityBg[actType] || 'var(--s3)'

  let dateLabel = 'TBD'
  if (event.scheduled_date) {
    try { dateLabel = format(new Date(event.scheduled_date), 'MMM d') } catch {}
  }

  const chipStatus = event.is_user_turn ? 'date-warning' : 'date-chip'
  const chipLabel  = event.is_user_turn ? `Pick by ${dateLabel}` : dateLabel

  return (
    <button type="button" onClick={onClick} className="cp-event-item">
      {event.cover_url ? (
        <img
          src={event.cover_url}
          alt=""
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            flexShrink: 0,
          }}
        >
          {emoji}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--t1)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {event.title}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '2px' }}>
          {event.group_name}
          {event.member_count ? ` · ${event.member_count} members` : ''}
        </div>
      </div>

      <StatusChip status={chipStatus} label={chipLabel} size="sm" />
    </button>
  )
}
