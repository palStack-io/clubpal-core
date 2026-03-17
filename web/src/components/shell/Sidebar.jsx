import { useState } from 'react'
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
  { to: '/groups',      label: 'My Groups',   icon: '👥', id: 'tour-nav-groups' },
  { to: '/events',      label: 'Events',      icon: '📅', id: 'tour-nav-events' },
  { to: '/stats',       label: 'Stats',       icon: '📊', id: 'tour-nav-stats' },
  { to: '/leaderboard', label: 'Leaderboard', icon: '🏆', id: 'tour-nav-leaderboard' },
]

const DISCOVER_NAV = [
  { to: '/discover/restaurants', label: 'Restaurants', icon: '🍽️' },
  { to: '/discover/movies',      label: 'Movies',      icon: '🎬' },
  { to: '/discover/shows',       label: 'TV Shows',    icon: '📺' },
  { to: '/discover/books',       label: 'Books',       icon: '📚' },
  { to: '/discover/hikes',       label: 'Hikes',       icon: '🥾' },
  { to: '/discover/games',       label: 'Games',       icon: '🎮' },
  { to: '/discover/arts',        label: 'Arts',        icon: '🎨' },
  { to: '/activities',           label: 'Activities',  icon: '✨' },
]

const SETTINGS_NAV = [
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

function NavItem({ to, label, icon, id }) {
  return (
    <NavLink
      id={id}
      to={to}
      className={({ isActive }) => `cp-nav-item${isActive ? ' active' : ''}`}
    >
      <span style={{ fontSize: '16px', width: '22px', textAlign: 'center', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
    </NavLink>
  )
}

export default function Sidebar({ user: userProp, groupCount = 0, notifCount = 0 }) {
  const { user: authUser, logout } = useAuth()
  const navigate = useNavigate()
  const user = userProp || authUser
  const [discoverOpen, setDiscoverOpen] = useState(true)

  return (
    <aside className="cp-sidebar">
      {/* Top — user identity */}
      <div
        onClick={() => navigate('/settings')}
        style={{
          padding: '16px 16px 14px',
          borderBottom: '1px solid var(--sidebar-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--nav-hover-bg)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <Avatar user={user} size="md" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.full_name || user?.username || 'User'}
            </div>
            {user?.is_admin && (
              <span style={{
                fontSize: '9px', fontWeight: 800, letterSpacing: '0.5px',
                textTransform: 'uppercase', color: 'var(--rose)',
                background: 'var(--rose-glow)', border: '1px solid var(--rose-border)',
                borderRadius: '5px', padding: '1px 5px', flexShrink: 0,
              }}>
                Admin
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--t3)' }}>
            @{user?.username || '—'}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="cp-sidebar-nav" style={{ flex: 1, padding: '10px', overflowY: 'auto' }}>
        {/* Main */}
        <div className="cp-nav-label">Main</div>
        {MAIN_NAV.map(item => (
          <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} id={item.id} />
        ))}

        {/* Discover — collapsible */}
        <button
          id="tour-nav-discover"
          onClick={() => setDiscoverOpen(o => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 8px',
            margin: '16px 0 6px',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: 'var(--nav-label-color)',
              flex: 1,
              textAlign: 'left',
            }}
          >
            Discover
          </span>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--nav-label-color)',
              transition: 'transform 0.15s',
              display: 'inline-block',
              transform: discoverOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
            }}
          >
            ▾
          </span>
        </button>

        {discoverOpen && DISCOVER_NAV.map(item => (
          <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} />
        ))}

        {/* Settings */}
        <div className="cp-nav-label">Settings</div>
        {SETTINGS_NAV.map(item => (
          <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} />
        ))}
        {user?.is_admin && (
          <NavLink
            to="/settings"
            className={({ isActive }) => `cp-nav-item${isActive ? ' active' : ''}`}
            style={{ color: 'var(--rose)' }}
          >
            <span style={{ fontSize: '16px', width: '22px', textAlign: 'center', flexShrink: 0 }}>🛡️</span>
            <span style={{ flex: 1 }}>Admin Panel</span>
            <span style={{
              fontSize: '8px', fontWeight: 800, letterSpacing: '0.5px',
              textTransform: 'uppercase', color: 'var(--rose)',
              background: 'var(--rose-glow)', border: '1px solid var(--rose-border)',
              borderRadius: '4px', padding: '1px 4px',
            }}>
              You
            </span>
          </NavLink>
        )}
      </nav>

      {/* Bottom — sign out */}
      <button
        onClick={async () => { await logout(); navigate('/login'); }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          background: 'none',
          border: 'none',
          borderTop: '1px solid var(--sidebar-border)',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--t3)',
          textAlign: 'left',
          transition: 'color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.06)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--t3)'; e.currentTarget.style.background = 'none'; }}
      >
        {SIGNOUT_ICON}
        Sign out
      </button>
    </aside>
  )
}
