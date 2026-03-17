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
        gap: '6px',
        padding: '5px 11px 5px 8px',
        borderRadius: '100px',
        border: isDark ? '1px solid rgba(250,204,21,0.25)' : '1px solid rgba(99,102,241,0.22)',
        background: isDark
          ? 'rgba(250,204,21,0.08)'
          : 'rgba(99,102,241,0.07)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        flexShrink: 0,
      }}
    >
      {/* Track with sliding knob */}
      <div style={{ position: 'relative', width: '28px', height: '16px', flexShrink: 0 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '100px',
          background: isDark ? 'rgba(250,204,21,0.18)' : 'rgba(99,102,241,0.15)',
          transition: 'background 0.2s',
        }} />
        <div style={{
          position: 'absolute',
          top: '2px',
          left: isDark ? '14px' : '2px',
          width: '12px', height: '12px', borderRadius: '50%',
          background: isDark ? '#fbbf24' : '#6366f1',
          boxShadow: isDark ? '0 0 6px rgba(251,191,36,0.6)' : '0 0 6px rgba(99,102,241,0.5)',
          transition: 'left 0.2s, background 0.2s, box-shadow 0.2s',
        }} />
      </div>
      <span style={{
        fontSize: '12px',
        fontWeight: 700,
        color: isDark ? '#fbbf24' : '#6366f1',
        transition: 'color 0.2s',
        userSelect: 'none',
      }}>
        {isDark ? '☀️' : '🌙'}
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
