// Form primitives — FormInput, FormLabel, FormGroup, FormSection, FormRow, FormSelect

export function FormLabel({ children, required }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--t3)',
        letterSpacing: '0.2px',
        marginBottom: '5px',
      }}
    >
      {children}
      {required && <span style={{ color: 'var(--rose)', marginLeft: '2px' }}>*</span>}
    </label>
  )
}

export function FormInput({ error, style: styleProp = {}, ...props }) {
  return (
    <input
      style={{
        width: '100%',
        padding: '9px 12px',
        border: `1px solid ${error ? 'rgba(248,113,113,0.5)' : 'var(--glass)'}`,
        borderRadius: '10px',
        fontSize: '13px',
        color: 'var(--t1)',
        background: 'var(--s3)',
        outline: 'none',
        boxSizing: 'border-box',
        ...styleProp,
      }}
      onFocus={e => {
        e.target.style.borderColor = 'rgba(244,63,94,0.22)'
        e.target.style.boxShadow = '0 0 0 3px rgba(244,63,94,0.15)'
      }}
      onBlur={e => {
        e.target.style.borderColor = error ? 'rgba(248,113,113,0.5)' : 'var(--glass)'
        e.target.style.boxShadow = 'none'
      }}
      {...props}
    />
  )
}

export function FormSelect({ children, error, style: styleProp = {}, ...props }) {
  return (
    <select
      style={{
        width: '100%',
        padding: '9px 12px',
        border: `1px solid ${error ? 'rgba(248,113,113,0.5)' : 'var(--glass)'}`,
        borderRadius: '10px',
        fontSize: '13px',
        color: 'var(--t1)',
        background: 'var(--s3)',
        outline: 'none',
        boxSizing: 'border-box',
        cursor: 'pointer',
        ...styleProp,
      }}
      {...props}
    >
      {children}
    </select>
  )
}

export function FormTextarea({ error, style: styleProp = {}, ...props }) {
  return (
    <textarea
      style={{
        width: '100%',
        padding: '9px 12px',
        border: `1px solid ${error ? 'rgba(248,113,113,0.5)' : 'var(--glass)'}`,
        borderRadius: '10px',
        fontSize: '13px',
        color: 'var(--t1)',
        background: 'var(--s3)',
        outline: 'none',
        boxSizing: 'border-box',
        resize: 'vertical',
        fontFamily: 'inherit',
        ...styleProp,
      }}
      onFocus={e => {
        e.target.style.borderColor = 'rgba(244,63,94,0.22)'
        e.target.style.boxShadow = '0 0 0 3px rgba(244,63,94,0.15)'
      }}
      onBlur={e => {
        e.target.style.borderColor = error ? 'rgba(248,113,113,0.5)' : 'var(--glass)'
        e.target.style.boxShadow = 'none'
      }}
      {...props}
    />
  )
}

export function FormError({ children }) {
  if (!children) return null
  return (
    <p style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>{children}</p>
  )
}

export function FormGroup({ label, required, error, children }) {
  return (
    <div>
      {label && <FormLabel required={required}>{label}</FormLabel>}
      {children}
      <FormError>{error}</FormError>
    </div>
  )
}

export function FormRow({ children, cols = 2 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '12px',
      }}
    >
      {children}
    </div>
  )
}

export function FormSection({ title, children, style: styleProp = {} }) {
  return (
    <div
      style={{
        background: 'var(--s2)',
        border: '1px solid var(--glass)',
        borderRadius: '14px',
        padding: '20px',
        marginBottom: '14px',
        ...styleProp,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--t1)',
            marginBottom: '14px',
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  )
}
