import { useState, useRef } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import StatusChip from '../ui/StatusChip'
import { groupsApi } from '../../api/groups'
import { gatewayClient } from '../../api/client'
import { ACTIVITY_LIST, resolveActivity } from '../../constants/activities'

const ROTATION_MODES = [
  { value: 'sequential', label: 'Sequential' },
  { value: 'random',     label: 'Random' },
  { value: 'manual',     label: 'Manual' },
]

const inputStyle = {
  background: 'var(--s2)',
  border: '1px solid var(--glass)',
  borderRadius: '10px',
  padding: '8px 12px',
  fontSize: '13px',
  color: 'var(--t1)',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border 0.15s',
}

const labelStyle = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--t3)',
  marginBottom: '5px',
  display: 'block',
}

const sectionStyle = {
  background: 'var(--s3)',
  border: '1px solid var(--glass)',
  borderRadius: '14px',
  padding: '18px',
  marginBottom: '12px',
}

const sectionTitleStyle = {
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--t2)',
  marginBottom: '14px',
}

const GROUP_ONBOARD_STEPS = [
  {
    icon: '🎉',
    title: 'Your club is ready!',
    body: 'Share your club with friends — they can join via invite link or email invitation.',
  },
  {
    icon: '🔄',
    title: 'Turn-based picks',
    body: "Members take turns choosing the activity. The current picker shows up on everyone's dashboard.",
  },
  {
    icon: '💸',
    title: 'Split costs effortlessly',
    body: 'When creating an event, enable Bill Split to track expenses and divide them fairly between attendees.',
  },
]

