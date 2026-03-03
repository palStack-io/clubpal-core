const activityChipColor = {
  restaurants: { bg: 'rgba(244,63,94,0.12)', color: '#f43f5e', label: '🍽️ Dining' },
  movies:      { bg: 'rgba(99,102,241,0.12)', color: '#6366f1', label: '🎬 Movies' },
  books:       { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', label: '📚 Books' },
  hikes:       { bg: 'rgba(20,184,166,0.12)', color: '#14b8a6', label: '🥾 Hiking' },
  games:       { bg: 'rgba(34,211,160,0.12)', color: '#22d3a0', label: '🎮 Gaming' },
  arts:        { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: '🎨 Arts' },
}

export default function ResultCard({ result, activityType, onClick }) {
  const chip = activityChipColor[activityType] || activityChipColor.restaurants

  return (
    <div
      onClick={() => onClick && onClick(result)}
      style={{
        background: 'var(--s2)',
        border: '1px solid var(--glass)',
        borderRadius: '16px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.12s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${chip.color}44`
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--glass)'
        e.currentTarget.style.transform = 'none'
      }}
    >
      {/* Photo */}
      <div
        style={{
          height: '160px',
          background: result.photo_url ? `url(${result.photo_url}) center/cover no-repeat` : 'var(--s3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '40px',
          color: 'var(--t4)',
        }}
      >
        {!result.photo_url && (chip.label.split(' ')[0])}
      </div>

      {/* Body */}
      <div style={{ padding: '14px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t1)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {result.name || result.title}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '8px' }}>
          {result.rating && `★ ${result.rating} · `}
          {result.price_level && `${'$'.repeat(result.price_level)} · `}
          {result.distance && `${result.distance}`}
          {result.author && `by ${result.author}`}
          {result.year && ` (${result.year})`}
        </div>
        <span
          style={{
            display: 'inline-block',
            padding: '3px 8px',
            borderRadius: '100px',
            fontSize: '10px',
            fontWeight: 700,
            background: chip.bg,
            color: chip.color,
          }}
        >
          {chip.label}
        </span>
      </div>
    </div>
  )
}
