import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Avatar from '../ui/Avatar'

const SIGNOUT_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

const MAIN_NAV = [
  { to: '/dashboard',   label: 'Dashboard',   icon: '🏠' },
  { to: '/groups',      label: 'My Groups',    icon: '👥', id: 'tour-nav-groups' },
  { to: '/events',      label: 'Events',      icon: '📅', id: 'tour-nav-events' },
  { to: '/stats',       label: 'Stats',       icon: '📊', id: 'tour-nav-stats' },
  { to: '/leaderboard', label: 'Leaderboard', icon: '🏆', id: 'tour-nav-leaderboard' },
]

const DISCOVER_NAV = [
  { to: '/discover', label: 'Explore', icon: '✦', id: 'tour-nav-discover', end: true },
]

const SETTINGS_NAV = [
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

function NavItem({ to, label, icon, id, onClick, end }) {
  return (
    <NavLink
      id={id}
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) => `cp-nav-item${isActive ? ' active' : ''}`}
    >
      <span className="cp-nav-icon">{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
    </NavLink>
  )
}

export default function Sidebar({ user: userProp, groupCount = 0, notifCount = 0, isMobile = false, isOpen = false, onClose }) {
  const { user: authUser, logout } = useAuth()
  const navigate = useNavigate()
  const user = userProp || authUser

  const handleNavClick = () => {
    if (isMobile && onClose) onClose()
  }

  const handleSignOut = async () => {
    await logout()
    navigate('/login')
  }

  const sidebarContent = (
    <aside className={`cp-sidebar${isMobile ? ' cp-sidebar--mobile' : ''}`}>
      {/* Mobile close button */}
      {isMobile && (
        <button
          onClick={onClose}
          className="cp-sidebar-close"
          aria-label="Close menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}

      {/* Top — user identity */}
      <div
        onClick={() => { navigate('/settings'); handleNavClick() }}
        className="cp-sidebar-user"
      >
        <Avatar user={user} size="md" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="cp-sidebar-username">
              {user?.full_name || user?.username || 'User'}
            </div>
            {user?.is_admin && (
              <span className="cp-admin-badge">Admin</span>
            )}
          </div>
          <div className="cp-sidebar-handle">
            @{user?.username || '—'}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="cp-sidebar-nav" style={{ flex: 1, padding: '10px', overflowY: 'auto' }}>
        {/* Main */}
        <div className="cp-nav-label">Main</div>
        {MAIN_NAV.map(item => (
          <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} id={item.id} onClick={handleNavClick} />
        ))}

        {/* Discover */}
        <div className="cp-nav-label">Discover</div>
        {DISCOVER_NAV.map(item => (
          <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} id={item.id} end={item.end} onClick={handleNavClick} />
        ))}

        {/* Settings */}
        <div className="cp-nav-label">Settings</div>
        {SETTINGS_NAV.map(item => (
          <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} onClick={handleNavClick} />
        ))}
        {user?.is_admin && (
          <NavLink
            to="/settings"
            onClick={handleNavClick}
            className={({ isActive }) => `cp-nav-item${isActive ? ' active' : ''}`}
            style={{ color: 'var(--rose)' }}
          >
            <span className="cp-nav-icon">🛡️</span>
            <span style={{ flex: 1 }}>Admin Panel</span>
            <span className="cp-admin-badge" style={{ fontSize: '8px', padding: '1px 4px' }}>You</span>
          </NavLink>
        )}
      </nav>

      {/* Bottom — sign out */}
      <button onClick={handleSignOut} className="cp-sidebar-signout">
        {SIGNOUT_ICON}
        Sign out
      </button>

      {/* Brand watermark */}
      <button
        onClick={() => { navigate('/settings', { state: { scrollTo: 'about' } }); handleNavClick() }}
        className="cp-sidebar-brand"
      >
        <img src="/clubPal.png" alt="clubPal logo" style={{ width: '26px', height: '26px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t2)', letterSpacing: '0.01em' }}>clubPal</span>
      </button>
    </aside>
  )

  // Mobile: render as overlay drawer
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          className={`cp-sidebar-backdrop${isOpen ? ' open' : ''}`}
          onClick={onClose}
          aria-hidden="true"
        />
        {/* Drawer */}
        <div className={`cp-sidebar-drawer${isOpen ? ' open' : ''}`}>
          {sidebarContent}
        </div>
      </>
    )
  }

  // Desktop: render normally
  return sidebarContent
}
