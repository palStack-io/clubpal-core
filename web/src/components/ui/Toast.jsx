import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

const ToastContext = createContext(null)

let _toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', { duration = 4000, action } = {}) => {
    const id = ++_toastId
    setToasts(prev => [...prev.slice(-2), { id, message, type, duration, action }])
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = {
    success: (msg, opts) => addToast(msg, 'success', typeof opts === 'number' ? { duration: opts } : opts),
    error: (msg, opts) => addToast(msg, 'error', typeof opts === 'number' ? { duration: opts } : opts),
    info: (msg, opts) => addToast(msg, 'info', typeof opts === 'number' ? { duration: opts } : opts),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="cp-toast-container" role="log" aria-live="polite" aria-label="Notifications">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const ICON_MAP = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
}

const borderColors = {
  success: 'var(--success)',
  error: 'var(--error)',
  info: 'var(--info)',
}

function ToastItem({ toast: t, onDismiss }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    // Trigger slide-in after mount
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, 200)
  }

  return (
    <div
      ref={ref}
      role="alert"
      className={`cp-toast ${visible ? 'cp-toast--visible' : ''}`}
      style={{ borderLeftColor: borderColors[t.type] }}
    >
      <span className="cp-toast-icon">{ICON_MAP[t.type]}</span>
      <span className="cp-toast-msg">{t.message}</span>
      {t.action && (
        <button className="cp-toast-action" onClick={() => { t.action.onClick(); handleDismiss() }}>
          {t.action.label}
        </button>
      )}
      <button onClick={handleDismiss} className="cp-toast-close" aria-label="Dismiss notification">
        <XMarkIcon style={{ width: '14px', height: '14px' }} />
      </button>
      {t.duration > 0 && (
        <div className="cp-toast-progress" style={{ animationDuration: `${t.duration}ms`, backgroundColor: borderColors[t.type] }} />
      )}
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
