import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { authApi } from '../../api/auth'
import Button from '../../components/ui/Button'
import { FormGroup, PasswordInput } from '../../components/ui/Form'

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

export default function ResetPassword() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (!/[A-Z]/.test(form.password)) { setError('Password must contain at least one uppercase letter'); return }
    if (!/[0-9]/.test(form.password)) { setError('Password must contain at least one number'); return }
    setLoading(true)
    try {
      await authApi.resetPassword(token, form.password)
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? (detail[0]?.msg || 'Password does not meet requirements') : (detail || 'Reset link is invalid or expired'))
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
            Set new password
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--t3)' }}>Enter your new password below</p>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--t1)', marginBottom: '6px' }}>Password updated!</h3>
            <p style={{ fontSize: '13px', color: 'var(--t3)' }}>Redirecting to sign in…</p>
          </div>
        ) : (
          <>
            {error && (
              <div style={{ background: 'rgba(248,113,113,0.13)', border: '1px solid rgba(248,113,113,0.5)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ fontSize: '15px', lineHeight: 1 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#f87171', marginBottom: '2px' }}>{error}</div>
                    {(error.toLowerCase().includes('invalid') || error.toLowerCase().includes('expired')) && (
                      <div style={{ fontSize: '12px', color: 'rgba(248,113,113,0.8)' }}>
                        Reset links expire after a short time.{' '}
                        <Link to="/forgot-password" style={{ color: '#f87171', fontWeight: 600 }}>Request a new one →</Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <FormGroup label="New password" required>
                <PasswordInput
                  required
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
              </FormGroup>
              <FormGroup label="Confirm password" required>
                <PasswordInput
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                />
                {form.confirm && (
                  <p style={{ fontSize: '11px', marginTop: '4px', color: form.password === form.confirm ? '#4ade80' : '#f87171' }}>
                    {form.password === form.confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </p>
                )}
              </FormGroup>
              <Button type="submit" loading={loading} size="lg" style={{ width: '100%' }}>
                Reset Password
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
