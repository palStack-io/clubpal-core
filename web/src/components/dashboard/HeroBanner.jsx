import { format } from 'date-fns'
import Button from '../ui/Button'

export default function HeroBanner({ turn, onBrowse, onSkip }) {
  if (!turn) return null

  let dueLabel = ''
  if (turn.dueDate) {
    try { dueLabel = format(new Date(turn.dueDate), 'MMM d') } catch {}
  }

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '20px',
        padding: '28px 32px',
        border: '1px solid var(--rose-border)',
        marginBottom: '20px',
        overflow: 'hidden',
        background:
          'linear-gradient(135deg, var(--rose-glow) 0%, rgba(251,113,133,0.04) 40%, rgba(99,102,241,0.03) 100%)',
      }}
    >
      {/* Decorative blobs */}
      <div
        style={{
          position: 'absolute',
          top: '-80px',
          right: '-80px',
          width: '280px',
          height: '280px',
          background: 'radial-gradient(circle, rgba(244,63,94,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-60px',
          left: '40%',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        {/* Emoji badge */}
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '18px',
            background: 'var(--rose-glow)',
            border: '1px solid var(--rose-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            flexShrink: 0,
          }}
        >
          {turn.activityEmoji || '🔄'}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: '180px' }}>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--rose-soft)',
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              marginBottom: '6px',
            }}
          >
            🔄 It's your turn
          </div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: 'var(--t1)',
              letterSpacing: '-0.6px',
              marginBottom: '4px',
              lineHeight: 1.2,
            }}
          >
            {turn.groupName}{dueLabel ? ` — Pick by ${dueLabel}` : ''}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--t3)' }}>
            {turn.memberCount ? `${turn.memberCount} members waiting` : ''}
            {turn.activityType ? ` · ${turn.activityType}` : ''}
            {' · Your rotation'}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
          <Button variant="hero" onClick={onBrowse}>
            Browse {turn.activityType || 'options'}
          </Button>
          <Button variant="hero-ghost" onClick={onSkip}>
            Skip Turn
          </Button>
        </div>
      </div>
    </div>
  )
}
