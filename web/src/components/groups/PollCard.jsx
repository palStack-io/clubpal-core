import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../ui/Button'
import { groupsApi } from '../../api/groups'
import { eventsApi } from '../../api/events'

const RESPONSES = [
  { value: 'in', emoji: '🙌', label: "I'm in!", color: '#22d3a0' },
  { value: 'done_loved', emoji: '❤️', label: 'Done it, loved it', color: '#f43f5e' },
  { value: 'done_pass', emoji: '👎', label: 'Done it, pass', color: '#f59e0b' },
  { value: 'cant_make_it', emoji: '🚫', label: "Can't make it", color: 'var(--t3)' },
]

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

export default function PollCard({ poll, currentUserId, onUpdated }) {
  const navigate = useNavigate()
  const [responding, setResponding] = useState(false)
  const [converting, setConverting] = useState(false)
  const [showConvertForm, setShowConvertForm] = useState(false)
  const [convertDate, setConvertDate] = useState('')
  const [convertLocation, setConvertLocation] = useState('')
  const [convertMaxAttendees, setConvertMaxAttendees] = useState('')
  const [recurringSchedules, setRecurringSchedules] = useState([])
  const [selectedScheduleId, setSelectedScheduleId] = useState('')

  useEffect(() => {
    if (showConvertForm && poll.group_id) {
      eventsApi.getGroupRecurringSchedules(poll.group_id)
        .then(s => setRecurringSchedules((s || []).filter(r => r.is_active)))
        .catch(() => {})
    }
  }, [showConvertForm, poll.group_id])

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

  const handleConvert = async () => {
    setConverting(true)
    try {
      const updated = await groupsApi.convertPoll(poll.id, currentUserId, {
        scheduled_date: convertDate ? `${convertDate}T12:00:00` : null,
        location: convertLocation || null,
        recurring_schedule_id: selectedScheduleId ? parseInt(selectedScheduleId) : null,
        max_attendees: convertMaxAttendees ? parseInt(convertMaxAttendees, 10) : null,
      })
      onUpdated?.(updated)
      if (updated.converted_event_id) {
        navigate(`/events/${updated.converted_event_id}`)
      }
    } catch {}
    finally { setConverting(false) }
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
            {poll.activity_name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--t3)' }}>
            by #{poll.created_by} ·{' '}
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

      {/* Note */}
      {poll.note && (
        <div style={{ fontSize: '12px', color: 'var(--t2)', background: 'var(--s3)', borderRadius: '10px', padding: '8px 12px', marginBottom: '12px', borderLeft: '3px solid var(--glass)' }}>
          {poll.note}
        </div>
      )}

      {/* Response count */}
      <div style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '12px' }}>
        {totalResponded} of {totalMembers} responded
      </div>

      {/* Tap buttons (before responding) */}
      {!showBreakdown && !isPollClosed && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          {RESPONSES.map(r => (
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
          {RESPONSES.map(r => (
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
        <div style={{ borderTop: '1px solid var(--glass)', paddingTop: '12px', marginTop: '4px' }}>
          {!showConvertForm ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="primary" style={{ flex: 1 }} onClick={() => setShowConvertForm(true)}>
                🎯 Convert to Event
              </Button>
              <Button variant="ghost" onClick={handleClose}>Close</Button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="date"
                  value={convertDate}
                  onChange={e => setConvertDate(e.target.value)}
                  placeholder="Date (optional)"
                  style={{ background: 'var(--s3)', border: '1px solid var(--glass)', borderRadius: '8px', padding: '8px', fontSize: '12px', color: 'var(--t1)', outline: 'none' }}
                />
                <input
                  type="text"
                  value={convertLocation}
                  onChange={e => setConvertLocation(e.target.value)}
                  placeholder="Location (optional)"
                  style={{ background: 'var(--s3)', border: '1px solid var(--glass)', borderRadius: '8px', padding: '8px', fontSize: '12px', color: 'var(--t1)', outline: 'none' }}
                />
              </div>
              <input
                type="number"
                min="1"
                value={convertMaxAttendees}
                onChange={e => setConvertMaxAttendees(e.target.value)}
                placeholder="Max seats (optional, leave blank for unlimited)"
                style={{ width: '100%', background: 'var(--s3)', border: '1px solid var(--glass)', borderRadius: '8px', padding: '8px', fontSize: '12px', color: 'var(--t1)', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }}
              />
              {recurringSchedules.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <select
                    value={selectedScheduleId}
                    onChange={e => setSelectedScheduleId(e.target.value)}
                    style={{ width: '100%', background: 'var(--s3)', border: '1px solid var(--glass)', borderRadius: '8px', padding: '8px', fontSize: '12px', color: 'var(--t1)', outline: 'none' }}
                  >
                    <option value="">🗓 Standalone event</option>
                    {recurringSchedules.map(s => (
                      <option key={s.id} value={s.id}>🔁 {s.title} ({s.recurrence_rule})</option>
                    ))}
                  </select>
                  {selectedScheduleId && (
                    <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '4px', paddingLeft: '4px' }}>
                      This will become the next occurrence of the selected series
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="primary" style={{ flex: 1 }} loading={converting} onClick={handleConvert}>
                  Create Event →
                </Button>
                <Button variant="ghost" onClick={() => setShowConvertForm(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
