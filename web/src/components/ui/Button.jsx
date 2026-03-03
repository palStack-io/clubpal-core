export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className = '',
  icon,
  style: styleProp = {},
  ...props
}) {
  const base =
    'inline-flex items-center justify-center font-medium transition-colors ' +
    'focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed'

  const variantStyles = {
    primary: {
      background: 'linear-gradient(135deg, var(--rose-soft), var(--rose))',
      color: '#ffffff',
      boxShadow: '0 4px 14px rgba(244,63,94,0.25)',
      border: 'none',
      fontWeight: 700,
    },
    secondary: {
      background: 'var(--s3)',
      color: 'var(--t2)',
      border: '1px solid var(--glass)',
      fontWeight: 600,
    },
    ghost: {
      background: 'transparent',
      color: 'var(--t2)',
      border: 'none',
      fontWeight: 500,
    },
    subtle: {
      background: 'transparent',
      color: 'var(--t3)',
      border: '1px solid var(--glass)',
      fontWeight: 500,
    },
    danger: {
      background: '#ef4444',
      color: '#ffffff',
      border: 'none',
      fontWeight: 700,
    },
    hero: {
      background: 'linear-gradient(135deg, var(--rose-soft), var(--rose))',
      color: '#ffffff',
      boxShadow: '0 6px 20px rgba(244,63,94,0.35)',
      border: 'none',
      fontSize: '13px',
      fontWeight: 700,
    },
    'hero-ghost': {
      background: 'rgba(255,255,255,0.06)',
      color: 'var(--t2)',
      border: '1px solid var(--glass)',
      fontSize: '13px',
      fontWeight: 600,
    },
    link: {
      background: 'transparent',
      color: 'var(--rose)',
      border: 'none',
      textDecoration: 'underline',
      fontWeight: 500,
      padding: 0,
    },
  }

  const sizeStyles = {
    sm: { padding: '5px 12px', fontSize: '11px', borderRadius: '8px' },
    md: { padding: '7px 14px', fontSize: '12px', borderRadius: '10px' },
    lg: { padding: '9px 18px', fontSize: '13px', borderRadius: '10px' },
  }

  const vs = variantStyles[variant] || variantStyles.primary
  const ss = variant === 'link' ? {} : (sizeStyles[size] || sizeStyles.md)

  const inlineStyle = {
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    gap: '6px',
    ...vs,
    ...ss,
    ...styleProp,
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${base} ${className}`}
      style={inlineStyle}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {icon && <span>{icon}</span>}
      {children}
    </button>
  )
}
