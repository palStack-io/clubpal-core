export default function PageHero({ title, subtitle, label, notifCount = 0, hasStats = false, children }) {
  return (
    <div
      style={{
        padding: hasStats ? '22px 24px 44px' : '18px 24px',
        background: 'linear-gradient(135deg, rgba(244,63,94,0.10) 0%, rgba(99,102,241,0.06) 100%)',
        borderBottom: '1px solid var(--glass)',
        overflow: 'hidden',
        position: 'relative',
        transition: 'background 0.15s',
      }}
    >
      {/* Decorative glow */}
      <div
        style={{
          position: 'absolute',
          top: '-24px',
          right: '-24px',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(244,63,94,0.13) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Title area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {label && (
            <div
              style={{
                fontSize: '9px',
                fontWeight: 700,
                color: 'var(--rose-soft)',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                marginBottom: '3px',
              }}
            >
              {label}
            </div>
          )}
          <div
            style={{
              fontSize: '22px',
              fontWeight: 900,
              color: 'var(--t1)',
              letterSpacing: '-0.8px',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '3px' }}>
              {subtitle}
            </div>
          )}
        </div>

        {/* Action buttons */}
        {children && (
          <>
            <div style={{ width: '1px', height: '20px', background: 'var(--glass)', flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {children}
            </div>
          </>
        )}

        {/* Notification bell */}
        <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
          <button
            style={{
              width: '32px',
              height: '32px',
              background: 'rgba(255,255,255,0.07)',
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
      </div>
    </div>
  )
}
