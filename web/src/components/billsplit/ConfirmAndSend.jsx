import { useState } from 'react'
import { billSplitApi } from '../../api/billSplit'
import Card from '../ui/Card'
import Button from '../ui/Button'

function computeShares(items, tax, tip, attendees, payerId) {
  const count = attendees.length
  if (!count) return []
  const taxPer = Math.round((tax / count) * 100) / 100
  const tipPer = Math.round((tip / count) * 100) / 100
  const unassignedTotal = items
    .filter(i => !i.assigned_to?.length)
    .reduce((s, i) => s + parseFloat(i.price || 0), 0)
  const unassignedPer = Math.round((unassignedTotal / count) * 100) / 100
  return attendees.map((a, idx) => {
    const isLast = idx === count - 1
    const assigned = items
      .filter(i => i.assigned_to?.includes(a.user_id))
      .reduce((s, i) => s + parseFloat(i.price || 0), 0)
    const itemsSub = assigned + (isLast ? unassignedTotal - unassignedPer * (count - 1) : unassignedPer)
    const tShare = isLast ? tax - taxPer * (count - 1) : taxPer
    const tpShare = isLast ? tip - tipPer * (count - 1) : tipPer
    return {
      user_id: a.user_id,
      full_name: a.full_name || a.username || 'Member',
      items_subtotal: Math.round(itemsSub * 100) / 100,
      tax_share: Math.round(tShare * 100) / 100,
      tip_share: Math.round(tpShare * 100) / 100,
      total_owed: Math.round((itemsSub + tShare + tpShare) * 100) / 100,
      is_payer: a.user_id === payerId,
    }
  })
}

export default function ConfirmAndSend({
  event,
  items,
  tax,
  tip,
  attendees,
  guests = [],
  currentUser,
  paymentNote,
  onPaymentNoteChange,
  onBack,
  onComplete,
  claimMode = false,
  onClaimStarted,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const payerId = currentUser?.id
  const guestIds = new Set((guests || []).map(g => g.user_id))

  // Compute shares for all participants (attendees + guests)
  const allParticipants = [...attendees, ...(guests || [])]
  const allShares = computeShares(items, parseFloat(tax || 0), parseFloat(tip || 0), allParticipants, payerId)
  const regularShares = allShares.filter(s => s.user_id >= 0)
  const guestShares = allShares.filter(s => s.user_id < 0)
  const grandTotal = allShares.reduce((s, sh) => s + sh.total_owed, 0)
  const nonPayers = regularShares.filter(s => !s.is_payer)

  const handleSend = async () => {
    setLoading(true)
    setError(null)
    try {
      // Remap guest IDs → payer so backend treats guest items as payer-fronted
      const remappedItems = items.map(i => ({
        name: i.name,
        price: parseFloat(i.price || 0),
        assigned_to: (i.assigned_to || []).map(uid => guestIds.has(uid) ? payerId : uid),
      }))

      const result = await billSplitApi.create({
        event_id: event.id,
        items: remappedItems,
        tax_amount: parseFloat(tax || 0),
        tip_amount: parseFloat(tip || 0),
        payment_note: paymentNote,
        attending_user_ids: attendees.map(a => a.user_id),
      })
      if (claimMode && onClaimStarted) {
        const claimResp = await billSplitApi.startClaiming(result.id)
        onClaimStarted(result, claimResp.claim_url)
      } else {
        onComplete(result)
      }
    } catch (e) {
      setError('Failed to send bill split. Please try again.')
      setLoading(false)
    }
  }

  const handleCopySummary = () => {
    const lines = [
      `Bill Split — ${event.title || 'Event'}`,
      `Total: $${grandTotal.toFixed(2)}`,
      '',
      ...regularShares.map(s =>
        `${s.full_name}${s.is_payer ? ' (paid)' : ''}: $${s.total_owed.toFixed(2)}`
      ),
      ...(guestShares.length ? ['', 'Guests (cash):',
        ...guestShares.map(s => `  ${s.full_name}: $${s.total_owed.toFixed(2)}`)] : []),
    ]
    if (paymentNote) {
      lines.push('', `Payment note: ${paymentNote}`)
    }
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const inputStyle = {
    background: 'var(--s3)',
    border: '1px solid var(--glass)',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '13px',
    color: 'var(--t1)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <Card>
      <Card.Header title="Confirm & Send" />
      <Card.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Shares preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>
              Breakdown
            </div>
            {regularShares.map(share => (
              <div
                key={share.user_id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: share.is_payer ? 'rgba(34,211,160,0.06)' : 'var(--s2)',
                  border: share.is_payer ? '1px solid rgba(34,211,160,0.15)' : '1px solid var(--glass)',
                  borderRadius: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--t1)', fontWeight: share.is_payer ? 600 : 400 }}>
                    {share.full_name}
                  </span>
                  {share.is_payer && <span style={{ fontSize: '11px', fontWeight: 700, color: '#22d3a0' }}>you · paid</span>}
                </div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: share.is_payer ? '#22d3a0' : 'var(--t1)' }}>
                  ${share.total_owed.toFixed(2)}
                </span>
              </div>
            ))}

            {/* Guest shares */}
            {guestShares.length > 0 && (
              <>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '4px' }}>
                  Guests (collect cash)
                </div>
                {guestShares.map(share => (
                  <div
                    key={share.user_id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
                      borderRadius: '10px',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '13px', color: 'var(--t1)' }}>👤 {share.full_name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--t3)', marginLeft: '6px' }}>you front this</span>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#f59e0b' }}>
                      ${share.total_owed.toFixed(2)}
                    </span>
                  </div>
                ))}
              </>
            )}

            {/* Grand total row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderTop: '1px solid var(--glass)',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t1)' }}>Grand Total</span>
              <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--rose-soft)', letterSpacing: '-0.5px' }}>
                ${grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment note */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: '6px' }}>
              Payment note (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Venmo @yourname, PayPal me.you@email.com"
              value={paymentNote}
              style={inputStyle}
              onChange={e => onPaymentNoteChange(e.target.value)}
              onFocus={e => e.target.style.borderColor = 'var(--rose-border)'}
              onBlur={e => e.target.style.borderColor = 'var(--glass)'}
            />
          </div>

          {/* Info banner */}
          <div
            style={{
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.18)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '13px',
              color: '#a5b4fc',
            }}
          >
            {claimMode
            ? `A claim link will be generated — share it with ${nonPayers.length} member${nonPayers.length !== 1 ? 's' : ''} to let them tap what they ordered.`
            : `${nonPayers.length} email${nonPayers.length !== 1 ? 's' : ''} will be sent with itemized breakdowns and one-tap Mark as Paid links.`
          }
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                borderRadius: '10px',
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.15)',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#f87171',
              }}
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <Button variant="ghost" onClick={onBack} disabled={loading}>← Back</Button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" onClick={handleCopySummary} disabled={loading}>
                {copied ? '✓ Copied!' : 'Copy summary'}
              </Button>
              <Button variant="primary" onClick={handleSend} loading={loading}>
                {claimMode ? 'Generate Claim Link' : 'Send Bill Splits'}
              </Button>
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}
