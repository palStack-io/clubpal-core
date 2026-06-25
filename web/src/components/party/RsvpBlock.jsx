import { useState } from 'react'
import axios from 'axios'

const EVENTS_BASE = import.meta.env.VITE_EVENTS_URL || '/api/events'

const STATUS_OPTIONS = [
  { value: 'going',     label: '✅ Going' },
  { value: 'maybe',     label: '🤔 Maybe' },
  { value: 'not_going', label: "❌ Can't make it" },
]

export default function RsvpBlock({ token, accentColor = '#f43f5e', onRsvpd }) {
  const [status, setStatus]       = useState('going')
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [bringNote, setBringNote] = useState('')
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) { setError('Name and email are required'); return }
    setLoading(true)
    setError('')
    try {
      const res = await axios.post(`${EVENTS_BASE}/p/${token}/rsvp`, {
        name: name.trim(),
        email: email.trim(),
        status,
        bring_note: bringNote || undefined,
      })
      setDone(true)
      onRsvpd && onRsvpd(res.data)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div style={{ textAlign: 'center', padding: '24px' }}>
      <div style={{ fontSize: '2rem' }}>🎉</div>
      <p style={{ color: 'var(--t1)', marginTop: 8, fontWeight: 600 }}>You're on the list!</p>
      <p style={{ color: 'var(--t2)', fontSize: '0.85rem', marginTop: 4 }}>
        Join clubPal to connect with the host and get future invites automatically.
      </p>
      <a href="/register" style={{ color: accentColor, fontSize: '0.85rem', marginTop: 8, display: 'inline-block' }}>
        Create a free account →
      </a>
    </div>
  )

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatus(opt.value)}
            style={{
              flex: 1, padding: '10px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: status === opt.value ? accentColor : 'var(--s3)',
              color: status === opt.value ? '#fff' : 'var(--t2)',
              fontSize: '0.78rem', fontWeight: 600, transition: 'background 0.15s',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <input
        placeholder="Your name"
        value={name}
        onChange={e => setName(e.target.value)}
        style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--t4)', background: 'var(--s2)', color: 'var(--t1)', fontSize: '0.95rem' }}
      />
      <input
        placeholder="Email address"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--t4)', background: 'var(--s2)', color: 'var(--t1)', fontSize: '0.95rem' }}
      />
      <input
        placeholder="What are you bringing? (optional)"
        value={bringNote}
        onChange={e => setBringNote(e.target.value)}
        style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--t4)', background: 'var(--s2)', color: 'var(--t1)', fontSize: '0.95rem' }}
      />
      {error && <p style={{ color: 'var(--rose)', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: accentColor, color: '#fff', fontWeight: 700, fontSize: '1rem',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Sending…' : 'RSVP'}
      </button>
    </form>
  )
}
