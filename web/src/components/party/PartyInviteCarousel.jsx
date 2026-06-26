import { useState } from 'react'
import { Link } from 'react-router-dom'
import { eventsApi } from '../../api/events'
import InviteMotion from './InviteMotion'

const ACCENT_DEFAULTS = {
  dining: '#f59e0b', hiking: '#22d3a0', gaming: '#a855f7',
  movies: '#6366f1', arts: '#fb7185', other: '#f43f5e',
}

function formatDateShort(dt) {
  if (!dt) return null
  const d = new Date(dt)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit' })
}

function cardBorderStyle(style, accent) {
  switch (style) {
    case 'neon':    return { border: `1.5px solid ${accent}`, boxShadow: `0 0 28px ${accent}44, 0 8px 24px rgba(0,0,0,0.4)` }
    case 'minimal': return { border: '1px solid var(--s3)', boxShadow: 'none' }
    case 'frosted': return { border: '1px solid rgba(255,255,255,0.22)', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }
    case 'velvet':  return { border: `2px solid ${accent}55`, boxShadow: `0 4px 28px ${accent}22` }
    case 'bold':    return { border: `1.5px solid ${accent}66`, boxShadow: `0 8px 24px ${accent}22` }
    default:        return { border: `1.5px solid ${accent}33`, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }
  }
}

