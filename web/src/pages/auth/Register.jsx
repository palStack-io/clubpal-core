import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import { FormGroup, FormInput, PasswordInput } from '../../components/ui/Form'
import InputWithIcon from '../../components/ui/InputWithIcon'
import PasswordStrength from '../../components/ui/PasswordStrength'

const UserIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
const MailIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
  </svg>
)
const AtSignIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>
  </svg>
)
const LockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

export default function Register() {
  const { register, loginWithGoogle, confirmLink } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', email: '', username: '', password: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [linkPending, setLinkPending] = useState(null)
  const [linking, setLinking] = useState(false)

  const handleConfirmLink = async () => {
    setLinking(true)
    const result = await confirmLink(linkPending.linkToken)
    setLinking(false)
    if (result.success) {
      navigate('/dashboard')
    } else {
      setLinkPending(null)
      setError(result.error)
    }
  }

  const set = key => e => {
    setForm(f => ({ ...f, [key]: e.target.value }))
    setFieldErrors(fe => ({ ...fe, [key]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.fullName.trim()) errs.fullName = 'Full name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address'
    if (!form.username.trim()) errs.username = 'Username is required'
    else if (form.username.length < 3) errs.username = 'Must be at least 3 characters'
    if (form.password.length < 8) errs.password = 'Must be at least 8 characters'
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setError('')
    setLoading(true)
    const result = await register(form.username, form.email, form.password, form.fullName)
    setLoading(false)
    if (result.success) {
      navigate('/dashboard')
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
          <h1 className="cp-auth-title">Create account</h1>
          <p className="cp-auth-subtitle">Join clubPal today</p>
        </div>

        {linkPending && (
          <div className="cp-auth-error" style={{ borderColor: 'var(--rose-border, #f43f5e55)', background: 'var(--rose-glow, rgba(244,63,94,0.08))' }}>
            <span style={{ fontSize: '15px', lineHeight: 1 }}>🔗</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--t1)' }}>{linkPending.message}</div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <Button size="sm" loading={linking} onClick={handleConfirmLink}>
                  Confirm & Link Account
                </Button>
                <Button size="sm" variant="ghost" disabled={linking} onClick={() => setLinkPending(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {error && !linkPending && (
          <div className="cp-auth-error">
            <span style={{ fontSize: '15px', lineHeight: 1 }}>⚠️</span>
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--error)' }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormGroup label="Full Name" required error={fieldErrors.fullName}>
            <InputWithIcon icon={<UserIcon />}>
              <FormInput
                type="text"
                required
                placeholder="Jane Smith"
                value={form.fullName}
                onChange={set('fullName')}
                error={fieldErrors.fullName}
              />
            </InputWithIcon>
          </FormGroup>

          <FormGroup label="Email" required error={fieldErrors.email}>
            <InputWithIcon icon={<MailIcon />}>
              <FormInput
                type="email"
                required
                placeholder="jane@example.com"
                value={form.email}
                onChange={set('email')}
                error={fieldErrors.email}
              />
            </InputWithIcon>
          </FormGroup>

          <FormGroup label="Username" required error={fieldErrors.username}>
            <InputWithIcon icon={<AtSignIcon />}>
              <FormInput
                type="text"
                required
                placeholder="janesmith"
                value={form.username}
                onChange={set('username')}
                error={fieldErrors.username}
              />
            </InputWithIcon>
          </FormGroup>

          <div>
            <FormGroup label="Password" required error={fieldErrors.password}>
              <InputWithIcon icon={<LockIcon />}>
                <PasswordInput
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="new-password"
                  error={fieldErrors.password}
                />
              </InputWithIcon>
            </FormGroup>
            <PasswordStrength password={form.password} />
          </div>

          <FormGroup label="Confirm Password" required error={fieldErrors.confirmPassword}>
            <InputWithIcon icon={<LockIcon />}>
              <PasswordInput
                required
                placeholder="••••••••"
                value={form.confirmPassword}
                onChange={set('confirmPassword')}
                autoComplete="new-password"
                error={fieldErrors.confirmPassword}
              />
            </InputWithIcon>
            {form.confirmPassword && !fieldErrors.confirmPassword && form.password === form.confirmPassword && (
              <p style={{ fontSize: 'var(--text-xs)', marginTop: '4px', color: 'var(--success)' }}>
                ✓ Passwords match
              </p>
            )}
          </FormGroup>

          <Button type="submit" loading={loading} size="lg" style={{ width: '100%', marginTop: '4px' }}>
            Create Account
          </Button>
        </form>

        {/* Google sign-up — only shown when client ID is configured */}
        {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <>
            <div className="cp-auth-divider">
              <div className="cp-auth-divider-line" />
              <span className="cp-auth-divider-text">or sign up with</span>
              <div className="cp-auth-divider-line" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleLogin
                theme="filled_black"
                shape="pill"
                text="signup_with"
                onSuccess={async ({ credential }) => {
                  setError('')
                  setLinkPending(null)
                  const result = await loginWithGoogle(credential)
                  if (result.success) {
                    navigate('/dashboard')
                  } else if (result.linkRequired) {
                    setLinkPending(result)
                  } else {
                    setError(result.error)
                  }
                }}
                onError={() => setError('Google sign-up failed. Please try again.')}
              />
            </div>
          </>
        )}

        <p style={{ textAlign: 'center', fontSize: 'var(--text-base)', color: 'var(--t3)', marginTop: '20px' }}>
          Already have an account?{' '}
          <Link to="/login" className="cp-auth-link" style={{ fontWeight: 600 }}>
            Sign in →
          </Link>
        </p>
      </div>
    </div>
  )
}
