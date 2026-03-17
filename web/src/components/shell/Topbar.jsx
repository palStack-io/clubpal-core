import BackButton from '../ui/BackButton'
import NotificationsDropdown from '../ui/NotificationsDropdown'
import { useTheme } from '../../contexts/ThemeContext'

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0',
        padding: '3px',
        borderRadius: '100px',
        border: '1px solid var(--glass)',
        background: 'var(--s3)',
        cursor: 'pointer',
        transition: 'border-color 0.2s, background 0.2s',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Sun option */}
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '26px', height: '26px', borderRadius: '100px',
        fontSize: '13px',
        background: !isDark ? 'var(--rose)' : 'transparent',
        boxShadow: !isDark ? '0 1px 6px rgba(244,63,94,0.45)' : 'none',
        transition: 'background 0.2s, box-shadow 0.2s',
        zIndex: 1,
      }}>
        ☀️
      </span>
      {/* Moon option */}
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '26px', height: '26px', borderRadius: '100px',
        fontSize: '13px',
        background: isDark ? 'rgba(99,102,241,0.85)' : 'transparent',
        boxShadow: isDark ? '0 1px 6px rgba(99,102,241,0.5)' : 'none',
        transition: 'background 0.2s, box-shadow 0.2s',
        zIndex: 1,
      }}>
        🌙
      </span>
    </button>
  )
}

export default function Topbar({ title, onBack, showSearch = false, onSearch, children }) {
  return (
    <header className="cp-topbar">
      {onBack && <BackButton onClick={onBack} />}
      <span
        style={{
          flex: 1,
          fontSize: '15px',
          fontWeight: 700,
          color: 'var(--t1)',
          letterSpacing: '-0.3px',
        }}
      >
        {title}
      </span>

      {showSearch && (
        <input
          style={{
            background: 'var(--s3)',
            border: '1px solid var(--glass)',
            borderRadius: '10px',
            padding: '6px 12px',
            fontSize: '12px',
            color: 'var(--t3)',
            outline: 'none',
            width: '180px',
          }}
          placeholder="🔍 Search..."
          onChange={e => onSearch?.(e.target.value)}
        />
      )}

      {children && (
        <>
          <div style={{ width: '1px', height: '20px', background: 'var(--glass)', flexShrink: 0 }} />
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
