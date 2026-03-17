import { useState, useEffect, useCallback } from 'react'
import { billSplitApi } from '../../api/billSplit'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import Card from '../ui/Card'

export default function ClaimingStatus({ splitId, claimUrl, currentUser, onFinalize }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [finalizing, setFinalizing] = useState(false)

  const refresh = useCallback(() => {
    billSplitApi.getClaimingStatus(splitId)
      .then(setStatus)
      .finally(() => setLoading(false))
  }, [splitId])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 8000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(claimUrl)
      .catch(() => {})
  }

  const handleFinalize = async () => {
    setFinalizing(true)
    try {
      const result = await billSplitApi.finalizeClaims(splitId)
      onFinalize(result)
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to finalize')
    } finally {
      setFinalizing(false)
    }
  }

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="animate-spin h-6 w-6 border-2 border-rose-400 border-t-transparent rounded-full" />
    </div>
  )

  const pct = status ? Math.round((status.submitted_count / status.total_members) * 100) : 0

  return (
    <Card>
      <Card.Body>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', margin: 0 }}>
              Waiting for members to claim items
            </h3>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--rose)' }}>
              {status?.submitted_count}/{status?.total_members}
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ height: 6, background: 'var(--s3)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #fb7185, #f43f5e)', borderRadius: 3, transition: 'width 0.4s' }} />
          </div>
        </div>

        {/* Share link */}
        <div style={{ background: 'var(--s2)', border: '1px solid var(--sidebar-border)', borderRadius: 10, padding: '10px 12px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, fontSize: 12, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{claimUrl}</span>
          <button
            onClick={handleCopyLink}
            style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--rose)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
          >
            Copy
          </button>
        </div>

        {/* Members list */}
        <div style={{ marginBottom: 16 }}>
          {status?.members.map(m => (
            <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--sidebar-border)' }}>
              <Avatar user={{ full_name: m.full_name, username: m.username, avatar_url: m.avatar_url }} size="sm" />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{m.full_name}</span>
              {m.submitted ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', background: 'rgba(34,211,160,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                  ✓ {m.claimed_items.length} items
                </span>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--t3)' }}>Pending…</span>
              )}
            </div>
          ))}
        </div>

        <Button
          variant="primary"
          onClick={handleFinalize}
          disabled={finalizing}
          style={{ width: '100%' }}
        >
          {finalizing ? 'Finalizing…' : 'Finalize & Send Bill Split'}
        </Button>
        <p style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', marginTop: 8 }}>
          You can finalize anytime — unsubmitted members will get equal shares.
        </p>
      </Card.Body>
    </Card>
  )
}
