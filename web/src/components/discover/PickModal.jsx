import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { useAuth } from '../../contexts/AuthContext'
import { groupsApi } from '../../api/groups'
import { eventsApi } from '../../api/events'

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
  padding: '16px',
  marginBottom: '12px',
}

/**
 * PickModal — dark-mode redesign.
 * Opens when user clicks "Pick This X" on a discovery page.
 * Creates an event pre-filled with the discovered item's title and location.
 *
 * Props:
 *   title        string  — event title
 *   location     string  — venue address or null for media items
 *   activityId   number  — activity type ID (optional)
 *   activityType string  — activity type key (optional, for poll pre-fill)
 *   onClose      fn      — called when modal is dismissed
 *   onPollGroup  fn      — called when user chooses "Poll Group First"; receives { title, activityType }
 */
export default function PickModal({ title, location, activityId, activityType, onClose, onPollGroup }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [groups, setGroups] = useState([])
  const [groupId, setGroupId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [notes, setNotes] = useState('')
  const [maxAttendees, setMaxAttendees] = useState('')
  const [pulseCheck, setPulseCheck] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    groupsApi.getUserGroups(user.id)
      .then(g => setGroups(Array.isArray(g) ? g : g?.groups || []))
      .catch(() => {})
  }, [user.id])

  const focusBorder = (e) => (e.target.style.borderColor = 'var(--rose-border)')
  const blurBorder = (e) => (e.target.style.borderColor = 'var(--glass)')

  const handleSubmit = async () => {
    if (!groupId) { setError('Please select a group.'); return }
    setError('')
    setLoading(true)
    try {
      let scheduledDateTime = null
      if (scheduledDate) {
        scheduledDateTime = scheduledTime
          ? `${scheduledDate}T${scheduledTime}:00`
          : `${scheduledDate}T00:00:00`
      }
      const event = await eventsApi.create({
        group_id: parseInt(groupId),
        activity_id: activityId || null,
        title,
        scheduled_date: scheduledDateTime,
        location: location || null,
        description: notes.trim() || null,
        created_by: user?.id,
        max_attendees: maxAttendees ? parseInt(maxAttendees, 10) : null,
      })
      if (pulseCheck) {
        groupsApi.createPoll(groupId, user?.id, {
          activity_name: title,
          activity_type: activityType || 'dining',
        }).catch(() => {})
      }
      onClose()
      navigate(`/events/${event.id}`)
    } catch (err) {
      setError(err?.response?.data?.detail || 'We couldn\'t create that event. Give it another go.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Pick for Your Group" size="md">
      {/* Event preview chip */}
      <div style={{
        background: 'rgba(244,63,94,0.08)',
        border: '1px solid var(--rose-border)',
        borderRadius: '12px',
        padding: '12px 16px',
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--rose-soft)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
          Selected
        </div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t1)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </div>
        {location && (
          <div style={{ fontSize: '12px', color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📍 {location}
          </div>
        )}
      </div>

      {/* Group selector */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Group *</label>
        <select
          value={groupId}
          onChange={e => setGroupId(e.target.value)}
          style={{ ...inputStyle, appearance: 'none' }}
          onFocus={focusBorder}
          onBlur={blurBorder}
        >
          <option value="">Select a group…</option>
          {groups.map(g => (
            <option key={g.id} value={String(g.id)}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* Date & time */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Date & Time (optional)</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <input
            type="date"
            value={scheduledDate}
            onChange={e => setScheduledDate(e.target.value)}
            style={inputStyle}
            onFocus={focusBorder}
            onBlur={blurBorder}
          />
          <input
            type="time"
            value={scheduledTime}
            onChange={e => setScheduledTime(e.target.value)}
            style={inputStyle}
            onFocus={focusBorder}
            onBlur={blurBorder}
          />
        </div>
      </div>

      {/* Max seats */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Max Seats (optional)</label>
        <input
          type="number"
          min="1"
          value={maxAttendees}
          onChange={e => setMaxAttendees(e.target.value)}
          placeholder="Unlimited"
          style={{ ...inputStyle, maxWidth: '140px' }}
          onFocus={focusBorder}
          onBlur={blurBorder}
        />
      </div>

      {/* Pulse Check toggle */}
      <div
        style={{ ...sectionStyle, display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}
        onClick={() => setPulseCheck(v => !v)}
      >
        <div style={{ width: '40px', height: '22px', borderRadius: '11px', background: pulseCheck ? 'var(--rose)' : 'var(--glass)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: '2px', left: pulseCheck ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '9px', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: pulseCheck ? 'var(--rose-soft)' : 'var(--t2)' }}>Send Pulse Check</div>
          <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '2px' }}>Ask the group how they feel about this pick after creating the event</div>
        </div>
      </div>

      {/* Notes */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Notes (optional)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any details for the group…"
          rows={2}
          style={{ ...inputStyle, resize: 'none', minHeight: '64px' }}
          onFocus={focusBorder}
          onBlur={blurBorder}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(248,113,113,0.1)',
          border: '1px solid rgba(248,113,113,0.2)',
          borderRadius: '10px',
          padding: '10px 14px',
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
        {onPollGroup && (
          <Button
            variant="ghost"
            onClick={() => {
              onClose()
              onPollGroup({ title, activityType })
            }}
          >
            Poll Group First
          </Button>
        )}
        <Button variant="primary" loading={loading} onClick={handleSubmit}>
          Create Event →
        </Button>
      </div>
    </Modal>
  )
}
