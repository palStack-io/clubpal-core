import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { eventsApi } from '../../api/events'
import { groupsApi } from '../../api/groups'
import { gatewayClient } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import AppShell from '../../components/shell/AppShell'
import BringListBuilder from '../../components/party/BringListBuilder'

const ACTIVITIES = [
  { type: 'dining', label: 'Dining', icon: '🍽️', accent: '#f59e0b', mood: 'Warm table energy' },
  { type: 'hiking', label: 'Hiking', icon: '🥾', accent: '#22d3a0', mood: 'Fresh air plans' },
  { type: 'gaming', label: 'Gaming', icon: '🎮', accent: '#a855f7', mood: 'Low stakes, high chaos' },
  { type: 'movies', label: 'Movies', icon: '🎬', accent: '#6366f1', mood: 'Tickets and snacks' },
  { type: 'arts', label: 'Arts', icon: '🎨', accent: '#fb7185', mood: 'Make something weird' },
  { type: 'other', label: 'Party', icon: '🎉', accent: '#f43f5e', mood: 'Open invite' },
]

const STYLES = [
  { value: 'glass',   label: 'Glass',   desc: 'Soft blur, translucent panels' },
  { value: 'frosted', label: 'Frosted', desc: 'Heavy blur, bright glass feel' },
  { value: 'neon',    label: 'Neon',    desc: 'Dark card with glowing edges' },
  { value: 'velvet',  label: 'Velvet',  desc: 'Rich dark with accent borders' },
  { value: 'bold',    label: 'Bold',    desc: 'Accent-filled vivid panels' },
  { value: 'minimal', label: 'Minimal', desc: 'Flat, quiet, high contrast' },
]

