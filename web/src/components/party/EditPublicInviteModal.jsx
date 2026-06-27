import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import BringListBuilder from './BringListBuilder'
import { eventsApi } from '../../api/events'
import { groupsApi } from '../../api/groups'
import { gatewayClient } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

const ACTIVITIES = [
  { type: 'dining', label: 'Dining', icon: '🍽️', accent: '#f59e0b', mood: 'Warm table energy' },
  { type: 'hiking', label: 'Hiking', icon: '🥾', accent: '#22d3a0', mood: 'Fresh air plans' },
  { type: 'gaming', label: 'Gaming', icon: '🎮', accent: '#a855f7', mood: 'Low stakes, high chaos' },
  { type: 'movies', label: 'Movies', icon: '🎬', accent: '#6366f1', mood: 'Tickets and snacks' },
  { type: 'arts', label: 'Arts', icon: '🎨', accent: '#fb7185', mood: 'Make something weird' },
  { type: 'other', label: 'Party', icon: '🎉', accent: '#f43f5e', mood: 'Open invite' },
]

const STYLES = [
  { value: 'glass', label: 'Glass', desc: 'Soft blur, translucent panels' },
  { value: 'frosted', label: 'Frosted', desc: 'Heavy blur, bright glass feel' },
  { value: 'neon', label: 'Neon', desc: 'Dark card with glowing edges' },
  { value: 'velvet', label: 'Velvet', desc: 'Rich dark with accent borders' },
  { value: 'bold', label: 'Bold', desc: 'Accent-filled vivid panels' },
  { value: 'minimal', label: 'Minimal', desc: 'Flat, quiet, high contrast' },
]

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
  padding: '11px 13px',
  borderRadius: 10,
  border: '1px solid var(--s3)',
  background: 'var(--s2)',
  color: 'var(--t1)',
  colorScheme: 'dark',
  fontSize: '0.92rem',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
}

