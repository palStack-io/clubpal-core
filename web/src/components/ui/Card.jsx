// Card — supports Card.Header / Card.Body API and legacy CardHeader export
// Variants: default, outlined, elevated, flat
// Add clickable prop for hover lift effect

function CardHeaderNew({ title, action }) {
  return (
    <div className="cp-card-header">
      <span
        style={{
          flex: 1,
          fontSize: 'var(--text-base)',
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

const variantClasses = {
  default: '',
  outlined: 'cp-card--outlined',
  elevated: 'cp-card--elevated',
  flat: 'cp-card--flat',
}

function Card({ children, className = '', padding = false, variant = 'default', clickable = false, onClick, style: styleProp = {} }) {
  const vClass = variantClasses[variant] || ''
  const clickClass = clickable || onClick ? 'cp-card--clickable' : ''

  return (
    <div
      className={`cp-card ${vClass} ${clickClass} ${className}`}
      style={{ ...(padding ? { padding: '18px' } : {}), ...styleProp }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e) } } : undefined}
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
