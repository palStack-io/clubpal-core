import { format } from 'date-fns'
import Card from '../ui/Card'

const ACTIVITY = {
  dining: { emoji: '🍽️', color: '#f43f5e' },
  movies: { emoji: '🎬', color: '#6366f1' },
  books:  { emoji: '📚', color: '#a855f7' },
  hiking: { emoji: '🥾', color: '#14b8a6' },
  gaming: { emoji: '🎮', color: '#22d3a0' },
  arts:   { emoji: '🎨', color: '#f59e0b' },
}

function MetaRow({ icon, label, children, last }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '10px',
        padding: '10px 0',
        borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.04)',
        alignItems: 'flex-start',
      }}
    >
      {/* Icon cell */}
      <div
        style={{
          width: '32px',
          height: '32px',
          background: 'var(--s3)',
          borderRadius: '8px',
          textAlign: 'center',
          lineHeight: '32px',
          fontSize: '16px',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      {/* Content cell */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--t4)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '2px',
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default function EventMetaCard({ event, groupName }) {
  if (!event) return null

  const actType = event.activity_type?.toLowerCase() || 'dining'
  const act = ACTIVITY[actType] || ACTIVITY.dining

  // Build visible rows
  const rows = []

  if (event.scheduled_date) {
    rows.push({
      icon: '📅',
      label: 'Date & Time',
      content: (() => {
        try {
          return format(new Date(event.scheduled_date), "EEEE, MMM d · h:mm a")
        } catch {
          return event.scheduled_date
        }
      })(),
    })
  }

  if (event.location) {
    rows.push({
      icon: '📍',
      label: 'Location',
      content: (
        <span>
          {event.location}{' '}
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(event.location)}`}
            target="_blank"
            rel="noreferrer"
            style={{
              color: 'var(--rose-soft)',
              fontSize: '11px',
              textDecoration: 'none',
            }}
          >
            Get directions →
          </a>
        </span>
      ),
    })
  }

  rows.push({
    icon: '🎯',
    label: 'Picked by',
    content: event.picker_name || 'Host',
  })

  rows.push({
    icon: act.emoji,
    label: 'Activity',
    content: `${act.emoji} ${actType.charAt(0).toUpperCase() + actType.slice(1)}`,
  })

  if (groupName) {
    rows.push({
      icon: '👥',
      label: 'Group',
      content: (
        <span style={{ color: 'var(--rose-soft)', cursor: 'pointer' }}>
          {groupName}
        </span>
      ),
    })
  }

  if (event.max_attendees) {
    const goingCount = event.attendees
      ? event.attendees.filter(a => a.status === 'going').length
      : null
    rows.push({
      icon: '🪑',
      label: 'Seats',
      content: goingCount != null
        ? `${goingCount} / ${event.max_attendees} spots filled`
        : `${event.max_attendees} spots max`,
    })
  }

  return (
    <Card>
      <Card.Header title="Details" />
      <Card.Body>
        {rows.map((row, i) => (
          <MetaRow
            key={row.label}
            icon={row.icon}
            label={row.label}
            last={i === rows.length - 1}
          >
            {row.content}
          </MetaRow>
        ))}
      </Card.Body>
    </Card>
  )
}
