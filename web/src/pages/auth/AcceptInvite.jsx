import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
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

const Logo = () => (
  <div style={{ display: 'inline-flex', width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--rose-soft), var(--rose))', boxShadow: '0 4px 14px rgba(244,63,94,0.35)', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
    <span style={{ color: '#fff', fontWeight: 800, fontSize: '16px' }}>C</span>
  </div>
)

export default function AcceptInvite() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [invite, setInvite] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState({ username: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    authApi.getInvite(token)
      .then(setInvite)
      .catch(() => setLoadError('That invitation isn\'t working. Double-check it with whoever sent it.'))
  }, [token])

  const handleJoin = async () => {
    setError('')
    setLoading(true)
    try {
      const data = await authApi.joinInvite(token)
      localStorage.setItem('session_token', data.session_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'We couldn\'t join that group. Give it another go.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegisterAndJoin = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const data = await authApi.acceptInvite(token, form.username, form.password)
      localStorage.setItem('session_token', data.session_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'We couldn\'t create your account. Give it another go.')
    } finally {
      setLoading(false)
    }
  }

  if (loadError) {
    return (
      <div style={PAGE_STYLE}>
        <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <Logo />
          <div style={{ fontSize: '40px', margin: '8px 0 12px' }}>🚫</div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--t1)', marginBottom: '8px' }}>Invite expired</h2>
          <p style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '20px' }}>{loadError}</p>
          <Link to="/login" style={{ fontSize: '13px', color: 'var(--rose-soft)', fontWeight: 600, textDecoration: 'none' }}>
            Go to sign in →
          </Link>
        </div>
      </div>
    )
  }

  if (!invite) {
    return (
      <div style={PAGE_STYLE}>
        <div style={{ width: '36px', height: '36px', border: '3px solid var(--rose)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={PAGE_STYLE}>
      <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '400px' }}>
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <Logo />
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.5px', marginBottom: '6px' }}>
            You're invited!
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--t3)' }}>
            <span style={{ color: 'var(--t2)', fontWeight: 600 }}>{invite.invited_by_name}</span> invited you to join{' '}
            <span style={{ color: 'var(--t2)', fontWeight: 600 }}>{invite.group_name}</span>
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#f87171', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {invite.user_exists ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '13px', color: 'var(--t3)' }}>
              Joining as <span style={{ color: 'var(--t2)', fontWeight: 600 }}>{invite.email}</span>
            </p>
            <Button onClick={handleJoin} loading={loading} size="lg" style={{ width: '100%' }}>
              Join {invite.group_name}
            </Button>
            <p style={{ fontSize: '12px', color: 'var(--t4)' }}>
              Not you?{' '}
              <Link to="/login" style={{ color: 'var(--rose-soft)', textDecoration: 'none' }}>
                Sign in with a different account
              </Link>
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '16px' }}>
              Create your account to join <span style={{ color: 'var(--t2)', fontWeight: 600 }}>{invite.group_name}</span>.
            </p>
            <form onSubmit={handleRegisterAndJoin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <FormGroup label="Email">
                <FormInput type="email" disabled value={invite.email} style={{ opacity: 0.6, cursor: 'not-allowed' }} />
              </FormGroup>
              <FormGroup label="Username" required>
                <FormInput
                  type="text"
                  required
                  placeholder="choose_a_username"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                />
              </FormGroup>
              <FormGroup label="Password" required>
                <FormInput
                  type="password"
                  required
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
              </FormGroup>
              <FormGroup label="Confirm password" required>
                <FormInput
                  type="password"
                  required
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                />
              </FormGroup>
              <Button type="submit" loading={loading} size="lg" style={{ width: '100%' }}>
                Create account & join
              </Button>
            </form>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
