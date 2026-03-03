import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { useAuth } from '../../contexts/AuthContext'
import { groupsApi } from '../../api/groups'

const ACTIVITY_TYPES = [
  { value: 'dining', emoji: '🍽️', label: 'Dining' },
  { value: 'movies', emoji: '🎬', label: 'Movies' },
  { value: 'books', emoji: '📚', label: 'Books' },
  { value: 'hiking', emoji: '🥾', label: 'Hiking' },
  { value: 'gaming', emoji: '🎮', label: 'Gaming' },
  { value: 'arts', emoji: '🎨', label: 'Arts' },
]

const DEADLINE_PRESETS = [
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '72h', hours: 72 },
]

const inputStyle = {
  background: 'var(--s2)',
  border: '1px solid var(--glass)',
  borderRadius: '10px',
  padding: '9px 12px',
  fontSize: '13px',
  color: 'var(--t1)',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--t3)',
  marginBottom: '6px',
  display: 'block',
}

const sectionStyle = {
  background: 'var(--s3)',
  border: '1px solid var(--glass)',
  borderRadius: '14px',
  padding: '14px',
  marginBottom: '10px',
}

/**
 * CreatePollModal
 *
 * Props:
 *   isOpen         bool
 *   onClose        fn
 *   groupId        number | null   — pre-selected group (skips selector)
 *   activityName   string | null   — pre-fill from discover
 *   activityType   string | null   — pre-fill from discover
 *   onCreated      fn(poll)        — called after successful creation
 */
export default function CreatePollModal({ isOpen, onClose, groupId: preGroupId, activityName: preActivityName, activityType: preActivityType, onCreated }) {
  const { user } = useAuth()

  const [groups, setGroups] = useState([])
  const [groupId, setGroupId] = useState(preGroupId ? String(preGroupId) : '')
  const [activityName, setActivityName] = useState(preActivityName || '')
  const [activityType, setActivityType] = useState(preActivityType || '')
  const [note, setNote] = useState('')
  const [deadlinePreset, setDeadlinePreset] = useState(24)
  const [customDeadline, setCustomDeadline] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    if (!preGroupId) {
      groupsApi.getUserGroups(user.id)
        .then(g => setGroups(Array.isArray(g) ? g : g?.groups || []))
        .catch(() => {})
    }
    // Re-sync pre-fills when modal re-opens
    setActivityName(preActivityName || '')
    setActivityType(preActivityType || '')
    setGroupId(preGroupId ? String(preGroupId) : '')
    setNote('')
    setError('')
  }, [isOpen])

  const computeDeadline = () => {
    if (useCustom && customDeadline) return new Date(customDeadline).toISOString()
    const d = new Date()
    d.setHours(d.getHours() + deadlinePreset)
    return d.toISOString()
  }

  const handleSubmit = async () => {
    if (!groupId) { setError('Please select a group.'); return }
    if (!activityName.trim()) { setError('Activity name is required.'); return }
    setError('')
    setLoading(true)
    try {
      const poll = await groupsApi.createPoll(parseInt(groupId), user.id, {
        activity_name: activityName.trim(),
        activity_type: activityType || null,
        note: note.trim() || null,
        deadline: computeDeadline(),
      })
      onCreated?.(poll)
      onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create poll.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Poll Your Group" size="md">
      {/* Activity name */}
      <div style={sectionStyle}>
        <label style={labelStyle}>What are you considering? *</label>
        <input
          type="text"
          value={activityName}
          onChange={e => setActivityName(e.target.value)}
          placeholder="e.g. Nobu Downtown, Dune 3, Zion Half Marathon…"
          style={inputStyle}
          maxLength={200}
        />
      </div>

      {/* Activity type pills */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Type (optional)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {ACTIVITY_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setActivityType(activityType === t.value ? '' : t.value)}
              style={{
                padding: '5px 12px',
                borderRadius: '99px',
                border: `1px solid ${activityType === t.value ? 'var(--rose-border)' : 'var(--glass)'}`,
                background: activityType === t.value ? 'var(--rose-glow)' : 'var(--s2)',
                color: activityType === t.value ? 'var(--rose-soft)' : 'var(--t2)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Group selector (only when not pre-selected) */}
      {!preGroupId && (
        <div style={sectionStyle}>
          <label style={labelStyle}>Group *</label>
          <select
            value={groupId}
            onChange={e => setGroupId(e.target.value)}
            style={{ ...inputStyle, appearance: 'none' }}
          >
            <option value="">Select a group…</option>
            {groups.map(g => (
              <option key={g.id} value={String(g.id)}>{g.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Note */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Your note (optional)</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Why you're considering this, any context…"
          rows={2}
          style={{ ...inputStyle, resize: 'none', minHeight: '60px' }}
          maxLength={500}
        />
      </div>

      {/* Deadline */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Poll closes in</label>
        <div style={{ display: 'flex', gap: '6px', marginBottom: useCustom ? '10px' : 0 }}>
          {DEADLINE_PRESETS.map(p => (
            <button
              key={p.hours}
              onClick={() => { setDeadlinePreset(p.hours); setUseCustom(false) }}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '10px',
                border: `1px solid ${!useCustom && deadlinePreset === p.hours ? 'var(--rose-border)' : 'var(--glass)'}`,
                background: !useCustom && deadlinePreset === p.hours ? 'var(--rose-glow)' : 'var(--s2)',
                color: !useCustom && deadlinePreset === p.hours ? 'var(--rose-soft)' : 'var(--t2)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setUseCustom(true)}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '10px',
              border: `1px solid ${useCustom ? 'var(--rose-border)' : 'var(--glass)'}`,
              background: useCustom ? 'var(--rose-glow)' : 'var(--s2)',
              color: useCustom ? 'var(--rose-soft)' : 'var(--t2)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Custom
          </button>
        </div>
        {useCustom && (
          <input
            type="datetime-local"
            value={customDeadline}
            onChange={e => setCustomDeadline(e.target.value)}
            style={{ ...inputStyle, marginTop: '8px' }}
          />
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#f87171', marginBottom: '8px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '8px' }}>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={loading} onClick={handleSubmit}>
          Send Poll →
        </Button>
      </div>
    </Modal>
  )
}
