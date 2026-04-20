import Sidebar from './Sidebar'
import BottomTabBar from './BottomTabBar'
import ReleaseBanner from '../ui/ReleaseBanner'
import { useAuth } from '../../contexts/AuthContext'
import { useMobileNav } from '../../contexts/MobileNavContext'

export default function AppShell({ children, activeRoute, user: userProp, groupCount = 0, notifCount = 0 }) {
  const { user: authUser } = useAuth()
  const user = userProp || authUser
  const { isMobile, sidebarOpen, closeSidebar } = useMobileNav()

  return (
    <div className="cp-shell">
      {/* Skip to content — accessibility */}
      <a href="#main-content" className="cp-skip-link">
        Skip to content
      </a>
      <Sidebar
        activeRoute={activeRoute}
        user={user}
        groupCount={groupCount}
        notifCount={notifCount}
        isMobile={isMobile}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
      />
      <div className="cp-main" id="main-content">
        {/* Beta banner */}
        <div className="cp-beta-banner">
          🚧 ClubPal is in beta — for feedback or issues, email{' '}
          <a href="mailto:support@palstack.io" className="cp-beta-link">
            support@palstack.io
          </a>
        </div>
        {/* Release banner — shown once per version until dismissed */}
        <ReleaseBanner />
        {children}
        {/* Footer */}
        <div className="cp-footer">
          <img src="/palStack.png" alt="palStack" style={{ height: '12px', objectFit: 'contain', opacity: 0.5 }} />
          <span style={{ fontSize: '11px', color: 'var(--t4)' }}>Part of</span>
          <a
            href="https://palstack.io"
            target="_blank"
            rel="noopener noreferrer"
            className="cp-footer-link"
          >
            palStack.io
          </a>
        </div>
      </div>
      {isMobile && <BottomTabBar />}
    </div>
  )
}
