import { useNavigate } from 'react-router-dom'
import Button from '../ui/Button'
import StatusChip from '../ui/StatusChip'
import AnimatedBackground from '../ui/AnimatedBackground'
import BackButton from '../ui/BackButton'

const ACTIVITY = {
  dining: { emoji: '🍽️', color: '#f43f5e', rgb: '244,63,94' },
  movies: { emoji: '🎬', color: '#6366f1', rgb: '99,102,241' },
  books:  { emoji: '📚', color: '#a855f7', rgb: '168,85,247' },
  hiking: { emoji: '🥾', color: '#14b8a6', rgb: '20,184,166' },
  gaming: { emoji: '🎮', color: '#22d3a0', rgb: '34,211,160' },
  arts:   { emoji: '🎨', color: '#f59e0b', rgb: '245,158,11' },
}

const GRADIENTS = {
  dining: 'linear-gradient(135deg, rgba(244,63,94,0.12) 0%, rgba(244,63,94,0.04) 100%)',
  movies: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(99,102,241,0.04) 100%)',
  books:  'linear-gradient(135deg, rgba(168,85,247,0.12) 0%, rgba(168,85,247,0.04) 100%)',
  hiking: 'linear-gradient(135deg, rgba(20,184,166,0.12) 0%, rgba(20,184,166,0.04) 100%)',
  gaming: 'linear-gradient(135deg, rgba(34,211,160,0.12) 0%, rgba(34,211,160,0.04) 100%)',
  arts:   'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.04) 100%)',
}

function toUTC(str) {
  if (!str) return str
  return /Z$|[+-]\d{2}:?\d{2}$/.test(str) ? str : `${str}Z`
}

function formatDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(toUTC(dateStr))
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' @ ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

export default function EventHero({ event, onRsvp, onEdit, currentUserId }) {
  const navigate = useNavigate()

  if (!event) return null

  const actType = event.activity_type?.toLowerCase() || 'dining'
  const act = ACTIVITY[actType] || ACTIVITY.dining
  const bg =
    GRADIENTS[actType] ||
    'linear-gradient(135deg, rgba(244,63,94,0.12) 0%, rgba(99,102,241,0.06) 100%)'

  const isHost =
    currentUserId != null &&
    event.host_user_id != null &&
    String(currentUserId) === String(event.host_user_id)

  const isScheduled = event.status === 'scheduled' || event.status === 'in_progress'

  let statusVariant = 'pending'
  let statusLabel = 'Scheduled'
  if (event.status === 'completed') { statusVariant = 'going'; statusLabel = 'Completed' }
  else if (event.status === 'cancelled') { statusVariant = 'not-going'; statusLabel = 'Cancelled' }
  else if (event.status === 'in_progress') { statusLabel = 'In Progress' }

  const hasCustomBg = event.bg_type && event.bg_type !== 'default'
  const hasCover = Boolean(event.cover_url) && !hasCustomBg
  const outerBg = hasCustomBg
    ? { background: '#0a0a0f' }
    : hasCover
      ? { backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.68)), url(${event.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : { background: bg }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
    {/* Event accent bar */}
    <div style={{ height: '3px', background: `linear-gradient(90deg, ${act.color}, transparent)`, opacity: 0.65 }} />
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '32px 28px',
        borderBottom: '1px solid var(--glass)',
        ...outerBg,
      }}
    >
      {/* Custom background layer */}
      {hasCustomBg && (
        <AnimatedBackground bgType={event.bg_type} bgValue={event.bg_value} />
      )}

      {/* Glows — only when no cover photo and no custom bg */}
      {!hasCover && !hasCustomBg && (
        <>
          <div
            style={{
              position: 'absolute',
              top: '-60px',
              right: '-60px',
              width: '220px',
              height: '220px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(244,63,94,0.15), transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-40px',
              left: '30%',
              width: '160px',
              height: '160px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99,102,241,0.08), transparent 70%)',
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {/* Inner content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Back */}
        <div style={{ marginBottom: '10px' }}>
          <BackButton onClick={() => navigate('/events')} />
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: '30px',
            fontWeight: 900,
            color: hasCustomBg ? '#fff' : 'var(--t1)',
            letterSpacing: '-1.2px',
            marginBottom: '8px',
            textShadow: hasCustomBg ? '0 2px 6px rgba(0,0,0,0.5)' : 'none',
          }}
        >
          {event.title || event.venue_name || 'Untitled Event'}
        </div>

        {/* Meta row */}
        <div
          style={{
            display: 'flex',
            gap: '20px',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}
        >
          {event.location && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                color: hasCustomBg ? 'rgba(255,255,255,0.75)' : 'var(--t3)',
                fontWeight: 500,
                textShadow: hasCustomBg ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              📍 {event.location}
            </span>
          )}
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '12px',
              color: 'var(--t3)',
              fontWeight: 500,
            }}
          >
            👥 {event.attendee_count || 0} attended
          </span>
          {event.avg_rating && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                color: hasCustomBg ? 'rgba(255,255,255,0.75)' : 'var(--t3)',
                fontWeight: 500,
                textShadow: hasCustomBg ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              ⭐ {Number(event.avg_rating).toFixed(1)}/10 avg
            </span>
          )}
          {event.scheduled_date && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                color: hasCustomBg ? 'rgba(255,255,255,0.75)' : 'var(--t3)',
                fontWeight: 500,
                textShadow: hasCustomBg ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              }}
            >
              🗓 {formatDate(event.scheduled_date)}
            </span>
          )}
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '12px',
              color: 'var(--t3)',
              fontWeight: 500,
            }}
          >
            Picked by Host
          </span>
        </div>

        {/* Description / About */}
        {(event.description || event.notes) && (
          <div
            style={{
              marginTop: '12px',
              marginBottom: '4px',
              fontSize: '13px',
              color: hasCustomBg ? 'rgba(255,255,255,0.72)' : 'var(--t2)',
              lineHeight: '1.6',
              maxWidth: '640px',
            }}
          >
            {(event.description || event.notes || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").trim()}
          </div>
        )}

        {/* Status + action row */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '3px',
            background: `${act.color}dd`, color: '#fff',
            fontSize: '9px', fontWeight: 900,
            padding: '2px 7px', borderRadius: '100px',
            letterSpacing: '0.5px', textTransform: 'uppercase',
          }}>
            Event
          </span>
          <StatusChip status={statusVariant} label={statusLabel} />

          {/* Activity chip */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: `rgba(${act.rgb},0.12)`,
              color: act.color,
              fontSize: '10px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '100px',
              border: `1px solid rgba(${act.rgb},0.22)`,
            }}
          >
            {act.emoji} {actType}
          </span>

          {/* Edit button — host only, scheduled */}
          {event.status === 'scheduled' && isHost && (
            <Button variant="ghost" size="sm" onClick={() => onEdit && onEdit()}>
              Edit Event
            </Button>
          )}

          {/* Rate button — completed */}
          {event.status === 'completed' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onRsvp && onRsvp('rate')}
            >
              Rate This Event
            </Button>
          )}

          {/* RSVP button — scheduled/in_progress and not already going */}
          {isScheduled && event._myStatus !== 'going' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onRsvp && onRsvp('going')}
            >
              ✓ RSVP
            </Button>
          )}
        </div>
      </div>
    </div>
    </div>
  )
}
