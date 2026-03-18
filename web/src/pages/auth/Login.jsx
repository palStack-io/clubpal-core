import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import { FormGroup, FormInput, FormLabel } from '../../components/ui/Form'

const authPageStyles = {
  page: {
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
  },
  container: {
    background: 'var(--s2)',
    border: '1px solid var(--glass)',
    borderRadius: '20px',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
  },
  logo: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, var(--rose-soft), var(--rose))',
    boxShadow: '0 4px 14px rgba(244,63,94,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
  },
}

export default function Login() {
  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(form.username, form.password)
    setLoading(false)
    if (result.success) {
      navigate(searchParams.get('next') || '/dashboard')
    } else {
      setError(result.error)
    }
  }

  return (
    <div style={authPageStyles.page}>
      <div style={authPageStyles.container}>
        {/* Logo */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', ...authPageStyles.logo }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '16px' }}>C</span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            Welcome back
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--t3)' }}>Sign in to your account</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.13)', border: '1px solid rgba(248,113,113,0.5)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{ fontSize: '15px', lineHeight: 1 }}>⚠️</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f87171', marginBottom: '2px' }}>{error}</div>
                {error.toLowerCase().includes('invalid') && (
                  <div style={{ fontSize: '12px', color: 'rgba(248,113,113,0.8)' }}>
                    If you recently reset your password, make sure you're using the new one.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormGroup label="Email or Username" required>
            <FormInput
              type="text"
              required
              autoComplete="username"
              placeholder="your_username"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            />
          </FormGroup>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <FormLabel required>Password</FormLabel>
              <Link to="/forgot-password" style={{ fontSize: '12px', color: 'var(--rose-soft)', textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <FormInput
                type={showPwd ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: '11px' }}
              >
                {showPwd ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <Button type="submit" loading={loading} size="lg" style={{ width: '100%', marginTop: '4px' }}>
            Sign In
          </Button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass)' }} />
          <span style={{ fontSize: '12px', color: 'var(--t3)' }}>or continue with</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass)' }} />
        </div>

        {/* Google sign-in */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <GoogleLogin
            theme="filled_black"
            shape="pill"
            text="signin_with"
            onSuccess={async ({ credential }) => {
              setError('')
              const result = await loginWithGoogle(credential)
              if (result.success) navigate('/dashboard')
              else setError(result.error)
            }}
            onError={() => setError('Google sign-in failed. Please try again.')}
          />
        </div>

        <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--t3)', marginTop: '20px' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--rose-soft)', fontWeight: 600, textDecoration: 'none' }}>
            Register →
          </Link>
        </p>
      </div>
    </div>
  )
}
