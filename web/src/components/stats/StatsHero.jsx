export default function StatsHero({ user, year = new Date().getFullYear(), totalEvents = 0, groupCount = 0 }) {
  const firstName = user?.full_name?.split(' ')[0] || 'Explorer'

  return (
    <div
      style={{
        width: '100%',
        padding: '22px 24px',
        borderBottom: '1px solid var(--glass)',
        background: 'linear-gradient(135deg, rgba(244,63,94,0.10), rgba(99,102,241,0.06))',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244,63,94,0.12) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--rose-soft)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
        Your {year} in Review
      </div>
      <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--t1)', letterSpacing: '-1px', marginBottom: '4px' }}>
        {totalEvents} Group Adventures 🎉
      </div>
      <div style={{ fontSize: '12px', color: 'var(--t3)' }}>
        Across {groupCount} club{groupCount !== 1 ? 's' : ''} · Jan–Dec {year}
      </div>
    </div>
  )
}
