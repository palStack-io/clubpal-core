import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

export default function PayConfirm() {
  const { token } = useParams()
  const [status, setStatus] = useState('loading') // loading | success | already_paid | error
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`/api/bill-splits/pay/${token}`, { method: 'POST' })
      .then(async res => {
        const body = await res.json()
        if (res.ok) {
          setData(body)
          setStatus(body.already_paid ? 'already_paid' : 'success')
        } else {
          setStatus('error')
        }
      })
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
      padding: '24px',
      fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.6)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
        padding: '40px 36px',
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center',
      }}>

        {/* Header band */}
        <div style={{
          background: 'linear-gradient(135deg, #fb7185, #f43f5e)',
          borderRadius: '14px',
          padding: '12px 20px',
          marginBottom: '28px',
          display: 'inline-block',
        }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: '16px', letterSpacing: '-0.3px' }}>
            clubPal
          </span>
        </div>

        {status === 'loading' && (
          <>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%',
              border: '3px solid #fda4af', borderTopColor: '#f43f5e',
              animation: 'spin 0.7s linear infinite',
              margin: '0 auto 20px',
            }} />
            <p style={{ color: '#6b7280', fontSize: '15px', margin: 0 }}>Confirming payment…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '52px', marginBottom: '12px' }}>✅</div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: '0 0 8px', letterSpacing: '-0.4px' }}>
              Payment confirmed!
            </h1>
            {data?.member_name && (
              <p style={{ fontSize: '15px', color: '#6b7280', margin: '0 0 20px' }}>
                Thanks, <strong style={{ color: '#111827' }}>{data.member_name}</strong>.
                Your <strong style={{ color: '#f43f5e' }}>${Number(data.amount).toFixed(2)}</strong> share
                {data.event_name ? ` for ${data.event_name}` : ''} has been marked as paid.
              </p>
            )}
            <div style={{
              background: 'rgba(34,197,94,0.07)',
              border: '1px solid rgba(34,197,94,0.18)',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '13px',
              color: '#15803d',
            }}>
              The organizer has been notified. You're all set!
            </div>
          </>
        )}

        {status === 'already_paid' && (
          <>
            <div style={{ fontSize: '52px', marginBottom: '12px' }}>👍</div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: '0 0 8px', letterSpacing: '-0.4px' }}>
              Already marked paid
            </h1>
            <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>
              This share was already confirmed. Nothing more to do!
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '52px', marginBottom: '12px' }}>🔗</div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: '0 0 8px', letterSpacing: '-0.4px' }}>
              Link not found
            </h1>
            <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>
              This link may have expired or already been used. Ask the organiser to manually mark you as paid.
            </p>
          </>
        )}

        <div style={{ marginTop: '28px', borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: '20px' }}>
          <Link
            to="/dashboard"
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #fb7185, #f43f5e)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '14px',
              padding: '10px 24px',
              borderRadius: '12px',
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(244,63,94,0.3)',
            }}
          >
            Open clubPal
          </Link>
        </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
