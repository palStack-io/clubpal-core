import { useState, useEffect, useCallback } from 'react'
import { billSplitApi } from '../../api/billSplit'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'

export default function BillSplitStatusCard({ event, currentUser, onOpenModal }) {
  const [splits, setSplits] = useState(null)   // null = loading
  const [claimStatus, setClaimStatus] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [toast, setToast] = useState(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await billSplitApi.getByEvent(event.id)
      setSplits(Array.isArray(data) ? data : [])
    } catch {
      setSplits([])
    }
  }, [event.id])

  useEffect(() => { load() }, [load])

  const activeSplit = splits?.length > 0 ? splits[splits.length - 1] : null
  const isClaiming = activeSplit?.status === 'claiming'
  const isPayer = !!activeSplit && String(activeSplit.paid_by_user_id) === String(currentUser?.id)

  const fetchClaimStatus = useCallback(async () => {
    if (!activeSplit || !isClaiming || !isPayer) return
    try {
      const s = await billSplitApi.getClaimingStatus(activeSplit.id)
      setClaimStatus(s)
    } catch {}
  }, [activeSplit?.id, isClaiming, isPayer])

  useEffect(() => { fetchClaimStatus() }, [fetchClaimStatus])

  useEffect(() => {
    if (!isClaiming) return
    const iv = setInterval(() => { load(); fetchClaimStatus() }, 10_000)
    return () => clearInterval(iv)
  }, [isClaiming, load, fetchClaimStatus])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/claim/${activeSplit?.claim_token}`
    navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCancel = async () => {
    if (!activeSplit) return
    setCancelling(true)
    try {
      await billSplitApi.cancelClaiming(activeSplit.id)
      setShowCancelConfirm(false)
      setClaimStatus(null)
      await load()
      showToast("Claiming cancelled — start a new split whenever you're ready.")
    } catch (e) {
      showToast(e?.response?.data?.detail || 'Failed to cancel. Try again.')
    } finally {
      setCancelling(false)
    }
  }

  const handleFinalize = async () => {
    if (!activeSplit) return
    setFinalizing(true)
    try {
      await billSplitApi.finalizeClaims(activeSplit.id)
      setClaimStatus(null)
      await load()
      showToast('Split finalized! Members have been notified.')
    } catch (e) {
      showToast(e?.response?.data?.detail || 'Failed to finalize. Try again.')
    } finally {
      setFinalizing(false)
    }
  }

  if (splits === null) return null

  // ── No split yet ─────────────────────────────────────────────────────────────
  if (!activeSplit) {
    return (
      <Card>
        <Card.Body>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', margin: 0 }}>Split the Bill</h3>
              <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4, marginBottom: 0 }}>Scan a receipt and split with your group</p>
            </div>
            <Button variant="primary" onClick={onOpenModal}>Split Bill 💳</Button>
          </div>
        </Card.Body>
      </Card>
    )
  }

  // ── Non-payer in claiming state ───────────────────────────────────────────────
  if (isClaiming && !isPayer) {
    const token = activeSplit.claim_token
    return (
      <Card>
        <Card.Body>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>💸</div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>Time to pick your items</h3>
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 16, lineHeight: 1.5 }}>
              <strong>{activeSplit.paid_by_name}</strong> split the bill — claim what you ordered.
            </p>
            {token && (
              <Button variant="primary" onClick={() => { window.location.href = `/claim/${token}` }}>
                Claim My Items →
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>
    )
  }

  // ── Payer in claiming state ───────────────────────────────────────────────────
  if (isClaiming && isPayer) {
    const submitted = claimStatus?.submitted_count ?? 0
    const total = claimStatus?.total_members ?? 0
    const pct = total > 0 ? Math.round((submitted / total) * 100) : 0
    const allDone = total > 0 && submitted >= total
    const claimUrl = `${window.location.origin}/claim/${activeSplit.claim_token}`

    return (
      <Card>
        <Card.Header>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, color: 'var(--t1)' }}>Bill Split — Claiming</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--rose)' }}>{submitted}/{total} submitted</span>
          </div>
        </Card.Header>
        <Card.Body>
          {/* Progress bar */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ height: 6, background: 'var(--s3)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #fb7185, #f43f5e)', borderRadius: 3, transition: 'width 0.4s' }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--t3)', margin: 0 }}>
              {allDone
                ? 'Everyone submitted! Finalize to compute shares.'
                : `${total - submitted} member${total - submitted !== 1 ? 's' : ''} still pending`}
            </p>
          </div>

          {/* Share link */}
          <div style={{ background: 'var(--s3)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{claimUrl}</span>
            <button
              onClick={handleCopyLink}
              style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: copied ? 'var(--green)' : 'var(--rose)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          {/* Member list */}
          {claimStatus?.members && (
            <div style={{ marginBottom: 16 }}>
              {claimStatus.members.map(m => (
                <div
                  key={m.user_id ?? m.full_name}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--sidebar-border)' }}
                >
                  <Avatar user={{ full_name: m.full_name, avatar_url: m.avatar_url }} size="sm" />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{m.full_name}</span>
                  {m.is_guest && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.1)', borderRadius: 4, padding: '2px 6px' }}>
                      GUEST
                    </span>
                  )}
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
          )}

          {/* Finalize */}
          <Button
            variant="primary"
            onClick={handleFinalize}
            disabled={finalizing || cancelling}
            style={{ width: '100%' }}
          >
            {finalizing ? 'Finalizing…' : allDone ? '✓ Finalize Split' : 'Finalize Now'}
          </Button>
          {!allDone && (
            <p style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', marginTop: 6, marginBottom: 0 }}>
              You can finalize early — pending members will share remaining items equally.
            </p>
          )}

          {/* Cancel claiming */}
          {showCancelConfirm ? (
            <div style={{ marginTop: 12, background: 'var(--s3)', borderRadius: 12, padding: '14px', border: '1px solid var(--rose-border)' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', margin: '0 0 4px' }}>Cancel claiming?</p>
              <p style={{ fontSize: 12, color: 'var(--t3)', margin: '0 0 12px', lineHeight: 1.4 }}>
                All submitted claims will be wiped and the link invalidated. You can start a fresh split after.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'var(--s4)', border: '1px solid var(--glass)', color: 'var(--t2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Keep Waiting
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'var(--rose)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: cancelling ? 0.7 : 1 }}
                >
                  {cancelling ? 'Cancelling…' : 'Yes, Cancel'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCancelConfirm(true)}
              disabled={finalizing || cancelling}
              style={{ display: 'block', width: '100%', marginTop: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--t3)', padding: '6px 0' }}
            >
              Cancel Claiming
            </button>
          )}

          {toast && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--s3)', borderRadius: 8, fontSize: 13, color: 'var(--t1)', fontWeight: 600, textAlign: 'center' }}>
              {toast}
            </div>
          )}
        </Card.Body>
      </Card>
    )
  }

  // ── Settled / sent state ──────────────────────────────────────────────────────
  const nonPayerShares = activeSplit.shares?.filter(s => s.user_id !== activeSplit.paid_by_user_id) || []
  const paidCount = nonPayerShares.filter(s => s.paid).length
  const allPaid = nonPayerShares.length > 0 && paidCount === nonPayerShares.length
  const totalAmount = activeSplit.total_amount ?? 0

  return (
    <Card>
      <Card.Header>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, color: 'var(--t1)' }}>
            {allPaid ? '✅ Bill Split — Settled' : '💳 Bill Split'}
          </span>
          {totalAmount > 0 && (
            <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--rose)' }}>
              ${totalAmount.toFixed(2)}
            </span>
          )}
        </div>
      </Card.Header>
      <Card.Body>
        {nonPayerShares.length > 0 && (
          <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 0, marginBottom: 14 }}>
            {allPaid ? 'Everyone has paid.' : `${paidCount} of ${nonPayerShares.length} member${nonPayerShares.length !== 1 ? 's' : ''} paid`}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button variant="ghost" onClick={onOpenModal} style={{ width: '100%' }}>
            View Split Details
          </Button>
          {isPayer && (
            <Button variant="subtle" onClick={onOpenModal} style={{ width: '100%', fontSize: 13 }}>
              + Start Another Split
            </Button>
          )}
        </div>
        {toast && (
          <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--s3)', borderRadius: 8, fontSize: 13, color: 'var(--t1)', fontWeight: 600, textAlign: 'center' }}>
            {toast}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
