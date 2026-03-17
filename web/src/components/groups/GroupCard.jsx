import { useNavigate } from 'react-router-dom'
import AvatarStack from '../ui/AvatarStack'
import AnimatedBackground from '../ui/AnimatedBackground'

const activityMeta = {
  dining:  { emoji: '🍽️', label: 'Dining',  gradient: 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(244,63,94,0.04))',  glow: '#f43f5e', color: '#f43f5e' },
  movies:  { emoji: '🎬', label: 'Movies',  gradient: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.04))',  glow: '#6366f1', color: '#6366f1' },
  books:   { emoji: '📚', label: 'Books',   gradient: 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(168,85,247,0.04))',  glow: '#a855f7', color: '#a855f7' },
  hiking:  { emoji: '🥾', label: 'Hiking',  gradient: 'linear-gradient(135deg, rgba(20,184,166,0.1), rgba(20,184,166,0.04))', glow: '#14b8a6', color: '#14b8a6' },
  gaming:  { emoji: '🎮', label: 'Gaming',  gradient: 'linear-gradient(135deg, rgba(34,211,160,0.1), rgba(34,211,160,0.04))', glow: '#22d3a0', color: '#22d3a0' },
  arts:    { emoji: '🎨', label: 'Arts',    gradient: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.04))',  glow: '#f59e0b', color: '#f59e0b' },
}

function getBannerBg(type) {
  const m = activityMeta[type?.toLowerCase()] || activityMeta.dining
  return m.gradient
}

export default function GroupCard({ group, currentUserId }) {
  const navigate = useNavigate()
  const type = group.activity_type?.toLowerCase() || 'dining'
  const meta = activityMeta[type] || activityMeta.dining
  const memberCount = group.member_count || group.members?.length || 0
  const members = group.members || []

  const hasCardBg = group.bg_type && group.bg_type !== 'default'

  const isYourTurn = group.rotation?.current_user_id === currentUserId
  const currentTurnName = isYourTurn
    ? null
    : members.find(m => m.user_id === group.rotation?.current_user_id)?.full_name || 'Someone'

  return (
    <div
      onClick={() => navigate(`/groups/${group.id}`)}
      style={{
        borderRadius: '20px',
        background: 'var(--s2)',
        border: '1px solid var(--glass)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.12s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${meta.color}44`
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--glass)'
        e.currentTarget.style.transform = 'none'
      }}
    >
      {/* Banner */}
      <div
        style={{
          padding: '22px 20px 18px',
          position: 'relative',
          overflow: 'hidden',
          borderBottom: '1px solid var(--glass)',
          background: hasCardBg ? '#0a0a0f' : group.banner_url ? '#000' : getBannerBg(type),
        }}
      >
        {hasCardBg ? (
          <AnimatedBackground bgType={group.bg_type} bgValue={group.bg_value} />
        ) : group.banner_url ? (
          <>
            <img
              src={group.banner_url}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.55,
              }}
            />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 100%)' }} />
          </>
        ) : (
          <div
            style={{
              position: 'absolute',
              top: '-30px',
              right: '-30px',
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${meta.glow} 0%, transparent 70%)`,
              opacity: 0.15,
            }}
          />
        )}

        <div style={{ position: 'relative', zIndex: 1 }}>
          <span style={{ fontSize: '32px', display: 'block', marginBottom: '10px' }}>
            {meta.emoji}
          </span>
          <div style={{
            fontSize: '16px', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '3px',
            color: (hasCardBg || group.banner_url) ? '#fff' : 'var(--t1)',
            textShadow: hasCardBg ? '0 1px 4px rgba(0,0,0,0.5)' : 'none',
          }}>
            {group.name}
          </div>
          <div style={{
            fontSize: '11px', fontWeight: 500, marginBottom: '10px',
            color: (hasCardBg || group.banner_url) ? 'rgba(255,255,255,0.8)' : 'var(--t3)',
            textShadow: hasCardBg ? '0 1px 3px rgba(0,0,0,0.4)' : 'none',
          }}>
            {meta.label} · {memberCount} member{memberCount !== 1 ? 's' : ''}
          </div>

          {/* Turn badge */}
          {group.rotation && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 9px',
                borderRadius: '100px',
                fontSize: '10px',
                fontWeight: 700,
                color: '#fff',
                background: isYourTurn ? 'var(--rose)' : meta.color,
                boxShadow: isYourTurn
                  ? '0 2px 8px rgba(244,63,94,0.35)'
                  : `0 2px 8px ${meta.glow}55`,
              }}
            >
              {isYourTurn ? 'Your Turn!' : `${currentTurnName}'s Turn`}
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', borderBottom: '1px solid var(--glass)' }}>
        {[
          { value: group.event_count ?? group.total_events ?? 0, label: 'Events' },
          { value: group.avg_rating ? Number(group.avg_rating).toFixed(1) : '—', label: 'Avg Rating' },
          { value: memberCount, label: 'Members' },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              padding: '14px 16px',
              textAlign: 'center',
              borderRight: i < 2 ? '1px solid var(--glass)' : 'none',
            }}
          >
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.5px' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '2px' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <AvatarStack users={members.map(m => ({ id: m.user_id, full_name: m.full_name, username: m.username, avatar_url: m.avatar_url }))} maxVisible={3} size="sm" />
        <span
          style={{ fontSize: '11px', fontWeight: 600, color: meta.color, cursor: 'pointer' }}
        >
          Open →
        </span>
      </div>
    </div>
  )
}
