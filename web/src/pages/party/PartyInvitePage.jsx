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
        blur: false, blurAmount: '0px',
      }
    case 'minimal':
      return {
        cardBg: '#111114',
        cardBorder: '1px solid #1c1c24',
        cardShadow: 'none',
        blur: false, blurAmount: '0px',
      }
    case 'frosted':
      return {
        cardBg: 'rgba(255,255,255,0.13)',
        cardBorder: '1px solid rgba(255,255,255,0.22)',
        cardShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)',
        blur: true, blurAmount: '22px',
      }
    case 'velvet':
      return {
        cardBg: 'rgba(14,8,22,0.94)',
        cardBorder: `2px solid ${accent}55`,
        cardShadow: `0 4px 28px ${accent}22, 0 0 0 1px ${accent}11`,
        blur: false, blurAmount: '0px',
      }
    case 'bold':
      return {
        cardBg: `${accent}1a`,
        cardBorder: `1px solid ${accent}66`,
        cardShadow: `0 8px 24px ${accent}22`,
        blur: false, blurAmount: '0px',
      }
    default: // glass
      return {
        cardBg: 'rgba(255,255,255,0.06)',
        cardBorder: '1px solid rgba(255,255,255,0.1)',
        cardShadow: '0 8px 32px rgba(0,0,0,0.4)',
        blur: true, blurAmount: '8px',
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
  const [guests, setGuests]   = useState({ guests: [], member_groups: [], item_brings: {}, free_brings: [] })
  const [comments, setComments] = useState(null)
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
      setGuests({ guests: [], member_groups: [], item_brings: {}, free_brings: [] })
    } finally {
      setGuestsLoading(false)
    }
    try {
      const cmt = await axios.get(`${EVENTS_BASE}/p/${token}/comments`, {
        params: { guest_id: access.guest_id, edit_token: access.edit_token },
      })
      setComments(cmt.data)
    } catch {
      setComments(null)
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

  const accent    = invite.accent_color || '#f43f5e'
  const gradPair  = THEME_GRAD[invite.theme_activity_type] || THEME_GRAD.other
  const vars      = styleVars(invite.style || 'glass', accent)
  const dateStr   = formatDate(invite.event?.scheduled_date)
  const coverPos  = invite.cover_image_position || '50% 50%'
  const admitCode = token.slice(-8).toUpperCase()

  const goingGuests = guests.guests?.filter(g => g.rsvp_status === 'going' || g.status === 'going') || []
  const goingCount  = goingGuests.length
    + (guests.member_groups?.reduce((s, mg) => s + (mg.members?.length || 0), 0) || 0)

  const heroBg = invite.cover_image_url
    ? { backgroundImage: `url(${invite.cover_image_url})`, backgroundSize: 'cover', backgroundPosition: coverPos }
    : { background: `linear-gradient(145deg, ${gradPair[0]} 0%, ${gradPair[1]} 100%)` }

  const cardBlur = vars.blur ? `blur(${vars.blurAmount})` : 'none'

  return (
    <div style={{ minHeight: '100vh', background: '#08080a', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`:root { --pi-card-bg: ${vars.cardBg}; --pi-card-border: ${vars.cardBorder}; --pi-card-shadow: ${vars.cardShadow}; --pi-card-blur: ${cardBlur}; }`}</style>
      <style>{`
        .pi-wrap { max-width: 960px; margin: 0 auto; padding: 0 24px; }
        .pi-hero-inner { padding: 100px 24px 56px; max-width: 960px; margin: 0 auto; display: flex; flex-direction: column; justify-content: flex-end; min-height: min(680px, 80vh); }
        .pi-eyebrow { display: inline-flex; align-items: center; gap: 7px; width: fit-content; margin-bottom: 18px; background: rgba(0,0,0,0.5); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.16); border-radius: 999px; padding: 6px 14px; font-size: .72rem; font-weight: 700; color: rgba(255,255,255,.9); letter-spacing: .04em; text-transform: uppercase; }
        .pi-title { margin: 0 0 14px; font-size: clamp(2.6rem, 7vw, 5.8rem); font-weight: 950; line-height: .9; color: #fff; letter-spacing: -1px; text-shadow: 0 2px 20px rgba(0,0,0,0.5); }
        .pi-host { margin: 0 0 22px; color: rgba(255,255,255,.6); font-size: .95rem; display: flex; align-items: center; gap: 8px; }
        .pi-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .pi-chip { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; background: rgba(0,0,0,.45); border: 1px solid rgba(255,255,255,.13); color: rgba(255,255,255,.85); font-size: .85rem; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
        .pi-content { max-width: 960px; margin: 0 auto; padding: 20px 24px 80px; display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; align-items: start; }
        .pi-left { display: flex; flex-direction: column; gap: 14px; }
        .pi-right { position: sticky; top: 20px; display: flex; flex-direction: column; gap: 14px; }
        .pi-card { border-radius: 16px; padding: 20px; border: var(--pi-card-border); background: var(--pi-card-bg); box-shadow: var(--pi-card-shadow); backdrop-filter: var(--pi-card-blur); -webkit-backdrop-filter: var(--pi-card-blur); }
        .pi-section-title { margin: 0 0 14px; font-size: .85rem; font-weight: 800; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: .08em; }
        .pi-perforated { position: relative; padding: 0 24px; max-width: 960px; margin: 0 auto; }
        @media (max-width: 780px) {
          .pi-hero-inner { padding: 70px 20px 40px; min-height: 520px; }
          .pi-title { font-size: clamp(2.2rem, 14vw, 3.6rem); }
          .pi-content { padding: 16px 20px 60px; grid-template-columns: 1fr; }
          .pi-right { position: static; order: -1; }
          .pi-perforated { padding: 0 20px; }
        }
      `}</style>

      {/* ─── Hero ─── */}
      <div style={{ position: 'relative', overflow: 'hidden', ...heroBg }}>
        <InviteMotion type={invite.bg_animation} accent={accent} />
        {/* layered gradient: top-dim → transparent → heavy bottom fade */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.08) 35%, rgba(0,0,0,0.55) 70%, rgba(8,8,10,1) 100%)' }} />
        {/* subtle accent glow at bottom */}
        {invite.cover_image_url && (
          <div style={{ position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 60, background: `radial-gradient(ellipse, ${accent}30 0%, transparent 70%)`, filter: 'blur(20px)', pointerEvents: 'none' }} />
        )}

        <div className="pi-hero-inner" style={{ position: 'relative' }}>
          <div className="pi-eyebrow">
            {invite.is_turn_reveal
              ? `🎯 ${invite.host?.full_name?.split(' ')[0] || 'Their'} turn to host`
              : '🎉 Party Invite'}
          </div>

          <h1 className="pi-title">{invite.event?.title}</h1>

          {invite.host?.full_name && (
            <p className="pi-host">
              <span style={{ width: 28, height: 28, borderRadius: '50%', background: `${accent}44`, border: `1.5px solid ${accent}88`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '.7rem', fontWeight: 800, color: accent, flexShrink: 0 }}>
                {invite.host.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
              Hosted by {invite.host.full_name}
            </p>
          )}

          <div className="pi-chips">
            {dateStr && (
              <div className="pi-chip"><CalIcon /><span>{dateStr}</span></div>
            )}
            {invite.event?.location && (
              <div className="pi-chip"><PinIcon /><span>{invite.event.location}</span></div>
            )}
            {goingCount > 0 && (
              <div className="pi-chip">
                <span>👥</span><span>{goingCount} going</span>
              </div>
            )}
          </div>

          <AddToCalendar event={invite.event} accent={accent} />
        </div>
      </div>

      {/* ─── Ticket perforated strip ─── */}
      <div className="pi-perforated" style={{ position: 'relative', marginTop: 0 }}>
        <div style={{ position: 'absolute', left: 4, top: -13, width: 26, height: 26, borderRadius: '50%', background: '#08080a', zIndex: 10 }} />
        <div style={{ position: 'absolute', right: 4, top: -13, width: 26, height: 26, borderRadius: '50%', background: '#08080a', zIndex: 10 }} />
        <div style={{ borderTop: '1.5px dashed rgba(255,255,255,0.1)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0' }}>
          <span style={{ fontSize: '.62rem', color: 'rgba(255,255,255,0.22)', letterSpacing: '.18em', textTransform: 'uppercase' }}>Party Pass</span>
          <span style={{ fontFamily: "'Space Mono', 'Courier New', monospace", fontSize: '.72rem', fontWeight: 700, color: accent, letterSpacing: '.22em' }}>
            {admitCode}
          </span>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="pi-content">

        {/* ── Left column ── */}
        <div className="pi-left">

          {/* Going count + capacity */}
          {guestAccess && invite.event?.max_attendees && (
            <div className="pi-card">
              <CapacityBar going={goingCount} max={invite.event.max_attendees} accent={accent} />
            </div>
          )}

          {/* Description */}
          {invite.event?.description && (
            <div className="pi-card">
              <p className="pi-section-title">About this event</p>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.65)', fontSize: '.88rem', lineHeight: 1.65 }}>
                {invite.event.description}
              </p>
            </div>
          )}

          {/* Bring list */}
          {invite.bring_list_enabled && invite.items?.length > 0 && (
            <div className="pi-card">
              <p className="pi-section-title">What to bring</p>
              {invite.items.map((item, i) => {
                const taken = item.claim_count >= item.max_claims
                const claimers = guestAccess ? (guests.item_brings?.[String(item.id)] || []) : []
                return (
                  <div key={item.id} style={{
                    padding: '10px 0',
                    borderBottom: i < invite.items.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: taken ? 'rgba(255,255,255,0.3)' : '#fff', fontSize: '.88rem' }}>
                        {item.emoji && <span style={{ marginRight: 6 }}>{item.emoji}</span>}
                        {item.label}
                      </span>
                      <span style={{
                        fontSize: '.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                        background: taken ? 'rgba(255,255,255,0.05)' : `${accent}20`,
                        color: taken ? 'rgba(255,255,255,0.2)' : accent,
                      }}>
                        {taken ? 'Taken' : `${item.max_claims - item.claim_count} left`}
                      </span>
                    </div>
                    {claimers.length > 0 && (
                      <div style={{ fontSize: '.74rem', color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                        {claimers.map(c => c.note ? `${c.name} (${c.note})` : c.name).join(', ')}
                      </div>
                    )}
                  </div>
                )
              })}
              {guestAccess && guests.free_brings?.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '.78rem', color: 'rgba(255,255,255,0.55)' }}>
                  Also bringing: {guests.free_brings.map(b => b.note ? `${b.name} — ${b.note}` : b.name).join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Guest list */}
          {!guestAccess && (
            <div className="pi-card" style={{ textAlign: 'center', padding: '28px 20px' }}>
              <div style={{ fontSize: '1.6rem', marginBottom: 10 }}>🎊</div>
              <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#fff', fontSize: '.95rem' }}>Who's coming?</p>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '.82rem', lineHeight: 1.55 }}>
                RSVP first to see the full guest list.
              </p>
            </div>
          )}

          {guestAccess && guestsLoading && (
            <div className="pi-card" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '.85rem' }}>Loading guests…</div>
          )}

          {guestAccess && !guestsLoading && (
            <div className="pi-card">
              <p className="pi-section-title">Who's coming · {goingCount} going</p>
              {goingCount > 0
                ? <GuestList guests={guests.guests} memberGroups={guests.member_groups} accentColor={accent} />
                : <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: '.85rem' }}>You're the first one! Invite your friends.</p>
              }
            </div>
          )}

          {/* Comments — visible after RSVP, read-only for guests */}
          {guestAccess && comments && (
            <div className="pi-card">
              <p className="pi-section-title">Comments</p>
              {comments.comments?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {comments.comments.map(c => (
                    <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: c.author?.avatar_url ? `center/cover url(${c.author.avatar_url})` : `${accent}33`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '.7rem', fontWeight: 700, color: accent,
                      }}>
                        {!c.author?.avatar_url && (c.author?.full_name?.[0]?.toUpperCase() || '?')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#fff' }}>{c.author?.full_name || 'Member'}</div>
                        <div style={{ fontSize: '.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{c.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: '.85rem' }}>No comments yet.</p>
              )}
              <div style={{
                marginTop: 14, padding: '12px 14px', borderRadius: 12,
                background: `${accent}12`, border: `1px solid ${accent}28`,
                fontSize: '.82rem', color: 'rgba(255,255,255,0.7)',
              }}>
                Want to join the conversation? <a href="/register" style={{ color: accent, fontWeight: 700, textDecoration: 'none' }}>Create an account</a> to comment.
              </div>
            </div>
          )}
        </div>

        {/* ── Right column — RSVP ── */}
        <div className="pi-right">
          <div style={{
            borderRadius: 18, overflow: 'hidden',
            border: vars.cardBorder,
            boxShadow: `${vars.cardShadow}, 0 0 40px ${accent}18`,
          }}>
            {/* Accent header strip */}
            <div style={{
              padding: '16px 20px 14px',
              background: `linear-gradient(135deg, ${accent}22 0%, ${accent}0a 100%)`,
              borderBottom: `1px solid ${accent}22`,
            }}>
              <p style={{ margin: 0, color: accent, fontSize: '.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em' }}>
                {invite.event?.title?.length > 28 ? invite.event.title.slice(0, 27) + '…' : invite.event?.title}
              </p>
              <h2 style={{ margin: '4px 0 0', fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>Are you coming?</h2>
            </div>
            <div style={{ padding: '18px 20px 20px', background: vars.cardBg, backdropFilter: cardBlur }}>
              <RsvpBlock token={token} accentColor={accent} onRsvpd={handleRsvpd} />
            </div>
          </div>

          {/* clubPal footer link */}
          <p style={{ textAlign: 'center', color: '#2a2a32', fontSize: '.7rem', margin: 0 }}>
            Made with <Link to="/" style={{ color: '#38383f', textDecoration: 'none' }}>clubPal</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
