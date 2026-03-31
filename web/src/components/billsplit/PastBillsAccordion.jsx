import { useState } from 'react'
import Card from '../ui/Card'

function RoundDetail({ split }) {
  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Items */}
      {split.items.length > 0 && (
        <div style={{ background: 'var(--s3)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--glass)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Items</p>
          {split.items.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--t2)', padding: '2px 0' }}>
              <span>{item.name}</span>
              <span>${parseFloat(item.price).toFixed(2)}</span>
            </div>
          ))}
          {split.tax_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--t3)', padding: '2px 0' }}>
              <span>Tax</span><span>${parseFloat(split.tax_amount).toFixed(2)}</span>
            </div>
          )}
          {split.tip_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--t3)', padding: '2px 0' }}>
              <span>Tip</span><span>${parseFloat(split.tip_amount).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--t1)', borderTop: '1px solid var(--glass)', marginTop: 6, paddingTop: 6 }}>
            <span>Total</span><span>${parseFloat(split.total_amount).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Shares */}
      <div style={{ background: 'var(--s3)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--glass)' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Per Person</p>
        {split.shares.map(share => {
          const isThisPayer = share.user_id === split.paid_by_user_id
          return (
            <div key={share.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--glass)' }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 500 }}>{share.full_name}</span>
                {isThisPayer && <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 4 }}>paid</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>${parseFloat(share.total_owed).toFixed(2)}</span>
                {!isThisPayer && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: share.paid ? '#22d3a0' : '#f59e0b',
                    background: share.paid ? 'rgba(34,211,160,0.10)' : 'rgba(245,158,11,0.10)',
                    border: `1px solid ${share.paid ? 'rgba(34,211,160,0.20)' : 'rgba(245,158,11,0.20)'}`,
                    borderRadius: 6, padding: '2px 6px',
                  }}>
                    {share.paid ? '✓ Paid' : 'Pending'}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PastBillsAccordion({ splits }) {
  const [openIdx, setOpenIdx] = useState(null)

  // Show oldest first (round 1, 2, 3...)
  const ordered = [...splits].sort((a, b) => a.round_number - b.round_number)

  return (
    <Card>
      <Card.Header title="Past Bills" />
      <Card.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ordered.map((split, idx) => {
            const nonPayer = split.shares.filter(s => s.user_id !== split.paid_by_user_id)
            const paidCount = nonPayer.filter(s => s.paid).length
            const allPaid = nonPayer.length > 0 && paidCount === nonPayer.length
            const isOpen = openIdx === idx
            const roundLabel = split.label || `Round ${split.round_number}`
            const date = split.created_at ? new Date(split.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''

            return (
              <div key={split.id}>
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: isOpen ? 'var(--s3)' : 'var(--s2)',
                    border: '1px solid var(--glass)',
                    borderRadius: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{roundLabel}</span>
                    <span style={{ fontSize: 11, color: 'var(--t3)' }}>
                      {split.paid_by_name} · {date}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>
                      ${parseFloat(split.total_amount).toFixed(2)}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: allPaid ? '#22d3a0' : '#f59e0b',
                      background: allPaid ? 'rgba(34,211,160,0.10)' : 'rgba(245,158,11,0.10)',
                      border: `1px solid ${allPaid ? 'rgba(34,211,160,0.20)' : 'rgba(245,158,11,0.20)'}`,
                      borderRadius: 6, padding: '2px 7px',
                    }}>
                      {allPaid ? '✓ Settled' : `${paidCount}/${nonPayer.length} paid`}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--t3)' }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>
                {isOpen && <RoundDetail split={split} />}
              </div>
            )
          })}
        </div>
      </Card.Body>
    </Card>
  )
}
