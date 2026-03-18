import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../../contexts/AuthContext'
import Button from '../../components/ui/Button'
import { FormGroup, FormInput, PasswordInput } from '../../components/ui/Form'

const PAGE = {
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

export default function Register() {
  const { register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', email: '', username: '', password: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
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
    <div style={PAGE}>
      <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--rose-soft), var(--rose))', boxShadow: '0 4px 14px rgba(244,63,94,0.35)', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '16px' }}>C</span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            Create account
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--t3)' }}>Join clubPal today</p>
        </div>

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#f87171', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <FormGroup label="Full Name" required>
            <FormInput type="text" required placeholder="Jane Smith" value={form.fullName} onChange={set('fullName')} />
          </FormGroup>
          <FormGroup label="Email" required>
            <FormInput type="email" required placeholder="jane@example.com" value={form.email} onChange={set('email')} />
          </FormGroup>
          <FormGroup label="Username" required>
            <FormInput type="text" required placeholder="janesmith" value={form.username} onChange={set('username')} />
          </FormGroup>
          <FormGroup label="Password" required>
            <PasswordInput required minLength={8} placeholder="Min. 8 characters" value={form.password} onChange={set('password')} autoComplete="new-password" />
          </FormGroup>
          <FormGroup label="Confirm Password" required>
            <PasswordInput required placeholder="••••••••" value={form.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" />
            {form.confirmPassword && (
              <p style={{ fontSize: '11px', marginTop: '4px', color: form.password === form.confirmPassword ? '#4ade80' : '#f87171' }}>
                {form.password === form.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
              </p>
            )}
          </FormGroup>

          <Button type="submit" loading={loading} size="lg" style={{ width: '100%', marginTop: '4px' }}>
            Create Account
          </Button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '20px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass)' }} />
          <span style={{ fontSize: '12px', color: 'var(--t3)' }}>or sign up with</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass)' }} />
        </div>

        {/* Google sign-up */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <GoogleLogin
            theme="filled_black"
            shape="pill"
            text="signup_with"
            onSuccess={async ({ credential }) => {
              setError('')
              const result = await loginWithGoogle(credential)
              if (result.success) navigate('/dashboard')
              else setError(result.error)
            }}
            onError={() => setError('Google sign-up failed. Please try again.')}
          />
        </div>

        <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--t3)', marginTop: '20px' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--rose-soft)', fontWeight: 600, textDecoration: 'none' }}>
            Sign in →
          </Link>
        </p>
      </div>
    </div>
  )
}
