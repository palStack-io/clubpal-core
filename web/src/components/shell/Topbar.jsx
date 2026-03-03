import BackButton from '../ui/BackButton'

export default function Topbar({ title, onBack, showSearch = false, onSearch, notifCount = 0, children }) {
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

      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <button
          style={{
            width: '32px',
            height: '32px',
            background: 'var(--s3)',
            border: '1px solid var(--glass)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '15px',
            color: 'var(--t2)',
          }}
          title="Notifications"
        >
          🔔
        </button>
        {notifCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--rose)',
              boxShadow: '0 0 6px var(--rose)',
            }}
          />
        )}
      </div>
    </header>
  )
}
