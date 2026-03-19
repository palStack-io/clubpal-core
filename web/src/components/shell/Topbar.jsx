import BackButton from '../ui/BackButton'
import NotificationsDropdown from '../ui/NotificationsDropdown'
import ThemeToggle from '../ui/ThemeToggle'
import { useMobileNav } from '../../contexts/MobileNavContext'

export default function Topbar({ title, onBack, showSearch = false, onSearch, children }) {
  const { isMobile, openSidebar } = useMobileNav()

  return (
    <header className="cp-topbar">
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

      {onBack && <BackButton onClick={onBack} />}
      <span className="cp-topbar-title">
        {title}
      </span>

      {showSearch && (
        <input
          className="cp-topbar-search"
          placeholder="Search..."
          onChange={e => onSearch?.(e.target.value)}
        />
      )}

      {children && (
        <>
          <div className="cp-topbar-divider" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {children}
          </div>
        </>
      )}

      <ThemeToggle />
      <NotificationsDropdown />
    </header>
  )
}
