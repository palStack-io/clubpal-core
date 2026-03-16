import Avatar from '../ui/Avatar'

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
        <Avatar user={{ full_name: review.name, avatar_url: review.avatar_url }} size="sm" />

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