function previewCardStyle(style, accent) {
  switch (style) {
    case 'neon':    return { border: `1px solid ${accent}`, background: '#08080d', boxShadow: `0 0 34px ${accent}55`, backdropFilter: 'none' }
    case 'minimal': return { border: '1px solid #1c1c24', background: '#101014', boxShadow: 'none', backdropFilter: 'none' }
    case 'frosted': return { border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.13)', boxShadow: '0 8px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(22px)' }
    case 'velvet':  return { border: `2px solid ${accent}55`, background: 'rgba(14,8,22,0.94)', boxShadow: `0 4px 28px ${accent}22`, backdropFilter: 'none' }
    case 'bold':    return { border: `1px solid ${accent}66`, background: `${accent}1a`, boxShadow: `0 8px 24px ${accent}22`, backdropFilter: 'none' }
    default:        return { border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', boxShadow: '0 18px 50px rgba(0,0,0,0.22)', backdropFilter: 'blur(18px)' }
  }
}

const ANIMATIONS = [
  { value: 'confetti', label: 'Confetti', desc: 'Little party flecks' },
  { value: 'sparkles', label: 'Sparkles', desc: 'Glints over the banner' },
  { value: 'fireworks', label: 'Fireworks', desc: 'Radial bursts and pops' },
  { value: 'aurora', label: 'Aurora', desc: 'Bright animated color ribbons' },
  { value: 'spotlight', label: 'Spotlight', desc: 'Bold stage-light sweep' },
  { value: 'none', label: 'None', desc: 'Still and simple' },
]

const ACCENTS = ['#f43f5e', '#f59e0b', '#22d3a0', '#6366f1', '#a855f7', '#14b8a6']

const inputStyle = {
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid var(--s3)',
  background: 'var(--s2)',
  color: 'var(--t1)',
  colorScheme: 'dark',
  fontSize: '0.95rem',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
}

const labelStyle = {
  color: 'var(--t2)',
  fontSize: '0.75rem',
  fontWeight: 700,
  marginBottom: 6,
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section style={{
      background: 'var(--s2)',
      border: '1px solid var(--s3)',
      borderRadius: 14,
      padding: 18,
    }}>
      <h2 style={{ margin: '0 0 14px', color: 'var(--t1)', fontSize: '0.98rem', fontWeight: 800 }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function formatPreviewDate(value) {
  if (!value) return 'Date to be announced'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Date to be announced'
  return parsed.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function CreatePartyInvite() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const coverRef = useRef(null)
  const inviteSearchSeqRef = useRef(0)
  const [groups, setGroups] = useState([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupsError, setGroupsError] = useState('')
  const [selectedGroups, setSelectedGroups] = useState([])
  const [groupSelect, setGroupSelect] = useState('')
  const [inviteQuery, setInviteQuery] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteResults, setInviteResults] = useState([])
  const [directInvitees, setDirectInvitees] = useState([])
  const [form, setForm] = useState({
    title: '',
    scheduled_date: '',
    location: '',
    description: '',
    max_attendees: '',
    activity_type: 'other',
    accent_color: '#f43f5e',
    style: 'glass',
    bg_animation: 'confetti',
    cover_image_url: '',
    bring_list_enabled: false,
    bring_list_type: 'freeform',
    items: [],
  })
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [coverPosition, setCoverPosition] = useState('50% 50%')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [createdToken, setCreatedToken] = useState(null)

  useEffect(() => {
    if (user?.id) {
      setGroupsLoading(true)
      setGroupsError('')
      groupsApi.getUserGroups(user.id)
        .then(data => {
          const rows = Array.isArray(data) ? data : data?.groups || []
          setGroups(rows.map(g => ({ ...g, id: Number(g.id) })))
        })
        .catch(() => setGroupsError('Could not load your clubs.'))
        .finally(() => setGroupsLoading(false))
    }
  }, [user?.id])

  useEffect(() => {
    return () => {
      if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview)
    }
  }, [coverPreview])

  const activity = useMemo(
    () => ACTIVITIES.find(a => a.type === form.activity_type) || ACTIVITIES[ACTIVITIES.length - 1],
    [form.activity_type]
  )

  const bannerSrc = coverPreview || form.cover_image_url.trim()

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function toggleGroup(id) {
    setSelectedGroups(g => g.includes(id) ? g.filter(x => x !== id) : [...g, id])
  }

  async function searchInvitees(value) {
    setInviteQuery(value)
    if (value.trim().length < 2) { setInviteResults([]); return }
    const searchSeq = ++inviteSearchSeqRef.current
    try {
      const r = await gatewayClient.get('/users/search', { params: { username: value.trim() } })
      if (inviteSearchSeqRef.current === searchSeq) {
        setInviteResults(Array.isArray(r.data) ? r.data : [])
      }
    } catch {
      if (inviteSearchSeqRef.current === searchSeq) setInviteResults([])
    }
  }

  function addGroupFromSelect(value) {
    if (!value) return
    const id = Number(value)
    setSelectedGroups(prev => prev.includes(id) ? prev : [...prev, id])
    setGroupSelect('')
  }

  function selectAllGroups() {
    setSelectedGroups(groups.map(g => g.id))
  }

  function addDirectUser(u) {
    if (directInvitees.some(p => p.type === 'user' && p.id === u.id)) return
    setDirectInvitees(prev => [...prev, { type: 'user', id: u.id, label: u.full_name || u.username }])
    setInviteQuery('')
    setInviteResults([])
  }

  function addDirectEmail() {
    const email = inviteEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) return
    if (directInvitees.some(p => p.type === 'email' && p.email === email)) return
    setDirectInvitees(prev => [...prev, { type: 'email', email, label: email }])
    setInviteEmail('')
  }

  function handleCoverPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview)
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
    setField('cover_image_url', '')
    e.target.value = ''
  }

  function clearCover() {
    if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview)
    setCoverFile(null)
    setCoverPreview('')
    setField('cover_image_url', '')
  }

  async function publish() {
    setError('')
    setWarning('')
    if (!form.title.trim()) { setError('Event name is required.'); return }
    if (!user?.id) { setError('Please sign in again before creating an invite.'); return }

    setLoading(true)
    try {
      const scheduledDate = form.scheduled_date ? new Date(form.scheduled_date).toISOString() : null
      const coverUrl = form.cover_image_url.trim() || null
      const event = await eventsApi.create({
        title: form.title.trim(),
        scheduled_date: scheduledDate,
        location: form.location.trim() || null,
        description: form.description.trim() || null,
        max_attendees: form.max_attendees ? parseInt(form.max_attendees, 10) : null,
        group_id: selectedGroups[0] || null,
        activity_type: form.activity_type,
        bill_split_enabled: false,
        ratings_enabled: true,
        created_by: user.id,
        host_user_id: user.id,
        banner_url: coverUrl,
      })

      const invite = await eventsApi.createPartyInvite({
        event_id: event.id,
        group_ids: selectedGroups,
        theme_activity_type: form.activity_type,
        accent_color: form.accent_color,
        style: form.style,
        bg_animation: form.bg_animation,
        cover_image_url: coverUrl,
        cover_image_position: coverPosition,
        bring_list_enabled: form.activity_type === 'dining' ? false : form.bring_list_enabled,
        bring_list_type: form.bring_list_type,
        items: form.items,
      })

      const warnings = []
      if (coverFile) {
        try {
          const urlData = await eventsApi.getPartyInviteCoverUploadUrl(invite.token, coverFile.name, coverFile.type)
          const uploadRes = await fetch(urlData.upload_url, {
            method: 'PUT',
            headers: { 'Content-Type': coverFile.type },
            body: coverFile,
          })
          if (!uploadRes.ok) throw new Error(`Cover upload failed (${uploadRes.status})`)
          await eventsApi.updatePartyInvite(invite.token, {
            cover_image_url: urlData.public_url,
            cover_image_position: coverPosition,
          })
        } catch {
          warnings.push('The invite was created, but the cover image upload did not finish.')
        }
      }

      if (directInvitees.length > 0) {
        try {
          await eventsApi.inviteUsersToParty(invite.token, {
            user_ids: directInvitees.filter(p => p.type === 'user').map(p => p.id),
            emails: directInvitees.filter(p => p.type === 'email').map(p => p.email),
          })
        } catch {
          warnings.push('The invite exists, but some direct invites may need to be resent from manage invite.')
        }
      }

      setWarning(warnings.join(' '))
      setCreatedToken(invite.token)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(d => d.msg || String(d)).join('; ') : 'Failed to create invite.')
    } finally {
      setLoading(false)
    }
  }

  if (createdToken) {
    const shareUrl = `${window.location.origin}/p/${createdToken}`
    return (
      <AppShell>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px' }}>
          <div style={{ background: 'var(--s2)', border: '1px solid var(--s3)', borderRadius: 16, padding: 24 }}>
            <p style={{ margin: '0 0 8px', color: form.accent_color, fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Public invite live
            </p>
            <h1 style={{ margin: '0 0 16px', color: 'var(--t1)', fontSize: '1.7rem' }}>{form.title}</h1>
            <p style={{ margin: '0 0 14px', color: 'var(--t3)', fontSize: '0.92rem', lineHeight: 1.5 }}>
              This public link is ready to share. Selected clubs and direct invitees will see the same banner and invite styling on their dashboards and club pages.
            </p>
            {warning && (
              <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.28)', color: '#fbbf24', fontSize: '0.9rem' }}>
                {warning}
              </div>
            )}
            <div style={{ padding: 14, borderRadius: 12, background: 'var(--s3)', border: '1px solid var(--glass)', marginBottom: 16 }}>
              <code style={{ color: 'var(--t1)', fontSize: '0.9rem', wordBreak: 'break-all' }}>{shareUrl}</code>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => navigator.clipboard.writeText(shareUrl)} style={{ padding: '12px 16px', borderRadius: 10, border: 'none', background: form.accent_color, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                Copy link
              </button>
              <button type="button" onClick={() => navigate(`/party-invites/${createdToken}/manage`)} style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--s3)', background: 'transparent', color: 'var(--t1)', cursor: 'pointer' }}>
                Manage invite
              </button>
              <button type="button" onClick={() => window.open(`/p/${createdToken}`, '_blank')} style={{ padding: '12px 16px', borderRadius: 10, border: '1px solid var(--s3)', background: 'transparent', color: 'var(--t2)', cursor: 'pointer' }}>
                Open public link
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <style>{`
        @keyframes inviteFloat { from { transform: translateY(0) rotate(0deg); opacity: .25; } 50% { opacity: .85; } to { transform: translateY(-36px) rotate(18deg); opacity: .25; } }
        @keyframes inviteWave { from { transform: translateX(-18%); } to { transform: translateX(18%); } }
        @keyframes inviteGlow { 0%, 100% { opacity: .35; transform: scale(.9); } 50% { opacity: .9; transform: scale(1.08); } }
        @keyframes inviteBurst { 0% { transform: scale(.2); opacity: 0; } 28% { opacity: .95; } 100% { transform: scale(1.9); opacity: 0; } }
        @keyframes inviteSweep { from { transform: translateX(-50%) rotate(-12deg); opacity: .55; } to { transform: translateX(50%) rotate(12deg); opacity: .95; } }
        .cp-party-native-input::-webkit-calendar-picker-indicator {
          filter: invert(1) brightness(1.45);
          opacity: 0.9;
          cursor: pointer;
        }
        .cp-party-native-input::-webkit-inner-spin-button,
        .cp-party-native-input::-webkit-outer-spin-button {
          filter: invert(1) brightness(1.45);
          opacity: 0.9;
        }
        .cp-party-native-input:focus {
          border-color: ${form.accent_color};
          box-shadow: 0 0 0 3px ${form.accent_color}22;
        }
      `}</style>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 16px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <p style={{ margin: '0 0 6px', color: activity.accent, fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Party invite
            </p>
            <h1 style={{ margin: 0, color: 'var(--t1)', fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', letterSpacing: 0 }}>
              Create a shareable invite
            </h1>
          </div>
          <button type="button" onClick={() => navigate(-1)} style={{ padding: '10px 13px', borderRadius: 10, border: '1px solid var(--s3)', background: 'var(--s2)', color: 'var(--t2)', cursor: 'pointer' }}>
            Back
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Section title="Event Details">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 12 }}>
                <Field label="Event name *">
                  <input autoFocus value={form.title} onChange={e => setField('title', e.target.value)} placeholder="Summer BBQ, game night..." style={inputStyle} />
                </Field>
                <Field label="Date and time">
                  <input
                    className="cp-party-native-input"
                    type="datetime-local"
                    value={form.scheduled_date}
                    onChange={e => setField('scheduled_date', e.target.value)}
                    onClick={e => e.currentTarget.showPicker?.()}
                    onFocus={e => e.currentTarget.showPicker?.()}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  />
                </Field>
                <Field label="Max guests">
                  <input className="cp-party-native-input" type="number" min="1" value={form.max_attendees} onChange={e => setField('max_attendees', e.target.value)} placeholder="No limit" style={inputStyle} />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginTop: 12 }}>
                <Field label="Location">
                  <input value={form.location} onChange={e => setField('location', e.target.value)} placeholder="Address or venue name" style={inputStyle} />
                </Field>
                <Field label="Description">
                  <textarea value={form.description} onChange={e => setField('description', e.target.value)} rows={4} placeholder="Dress code, parking, what to expect..." style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
                </Field>
              </div>
            </Section>

            <Section title="Banner">
              <input ref={coverRef} type="file" accept="image/*" onChange={handleCoverPick} style={{ display: 'none' }} />
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}>
                {bannerSrc ? (
                  /* ── Drag-to-reposition framer ── */
                  <div>
                    <div
                      style={{ position: 'relative', height: 210, borderRadius: 12, overflow: 'hidden', cursor: 'crosshair', userSelect: 'none' }}
                      onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
                        const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
                        setCoverPosition(`${x}% ${y}%`)
                      }}
                      onMouseMove={e => {
                        if (e.buttons !== 1) return
                        const rect = e.currentTarget.getBoundingClientRect()
                        const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
                        const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
                        setCoverPosition(`${x}% ${y}%`)
                      }}
                    >
                      <img
                        src={bannerSrc}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: coverPosition, display: 'block', pointerEvents: 'none' }}
                        draggable={false}
                      />
                      {/* Crosshair */}
                      {(() => {
                        const [xPct, yPct] = coverPosition.split(' ').map(s => parseFloat(s))
                        return (
                          <div style={{ position: 'absolute', left: `${xPct}%`, top: `${yPct}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.6)', background: 'rgba(255,255,255,0.18)' }} />
                          </div>
                        )
                      })()}
                      {/* Label overlay */}
                      <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
                        <span style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: '0.72rem', fontWeight: 700, padding: '4px 12px', borderRadius: 999, letterSpacing: '0.05em' }}>
                          Click or drag to set focal point
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => coverRef.current?.click()} style={{
                    minHeight: 190, borderRadius: 12, border: '1px dashed var(--s3)', background: 'var(--s3)',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    <span style={{ fontSize: '1.8rem' }}>🖼️</span>
                    <span style={{ color: 'var(--t3)', fontSize: '0.88rem', fontWeight: 700 }}>Upload banner photo</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 260px' }}>
                    <Field label="Use image URL instead">
                      <input value={form.cover_image_url} onChange={e => { setCoverFile(null); setCoverPreview(''); setField('cover_image_url', e.target.value) }} placeholder="https://..." style={inputStyle} />
                    </Field>
                  </div>
                  <button type="button" onClick={() => coverRef.current?.click()} style={{ padding: '12px 14px', borderRadius: 10, border: 'none', background: form.accent_color, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                    {bannerSrc ? 'Change' : 'Choose file'}
                  </button>
                  {bannerSrc && (
                    <button type="button" onClick={clearCover} style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--s3)', background: 'transparent', color: 'var(--t2)', cursor: 'pointer' }}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </Section>

            <Section title="Invite Look">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 16 }}>
                <Field label="Activity">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {ACTIVITIES.map(a => {
                      const active = form.activity_type === a.type
                      return (
                        <button key={a.type} type="button" onClick={() => { setField('activity_type', a.type); setField('accent_color', a.accent) }} style={{
                          padding: '10px 8px',
                          borderRadius: 10,
                          border: `1px solid ${active ? a.accent : 'var(--s3)'}`,
                          background: active ? `${a.accent}18` : 'transparent',
                          color: active ? a.accent : 'var(--t2)',
                          cursor: 'pointer',
                          fontWeight: 800,
                        }}>
                          {a.icon} {a.label}
                        </button>
                      )
                    })}
                  </div>
                </Field>
                <div style={{ display: 'grid', gap: 12 }}>
                  <Field label="Accent color">
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {ACCENTS.map(color => (
                        <button key={color} type="button" aria-label={`Use ${color}`} onClick={() => setField('accent_color', color)} style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          border: form.accent_color === color ? '2px solid #fff' : '1px solid var(--s3)',
                          outline: form.accent_color === color ? `2px solid ${color}` : 'none',
                          background: color,
                          cursor: 'pointer',
                        }} />
                      ))}
                    </div>
                  </Field>
                  <Field label="Style">
                    <div style={{ display: 'flex', gap: 8 }}>
                      {STYLES.map(s => (
                        <button key={s.value} type="button" onClick={() => setField('style', s.value)} style={{
                          flex: 1,
                          padding: '10px 8px',
                          borderRadius: 10,
                          border: `1px solid ${form.style === s.value ? form.accent_color : 'var(--s3)'}`,
                          background: form.style === s.value ? `${form.accent_color}18` : 'transparent',
                          color: form.style === s.value ? form.accent_color : 'var(--t2)',
                          cursor: 'pointer',
                          fontWeight: 700,
                          textAlign: 'left',
                        }}>
                          <span style={{ display: 'block' }}>{s.label}</span>
                          <span style={{ display: 'block', marginTop: 3, color: 'var(--t3)', fontSize: '0.7rem', fontWeight: 500, lineHeight: 1.25 }}>{s.desc}</span>
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              </div>
            </Section>

            <Section title="Motion">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                {ANIMATIONS.map(a => {
                  const active = form.bg_animation === a.value
                  return (
                    <button key={a.value} type="button" onClick={() => setField('bg_animation', a.value)} style={{
                      padding: '11px 12px',
                      borderRadius: 10,
                      border: `1px solid ${active ? form.accent_color : 'var(--s3)'}`,
                      background: active ? `${form.accent_color}18` : 'transparent',
                      color: active ? form.accent_color : 'var(--t2)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}>
                      <span style={{ display: 'block', fontWeight: 800, fontSize: '0.84rem' }}>{a.label}</span>
                      <span style={{ display: 'block', marginTop: 3, color: 'var(--t3)', fontSize: '0.72rem', lineHeight: 1.25 }}>{a.desc}</span>
                    </button>
                  )
                })}
              </div>
            </Section>

            <Section title="Send To Clubs">
              <p style={{ margin: '0 0 14px', color: 'var(--t3)', fontSize: '0.84rem', lineHeight: 1.45 }}>
                Select one or more clubs to send this invite to everyone in those clubs. You can still add individual usernames or emails below.
              </p>

              {groupsLoading ? (
                <div style={{ padding: 14, borderRadius: 12, background: 'var(--s3)', color: 'var(--t3)', fontSize: '0.9rem' }}>
                  Loading your clubs...
                </div>
              ) : groupsError ? (
                <div style={{ padding: 14, borderRadius: 12, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.26)', color: '#f87171', fontSize: '0.9rem' }}>
                  {groupsError}
                </div>
              ) : groups.length === 0 ? (
                <div style={{ padding: 14, borderRadius: 12, background: 'var(--s3)', color: 'var(--t3)', fontSize: '0.9rem' }}>
                  You are not in any clubs yet. Use individual invites below or share the invite link after publishing.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                    <select
                      value={groupSelect}
                      onChange={e => addGroupFromSelect(e.target.value)}
                      style={{ ...inputStyle, flex: '1 1 240px', colorScheme: 'dark', cursor: 'pointer' }}
                    >
                      <option value="">Add a club...</option>
                      {groups.filter(g => !selectedGroups.includes(g.id)).map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={selectAllGroups}
                      disabled={selectedGroups.length === groups.length}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: `1px solid ${selectedGroups.length === groups.length ? 'var(--s3)' : form.accent_color}`,
                        background: selectedGroups.length === groups.length ? 'var(--s3)' : `${form.accent_color}14`,
                        color: selectedGroups.length === groups.length ? 'var(--t3)' : form.accent_color,
                        fontWeight: 800,
                        cursor: selectedGroups.length === groups.length ? 'default' : 'pointer',
                      }}
                    >
                      Select all clubs
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 10 }}>
                    {groups.map(g => {
                      const active = selectedGroups.includes(g.id)
                      const count = g.member_count ?? g.members_count ?? g.memberCount
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => toggleGroup(g.id)}
                          style={{
                            padding: 13,
                            borderRadius: 12,
                            border: `1px solid ${active ? form.accent_color : 'var(--s3)'}`,
                            background: active ? `${form.accent_color}16` : 'transparent',
                            color: active ? form.accent_color : 'var(--t1)',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
                            <span style={{ width: 18, height: 18, borderRadius: 9, border: `1px solid ${active ? form.accent_color : 'var(--s3)'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', flexShrink: 0 }}>
                              {active ? '✓' : ''}
                            </span>
                          </span>
                          <span style={{ display: 'block', marginTop: 6, color: 'var(--t3)', fontSize: '0.76rem', lineHeight: 1.25 }}>
                            {count != null ? `Sends to ${count} member${Number(count) === 1 ? '' : 's'}` : 'Sends to all club members'}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {selectedGroups.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                      <span style={{ color: 'var(--t2)', fontSize: '0.86rem', fontWeight: 800 }}>
                        {selectedGroups.length} club{selectedGroups.length > 1 ? 's' : ''} selected for mass invite
                      </span>
                      <button type="button" onClick={() => setSelectedGroups([])} style={{ border: '1px solid var(--s3)', background: 'transparent', color: 'var(--t3)', borderRadius: 9, padding: '7px 10px', cursor: 'pointer', fontWeight: 700 }}>
                        Clear clubs
                      </button>
                    </div>
                  )}
                </>
              )}
            </Section>

            <Section title="Invite People">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }}>
                <div style={{ position: 'relative' }}>
                  <Field label="Username">
                    <input value={inviteQuery} onChange={e => searchInvitees(e.target.value)} placeholder="Search username..." style={inputStyle} />
                  </Field>
                  {inviteResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: 'var(--s2)', border: '1px solid var(--s3)', borderRadius: 10, marginTop: 6, overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,0.34)' }}>
                      {inviteResults.map(u => (
                        <button key={u.id} type="button" onClick={() => addDirectUser(u)} style={{ display: 'block', width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: 'var(--t1)', textAlign: 'left', cursor: 'pointer' }}>
                          {u.full_name || u.username} <span style={{ color: 'var(--t3)' }}>@{u.username}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <Field label="Email">
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDirectEmail()} placeholder="name@email.com" style={inputStyle} />
                      <button type="button" onClick={addDirectEmail} style={{ padding: '0 14px', borderRadius: 10, border: 'none', background: form.accent_color, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Add</button>
                    </div>
                  </Field>
                </div>
              </div>
              </Section>

            {directInvitees.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {directInvitees.map((p, i) => (
                  <span key={`${p.type}-${p.id || p.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--s3)', fontSize: '0.82rem', fontWeight: 700 }}>
                    {p.label}
                    <button type="button" onClick={() => setDirectInvitees(prev => prev.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, fontWeight: 900 }}>x</button>
                  </span>
                ))}
              </div>
            )}

            <Section title="Bring List">
              <BringListBuilder
                enabled={form.bring_list_enabled && form.activity_type !== 'dining'}
                onToggle={() => setField('bring_list_enabled', !form.bring_list_enabled)}
                items={form.items}
                onItemsChange={v => setField('items', v)}
              />
              {form.activity_type === 'dining' && (
                <p style={{ color: 'var(--t3)', fontSize: '0.82rem', margin: '10px 0 0' }}>
                  Bring lists are turned off for dining invites.
                </p>
              )}
            </Section>

            {error && (
              <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(248,113,113,0.28)', background: 'rgba(248,113,113,0.1)', color: '#f87171', fontSize: '0.9rem' }}>
                {error}
              </div>
            )}

            <button type="button" disabled={loading} onClick={publish} style={{
              padding: '14px 18px',
              borderRadius: 12,
              border: 'none',
              background: form.accent_color,
              color: '#fff',
              cursor: loading ? 'default' : 'pointer',
              fontWeight: 900,
              fontSize: '1rem',
              opacity: loading ? 0.72 : 1,
            }}>
              {loading ? 'Creating invite...' : 'Publish invite'}
            </button>
          </div>

          <aside style={{ position: 'sticky', top: 18 }}>
            <div style={{
              borderRadius: 18,
              overflow: 'hidden',
              ...previewCardStyle(form.style, form.accent_color),
            }}>
              <div style={{
                position: 'relative',
                minHeight: 230,
                background: bannerSrc
                  ? `linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.72)), url(${bannerSrc}) ${coverPosition}/cover`
                  : `linear-gradient(135deg, ${form.accent_color}, #111827)`,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                overflow: 'hidden',
              }}>
                {form.bg_animation !== 'none' && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                    {form.bg_animation === 'waves' ? (
                      <div style={{ position: 'absolute', left: '-20%', right: '-20%', bottom: 28, height: 90, borderRadius: '50%', background: `radial-gradient(ellipse, ${form.accent_color}55, transparent 65%)`, animation: 'inviteWave 5s ease-in-out infinite alternate' }} />
                    ) : form.bg_animation === 'aurora' ? (
                      <>
                        <div style={{ position: 'absolute', inset: '-30%', background: `linear-gradient(115deg, transparent 4%, ${form.accent_color}aa 28%, rgba(255,255,255,0.42) 45%, #14b8a699 62%, transparent 86%)`, filter: 'blur(10px)', mixBlendMode: 'screen', animation: 'inviteSweep 4.6s ease-in-out infinite alternate' }} />
                        <div style={{ position: 'absolute', inset: '-18%', background: `linear-gradient(65deg, transparent 15%, #6366f188 42%, ${form.accent_color}77 58%, transparent 82%)`, filter: 'blur(18px)', mixBlendMode: 'screen', animation: 'inviteSweep 6.2s ease-in-out infinite alternate-reverse' }} />
                      </>
                    ) : form.bg_animation === 'spotlight' ? (
                      <>
                        <div style={{ position: 'absolute', inset: '-30%', background: 'linear-gradient(105deg, transparent 22%, rgba(255,255,255,0.64) 48%, transparent 72%)', filter: 'blur(4px)', mixBlendMode: 'screen', animation: 'inviteSweep 3.4s ease-in-out infinite alternate' }} />
                        <div style={{ position: 'absolute', inset: '-20%', background: `radial-gradient(circle at 50% 50%, ${form.accent_color}66, transparent 46%)`, filter: 'blur(10px)', opacity: 0.9 }} />
                      </>
                    ) : form.bg_animation === 'fireworks' ? (
                      [0, 1, 2, 3].map(i => (
                        <span key={i} style={{
                          position: 'absolute',
                          left: `${18 + i * 19}%`,
                          top: `${18 + (i % 2) * 30}%`,
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          border: `2px solid ${i % 2 ? '#fff' : form.accent_color}`,
                          boxShadow: `0 0 16px ${form.accent_color}88, inset 0 0 12px ${form.accent_color}55`,
                          opacity: 0,
                          animation: `inviteBurst ${1.8 + i * 0.18}s ease-out infinite`,
                          animationDelay: `${i * 0.32}s`,
                        }} />
                      ))
                    ) : [0, 1, 2, 3, 4, 5, 6].map(i => (
                      <span key={i} style={{
                        position: 'absolute',
                        left: `${10 + i * 13}%`,
                        top: `${18 + (i % 3) * 18}%`,
                        width: form.bg_animation === 'confetti' ? 8 : 6,
                        height: form.bg_animation === 'confetti' ? 14 : 6,
                        borderRadius: form.bg_animation === 'confetti' ? 2 : '50%',
                        background: i % 2 ? '#fff' : form.accent_color,
                        opacity: 0.6,
                        animation: `${form.bg_animation === 'sparkles' || form.bg_animation === 'fireflies' ? 'inviteGlow' : 'inviteFloat'} ${2.6 + i * 0.25}s ease-in-out infinite`,
                        animationDelay: `${i * 0.18}s`,
                      }} />
                    ))}
                  </div>
                )}
                <span style={{ alignSelf: 'flex-start', color: '#fff', background: 'rgba(0,0,0,0.34)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999, padding: '6px 10px', fontSize: '0.74rem', fontWeight: 800 }}>
                  {activity.icon} {activity.mood}
                </span>
                <h2 style={{ color: '#fff', fontSize: '2rem', lineHeight: 1.05, margin: '14px 0 8px', letterSpacing: 0 }}>
                  {form.title.trim() || 'Your invite title'}
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.86)', margin: 0, fontSize: '0.95rem' }}>
                  {formatPreviewDate(form.scheduled_date)}
                </p>
              </div>
              <div style={{ padding: 18 }}>
                <div style={{ display: 'grid', gap: 10, color: 'var(--t2)', fontSize: '0.92rem' }}>
                  <div>{form.location.trim() || 'Location TBD'}</div>
                  <div>{form.description.trim() || 'Add a short note so guests know what kind of night they are saying yes to.'}</div>
                  <div>{form.max_attendees ? `${form.max_attendees} guest limit` : 'No guest limit'}</div>
                  <div style={{ color: form.accent_color, fontWeight: 800 }}>
                    {selectedGroups.length ? `${selectedGroups.length} club${selectedGroups.length > 1 ? 's' : ''} selected` : 'Public share link'}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
