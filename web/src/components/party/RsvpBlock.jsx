import { useState } from 'react'
import axios from 'axios'

const EVENTS_BASE = import.meta.env.VITE_EVENTS_URL || '/api/events'

const STATUS_OPTIONS = [
  { value: 'going',     label: '✅ Going',        desc: "I'll be there" },
  { value: 'maybe',     label: '🤔 Maybe',         desc: 'Probably' },
  { value: 'not_going', label: "❌ Can't make it", desc: 'Not this time' },
]

function PlusOnesStepper({ value, onChange, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', flex: 1 }}>
        Bringing guests?
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value === 0}
          style={{
            width: 28, height: 28, borderRadius: '50%', border: 'none',
            background: value === 0 ? 'rgba(255,255,255,0.06)' : `${accent}33`,
            color: value === 0 ? 'rgba(255,255,255,0.2)' : accent,
            fontSize: '1.1rem', fontWeight: 700, cursor: value === 0 ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}
        >−</button>
        <span style={{
          minWidth: 20, textAlign: 'center',
          fontSize: '0.95rem', fontWeight: 700,
          color: value > 0 ? '#fff' : 'rgba(255,255,255,0.35)',
        }}>
          {value > 0 ? `+${value}` : '0'}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(10, value + 1))}
          disabled={value === 10}
          style={{
            width: 28, height: 28, borderRadius: '50%', border: 'none',
            background: `${accent}33`, color: accent,
            fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}
        >+</button>
      </div>
    </div>
  )
}

export default function RsvpBlock({ token, accentColor = '#f43f5e', onRsvpd }) {
  const [status, setStatus]       = useState('going')
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [bringNote, setBringNote] = useState('')
  const [plusOnes, setPlusOnes]   = useState(0)
  const [emailOptIn, setEmailOptIn] = useState(false)
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
        plus_ones: plusOnes,
        email_opt_in: emailOptIn,
      })
      try {
        window.localStorage.setItem(`partyInviteRsvp:${token}`, JSON.stringify({
          guest_id: res.data.guest_id,
          edit_token: res.data.edit_token,
        }))
      } catch {}
      setDone(true)
      onRsvpd && onRsvpd(res.data)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div style={{ textAlign: 'center', padding: '28px 16px' }}>
      <div style={{ fontSize: '2.4rem', marginBottom: 10 }}>🎉</div>
      <p style={{ color: '#fff', marginTop: 0, fontWeight: 800, fontSize: '1.1rem' }}>You're on the list!</p>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', marginTop: 6, lineHeight: 1.5 }}>
        Create a clubPal account to connect with the host and get future invites.
      </p>
      <a href="/register" style={{
        display: 'inline-block', marginTop: 14, padding: '9px 20px', borderRadius: 100,
        background: accentColor, color: '#fff', textDecoration: 'none',
        fontSize: '0.82rem', fontWeight: 700,
      }}>
        Create free account →
      </a>
    </div>
  )

  const inputStyle = {
    padding: '11px 14px', borderRadius: 10, width: '100%', boxSizing: 'border-box',
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
    color: '#fff', fontSize: '0.9rem', outline: 'none',
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Status buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatus(opt.value)}
            style={{
              flex: 1, padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
              border: status === opt.value ? `1.5px solid ${accentColor}` : '1.5px solid rgba(255,255,255,0.08)',
              background: status === opt.value ? `${accentColor}22` : 'rgba(255,255,255,0.04)',
              color: status === opt.value ? '#fff' : 'rgba(255,255,255,0.45)',
              fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.15s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}
          >
            <span style={{ fontSize: '1rem' }}>{opt.label.split(' ')[0]}</span>
            <span>{opt.label.split(' ').slice(1).join(' ')}</span>
          </button>
        ))}
      </div>

      <input
        placeholder="Your name"
        value={name}
        onChange={e => setName(e.target.value)}
        style={inputStyle}
      />
      <input
        placeholder="Email address"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={inputStyle}
      />
      <input
        placeholder="What are you bringing? (optional)"
        value={bringNote}
        onChange={e => setBringNote(e.target.value)}
        style={inputStyle}
      />

      <div style={{
        padding: '10px 14px', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
      }}>
        <PlusOnesStepper value={plusOnes} onChange={setPlusOnes} accent={accentColor} />
      </div>

      <label style={{
        display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer',
        color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', lineHeight: 1.45,
      }}>
        <input
          type="checkbox"
          checked={emailOptIn}
          onChange={e => setEmailOptIn(e.target.checked)}
          style={{ marginTop: 2, accentColor }}
        />
        Get updates and reminders for this party from the host.
      </label>

      {error && <p style={{ color: '#f87171', fontSize: '0.82rem', margin: 0 }}>{error}</p>}

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: '13px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: accentColor, color: '#fff', fontWeight: 800, fontSize: '0.95rem',
          opacity: loading ? 0.7 : 1, letterSpacing: '0.02em',
        }}
      >
        {loading ? 'Sending…' : status === 'going' ? '🎉 Count me in' : status === 'maybe' ? '🤔 RSVP as Maybe' : "❌ Can't make it"}
      </button>
    </form>
  )
}
