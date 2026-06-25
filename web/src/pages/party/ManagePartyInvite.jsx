import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { eventsClient, groupsClient } from '../../api/client'
import AppShell from '../../components/shell/AppShell'

export default function ManagePartyInvite() {
  const { token }   = useParams()
  const navigate    = useNavigate()
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [allGroups, setAllGroups] = useState([])
  const [shareGroupId, setShareGroupId] = useState('')
  const [sharing, setSharing]     = useState(false)
  const [shareError, setShareError] = useState('')

  async function load() {
    try {
      const [inv, grps] = await Promise.all([
        eventsClient.get(`/party-invites/${token}/manage`),
        groupsClient.get('/groups'),
      ])
      setData(inv.data)
      setAllGroups(grps.data)
    } catch {
      setError('Could not load invite details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [token])

  async function shareToGroup() {
    if (!shareGroupId) return
    setSharing(true)
    setShareError('')
    try {
      await eventsClient.post(`/party-invites/${token}/share-to-group`, { group_id: Number(shareGroupId) })
      setShareGroupId('')
      await load()
    } catch (err) {
      setShareError(err?.response?.data?.detail || 'Failed to share')
    } finally {
      setSharing(false)
    }
  }

  if (loading) return <AppShell><div style={{ padding: 24, color: 'var(--t2)' }}>Loading…</div></AppShell>
  if (error)   return <AppShell><div style={{ padding: 24, color: 'var(--rose)' }}>{error}</div></AppShell>

  const attachedGroupIds  = new Set(data.groups.map(g => g.group_id))
  const availableToShare  = allGroups.filter(g => !attachedGroupIds.has(g.id))
  const inviteUrl         = `${window.location.origin}/p/${token}`
  const goingGuests       = data.guests?.filter(g => g.rsvp_status === 'going') || []
  const maybeGuests       = data.guests?.filter(g => g.rsvp_status === 'maybe') || []

  const card = { background: 'var(--s2)', borderRadius: 16, padding: 20, marginBottom: 16, border: '1px solid var(--s3)' }

  return (
    <AppShell>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ color: 'var(--t1)', margin: '0 0 4px', fontSize: '1.4rem' }}>Manage Invite</h1>
            <p style={{ color: 'var(--t2)', margin: 0, fontSize: '0.85rem' }}>{inviteUrl}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => navigator.clipboard.writeText(inviteUrl)}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--s3)', background: 'var(--s2)', color: 'var(--t1)', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Copy Link
            </button>
            <a
              href={`/p/${token}`}
              target="_blank"
              rel="noreferrer"
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--rose)', color: '#fff', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}
            >
              View
            </a>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Views',  value: data.view_count ?? 0 },
            { label: 'Going',  value: goingGuests.length },
            { label: 'Maybe',  value: maybeGuests.length },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'var(--s2)', borderRadius: 12, padding: '14px', textAlign: 'center', border: '1px solid var(--s3)' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--t1)' }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--t2)', marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Guest list */}
        <div style={card}>
          <h2 style={{ margin: '0 0 14px', fontSize: '1rem', color: 'var(--t1)' }}>
            External Guests ({data.guests?.length || 0})
          </h2>
          {(data.guests?.length || 0) === 0 && (
            <p style={{ color: 'var(--t3)', fontSize: '0.85rem', margin: 0 }}>No external RSVPs yet. Share your invite link!</p>
          )}
          {data.guests?.map(g => (
            <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--s3)' }}>
              <div>
                <span style={{ color: 'var(--t1)', fontWeight: 500 }}>{g.name}</span>
                <span style={{ color: 'var(--t3)', fontSize: '0.78rem', marginLeft: 8 }}>{g.email}</span>
              </div>
              <span style={{
                fontSize: '0.78rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                background: g.rsvp_status === 'going' ? 'rgba(34,211,160,0.12)' : g.rsvp_status === 'maybe' ? 'rgba(245,158,11,0.12)' : 'var(--s3)',
                color: g.rsvp_status === 'going' ? 'var(--green)' : g.rsvp_status === 'maybe' ? 'var(--amber)' : 'var(--t3)',
              }}>
                {g.rsvp_status === 'going' ? 'Going' : g.rsvp_status === 'maybe' ? 'Maybe' : "Can't make it"}
              </span>
            </div>
          ))}
        </div>

        {/* Bring list */}
        {(data.items?.length || 0) > 0 && (
          <div style={card}>
            <h2 style={{ margin: '0 0 14px', fontSize: '1rem', color: 'var(--t1)' }}>Bring List</h2>
            {data.items.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--s3)' }}>
                <span style={{ color: 'var(--t1)' }}>{item.emoji} {item.label}</span>
                <span style={{ color: item.claim_count >= item.max_claims ? 'var(--green)' : 'var(--t2)', fontSize: '0.82rem', fontWeight: 600 }}>
                  {item.claim_count}/{item.max_claims} claimed
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Share to another group */}
        {availableToShare.length > 0 && (
          <div style={card}>
            <h2 style={{ margin: '0 0 14px', fontSize: '1rem', color: 'var(--t1)' }}>Share to Another Club</h2>
            <div style={{ display: 'flex', gap: 10 }}>
              <select
                value={shareGroupId}
                onChange={e => setShareGroupId(e.target.value)}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--s3)', background: 'var(--s2)', color: 'var(--t1)' }}
              >
                <option value="">Select a club…</option>
                {availableToShare.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button
                onClick={shareToGroup}
                disabled={!shareGroupId || sharing}
                style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--rose)', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: (!shareGroupId || sharing) ? 0.5 : 1 }}
              >
                {sharing ? '…' : 'Share'}
              </button>
            </div>
            {shareError && <p style={{ color: 'var(--rose)', fontSize: '0.85rem', marginTop: 8 }}>{shareError}</p>}
          </div>
        )}

        <button
          onClick={() => navigate(-1)}
          style={{ color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}
        >
          ← Back
        </button>
      </div>
    </AppShell>
  )
}
