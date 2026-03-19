// Form primitives — FormInput, FormLabel, FormGroup, FormSection, FormRow, FormSelect, PasswordInput
import { useState, useId } from 'react'

export function FormLabel({ children, required, htmlFor }) {
  return (
    <label
      htmlFor={htmlFor}
      className="cp-form-label"
    >
      {children}
      {required && <span style={{ color: 'var(--rose)', marginLeft: '2px' }}>*</span>}
    </label>
  )
}

export function FormInput({ error, style: styleProp = {}, id, ...props }) {
  const errorId = error ? `${id || 'input'}-error` : undefined
  return (
    <input
      id={id}
      className={`cp-form-input ${error ? 'cp-form-input--error' : ''}`}
      style={styleProp}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={errorId}
      {...props}
    />
  )
}

export function FormSelect({ children, error, style: styleProp = {}, id, ...props }) {
  const errorId = error ? `${id || 'select'}-error` : undefined
  return (
    <select
      id={id}
      className={`cp-form-input cp-form-select ${error ? 'cp-form-input--error' : ''}`}
      style={styleProp}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={errorId}
      {...props}
    >
      {children}
    </select>
  )
}

export function FormTextarea({ error, style: styleProp = {}, id, maxLength, value, ...props }) {
  const errorId = error ? `${id || 'textarea'}-error` : undefined
  const charCount = maxLength && typeof value === 'string' ? value.length : null
  return (
    <div>
      <textarea
        id={id}
        className={`cp-form-input cp-form-textarea ${error ? 'cp-form-input--error' : ''}`}
        style={styleProp}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
        maxLength={maxLength}
        value={value}
        {...props}
      />
      {charCount !== null && (
        <div style={{ textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--t3)', marginTop: '2px' }}>
          {charCount}/{maxLength}
        </div>
      )}
    </div>
  )
}

export function FormError({ children, id }) {
  if (!children) return null
  return (
    <p id={id} className="cp-form-error" role="alert">{children}</p>
  )
}

export function PasswordInput({ error, style: styleProp = {}, id, ...props }) {
  const [show, setShow] = useState(false)
  const errorId = error ? `${id || 'password'}-error` : undefined
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className={`cp-form-input cp-form-input--password ${error ? 'cp-form-input--error' : ''}`}
        style={styleProp}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="cp-form-pwd-toggle"
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  )
}

export function FormGroup({ label, required, error, children, id: idProp }) {
  const autoId = useId()
  const id = idProp || autoId
  const errorId = error ? `${id}-error` : undefined

  return (
    <div>
      {label && <FormLabel required={required} htmlFor={id}>{label}</FormLabel>}
      {/* Clone input to inject id — or just rely on wrapping */}
      {children}
      <FormError id={errorId}>{error}</FormError>
    </div>
  )
}

export function FormRow({ children, cols = 2 }) {
  return (
    <div className="cp-form-row" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {children}
    </div>
  )
}

export function FormSection({ title, children, style: styleProp = {} }) {
  return (
    <div className="cp-form-section" style={styleProp}>
      {title && (
        <div className="cp-form-section-title">{title}</div>
      )}
      {children}
    </div>
  )
}
