import { useState, useEffect } from 'react'
import Button from '../ui/Button'
import { ratingsClient } from '../../api/client'

const ACTIVITY_TAGS = {
  dining:  ['Hidden Gem', 'Would Return', 'Special Occasion', 'Date Night', 'Family Friendly', 'Casual', 'Pricey', 'Great Vibes', 'Loud', 'Cozy'],
  movies:  ['Mind-Blowing', 'Tear-Jerker', 'Edge of Your Seat', 'Instant Classic', 'Overhyped', 'Great Soundtrack', 'Must Rewatch', 'Date Night', 'Family Friendly', 'Too Long'],
  books:   ['Page-Turner', 'Mind-Expanding', 'Beautifully Written', 'Slow Burn', 'Thought-Provoking', "Couldn't Put Down", 'Great for Book Club', 'Overrated', 'Life-Changing', 'Quick Read'],
  hiking:  ['Breathtaking Views', 'Dog Friendly', 'Family Friendly', 'Challenging', 'Well-Marked', 'Hidden Gem', 'Crowded', 'Scenic', 'Good Workout', 'Great Picnic Spot'],
  gaming:  ['Addictive', 'Great Multiplayer', 'Stunning Graphics', 'Deep Story', 'Easy to Learn', 'Replay Value', 'Too Short', 'Frustrating', 'Couch Co-op', 'Hidden Gem'],
  arts:    ['Moving', 'Thought-Provoking', 'World Class', 'Intimate', 'Standing Ovation', 'Overpriced', 'Stunning Visuals', 'Great Atmosphere', 'Date Night', 'Hidden Gem'],
}
const DEFAULT_TAGS = ['Great Experience', 'Would Return', 'Special Occasion', 'Date Night', 'Family Friendly', 'Casual', 'Hidden Gem', 'Great Vibes', 'Overrated', 'Budget-Friendly']

function getTagsForActivity(activityType) {
  return ACTIVITY_TAGS[activityType?.toLowerCase()] ?? DEFAULT_TAGS
}

const ACTIVITY_COPY = {
  dining:  { heading: 'Rate the Restaurant', placeholder: 'Food, service, atmosphere…' },
  movies:  { heading: 'Rate the Movie',      placeholder: 'What did you think of the film?' },
  books:   { heading: 'Rate the Book',       placeholder: 'Share your thoughts on the read…' },
  hiking:  { heading: 'Rate the Hike',       placeholder: 'Trail, views, difficulty…' },
  gaming:  { heading: 'Rate the Game',       placeholder: 'Fun, challenge, vibes…' },
  arts:    { heading: 'Rate the Show',       placeholder: 'Share your thoughts on the performance…' },
}
function getRatingCopy(activityType) {
  return ACTIVITY_COPY[activityType?.toLowerCase()] ?? { heading: 'Rate the Event', placeholder: 'Share your thoughts…' }
}

function ScoreInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '36px',
            color: n <= value ? 'var(--rose)' : 'var(--t4)',
            padding: '2px',
            transition: 'color 0.1s, transform 0.1s',
            lineHeight: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.2)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function TagPicker({ selected, onChange, tagList }) {
  const toggle = tag => onChange(
    selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag]
  )
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {tagList.map(tag => {
        const active = selected.includes(tag)
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            style={{
              padding: '5px 11px',
              borderRadius: '20px',
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

const SCORE_LABELS = {
  1: 'Poor', 2: 'Below Average', 3: 'Average', 4: 'Good', 5: 'Excellent',
}

export default function RateEventModal({ isOpen, onClose, event, currentUser, onSubmitted, existingRating }) {
  const isEditing = !!existingRating

  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const [tags, setTags] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Pre-populate state when opening in edit mode
  useEffect(() => {
    if (isOpen) {
      setScore(existingRating?.score ?? 0)
      setComment(existingRating?.comment ?? '')
      setTags(existingRating?.tags ?? [])
      setError('')
    }
  }, [isOpen, existingRating?.id])

  if (!isOpen) return null

  const copy = getRatingCopy(event?.activity_type)
  const tagList = getTagsForActivity(event?.activity_type)

  const handleSubmit = async () => {
    if (!score) { setError('Please select a score.'); return }
    setError('')
    setSubmitting(true)
    try {
      if (isEditing) {
        await ratingsClient.patch(`/ratings/${existingRating.id}`, {
          score,
          comment: comment.trim() || null,
          tags,
        }, { params: { user_id: currentUser.id } })
      } else {
        await ratingsClient.post('/ratings', {
          event_id: parseInt(event.id),
          score,
          comment: comment.trim() || null,
          tags,
        }, { params: { user_id: currentUser.id } })
      }
      onSubmitted?.()
      onClose()
    } catch (e) {
      const detail = e.response?.data?.detail
      setError(
        typeof detail === 'string' ? detail
        : Array.isArray(detail) ? detail.map(d => d?.msg ?? String(d)).join(', ')
        : 'We couldn\'t submit your rating. Give it another go.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '480px',
          background: 'var(--s2)',
          border: '1px solid var(--glass)',
          borderRadius: '20px',
          padding: '28px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)', marginBottom: '4px' }}>
          {isEditing ? `Update: ${copy.heading}` : copy.heading}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '20px' }}>
          {event?.title || event?.venue_name || 'Event'}
        </div>

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#f87171', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Score */}
        <div style={{ marginBottom: '22px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
            Your Score
          </div>
          <ScoreInput value={score} onChange={setScore} />
          {score > 0 && (
            <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--rose)', marginTop: '10px' }}>
              {score}/5 — {SCORE_LABELS[score]}
            </div>
          )}
        </div>

        {/* Tags */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
            Tags (optional)
          </div>
          <TagPicker selected={tags} onChange={setTags} tagList={tagList} />
        </div>

        {/* Comment */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
            Comment (optional)
          </div>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={copy.placeholder}
            maxLength={500}
            style={{
              width: '100%', minHeight: '80px', resize: 'vertical',
              background: 'var(--s3)', border: '1px solid var(--glass)',
              borderRadius: '10px', padding: '10px 12px',
              fontSize: '13px', color: 'var(--t1)',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ fontSize: '11px', color: 'var(--t3)', textAlign: 'center', marginBottom: '14px' }}>
          Rating is optional — you can always come back and rate later
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>
            Skip
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!score}
            style={{ flex: 2 }}
          >
            {isEditing ? 'Update Rating' : 'Submit Rating'}
          </Button>
        </div>
      </div>
    </div>
  )
}
