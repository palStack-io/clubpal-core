const trendColors = {
  positive: 'var(--green)',
  warning:  'var(--rose-soft)',
  neutral:  'var(--t3)',
}

export default function StatCard({ label, value, icon, trend, trendVariant = 'neutral' }) {
  return (
    <div className="cp-stat-card">
      <div
        style={{
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--t3)',
          letterSpacing: '0.2px',
          marginBottom: '10px',
        }}
      >
        {label}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            fontSize: '28px',
            fontWeight: 800,
            color: 'var(--t1)',
            letterSpacing: '-1px',
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        {icon && (
          <span style={{ fontSize: '22px', opacity: 0.6 }}>{icon}</span>
        )}
      </div>

      {trend && (
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: trendColors[trendVariant] || trendColors.neutral,
          }}
        >
          {trend}
        </div>
      )}
    </div>
  )
}
