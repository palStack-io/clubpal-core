import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import RsvpBlock from '../../components/party/RsvpBlock'
import GuestList from '../../components/party/GuestList'

const EVENTS_BASE = import.meta.env.VITE_EVENTS_URL || '/api/events'

const THEME_GRAD = {
  dining: ['#92400e', '#f59e0b'],
  hiking: ['#064e3b', '#22d3a0'],
  gaming: ['#1e1b4b', '#a855f7'],
  movies: ['#0f172a', '#6366f1'],
  arts:   ['#4a044e', '#fb7185'],
  other:  ['#1a0010', '#f43f5e'],
}

function formatDate(dt) {
  if (!dt) return null
  const d = new Date(dt)
  const date = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const time = (d.getHours() || d.getMinutes())
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null
  return time ? `${date} · ${time}` : date
}

function styleVars(style, accent) {
  switch (style) {
    case 'neon':
      return {
        cardBg: 'rgba(0,0,0,0.75)',
        cardBorder: `1px solid ${accent}`,
        cardShadow: `0 0 24px ${accent}44`,
        sectionBg: 'rgba(0,0,0,0.6)',
        sectionBorder: `1px solid ${accent}33`,
        blur: false,
      }
    case 'minimal':
      return {
        cardBg: '#111114',
        cardBorder: '1px solid #1a1a22',
        cardShadow: 'none',
        sectionBg: '#111114',
        sectionBorder: '1px solid #1a1a22',
        blur: false,
      }
    default: // glass
      return {
        cardBg: 'rgba(255,255,255,0.06)',
        cardBorder: '1px solid rgba(255,255,255,0.1)',
        cardShadow: '0 8px 32px rgba(0,0,0,0.4)',
        sectionBg: 'rgba(255,255,255,0.04)',
        sectionBorder: '1px solid rgba(255,255,255,0.08)',
        blur: true,
      }
  }
}

function CapacityBar({ going, max, accent }) {
  if (!max) return null
  const pct = Math.min(100, Math.round((going / max) * 100))
  const full = going >= max
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
          {full ? 'Event is full' : `${max - going} spots left`}
        </span>
        <span style={{ fontSize: '0.8rem', color: accent, fontWeight: 600 }}>
          {going} going
        </span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 3,
          background: full ? '#55556a' : accent, transition: 'width 0.5s',
        }} />
      </div>
    </div>
  )
}

function CalIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

