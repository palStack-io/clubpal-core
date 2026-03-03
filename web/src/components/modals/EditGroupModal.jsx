import { useState, useEffect, useRef } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import { groupsApi } from '../../api/groups'
import { gatewayClient } from '../../api/client'
import BackgroundPicker from '../ui/BackgroundPicker'

const ACTIVITY_OPTIONS = [
  { key: 'dining',  emoji: '🍽️', label: 'Dining',  rgb: '244,63,94'  },
  { key: 'movies',  emoji: '🎬', label: 'Movies',  rgb: '99,102,241' },
  { key: 'books',   emoji: '📚', label: 'Books',   rgb: '168,85,247' },
  { key: 'hiking',  emoji: '🥾', label: 'Hiking',  rgb: '20,184,166' },
  { key: 'gaming',  emoji: '🎮', label: 'Gaming',  rgb: '34,211,160' },
  { key: 'arts',    emoji: '🎨', label: 'Arts',    rgb: '245,158,11'  },
]

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

const menuBtnStyle = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '9px 14px',
  background: 'none',
  border: 'none',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--t2)',
  cursor: 'pointer',
}

// ── Member management row ────────────────────────────────────────────────────
function MemberManageRow({ member, canManage, onRoleChange, onRemove }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        background: 'var(--s2)',
        borderRadius: '10px',
        border: '1px solid var(--glass)',
        marginBottom: '6px',
      }}
    >
      <Avatar user={member} size="sm" />
      <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>
        {member.full_name || member.username}
      </span>
      <span style={{ fontSize: '11px', color: 'var(--t3)' }}>
        {member.role || 'Member'}
      </span>
      {canManage && (
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{
              width: '28px',
              height: '28px',
              background: 'var(--s3)',
              border: '1px solid var(--glass)',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'var(--t3)',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '32px',
                zIndex: 30,
                background: 'var(--s1)',
                border: '1px solid var(--glass)',
                borderRadius: '10px',
                minWidth: '160px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                overflow: 'hidden',
              }}
            >
              {member.role === 'member' && (
                <button
                  style={menuBtnStyle}
                  onClick={() => { onRoleChange(member.user_id, 'admin'); setMenuOpen(false) }}
                >
                  Make Admin
                </button>
              )}
              {member.role === 'admin' && (
                <button
                  style={menuBtnStyle}
                  onClick={() => { onRoleChange(member.user_id, 'member'); setMenuOpen(false) }}
                >
                  Make Member
                </button>
              )}
              <div style={{ height: '1px', background: 'var(--glass)', margin: '2px 0' }} />
              <button
                style={{ ...menuBtnStyle, color: '#f87171' }}
                onClick={() => { onRemove(member.user_id); setMenuOpen(false) }}
              >
                Remove from group
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function EditGroupModal({
  isOpen,
  onClose,
  group,
  members = [],
  currentUserId,
  onSaved,
  onDeleted,
  onMembersChanged,
}) {
  const [form, setForm] = useState({ name: '', description: '', rotation_mode: 'sequential', activity_type: 'dining', bg_type: 'default', bg_value: '', bg_scope: 'hero' })
  const [bannerPreview, setBannerPreview] = useState(null)
  const [bannerUploading, setBannerUploading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const fileRef = useRef()

  // Pre-populate on open
  useEffect(() => {
    if (group && isOpen) {
      setForm({
        name: group.name || '',
        description: group.description || '',
        rotation_mode: group.rotation_mode || group.rotation_type || 'sequential',
        activity_type: (group.activity_type || 'dining').toLowerCase(),
        bg_type: group.bg_type || 'default',
        bg_value: group.bg_value || '',
        bg_scope: group.bg_scope || 'hero',
      })
      setBannerPreview(group.banner_url || null)
      setError('')
      setDeleteConfirm(false)
    }
  }, [group, isOpen])

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }))

  // ── Banner upload ──────────────────────────────────────────────────────────
  const handleBannerFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBannerUploading(true)
    try {
      // Use groupsApi (groupsClient → /api/groups) not gatewayClient
      const urlData = await groupsApi.getBannerUploadUrl(group.id, file.name, file.type)
      const res = await fetch(urlData.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      await groupsApi.update(group.id, { banner_url: urlData.public_url })
      setBannerPreview(urlData.public_url)
    } catch {
      // silent
    } finally {
      setBannerUploading(false)
    }
  }

  // ── Background image upload (via BackgroundPicker) ────────────────────────
  const handleBgImageUpload = async (file) => {
    setBannerUploading(true)
    try {
      const urlData = await groupsApi.getBannerUploadUrl(group.id, file.name, file.type)
      const res = await fetch(urlData.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      setForm(f => ({ ...f, bg_type: 'image', bg_value: urlData.public_url }))
    } catch {
      // silent
    } finally {
      setBannerUploading(false)
    }
  }

  // ── Member actions (applied immediately, not on save) ──────────────────────
  const handleRoleChange = async (uid, role) => {
    try {
      await groupsApi.updateMemberRole(group.id, uid, role)
      onMembersChanged?.()
    } catch { /* silent */ }
  }

  const handleRemoveMember = async (uid) => {
    try {
      await groupsApi.removeMember(group.id, uid)
      onMembersChanged?.()
    } catch { /* silent */ }
  }

  const handleSendInvite = async () => {
    const email = inviteEmail.trim()
    if (!email) return
    try {
      await gatewayClient.post(`/groups/${group.id}/invite`, { email })
      setInviteEmail('')
    } catch { /* silent */ }
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { setError('Group name is required.'); return }
    setError('')
    setLoading(true)
    try {
      await groupsApi.update(group.id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        rotation_mode: form.rotation_mode,
        activity_type: form.activity_type,
        bg_type: form.bg_type,
        bg_value: form.bg_value,
        bg_scope: form.bg_scope,
      })
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save changes.')
    } finally {
      setLoading(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setLoading(true)
    try {
      await groupsApi.delete(group.id)
      onDeleted?.()
      onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to delete group.')
      setLoading(false)
    }
  }

  const focusBorder = (e) => (e.target.style.borderColor = 'var(--rose-border)')
  const blurBorder  = (e) => (e.target.style.borderColor = 'var(--glass)')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Group" size="lg">
      {/* Section 1 – Group Details */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Group Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Name *</label>
            <input
              value={form.name}
              onChange={e => setField('name', e.target.value)}
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <input
              value={form.description}
              onChange={e => setField('description', e.target.value)}
              placeholder="Brief description…"
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>
        </div>
        {/* Rotation mode segmented control */}
        <div style={{ display: 'flex', background: 'var(--s4)', borderRadius: '10px', padding: '3px', marginTop: '12px' }}>
          {ROTATION_MODES.map(mode => {
            const isActive = form.rotation_mode === mode.value
            return (
              <button
                key={mode.value}
                onClick={() => setField('rotation_mode', mode.value)}
                style={{
                  flex: 1, padding: '7px', borderRadius: '8px', textAlign: 'center',
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none',
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
      </div>

      {/* Section 2 – Background */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Background</div>
        <BackgroundPicker
          bgType={form.bg_type}
          bgValue={form.bg_value}
          bgScope={form.bg_scope}
          onChange={(changes) => setForm(f => ({ ...f, ...changes }))}
          onImageUpload={handleBgImageUpload}
          imageUploading={bannerUploading}
        />
      </div>

      {/* Section 3 – Activity Type */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Activity Type</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {ACTIVITY_OPTIONS.map(act => {
            const isSelected = form.activity_type === act.key
            return (
              <div
                key={act.key}
                onClick={() => setField('activity_type', act.key)}
                style={{
                  border: isSelected ? `1px solid rgba(${act.rgb},0.35)` : '1px solid var(--glass)',
                  borderRadius: '14px', padding: '16px 8px', textAlign: 'center', cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: isSelected ? `rgba(${act.rgb},0.12)` : 'var(--s3)',
                  boxShadow: isSelected ? `0 0 0 1px rgba(${act.rgb},0.15)` : 'none',
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '4px' }}>{act.emoji}</div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: isSelected ? `rgb(${act.rgb})` : 'var(--t3)' }}>
                  {act.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 4 – Members */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Members ({members.length})</div>
        {members.map(m => (
          <MemberManageRow
            key={m.user_id}
            member={m}
            canManage={m.user_id !== currentUserId && (m.role === 'member' || m.role === 'admin')}
            onRoleChange={handleRoleChange}
            onRemove={handleRemoveMember}
          />
        ))}
        {/* Invite new member */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendInvite()}
            placeholder="Invite by email…"
            style={{ ...inputStyle, flex: 1 }}
            onFocus={focusBorder}
            onBlur={blurBorder}
          />
          <Button variant="subtle" size="sm" onClick={handleSendInvite}>Send Invite</Button>
        </div>
      </div>

      {/* Section 5 – Danger Zone */}
      <div style={{
        background: 'rgba(248,113,113,0.05)',
        border: '1px solid rgba(248,113,113,0.15)',
        borderRadius: '14px',
        padding: '18px',
        marginBottom: '12px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#f87171', marginBottom: '12px' }}>Danger Zone</div>
        {!deleteConfirm ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)', marginBottom: '2px' }}>Delete this group</div>
              <div style={{ fontSize: '11px', color: 'var(--t3)' }}>This is permanent. All events and ratings will be lost.</div>
            </div>
            <Button variant="danger" size="sm" onClick={() => setDeleteConfirm(true)}>Delete Group</Button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '13px', color: 'var(--t2)', marginBottom: '12px' }}>
              This will permanently delete <strong style={{ color: 'var(--t1)' }}>{group?.name}</strong>, all events, and all ratings. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
              <Button variant="danger" size="sm" loading={loading} onClick={handleDelete}>Yes, Delete Group</Button>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(248,113,113,0.1)',
          border: '1px solid rgba(248,113,113,0.2)',
          borderRadius: '10px',
          padding: '12px 14px',
          fontSize: '13px',
          color: '#f87171',
          marginBottom: '8px',
        }}>
          {error}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '8px' }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={loading} onClick={handleSave}>Save Changes</Button>
      </div>
    </Modal>
  )
}
