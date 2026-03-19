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
  iconOnly = false,
  style: styleProp = {},
  ...props
}) {
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
      background: 'var(--error)',
      color: '#ffffff',
      border: 'none',
      fontWeight: 700,
    },
    hero: {
      background: 'linear-gradient(135deg, var(--rose-soft), var(--rose))',
      color: '#ffffff',
      boxShadow: '0 6px 20px rgba(244,63,94,0.35)',
      border: 'none',
      fontSize: 'var(--text-base)',
      fontWeight: 700,
    },
    'hero-ghost': {
      background: 'rgba(255,255,255,0.06)',
      color: 'var(--t2)',
      border: '1px solid var(--glass)',
      fontSize: 'var(--text-base)',
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
    sm: { padding: '5px 12px', fontSize: 'var(--text-xs)', borderRadius: 'var(--r-sm)' },
    md: { padding: '7px 14px', fontSize: 'var(--text-sm)', borderRadius: 'var(--r-md)' },
    lg: { padding: '9px 18px', fontSize: 'var(--text-base)', borderRadius: 'var(--r-md)' },
  }

  const iconOnlySizes = {
    sm: { width: '28px', height: '28px', padding: 0, borderRadius: 'var(--r-sm)' },
    md: { width: '34px', height: '34px', padding: 0, borderRadius: 'var(--r-md)' },
    lg: { width: '40px', height: '40px', padding: 0, borderRadius: 'var(--r-md)' },
  }

  const vs = variantStyles[variant] || variantStyles.primary
  const ss = variant === 'link' ? {} : (iconOnly ? iconOnlySizes[size] || iconOnlySizes.md : sizeStyles[size] || sizeStyles.md)

  const isDisabled = disabled || loading

  const inlineStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontWeight: 600,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.5 : 1,
    transition: 'all 0.15s ease',
    outline: 'none',
    ...vs,
    ...ss,
    ...styleProp,
  }

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={`cp-btn ${className}`}
      style={inlineStyle}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {/* Keep text to preserve width */}
          {!iconOnly && <span style={{ visibility: 'hidden', height: 0, overflow: 'hidden' }}>{children}</span>}
          {!iconOnly && children}
        </>
      ) : (
        <>
          {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
          {children}
        </>
      )}
    </button>
  )
}