export default function PartyInvitePage() {
  const { token }  = useParams()
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

  const style    = invite.style || 'glass'
  const accent   = invite.accent_color || '#f43f5e'
  const gradPair = THEME_GRAD[invite.theme_activity_type] || THEME_GRAD.other
  const vars     = styleVars(style, accent)
  const dateStr  = formatDate(invite.event?.scheduled_date)

  const goingCount = (guests.guests?.filter(g => g.status === 'going' || g.rsvp_status === 'going').length || 0)
    + (guests.member_groups?.reduce((s, mg) => s + (mg.members?.length || 0), 0) || 0)

  const heroBg = invite.cover_image_url
    ? { backgroundImage: `url(${invite.cover_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: `linear-gradient(145deg, ${gradPair[0]}, ${gradPair[1]})` }

  const admitCode = token.slice(-8).toUpperCase()

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#fff' }}>

      {/* Hero */}
      <div style={{ position: 'relative', minHeight: 300, ...heroBg }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(8,8,10,0.95) 100%)' }} />

        <div style={{ position: 'relative', padding: '56px 20px 36px', maxWidth: 500, margin: '0 auto' }}>
          {invite.is_turn_reveal && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 20, padding: '4px 12px', fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.8)',
            }}>
              🎯 It's {invite.host?.full_name?.split(' ')[0] || 'their'} turn to host
            </div>
          )}

          <h1 style={{ margin: '0 0 6px', fontSize: '2rem', fontWeight: 900, lineHeight: 1.15, color: '#fff', letterSpacing: '-0.02em' }}>
            {invite.event?.title}
          </h1>

          {invite.host?.full_name && (
            <p style={{ margin: '0 0 20px', color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem' }}>
              Hosted by {invite.host.full_name}
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dateStr && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.75)', fontSize: '0.88rem' }}>
                <CalIcon /><span>{dateStr}</span>
              </div>
            )}
            {invite.event?.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.75)', fontSize: '0.88rem' }}>
                <PinIcon /><span>{invite.event.location}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ticket perforated divider */}
      <div style={{ position: 'relative', maxWidth: 500, margin: '0 auto', padding: '0 20px' }}>
        <div style={{ position: 'absolute', left: 8, top: -12, width: 24, height: 24, borderRadius: '50%', background: '#08080a', zIndex: 10 }} />
        <div style={{ position: 'absolute', right: 8, top: -12, width: 24, height: 24, borderRadius: '50%', background: '#08080a', zIndex: 10 }} />
        <div style={{ borderTop: '2px dashed rgba(255,255,255,0.12)', position: 'relative', zIndex: 5 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Admit One</span>
          <span style={{ fontFamily: "'Space Mono', 'Courier New', monospace", fontSize: '0.78rem', fontWeight: 700, color: accent, letterSpacing: '0.2em' }}>
            {admitCode}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '0 20px 56px' }}>

        <CapacityBar going={goingCount} max={invite.event?.max_attendees} accent={accent} />

        {invite.event?.description && (
          <div style={{
            background: vars.sectionBg, borderRadius: 14, padding: '16px 18px',
            border: vars.sectionBorder, marginBottom: 16,
            backdropFilter: vars.blur ? 'blur(8px)' : 'none',
          }}>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              {invite.event.description}
            </p>
          </div>
        )}

        {/* RSVP */}
        <div style={{
          background: vars.cardBg, borderRadius: 16, padding: '20px',
          border: vars.cardBorder, boxShadow: vars.cardShadow, marginBottom: 16,
          backdropFilter: vars.blur ? 'blur(12px)' : 'none',
        }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Are you coming?</h2>
          <RsvpBlock token={token} accentColor={accent} />
        </div>

        {/* Bring list */}
        {invite.bring_list_enabled && invite.items?.length > 0 && (
          <div style={{
            background: vars.sectionBg, borderRadius: 16, padding: '20px',
            border: vars.sectionBorder, marginBottom: 16,
            backdropFilter: vars.blur ? 'blur(8px)' : 'none',
          }}>
            <h2 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 700, color: '#fff' }}>What to bring</h2>
            {invite.items.map(item => {
              const taken = item.claim_count >= item.max_claims
              return (
                <div key={item.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <span style={{ color: '#fff', fontSize: '0.9rem' }}>
                    {item.emoji && <span style={{ marginRight: 6 }}>{item.emoji}</span>}
                    {item.label}
                  </span>
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                    background: taken ? 'rgba(255,255,255,0.06)' : `${accent}22`,
                    color: taken ? 'rgba(255,255,255,0.3)' : accent,
                  }}>
                    {taken ? 'Taken' : `${item.max_claims - item.claim_count} left`}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Guest list */}
        {goingCount > 0 && (
          <div style={{
            background: vars.sectionBg, borderRadius: 16, padding: '20px',
            border: vars.sectionBorder,
            backdropFilter: vars.blur ? 'blur(8px)' : 'none',
          }}>
            <h2 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Who's coming</h2>
            <GuestList guests={guests.guests} memberGroups={guests.member_groups} accentColor={accent} />
          </div>
        )}

        <p style={{ textAlign: 'center', color: '#2a2a32', fontSize: '0.72rem', marginTop: 36 }}>
          Made with <Link to="/" style={{ color: '#38383f', textDecoration: 'none' }}>clubPal</Link>
        </p>
      </div>
    </div>
  )
}
