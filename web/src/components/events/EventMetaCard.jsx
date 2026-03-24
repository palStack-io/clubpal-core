import { format } from 'date-fns'
import Card from '../ui/Card'

function fmtIcal(d) {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function googleCalUrl(event, date) {
  const end = new Date(date.getTime() + 2 * 60 * 60 * 1000)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || event.venue_name || 'Event',
    dates: `${fmtIcal(date)}/${fmtIcal(end)}`,
    ...(event.location ? { location: event.location } : {}),
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

function outlookCalUrl(event, date) {
  const end = new Date(date.getTime() + 2 * 60 * 60 * 1000)
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title || event.venue_name || 'Event',
    startdt: date.toISOString(),
    enddt: end.toISOString(),
    ...(event.location ? { location: event.location } : {}),
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`
}

function downloadIcs(event, date) {
  const end = new Date(date.getTime() + 2 * 60 * 60 * 1000)
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `DTSTART:${fmtIcal(date)}`,
    `DTEND:${fmtIcal(end)}`,
    `SUMMARY:${(event.title || event.venue_name || 'Event').replace(/,/g, '\\,')}`,
    event.location ? `LOCATION:${event.location.replace(/,/g, '\\,')}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
  const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(event.title || 'event').replace(/\s+/g, '-')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

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

export default function EventMetaCard({ event, groupName, hostName }) {
  if (!event) return null

  const actType = event.activity_type?.toLowerCase() || 'dining'
  const act = ACTIVITY[actType] || ACTIVITY.dining

  // Build visible rows
  const rows = []

  const rawDate = event.scheduled_date || event.event_date
  const parsedDate = rawDate ? (() => { try { return new Date(rawDate) } catch { return null } })() : null

  if (parsedDate) {
    rows.push({
      icon: '📅',
      label: 'Date & Time',
      content: format(parsedDate, "EEEE, MMM d · h:mm a"),
    })

    const calPillStyle = {
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '4px 10px', borderRadius: '100px',
      fontSize: '11px', fontWeight: 600,
      background: 'var(--s3)', border: '1px solid var(--glass)',
      color: 'var(--t2)', cursor: 'pointer', textDecoration: 'none',
    }
    rows.push({
      icon: '🗓️',
      label: 'Add to Calendar',
      content: (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
          <a href={googleCalUrl(event, parsedDate)} target="_blank" rel="noreferrer" style={calPillStyle}>
            Google
          </a>
          <a href={outlookCalUrl(event, parsedDate)} target="_blank" rel="noreferrer" style={calPillStyle}>
            Outlook
          </a>
          <span style={calPillStyle} onClick={() => downloadIcs(event, parsedDate)}>
            Apple / iCal
          </span>
        </div>
      ),
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
    content: event.picker_name || hostName || 'Host',
  })

  rows.push({
    icon: act.emoji,
    label: 'Activity',
    content: `${act.emoji} ${actType.charAt(0).toUpperCase() + actType.slice(1)}`,
  })

  if (groupName) {
    rows.push({
      icon: '👥',
      label: 'Club',
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
