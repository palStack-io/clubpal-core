import Card from '../ui/Card'

const ACTIVITY_COLORS = {
  dining: '#f43f5e',
  movies: '#6366f1',
  books: '#a855f7',
  gaming: '#22d3a0',
  arts: '#f59e0b',
  hiking: '#14b8a6',
}

const ACTIVITY_EMOJIS = {
  dining: '🍽️',
  movies: '🎬',
  books: '📚',
  gaming: '🎮',
  arts: '🎨',
  hiking: '🥾',
}

export default function ActivityDonutCard({ breakdown = [] }) {
  // breakdown: [{ type, count }]
  const total = breakdown.reduce((s, b) => s + b.count, 0) || 1

  // Build conic gradient stops
  let currentPct = 0
  const stops = breakdown.map(b => {
    const color = ACTIVITY_COLORS[b.type] || '#9898b0'
    const pct = (b.count / total) * 100
    const stop = `${color} ${currentPct.toFixed(1)}% ${(currentPct + pct).toFixed(1)}%`
    currentPct += pct
    return stop
  })

  const gradient = stops.length > 0
    ? `conic-gradient(${stops.join(', ')})`
    : `conic-gradient(var(--s4) 0% 100%)`

  return (
    <Card>
      <Card.Header title="Activity Breakdown" />
      <Card.Body>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Donut */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div
              style={{
                width: '110px',
                height: '110px',
                borderRadius: '50%',
                background: gradient,
                boxShadow: '0 0 20px rgba(244,63,94,0.2)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                right: '20px',
                bottom: '20px',
                background: 'var(--s2)',
                borderRadius: '50%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--t1)', lineHeight: 1 }}>
                {total}
              </span>
              <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase' }}>
                total
              </span>
            </div>
          </div>

          {/* Legend */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {breakdown.map(b => {
              const color = ACTIVITY_COLORS[b.type] || '#9898b0'
              const pct = Math.round((b.count / total) * 100)
              return (
                <div key={b.type} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: 'var(--t2)' }}>
                    {ACTIVITY_EMOJIS[b.type] || ''} {b.type.charAt(0).toUpperCase() + b.type.slice(1)}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t1)' }}>{pct}%</span>
                </div>
              )
            })}
            {breakdown.length === 0 && (
              <span style={{ fontSize: '12px', color: 'var(--t3)' }}>No activity data yet</span>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}
