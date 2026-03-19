import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { gatewayClient } from '../../api/client'

const TYPE_ICON = {
  rotation: '🎯',
  event:    '📅',
  poll:     '📊',
  invite:   '✉️',
  comment:  '💬',
  system:   '🔔',
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationsDropdown() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })
  const containerRef = useRef(null)
  const bellRef = useRef(null)
  const dropdownRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.read).length

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await gatewayClient.get(`/users/${user.id}/notifications`)
      setNotifications(Array.isArray(res.data) ? res.data : [])
    } catch {}
  }, [user?.id])

  // Poll every 60s + fetch on open
  useEffect(() => {
    fetchNotifications()
    const timer = setInterval(fetchNotifications, 60000)
    return () => clearInterval(timer)
  }, [fetchNotifications])

  useEffect(() => {
    if (open) fetchNotifications()
  }, [open, fetchNotifications])

  // Close on outside click + Escape key
  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target) &&
          dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false)
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const handleNotifClick = async (notif) => {
    // Mark as read
    if (!notif.read) {
      try {
        await gatewayClient.put(`/users/${user.id}/notifications/${notif.id}/read`)
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
      } catch {}
    }
    // Navigate
    if (notif.link_type === 'group' && notif.link_id) {
      navigate(`/groups/${notif.link_id}`)
    } else if (notif.link_type === 'event' && notif.link_id) {
      navigate(`/events/${notif.link_id}`)
    }
    setOpen(false)
  }

  const handleMarkAllRead = async () => {
    try {
      await gatewayClient.put(`/users/${user.id}/notifications/read-all`)
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch {}
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        ref={bellRef}
        onClick={() => {
          if (!open && bellRef.current) {
            const rect = bellRef.current.getBoundingClientRect()
            const isMobile = window.innerWidth < 480
            setDropdownPos({
              top: rect.bottom + 8,
              right: isMobile ? null : window.innerWidth - rect.right,
              isMobile,
            })
          }
          setOpen(v => !v)
        }}
        style={{
          width: '32px',
          height: '32px',
          background: open ? 'rgba(244,63,94,0.12)' : 'var(--s3)',
          border: `1px solid ${open ? 'rgba(244,63,94,0.22)' : 'var(--glass)'}`,
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '15px',
          color: open ? 'var(--rose)' : 'var(--t2)',
          position: 'relative',
          transition: 'all 0.15s',
        }}
        title="Notifications"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            minWidth: '16px',
            height: '16px',
            borderRadius: '8px',
            background: 'var(--rose)',
            color: '#fff',
            fontSize: '9px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            boxShadow: '0 0 6px rgba(244,63,94,0.5)',
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel — rendered via portal to escape stacking contexts */}
      {open && createPortal(
        <div ref={dropdownRef} style={{
          position: 'fixed',
          top: dropdownPos.top,
          ...(dropdownPos.isMobile
            ? { left: '12px', right: '12px', width: 'auto' }
            : { right: dropdownPos.right, width: '340px' }),
          maxHeight: 'calc(100dvh - ' + (dropdownPos.top + 12) + 'px)',
          background: 'var(--s2)',
          border: '1px solid var(--glass)',
          borderRadius: '16px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
          zIndex: 9999,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px 12px',
            borderBottom: '1px solid var(--glass)',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)' }}>
              Notifications {unreadCount > 0 && (
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--rose)', marginLeft: '4px' }}>
                  ({unreadCount} new)
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  fontSize: '11px', fontWeight: 600, color: 'var(--rose-soft)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔔</div>
                <div style={{ fontSize: '13px', color: 'var(--t3)' }}>No notifications yet</div>
              </div>
            ) : (
              notifications.map(notif => (
                <button
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    width: '100%', padding: '12px 16px',
                    background: notif.read ? 'transparent' : 'rgba(244,63,94,0.05)',
                    border: 'none',
                    borderBottom: '1px solid var(--glass)',
                    cursor: (notif.link_type && notif.link_id) ? 'pointer' : 'default',
                    textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (notif.link_type) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = notif.read ? 'transparent' : 'rgba(244,63,94,0.05)' }}
                >
                  {/* Unread dot */}
                  <div style={{ width: '8px', flexShrink: 0, paddingTop: '4px', display: 'flex', justifyContent: 'center' }}>
                    {!notif.read && (
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--rose)', boxShadow: '0 0 6px var(--rose)' }} />
                    )}
                  </div>
                  {/* Icon */}
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    background: 'var(--s3)', border: '1px solid var(--glass)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', flexShrink: 0,
                  }}>
                    {TYPE_ICON[notif.type] || '🔔'}
                  </div>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '12px', fontWeight: notif.read ? 500 : 700,
                      color: notif.read ? 'var(--t2)' : 'var(--t1)',
                      marginBottom: '2px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {notif.title}
                    </div>
                    {notif.body && (
                      <div style={{
                        fontSize: '11px', color: 'var(--t3)',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        lineHeight: '1.4',
                      }}>
                        {notif.body}
                      </div>
                    )}
                    <div style={{ fontSize: '10px', color: 'var(--t4)', marginTop: '4px' }}>
                      {timeAgo(notif.created_at)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