export default function CreateGroupModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    rotation_mode: 'sequential',
    activity_type: 'dining',
    join_behavior: 'instant',
  })
  const [inviteEmail, setInviteEmail] = useState('')
  const [invites, setInvites] = useState([])
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [createdGroupId, setCreatedGroupId] = useState(null)
  const [onboardStep, setOnboardStep] = useState(0)
  const bannerRef = useRef()

  const setField = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  const handleBannerPick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBannerFile(file)
    setBannerPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const addInvite = () => {
    const trimmed = inviteEmail.trim()
    if (!trimmed) return
    if (invites.find((i) => i.email === trimmed)) return
    setInvites((prev) => [...prev, { email: trimmed }])
    setInviteEmail('')
  }

  const removeInvite = (email) =>
    setInvites((prev) => prev.filter((i) => i.email !== email))

  const handleSubmit = async () => {
    setError('')
    if (!form.name.trim()) {
      setError('Club name is required.')
      return
    }
    setLoading(true)
    try {
      const ROTATION_TYPE_MAP = { sequential: 'round_robin', random: 'random', manual: 'none' }
      const group = await groupsApi.create({
        name: form.name.trim(),
        description: form.description.trim() || null,
        rotation_type: ROTATION_TYPE_MAP[form.rotation_mode] || 'round_robin',
        activity_type: form.activity_type,
        join_behavior: form.join_behavior,
      })
      // Upload banner if selected
      if (bannerFile) {
        try {
          const urlData = await groupsApi.getBannerUploadUrl(group.id, bannerFile.name, bannerFile.type)
          const res = await fetch(urlData.upload_url, {
            method: 'PUT',
            headers: { 'Content-Type': bannerFile.type },
            body: bannerFile,
          })
          if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
          await groupsApi.update(group.id, { banner_url: urlData.public_url })
        } catch { /* non-fatal */ }
      }
      for (const inv of invites) {
        await gatewayClient
          .post(`/groups/${group.id}/invite`, { email: inv.email })
          .catch(() => {})
      }
      onCreated && onCreated(group.id)
      if (!localStorage.getItem('clubpal_group_onboarded')) {
        setCreatedGroupId(group.id)
      } else {
        onClose && onClose()
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create club. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOnboardDone = () => {
    localStorage.setItem('clubpal_group_onboarded', 'true')
    onClose?.()
  }

  if (createdGroupId) {
    const step = GROUP_ONBOARD_STEPS[onboardStep]
    const isLast = onboardStep === GROUP_ONBOARD_STEPS.length - 1
    return (
      <Modal isOpen={isOpen} onClose={handleOnboardDone} title="Quick Tips">
        <div style={{ textAlign: 'center', padding: '12px 8px 4px' }}>
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>{step.icon}</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--t1)', marginBottom: '10px' }}>
            {step.title}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--t2)', lineHeight: 1.6, marginBottom: '32px' }}>
            {step.body}
          </div>

          {/* Step dots */}
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '24px' }}>
            {GROUP_ONBOARD_STEPS.map((_, i) => (
              <div key={i} style={{
                width: i === onboardStep ? '20px' : '6px',
                height: '6px',
                borderRadius: '100px',
                background: i <= onboardStep ? 'var(--rose)' : 'var(--glass)',
                transition: 'all 0.2s',
              }} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button onClick={handleOnboardDone} style={{
              background: 'none',
              border: '1px solid var(--glass)',
              borderRadius: '8px',
              padding: '8px 18px',
              fontSize: '13px', fontWeight: 600,
              color: 'var(--t3)', cursor: 'pointer',
            }}>
              Skip
            </button>
            <button
              onClick={isLast ? handleOnboardDone : () => setOnboardStep(s => s + 1)}
              style={{
                background: 'var(--rose)', border: 'none', borderRadius: '8px',
                padding: '8px 22px', fontSize: '13px', fontWeight: 700,
                color: '#fff', cursor: 'pointer',
              }}
            >
              {isLast ? "Let's go!" : 'Next →'}
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Club" size="lg">
      {/* Section 1: Club Details */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Club Details</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}
        >
          <div>
            <label style={labelStyle}>Name *</label>
            <input
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Friday Night Crew"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = 'var(--rose-border)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--glass)')}
            />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <input
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="What's this club about?"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = 'var(--rose-border)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--glass)')}
            />
          </div>
        </div>

        {/* Rotation mode */}
        <div
          style={{
            display: 'flex',
            background: 'var(--s4)',
            borderRadius: '10px',
            padding: '3px',
            marginTop: '12px',
          }}
        >
          {ROTATION_MODES.map((mode) => {
            const isActive = form.rotation_mode === mode.value
            return (
              <button
                key={mode.value}
                onClick={() => setField('rotation_mode', mode.value)}
                style={{
                  flex: 1,
                  padding: '7px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.15s',
                  background: isActive ? 'var(--s2)' : 'transparent',
                  color: isActive ? 'var(--t1)' : 'var(--t3)',
                  boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                {mode.label}
              </button>
            )
          })}
        </div>

        {/* Join behavior */}
        <div style={{ marginTop: '14px' }}>
          <label style={labelStyle}>Join Behavior</label>
          <div style={{ display: 'flex', background: 'var(--s4)', borderRadius: '10px', padding: '3px' }}>
            {[
              { value: 'instant', label: '⚡ Instant Join' },
              { value: 'approval', label: '✋ Approval Required' },
            ].map((opt) => {
              const isActive = form.join_behavior === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setField('join_behavior', opt.value)}
                  style={{
                    flex: 1, padding: '7px', borderRadius: '8px', textAlign: 'center',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none',
                    transition: 'all 0.15s',
                    background: isActive ? 'var(--s2)' : 'transparent',
                    color: isActive ? 'var(--t1)' : 'var(--t3)',
                    boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '5px' }}>
            {form.join_behavior === 'instant'
              ? 'Anyone with the invite code joins automatically.'
              : 'You approve each join request before they can access the club.'}
          </div>
        </div>
      </div>

      {/* Section 2: Banner Image */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Banner Image (optional)</div>
        <input ref={bannerRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerPick} />
        {bannerPreview ? (
          <div style={{ position: 'relative', height: '120px', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => bannerRef.current?.click()}>
            <img src={bannerPreview} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.4)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0)'}>
              <span style={{ color: '#fff', fontSize: '12px', fontWeight: 700, opacity: 0 }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0}>Change Photo</span>
            </div>
            <button onClick={e => { e.stopPropagation(); setBannerFile(null); setBannerPreview(null) }}
              style={{ position: 'absolute', top: '6px', right: '6px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        ) : (
          <div onClick={() => bannerRef.current?.click()}
            style={{ height: '120px', background: 'var(--s2)', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <span style={{ fontSize: '28px' }}>🖼️</span>
            <span style={{ fontSize: '12px', color: 'var(--rose-soft)' }}>Add a banner photo</span>
          </div>
        )}
      </div>

      {/* Section 3: Activity Type */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Activity Type</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
          }}
        >
          {ACTIVITY_LIST.map((act) => {
            const isSelected = form.activity_type === act.key
            return (
              <div
                key={act.key}
                onClick={() => setField('activity_type', act.key)}
                style={{
                  border: isSelected
                    ? `1px solid rgba(${act.rgb},0.35)`
                    : '1px solid var(--glass)',
                  borderRadius: '14px',
                  padding: '16px 8px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: isSelected
                    ? `rgba(${act.rgb},0.12)`
                    : 'var(--s3)',
                  boxShadow: isSelected
                    ? `0 0 0 1px rgba(${act.rgb},0.15)`
                    : 'none',
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '4px' }}>{act.emoji}</div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: isSelected ? `rgb(${act.rgb})` : 'var(--t3)',
                  }}
                >
                  {act.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 3: Invite Members */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Invite Members</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addInvite()}
            placeholder="Enter email address"
            type="email"
            style={{ ...inputStyle, flex: 1 }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--rose-border)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--glass)')}
          />
          <Button variant="primary" size="sm" onClick={addInvite}>
            Add
          </Button>
        </div>

        {invites.map((inv) => (
          <div
            key={inv.email}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '9px',
              background: 'var(--s3)',
              borderRadius: '10px',
              padding: '9px 12px',
              marginBottom: '6px',
              border: '1px solid var(--glass)',
            }}
          >
            <Avatar name={inv.email} size="sm" />
            <span
              style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--t1)' }}
            >
              {inv.email}
            </span>
            <StatusChip status="pending" label="Pending" />
            <button
              onClick={() => removeInvite(inv.email)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--t4)',
                fontSize: '14px',
                cursor: 'pointer',
                padding: '0 2px',
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: 'rgba(248,113,113,0.1)',
            border: '1px solid rgba(248,113,113,0.2)',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '13px',
            color: '#f87171',
            marginBottom: '8px',
          }}
        >
          {error}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
          paddingTop: '16px',
        }}
      >
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" loading={loading} onClick={handleSubmit}>
          Create Club
        </Button>
      </div>
    </Modal>
  )
}
