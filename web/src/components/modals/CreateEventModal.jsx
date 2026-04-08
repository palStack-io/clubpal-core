import { useState, useRef, useEffect } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { eventsApi } from '../../api/events'
import { groupsApi } from '../../api/groups'
import { useAuth } from '../../contexts/AuthContext'
import { enrichClient } from '../../api/client'

const toggleStyle = (active) => ({
  width: '40px', height: '22px', borderRadius: '11px',
  background: active ? 'var(--rose)' : 'var(--glass)',
  position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0,
})

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

function FormGroup({ label, children }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

export default function CreateEventModal({
  isOpen,
  onClose,
  groupId,
  groupName,
  activityType,
  onCreated,
  initialTitle,
  initialLocation,
  initialImageUrl,
  initialDescription,
  onPollGroup,
}) {
  const { user } = useAuth()
  const [title, setTitle] = useState(initialTitle || '')
  const [location, setLocation] = useState(initialLocation || '')
  const [locationSuggestions, setLocationSuggestions] = useState([])
  const locationDebounceRef = useRef(null)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [notes, setNotes] = useState(initialDescription || '')
  const [selectedGroupId, setSelectedGroupId] = useState(groupId || '')
  const [selectedActivity, setSelectedActivity] = useState(activityType || '')
  const [userGroups, setUserGroups] = useState([])
  const [coverFile, setCoverFile] = useState(null)
  // Pre-populate with discover item's first photo; user can override by picking a file
  const [coverPreview, setCoverPreview] = useState(initialImageUrl || null)
  const [coverUrlOverride, setCoverUrlOverride] = useState(initialImageUrl || null)
  const [maxAttendees, setMaxAttendees] = useState('')
  const [pulseCheck, setPulseCheck] = useState(false)
  const [billSplitEnabled, setBillSplitEnabled] = useState(false)
  const [ratingsEnabled, setRatingsEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showBillHint, setShowBillHint] = useState(() => !localStorage.getItem('clubpal_billsplit_hint_seen'))
  const coverRef = useRef()

  const dismissBillHint = () => {
    localStorage.setItem('clubpal_billsplit_hint_seen', 'true')
    setShowBillHint(false)
  }
  // RSVP deadline
  const [rsvpDeadlineDate, setRsvpDeadlineDate] = useState('')
  const [rsvpDeadlineTime, setRsvpDeadlineTime] = useState('')
  // Recurring
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrence, setRecurrence] = useState({ rule: 'weekly', day_of_week: 4, time_of_day: '18:00', end_date: '' })

  // Fetch user's groups when no groupId prop is provided
  useEffect(() => {
    if (!groupId && user?.id) {
      groupsApi.getUserGroups(user.id)
        .then(data => setUserGroups(Array.isArray(data) ? data : data?.groups || []))
        .catch(() => {})
    }
  }, [groupId, user?.id])

  const handleLocationChange = (value) => {
    setLocation(value)
    clearTimeout(locationDebounceRef.current)
    if (!value.trim()) { setLocationSuggestions([]); return }
    locationDebounceRef.current = setTimeout(async () => {
      try {
        const res = await enrichClient.get('/places/autocomplete', { params: { input: value } })
        setLocationSuggestions(Array.isArray(res.data) ? res.data : [])
      } catch {
        setLocationSuggestions([])
      }
    }, 350)
  }

  const resolvedGroupId = groupId || selectedGroupId
  const resolvedActivity = activityType || selectedActivity
  const actKey = resolvedActivity?.toLowerCase() || 'dining'
  const act = ACTIVITY[actKey] || ACTIVITY.dining

  const handleCoverPick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
    setCoverUrlOverride(null) // user chose a file — discard the discover image URL
    e.target.value = ''
  }

  const handleSubmit = async () => {
    setError('')
    if (!title.trim()) { setError('Event name is required.'); return }
    if (!resolvedGroupId) { setError('Please select a group.'); return }

    let scheduledDateTime = null
    if (scheduledDate) {
      const localStr = scheduledTime ? `${scheduledDate}T${scheduledTime}:00` : `${scheduledDate}T00:00:00`
      scheduledDateTime = new Date(localStr).toISOString()
    }

    let rsvpDeadlineISO = null
    if (rsvpDeadlineDate) {
      const localStr = rsvpDeadlineTime ? `${rsvpDeadlineDate}T${rsvpDeadlineTime}:00` : `${rsvpDeadlineDate}T23:59:00`
      rsvpDeadlineISO = new Date(localStr).toISOString()
    }

    setLoading(true)
    try {
      const event = await eventsApi.create({
        group_id: resolvedGroupId,
        title: title.trim(),
        location: location.trim() || null,
        scheduled_date: scheduledDateTime,
        description: notes.trim() || null,
        created_by: user?.id,
        host_user_id: user?.id,   // picker always becomes the host
        activity_type: resolvedActivity || null,
        rsvp_deadline: rsvpDeadlineISO,
        max_attendees: maxAttendees ? parseInt(maxAttendees, 10) : null,
        bill_split_enabled: billSplitEnabled,
        ratings_enabled: ratingsEnabled,
        // Pass discover item image as default banner (user may have kept or cleared it)
        banner_url: coverUrlOverride || null,
        ...(isRecurring && recurrence.end_date ? {
          is_recurring: true,
          recurrence_rule: recurrence.rule,
          recurrence_day_of_week: recurrence.rule !== 'monthly' ? recurrence.day_of_week : null,
          recurrence_time: recurrence.time_of_day,
          recurrence_end_date: recurrence.end_date,
        } : {}),
      })
      // Upload cover file if user picked one (overrides the discover image)
      if (coverFile) {
        try {
          const urlData = await eventsApi.getCoverUploadUrl(event.id, coverFile.name, coverFile.type)
          await fetch(urlData.upload_url, {
            method: 'PUT',
            headers: { 'Content-Type': coverFile.type },
            body: coverFile,
          })
          await eventsApi.update(event.id, { cover_url: urlData.public_url })
        } catch { /* non-fatal */ }
      }
      if (pulseCheck) {
        groupsApi.createPoll(resolvedGroupId, user?.id, {
          activity_name: title.trim(),
          activity_type: resolvedActivity || 'dining',
          note: notes.trim() || null,
        }).catch(() => {})
      }
      // Advance rotation if it was the user's turn — silently ignore errors
      if (resolvedGroupId) {
        groupsApi.completeTurn(resolvedGroupId).catch(() => {})
      }
      onCreated && onCreated(event.id)
    } catch (err) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(d => d.msg || String(d)).join('; ') : 'Failed to create event. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const focusBorder = (e) => (e.target.style.borderColor = 'var(--rose-border)')
  const blurBorder = (e) => (e.target.style.borderColor = 'var(--glass)')

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Plan Your Pick" size="lg">
      {/* Selected item chip — shown when pre-filled from Discover */}
      {initialTitle && (
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
            {initialTitle}
          </div>
          {initialLocation && (
            <div style={{ fontSize: '12px', color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📍 {initialLocation}
            </div>
          )}
        </div>
      )}

      {/* Subtitle */}
      {(groupName || resolvedGroupId) && (
        <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--t3)', marginBottom: '16px', marginTop: '-8px' }}>
          {act.emoji} {groupName || userGroups.find(g => String(g.id) === String(resolvedGroupId))?.name || 'Group'} · Your turn
        </div>
      )}

      {/* Group selector — only shown when no groupId prop */}
      {!groupId && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Group</div>
          <select
            value={selectedGroupId}
            onChange={e => {
              setSelectedGroupId(e.target.value)
              const g = userGroups.find(g => String(g.id) === e.target.value)
              if (g?.activity_type && !activityType) setSelectedActivity(g.activity_type)
            }}
            style={{ ...inputStyle, appearance: 'none' }}
            onFocus={focusBorder}
            onBlur={blurBorder}
          >
            <option value="">Select a group…</option>
            {userGroups.map(g => (
              <option key={g.id} value={String(g.id)}>{g.name}</option>
            ))}
          </select>

          {/* Activity picker */}
          {!activityType && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', marginTop: '12px' }}>
              {Object.entries(ACTIVITY).map(([key, a]) => (
                <div key={key} onClick={() => setSelectedActivity(key)}
                  style={{
                    padding: '10px 4px', textAlign: 'center', borderRadius: '10px', cursor: 'pointer',
                    border: selectedActivity === key ? `1px solid rgba(${a.rgb},0.35)` : '1px solid var(--glass)',
                    background: selectedActivity === key ? `rgba(${a.rgb},0.12)` : 'var(--s3)',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ fontSize: '22px' }}>{a.emoji}</div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: selectedActivity === key ? a.color : 'var(--t4)', marginTop: '3px' }}>{key}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section 1: Event Details */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Event Details</div>

        <FormGroup label="Event Name *">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Nobu Boston"
            style={inputStyle}
            onFocus={focusBorder}
            onBlur={blurBorder}
          />
        </FormGroup>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px' }}>
          <FormGroup label="Location (optional)">
            <div style={{ position: 'relative' }}>
              <input
                value={location}
                onChange={(e) => handleLocationChange(e.target.value)}
                placeholder="123 Main St"
                style={inputStyle}
                onFocus={focusBorder}
                onBlur={(e) => {
                  blurBorder(e)
                  // delay hide so click on suggestion registers first
                  setTimeout(() => setLocationSuggestions([]), 200)
                }}
                autoComplete="off"
              />
              {locationSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: 'var(--s2)', border: '1px solid var(--glass)',
                  borderRadius: '10px', marginTop: '4px', overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                  {locationSuggestions.map((s, i) => {
                    const label = s.description || s.name || s
                    return (
                      <div
                        key={i}
                        onMouseDown={() => {
                          setLocation(label)
                          setLocationSuggestions([])
                        }}
                        style={{
                          padding: '9px 12px', fontSize: '13px', color: 'var(--t1)',
                          cursor: 'pointer', borderBottom: i < locationSuggestions.length - 1 ? '1px solid var(--glass)' : 'none',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--s3)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        📍 {label}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </FormGroup>
          <FormGroup label="Max Seats">
            <input
              type="number"
              min="1"
              value={maxAttendees}
              onChange={(e) => setMaxAttendees(e.target.value)}
              placeholder="∞"
              style={{ ...inputStyle, width: '72px', textAlign: 'center' }}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </FormGroup>
        </div>

        {resolvedActivity && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: `rgba(${act.rgb},0.12)`, color: act.color, fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '100px', border: `1px solid rgba(${act.rgb},0.22)` }}>
            {act.emoji} {actKey}
          </span>
        )}
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
              ⏰ Members will be reminded when the RSVP deadline approaches.
            </div>
          )}
        </div>

        {/* Recurring toggle */}
        <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--glass)' }}>
          <button
            type="button"
            onClick={() => setIsRecurring(r => !r)}
            style={{
              background: isRecurring ? 'rgba(99,102,241,0.15)' : 'transparent',
              border: `1px solid ${isRecurring ? 'rgba(99,102,241,0.3)' : 'var(--glass)'}`,
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 600,
              color: isRecurring ? '#6366f1' : 'var(--t3)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            🔁 Repeat this event
          </button>

          {isRecurring && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Rule segmented control */}
              <div>
                <label style={labelStyle}>Recurrence</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[{ value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: 'Every 2 Weeks' }, { value: 'monthly', label: 'Monthly' }].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRecurrence(r => ({ ...r, rule: opt.value }))}
                      style={{
                        flex: 1, padding: '7px 4px', borderRadius: '8px',
                        border: `1px solid ${recurrence.rule === opt.value ? 'rgba(99,102,241,0.35)' : 'var(--glass)'}`,
                        background: recurrence.rule === opt.value ? 'rgba(99,102,241,0.12)' : 'var(--s2)',
                        color: recurrence.rule === opt.value ? '#6366f1' : 'var(--t3)',
                        fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day of week (hidden for monthly) */}
              {recurrence.rule !== 'monthly' && (
                <div>
                  <label style={labelStyle}>Day of Week</label>
                  <select
                    value={recurrence.day_of_week}
                    onChange={e => setRecurrence(r => ({ ...r, day_of_week: parseInt(e.target.value) }))}
                    style={{ ...inputStyle, appearance: 'none' }}
                    onFocus={focusBorder}
                    onBlur={blurBorder}
                  >
                    {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Time</label>
                  <input
                    type="time"
                    value={recurrence.time_of_day}
                    onChange={e => setRecurrence(r => ({ ...r, time_of_day: e.target.value }))}
                    style={inputStyle}
                    onFocus={focusBorder}
                    onBlur={blurBorder}
                  />
                </div>
                <div>
                  <label style={labelStyle}>End Date *</label>
                  <input
                    type="date"
                    value={recurrence.end_date}
                    onChange={e => setRecurrence(r => ({ ...r, end_date: e.target.value }))}
                    style={inputStyle}
                    onFocus={focusBorder}
                    onBlur={blurBorder}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Cover Image */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Cover Image (optional)</div>
        <input ref={coverRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCoverPick} />
        {coverPreview ? (
          <div style={{ position: 'relative', height: '120px', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => coverRef.current?.click()}>
            <img src={coverPreview} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {coverUrlOverride && !coverFile && (
              <div style={{ position: 'absolute', bottom: '6px', left: '8px', background: 'rgba(0,0,0,0.6)', borderRadius: '6px', padding: '2px 7px', fontSize: '10px', color: 'rgba(255,255,255,0.85)', pointerEvents: 'none' }}>
                Auto-filled from item · click to replace
              </div>
            )}
            <button onClick={e => { e.stopPropagation(); setCoverFile(null); setCoverPreview(null); setCoverUrlOverride(null) }}
              style={{ position: 'absolute', top: '6px', right: '6px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        ) : (
          <div onClick={() => coverRef.current?.click()}
            style={{ height: '120px', background: 'var(--s2)', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.12)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <span style={{ fontSize: '28px' }}>🖼️</span>
            <span style={{ fontSize: '12px', color: 'var(--rose-soft)' }}>Add a cover photo</span>
          </div>
        )}
      </div>

      {/* Pulse Check toggle */}
      <div style={{ ...sectionStyle, display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }} onClick={() => setPulseCheck(v => !v)}>
        <div style={toggleStyle(pulseCheck)}>
          <div style={{ position: 'absolute', top: '2px', left: pulseCheck ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '9px', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: pulseCheck ? 'var(--rose-soft)' : 'var(--t2)' }}>💬 Send Pulse Check</div>
          <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '2px' }}>Ask the group how they feel about this pick after creating the event</div>
        </div>
      </div>

      {/* Bill Split hint — shown first time only */}
      {showBillHint && (
        <div style={{
          background: 'rgba(34,211,160,0.07)',
          border: '1px solid rgba(34,211,160,0.22)',
          borderRadius: '14px',
          padding: '14px 16px',
          marginBottom: '12px',
          display: 'flex', alignItems: 'flex-start', gap: '12px',
        }}>
          <span style={{ fontSize: '22px', flexShrink: 0 }}>💸</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--green)', marginBottom: '3px' }}>
              Bill Split — track &amp; divide costs
            </div>
            <div style={{ fontSize: '12px', color: 'var(--t3)', lineHeight: 1.5 }}>
              Enable it below to let the host log and split expenses with attendees after the event ends.
            </div>
          </div>
          <button onClick={dismissBillHint} style={{
            background: 'none', border: 'none', color: 'var(--t4)',
            fontSize: '18px', lineHeight: 1, cursor: 'pointer', flexShrink: 0, padding: '0 2px',
          }}>×</button>
        </div>
      )}

      {/* Bill Split toggle */}
      <div style={{ ...sectionStyle, display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }} onClick={() => setBillSplitEnabled(v => !v)}>
        <div style={toggleStyle(billSplitEnabled)}>
          <div style={{ position: 'absolute', top: '2px', left: billSplitEnabled ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '9px', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: billSplitEnabled ? 'var(--green)' : 'var(--t2)' }}>💸 Enable Bill Splitting</div>
          <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '2px' }}>Let the host split and track costs with attendees after the event</div>
        </div>
      </div>

      {/* Ratings toggle */}
      <div style={{ ...sectionStyle, display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }} onClick={() => setRatingsEnabled(v => !v)}>
        <div style={toggleStyle(ratingsEnabled)}>
          <div style={{ position: 'absolute', top: '2px', left: ratingsEnabled ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '9px', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: ratingsEnabled ? 'var(--rose-soft)' : 'var(--t2)' }}>⭐ Enable Ratings</div>
          <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '2px' }}>Allow members to rate and review this event after it ends</div>
        </div>
      </div>

      {/* Section 4: Description */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Description / About (optional)</div>
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
        {onPollGroup && (
          <Button
            variant="ghost"
            onClick={() => {
              onClose()
              onPollGroup({ title: title || initialTitle, activityType: resolvedActivity })
            }}
          >
            💬 Poll Group First
          </Button>
        )}
        <Button variant="primary" loading={loading} onClick={handleSubmit}>
          Confirm Pick →
        </Button>
      </div>
    </Modal>
  )
}
