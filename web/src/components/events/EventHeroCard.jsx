import AvatarStack from '../ui/AvatarStack'
import AnimatedBackground from '../ui/AnimatedBackground'
import StatusChip from '../ui/StatusChip'

const ACTIVITY = {
  dining: { emoji: '🍽️', color: '#f43f5e', rgb: '244,63,94',  gradient: 'linear-gradient(135deg, rgba(244,63,94,0.10), rgba(244,63,94,0.04))' },
  movies: { emoji: '🎬', color: '#6366f1', rgb: '99,102,241', gradient: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(99,102,241,0.04))' },
  books:  { emoji: '📚', color: '#a855f7', rgb: '168,85,247', gradient: 'linear-gradient(135deg, rgba(168,85,247,0.10), rgba(168,85,247,0.04))' },
  hiking: { emoji: '🥾', color: '#14b8a6', rgb: '20,184,166', gradient: 'linear-gradient(135deg, rgba(20,184,166,0.10), rgba(20,184,166,0.04))' },
  gaming: { emoji: '🎮', color: '#22d3a0', rgb: '34,211,160', gradient: 'linear-gradient(135deg, rgba(34,211,160,0.10), rgba(34,211,160,0.04))' },
  arts:   { emoji: '🎨', color: '#f59e0b', rgb: '245,158,11',  gradient: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(245,158,11,0.04))' },
}

function formatDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' @ ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

export default function EventHeroCard({ event, attendees = [], onBack, actions = [] }) {
  if (!event) return null

  const type = (event.activity_type || 'dining').toLowerCase()
  const act = ACTIVITY[type] || ACTIVITY.dining
  const hasCustomBg = event.bg_type && event.bg_type !== 'default'
  const hasCover = Boolean(event.cover_url) && !hasCustomBg
  const textOnDark = hasCustomBg || hasCover

  let statusVariant = 'pending'
  let statusLabel = 'Scheduled'
  if (event.status === 'completed')    { statusVariant = 'going';      statusLabel = 'Completed' }
  else if (event.status === 'cancelled')   { statusVariant = 'not-going'; statusLabel = 'Cancelled' }
  else if (event.status === 'in_progress') { statusLabel = 'In Progress' }

  const avatarUsers = attendees.map(a => ({
    id: a.user_id,
    full_name: a.full_name,
    avatar_url: a.avatar_url,
  }))

  const btnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    borderRadius: '100px',
    background: (hasCustomBg || hasCover) ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.55)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: (hasCustomBg || hasCover) ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(0,0,0,0.08)',
    color: (hasCustomBg || hasCover) ? '#fff' : 'var(--t1)',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }

  return (
    <div
      style={{
        background: hasCustomBg ? '#0a0a0f' : act.gradient,
        position: 'relative',
        overflow: 'hidden',
        borderBottom: hasCustomBg ? '1px solid rgba(255,255,255,0.08)' : '1px solid var(--glass)',
      }}
    >
      {hasCustomBg && <AnimatedBackground bgType={event.bg_type} bgValue={event.bg_value} />}

      {!hasCustomBg && (
        <div
          style={{
            position: 'absolute',
            top: '-30px', right: '-30px',
            width: '160px', height: '160px',
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(${act.rgb},0.5), transparent 70%)`,
            opacity: 0.14,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Top controls row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px 0',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {onBack ? (
          <button onClick={onBack} style={btnStyle}>← Back</button>
        ) : <div />}
        <div style={{ display: 'flex', gap: '6px' }}>
          {actions.map((a, i) => (
            <button key={i} onClick={a.onClick} style={btnStyle} disabled={a.loading}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 24px 40px', position: 'relative', zIndex: 1 }}>
        {hasCover && (
          <img
            src={event.cover_url}
            alt={event.title}
            onError={e => { e.currentTarget.style.display = 'none' }}
            style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '14px', marginBottom: '16px', display: 'block' }}
          />
        )}

        <div style={{ fontSize: '48px', display: hasCover ? 'none' : 'block', marginBottom: '10px', lineHeight: 1 }}>
          {act.emoji}
        </div>

        <div
          style={{
            fontSize: '22px', fontWeight: 900,
            color: textOnDark ? '#fff' : 'var(--t1)',
            letterSpacing: '-0.8px', marginBottom: '4px',
            textShadow: textOnDark ? '0 1px 4px rgba(0,0,0,0.5)' : 'none',
          }}
        >
          {event.title || event.venue_name || 'Untitled Event'}
        </div>

        <div
          style={{
            fontSize: '12px', fontWeight: 500,
            color: textOnDark ? 'rgba(255,255,255,0.75)' : 'var(--t3)',
            marginBottom: '12px',
            textShadow: textOnDark ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
          }}
        >
          {type}
          {event.location ? ` · 📍 ${event.location}` : ''}
          {event.scheduled_date ? ` · 🗓 ${formatDate(event.scheduled_date)}` : ''}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <StatusChip status={statusVariant} label={statusLabel} />
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: `rgba(${act.rgb},0.12)`, color: act.color,
              fontSize: '10px', fontWeight: 700,
              padding: '3px 8px', borderRadius: '100px',
              border: `1px solid rgba(${act.rgb},0.22)`,
            }}
          >
            {act.emoji} {type}
          </span>
          {event.group_name && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: 'rgba(255,255,255,0.06)',
                color: textOnDark ? 'rgba(255,255,255,0.7)' : 'var(--t3)',
                fontSize: '10px', fontWeight: 600,
                padding: '3px 8px', borderRadius: '100px',
                border: '1px solid var(--glass)',
              }}
            >
              👥 {event.group_name}
            </span>
          )}
        </div>

        <AvatarStack users={avatarUsers} maxVisible={6} size="sm" />
      </div>
    </div>
  )
}
