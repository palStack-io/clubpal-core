import BackButton from '../ui/BackButton'
import NotificationsDropdown from '../ui/NotificationsDropdown'

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

      <NotificationsDropdown />
    </header>
  )
}
