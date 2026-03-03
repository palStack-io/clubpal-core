import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Avatar from '../ui/Avatar'

const MAIN_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/groups',    label: 'My Groups',  icon: '👥' },
  { to: '/events',    label: 'Events',     icon: '📅' },
  { to: '/stats',     label: 'Stats',      icon: '📊' },
  { to: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
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

function NavItem({ to, label, icon }) {
  return (
    <NavLink
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
  const { user: authUser } = useAuth()
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
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.full_name || user?.username || 'User'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--t3)' }}>
            @{user?.username || '—'}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px', overflowY: 'auto' }}>
        {/* Main */}
        <div className="cp-nav-label">Main</div>
        {MAIN_NAV.map(item => (
          <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} />
        ))}

        {/* Discover — collapsible */}
        <button
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
      </nav>

      {/* Bottom — branding */}
      <div
        style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--sidebar-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
          <img
            src="/clubPal.png"
            alt="clubPal"
            style={{ height: '20px', objectFit: 'contain', flexShrink: 0 }}
          />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t2)', letterSpacing: '-0.3px' }}>clubPal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: 'var(--t4)' }}>Part of</span>
          <img src="/palStack.png" alt="palStack" style={{ height: '10px', objectFit: 'contain', flexShrink: 0 }} />
          <span style={{ fontSize: '10px', color: 'var(--t4)', fontWeight: 600 }}>palStack.io</span>
        </div>
      </div>
    </aside>
  )
}
