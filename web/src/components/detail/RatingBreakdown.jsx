/** Horizontal bar chart showing 5→1 star rating distribution. Web layout only. */
export default function RatingBreakdown({ data }) {
  if (!data) return null

  return (
    <div
      style={{
        background: 'var(--s2)',
        border: '1px solid var(--glass)',
        borderRadius: '14px',
        padding: '16px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--t3)',
          textTransform: 'uppercase',
          letterSpacing: '0.7px',
          marginBottom: '14px',
        }}
      >
        Rating Breakdown
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[5, 4, 3, 2, 1].map(star => {
          const pct = data[star] ?? 0
          return (
            <div
              key={star}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--t3)',
                  width: '10px',
                  textAlign: 'right',
                  flexShrink: 0,
                  fontWeight: 700,
                }}
              >
                {star}
              </span>
              <span style={{ fontSize: '11px', color: '#f5c842', flexShrink: 0 }}>★</span>
              <div
                style={{
                  flex: 1,
                  height: '6px',
                  background: 'var(--s3)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '6px',
                    width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`,
                    background: '#f5c842',
                    borderRadius: '3px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--t3)',
                  width: '28px',
                  flexShrink: 0,
                  textAlign: 'right',
                }}
              >
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
