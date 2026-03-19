import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import { FormGroup, FormInput, FormLabel } from '../../components/ui/Form'
import InputWithIcon from '../../components/ui/InputWithIcon'

const UserIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)

const LockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

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
    <div className="cp-auth-page">
      <div className="cp-auth-card">
        {/* Logo */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div className="cp-auth-logo">
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '16px' }}>C</span>
          </div>
          <h1 className="cp-auth-title">Welcome back</h1>
          <p className="cp-auth-subtitle">Sign in to your account</p>
        </div>

        {error && (
          <div className="cp-auth-error">
            <span style={{ fontSize: '15px', lineHeight: 1 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--error)' }}>{error}</div>
              {error.toLowerCase().includes('invalid') && (
                <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(248,113,113,0.8)', marginTop: '2px' }}>
                  If you recently reset your password, make sure you're using the new one.
                </div>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormGroup label="Email or Username" required>
            <InputWithIcon icon={<UserIcon />}>
              <FormInput
                type="text"
                required
                autoComplete="username"
                placeholder="your_username"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              />
            </InputWithIcon>
          </FormGroup>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <FormLabel required>Password</FormLabel>
              <Link to="/forgot-password" className="cp-auth-link" style={{ fontSize: 'var(--text-sm)' }}>
                Forgot password?
              </Link>
            </div>
            <InputWithIcon icon={<LockIcon />}>
              <div style={{ position: 'relative', width: '100%' }}>
                <FormInput
                  type={showPwd ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="cp-form-pwd-toggle"
                  tabIndex={-1}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{showPwd ? 'Hide' : 'Show'}</span>
                </button>
              </div>
            </InputWithIcon>
          </div>

          <Button type="submit" loading={loading} size="lg" style={{ width: '100%', marginTop: '4px' }}>
            Sign In
          </Button>
        </form>

        {/* Google sign-in — only shown when client ID is configured */}
        {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <>
            <div className="cp-auth-divider">
              <div className="cp-auth-divider-line" />
              <span className="cp-auth-divider-text">or continue with</span>
              <div className="cp-auth-divider-line" />
            </div>
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
          </>
        )}

        <p style={{ textAlign: 'center', fontSize: 'var(--text-base)', color: 'var(--t3)', marginTop: '20px' }}>
          Don't have an account?{' '}
          <Link to="/register" className="cp-auth-link" style={{ fontWeight: 600 }}>
            Register →
          </Link>
        </p>
      </div>
    </div>
  )
}
