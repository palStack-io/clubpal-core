import Sidebar from './Sidebar'
import { useAuth } from '../../contexts/AuthContext'

export default function AppShell({ children, activeRoute, user: userProp, groupCount = 0, notifCount = 0 }) {
  const { user: authUser } = useAuth()
  const user = userProp || authUser

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
        {children}
        {/* Footer */}
        <div style={{
          marginTop: 'auto',
          padding: '16px 24px',
          borderTop: '1px solid var(--glass)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <img src="/palStack.png" alt="palStack" style={{ height: '12px', objectFit: 'contain', opacity: 0.5 }} />
          <span style={{ fontSize: '11px', color: 'var(--t4)' }}>Part of</span>
          <a
            href="https://palstack.io"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '11px', color: 'var(--t3)', fontWeight: 600, textDecoration: 'none' }}
            onMouseEnter={e => e.target.style.color = 'var(--t2)'}
            onMouseLeave={e => e.target.style.color = 'var(--t3)'}
          >
            palStack.io
          </a>
        </div>
      </div>
    </div>
  )
}
