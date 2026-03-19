import ThemeToggle from '../ui/ThemeToggle'
import NotificationsDropdown from '../ui/NotificationsDropdown'
import { useMobileNav } from '../../contexts/MobileNavContext'

export default function PageHero({ title, subtitle, label, hasStats = false, children }) {
  const { isMobile, openSidebar } = useMobileNav()

  return (
    <div
      style={{
        padding: hasStats ? '22px 24px 44px' : '18px 24px',
        background: 'linear-gradient(135deg, rgba(244,63,94,0.10) 0%, rgba(99,102,241,0.06) 100%)',
        borderBottom: '1px solid var(--glass)',
        position: 'relative',
        transition: 'background 0.15s',
      }}
    >
      {/* Decorative glow — clipped via its own overflow wrapper */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: '-24px',
            right: '-24px',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(244,63,94,0.13) 0%, transparent 65%)',
          }}
        />
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Hamburger on mobile */}
        {isMobile && (
          <button
            onClick={openSidebar}
            className="cp-hamburger"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        )}

        {/* Title area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {label && (
            <div
              style={{
                fontSize: '9px',
                fontWeight: 700,
                color: 'var(--rose-soft)',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                marginBottom: '3px',
              }}
            >
              {label}
            </div>
          )}
          <div
            style={{
              fontSize: '22px',
              fontWeight: 900,
              color: 'var(--t1)',
              letterSpacing: '-0.8px',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '3px' }}>
              {subtitle}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {children && (
          <>
            <div style={{ width: '1px', height: '20px', background: 'var(--glass)', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {children}
            </div>
          </>
        )}

        <ThemeToggle />
        <NotificationsDropdown />
      </div>
    </div>
  )
}
