import { useNavigate } from 'react-router-dom'

const ACTIVITY_MAP = {
  dining:       { emoji: '🍽️', label: 'a restaurant',  route: '/discover/restaurants' },
  restaurants:  { emoji: '🍽️', label: 'a restaurant',  route: '/discover/restaurants' },
  movies:       { emoji: '🎬', label: 'a movie',        route: '/discover/movies' },
  movie:        { emoji: '🎬', label: 'a movie',        route: '/discover/movies' },
  books:        { emoji: '📚', label: 'a book',         route: '/discover/books' },
  book:         { emoji: '📚', label: 'a book',         route: '/discover/books' },
  gaming:       { emoji: '🎮', label: 'a game',         route: '/discover/games' },
  game:         { emoji: '🎮', label: 'a game',         route: '/discover/games' },
  hiking:       { emoji: '🥾', label: 'a hike',         route: '/discover/hikes' },
  hike:         { emoji: '🥾', label: 'a hike',         route: '/discover/hikes' },
  arts:         { emoji: '🎨', label: 'an arts outing', route: '/discover/arts' },
  arts_culture: { emoji: '🎨', label: 'an arts outing', route: '/discover/arts' },
}

export default function PickCTACard({ turn, groupId, onSkip }) {
  const navigate = useNavigate()
  if (!turn) return null

  const key = turn.activityType?.toLowerCase()
  const info = ACTIVITY_MAP[key] || { emoji: '🎯', label: 'something fun', route: '/discover/restaurants' }

  return (
    <div
      style={{
        borderRadius: '16px',
        border: '1px solid var(--rose-border)',
        background: 'linear-gradient(135deg, var(--rose-glow) 0%, rgba(251,113,133,0.03) 60%, rgba(99,102,241,0.04) 100%)',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative blob */}
      <div style={{
        position: 'absolute', top: '-50px', right: '-50px',
        width: '160px', height: '160px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(244,63,94,0.14) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Emoji badge */}
      <div style={{
        width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
        background: 'var(--rose-glow)', border: '1px solid var(--rose-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '22px', position: 'relative',
      }}>
        {info.emoji}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--rose-soft)',
          textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '3px',
        }}>
          🔄 Your turn — {turn.groupName}
        </div>
        <div style={{
          fontSize: '15px', fontWeight: 800, color: 'var(--t1)',
          letterSpacing: '-0.4px', lineHeight: 1.2,
        }}>
          Pick {info.label} for the group
        </div>
        {turn.memberCount > 0 && (
          <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '3px' }}>
            {turn.memberCount} member{turn.memberCount !== 1 ? 's' : ''} waiting
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0, position: 'relative' }}>
        <button
          onClick={() => navigate(info.route)}
          style={{
            padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
            background: 'var(--rose)', color: '#fff', border: 'none', cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(244,63,94,0.35)', whiteSpace: 'nowrap',
          }}
        >
          Browse {info.emoji}
        </button>
        <button
          onClick={() => navigate(`/groups/${groupId}`)}
          style={{
            padding: '6px 16px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
            background: 'var(--rose-glow)', color: 'var(--rose-soft)',
            border: '1px solid var(--rose-border)', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          💬 Poll group
        </button>
        {onSkip && (
          <button
            onClick={onSkip}
            style={{
              fontSize: '10px', fontWeight: 600, color: 'var(--t3)',
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
            }}
          >
            Skip turn
          </button>
        )}
      </div>
    </div>
  )
}
