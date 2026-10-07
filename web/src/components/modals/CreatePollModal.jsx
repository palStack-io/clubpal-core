import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { useAuth } from '../../contexts/AuthContext'
import { groupsApi } from '../../api/groups'

const DEADLINE_PRESETS = [
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '72h', hours: 72 },
]

const OPTION_EMOJIS = [
  '⭐','🎯','🏆','🎉','🎊','🎈','🎁','🎀',
  '🍽️','🍕','🍣','🍜','🍔','🌮','🍦','🍰','🥂','☕','🍺','🥗',
  '🎬','🎮','🎵','🎭','🎪','🎨','📚','🃏','🎲','🎸','🎤','🎧',
  '🥾','🏖️','🗻','🏕️','🌊','🚵','🏄','⛷️','🎿','🧗','🏃','🚴',
  '⚽','🏀','🎾','🏓','🏋️','🥊','⛳','🎳','🏊','🤸',
  '❤️','🔥','🌟','✨','💯','🙌','🥳','😍','🤩','💥','👏','🫶',
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

let _optId = 0
function makeOption(label = '', emoji = '⭐') {
  return { id: `opt_${++_optId}`, label, emoji }
}

/**
 * CreatePollModal
 *
 * Props:
 *   isOpen         bool
 *   onClose        fn
 *   groupId        number | null   — pre-selected group (skips selector)
 *   activityName   string | null   — pre-fill from discover (becomes first option)
 *   activityType   string | null   — pre-fill from discover
 *   onCreated      fn(poll)        — called after successful creation
 */
export default function CreatePollModal({ isOpen, onClose, groupId: preGroupId, activityName: preActivityName, onCreated }) {
  const { user } = useAuth()

  const [groups, setGroups] = useState([])
  const [groupId, setGroupId] = useState(preGroupId ? String(preGroupId) : '')
  const [options, setOptions] = useState(() => [
    makeOption(preActivityName || '', '⭐'),
    makeOption('', '⭐'),
  ])
  const [emojiPickerFor, setEmojiPickerFor] = useState(null) // option id
  const [note, setNote] = useState('')
  const [deadlinePreset, setDeadlinePreset] = useState(24)
  const [customDeadline, setCustomDeadline] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [allowMultiSelect, setAllowMultiSelect] = useState(false)
  const [allowCustomResponse, setAllowCustomResponse] = useState(false)
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
    setOptions([makeOption(preActivityName || '', '⭐'), makeOption('', '⭐')])
    setGroupId(preGroupId ? String(preGroupId) : '')
    setNote('')
    setAllowMultiSelect(false)
    setAllowCustomResponse(false)
    setError('')
    setEmojiPickerFor(null)
  }, [isOpen])

  const updateOption = (id, field, value) =>
    setOptions(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o))

  const addOption = () => {
    if (options.length >= 8) return
    setOptions(prev => [...prev, makeOption('', '⭐')])
  }

  const removeOption = (id) => {
    if (options.length <= 2) return
    setOptions(prev => prev.filter(o => o.id !== id))
    if (emojiPickerFor === id) setEmojiPickerFor(null)
  }

  const computeDeadline = () => {
    if (useCustom && customDeadline) return new Date(customDeadline).toISOString()
    const d = new Date()
    d.setHours(d.getHours() + deadlinePreset)
    return d.toISOString()
  }

  const handleSubmit = async () => {
    if (!groupId) { setError('Please select a group.'); return }
    const filled = options.filter(o => o.label.trim())
    if (filled.length < 2) { setError('Add at least 2 options.'); return }
    setError('')
    setLoading(true)
    try {
      const poll = await groupsApi.createPoll(parseInt(groupId), user.id, {
        activity_name: filled[0].label.trim(),
        note: note.trim() || null,
        deadline: computeDeadline(),
        custom_options: filled.map(o => ({ label: o.label.trim(), emoji: o.emoji })),
        allow_multi_select: allowMultiSelect,
        allow_custom_response: allowCustomResponse,
      })
      onCreated?.(poll)
      onClose()
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(
        typeof detail === 'string' ? detail
        : Array.isArray(detail) ? detail.map(d => d?.msg ?? String(d)).join(', ')
        : 'We couldn\'t create your poll. Give it another go.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Poll Your Group" size="md">

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

      {/* Note / question */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Your question or note (optional)</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="What are you trying to decide? Any context for the group…"
          rows={2}
          style={{ ...inputStyle, resize: 'none', minHeight: '60px' }}
          maxLength={500}
        />
      </div>

      {/* Poll options */}
      <div style={sectionStyle}>
        <label style={{ ...labelStyle, marginBottom: '10px' }}>
          Options * <span style={{ fontWeight: 400, color: 'var(--t4)' }}>(min 2, max 8)</span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {options.map((opt, idx) => (
            <div key={opt.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Emoji picker button */}
                <button
                  type="button"
                  onClick={() => setEmojiPickerFor(emojiPickerFor === opt.id ? null : opt.id)}
                  title="Pick emoji"
                  style={{
                    width: '38px', height: '38px', flexShrink: 0,
                    borderRadius: '10px', border: '1px solid var(--glass)',
                    background: emojiPickerFor === opt.id ? 'var(--rose-glow)' : 'var(--s2)',
                    fontSize: '20px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                  }}
                >
                  {opt.emoji}
                </button>

                {/* Label input */}
                <input
                  type="text"
                  value={opt.label}
                  onChange={e => updateOption(opt.id, 'label', e.target.value)}
                  placeholder={`Option ${idx + 1}…`}
                  maxLength={120}
                  style={{ ...inputStyle, flex: 1 }}
                />

                {/* Remove button */}
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(opt.id)}
                    style={{
                      width: '28px', height: '28px', flexShrink: 0,
                      borderRadius: '50%', border: 'none',
                      background: 'none', color: 'var(--t4)',
                      fontSize: '18px', cursor: 'pointer', lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Inline emoji grid */}
              {emojiPickerFor === opt.id && (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '5px',
                  marginTop: '8px', padding: '10px',
                  background: 'var(--s2)', borderRadius: '10px',
                  border: '1px solid var(--glass)',
                }}>
                  {OPTION_EMOJIS.map(em => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => { updateOption(opt.id, 'emoji', em); setEmojiPickerFor(null) }}
                      style={{
                        width: '34px', height: '34px', borderRadius: '8px',
                        border: opt.emoji === em ? '1px solid var(--rose-border)' : '1px solid var(--glass)',
                        background: opt.emoji === em ? 'var(--rose-glow)' : 'var(--s3)',
                        fontSize: '18px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.1s',
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {options.length < 8 && (
          <button
            type="button"
            onClick={addOption}
            style={{
              marginTop: '10px', display: 'flex', alignItems: 'center', gap: '5px',
              background: 'none', border: 'none', color: 'var(--rose-soft)',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer', padding: '2px 0',
            }}
          >
            + Add option
          </button>
        )}
      </div>


      {/* Poll settings */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Response settings</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Multi-select toggle */}
          <div
            onClick={() => setAllowMultiSelect(v => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '10px 12px', borderRadius: '10px', background: allowMultiSelect ? 'var(--rose-glow)' : 'var(--s2)', border: `1px solid ${allowMultiSelect ? 'var(--rose-border)' : 'var(--glass)'}`, transition: 'all 0.15s' }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>Allow multiple selections</div>
              <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '2px' }}>Members can vote for more than one option</div>
            </div>
            <div style={{ width: '36px', height: '20px', borderRadius: '99px', background: allowMultiSelect ? 'var(--rose)' : 'var(--t4)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: '2px', left: allowMultiSelect ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
          </div>

          {/* Allow write-in toggle */}
          <div
            onClick={() => setAllowCustomResponse(v => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '10px 12px', borderRadius: '10px', background: allowCustomResponse ? 'var(--rose-glow)' : 'var(--s2)', border: `1px solid ${allowCustomResponse ? 'var(--rose-border)' : 'var(--glass)'}`, transition: 'all 0.15s' }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>Allow write-in options</div>
              <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '2px' }}>Members can suggest their own options</div>
            </div>
            <div style={{ width: '36px', height: '20px', borderRadius: '99px', background: allowCustomResponse ? 'var(--rose)' : 'var(--t4)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: '2px', left: allowCustomResponse ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
          </div>
        </div>
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
