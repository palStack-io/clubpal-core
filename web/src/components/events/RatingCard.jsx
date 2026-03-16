import Card from '../ui/Card'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'

function StarRow({ avg }) {
  const filled = Math.round(Number(avg))
  return (
    <span style={{ color: 'var(--rose)', fontSize: '13px', letterSpacing: '-1px' }}>
      {'★'.repeat(Math.min(10, filled))}
      {'☆'.repeat(Math.max(0, 10 - filled))}
    </span>
  )
}

function RatingBar({ label, count, max }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '5px',
      }}
    >
      <span
        style={{
          fontSize: '10px',
          fontWeight: 600,
          color: 'var(--t4)',
          width: '16px',
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: '6px',
          background: 'var(--s4)',
          borderRadius: '3px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: 'linear-gradient(90deg, var(--rose-soft), var(--rose))',
            borderRadius: '3px',
            transition: 'width 0.3s',
          }}
        />
      </div>
      <span
        style={{
          fontSize: '10px',
          color: 'var(--t4)',
          width: '12px',
          flexShrink: 0,
        }}
      >
        {count}
      </span>
    </div>
  )
}

function ReviewItem({ rating }) {
  const reviewerName = rating.reviewer_name || rating.rater_name || 'Anonymous'
  const reviewText = rating.comment || rating.review_text
  const score = rating.score || rating.rating || 0

  return (
    <div
      style={{
        background: 'var(--s3)',
        borderRadius: '14px',
        padding: '14px',
        border: '1px solid var(--glass)',
        marginBottom: '10px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <Avatar
          user={{
            full_name: rating.reviewer_name || rating.rater_name,
            username: rating.username,
            avatar_url: rating.reviewer_avatar || rating.rater_avatar,
          }}
          size="sm"
        />
        <span style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: 'var(--t1)' }}>
          {reviewerName}
        </span>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b' }}>
          ⭐ {score}/10
        </span>
      </div>

      {/* Review text */}
      {reviewText && (
        <p
          style={{
            fontSize: '12px',
            color: 'var(--t2)',
            lineHeight: 1.6,
            marginBottom: '8px',
          }}
        >
          {reviewText}
        </p>
      )}

      {/* Tags */}
      {rating.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {rating.tags.map((tag) => (
            <span
              key={tag}
              style={{
                background: 'rgba(244,63,94,0.15)',
                color: 'var(--rose-soft)',
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '100px',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RatingCard({
  ratings = [],
  eventStatus,
  scheduledDate,
  currentUserId,
  eventId,
  onAddRating,
}) {
  const isPast = scheduledDate && new Date(scheduledDate) < new Date()
  const isCompleted = eventStatus === 'completed' || (eventStatus !== 'cancelled' && isPast)
  const myRating = ratings.find(
    (r) => String(r.reviewer_id || r.rater_id || r.user_id) === String(currentUserId)
  )

  const sorted = [...ratings].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )

  const avg =
    ratings.length > 0
      ? (
          ratings.reduce((s, r) => s + (r.score || r.rating || 0), 0) / ratings.length
        ).toFixed(1)
      : null

  const dist = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((score) => ({
    label: score,
    count: ratings.filter((r) => Math.round(r.score || r.rating || 0) === score).length,
  }))
  const maxDist = Math.max(...dist.map((d) => d.count), 1)

  const rateLabel = myRating ? '✏️ Edit Rating' : '⭐ Rate Event'

  return (
    <Card>
      <Card.Header
        title={`Ratings${ratings.length > 0 ? ` (${ratings.length})` : ''}`}
        action={
          isCompleted ? (
            <Button variant="primary" size="sm" onClick={onAddRating}>
              {rateLabel}
            </Button>
          ) : null
        }
      />
      <Card.Body>
        {!isCompleted ? (
          <div
            style={{
              background: 'var(--s3)',
              borderRadius: '14px',
              padding: '18px',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--t3)' }}>
              ⏳ Ratings will appear after the event
            </span>
          </div>
        ) : ratings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 20px' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>⭐</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t2)', marginBottom: '4px' }}>
              No ratings yet
            </div>
            <div style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '16px' }}>
              Be the first to share how it went
            </div>
            <Button variant="primary" size="sm" onClick={onAddRating}>
              ⭐ Rate this Event
            </Button>
          </div>
        ) : (
          <>
            {/* Summary block */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '20px',
                background: 'var(--s3)',
                borderRadius: '14px',
                padding: '18px',
                border: '1px solid var(--glass)',
                marginBottom: '14px',
              }}
            >
              {/* Left: big score */}
              <div style={{ flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: '52px',
                    fontWeight: 900,
                    color: 'var(--t1)',
                    letterSpacing: '-2px',
                    lineHeight: 1,
                  }}
                >
                  {avg}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--t3)',
                    marginTop: '2px',
                  }}
                >
                  /10
                </div>
                <div style={{ marginTop: '4px' }}>
                  <StarRow avg={avg} />
                </div>
              </div>

              {/* Right: bars */}
              <div style={{ flex: 1 }}>
                {dist.map((d) => (
                  <RatingBar
                    key={d.label}
                    label={d.label}
                    count={d.count}
                    max={maxDist}
                  />
                ))}
              </div>
            </div>

            {/* Reviews */}
            {sorted.map((r, i) => (
              <ReviewItem key={r.id || i} rating={r} />
            ))}
          </>
        )}
      </Card.Body>
    </Card>
  )
}