function Section({ title, children }) {
  return (
    <section style={{ background: 'var(--s3)', border: '1px solid var(--glass)', borderRadius: 14, padding: 16 }}>
      <h3 style={{ margin: '0 0 12px', color: 'var(--t2)', fontSize: '0.82rem', fontWeight: 800 }}>{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', color: 'var(--t3)', fontSize: '0.72rem', fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      {children}
    </label>
  )
}

function previewCardStyle(style, accent) {
  switch (style) {
    case 'neon': return { border: `1px solid ${accent}`, background: '#08080d', boxShadow: `0 0 34px ${accent}55`, backdropFilter: 'none' }
    case 'minimal': return { border: '1px solid #1c1c24', background: '#101014', boxShadow: 'none', backdropFilter: 'none' }
    case 'frosted': return { border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.13)', boxShadow: '0 8px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(22px)' }
    case 'velvet': return { border: `2px solid ${accent}55`, background: 'rgba(14,8,22,0.94)', boxShadow: `0 4px 28px ${accent}22`, backdropFilter: 'none' }
    case 'bold': return { border: `1px solid ${accent}66`, background: `${accent}1a`, boxShadow: `0 8px 24px ${accent}22`, backdropFilter: 'none' }
    default: return { border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', boxShadow: '0 18px 50px rgba(0,0,0,0.22)', backdropFilter: 'blur(18px)' }
  }
}

function formatPreviewDate(value) {
  if (!value) return 'Date to be announced'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Date to be announced'
  return parsed.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function EditPublicInviteModal({ isOpen, onClose, token, event, onSaved }) {
  const { user } = useAuth()
  const coverRef = useRef(null)
  const searchTimer = useRef(null)
  const [invite, setInvite] = useState(null)
  const [initialItems, setInitialItems] = useState([])
  const [groups, setGroups] = useState([])
  const [groupSelect, setGroupSelect] = useState('')
  const [inviteQuery, setInviteQuery] = useState('')
  const [inviteResults, setInviteResults] = useState([])
  const [emailInput, setEmailInput] = useState('')
  const [pendingInvitees, setPendingInvitees] = useState([])
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    theme_activity_type: 'other',
    accent_color: '#f43f5e',
    style: 'glass',
    bg_animation: 'confetti',
    cover_image_url: '',
    cover_image_position: '50% 50%',
    bring_list_enabled: false,
    bring_list_type: 'freeform',
    items: [],
  })

  useEffect(() => {
    if (!isOpen || !token) return
    let alive = true
    setLoading(true)
    setError('')
    Promise.all([
      eventsApi.getPartyInviteManage(token),
      user?.id ? groupsApi.getUserGroups(user.id).catch(() => []) : Promise.resolve([]),
    ]).then(([data, groupRows]) => {
      if (!alive) return
      const items = Array.isArray(data.items) ? data.items : []
      setInvite(data)
      setInitialItems(items)
      setGroups(Array.isArray(groupRows) ? groupRows : groupRows?.groups || [])
      setCoverPreview('')
      setCoverFile(null)
      setForm({
        theme_activity_type: data.theme_activity_type || 'other',
        accent_color: data.accent_color || '#f43f5e',
        style: data.style || 'glass',
        bg_animation: data.bg_animation || 'confetti',
        cover_image_url: data.cover_image_url || '',
        cover_image_position: data.cover_image_position || '50% 50%',
        bring_list_enabled: data.bring_list_enabled === true,
        bring_list_type: data.bring_list_type || 'freeform',
        items,
      })
    }).catch(() => {
      if (alive) setError('Could not load public invite settings.')
    }).finally(() => {
      if (alive) setLoading(false)
    })
    return () => { alive = false }
  }, [isOpen, token, user?.id])

  useEffect(() => {
    return () => {
      if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview)
    }
  }, [coverPreview])

  const activity = useMemo(
    () => ACTIVITIES.find(a => a.type === form.theme_activity_type) || ACTIVITIES[ACTIVITIES.length - 1],
    [form.theme_activity_type]
  )
  const attachedGroupIds = new Set((invite?.groups || []).map(g => Number(g.group_id)))
  const availableGroups = groups.filter(g => !attachedGroupIds.has(Number(g.id)))
  const bannerSrc = coverPreview || form.cover_image_url

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const pickCover = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview)
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
    setField('cover_image_url', '')
    e.target.value = ''
  }

  const searchUsers = (q) => {
    setInviteQuery(q)
    clearTimeout(searchTimer.current)
    if (q.trim().length < 2) {
      setInviteResults([])
      return
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await gatewayClient.get('/users/search', { params: { username: q.trim() } })
        setInviteResults(Array.isArray(r.data) ? r.data : [])
      } catch {
        setInviteResults([])
      }
    }, 300)
  }

  const addUser = (u) => {
    if (pendingInvitees.some(p => p.type === 'user' && p.id === u.id)) return
    setPendingInvitees(prev => [...prev, { type: 'user', id: u.id, label: u.full_name || u.username }])
    setInviteQuery('')
    setInviteResults([])
  }

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase()
    if (!email || !email.includes('@')) return
    if (pendingInvitees.some(p => p.type === 'email' && p.email === email)) return
    setPendingInvitees(prev => [...prev, { type: 'email', email, label: email }])
    setEmailInput('')
  }

  const shareToSelectedGroup = async () => {
    if (!groupSelect) return
    await eventsApi.sharePartyInviteToGroup(token, groupSelect)
    setGroupSelect('')
    const data = await eventsApi.getPartyInviteManage(token)
    setInvite(data)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      let coverUrl = form.cover_image_url.trim() || null
      if (coverFile) {
        const urlData = await eventsApi.getPartyInviteCoverUploadUrl(token, coverFile.name, coverFile.type)
        const res = await fetch(urlData.upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': coverFile.type },
          body: coverFile,
        })
        if (!res.ok) throw new Error(`Cover upload failed (${res.status})`)
        coverUrl = urlData.public_url
      }

      const updated = await eventsApi.updatePartyInvite(token, {
        theme_activity_type: form.theme_activity_type,
        accent_color: form.accent_color,
        style: form.style,
        bg_animation: form.bg_animation,
        cover_image_url: coverUrl,
        cover_image_position: form.cover_image_position,
        bring_list_enabled: form.theme_activity_type === 'dining' ? false : form.bring_list_enabled,
        bring_list_type: form.bring_list_type,
      })

      const currentIds = new Set(form.items.filter(item => item.id).map(item => Number(item.id)))
      await Promise.all(initialItems
        .filter(item => item.id && !currentIds.has(Number(item.id)))
        .map(item => eventsApi.deletePartyInviteItem(token, item.id)))
      await Promise.all(form.items
        .filter(item => !item.id)
        .map((item, index) => eventsApi.addPartyInviteItem(token, {
          label: item.label,
          emoji: item.emoji || '',
          max_claims: Number(item.max_claims) || 1,
          sort_order: initialItems.length + index,
        })))

      if (pendingInvitees.length) {
        await eventsApi.inviteUsersToParty(token, {
          user_ids: pendingInvitees.filter(p => p.type === 'user').map(p => p.id),
          emails: pendingInvitees.filter(p => p.type === 'email').map(p => p.email),
        })
      }

      onSaved?.({ ...invite, ...updated, cover_image_url: coverUrl })
      onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Could not save public invite.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Public Invite" size="xxl">
      <style>{`
        @keyframes inviteFloat { 0%,100%{ transform: translateY(0) rotate(0deg); } 50%{ transform: translateY(12px) rotate(14deg); } }
        @keyframes inviteGlow { 0%,100%{ opacity:.35; transform: scale(.88); } 50%{ opacity:.95; transform: scale(1.18); } }
        @keyframes inviteSweep { 0%{ transform: translateX(-18%) rotate(0deg); } 100%{ transform: translateX(18%) rotate(4deg); } }
        @keyframes inviteBurst { 0%{ opacity:0; transform: scale(.2); } 35%{ opacity:.95; } 100%{ opacity:0; transform: scale(1.45); } }
      `}</style>

      {loading ? (
        <div style={{ padding: 24, color: 'var(--t2)' }}>Loading invite...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <Section title="Invite Look">
              <div style={{ display: 'grid', gap: 14 }}>
                <Field label="Activity">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {ACTIVITIES.map(a => {
                      const active = form.theme_activity_type === a.type
                      return (
                        <button key={a.type} type="button" onClick={() => { setField('theme_activity_type', a.type); setField('accent_color', a.accent) }} style={{ padding: '10px 8px', borderRadius: 10, border: `1px solid ${active ? a.accent : 'var(--s3)'}`, background: active ? `${a.accent}18` : 'transparent', color: active ? a.accent : 'var(--t2)', cursor: 'pointer', fontWeight: 800 }}>
                          {a.icon} {a.label}
                        </button>
                      )
                    })}
                  </div>
                </Field>
                <Field label="Accent color">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {ACCENTS.map(color => (
                      <button key={color} type="button" aria-label={`Use ${color}`} onClick={() => setField('accent_color', color)} style={{ width: 34, height: 34, borderRadius: 17, border: form.accent_color === color ? '2px solid #fff' : '1px solid var(--s3)', outline: form.accent_color === color ? `2px solid ${color}` : 'none', background: color, cursor: 'pointer' }} />
                    ))}
                  </div>
                </Field>
                <Field label="Style">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                    {STYLES.map(s => (
                      <button key={s.value} type="button" onClick={() => setField('style', s.value)} style={{ padding: '10px 8px', borderRadius: 10, border: `1px solid ${form.style === s.value ? form.accent_color : 'var(--s3)'}`, background: form.style === s.value ? `${form.accent_color}18` : 'transparent', color: form.style === s.value ? form.accent_color : 'var(--t2)', cursor: 'pointer', fontWeight: 700, textAlign: 'left' }}>
                        <span style={{ display: 'block' }}>{s.label}</span>
                        <span style={{ display: 'block', marginTop: 3, color: 'var(--t3)', fontSize: '0.7rem', fontWeight: 500, lineHeight: 1.25 }}>{s.desc}</span>
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </Section>

            <Section title="Cover Image">
              <input ref={coverRef} type="file" accept="image/*" onChange={pickCover} style={{ display: 'none' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
                <Field label="Image URL">
                  <input value={form.cover_image_url} onChange={e => { setCoverFile(null); setCoverPreview(''); setField('cover_image_url', e.target.value) }} placeholder="https://..." style={inputStyle} />
                </Field>
                <button type="button" onClick={() => coverRef.current?.click()} style={{ padding: '11px 14px', borderRadius: 10, border: 'none', background: form.accent_color, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                  Upload
                </button>
              </div>
            </Section>

            <Section title="Motion">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                {ANIMATIONS.map(a => {
                  const active = form.bg_animation === a.value
                  return (
                    <button key={a.value} type="button" onClick={() => setField('bg_animation', a.value)} style={{ padding: '11px 12px', borderRadius: 10, border: `1px solid ${active ? form.accent_color : 'var(--s3)'}`, background: active ? `${form.accent_color}18` : 'transparent', color: active ? form.accent_color : 'var(--t2)', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ display: 'block', fontWeight: 800, fontSize: '0.84rem' }}>{a.label}</span>
                      <span style={{ display: 'block', marginTop: 3, color: 'var(--t3)', fontSize: '0.72rem', lineHeight: 1.25 }}>{a.desc}</span>
                    </button>
                  )
                })}
              </div>
            </Section>

            <Section title="Send To Clubs">
              <div style={{ display: 'flex', gap: 10 }}>
                <select value={groupSelect} onChange={e => setGroupSelect(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Add another club...</option>
                  {availableGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button type="button" onClick={shareToSelectedGroup} disabled={!groupSelect} style={{ padding: '11px 14px', borderRadius: 10, border: 'none', background: form.accent_color, color: '#fff', fontWeight: 800, cursor: groupSelect ? 'pointer' : 'default', opacity: groupSelect ? 1 : 0.55 }}>
                  Share
                </button>
              </div>
              {(invite?.groups || []).length > 0 && (
                <p style={{ margin: '10px 0 0', color: 'var(--t3)', fontSize: '0.82rem' }}>
                  Already shared to {(invite.groups || []).length} club{invite.groups.length === 1 ? '' : 's'}.
                </p>
              )}
            </Section>

            <Section title="Invite People">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 12 }}>
                <div style={{ position: 'relative' }}>
                  <Field label="Username">
                    <input value={inviteQuery} onChange={e => searchUsers(e.target.value)} placeholder="Search username..." style={inputStyle} />
                  </Field>
                  {inviteResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: 'var(--s2)', border: '1px solid var(--s3)', borderRadius: 10, marginTop: 6, overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,0.34)' }}>
                      {inviteResults.map(u => (
                        <button key={u.id} type="button" onClick={() => addUser(u)} style={{ display: 'block', width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', color: 'var(--t1)', textAlign: 'left', cursor: 'pointer' }}>
                          {u.full_name || u.username} <span style={{ color: 'var(--t3)' }}>@{u.username}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Field label="Email">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={emailInput} onChange={e => setEmailInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEmail()} placeholder="name@email.com" style={inputStyle} />
                    <button type="button" onClick={addEmail} style={{ padding: '0 14px', borderRadius: 10, border: 'none', background: form.accent_color, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Add</button>
                  </div>
                </Field>
              </div>
              {pendingInvitees.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {pendingInvitees.map((p, i) => (
                    <span key={`${p.type}-${p.id || p.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--s3)', fontSize: '0.82rem', fontWeight: 700 }}>
                      {p.label}
                      <button type="button" onClick={() => setPendingInvitees(prev => prev.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, fontWeight: 900 }}>x</button>
                    </span>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Bring List">
              <BringListBuilder
                enabled={form.bring_list_enabled && form.theme_activity_type !== 'dining'}
                onToggle={() => setField('bring_list_enabled', !form.bring_list_enabled)}
                items={form.items}
                onItemsChange={items => setField('items', items)}
              />
              {form.theme_activity_type === 'dining' && (
                <p style={{ color: 'var(--t3)', fontSize: '0.82rem', margin: '10px 0 0' }}>
                  Bring lists are turned off for dining invites.
                </p>
              )}
            </Section>

            {error && <div style={{ color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, padding: '10px 12px', fontSize: '0.9rem' }}>{error}</div>}
          </div>

          <aside style={{ position: 'sticky', top: 12 }}>
            <div style={{ borderRadius: 18, overflow: 'hidden', ...previewCardStyle(form.style, form.accent_color) }}>
              <div style={{ position: 'relative', minHeight: 250, background: bannerSrc ? `linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.72)), url(${bannerSrc}) ${form.cover_image_position}/cover` : `linear-gradient(135deg, ${form.accent_color}, #111827)`, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden' }}>
                {form.bg_animation !== 'none' && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                    {form.bg_animation === 'aurora' ? (
                      <>
                        <div style={{ position: 'absolute', inset: '-30%', background: `linear-gradient(115deg, transparent 4%, ${form.accent_color}aa 28%, rgba(255,255,255,0.42) 45%, #14b8a699 62%, transparent 86%)`, filter: 'blur(10px)', mixBlendMode: 'screen', animation: 'inviteSweep 4.6s ease-in-out infinite alternate' }} />
                        <div style={{ position: 'absolute', inset: '-18%', background: `linear-gradient(65deg, transparent 15%, #6366f188 42%, ${form.accent_color}77 58%, transparent 82%)`, filter: 'blur(18px)', mixBlendMode: 'screen', animation: 'inviteSweep 6.2s ease-in-out infinite alternate-reverse' }} />
                      </>
                    ) : form.bg_animation === 'spotlight' ? (
                      <div style={{ position: 'absolute', inset: '-30%', background: 'linear-gradient(105deg, transparent 22%, rgba(255,255,255,0.64) 48%, transparent 72%)', filter: 'blur(4px)', mixBlendMode: 'screen', animation: 'inviteSweep 3.4s ease-in-out infinite alternate' }} />
                    ) : form.bg_animation === 'fireworks' ? (
                      [0, 1, 2, 3].map(i => <span key={i} style={{ position: 'absolute', left: `${18 + i * 19}%`, top: `${18 + (i % 2) * 30}%`, width: 42, height: 42, borderRadius: '50%', border: `2px solid ${i % 2 ? '#fff' : form.accent_color}`, boxShadow: `0 0 16px ${form.accent_color}88, inset 0 0 12px ${form.accent_color}55`, opacity: 0, animation: `inviteBurst ${1.8 + i * 0.18}s ease-out infinite`, animationDelay: `${i * 0.32}s` }} />)
                    ) : [0, 1, 2, 3, 4, 5, 6].map(i => <span key={i} style={{ position: 'absolute', left: `${10 + i * 13}%`, top: `${18 + (i % 3) * 18}%`, width: form.bg_animation === 'confetti' ? 8 : 6, height: form.bg_animation === 'confetti' ? 14 : 6, borderRadius: form.bg_animation === 'confetti' ? 2 : '50%', background: i % 2 ? '#fff' : form.accent_color, opacity: 0.6, animation: `${form.bg_animation === 'sparkles' ? 'inviteGlow' : 'inviteFloat'} ${2.6 + i * 0.25}s ease-in-out infinite`, animationDelay: `${i * 0.18}s` }} />)}
                  </div>
                )}
                <span style={{ alignSelf: 'flex-start', color: '#fff', background: 'rgba(0,0,0,0.34)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999, padding: '6px 10px', fontSize: '0.74rem', fontWeight: 800 }}>
                  {activity.icon} {activity.mood}
                </span>
                <h2 style={{ color: '#fff', fontSize: '2rem', lineHeight: 1.05, margin: '14px 0 8px', letterSpacing: 0 }}>
                  {event?.title || invite?.event?.title || 'Your invite title'}
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.86)', margin: 0, fontSize: '0.95rem' }}>
                  {formatPreviewDate(event?.scheduled_date || invite?.event?.scheduled_date)}
                </p>
              </div>
              <div style={{ padding: 18 }}>
                <div style={{ display: 'grid', gap: 10, color: 'var(--t2)', fontSize: '0.92rem' }}>
                  <div>{event?.location || invite?.event?.location || 'Location TBD'}</div>
                  <div>{event?.description || invite?.event?.description || 'Add a short note so guests know what kind of night they are saying yes to.'}</div>
                  <div>{event?.max_attendees ? `${event.max_attendees} guest limit` : 'No guest limit'}</div>
                  <div style={{ color: form.accent_color, fontWeight: 800 }}>
                    {(invite?.groups || []).length ? `${invite.groups.length} club${invite.groups.length > 1 ? 's' : ''} attached` : 'Public share link'}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="primary" loading={saving} onClick={save}>Save Public Invite</Button>
            </div>
          </aside>
        </div>
      )}
    </Modal>
  )
}
