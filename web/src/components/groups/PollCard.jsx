import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../ui/Button'
import { groupsApi } from '../../api/groups'

const DEFAULT_RESPONSES = [
  { value: 'in', emoji: '🙌', label: "I'm in!", color: '#22d3a0' },
  { value: 'done_loved', emoji: '❤️', label: 'Done it, loved it', color: '#f43f5e' },
  { value: 'done_pass', emoji: '👎', label: 'Done it, pass', color: '#f59e0b' },
  { value: 'cant_make_it', emoji: '🚫', label: "Can't make it", color: 'var(--t3)' },
]

const OPTION_EMOJIS = [
  '⭐','🎯','🏆','🎉','🎊','🎈','🎁','🎀',
  '🍽️','🍕','🍣','🍜','🍔','🌮','🍦','🍰','🥂','☕','🍺','🥗',
  '🎬','🎮','🎵','🎭','🎪','🎨','📚','🃏','🎲','🎸','🎤','🎧',
  '🥾','🏖️','🗻','🏕️','🌊','🚵','🏄','⛷️','🎿','🧗','🏃','🚴',
  '⚽','🏀','🎾','🏓','🏋️','🥊','⛳','🎳','🏊','🤸',
  '❤️','🔥','🌟','✨','💯','🙌','🥳','😍','🤩','💥','👏','🫶',
]

function buildOptions(customOptions) {
  if (!customOptions || !customOptions.length) return DEFAULT_RESPONSES
  return customOptions.map((opt, i) => ({
    value: opt.value || `opt_${i}`,
    emoji: opt.emoji || '⭐',
    label: opt.label,
    color: 'var(--rose)',
  }))
}

const TYPE_EMOJI = {
  dining: '🍽️', movies: '🎬', books: '📚', hiking: '🥾', gaming: '🎮', arts: '🎨',
}

function deadlineLabel(deadline) {
  const diff = new Date(deadline) - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3600000)
  if (h < 24) return `${h}h left`
  return `${Math.floor(h / 24)}d left`
}

