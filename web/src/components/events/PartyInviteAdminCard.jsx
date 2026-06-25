import { useState, useEffect, useRef } from 'react'
import Card from '../ui/Card'
import { eventsApi } from '../../api/events'
import { gatewayClient } from '../../api/client'

const ACCENT_COLORS = [
  { value: '#f43f5e', label: 'Rose' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#22d3a0', label: 'Green' },
  { value: '#a855f7', label: 'Purple' },
  { value: '#6366f1', label: 'Blue' },
]

const STYLES = ['glass', 'neon', 'minimal']

const RSVP_COLORS = { going: 'var(--green)', maybe: 'var(--amber)', not_going: 'var(--t3)', pending: 'var(--t3)' }
const RSVP_LABELS = { going: 'Going', maybe: 'Maybe', not_going: "Can't", pending: 'Pending' }

export default function PartyInviteAdminCard({ token, eventId }) {
  const [invite, setInvite]               = useState(null)
  const [memberInvites, setMemberInvites] = useState([])
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [copied, setCopied]               = useState(false)

  // invite-more state
  const [inviteSearch, setInviteSearch]   = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [emailInput, setEmailInput]       = useState('')
  const [pendingInvitees, setPending]     = useState([])   // {type:'user'|'email', id?, email, label}
  const [sendingInvites, setSendingInvites] = useState(false)
  const searchTimer = useRef(null)

  const publicUrl = `${window.location.origin}/p/${token}`

  const load = async () => {
    try {
      const [inv, members] = await Promise.all([
        eventsApi.getPartyInviteManage(token),
        eventsApi.getMemberInvites(token),
      ])
      setInvite(inv)
      setMemberInvites(Array.isArray(members) ? members : members?.members || [])
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  const patch = async (fields) => {
    setSaving(true)
    try {
      const updated = await eventsApi.updatePartyInvite(token, fields)
      setInvite(prev => ({ ...prev, ...updated }))
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const copyUrl = () => {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const searchUsers = (q) => {
    clearTimeout(searchTimer.current)
    if (q.length < 2) { setSearchResults([]); return }
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await gatewayClient.get('/users/search', { params: { username: q } })
        setSearchResults(r.data || [])
      } catch { setSearchResults([]) }
    }, 300)
  }

  const addUser = (u) => {
    if (pendingInvitees.some(p => p.type === 'user' && p.id === u.id)) return
    setPending(prev => [...prev, { type: 'user', id: u.id, email: u.email || '', label: u.full_name || u.username }])
    setInviteSearch('')
    setSearchResults([])
  }

  const addEmail = () => {
    const e = emailInput.trim().toLowerCase()
    if (!e || !e.includes('@')) return
    if (pendingInvitees.some(p => p.email === e)) return
    setPending(prev => [...prev, { type: 'email', email: e, label: e }])
    setEmailInput('')
  }

  const sendInvites = async () => {
    if (!pendingInvitees.length) return
    setSendingInvites(true)
    try {
      await eventsApi.inviteUsersToParty(token, {
        user_ids: pendingInvitees.filter(p => p.type === 'user').map(p => p.id),
        emails:   pendingInvitees.filter(p => p.type === 'email').map(p => p.email),
      })
      setPending([])
      const members = await eventsApi.getMemberInvites(token)
      setMemberInvites(Array.isArray(members) ? members : members?.members || [])
    } catch {
      // ignore
    } finally {
      setSendingInvites(false)
    }
  }

  if (loading) return null
  if (!invite) return null

  const guests = invite.guests || []
  const goingCount    = guests.filter(g => g.status === 'going').length
  const maybeCount    = guests.filter(g => g.status === 'maybe').length
  const cantCount     = guests.filter(g => g.status === 'not_going').length
  const pendingCount  = guests.filter(g => !g.status || g.status === 'pending').length

  return (
    <Card>
      <Card.Header>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, color: 'var(--t1)', fontSize: '14px' }}>
            ✨ Party Invite
          </span>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '12px', color: invite.accent_color || 'var(--rose)', fontWeight: 600, textDecoration: 'none' }}
          >
            View Page →
          </a>
        </div>
      </Card.Header>
      <Card.Body>

        {/* Public URL */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <div style={{
            flex: 1, padding: '8px 12px', borderRadius: '10px',
            background: 'var(--s3)', border: '1px solid var(--glass)',
            fontSize: '12px', color: 'var(--t2)', overflow: 'hidden',
            whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          }}>
            {publicUrl}
          </div>
          <button
            onClick={copyUrl}
            style={{
              padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              background: copied ? 'var(--green)' : 'var(--s3)',
              color: copied ? '#fff' : 'var(--t2)',
              fontSize: '12px', fontWeight: 700, transition: 'all 0.15s', flexShrink: 0,
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* RSVP counts */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {[
            { label: 'Going',    count: goingCount,   color: 'var(--green)' },
            { label: 'Maybe',    count: maybeCount,   color: 'var(--amber)' },
            { label: "Can't",    count: cantCount,    color: 'var(--t3)' },
            { label: 'Pending',  count: pendingCount, color: 'var(--t3)' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{
              flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: '10px',
              background: 'var(--s3)', border: '1px solid var(--glass)',
            }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color }}>{count}</div>
              <div style={{ fontSize: '10px', color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Vibe color */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Vibe Color</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {ACCENT_COLORS.map(({ value }) => (
              <button
                key={value}
                onClick={() => patch({ accent_color: value })}
                style={{
                  width: '24px', height: '24px', borderRadius: '50%', border: 'none',
                  background: value, cursor: 'pointer', flexShrink: 0,
                  outline: (invite.accent_color || '#f43f5e') === value
                    ? `2px solid ${value}` : '2px solid transparent',
                  outlineOffset: '2px',
                  opacity: saving ? 0.6 : 1,
                }}
              />
            ))}
          </div>
        </div>

        {/* Style */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Style</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {STYLES.map(s => {
              const active = (invite.style || 'glass') === s
              return (
                <button
                  key={s}
                  onClick={() => patch({ style: s })}
                  style={{
                    padding: '5px 12px', borderRadius: '8px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 700,
                    border: `1px solid ${active ? (invite.accent_color || 'var(--rose)') : 'var(--glass)'}`,
                    background: active ? `${invite.accent_color || 'var(--rose)'}18` : 'transparent',
                    color: active ? (invite.accent_color || 'var(--rose)') : 'var(--t3)',
                    textTransform: 'capitalize',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--glass)', margin: '0 0 14px' }} />

        {/* Invite people */}
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Invite People</div>

        {/* User search */}
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <input
            value={inviteSearch}
            onChange={e => { setInviteSearch(e.target.value); searchUsers(e.target.value) }}
            placeholder="Search by username…"
            style={{
              width: '100%', padding: '8px 12px', borderRadius: '10px', boxSizing: 'border-box',
              background: 'var(--s3)', border: '1px solid var(--glass)',
              color: 'var(--t1)', fontSize: '13px', outline: 'none',
            }}
          />
          {searchResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
              background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '10px',
              marginTop: '4px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {searchResults.map(u => (
                <button
                  key={u.id}
                  onClick={() => addUser(u)}
                  style={{
                    width: '100%', padding: '9px 12px', border: 'none', background: 'none',
                    color: 'var(--t1)', fontSize: '13px', textAlign: 'left', cursor: 'pointer',
                    display: 'block',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--s3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  {u.full_name || u.username}
                  <span style={{ marginLeft: '6px', color: 'var(--t3)', fontSize: '12px' }}>@{u.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Email input */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
          <input
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addEmail()}
            placeholder="Or add by email…"
            style={{
              flex: 1, padding: '8px 12px', borderRadius: '10px',
              background: 'var(--s3)', border: '1px solid var(--glass)',
              color: 'var(--t1)', fontSize: '13px', outline: 'none',
            }}
          />
          <button
            onClick={addEmail}
            style={{
              padding: '8px 12px', borderRadius: '10px', border: 'none',
              background: 'var(--s3)', color: 'var(--t2)', cursor: 'pointer',
              fontSize: '12px', fontWeight: 700, flexShrink: 0,
            }}
          >
            Add
          </button>
        </div>

        {/* Pending to send */}
        {pendingInvitees.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {pendingInvitees.map((p, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 8px 4px 10px', borderRadius: '20px',
                background: 'var(--s3)', border: '1px solid var(--glass)', fontSize: '12px', color: 'var(--t2)',
              }}>
                {p.label}
                <button
                  onClick={() => setPending(prev => prev.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', padding: '0 2px', fontSize: '14px', lineHeight: 1 }}
                >×</button>
              </div>
            ))}
            <button
              onClick={sendInvites}
              disabled={sendingInvites}
              style={{
                padding: '4px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                background: invite.accent_color || 'var(--rose)', color: '#fff',
                fontSize: '12px', fontWeight: 700, opacity: sendingInvites ? 0.6 : 1,
              }}
            >
              {sendingInvites ? 'Sending…' : `Send ${pendingInvitees.length > 1 ? pendingInvitees.length + ' ' : ''}Invite${pendingInvitees.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {/* Already invited */}
        {memberInvites.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Sent</div>
            {memberInvites.map((m, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 0',
                borderBottom: i < memberInvites.length - 1 ? '1px solid var(--glass)' : 'none',
              }}>
                <span style={{ fontSize: '13px', color: 'var(--t2)' }}>
                  {m.full_name || m.username || m.email}
                </span>
                <span style={{
                  fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                  color: RSVP_COLORS[m.rsvp_status] || 'var(--t3)',
                }}>
                  {RSVP_LABELS[m.rsvp_status] || 'Pending'}
                </span>
              </div>
            ))}
          </div>
        )}

      </Card.Body>
    </Card>
  )
}
