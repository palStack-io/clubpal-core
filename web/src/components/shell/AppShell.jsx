import { Link } from 'react-router-dom'
import Sidebar from './Sidebar'

function DefaultPasswordBanner() {
  return (
    <div style={{
      background: 'rgba(239,68,68,0.12)',
      borderBottom: '1px solid rgba(239,68,68,0.35)',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: '16px' }}>⚠️</span>
      <span style={{ color: '#fca5a5', fontSize: '13px', fontWeight: 500 }}>
        You're using the default admin password.{' '}
        <Link
          to="/settings"
          state={{ scrollTo: 'security' }}
          style={{ color: '#f87171', textDecoration: 'underline', fontWeight: 600 }}
        >
          Change it now
        </Link>
        {' '}to secure your deployment.
      </span>
    </div>
  )
}

export default function AppShell({ children, activeRoute, user, groupCount = 0, notifCount = 0 }) {
  const showDefaultPasswordWarning = user?.is_admin && user?.password_changed === false

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--bg)',
      }}
    >
      <Sidebar
        activeRoute={activeRoute}
        user={user}
        groupCount={groupCount}
        notifCount={notifCount}
      />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          marginLeft: '240px',
          minHeight: '100vh',
        }}
      >
        {showDefaultPasswordWarning && <DefaultPasswordBanner />}
        {children}
      </div>
    </div>
  )
}