function ResponseBar({ label, emoji, count, total, highlighted }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontSize: '12px', color: highlighted ? 'var(--t1)' : 'var(--t2)', fontWeight: highlighted ? 700 : 500 }}>
          {emoji} {label} {highlighted && '← you'}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--t3)', fontWeight: 600 }}>{count}</span>
      </div>
      <div style={{ height: '5px', borderRadius: '99px', background: 'var(--s4)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: '99px', background: highlighted ? 'var(--rose)' : 'var(--glass)', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

// Inline edit form shown within the card
function EditPollForm({ poll, onSaved, onCancel }) {
  const DEADLINE_PRESETS = [
    { label: '24h', hours: 24 },
    { label: '48h', hours: 48 },
    { label: '72h', hours: 72 },
    { label: '1w', hours: 168 },
  ]
  const [title, setTitle] = useState(poll.activity_name)
  const [note, setNote] = useState(poll.note || '')
  const [deadlinePreset, setDeadlinePreset] = useState(null)
  const [customDeadline, setCustomDeadline] = useState(
    new Date(poll.deadline).toISOString().slice(0, 16)
  )
  const [allowMultiSelect, setAllowMultiSelect] = useState(!!poll.allow_multi_select)
  const [allowCustomResponse, setAllowCustomResponse] = useState(!!poll.allow_custom_response)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const computeDeadline = () => {
    if (deadlinePreset) {
      const d = new Date()
      d.setHours(d.getHours() + deadlinePreset)
      return d.toISOString()
    }
    return customDeadline ? new Date(customDeadline).toISOString() : null
  }

  const handleSave = async () => {
    if (!title.trim()) { setError('Give your poll a title to continue.'); return }
    setSaving(true); setError('')
    try {
      const updated = await groupsApi.editPoll(poll.id, {
        activity_name: title.trim(),
        note: note.trim() || null,
        deadline: computeDeadline(),
        allow_multi_select: allowMultiSelect,
        allow_custom_response: allowCustomResponse,
      })
      onSaved(updated)
    } catch {
      setError('Hmm, that didn\'t save. Mind trying again?')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    background: 'var(--s3)', border: '1px solid var(--glass)', borderRadius: '8px',
    padding: '7px 10px', fontSize: '13px', color: 'var(--t1)', width: '100%',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
      <div>
        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t3)', marginBottom: '4px' }}>TITLE</div>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} style={inputStyle} />
      </div>
      <div>
        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t3)', marginBottom: '4px' }}>NOTE (optional)</div>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={500}
          style={{ ...inputStyle, resize: 'none' }} />
      </div>
      <div>
        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t3)', marginBottom: '4px' }}>DEADLINE</div>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '6px', flexWrap: 'wrap' }}>
          {DEADLINE_PRESETS.map(p => (
            <button key={p.hours} onClick={() => setDeadlinePreset(p.hours)}
              style={{
                padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${deadlinePreset === p.hours ? 'var(--rose-border)' : 'var(--glass)'}`,
                background: deadlinePreset === p.hours ? 'var(--rose-glow)' : 'var(--s3)',
                color: deadlinePreset === p.hours ? 'var(--rose-soft)' : 'var(--t2)',
              }}
            >{p.label} from now</button>
          ))}
        </div>
        <input type="datetime-local" value={customDeadline}
          onChange={e => { setCustomDeadline(e.target.value); setDeadlinePreset(null) }}
          style={{ ...inputStyle, fontSize: '12px' }} />
      </div>
      <div>
        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t3)', marginBottom: '6px' }}>RESPONSE SETTINGS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {[
            { key: 'multi', label: 'Allow multiple selections', sub: 'Members can vote for more than one option', val: allowMultiSelect, set: setAllowMultiSelect },
            { key: 'write', label: 'Allow write-in options', sub: 'Members can suggest their own options', val: allowCustomResponse, set: setAllowCustomResponse },
          ].map(({ key, label, sub, val, set }) => (
            <div key={key} onClick={() => set(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '8px 10px', borderRadius: '8px', background: val ? 'var(--rose-glow)' : 'var(--s3)', border: `1px solid ${val ? 'var(--rose-border)' : 'var(--glass)'}`, transition: 'all 0.15s' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)' }}>{label}</div>
                <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '1px' }}>{sub}</div>
              </div>
              <div style={{ width: '32px', height: '18px', borderRadius: '99px', background: val ? 'var(--rose)' : 'var(--t4)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                <div style={{ position: 'absolute', top: '2px', left: val ? '16px' : '2px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {error && <div style={{ fontSize: '11px', color: 'var(--rose-soft)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '6px' }}>
        <Button variant="primary" loading={saving} onClick={handleSave} style={{ flex: 1 }}>Save</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

// Write-in option adder
function AddOptionRow({ poll, currentUserId, onUpdated }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [emoji, setEmoji] = useState('⭐')
  const [showEmojis, setShowEmojis] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!poll.allow_custom_response) return null

  const handleAdd = async () => {
    if (!label.trim()) return
    setSaving(true); setError('')
    try {
      const updated = await groupsApi.addPollOption(poll.id, currentUserId, label.trim(), emoji)
      onUpdated(updated)
      setLabel(''); setEmoji('⭐'); setOpen(false)
    } catch {
      setError('We couldn\'t add that option. Give it another go.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none',
        color: 'var(--t3)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: '4px 0',
      }}>
        + Suggest an option
      </button>
    )
  }

  return (
    <div style={{ background: 'var(--s3)', border: '1px solid var(--glass)', borderRadius: '10px', padding: '10px', marginTop: '4px' }}>
      <div style={{ display: 'flex', gap: '6px', marginBottom: showEmojis ? '8px' : 0 }}>
        <button onClick={() => setShowEmojis(v => !v)} style={{
          width: '34px', height: '34px', flexShrink: 0, borderRadius: '8px', border: '1px solid var(--glass)',
          background: 'var(--s2)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{emoji}</button>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Your option…" maxLength={120}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          style={{ flex: 1, background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', color: 'var(--t1)', outline: 'none' }} />
        <Button variant="primary" loading={saving} onClick={handleAdd}>Add</Button>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: '18px' }}>×</button>
      </div>
      {showEmojis && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '6px', background: 'var(--s2)', borderRadius: '8px' }}>
          {OPTION_EMOJIS.map(em => (
            <button key={em} onClick={() => { setEmoji(em); setShowEmojis(false) }} style={{
              width: '30px', height: '30px', borderRadius: '6px', border: emoji === em ? '1px solid var(--rose-border)' : '1px solid var(--glass)',
              background: emoji === em ? 'var(--rose-glow)' : 'var(--s3)', fontSize: '16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{em}</button>
          ))}
        </div>
      )}
      {error && <div style={{ fontSize: '11px', color: 'var(--rose-soft)', marginTop: '4px' }}>{error}</div>}
    </div>
  )
}

// 3-dot kebab menu
function PollMenu({ poll, isCreator, onEdit, onNotify, onClose, notifyLoading }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!isCreator) return null

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '28px', height: '28px', borderRadius: '8px', border: '1px solid var(--glass)',
          background: open ? 'var(--s3)' : 'transparent', color: 'var(--t3)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
        }}
      >⋯</button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '32px', zIndex: 100,
          background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '12px',
          padding: '6px', minWidth: '160px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}>
          {poll.status === 'open' && (
            <>
              <MenuItem icon="✏️" label="Edit poll" onClick={() => { setOpen(false); onEdit() }} />
              <MenuItem icon="🔔" label={notifyLoading ? 'Sending…' : 'Remind members'} onClick={() => { setOpen(false); onNotify() }} disabled={notifyLoading} />
              <div style={{ height: '1px', background: 'var(--glass)', margin: '4px 0' }} />
              <MenuItem icon="🔒" label="Close poll" onClick={() => { setOpen(false); onClose() }} danger />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({ icon, label, onClick, danger, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left',
        padding: '7px 10px', borderRadius: '8px', border: 'none', background: 'transparent',
        color: danger ? 'var(--rose-soft)' : 'var(--t2)', fontSize: '12px', fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = 'var(--s3)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span>{icon}</span>{label}
    </button>
  )
}

export default function PollCard({ poll: initialPoll, currentUserId, onUpdated, onConvertToEvent }) {
  const navigate = useNavigate()
  const [poll, setPoll] = useState(initialPoll)
  const [responding, setResponding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [notifyLoading, setNotifyLoading] = useState(false)
  const [notifyMsg, setNotifyMsg] = useState('')
  const [multiSelections, setMultiSelections] = useState([])

  // Keep in sync when parent updates the poll (e.g. after a list refresh)
  useEffect(() => { setPoll(initialPoll) }, [initialPoll])

  const summary = poll.summary || {}
  const hasResponded = summary.has_responded
  const isPollClosed = poll.status !== 'open'
  const isCreator = poll.created_by === currentUserId
  const allowMultiSelect = !!poll.allow_multi_select
  // Creators always see the breakdown so they can track responses live
  const showBreakdown = hasResponded || isPollClosed || isCreator
  const totalResponded = summary.responded || 0
  const totalMembers = summary.total_members || 0
  const userResponse = summary.user_response?.response
  const userResponses = (() => {
    const raw = summary.user_response?.responses
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return [] } }
    return userResponse ? [userResponse] : []
  })()

  const activityEmoji = TYPE_EMOJI[poll.activity_type] || '📋'
  const deadlineExpired = new Date(poll.deadline) <= Date.now()
  const options = buildOptions(poll.custom_options)
  const creatorLabel = poll.creator_username || `#${poll.created_by}`

  // Poll for live updates every 30s while open and showing breakdown
  useEffect(() => {
    if (isPollClosed || !showBreakdown) return
    const interval = setInterval(async () => {
      try {
        const fresh = await groupsApi.getPoll(poll.id, currentUserId)
        setPoll(fresh)
        onUpdated?.(fresh)
      } catch {}
    }, 30000)
    return () => clearInterval(interval)
  }, [poll.id, currentUserId, isPollClosed, showBreakdown])

  const toggleMultiSelection = (value) => {
    setMultiSelections(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )
  }

  const handleRespond = async (responseValue) => {
    setResponding(true)
    try {
      const updated = await groupsApi.respondToPoll(poll.id, currentUserId, responseValue)
      setPoll(updated)
      onUpdated?.(updated)
    } catch {}
    finally { setResponding(false) }
  }

  const handleMultiSubmit = async () => {
    if (!multiSelections.length) return
    setResponding(true)
    try {
      const updated = await groupsApi.respondToPoll(poll.id, currentUserId, multiSelections)
      setPoll(updated)
      onUpdated?.(updated)
      setMultiSelections([])
    } catch {}
    finally { setResponding(false) }
  }

  const handleClose = async () => {
    try {
      const updated = await groupsApi.closePoll(poll.id, currentUserId)
      setPoll(updated)
      onUpdated?.(updated)
    } catch {}
  }

  const handleNotify = async () => {
    setNotifyLoading(true)
    setNotifyMsg('')
    try {
      const res = await groupsApi.notifyPoll(poll.id)
      setNotifyMsg(res.notified === 0 ? 'Everyone has already responded!' : `Reminded ${res.notified} member${res.notified !== 1 ? 's' : ''} 🔔`)
    } catch {
      setNotifyMsg('We couldn\'t send the reminder. Give it another go.')
    } finally {
      setNotifyLoading(false)
      setTimeout(() => setNotifyMsg(''), 4000)
    }
  }

  const handleSavedEdit = (updated) => {
    setPoll(updated)
    onUpdated?.(updated)
    setEditing(false)
  }

  const statusChipStyle = (color, bg) => ({
    display: 'inline-block', fontSize: '10px', fontWeight: 700, color,
    background: bg, borderRadius: '99px', padding: '2px 8px', letterSpacing: '0.4px',
  })

  return (
    <div style={{
      background: 'var(--s2)', border: '1px solid var(--glass)',
      borderRadius: '16px', padding: '16px', marginBottom: '12px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
        <span style={{ fontSize: '24px', lineHeight: 1 }}>{activityEmoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--t1)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {poll.note || poll.activity_name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--t3)' }}>
            by {creatorLabel} ·{' '}
            <span style={{ color: deadlineExpired ? 'var(--amber)' : 'var(--t3)' }}>
              {deadlineExpired ? '⚠️ ' : '⏱ '}{deadlineLabel(poll.deadline)}
            </span>
          </div>
        </div>
        <span style={
          poll.status === 'open'
            ? statusChipStyle('var(--green)', 'rgba(34,211,160,0.12)')
            : poll.status === 'converted'
            ? statusChipStyle('var(--blue)', 'rgba(99,102,241,0.12)')
            : statusChipStyle('var(--t3)', 'var(--s3)')
        }>
          {poll.status === 'open' ? 'Open' : poll.status === 'converted' ? 'Converted' : 'Closed'}
        </span>
        <PollMenu
          poll={poll}
          isCreator={isCreator}
          onEdit={() => setEditing(v => !v)}
          onNotify={handleNotify}
          onClose={handleClose}
          notifyLoading={notifyLoading}
        />
      </div>

      {/* Inline edit form */}
      {editing && (
        <EditPollForm poll={poll} onSaved={handleSavedEdit} onCancel={() => setEditing(false)} />
      )}

      {/* Notify feedback */}
      {notifyMsg && (
        <div style={{ fontSize: '12px', color: 'var(--green)', marginBottom: '8px', fontWeight: 600 }}>
          {notifyMsg}
        </div>
      )}

      {/* Response count */}
      <div style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '12px' }}>
        {totalResponded} of {totalMembers} responded
      </div>

      {/* Voting buttons (non-creator who hasn't responded yet) */}
      {!showBreakdown && !isPollClosed && (
        allowMultiSelect ? (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginBottom: '8px', fontWeight: 600 }}>
              Select all that apply
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
              {options.map(r => {
                const checked = multiSelections.includes(r.value)
                return (
                  <button
                    key={r.value}
                    onClick={() => toggleMultiSelection(r.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      background: checked ? `${r.color}14` : 'var(--s3)',
                      border: `1px solid ${checked ? r.color : 'var(--glass)'}`,
                      borderRadius: '10px', padding: '10px 12px', cursor: 'pointer',
                      textAlign: 'left', transition: 'all 0.12s',
                    }}
                  >
                    <div style={{ width: '18px', height: '18px', borderRadius: '5px', border: `2px solid ${checked ? 'var(--rose)' : 'var(--t4)'}`, background: checked ? 'var(--rose)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {checked && <span style={{ color: '#fff', fontSize: '11px', fontWeight: 900, lineHeight: 1 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: '18px' }}>{r.emoji}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: checked ? 'var(--t1)' : 'var(--t2)' }}>{r.label}</span>
                  </button>
                )
              })}
            </div>
            <Button variant="primary" loading={responding} onClick={handleMultiSubmit} style={{ width: '100%' }} disabled={!multiSelections.length}>
              Submit votes {multiSelections.length > 0 ? `(${multiSelections.length})` : ''}
            </Button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            {options.map(r => (
              <button
                key={r.value}
                disabled={responding}
                onClick={() => handleRespond(r.value)}
                style={{
                  background: 'var(--s3)', border: `1px solid var(--glass)`, borderRadius: '12px',
                  padding: '12px 8px', cursor: 'pointer', textAlign: 'center',
                  transition: 'all 0.15s', opacity: responding ? 0.6 : 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = r.color; e.currentTarget.style.background = `${r.color}14` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass)'; e.currentTarget.style.background = 'var(--s3)' }}
              >
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{r.emoji}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t2)' }}>{r.label}</div>
              </button>
            ))}
          </div>
        )
      )}

      {/* Breakdown bars */}
      {showBreakdown && (
        <div style={{ marginBottom: '12px' }}>
          {allowMultiSelect && hasResponded && (
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginBottom: '6px', fontWeight: 600 }}>
              Your picks: {userResponses.map(v => options.find(o => o.value === v)?.emoji || v).join(' ')}
            </div>
          )}
          {options.map(r => (
            <ResponseBar
              key={r.value}
              emoji={r.emoji}
              label={r.label}
              count={summary.counts?.[r.value] || 0}
              total={totalResponded}
              highlighted={allowMultiSelect ? userResponses.includes(r.value) : userResponse === r.value}
            />
          ))}
          {/* Allow non-creator members who've responded to change their vote */}
          {hasResponded && !isCreator && !isPollClosed && (
            allowMultiSelect ? (
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '11px', color: 'var(--t3)', marginBottom: '6px', fontWeight: 600 }}>Change your picks</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                  {options.map(r => {
                    const checked = multiSelections.length ? multiSelections.includes(r.value) : userResponses.includes(r.value)
                    return (
                      <button
                        key={r.value}
                        onClick={() => {
                          const current = multiSelections.length ? multiSelections : [...userResponses]
                          setMultiSelections(current.includes(r.value) ? current.filter(v => v !== r.value) : [...current, r.value])
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          background: checked ? 'var(--rose-glow)' : 'var(--s3)',
                          border: `1px solid ${checked ? 'var(--rose-border)' : 'var(--glass)'}`,
                          borderRadius: '8px', padding: '7px 10px', cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${checked ? 'var(--rose)' : 'var(--t4)'}`, background: checked ? 'var(--rose)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {checked && <span style={{ color: '#fff', fontSize: '10px', fontWeight: 900, lineHeight: 1 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: '14px' }}>{r.emoji}</span>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: checked ? 'var(--rose-soft)' : 'var(--t3)' }}>{r.label}</span>
                      </button>
                    )
                  })}
                </div>
                <Button variant="ghost" loading={responding} onClick={handleMultiSubmit} style={{ width: '100%' }}>
                  Update picks {multiSelections.length > 0 ? `(${multiSelections.length})` : ''}
                </Button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '10px' }}>
                {options.map(r => (
                  <button
                    key={r.value}
                    disabled={responding}
                    onClick={() => handleRespond(r.value)}
                    style={{
                      background: userResponse === r.value ? `${r.color}14` : 'var(--s3)',
                      border: `1px solid ${userResponse === r.value ? r.color : 'var(--glass)'}`,
                      borderRadius: '8px', padding: '6px 8px', cursor: 'pointer',
                      fontSize: '11px', fontWeight: 700, color: userResponse === r.value ? 'var(--t1)' : 'var(--t3)',
                      opacity: responding ? 0.6 : 1, transition: 'all 0.12s',
                    }}
                  >
                    {r.emoji} {r.label}
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Write-in option suggestion (members on open custom polls) */}
      {!isPollClosed && (
        <AddOptionRow poll={poll} currentUserId={currentUserId} onUpdated={(updated) => { setPoll(updated); onUpdated?.(updated) }} />
      )}

      {/* Converted event link */}
      {poll.status === 'converted' && poll.converted_event_id && (
        <button
          onClick={() => navigate(`/events/${poll.converted_event_id}`)}
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.22)', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--blue)', cursor: 'pointer', width: '100%', marginBottom: '8px', marginTop: '8px' }}
        >
          View Created Event →
        </button>
      )}

      {/* Creator primary actions (Convert to Event — Close is in menu) */}
      {isCreator && poll.status === 'open' && (
        <div style={{ borderTop: '1px solid var(--glass)', paddingTop: '12px', marginTop: '8px' }}>
          <Button variant="primary" style={{ width: '100%' }} onClick={() => onConvertToEvent?.(poll)}>
            Convert to Event
          </Button>
        </div>
      )}
    </div>
  )
}
