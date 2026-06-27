import { useRef, useState } from 'react'
import { eventsApi } from '../../api/events'
import { gatewayClient } from '../../api/client'

const ACCENT_COLORS = ['#f43f5e', '#f59e0b', '#22d3a0', '#a855f7', '#6366f1']
const STYLES = ['glass', 'neon', 'minimal']

export default function PartyInviteControls({ token, invite, onInviteUpdated }) {
  const [saving, setSaving] = useState(false)
  const [inviteSearch, setInviteSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [emailInput, setEmailInput] = useState('')
  const [pendingInvitees, setPendingInvitees] = useState([])
  const [sendingInvites, setSendingInvites] = useState(false)
  const searchTimer = useRef(null)

  const accent = invite?.accent_color || '#f43f5e'

  const patch = async (fields) => {
    if (!token) return
    setSaving(true)
    try {
      const updated = await eventsApi.updatePartyInvite(token, fields)
      onInviteUpdated?.({ ...invite, ...updated })
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const searchUsers = (q) => {
    setInviteSearch(q)
    clearTimeout(searchTimer.current)
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await gatewayClient.get('/users/search', { params: { username: q } })
        setSearchResults(r.data || [])
      } catch {
        setSearchResults([])
      }
    }, 300)
  }

  const addUser = (u) => {
    if (pendingInvitees.some(p => p.type === 'user' && p.id === u.id)) return
    setPendingInvitees(prev => [...prev, { type: 'user', id: u.id, email: u.email || '', label: u.full_name || u.username }])
    setInviteSearch('')
    setSearchResults([])
  }

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase()
    if (!email || !email.includes('@')) return
    if (pendingInvitees.some(p => p.email === email)) return
    setPendingInvitees(prev => [...prev, { type: 'email', email, label: email }])
    setEmailInput('')
  }

  const sendInvites = async () => {
    if (!pendingInvitees.length || !token) return
    setSendingInvites(true)
    try {
      await eventsApi.inviteUsersToParty(token, {
        user_ids: pendingInvitees.filter(p => p.type === 'user').map(p => p.id),
        emails: pendingInvitees.filter(p => p.type === 'email').map(p => p.email),
      })
      setPendingInvitees([])
    } catch {
      // ignore
    } finally {
      setSendingInvites(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Vibe Color</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {ACCENT_COLORS.map(color => (
            <button
              key={color}
              type="button"
              aria-label={`Use ${color}`}
              onClick={() => patch({ accent_color: color })}
              style={{
                width: 28, height: 28, borderRadius: '50%', border: 'none',
                background: color, cursor: 'pointer',
                outline: accent === color ? `2px solid ${color}` : '2px solid transparent',
                outlineOffset: 3,
                opacity: saving ? 0.6 : 1,
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Style</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {STYLES.map(style => {
            const active = (invite?.style || 'glass') === style
            return (
              <button
                key={style}
                type="button"
                onClick={() => patch({ style })}
                style={{
                  padding: '7px 13px', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 700,
                  border: `1px solid ${active ? accent : 'var(--glass)'}`,
                  background: active ? `${accent}18` : 'transparent',
                  color: active ? accent : 'var(--t3)',
                  textTransform: 'capitalize',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {style}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--glass)', paddingTop: 14 }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Invite People</div>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <input
              value={inviteSearch}
              onChange={e => searchUsers(e.target.value)}
              placeholder="Search by username..."
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '10px', boxSizing: 'border-box',
                background: 'var(--s2)', border: '1px solid var(--glass)',
                color: 'var(--t1)', fontSize: '13px', outline: 'none',
              }}
            />
            {searchResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '10px',
                marginTop: 4, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {searchResults.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => addUser(u)}
                    style={{
                      width: '100%', padding: '9px 12px', border: 'none', background: 'none',
                      color: 'var(--t1)', fontSize: '13px', textAlign: 'left', cursor: 'pointer',
                    }}
                  >
                    {u.full_name || u.username}
                    <span style={{ marginLeft: 6, color: 'var(--t3)', fontSize: '12px' }}>@{u.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEmail()}
              placeholder="Or add by email..."
              style={{
                flex: 1, padding: '9px 12px', borderRadius: '10px',
                background: 'var(--s2)', border: '1px solid var(--glass)',
                color: 'var(--t1)', fontSize: '13px', outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={addEmail}
              style={{
                padding: '9px 13px', borderRadius: '10px', border: 'none',
                background: 'var(--s2)', color: 'var(--t2)', cursor: 'pointer',
                fontSize: '12px', fontWeight: 700,
              }}
            >
              Add
            </button>
          </div>

          {pendingInvitees.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {pendingInvitees.map((p, i) => (
                <span key={`${p.type}-${p.id || p.email}`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 9px', borderRadius: 999,
                  background: 'var(--s2)', border: '1px solid var(--glass)', color: 'var(--t2)',
                  fontSize: '12px', fontWeight: 700,
                }}>
                  {p.label}
                  <button
                    type="button"
                    onClick={() => setPendingInvitees(prev => prev.filter((_, idx) => idx !== i))}
                    style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontWeight: 900 }}
                  >
                    x
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={sendInvites}
                disabled={sendingInvites}
                style={{
                  padding: '5px 13px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  background: accent, color: '#fff', fontSize: '12px', fontWeight: 800,
                  opacity: sendingInvites ? 0.6 : 1,
                }}
              >
                {sendingInvites ? 'Sending...' : `Send ${pendingInvitees.length > 1 ? `${pendingInvitees.length} ` : ''}Invite${pendingInvitees.length === 1 ? '' : 's'}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
