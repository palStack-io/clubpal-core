import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import RsvpBlock from '../../components/party/RsvpBlock'
import GuestList from '../../components/party/GuestList'
import InviteMotion from '../../components/party/InviteMotion'

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

function toCalDate(dt) {
  const d = new Date(dt)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`
}

function googleCalUrl(event) {
  const start = toCalDate(event.scheduled_date)
  const end   = toCalDate(new Date(new Date(event.scheduled_date).getTime() + 2 * 60 * 60 * 1000))
  const p = new URLSearchParams({ action: 'TEMPLATE', text: event.title || 'Event', dates: `${start}/${end}` })
  if (event.description) p.set('details', event.description)
  if (event.location)    p.set('location', event.location)
  return `https://calendar.google.com/calendar/render?${p}`
}

function downloadIcs(event) {
  const start = toCalDate(new Date(event.scheduled_date))
  const end   = toCalDate(new Date(new Date(event.scheduled_date).getTime() + 2 * 60 * 60 * 1000))
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//clubPal//EN',
    'BEGIN:VEVENT',
    `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${event.title || 'Event'}`,
    event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : null,
    event.location    ? `LOCATION:${event.location}` : null,
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([lines], { type: 'text/calendar' }))
  a.download = `${(event.title || 'event').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.ics`
  a.click()
}

