import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import RsvpBlock from '../../components/party/RsvpBlock'
import GuestList from '../../components/party/GuestList'

const EVENTS_BASE = import.meta.env.VITE_EVENTS_URL || '/api/events'

const THEME = {
  dining: { grad: ['#92400e', '#f59e0b'], emoji: '🍽️' },
  hiking: { grad: ['#064e3b', '#22d3a0'], emoji: '🥾' },
  gaming: { grad: ['#1e1b4b', '#a855f7'], emoji: '🎮' },
  movies: { grad: ['#0f172a', '#6366f1'], emoji: '🎬' },
  arts:   { grad: ['#4a044e', '#fb7185'], emoji: '🎨' },
  other:  { grad: ['#1a0010', '#f43f5e'], emoji: '🎉' },
}

function formatDate(dt) {
  if (!dt) return null
  const d = new Date(dt)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    + (d.getHours() || d.getMinutes()
      ? ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '')
}

export default function PartyInvitePage() {
  const { token } = useParams()
  const [invite, setInvite]   = useState(null)
  const [guests, setGuests]   = useState({ guests: [], member_groups: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    Promise.all([
      axios.get(`${EVENTS_BASE}/p/${token}`),
      axios.get(`${EVENTS_BASE}/p/${token}/guests`),
    ]).then(([inv, gst]) => {
      setInvite(inv.data)
      setGuests(gst.data)
    }).catch(() => {
      setError('Invite not found or no longer available.')
    }).finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#08080a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#9898b0', fontSize: '0.9rem' }}>Loading…</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#08080a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <div style={{ fontSize: '2.5rem' }}>😕</div>
      <p style={{ color: '#9898b0', margin: 0 }}>{error}</p>
    </div>
  )

  const theme   = THEME[invite.theme_activity_type] || THEME.other
  const accent  = invite.accent_color || '#f43f5e'
  const dateStr = formatDate(invite.event?.scheduled_date)

  const totalGoing = (guests.guests?.filter(g => g.rsvp_status === 'going').length || 0)
    + (guests.member_groups?.reduce((s, mg) => s + (mg.members?.length || 0), 0) || 0)

  const hasGuests = totalGoing > 0 || guests.member_groups?.some(mg => mg.members?.length > 0)

  const heroBg = invite.cover_image_url
    ? { backgroundImage: `url(${invite.cover_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: `linear-gradient(145deg, ${theme.grad[0]}, ${theme.grad[1]})` }

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#fff' }}>

      {/* Hero */}
      <div style={{ position: 'relative', minHeight: 280, ...heroBg }}>
        {/* Gradient fade to page bg */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(8,8,10,0.92) 100%)' }} />

        <div style={{ position: 'relative', padding: '48px 24px 32px', maxWidth: 520, margin: '0 auto' }}>
          {/* Turn reveal badge */}
          {invite.is_turn_reveal && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 20, padding: '4px 12px', fontSize: '0.78rem',
              color: 'rgba(255,255,255,0.85)', marginBottom: 16,
            }}>
              🎯 It's {invite.host?.full_name?.split(' ')[0] || 'their'} turn to host
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: `linear-gradient(135deg, ${theme.grad[0]}, ${theme.grad[1]})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.6rem', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              {theme.emoji}
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, lineHeight: 1.2, color: '#fff' }}>
                {invite.event?.title}
              </h1>
              {invite.host?.full_name && (
                <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem' }}>
                  Hosted by {invite.host.full_name}
                </p>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dateStr && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem' }}>
                <span>📅</span><span>{dateStr}</span>
              </div>
            )}
            {invite.event?.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem' }}>
                <span>📍</span><span>{invite.event.location}</span>
              </div>
            )}
            {totalGoing > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                <span>👥</span>
                <span style={{ color: accent, fontWeight: 600 }}>{totalGoing} going</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px 48px' }}>

        {/* Description */}
        {invite.event?.description && (
          <p style={{
            color: '#9898b0', fontSize: '0.92rem', lineHeight: 1.6,
            margin: '20px 0', padding: '16px', borderRadius: 12,
            background: '#0e0e12', border: '1px solid #1a1a22',
          }}>
            {invite.event.description}
          </p>
        )}

        {/* RSVP */}
        <div style={{ margin: '20px 0', background: '#0e0e12', borderRadius: 16, padding: '20px', border: '1px solid #1a1a22' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Are you coming?</h2>
          <RsvpBlock token={token} accentColor={accent} />
        </div>

        {/* Bring list */}
        {invite.bring_list_enabled && invite.items?.length > 0 && (
          <div style={{ margin: '16px 0', background: '#0e0e12', borderRadius: 16, padding: '20px', border: '1px solid #1a1a22' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#fff' }}>What to bring</h2>
            {invite.items.map(item => {
              const taken = item.claim_count >= item.max_claims
              return (
                <div key={item.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid #1a1a22',
                }}>
                  <span style={{ color: '#fff', fontSize: '0.92rem' }}>
                    {item.emoji && <span style={{ marginRight: 6 }}>{item.emoji}</span>}
                    {item.label}
                  </span>
                  <span style={{
                    fontSize: '0.78rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                    background: taken ? '#1a1a22' : `${accent}22`,
                    color: taken ? '#55556a' : accent,
                  }}>
                    {taken ? 'Taken' : `${item.max_claims - item.claim_count} left`}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Guest list */}
        {hasGuests && (
          <div style={{ margin: '16px 0', background: '#0e0e12', borderRadius: 16, padding: '20px', border: '1px solid #1a1a22' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Who's coming</h2>
            <GuestList guests={guests.guests} memberGroups={guests.member_groups} accentColor={accent} />
          </div>
        )}

        {/* Footer nudge */}
        <p style={{ textAlign: 'center', color: '#38383f', fontSize: '0.78rem', marginTop: 32 }}>
          Made with <Link to="/" style={{ color: '#55556a', textDecoration: 'none' }}>clubPal</Link>
        </p>
      </div>
    </div>
  )
}
