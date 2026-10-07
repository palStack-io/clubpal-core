import { useMobileNav } from '../../contexts/MobileNavContext'

export default function StatsHero({ user, year = new Date().getFullYear(), totalEvents = 0, groupCount = 0 }) {
  const firstName = user?.full_name?.split(' ')[0] || 'Explorer'
  const { isMobile, openSidebar } = useMobileNav()

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
      {isMobile && (
        <button
          onClick={openSidebar}
          className="cp-hamburger"
          aria-label="Open menu"
          style={{ marginBottom: '10px' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      )}
      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--rose-soft)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
        Your {year} in Review
      </div>
      <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--t1)', letterSpacing: '-1px', marginBottom: '4px' }}>
        {totalEvents} Group Adventures
      </div>
      <div style={{ fontSize: '12px', color: 'var(--t3)' }}>
        Across {groupCount} group{groupCount !== 1 ? 's' : ''} · Jan–Dec {year}
      </div>
    </div>
  )
}
