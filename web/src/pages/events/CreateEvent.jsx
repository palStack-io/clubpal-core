import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { groupsApi } from '../../api/groups'
import { eventsApi } from '../../api/events'
import { activitiesApi } from '../../api/activities'
import AppShell from '../../components/shell/AppShell'
import Topbar from '../../components/shell/Topbar'
import Button from '../../components/ui/Button'
import BannerUpload from '../../components/ui/BannerUpload'
import { FormSection, FormRow, FormGroup, FormInput, FormSelect } from '../../components/ui/Form'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'
import BringListBuilder from '../../components/events/BringListBuilder'

// Maps group activity_type → activity category for filtering
const ACTIVITY_TYPE_TO_CATEGORY = {
  dining:  'Food & Drink',
  movies:  'Entertainment',
  gaming:  'Entertainment',
  hiking:  'Outdoors',
  arts:    'Cultural',
  books:   'Cultural',
}

const RECURRENCE_RULES = [
  { value: 'weekly',   label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
  { value: 'monthly',  label: 'Monthly' },
]

const DAYS_OF_WEEK = [
  { value: '0', label: 'Monday' },
  { value: '1', label: 'Tuesday' },
  { value: '2', label: 'Wednesday' },
  { value: '3', label: 'Thursday' },
  { value: '4', label: 'Friday' },
  { value: '5', label: 'Saturday' },
  { value: '6', label: 'Sunday' },
]

async function uploadCover(eventId, file) {
  const data = await eventsApi.uploadCover(eventId, file)
  return data.cover_url
}

export default function CreateEvent() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const preselectedGroupId = searchParams.get('groupId')
  const preselectedActivityId = searchParams.get('activityId')

  const [groups, setGroups] = useState([])
  const [activities, setActivities] = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  const [form, setForm] = useState({
    group_id: preselectedGroupId || '',
    activity_id: preselectedActivityId || '',
    title: '',
    scheduled_date: '',
    location: '',
    description: '',
  })

  // Recurring options
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrence, setRecurrence] = useState({
    rule: 'weekly',
    day_of_week: '4',   // Friday default
    time_of_day: '18:00',
    end_date: '',
  })

  // Bill split opt-in
  const [billSplitEnabled, setBillSplitEnabled] = useState(false)
  const [eventBringEnabled, setEventBringEnabled] = useState(false)
  const [eventBringItems, setEventBringItems] = useState([])

  // Banner/cover
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Derive filtered activities based on selected group's activity_type
  const selectedGroup = groups.find(g => String(g.id) === String(form.group_id))
  const groupActivityType = selectedGroup?.activity_type
  const groupCategory = groupActivityType ? ACTIVITY_TYPE_TO_CATEGORY[groupActivityType] : null
  const filteredActivities = groupCategory
    ? activities.filter(a => a.category === groupCategory)
    : activities

  useEffect(() => {
    Promise.all([
      groupsApi.getUserGroups(user.id),
      activitiesApi.getAll(),
    ]).then(([g, a]) => {
      setGroups(g || [])
      setActivities(a || [])
    }).catch(() => toast.error('Failed to load form data.')).finally(() => setDataLoading(false))
  }, [user.id])

  const set = (key) => (e) => {
    const value = e.target.value
    if (key === 'group_id') {
      setForm(f => ({ ...f, group_id: value, activity_id: '' }))
    } else {
      setForm(f => ({ ...f, [key]: value }))
    }
  }
  const setRec = (key) => (e) => setRecurrence(r => ({ ...r, [key]: e.target.value }))

  const handleCoverChange = (file) => {
    setCoverFile(file)
    setCoverPreview(file ? URL.createObjectURL(file) : null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.group_id) { setError('Please select a club.'); return }
    if (!form.title.trim()) { setError('Please enter a title.'); return }
    if (isRecurring && !recurrence.end_date) { setError('Please set an end date for the recurring series.'); return }
    setError('')
    setLoading(true)
    try {
      const payload = {
        group_id: parseInt(form.group_id),
        activity_id: form.activity_id ? parseInt(form.activity_id) : null,
        title: form.title.trim(),
        scheduled_date: form.scheduled_date || null,
        location: form.location.trim() || null,
        description: form.description.trim() || null,
        created_by: user.id,
        bill_split_enabled: billSplitEnabled,
        bring_list_enabled: eventBringEnabled,
        bring_list_type: 'freeform',
        bring_items: eventBringItems,
        // Recurring fields
        is_recurring: isRecurring,
        recurrence_rule: isRecurring ? recurrence.rule : null,
        recurrence_day_of_week: isRecurring && recurrence.rule !== 'monthly' ? parseInt(recurrence.day_of_week) : null,
        recurrence_time: isRecurring ? recurrence.time_of_day : null,
        recurrence_end_date: isRecurring ? recurrence.end_date : null,
      }

      const event = await eventsApi.create(payload)

      // Upload cover photo if provided
      if (coverFile) {
        await uploadCover(event.id, coverFile).catch(() => toast.error('Event created, but cover photo failed to upload.'))
      }

      window.location.href = `/events/${event.id}`
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create event.')
    } finally {
      setLoading(false)
    }
  }

  if (dataLoading) return <AppShell activeRoute="/events"><PageLoader /></AppShell>

  return (
    <AppShell activeRoute="/events">
      <Topbar title="Create Event" onBack={() => navigate(-1)}>
        <Button variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} loading={loading}>Create Event</Button>
      </Topbar>

      <div style={{ padding: '20px 24px', maxWidth: '720px' }}>
        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#f87171', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        {/* Cover photo */}
        <FormSection title="Cover Photo">
          <BannerUpload
            value={coverPreview}
            onChange={handleCoverChange}
            label="Event Cover Photo"
            aspectRatio="16/6"
          />
        </FormSection>

        {/* Core details */}
        <FormSection title="Event Details">
          <FormRow>
            <FormGroup label="Club" required>
              <FormSelect value={form.group_id} onChange={set('group_id')}>
                <option value="">Select a club…</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </FormSelect>
            </FormGroup>
            <FormGroup label={groupCategory ? `Activity (${groupCategory})` : 'Activity'}>
              <FormSelect value={form.activity_id} onChange={set('activity_id')}>
                <option value="">Select an activity…</option>
                {filteredActivities.map(a => <option key={a.id} value={a.id}>{a.icon ? `${a.icon} ${a.name}` : a.name}</option>)}
              </FormSelect>
            </FormGroup>
          </FormRow>

          <FormGroup label="Event Title" required style={{ marginTop: '12px' }}>
            <FormInput
              placeholder="Movie Night at Alice's"
              value={form.title}
              onChange={set('title')}
            />
          </FormGroup>

          <FormRow style={{ marginTop: '12px' }}>
            <FormGroup label="Date & Time">
              <FormInput
                type="datetime-local"
                value={form.scheduled_date}
                onChange={set('scheduled_date')}
              />
            </FormGroup>
            <FormGroup label="Location">
              <FormInput
                placeholder="123 Main St, or Alice's place"
                value={form.location}
                onChange={set('location')}
              />
            </FormGroup>
          </FormRow>

          <FormGroup label="Description" style={{ marginTop: '12px' }}>
            <textarea
              rows={3}
              value={form.description}
              onChange={set('description')}
              placeholder="Optional details about the event…"
              style={{ width: '100%', resize: 'none', background: 'var(--s3)', border: '1px solid var(--glass)', borderRadius: '10px', padding: '10px 12px', fontSize: '14px', color: 'var(--t1)', outline: 'none', fontFamily: 'inherit' }}
            />
          </FormGroup>
        </FormSection>

        <FormSection title="Bring List">
          <BringListBuilder
            enabled={eventBringEnabled}
            onToggle={() => setEventBringEnabled(v => !v)}
            items={eventBringItems}
            onItemsChange={setEventBringItems}
          />
        </FormSection>

        {/* Bill Split */}
        <FormSection title="Bill Splitting">
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <div
              onClick={() => setBillSplitEnabled(v => !v)}
              style={{
                width: '44px', height: '24px', borderRadius: '12px',
                background: billSplitEnabled ? 'var(--rose)' : 'var(--glass)',
                position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: '2px',
                left: billSplitEnabled ? '22px' : '2px',
                width: '20px', height: '20px', borderRadius: '10px',
                background: '#fff', transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--t1)' }}>
                Enable bill splitting
              </div>
              <div style={{ fontSize: '12px', color: 'var(--t3)' }}>
                Lets the host split and track costs with attendees after the event
              </div>
            </div>
          </label>
        </FormSection>

        {/* Recurring */}
        <FormSection title="Recurring Schedule">
          {/* Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: isRecurring ? '16px' : 0 }}>
            <div
              onClick={() => setIsRecurring(v => !v)}
              style={{
                width: '44px', height: '24px', borderRadius: '12px',
                background: isRecurring ? 'var(--rose)' : 'var(--glass)',
                position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: '2px',
                left: isRecurring ? '22px' : '2px',
                width: '20px', height: '20px', borderRadius: '10px',
                background: '#fff', transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--t1)' }}>
                Repeat this event
              </div>
              <div style={{ fontSize: '12px', color: 'var(--t3)' }}>
                Automatically creates the next occurrence and notifies members
              </div>
            </div>
          </label>

          {isRecurring && (
            <div style={{ padding: '16px', background: 'var(--rose-glow)', border: '1px solid var(--rose-border)', borderRadius: '12px' }}>
              <FormRow>
                <FormGroup label="Repeats">
                  <FormSelect value={recurrence.rule} onChange={setRec('rule')}>
                    {RECURRENCE_RULES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </FormSelect>
                </FormGroup>
                {recurrence.rule !== 'monthly' && (
                  <FormGroup label="Day of Week">
                    <FormSelect value={recurrence.day_of_week} onChange={setRec('day_of_week')}>
                      {DAYS_OF_WEEK.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </FormSelect>
                  </FormGroup>
                )}
              </FormRow>

              <FormRow style={{ marginTop: '12px' }}>
                <FormGroup label="Time">
                  <FormInput
                    type="time"
                    value={recurrence.time_of_day}
                    onChange={setRec('time_of_day')}
                  />
                </FormGroup>
                <FormGroup label="End Date" required>
                  <FormInput
                    type="date"
                    value={recurrence.end_date}
                    onChange={setRec('end_date')}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </FormGroup>
              </FormRow>

              <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--s2)', borderRadius: '8px', fontSize: '12px', color: 'var(--t2)' }}>
                📅 &nbsp;The next occurrence will be automatically created after each event completes, and all group members will receive an email notification.
              </div>
            </div>
          )}
        </FormSection>
      </div>
    </AppShell>
  )
}