function InviteBanner({ invite, userId, onRsvp }) {
  const [responding, setResponding] = useState(null)
  const [done, setDone] = useState(false)
  const accent = invite.accent_color || ACCENT_DEFAULTS[invite.activity_type] || '#f43f5e'
  const style  = invite.style || 'glass'
  const coverPos = invite.cover_image_position || '50% 50%'

  async function rsvp(status) {
    setResponding(status)
    try {
      await eventsApi.rsvp(invite.event_id, userId, status)
      setDone(true)
      setTimeout(() => onRsvp(invite.event_id), 900)
    } catch {
      setResponding(null)
    }
  }

  const heroBg = invite.cover_image_url
    ? { backgroundImage: `url(${invite.cover_image_url})`, backgroundSize: 'cover', backgroundPosition: coverPos }
    : { background: `linear-gradient(135deg, ${accent}66 0%, #111827 100%)` }

  const { border, boxShadow } = cardBorderStyle(style, accent)

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden', position: 'relative',
      border, boxShadow, marginBottom: 16,
    }}>
      {/* Hero area */}
      <div style={{ position: 'relative', minHeight: 180, ...heroBg }}>
        <InviteMotion type={invite.bg_animation} accent={accent} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.72) 100%)' }} />

        <div style={{ position: 'relative', padding: '18px 20px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 180 }}>
          {/* Top row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: `${accent}33`, backdropFilter: 'blur(8px)',
              border: `1px solid ${accent}55`, borderRadius: 999,
              padding: '4px 12px', fontSize: '.68rem', fontWeight: 800,
              color: '#fff', letterSpacing: '.06em', textTransform: 'uppercase',
            }}>
              🎉 Party Invite
            </div>
            <Link
              to={`/p/${invite.token}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999,
                padding: '5px 14px', fontSize: '.75rem', fontWeight: 700,
                color: '#fff', textDecoration: 'none',
              }}
            >
              View full invite →
            </Link>
          </div>

          {/* Bottom info */}
          <div>
            <h3 style={{ margin: '0 0 6px', color: '#fff', fontSize: '1.4rem', fontWeight: 900, lineHeight: 1.1, textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}>
              {invite.title}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {invite.scheduled_date && (
                <span style={{ fontSize: '.78rem', color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  🗓 {formatDateShort(invite.scheduled_date)}
                </span>
              )}
              {invite.location && (
                <span style={{ fontSize: '.78rem', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  📍 {invite.location}
                </span>
              )}
              {invite.host?.full_name && (
                <span style={{ fontSize: '.78rem', color: 'rgba(255,255,255,0.6)' }}>
                  by {invite.host.full_name}
                </span>
              )}
              {invite.going_count > 0 && (
                <span style={{
                  fontSize: '.72rem', fontWeight: 700, color: accent,
                  background: `${accent}22`, borderRadius: 999, padding: '2px 9px',
                }}>
                  {invite.going_count} going
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RSVP row */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px 16px',
        background: style === 'minimal' ? 'var(--s2)' : style === 'neon' ? '#08080d' : 'rgba(10,10,14,0.88)',
        backdropFilter: (style === 'glass' || style === 'frosted') ? 'blur(12px)' : 'none',
      }}>
        {done ? (
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '.82rem', flex: 1, textAlign: 'center', paddingTop: 4 }}>
            ✓ Response saved
          </p>
        ) : (
          <>
            {[
              { status: 'going',     label: '✅ Going',      color: '#22d3a0' },
              { status: 'maybe',     label: '🤔 Maybe',      color: '#f59e0b' },
              { status: 'not_going', label: "❌ Can't go",   color: 'rgba(255,255,255,0.35)' },
            ].map(({ status, label, color }) => (
              <button
                key={status}
                disabled={!!responding}
                onClick={() => rsvp(status)}
                style={{
                  flex: 1, padding: '9px 4px', borderRadius: 10,
                  border: responding === status ? `1.5px solid ${accent}` : '1px solid rgba(255,255,255,0.1)',
                  background: responding === status ? `${accent}22` : 'rgba(255,255,255,0.05)',
                  color: responding === status ? '#fff' : color,
                  fontWeight: 700, fontSize: '.78rem',
                  cursor: responding ? 'default' : 'pointer',
                  opacity: responding && responding !== status ? 0.4 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {responding === status ? '…' : label}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function InviteCard({ invite, userId, onRsvp }) {
  const [responding, setResponding] = useState(null)
  const [done, setDone] = useState(false)
  const accent = invite.accent_color || ACCENT_DEFAULTS[invite.activity_type] || '#f43f5e'
  const style  = invite.style || 'glass'
  const { border, boxShadow } = cardBorderStyle(style, accent)
  const coverPos = invite.cover_image_position || '50% 50%'

  async function rsvp(status) {
    setResponding(status)
    try {
      await eventsApi.rsvp(invite.event_id, userId, status)
      setDone(true)
      setTimeout(() => onRsvp(invite.event_id), 800)
    } catch {
      setResponding(null)
    }
  }

  const heroBg = invite.cover_image_url
    ? { backgroundImage: `url(${invite.cover_image_url})`, backgroundSize: 'cover', backgroundPosition: coverPos }
    : { background: `linear-gradient(135deg, ${accent}66 0%, #111827 100%)` }

  return (
    <div style={{
      minWidth: 300, maxWidth: 340, flexShrink: 0, scrollSnapAlign: 'start',
      borderRadius: 14, overflow: 'hidden', border, boxShadow,
    }}>
      <div style={{ position: 'relative', height: 110, ...heroBg }}>
        <InviteMotion type={invite.bg_animation} accent={accent} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.65))' }} />
        <div style={{ position: 'absolute', bottom: 10, left: 14, right: 14 }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '.95rem', fontWeight: 800, lineHeight: 1.2 }}>{invite.title}</h3>
          {invite.scheduled_date && (
            <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '.72rem' }}>{formatDateShort(invite.scheduled_date)}</p>
          )}
        </div>
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          <span style={{ background: `${accent}33`, border: `1px solid ${accent}55`, borderRadius: 999, padding: '2px 8px', fontSize: '.62rem', fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '.06em' }}>Invite</span>
        </div>
      </div>

      <div style={{
        padding: '10px 14px 12px',
        background: style === 'minimal' ? 'var(--s2)' : style === 'neon' ? '#08080d' : 'rgba(10,10,14,0.85)',
        backdropFilter: (style === 'glass' || style === 'frosted') ? 'blur(10px)' : 'none',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: '.72rem', color: 'rgba(255,255,255,0.45)' }}>
            {invite.host?.full_name ? `by ${invite.host.full_name}` : ''}
          </span>
          {invite.going_count > 0 && (
            <span style={{ fontSize: '.68rem', fontWeight: 700, color: accent }}>{invite.going_count} going</span>
          )}
        </div>
        {done ? (
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '.78rem', textAlign: 'center', padding: '4px 0' }}>✓ Response saved</p>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { status: 'going', label: '✅' },
              { status: 'maybe', label: '🤔' },
              { status: 'not_going', label: '❌' },
            ].map(({ status, label }) => (
              <button
                key={status}
                disabled={!!responding}
                onClick={() => rsvp(status)}
                style={{
                  flex: 1, padding: '7px 4px', borderRadius: 8,
                  border: responding === status ? `1.5px solid ${accent}` : '1px solid rgba(255,255,255,0.1)',
                  background: responding === status ? `${accent}22` : 'rgba(255,255,255,0.04)',
                  color: '#fff', fontSize: '.88rem', cursor: responding ? 'default' : 'pointer',
                  opacity: responding && responding !== status ? 0.4 : 1, transition: 'all 0.12s',
                }}
              >
                {responding === status ? '…' : label}
              </button>
            ))}
          </div>
        )}
        <Link to={`/p/${invite.token}`} style={{
          display: 'block', textAlign: 'center', marginTop: 8,
          color: accent, fontSize: '.72rem', fontWeight: 700, textDecoration: 'none',
        }}>
          View full invite →
        </Link>
      </div>
    </div>
  )
}

export default function PartyInviteCarousel({ invites, userId, onRsvp }) {
  const [dotIndex, setDotIndex] = useState(0)

  if (!invites?.length) return null

  function handleScroll(e) {
    setDotIndex(Math.round(e.target.scrollLeft / 312))
  }

  if (invites.length === 1) {
    return (
      <InviteBanner
        invite={invites[0]}
        userId={userId}
        onRsvp={onRsvp}
      />
    )
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ margin: '0 0 10px', color: 'var(--t3)', fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
        🎉 Party Invites · {invites.length}
      </p>
      <div
        onScroll={handleScroll}
        style={{
          display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none', paddingBottom: 4,
        }}
      >
        {invites.map(inv => (
          <InviteCard key={inv.token} invite={inv} userId={userId} onRsvp={onRsvp} />
        ))}
      </div>
      {invites.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
          {invites.map((_, i) => (
            <div key={i} style={{
              width: i === dotIndex ? 16 : 6, height: 6, borderRadius: 3,
              background: i === dotIndex ? 'var(--rose)' : 'var(--s3)',
              transition: 'all 0.2s',
            }} />
          ))}
        </div>
      )}
    </div>
  )
}