function AddToCalendar({ event, accent }) {
  if (!event?.scheduled_date) return null
  const btnStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 7,
    padding: '7px 14px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
    cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.85)',
    textDecoration: 'none', transition: 'background 0.15s',
  }
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
      <a href={googleCalUrl(event)} target="_blank" rel="noopener noreferrer" style={btnStyle}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.13)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Google Calendar
      </a>
      <button onClick={() => downloadIcs(event)} style={{ ...btnStyle, border: '1px solid rgba(255,255,255,0.15)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.13)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        Apple / iCal
      </button>
    </div>
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
  const [guestAccess, setGuestAccess] = useState(null)
  const [guestsLoading, setGuestsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    axios.get(`${EVENTS_BASE}/p/${token}`).then(inv => {
      setInvite(inv.data)
      try {
        const saved = JSON.parse(window.localStorage.getItem(`partyInviteRsvp:${token}`) || 'null')
        if (saved?.guest_id && saved?.edit_token) {
          setGuestAccess(saved)
          loadGuests(saved)
        }
      } catch {}
    }).catch(() => {
      setError('Invite not found or no longer available.')
    }).finally(() => setLoading(false))
  }, [token])

  async function loadGuests(access) {
    if (!access?.guest_id || !access?.edit_token) return
    setGuestsLoading(true)
    try {
      const gst = await axios.get(`${EVENTS_BASE}/p/${token}/guests`, {
        params: { guest_id: access.guest_id, edit_token: access.edit_token },
      })
      setGuests(gst.data)
    } catch {
      setGuests({ guests: [], member_groups: [] })
    } finally {
      setGuestsLoading(false)
    }
  }

  function handleRsvpd(data) {
    const access = { guest_id: data.guest_id, edit_token: data.edit_token }
    setGuestAccess(access)
    loadGuests(access)
  }

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
      <style>{`
        .party-invite-hero-inner { max-width: 1180px; margin: 0 auto; padding: 86px 28px 52px; min-height: min(760px, 78vh); display: flex; flex-direction: column; justify-content: flex-end; }
        .party-invite-eyebrow { display: inline-flex; align-items: center; gap: 8px; width: fit-content; margin-bottom: 20px; background: rgba(0,0,0,0.46); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.14); border-radius: 999px; padding: 7px 13px; font-size: .76rem; color: rgba(255,255,255,.82); }
        .party-invite-title { margin: 0 0 12px; max-width: 900px; font-size: clamp(2.5rem, 7vw, 6.8rem); font-weight: 950; line-height: .92; color: #fff; letter-spacing: 0; }
        .party-invite-host { margin: 0 0 26px; color: rgba(255,255,255,.64); font-size: 1rem; }
        .party-invite-meta { display: flex; flex-wrap: wrap; gap: 10px; max-width: 980px; }
        .party-invite-meta-item { display: inline-flex; align-items: center; gap: 9px; min-height: 38px; padding: 9px 13px; border-radius: 999px; background: rgba(0,0,0,.42); border: 1px solid rgba(255,255,255,.14); color: rgba(255,255,255,.82); font-size: .9rem; backdrop-filter: blur(10px); }
        .party-invite-ticket { max-width: 1180px; margin: 0 auto; padding: 0 28px; }
        .party-invite-content { max-width: 1180px; margin: 0 auto; padding: 18px 28px 64px; display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 18px; align-items: start; }
        .party-invite-stack { display: flex; flex-direction: column; gap: 16px; }
        .party-invite-rsvp { position: sticky; top: 18px; }
        @media (max-width: 860px) {
          .party-invite-hero-inner { padding: 62px 20px 34px; min-height: 560px; }
          .party-invite-title { font-size: clamp(2.25rem, 15vw, 4.2rem); line-height: .96; }
          .party-invite-host { margin-bottom: 18px; }
          .party-invite-meta { flex-direction: column; align-items: stretch; }
          .party-invite-meta-item { border-radius: 16px; }
          .party-invite-ticket { padding: 0 20px; }
          .party-invite-content { padding: 16px 20px 56px; display: flex; flex-direction: column; }
          .party-invite-rsvp { position: static; width: 100%; order: -1; }
        }
      `}</style>

      {/* Hero */}
      <div style={{ position: 'relative', minHeight: 'min(760px, 78vh)', ...heroBg }}>
        <InviteMotion type={invite.bg_animation} accent={accent} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.38) 46%, rgba(8,8,10,0.98) 100%)' }} />

        <div className="party-invite-hero-inner" style={{ position: 'relative' }}>
          {invite.is_turn_reveal && (
            <div className="party-invite-eyebrow">
              🎯 It's {invite.host?.full_name?.split(' ')[0] || 'their'} turn to host
            </div>
          )}
          {!invite.is_turn_reveal && (
            <div className="party-invite-eyebrow">
              Party Invite
            </div>
          )}

          <h1 className="party-invite-title">
            {invite.event?.title}
          </h1>

          {invite.host?.full_name && (
            <p className="party-invite-host">
              Hosted by {invite.host.full_name}
            </p>
          )}

          <div className="party-invite-meta">
            {dateStr && (
              <div className="party-invite-meta-item">
                <CalIcon /><span>{dateStr}</span>
              </div>
            )}
            {invite.event?.location && (
              <div className="party-invite-meta-item">
                <PinIcon /><span>{invite.event.location}</span>
              </div>
            )}
          </div>
          <AddToCalendar event={invite.event} accent={accent} />
        </div>
      </div>

      {/* Ticket perforated divider */}
      <div className="party-invite-ticket" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 16, top: -12, width: 24, height: 24, borderRadius: '50%', background: '#08080a', zIndex: 10 }} />
        <div style={{ position: 'absolute', right: 16, top: -12, width: 24, height: 24, borderRadius: '50%', background: '#08080a', zIndex: 10 }} />
        <div style={{ borderTop: '2px dashed rgba(255,255,255,0.12)', position: 'relative', zIndex: 5 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Admit One</span>
          <span style={{ fontFamily: "'Space Mono', 'Courier New', monospace", fontSize: '0.78rem', fontWeight: 700, color: accent, letterSpacing: '0.2em' }}>
            {admitCode}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="party-invite-content">
        <div className="party-invite-stack">

        {guestAccess && (
          <CapacityBar going={goingCount} max={invite.event?.max_attendees} accent={accent} />
        )}

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
        {!guestAccess && (
          <div style={{
            background: vars.sectionBg, borderRadius: 16, padding: '20px',
            border: vars.sectionBorder,
            backdropFilter: vars.blur ? 'blur(8px)' : 'none',
          }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Who's coming</h2>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.58)', fontSize: '0.9rem', lineHeight: 1.55 }}>
              RSVP first to see who else has said yes.
            </p>
          </div>
        )}

        {guestAccess && guestsLoading && (
          <div style={{
            background: vars.sectionBg, borderRadius: 16, padding: '20px',
            border: vars.sectionBorder,
            color: 'rgba(255,255,255,0.58)',
          }}>
            Loading guest list...
          </div>
        )}

        {guestAccess && !guestsLoading && goingCount > 0 && (
          <div style={{
            background: vars.sectionBg, borderRadius: 16, padding: '20px',
            border: vars.sectionBorder,
            backdropFilter: vars.blur ? 'blur(8px)' : 'none',
          }}>
            <h2 style={{ margin: '0 0 14px', fontSize: '1rem', fontWeight: 700, color: '#fff' }}>Who's coming</h2>
            <GuestList guests={guests.guests} memberGroups={guests.member_groups} accentColor={accent} />
          </div>
        )}
        </div>

        {/* RSVP */}
        <div className="party-invite-rsvp" style={{
          background: vars.cardBg, borderRadius: 18, padding: '22px',
          border: vars.cardBorder, boxShadow: vars.cardShadow,
          backdropFilter: vars.blur ? 'blur(12px)' : 'none',
        }}>
          <p style={{ margin: '0 0 8px', color: accent, fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>
            RSVP
          </p>
          <h2 style={{ margin: '0 0 16px', fontSize: '1.35rem', fontWeight: 850, color: '#fff' }}>Are you coming?</h2>
          <RsvpBlock token={token} accentColor={accent} onRsvpd={handleRsvpd} />
        </div>

        <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#2a2a32', fontSize: '0.72rem', marginTop: 18 }}>
          Made with <Link to="/" style={{ color: '#38383f', textDecoration: 'none' }}>clubPal</Link>
        </p>
      </div>
    </div>
  )
}
