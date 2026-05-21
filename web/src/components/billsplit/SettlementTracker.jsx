import { useState } from 'react'
import { billSplitApi } from '../../api/billSplit'
import Card from '../ui/Card'
import Button from '../ui/Button'

export default function SettlementTracker({ split, currentUser, onRefresh, onAddAnother, onCancel }) {
  const [remindSent, setRemindSent] = useState(false)
  const [remindLoading, setRemindLoading] = useState(false)
  const [markingPaid, setMarkingPaid] = useState(null) // userId being marked
  const [cancelLoading, setCancelLoading] = useState(false)

  const shares = split.shares || []
  const payerShare = shares.find(s => s.user_id === split.paid_by_user_id)
  const isPayer = String(split.paid_by_user_id) === String(currentUser?.id)
  const nonPayerShares = shares.filter(s => s.user_id !== split.paid_by_user_id)
  const paidShares = nonPayerShares.filter(s => s.paid)
  const allSettled = nonPayerShares.length > 0 && paidShares.length === nonPayerShares.length

  const totalOutstanding = nonPayerShares.reduce((s, sh) => s + (sh.paid ? 0 : sh.total_owed), 0)
  const totalCollected = nonPayerShares.reduce((s, sh) => s + (sh.paid ? sh.total_owed : 0), 0)
  const grandTotal = nonPayerShares.reduce((s, sh) => s + sh.total_owed, 0)

  const handleMarkPaid = async (userId, name) => {
    if (!window.confirm(`Mark ${name} as paid?`)) return
    setMarkingPaid(userId)
    try {
      await billSplitApi.markPaidManual(split.id, userId)
      await onRefresh()
    } catch {
      // ignore
    } finally {
      setMarkingPaid(null)
    }
  }

  const handleResendReminders = async () => {
    setRemindLoading(true)
    try {
      await billSplitApi.resendReminders(split.id)
      setRemindSent(true)
      setTimeout(() => setRemindSent(false), 3000)
    } catch {
      // ignore
    } finally {
      setRemindLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!window.confirm('Cancel this split? This will remove all shares and let you start over.')) return
    setCancelLoading(true)
    try {
      await billSplitApi.cancelSplit(split.id)
      if (onCancel) onCancel()
    } catch {
      // ignore
    } finally {
      setCancelLoading(false)
    }
  }

  // All settled celebration
  if (allSettled) {
    return (
      <Card>
        <Card.Body>
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>✅</div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)', margin: '0 0 6px' }}>
              All settled!
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--t2)', margin: 0 }}>
              Everyone has paid their share.
              {split.label ? ` (${split.label})` : split.round_number > 1 ? ` Round ${split.round_number}` : ' Nice!'}
            </p>
            {split.payment_note && (
              <p style={{ fontSize: '12px', color: 'var(--t3)', marginTop: '8px' }}>
                {split.payment_note}
              </p>
            )}
            {isPayer && onAddAnother && (
              <button
                onClick={onAddAnother}
                style={{
                  marginTop: 16,
                  padding: '8px 20px',
                  borderRadius: 10,
                  border: '1px solid var(--glass)',
                  background: 'var(--s3)',
                  color: 'var(--t2)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Add Another Split
              </button>
            )}
          </div>
        </Card.Body>
      </Card>
    )
  }

  return (
    <Card>
      <Card.Header
        title={
          split.label
            ? `Bill Split — ${split.label}`
            : split.round_number > 1
            ? `Bill Split — Round ${split.round_number}`
            : 'Bill Split'
        }
        action={
          isPayer && nonPayerShares.length > 0 ? (
            <Button
              variant="subtle"
              size="sm"
              loading={remindLoading}
              onClick={handleResendReminders}
            >
              {remindSent ? '✓ Sent!' : 'Resend reminders'}
            </Button>
          ) : null
        }
      />
      <Card.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Summary bar */}
          <div
            style={{
              background: 'var(--s2)',
              borderRadius: '12px',
              padding: '14px',
              border: '1px solid var(--glass)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '8px' }}>
              <span style={{ fontSize: '22px', fontWeight: 900, color: '#22d3a0', letterSpacing: '-0.5px' }}>
                ${totalCollected.toFixed(2)}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--t3)' }}>
                collected of ${grandTotal.toFixed(2)}
              </span>
            </div>
            {/* Progress bar */}
            <div style={{ background: 'var(--s4)', borderRadius: '100px', height: '6px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: '100px',
                  background: 'linear-gradient(90deg, #22d3a0, #34d399)',
                  width: grandTotal > 0 ? `${Math.round((totalCollected / grandTotal) * 100)}%` : '0%',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
            {totalOutstanding > 0 && (
              <p style={{ fontSize: '12px', color: 'var(--t3)', margin: '6px 0 0' }}>
                ${totalOutstanding.toFixed(2)} outstanding
              </p>
            )}
          </div>

          {/* Payment note */}
          {split.payment_note && (
            <div
              style={{
                background: 'var(--s3)',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '13px',
                color: 'var(--t2)',
                border: '1px solid var(--glass)',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--t1)', marginRight: '6px' }}>Pay to:</span>
              {split.payment_note}
            </div>
          )}

          {/* Member list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {nonPayerShares.map(share => {
              const isBeingMarked = markingPaid === share.user_id
              return (
                <div
                  key={share.user_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'var(--s2)',
                    border: '1px solid var(--glass)',
                    borderRadius: '10px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--t1)', fontWeight: 500 }}>
                      {share.full_name || share.username || 'Member'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--t3)', marginTop: '1px' }}>
                      ${(share.total_owed || 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {share.paid ? (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#22d3a0',
                          background: 'rgba(34,211,160,0.10)',
                          border: '1px solid rgba(34,211,160,0.20)',
                          borderRadius: '100px',
                          padding: '3px 8px',
                        }}
                      >
                        ✓ Paid
                      </span>
                    ) : (
                      <>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#f59e0b',
                            background: 'rgba(245,158,11,0.10)',
                            border: '1px solid rgba(245,158,11,0.20)',
                            borderRadius: '100px',
                            padding: '3px 8px',
                          }}
                        >
                          Pending
                        </span>
                        {isPayer && (
                          <Button
                            variant="subtle"
                            size="sm"
                            loading={isBeingMarked}
                            onClick={() => handleMarkPaid(share.user_id, share.full_name || 'Member')}
                          >
                            Mark paid
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Payer row */}
            {payerShare && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'rgba(34,211,160,0.04)',
                  border: '1px solid rgba(34,211,160,0.12)',
                  borderRadius: '10px',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--t1)', fontWeight: 600 }}>
                    {payerShare.full_name || 'You'}
                    {isPayer && <span style={{ fontSize: '11px', color: 'var(--t3)', marginLeft: '4px' }}>(you)</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--t3)', marginTop: '1px' }}>
                    Paid the bill
                  </div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#22d3a0' }}>Payer</span>
              </div>
            )}
          </div>

          {isPayer && onCancel && (
            <div style={{ borderTop: '1px solid var(--glass)', paddingTop: '12px' }}>
              <button
                onClick={handleCancel}
                disabled={cancelLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: cancelLoading ? 'not-allowed' : 'pointer',
                  color: 'var(--t3)',
                  fontSize: '12px',
                  padding: 0,
                  opacity: cancelLoading ? 0.5 : 1,
                }}
              >
                {cancelLoading ? 'Canceling…' : 'Cancel split'}
              </button>
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  )
}
