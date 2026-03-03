export default function ActivityPill({ label, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '100px',
        fontSize: '11px',
        fontWeight: 600,
        cursor: onClick ? 'pointer' : 'default',
        border: active ? '1px solid var(--rose-border)' : '1px solid transparent',
        background: active ? 'var(--rose-glow)' : 'var(--s3)',
        color: active ? 'var(--rose-soft)' : 'var(--t3)',
        transition: 'all 0.12s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.background = 'var(--s4)'
          e.currentTarget.style.color = 'var(--t2)'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.background = 'var(--s3)'
          e.currentTarget.style.color = 'var(--t3)'
        }
      }}
    >
      {label}
    </button>
  )
}
