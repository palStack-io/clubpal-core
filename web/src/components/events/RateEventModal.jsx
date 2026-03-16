import { useState } from 'react'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import { ratingsClient } from '../../api/client'

function ScoreInput({ value, onChange }) {
  const LABELS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Great', 5: 'Amazing' }
  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '8px' }}>
        {[1, 2, 3, 4, 5].map(n => {
          const selected = value === n
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                border: `1px solid ${selected ? 'transparent' : 'var(--glass)'}`,
                background: selected
                  ? 'linear-gradient(135deg, var(--rose-soft), var(--rose))'
                  : 'var(--s3)',
                color: selected ? '#fff' : 'var(--t2)',
                fontSize: '18px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: selected ? '0 2px 12px rgba(244,63,94,0.35)' : 'none',
                transition: 'all 0.12s',
              }}
            >
              {n}
            </button>
          )
        })}
      </div>
      {value > 0 && (
        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--rose-soft)', fontWeight: 600 }}>
          {LABELS[value]}
        </div>
      )}
    </div>
  )
}

export default function RateEventModal({ isOpen, onClose, event, attendees, currentUser, onSubmitted }) {
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const [ratedUserId, setRatedUserId] = useState(event?.host_user_id || null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const others = (attendees || []).filter(a => a.user_id !== currentUser?.id)

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
