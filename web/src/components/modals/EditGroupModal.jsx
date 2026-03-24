import { useState, useEffect, useRef, useCallback } from 'react'
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
  { key: 'other',   emoji: '✨', label: 'Other',   rgb: '100,116,139' },
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
                Remove from club
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
// ── Drag-and-drop turn order ──────────────────────────────────────────────────
function TurnOrderRow({ member, index, isDragging, onDragStart, onDragOver, onDragEnd }) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index) }}
      onDragEnd={onDragEnd}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px',
        background: isDragging ? 'var(--rose-glow)' : 'var(--s2)',
        borderRadius: '10px',
        border: `1px solid ${isDragging ? 'var(--rose-border)' : 'var(--glass)'}`,
        marginBottom: '6px',
        cursor: 'grab',
        opacity: isDragging ? 0.7 : 1,
        transition: 'background 0.1s, border-color 0.1s',
        userSelect: 'none',
      }}
    >
      {/* Position */}
      <div style={{
        width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
        background: index === 0 ? 'var(--rose)' : 'var(--s4)',
        color: index === 0 ? '#fff' : 'var(--t3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '10px', fontWeight: 700,
        boxShadow: index === 0 ? '0 0 8px rgba(244,63,94,0.4)' : 'none',
      }}>
        {index + 1}
      </div>
      <Avatar user={member} size="sm" />
      <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {member.full_name || member.username || `User #${member.user_id}`}
      </span>
      {index === 0 && (
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--rose-soft)', background: 'var(--rose-glow)', padding: '2px 7px', borderRadius: '100px', flexShrink: 0 }}>
          Picks first
        </span>
      )}
      {/* Drag handle */}
      <span style={{ color: 'var(--t4)', fontSize: '16px', cursor: 'grab', flexShrink: 0 }}>⠿</span>
    </div>
  )
}

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
  const [memberOrder, setMemberOrder] = useState([])
  const dragIndexRef = useRef(null)
  const fileRef = useRef()

  // Pre-populate on open
  useEffect(() => {
    if (group && isOpen) {
      setForm({
        name: group.name || '',
        description: group.description || '',
        rotation_mode: { round_robin: 'sequential', random: 'random', none: 'manual' }[group.rotation_type] || group.rotation_mode || 'sequential',
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

  // Initialise turn order from members sorted by rotation_order
  useEffect(() => {
    if (isOpen && members.length > 0) {
      setMemberOrder([...members].sort((a, b) => (a.rotation_order ?? 999) - (b.rotation_order ?? 999)))
    }
  }, [isOpen, members])

  // Drag handlers
  const handleDragStart = useCallback((index) => { dragIndexRef.current = index }, [])
  const handleDragOver = useCallback((index) => {
    if (dragIndexRef.current === null || dragIndexRef.current === index) return
    setMemberOrder(prev => {
      const copy = [...prev]
      const [item] = copy.splice(dragIndexRef.current, 1)
      copy.splice(index, 0, item)
      dragIndexRef.current = index
      return copy
    })
  }, [])
  const handleDragEnd = useCallback(() => { dragIndexRef.current = null }, [])

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
    if (!form.name.trim()) { setError('Club name is required.'); return }
    setError('')
    setLoading(true)
    try {
      const ROTATION_TYPE_MAP = { sequential: 'round_robin', random: 'random', manual: 'none' }
      await groupsApi.update(group.id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        rotation_type: ROTATION_TYPE_MAP[form.rotation_mode] || 'round_robin',
        activity_type: form.activity_type,
        bg_type: form.bg_type,
        bg_value: form.bg_value,
        bg_scope: form.bg_scope,
      })
      // Persist turn order when sequential
      if (form.rotation_mode === 'sequential' && memberOrder.length > 0) {
        await groupsApi.reorderRotation(group.id, memberOrder.map(m => m.user_id))
      }
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
      setError(err?.response?.data?.detail || 'Failed to delete club.')
      setLoading(false)
    }
  }

  const focusBorder = (e) => (e.target.style.borderColor = 'var(--rose-border)')
  const blurBorder  = (e) => (e.target.style.borderColor = 'var(--glass)')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Club" size="lg">
      {/* Section 1 – Club Details */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Club Details</div>
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

      {/* Section 2 – Turn Order (sequential only) */}
      {form.rotation_mode === 'sequential' && memberOrder.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Turn Order</div>
          <p style={{ fontSize: '11px', color: 'var(--t3)', marginBottom: '12px', marginTop: '-8px' }}>
            Drag to reorder — the top member picks first.
          </p>
          {memberOrder.map((member, index) => (
            <TurnOrderRow
              key={member.user_id}
              member={member}
              index={index}
              isDragging={dragIndexRef.current === index}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}

      {/* Section 3 – Background */}
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

      {/* Section 4 – Activity Type */}
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

      {/* Section 5 – Members */}
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

      {/* Section 6 – Danger Zone */}
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
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)', marginBottom: '2px' }}>Delete this club</div>
              <div style={{ fontSize: '11px', color: 'var(--t3)' }}>This is permanent. All events and ratings will be lost.</div>
            </div>
            <Button variant="danger" size="sm" onClick={() => setDeleteConfirm(true)}>Delete Club</Button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '13px', color: 'var(--t2)', marginBottom: '12px' }}>
              This will permanently delete <strong style={{ color: 'var(--t1)' }}>{group?.name}</strong>, all events, and all ratings. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
              <Button variant="danger" size="sm" loading={loading} onClick={handleDelete}>Yes, Delete Club</Button>
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
