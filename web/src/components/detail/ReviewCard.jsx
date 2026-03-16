const AVATAR_PALETTES = [
  { bg: 'rgba(244,63,94,0.18)',   color: '#fb7185' },
  { bg: 'rgba(99,102,241,0.18)',  color: '#818cf8' },
  { bg: 'rgba(20,184,166,0.18)',  color: '#2dd4bf' },
]

function initials(name = '') {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'
}

function StarRating({ rating }) {
  return (
    <span style={{ display: 'flex', gap: '1px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          style={{
            fontSize: '12px',
            color: i <= Math.round(rating) ? '#f5c842' : 'var(--t4)',
          }}
        >
          ★
        </span>
      ))}
    </span>
  )
}

export default function ReviewCard({ review, index = 0 }) {
  const palette = AVATAR_PALETTES[index % AVATAR_PALETTES.length]

  return (
    <div
      style={{
        background: 'var(--s2)',
        border: '1px solid var(--glass)',
        borderRadius: '14px',
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: review.text ? '9px' : 0,
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: palette.bg,
            color: palette.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {initials(review.name)}
        </div>

        {/* Name + date */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: 'var(--t1)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {review.name}
          </div>
          {review.date && (
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '1px' }}>
              {review.date}
            </div>
          )}
        </div>

        <StarRating rating={review.rating} />
      </div>

      {review.text && (
        <p
          style={{
            fontSize: '13px',
            color: 'var(--t2)',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {review.text}
        </p>
      )}
    </div>
  )
}
