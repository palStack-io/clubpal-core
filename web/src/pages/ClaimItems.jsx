import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { billSplitApi } from '../api/billSplit'
import Button from '../components/ui/Button'

export default function ClaimItems() {
  const { token } = useParams()
  const { user, isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      navigate(`/login?redirect=/claim/${token}`)
      return
    }
    billSplitApi.getClaimView(token)
      .then(d => {
        setData(d)
        setSelected(new Set(d.my_claimed_items || []))
        if (d.already_submitted) setDone(true)
      })
      .catch(e => setError(e.response?.data?.detail || 'Link not found or expired'))
      .finally(() => setLoading(false))
  }, [token, isAuthenticated, authLoading])

  const toggle = (itemId) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(itemId) ? next.delete(itemId) : next.add(itemId)
      return next
    })
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await billSplitApi.submitClaim(token, [...selected])
      setDone(true)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  const myTotal = data?.items
    ?.filter(it => selected.has(it.id))
    .reduce((sum, it) => sum + it.price, 0) || 0

  if (authLoading || loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #fda4af', borderTopColor: '#f43f5e', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)', padding: 24 }}>
      <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderRadius: 24, padding: '40px 36px', maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>Link not available</h2>
        <p style={{ color: '#6b7280', fontSize: 15 }}>{error}</p>
        <div style={{ marginTop: 24 }}>
          <a href="/dashboard" style={{ display: 'inline-block', background: 'linear-gradient(135deg, #fb7185, #f43f5e)', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 24px', borderRadius: 12, textDecoration: 'none' }}>Open clubPal</a>
        </div>
      </div>
    </div>
  )

  if (done) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)', padding: 24 }}>
      <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderRadius: 24, padding: '40px 36px', maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ background: 'linear-gradient(135deg, #fb7185, #f43f5e)', borderRadius: 14, padding: '12px 20px', marginBottom: 28, display: 'inline-block' }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px' }}>clubPal</span>
        </div>
        <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 8px', letterSpacing: '-0.4px' }}>All set!</h2>
        <p style={{ color: '#6b7280', fontSize: 15, margin: '0 0 20px' }}>
          Your items have been submitted for <strong style={{ color: '#111827' }}>{data?.event_name}</strong>.
          <br />The organizer will finalize the bill split.
        </p>
        {selected.size > 0 && (
          <div style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.18)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#f43f5e', fontWeight: 700, marginBottom: 20 }}>
            Your share: ${myTotal.toFixed(2)} + tax/tip
          </div>
        )}
        <a href="/dashboard" style={{ display: 'inline-block', background: 'linear-gradient(135deg, #fb7185, #f43f5e)', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 24px', borderRadius: 12, textDecoration: 'none' }}>Open clubPal</a>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)', padding: '24px 16px', fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ background: 'linear-gradient(135deg, #fb7185, #f43f5e)', borderRadius: 14, padding: '12px 20px', marginBottom: 16, display: 'inline-block' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>clubPal</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 6px', letterSpacing: '-0.4px' }}>
            Tap what you ordered
          </h1>
          <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
            {data?.event_name} · Paid by {data?.payer_name}
          </p>
        </div>

        {/* Items */}
        <div style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 24px rgba(0,0,0,0.07)', overflow: 'hidden', marginBottom: 16 }}>
          {data?.items.map((item, i) => {
            const active = selected.has(item.id)
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  background: active ? 'rgba(244,63,94,0.06)' : 'transparent',
                  border: 'none',
                  borderBottom: i < data.items.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s',
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  border: active ? '2px solid #f43f5e' : '2px solid #e5e7eb',
                  background: active ? '#f43f5e' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.12s',
                }}>
                  {active && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: active ? '#111827' : '#374151' }}>{item.name}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: active ? '#f43f5e' : '#6b7280' }}>${item.price.toFixed(2)}</span>
              </button>
            )
          })}
        </div>

        {/* Running total */}
        {selected.size > 0 && (
          <div style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>{selected.size} item{selected.size !== 1 ? 's' : ''} selected</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#f43f5e' }}>${myTotal.toFixed(2)}</span>
          </div>
        )}

        <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginBottom: 16 }}>
          Tax &amp; tip will be split equally among everyone.
        </p>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || selected.size === 0}
          style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
            background: selected.size === 0 ? '#e5e7eb' : 'linear-gradient(135deg, #fb7185, #f43f5e)',
            color: selected.size === 0 ? '#9ca3af' : '#fff',
            fontWeight: 800, fontSize: 15, cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
            boxShadow: selected.size > 0 ? '0 4px 14px rgba(244,63,94,0.3)' : 'none',
            transition: 'all 0.12s',
          }}
        >
          {submitting ? 'Submitting…' : `Submit My Order${selected.size > 0 ? ` ($${myTotal.toFixed(2)})` : ''}`}
        </button>

        <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 12 }}>
          You can change your selection until the payer finalizes the bill.
        </p>
      </div>
    </div>
  )
}
