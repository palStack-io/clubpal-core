import { useState, useEffect } from 'react'
import Card from '../ui/Card'
import { eventsApi } from '../../api/events'

const RSVP_COLORS = { going: 'var(--green)', maybe: 'var(--amber)', not_going: 'var(--t3)', pending: 'var(--t3)' }
const RSVP_LABELS = { going: 'Going', maybe: 'Maybe', not_going: "Can't", pending: 'Pending' }

export default function PartyInviteAdminCard({ token }) {
  const [invite, setInvite]               = useState(null)
  const [memberInvites, setMemberInvites] = useState([])
  const [loading, setLoading]             = useState(true)
  const [copied, setCopied]               = useState(false)

  const publicUrl = `${window.location.origin}/p/${token}`

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const [inv, members] = await Promise.all([
          eventsApi.getPartyInviteManage(token),
          eventsApi.getMemberInvites(token),
        ])
        if (!alive) return
        setInvite(inv)
        setMemberInvites(Array.isArray(members) ? members : members?.members || [])
      } catch {
        // silently ignore
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [token])

  const copyUrl = () => {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading || !invite) return null

  const guests = invite.guests || []
  const goingCount    = guests.filter(g => g.status === 'going' || g.rsvp_status === 'going').length
  const maybeCount    = guests.filter(g => g.status === 'maybe' || g.rsvp_status === 'maybe').length
  const cantCount     = guests.filter(g => g.status === 'not_going' || g.rsvp_status === 'not_going').length
  const pendingCount  = guests.filter(g => {
    const status = g.status || g.rsvp_status
    return !status || status === 'pending'
  }).length

  return (
    <Card>
      <Card.Header>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, color: 'var(--t1)', fontSize: '14px' }}>
            Party Invite
          </span>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '12px', color: invite.accent_color || 'var(--rose)', fontWeight: 600, textDecoration: 'none' }}
          >
            View Page
          </a>
        </div>
      </Card.Header>
      <Card.Body>
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

        <div style={{ display: 'flex', gap: '8px', marginBottom: memberInvites.length ? '16px' : 0 }}>
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
