import { useState, useEffect, useRef } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { eventsApi } from '../../api/events'
import BackgroundPicker from '../ui/BackgroundPicker'

const ACTIVITY = {
  dining: { emoji: '🍽️', color: '#f43f5e', rgb: '244,63,94' },
  movies: { emoji: '🎬', color: '#6366f1', rgb: '99,102,241' },
  books:  { emoji: '📚', color: '#a855f7', rgb: '168,85,247' },
  hiking: { emoji: '🥾', color: '#14b8a6', rgb: '20,184,166' },
  gaming: { emoji: '🎮', color: '#22d3a0', rgb: '34,211,160' },
  arts:   { emoji: '🎨', color: '#f59e0b', rgb: '245,158,11' },
}

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

function extractDateParts(dateStr) {
  if (!dateStr) return { date: '', time: '' }
  try {
    const d = new Date(dateStr)
    const date = d.toISOString().split('T')[0] // YYYY-MM-DD
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    const time = `${hours}:${mins}`
    return { date, time }
  } catch {
    return { date: '', time: '' }
  }
}

export default function EditEventModal({ isOpen, onClose, event, onSaved, onCancel }) {
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [notes, setNotes] = useState('')
  const [rsvpDeadlineDate, setRsvpDeadlineDate] = useState('')
  const [rsvpDeadlineTime, setRsvpDeadlineTime] = useState('')
  const [coverPreview, setCoverPreview] = useState(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [bgType, setBgType] = useState('default')
  const [bgValue, setBgValue] = useState('')
  const [bgScope, setBgScope] = useState('hero')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const coverRef = useRef()

  useEffect(() => {
    if (event) {
      const { date, time } = extractDateParts(event.scheduled_date)
      setScheduledDate(date)
      setScheduledTime(time)
      setNotes(event.description || '')
      setCoverPreview(event.cover_url || null)
      setBgType(event.bg_type || 'default')
      setBgValue(event.bg_value || '')
      setBgScope(event.bg_scope || 'hero')
      if (event.rsvp_deadline) {
        const { date: dDate, time: dTime } = extractDateParts(event.rsvp_deadline)
        setRsvpDeadlineDate(dDate)
        setRsvpDeadlineTime(dTime)
      } else {
        setRsvpDeadlineDate('')
        setRsvpDeadlineTime('')
      }
    }
  }, [event])

  if (!event) return null

  const actKey = event.activity_type?.toLowerCase() || 'dining'
  const act = ACTIVITY[actKey] || ACTIVITY.dining

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      let scheduledDateTime = null
      if (scheduledDate) {
        scheduledDateTime = scheduledTime
          ? `${scheduledDate}T${scheduledTime}:00`
          : `${scheduledDate}T00:00:00`
      }
      let rsvpDeadlineISO = null
      if (rsvpDeadlineDate) {
        rsvpDeadlineISO = rsvpDeadlineTime
          ? `${rsvpDeadlineDate}T${rsvpDeadlineTime}:00`
          : `${rsvpDeadlineDate}T23:59:00`
      }
      await eventsApi.update(event.id, {
        scheduled_date: scheduledDateTime,
        description: notes.trim() || null,
        rsvp_deadline: rsvpDeadlineISO,
        bg_type: bgType,
        bg_value: bgValue,
        bg_scope: bgScope,
      })
      onSaved && onSaved()
    } catch (err) {
      setError(
        err?.response?.data?.detail || 'Failed to save changes. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleBgImageUpload = async (file) => {
    setCoverUploading(true)
    try {
      const urlData = await eventsApi.getCoverUploadUrl(event.id, file.name, file.type)
      const res = await fetch(urlData.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      setBgType('image')
      setBgValue(urlData.public_url)
    } catch {
      // silent
    } finally {
      setCoverUploading(false)
    }
  }

  const handleCoverFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverUploading(true)
    try {
      const urlData = await eventsApi.getCoverUploadUrl(event.id, file.name, file.type)
      const res = await fetch(urlData.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      await eventsApi.update(event.id, { cover_url: urlData.public_url })
      setCoverPreview(urlData.public_url)
    } catch {
      // silent
    } finally {
      setCoverUploading(false)
    }
  }

  const focusBorder = (e) => (e.target.style.borderColor = 'var(--rose-border)')
  const blurBorder = (e) => (e.target.style.borderColor = 'var(--glass)')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Event" size="lg">
      {/* Section 1: Event identity (read-only) */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Emoji box */}
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: `rgba(${act.rgb},0.12)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              flexShrink: 0,
            }}
          >
            {act.emoji}
          </div>

          {/* Title + chip */}
          <div>
            <div
              style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t1)', marginBottom: '4px' }}
            >
              {event.title || event.venue_name || 'Event'}
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: `rgba(${act.rgb},0.12)`,
                color: act.color,
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '100px',
                border: `1px solid rgba(${act.rgb},0.22)`,
              }}
            >
              {act.emoji} {actKey}
            </span>
          </div>
        </div>

        <div
          style={{
            fontSize: '11px',
            color: 'var(--t3)',
            marginTop: '8px',
          }}
        >
          🔒 The venue/activity can't be changed after creation. Cancel and create a new
          event if needed.
        </div>
      </div>

      {/* Section 2: When */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>When</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>
          <div>
            <label style={labelStyle}>Time</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>
        </div>

        {/* RSVP Deadline */}
        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--glass)' }}>
          <label style={labelStyle}>RSVP Deadline (optional)</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <input
              type="date"
              value={rsvpDeadlineDate}
              onChange={(e) => setRsvpDeadlineDate(e.target.value)}
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
            <input
              type="time"
              value={rsvpDeadlineTime}
              onChange={(e) => setRsvpDeadlineTime(e.target.value)}
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>
          {rsvpDeadlineDate && (
            <div style={{ fontSize: '11px', color: 'var(--amber)', marginTop: '6px' }}>
              ⏰ Members will be reminded as the deadline approaches.
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Notes */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Notes (optional)</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any details, dress code, reservations…"
          style={{
            ...inputStyle,
            minHeight: '80px',
            resize: 'vertical',
          }}
          onFocus={focusBorder}
          onBlur={blurBorder}
        />
      </div>

      {/* Section 4: Background */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Background</div>
        <BackgroundPicker
          bgType={bgType}
          bgValue={bgValue}
          bgScope={bgScope}
          onChange={(changes) => {
            if (changes.bg_type !== undefined) setBgType(changes.bg_type)
            if (changes.bg_value !== undefined) setBgValue(changes.bg_value)
            if (changes.bg_scope !== undefined) setBgScope(changes.bg_scope)
          }}
          onImageUpload={handleBgImageUpload}
          imageUploading={coverUploading}
        />
      </div>

      {/* Section 5: Danger Zone */}
      <div
        style={{
          background: 'rgba(248,113,113,0.05)',
          border: '1px solid rgba(248,113,113,0.15)',
          borderRadius: '14px',
          padding: '18px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: '#f87171',
            marginBottom: '12px',
          }}
        >
          Danger Zone
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>
              Cancel this event
            </div>
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '2px' }}>
              Members will be notified.
            </div>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onCancel && onCancel(event.id)}
          >
            Cancel Event
          </Button>
        </div>
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
          Save Changes
        </Button>
      </div>
    </Modal>
  )
}
