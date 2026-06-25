import { useState } from 'react'
import { eventsApi } from '../../api/events'

const ACCENT_DEFAULTS = {
  dining: '#f59e0b', hiking: '#22d3a0', gaming: '#a855f7',
  movies: '#6366f1', arts: '#fb7185', other: '#f43f5e',
}

function formatDateShort(dt) {
  if (!dt) return null
  const d = new Date(dt)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function CapacityBar({ going, max, accent }) {
  if (!max) return null
  const pct = Math.min(100, Math.round((going / max) * 100))
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
          {going} / {max} spots
        </span>
        <span style={{ fontSize: '0.75rem', color: accent }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: accent, borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

function InviteCard({ invite, userId, onRsvp }) {
  const [responding, setResponding] = useState(false)
  const accent = invite.accent_color || ACCENT_DEFAULTS[invite.activity_type] || '#f43f5e'

  async function rsvp(status) {
    setResponding(true)
    try {
      await eventsApi.rsvp(invite.event_id, userId, status)
      onRsvp(invite.event_id)
    } catch {
      setResponding(false)
    }
  }

  return (
    <div style={{
      minWidth: 280, maxWidth: 320, flexShrink: 0,
      background: 'var(--s2)', borderRadius: 16,
      border: `1.5px solid ${accent}44`,
      overflow: 'hidden', scrollSnapAlign: 'start',
    }}>
      {/* Accent top strip */}
      <div style={{ height: 4, background: accent }} />

      {/* Cover or gradient */}
      {invite.cover_image_url ? (
        <div style={{
          height: 100,
          backgroundImage: `url(${invite.cover_image_url})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.6))' }} />
        </div>
      ) : (
        <div style={{ height: 100, background: `linear-gradient(135deg, ${accent}44, ${accent}11)` }} />
      )}

      <div style={{ padding: '14px 16px 16px' }}>
        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', background: `${accent}22`, borderRadius: 6, padding: '2px 8px', marginBottom: 8 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: accent, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Party Invite</span>
        </div>

        <h3 style={{ margin: '0 0 4px', color: 'var(--t1)', fontSize: '1rem', fontWeight: 700, lineHeight: 1.3 }}>
          {invite.title}
        </h3>

        {invite.host?.full_name && (
          <p style={{ margin: '0 0 8px', color: 'var(--t3)', fontSize: '0.78rem' }}>
            by {invite.host.full_name}
          </p>
        )}

        {invite.scheduled_date && (
          <p style={{ margin: '0 0 4px', color: 'var(--t2)', fontSize: '0.82rem' }}>
            {formatDateShort(invite.scheduled_date)}
          </p>
        )}

        {invite.location && (
          <p style={{ margin: 0, color: 'var(--t3)', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {invite.location}
          </p>
        )}

        <CapacityBar going={invite.going_count || 0} max={invite.max_attendees} accent={accent} />

        {/* RSVP buttons */}
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          {[
            { status: 'going',     label: 'Going',  color: 'var(--green)' },
            { status: 'maybe',     label: 'Maybe',  color: 'var(--amber)' },
            { status: 'not_going', label: "Can't",  color: 'var(--t3)' },
          ].map(({ status, label, color }) => (
            <button
              key={status}
              disabled={responding}
              onClick={() => rsvp(status)}
              style={{
                flex: 1, padding: '8px 4px', borderRadius: 8, border: `1px solid ${color}44`,
                background: `${color}11`, color, fontWeight: 600, fontSize: '0.8rem',
                cursor: responding ? 'not-allowed' : 'pointer', opacity: responding ? 0.6 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function PartyInviteCarousel({ invites, userId, onRsvp }) {
  const [dotIndex, setDotIndex] = useState(0)

  if (!invites?.length) return null

  function handleScroll(e) {
    const scrollLeft = e.target.scrollLeft
    const cardWidth  = 300
    setDotIndex(Math.round(scrollLeft / cardWidth))
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ margin: '0 0 10px', color: 'var(--t3)', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Pending Invites · {invites.length}
      </p>
      <div
        onScroll={handleScroll}
        style={{
          display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none', paddingBottom: 4,
        }}
      >
        {invites.map(inv => (
          <InviteCard
            key={inv.token}
            invite={inv}
            userId={userId}
            onRsvp={onRsvp}
          />
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
