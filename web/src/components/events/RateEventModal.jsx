import { useState } from 'react'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import { ratingsClient } from '../../api/client'

const TAGS = [
  'Hidden Gem', 'Would Return', 'Special Occasion', 'Date Night',
  'Family', 'Casual', 'Pricey', 'Great Vibes', 'Loud', 'Cozy',
]

function ScoreInput({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '24px',
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

function TagPicker({ selected, onChange }) {
  const toggle = tag => onChange(
    selected.includes(tag) ? selected.filter(t => t !== tag) : [...selected, tag]
  )
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {TAGS.map(tag => {
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

export default function RateEventModal({ isOpen, onClose, event, attendees, currentUser, onSubmitted }) {
  const others = (attendees || []).filter(a => String(a.user_id) !== String(currentUser?.id))
  const defaultRatedUserId = others[0]?.user_id ?? null

  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const [tags, setTags] = useState([])
  const [ratedUserId, setRatedUserId] = useState(defaultRatedUserId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!score) { setError('Please select a score.'); return }
    if (!ratedUserId) { setError('Please select who to rate.'); return }
    setError('')
    setSubmitting(true)
    try {
      await ratingsClient.post(`/ratings`, {
        event_id: parseInt(event.id),
        rated_user_id: ratedUserId,
        score,
        comment: comment.trim() || null,
        tags,
      }, { params: { user_id: currentUser.id } })
      onSubmitted?.()
      onClose()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to submit rating.')
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
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '520px',
          background: 'var(--s2)',
          border: '1px solid var(--glass)',
          borderRadius: '20px 20px 0 0',
          padding: '24px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Handle */}
        <div style={{ width: '36px', height: '4px', background: 'var(--glass)', borderRadius: '2px', margin: '0 auto 20px' }} />

        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)', marginBottom: '4px' }}>
          Rate Event
        </div>
        <div style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '20px' }}>
          {event?.title || event?.venue_name || 'Event'}
        </div>

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#f87171', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Who to rate */}
        {others.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
              Who are you rating?
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {others.map(a => {
                const selected = ratedUserId === a.user_id
                return (
                  <button
                    key={a.user_id}
                    type="button"
                    onClick={() => setRatedUserId(a.user_id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', borderRadius: '10px',
                      border: `1px solid ${selected ? 'var(--rose-border)' : 'var(--glass)'}`,
                      background: selected ? 'var(--rose-glow)' : 'var(--s3)',
                      cursor: 'pointer', transition: 'all 0.12s',
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
          </div>
        )}

        {/* Score */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
            Your Score
          </div>
          <ScoreInput value={score} onChange={setScore} />
        </div>

        {/* Tags */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
            Tags (optional)
          </div>
          <TagPicker selected={tags} onChange={setTags} />
        </div>

        {/* Comment */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
            Comment (optional)
          </div>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Share your thoughts..."
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

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!score || !ratedUserId}
            style={{ flex: 2 }}
          >
            Submit Rating
          </Button>
        </div>
      </div>
    </div>
  )
}
