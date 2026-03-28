import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../ui/Button'
import { groupsApi } from '../../api/groups'

const DEFAULT_RESPONSES = [
  { value: 'in', emoji: '🙌', label: "I'm in!", color: '#22d3a0' },
  { value: 'done_loved', emoji: '❤️', label: 'Done it, loved it', color: '#f43f5e' },
  { value: 'done_pass', emoji: '👎', label: 'Done it, pass', color: '#f59e0b' },
  { value: 'cant_make_it', emoji: '🚫', label: "Can't make it", color: 'var(--t3)' },
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

export default function PollCard({ poll, currentUserId, onUpdated, onConvertToEvent }) {
  const navigate = useNavigate()
  const [responding, setResponding] = useState(false)

  const summary = poll.summary || {}
  const hasResponded = summary.has_responded
  const isPollClosed = poll.status !== 'open'
  const showBreakdown = hasResponded || isPollClosed
  const isCreator = poll.created_by === currentUserId
  const totalResponded = summary.responded || 0
  const totalMembers = summary.total_members || 0
  const userResponse = summary.user_response?.response

  const activityEmoji = TYPE_EMOJI[poll.activity_type] || '📋'
  const deadlineExpired = new Date(poll.deadline) <= Date.now()
  const options = buildOptions(poll.custom_options)
  const creatorLabel = poll.creator_username || `#${poll.created_by}`

  const handleRespond = async (responseValue) => {
    setResponding(true)
    try {
      const updated = await groupsApi.respondToPoll(poll.id, currentUserId, responseValue)
      onUpdated?.(updated)
    } catch {}
    finally { setResponding(false) }
  }

  const handleClose = async () => {
    try {
      const updated = await groupsApi.closePoll(poll.id, currentUserId)
      onUpdated?.(updated)
    } catch {}
  }

  const statusChipStyle = (color, bg) => ({
    display: 'inline-block',
    fontSize: '10px',
    fontWeight: 700,
    color,
    background: bg,
    borderRadius: '99px',
    padding: '2px 8px',
    letterSpacing: '0.4px',
  })

  return (
    <div style={{
      background: 'var(--s2)',
      border: '1px solid var(--glass)',
      borderRadius: '16px',
      padding: '16px',
      marginBottom: '12px',
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
        {/* Status chip */}
        <span style={
          poll.status === 'open'
            ? statusChipStyle('var(--green)', 'rgba(34,211,160,0.12)')
            : poll.status === 'converted'
            ? statusChipStyle('var(--blue)', 'rgba(99,102,241,0.12)')
            : statusChipStyle('var(--t3)', 'var(--s3)')
        }>
          {poll.status === 'open' ? 'Open' : poll.status === 'converted' ? 'Converted' : 'Closed'}
        </span>
      </div>


      {/* Response count */}
      <div style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '12px' }}>
        {totalResponded} of {totalMembers} responded
      </div>

      {/* Tap buttons (before responding) */}
      {!showBreakdown && !isPollClosed && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          {options.map(r => (
            <button
              key={r.value}
              disabled={responding}
              onClick={() => handleRespond(r.value)}
              style={{
                background: 'var(--s3)',
                border: `1px solid var(--glass)`,
                borderRadius: '12px',
                padding: '12px 8px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s',
                opacity: responding ? 0.6 : 1,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = r.color; e.currentTarget.style.background = `${r.color}14` }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass)'; e.currentTarget.style.background = 'var(--s3)' }}
            >
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>{r.emoji}</div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t2)' }}>{r.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Response breakdown (after responding or closed) */}
      {showBreakdown && (
        <div style={{ marginBottom: '12px' }}>
          {options.map(r => (
            <ResponseBar
              key={r.value}
              emoji={r.emoji}
              label={r.label}
              count={summary.counts?.[r.value] || 0}
              total={totalResponded}
              highlighted={userResponse === r.value}
            />
          ))}
        </div>
      )}

      {/* Converted event link */}
      {poll.status === 'converted' && poll.converted_event_id && (
        <button
          onClick={() => navigate(`/events/${poll.converted_event_id}`)}
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.22)', borderRadius: '10px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--blue)', cursor: 'pointer', width: '100%', marginBottom: '8px' }}
        >
          🎉 View Created Event →
        </button>
      )}

      {/* Picker actions */}
      {isCreator && poll.status === 'open' && (
        <div style={{ borderTop: '1px solid var(--glass)', paddingTop: '12px', marginTop: '4px', display: 'flex', gap: '8px' }}>
          <Button variant="primary" style={{ flex: 1 }} onClick={() => onConvertToEvent?.(poll)}>
            🎯 Convert to Event
          </Button>
          <Button variant="ghost" onClick={handleClose}>Close</Button>
        </div>
      )}
    </div>
  )
}
