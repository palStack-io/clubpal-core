import { useTheme } from '../../contexts/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px',
        borderRadius: '100px',
        border: '1px solid var(--glass)',
        background: 'var(--s3)',
        cursor: 'pointer',
        transition: 'border-color 0.2s, background 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '26px', height: '26px', borderRadius: '100px',
        fontSize: '13px',
        background: !isDark ? 'var(--rose)' : 'transparent',
        boxShadow: !isDark ? '0 1px 6px rgba(244,63,94,0.45)' : 'none',
        transition: 'background 0.2s, box-shadow 0.2s',
      }}>
        ☀️
      </span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '26px', height: '26px', borderRadius: '100px',
        fontSize: '13px',
        background: isDark ? 'rgba(99,102,241,0.85)' : 'transparent',
        boxShadow: isDark ? '0 1px 6px rgba(99,102,241,0.5)' : 'none',
        transition: 'background 0.2s, box-shadow 0.2s',
      }}>
        🌙
      </span>
    </button>
  )
}
