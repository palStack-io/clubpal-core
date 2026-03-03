import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../../api/auth'
import Button from '../../components/ui/Button'
import { FormGroup, FormInput } from '../../components/ui/Form'

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

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={PAGE_STYLE}>
      <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '400px' }}>
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--rose-soft), var(--rose))', boxShadow: '0 4px 14px rgba(244,63,94,0.35)', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '16px' }}>C</span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            Reset password
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--t3)' }}>We'll send a reset link to your email</p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📧</div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--t1)', marginBottom: '6px' }}>Check your email</h3>
            <p style={{ fontSize: '13px', color: 'var(--t3)' }}>
              We sent a reset link to <strong style={{ color: 'var(--t2)' }}>{email}</strong>
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#f87171', marginBottom: '16px' }}>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <FormGroup label="Email address" required>
                <FormInput
                  type="email"
                  required
                  placeholder="jane@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </FormGroup>
              <Button type="submit" loading={loading} size="lg" style={{ width: '100%' }}>
                Send Reset Link
              </Button>
            </form>
          </>
        )}

        <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--t3)', marginTop: '20px' }}>
          <Link to="/login" style={{ color: 'var(--rose-soft)', fontWeight: 600, textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
