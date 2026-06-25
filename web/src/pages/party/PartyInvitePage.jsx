import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import StickerLayer from '../../components/party/StickerLayer'
import RsvpBlock    from '../../components/party/RsvpBlock'
import GuestList    from '../../components/party/GuestList'

const EVENTS_BASE = import.meta.env.VITE_EVENTS_URL || '/api/events'

const HERO_GRADIENTS = {
  dining:  'linear-gradient(135deg, #7c4a00, #f59e0b)',
  hiking:  'linear-gradient(135deg, #064e3b, #22d3a0)',
  gaming:  'linear-gradient(135deg, #1e1b4b, #a855f7)',
  movies:  'linear-gradient(135deg, #0f172a, #6366f1)',
  arts:    'linear-gradient(135deg, #4a044e, #fb7185)',
  other:   'linear-gradient(135deg, #1a0010, #f43f5e)',
}

export default function PartyInvitePage() {
  const { token }         = useParams()
  const [invite, setInvite]   = useState(null)
  const [guests, setGuests]   = useState({ guests: [], member_groups: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [inv, gst] = await Promise.all([
          axios.get(`${EVENTS_BASE}/p/${token}`),
          axios.get(`${EVENTS_BASE}/p/${token}/guests`),
        ])
        setInvite(inv.data)
        setGuests(gst.data)
      } catch {
        setError('Invite not found or has been removed.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t2)' }}>
      Loading…
    </div>
  )
  if (error) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t2)', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontSize: '2rem' }}>😕</span>
      <p>{error}</p>
    </div>
  )

  const accent      = invite.accent_color || '#f43f5e'
  const heroGrad    = HERO_GRADIENTS[invite.theme_activity_type] || HERO_GRADIENTS.other
  const heroStyle   = invite.cover_image_url
    ? { background: `url(${invite.cover_image_url}) center/cover` }
    : { background: heroGrad }

  const totalGoing = (guests.guests?.filter(g => g.status === 'going').length || 0)
    + (guests.member_groups?.reduce((s, mg) => s + mg.members.length, 0) || 0)

  const hasGuests = totalGoing > 0
    || guests.member_groups?.some(mg => mg.members.length > 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--t1)', fontFamily: 'inherit' }}>
      {/* Hero */}
      <div style={{ position: 'relative', minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: '32px 24px', ...heroStyle }}>
        <StickerLayer stickers={invite.sticker_data || []} />
        {/* Subtle dark overlay for text readability */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 60%)' }} />
        <div style={{ position: 'relative', textAlign: 'center' }}>
          {invite.is_turn_reveal && (
            <div style={{ display: 'inline-block', background: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: '4px 14px', fontSize: '0.8rem', color: '#fff', marginBottom: 10 }}>
              🎯 It's {invite.host?.full_name?.split(' ')[0] || 'their'} turn to host
            </div>
          )}
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.5)', margin: '0 0 8px' }}>
            {invite.event?.title}
          </h1>
          {invite.event?.scheduled_date && (
            <p style={{ color: 'rgba(255,255,255,0.85)', margin: '0 0 6px', fontSize: '1rem' }}>
              {new Date(invite.event.scheduled_date).toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
              {invite.event.location && ` · ${invite.event.location}`}
            </p>
          )}
          {totalGoing > 0 && (
            <p style={{ color: accent, fontWeight: 700, margin: 0, fontSize: '1rem' }}>
              {totalGoing} going
            </p>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>
        {/* RSVP block */}
        <div style={{ background: 'var(--s2)', borderRadius: 16, padding: 20, marginBottom: 20, border: '1px solid var(--s3)' }}>
          <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: '1.1rem', color: 'var(--t1)' }}>RSVP</h2>
          <RsvpBlock token={token} accentColor={accent} />
        </div>

        {/* Bring list */}
        {invite.bring_list_enabled && invite.items?.length > 0 && (
          <div style={{ background: 'var(--s2)', borderRadius: 16, padding: 20, marginBottom: 20, border: '1px solid var(--s3)' }}>
            <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: '1.1rem', color: 'var(--t1)' }}>What to Bring</h2>
            {invite.items.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--s3)' }}>
                <span style={{ color: 'var(--t1)' }}>{item.emoji} {item.label}</span>
                <span style={{ color: item.claim_count >= item.max_claims ? 'var(--t3)' : accent, fontSize: '0.8rem', fontWeight: 600 }}>
                  {item.claim_count >= item.max_claims ? 'Taken' : `${item.max_claims - item.claim_count} left`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Guest list */}
        {hasGuests && (
          <div style={{ background: 'var(--s2)', borderRadius: 16, padding: 20, border: '1px solid var(--s3)' }}>
            <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: '1.1rem', color: 'var(--t1)' }}>Who's Coming</h2>
            <GuestList guests={guests.guests} memberGroups={guests.member_groups} accentColor={accent} />
          </div>
        )}
      </div>
    </div>
  )
}
