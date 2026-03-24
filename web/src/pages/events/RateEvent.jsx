import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppShell from '../../components/shell/AppShell'
import Topbar from '../../components/shell/Topbar'
import Button from '../../components/ui/Button'
import Avatar from '../../components/ui/Avatar'
import { FormSection, FormGroup, FormTextarea } from '../../components/ui/Form'
import { eventsApi } from '../../api/events'
import { ratingsClient } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

const PRESET_TAGS = ['Hidden Gem', 'Would Return', 'Special Occasion', 'Date Night', 'Family', 'Casual', 'Pricey', 'Great Vibes', 'Loud', 'Cozy']

const ACTIVITY_COPY = {
  dining:  { heading: 'Rate the Restaurant', placeholder: 'Share your thoughts on the food, service, atmosphere…' },
  movies:  { heading: 'Rate the Movie',      placeholder: 'What did you think of the film?' },
  books:   { heading: 'Rate the Book',       placeholder: 'Share your thoughts on the read…' },
  hiking:  { heading: 'Rate the Hike',       placeholder: 'How was the trail? Difficulty, views, conditions…' },
  gaming:  { heading: 'Rate the Game',       placeholder: 'How was the session? Fun, challenge, vibes…' },
  arts:    { heading: 'Rate the Show',       placeholder: 'Share your thoughts on the performance…' },
}
function getRatingCopy(activityType) {
  return ACTIVITY_COPY[activityType?.toLowerCase()] ?? { heading: 'Rate the Event', placeholder: 'Share your thoughts about this event…' }
}

function ScoreInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
        const selected = value === n
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              border: `1px solid ${selected ? 'transparent' : 'var(--glass)'}`,
              background: selected
                ? 'linear-gradient(135deg, var(--rose-soft), var(--rose))'
                : 'var(--s3)',
              color: selected ? '#fff' : 'var(--t2)',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: selected ? '0 2px 8px rgba(244,63,94,0.3)' : 'none',
              transition: 'all 0.12s',
            }}
          >
            {n}
          </button>
        )
      })}
    </div>
  )
}

function TagPicker({ selected, onChange }) {
  const toggle = (tag) => {
    onChange(selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag])
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {PRESET_TAGS.map(tag => {
        const active = selected.includes(tag)
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            style={{
              padding: '5px 12px',
              borderRadius: '100px',
              border: `1px solid ${active ? 'var(--rose-border)' : 'var(--glass)'}`,
              background: active ? 'var(--rose-glow)' : 'var(--s3)',
              color: active ? 'var(--rose-soft)' : 'var(--t3)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.12s',
            }}
          >
            {tag}
          </button>
        )
      })}
    </div>
  )
}

export default function RateEvent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [event, setEvent] = useState(null)
  const [attendees, setAttendees] = useState([])
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState(0)
  const [review, setReview] = useState('')
  const [tags, setTags] = useState([])
  const [ratedUserId, setRatedUserId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      eventsApi.getById(id),
      eventsApi.getAttendees(id),
    ]).then(([ev, att]) => {
      setEvent(ev)
      const allAttendees = Array.isArray(att) ? att : att?.attendees || []
      setAttendees(allAttendees)
      // Default to host
      if (ev.host_user_id) setRatedUserId(ev.host_user_id)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async () => {
    if (!score) { setError('Please select a score.'); return }
    setError('')
    setSubmitting(true)
    try {
      await ratingsClient.post(`/events/${id}/ratings`, {
        rater_user_id: user.id,
        rated_user_id: ratedUserId,
        score,
        review_text: review.trim() || null,
        tags,
      })
      navigate(`/events/${id}`)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to submit rating.')
    } finally {
      setSubmitting(false)
    }
  }

  const copy = getRatingCopy(event?.activity_type)

  return (
    <AppShell activeRoute="/events">
      <Topbar title={copy.heading} onBack={() => navigate(-1)} />

      <div style={{ padding: '24px', maxWidth: '640px' }}>
        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#f87171', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        {/* Who to rate */}
        {attendees.length > 0 && (
          <FormSection title="Select Who to Rate">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {attendees.filter(a => a.user_id !== user?.id).map(a => {
                const selected = ratedUserId === a.user_id
                return (
                  <button
                    key={a.user_id}
                    type="button"
                    onClick={() => setRatedUserId(a.user_id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: `1px solid ${selected ? 'var(--rose-border)' : 'var(--glass)'}`,
                      background: selected ? 'var(--rose-glow)' : 'var(--s3)',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    <Avatar user={{ full_name: a.full_name, avatar_url: a.avatar_url }} size="sm" />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: selected ? 'var(--rose-soft)' : 'var(--t2)' }}>
                      {a.full_name || a.username}
                    </span>
                  </button>
                )
              })}
            </div>
          </FormSection>
        )}

        <FormSection title="Your Rating">
          <ScoreInput value={score} onChange={setScore} />
        </FormSection>

        <FormSection title="Review (optional)">
          <FormTextarea
            value={review}
            onChange={e => setReview(e.target.value)}
            placeholder={copy.placeholder}
            style={{ minHeight: '100px' }}
          />
        </FormSection>

        <FormSection title="Tags (optional)">
          <TagPicker selected={tags} onChange={setTags} />
        </FormSection>

        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={submitting}
          disabled={!score}
          style={{ width: '100%' }}
          size="lg"
        >
          Submit Rating
        </Button>
      </div>
    </AppShell>
  )
}
