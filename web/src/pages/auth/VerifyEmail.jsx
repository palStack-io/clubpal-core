import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { authApi } from '../../api/auth'

const PAGE_STYLE = {
  minHeight: '100vh',
  background: 'var(--bg)',
  backgroundImage: `
    radial-gradient(ellipse 600px 400px at 10% 5%, rgba(244,63,94,0.07) 0%, transparent 70%),
    radial-gradient(ellipse 500px 350px at 90% 95%, rgba(99,102,241,0.06) 0%, transparent 70%)
  `,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
}

export default function VerifyEmail() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying') // verifying | success | error

  useEffect(() => {
    let timer
    authApi.verifyEmail(token)
      .then(() => {
        setStatus('success')
        timer = setTimeout(() => navigate('/dashboard'), 3000)
      })
      .catch(() => setStatus('error'))
    return () => clearTimeout(timer)
  }, [token, navigate])

  return (
    <div style={PAGE_STYLE}>
      <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--rose-soft), var(--rose))', boxShadow: '0 4px 14px rgba(244,63,94,0.35)', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: '16px' }}>C</span>
        </div>

        {status === 'verifying' && (
          <>
            <div style={{ width: '36px', height: '36px', border: '3px solid var(--rose)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--t1)' }}>Verifying your email…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>✅</div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--t1)', marginBottom: '6px' }}>Email verified!</h2>
            <p style={{ fontSize: '13px', color: 'var(--t3)' }}>Redirecting to your dashboard…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>❌</div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--t1)', marginBottom: '6px' }}>Link expired</h2>
            <p style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '16px' }}>
              That verification link isn't working. Request a new one and we'll send it right over.
            </p>
            <Link to="/dashboard" style={{ fontSize: '13px', color: 'var(--rose-soft)', fontWeight: 600, textDecoration: 'none' }}>
              Go to dashboard to resend →
            </Link>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
