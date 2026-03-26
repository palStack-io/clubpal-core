import { useState } from 'react'
import { format } from 'date-fns'
import Card from '../ui/Card'
import Button from '../ui/Button'
import StatusChip from '../ui/StatusChip'
import { resolveMediaUrl } from '../../utils/resolveMediaUrl'

const ACTIVITY = {
  dining: { emoji: '🍽️', color: '#f43f5e', rgb: '244,63,94',  gradient: 'linear-gradient(135deg, rgba(244,63,94,0.10), rgba(244,63,94,0.04))' },
  movies: { emoji: '🎬', color: '#6366f1', rgb: '99,102,241', gradient: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(99,102,241,0.04))' },
  books:  { emoji: '📚', color: '#a855f7', rgb: '168,85,247', gradient: 'linear-gradient(135deg, rgba(168,85,247,0.10), rgba(168,85,247,0.04))' },
  hiking: { emoji: '🥾', color: '#14b8a6', rgb: '20,184,166', gradient: 'linear-gradient(135deg, rgba(20,184,166,0.10), rgba(20,184,166,0.04))' },
  gaming: { emoji: '🎮', color: '#22d3a0', rgb: '34,211,160', gradient: 'linear-gradient(135deg, rgba(34,211,160,0.10), rgba(34,211,160,0.04))' },
  arts:   { emoji: '🎨', color: '#f59e0b', rgb: '245,158,11',  gradient: 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(245,158,11,0.04))' },
}

function getActivityMeta(activityType) {
  const key = (activityType || 'dining').toLowerCase()
  return ACTIVITY[key] || ACTIVITY.dining
}

function getStatusChipVariant(status) {
  if (status === 'completed') return 'going'
  if (status === 'cancelled') return 'not-going'
  return 'pending'
}

function EventRow({ event, onClick, onSplitBill }) {
  const [hovered, setHovered] = useState(false)
  const act = getActivityMeta(event.activity_type)
  const dateStr = event.scheduled_date || event.event_date

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '12px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: hovered ? 'var(--glass-hover)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {/* Activity icon / cover thumbnail */}
      {event.cover_url ? (
        <img
          src={resolveMediaUrl(event.cover_url)}
          alt=""
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: act.gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            flexShrink: 0,
          }}
        >
          {act.emoji}
        </div>
      )}

      {/* Meta block — clickable to go to event */}
      <div
        onClick={onClick}
        style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
      >
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--t1)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {event.title || event.venue_name || 'Untitled Event'}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '2px' }}>
          {dateStr ? format(new Date(dateStr), 'MMM d, yyyy') : 'TBD'}
        </div>
      </div>

      {/* Status chip */}
      <StatusChip
        status={getStatusChipVariant(event.status)}
        label={event.status || 'pending'}
      />

      {/* Split Bill button */}
      {event.status !== 'cancelled' && (
        <button
          onClick={e => { e.stopPropagation(); onSplitBill(event.id) }}
          title="Split Bill"
          style={{
            flexShrink: 0,
            background: hovered ? 'rgba(244,63,94,0.12)' : 'var(--s3)',
            border: '1px solid ' + (hovered ? 'var(--rose-border)' : 'transparent'),
            borderRadius: '8px',
            padding: '4px 8px',
            fontSize: '13px',
            cursor: 'pointer',
            color: 'var(--t2)',
            transition: 'all 0.15s',
          }}
        >
          💸
        </button>
      )}

      {/* Chevron */}
      <div
        onClick={onClick}
        style={{
          fontSize: '12px',
          color: hovered ? 'var(--rose-soft)' : 'var(--t3)',
          transition: 'color 0.15s',
          flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        →
      </div>
    </div>
  )
}

function TabPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: '100px',
        fontSize: '11px',
        fontWeight: 600,
        cursor: 'pointer',
        border: active ? '1px solid var(--rose-border)' : '1px solid transparent',
        background: active ? 'var(--rose-glow)' : 'var(--s3)',
        color: active ? 'var(--rose-soft)' : 'var(--t3)',
        transition: 'all 0.15s',
        outline: 'none',
      }}
    >
      {label}
    </button>
  )
}

export default function GroupEventsCard({ upcoming = [], past = [], groupId, isMyTurn, onNewEvent }) {
  const [activeTab, setActiveTab] = useState('upcoming')

  const events = activeTab === 'upcoming' ? upcoming : past

  const headerAction = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '4px' }}>
        <TabPill
          label="Upcoming"
          active={activeTab === 'upcoming'}
          onClick={() => setActiveTab('upcoming')}
        />
        <TabPill
          label="Past"
          active={activeTab === 'past'}
          onClick={() => setActiveTab('past')}
        />
      </div>
      {isMyTurn && (
        <Button
          variant="primary"
          size="sm"
          onClick={() => onNewEvent ? onNewEvent() : (window.location.href = `/events/new?groupId=${groupId}`)}
        >
          + New Event
        </Button>
      )}
    </div>
  )

  return (
    <Card>
      <Card.Header title="Events" action={headerAction} />
      <Card.Body>
        {events.length === 0 ? (
          activeTab === 'upcoming' ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--t3)' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>📅</div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--t2)', marginBottom: '14px' }}>
                No upcoming events
              </div>
              {isMyTurn && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onNewEvent ? onNewEvent() : (window.location.href = `/events/new?groupId=${groupId}`)}
                >
                  + Create Event
                </Button>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--t3)' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>📖</div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--t2)' }}>
                No event history yet
              </div>
            </div>
          )
        ) : (
          <div>
            {events.map((event, i) => (
              <div
                key={event.id}
                style={{ ...(i === events.length - 1 ? { borderBottom: 'none' } : {}) }}
              >
                <EventRow
                  event={event}
                  onClick={() => window.location.href = `/events/${event.id}`}
                  onSplitBill={id => window.location.href = `/events/${id}#bill-split`}
                />
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
