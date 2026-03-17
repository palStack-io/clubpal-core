import AvatarStack from '../ui/AvatarStack'
import AnimatedBackground from '../ui/AnimatedBackground'

const ACTIVITY = {
  dining: { emoji: '🍽️', color: '#f43f5e', rgb: '244,63,94',  gradient: 'linear-gradient(135deg, rgba(244,63,94,0.10), rgba(244,63,94,0.04))' },
  movies: { emoji: '🎬', color: '#6366f1', rgb: '99,102,241', gradient: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(99,102,241,0.04))' },
  books:  { emoji: '📚', color: '#a855f7', rgb: '168,85,247', gradient: 'linear-gradient(135deg, rgba(168,85,247,0.10), rgba(168,85,247,0.04))' },
  hiking: { emoji: '🥾', color: '#14b8a6', rgb: '20,184,166', gradient: 'linear-gradient(135deg, rgba(20,184,166,0.10), rgba(20,184,166,0.04))' },
  gaming: { emoji: '🎮', color: '#22d3a0', rgb: '34,211,160', gradient: 'linear-gradient(135deg, rgba(34,211,160,0.10), rgba(34,211,160,0.04))' },
  arts:   { emoji: '🎨', color: '#f59e0b', rgb: '245,158,11',  gradient: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(245,158,11,0.04))' },
}

export default function GroupHeroCard({ group, members = [], rotation, currentUserId, onBack, actions = [], inviteCode }) {
  if (!group) return null

  const type = (group.activity_type || 'dining').toLowerCase()
  const act = ACTIVITY[type] || ACTIVITY.dining
  const hasCustomBg = group.bg_type && group.bg_type !== 'default'

  const turnerName = rotation?.current_user_id
    ? (members.find(m => m.user_id === rotation.current_user_id)?.full_name || 'Someone')
    : null
  const isMyTurn = rotation?.current_user_id === currentUserId

  const avatarUsers = members.map(m => ({ id: m.user_id, full_name: m.full_name, username: m.username, avatar_url: m.avatar_url }))

  const btnStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    borderRadius: '100px',
    background: hasCustomBg ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.55)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: hasCustomBg ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(0,0,0,0.08)',
    color: hasCustomBg ? '#fff' : 'var(--t1)',
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
      {hasCustomBg && <AnimatedBackground bgType={group.bg_type} bgValue={group.bg_value} />}

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
        {group.banner_url ? (
          <img
            src={group.banner_url}
            alt={group.name}
            onError={e => { e.currentTarget.style.display = 'none' }}
            style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '14px', marginBottom: '16px', display: 'block' }}
          />
        ) : (
          <div style={{ fontSize: '48px', marginBottom: '10px', lineHeight: 1 }}>{act.emoji}</div>
        )}

        <div
          style={{
            fontSize: '22px', fontWeight: 900,
            color: hasCustomBg ? '#fff' : 'var(--t1)',
            letterSpacing: '-0.8px', marginBottom: '4px',
            textShadow: hasCustomBg ? '0 1px 4px rgba(0,0,0,0.5)' : 'none',
          }}
        >
          {group.name}
        </div>

        {group.description && (
          <div
            style={{
              fontSize: '12px', fontWeight: 400,
              color: hasCustomBg ? 'rgba(255,255,255,0.65)' : 'var(--t3)',
              marginBottom: '12px',
              textShadow: hasCustomBg ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
              lineHeight: 1.5,
            }}
          >
            {group.description}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
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
          {rotation?.current_user_id && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: isMyTurn ? act.color : 'rgba(255,255,255,0.08)',
                color: isMyTurn ? '#fff' : (hasCustomBg ? 'rgba(255,255,255,0.75)' : 'var(--t2)'),
                fontSize: '10px', fontWeight: 700,
                padding: '3px 8px', borderRadius: '100px',
                border: isMyTurn ? 'none' : '1px solid var(--glass)',
                boxShadow: isMyTurn ? `0 2px 8px rgba(${act.rgb},0.4)` : 'none',
              }}
            >
              🔄 {isMyTurn ? 'Your Turn!' : `${turnerName}'s Turn`}
            </span>
          )}
        </div>

        <AvatarStack users={avatarUsers} maxVisible={6} size="sm" />
      </div>
    </div>
  )
}
