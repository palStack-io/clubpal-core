// Card — supports Card.Header / Card.Body API and legacy CardHeader export

function CardHeaderNew({ title, action }) {
  return (
    <div className="cp-card-header">
      <span
        style={{
          flex: 1,
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--t1)',
          letterSpacing: '-0.2px',
        }}
      >
        {title}
      </span>
      {action && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {action}
        </div>
      )}
    </div>
  )
}

function CardBody({ children, style: styleProp = {} }) {
  return (
    <div className="cp-card-body" style={styleProp}>
      {children}
    </div>
  )
}

function Card({ children, className = '', padding = false, style: styleProp = {} }) {
  return (
    <div
      className={`cp-card ${className}`}
      style={{ ...(padding ? { padding: '18px' } : {}), ...styleProp }}
    >
      {children}
    </div>
  )
}

Card.Header = CardHeaderNew
Card.Body = CardBody

export default Card

// Legacy named export for backward compat
export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-base font-semibold" style={{ color: 'var(--t1)' }}>{title}</h3>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: 'var(--t3)' }}>{subtitle}</p>}
      </div>
      {action && <div className="ml-4 flex-shrink-0">{action}</div>}
    </div>
  )
}
