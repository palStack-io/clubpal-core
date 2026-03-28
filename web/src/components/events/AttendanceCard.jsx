import { useState } from 'react'
import Card from '../ui/Card'
import Avatar from '../ui/Avatar'
import StatusChip from '../ui/StatusChip'
import UserStatsModal from '../ui/UserStatsModal'

function toUTC(str) {
  if (!str) return str
  return /Z$|[+-]\d{2}:?\d{2}$/.test(str) ? str : `${str}Z`
}

const rsvpStatusMap = {
  going: 'going',
  maybe: 'maybe',
  not_going: 'not-going',
}

const rsvpActive = {
  background: 'rgba(244,63,94,0.15)',
  color: 'var(--rose-soft)',
  border: '1px solid var(--rose-border)',
}
const rsvpInactive = {
  background: 'var(--s3)',
  color: 'var(--t3)',
  border: '1px solid var(--glass)',
}

const pillBase = {
  padding: '4px 12px',
  fontSize: '11px',
  fontWeight: 600,
  borderRadius: '100px',
  cursor: 'pointer',
  transition: 'all 0.15s',
}

export default function AttendanceCard({
  attendees = [],
  currentUser,
  eventId,
  eventStatus,
  onRsvpChange,
  rsvpDeadline,
  maxAttendees,
}) {
  const [selectedAttendee, setSelectedAttendee] = useState(null)
  const going = attendees.filter((a) => a.status === 'going').length
  const maybe = attendees.filter((a) => a.status === 'maybe').length
  const notGoing = attendees.filter((a) => a.status === 'not_going').length
  const total = attendees.length
  const spotsLeft = maxAttendees ? Math.max(0, maxAttendees - going) : null

  const myRsvp = currentUser
    ? attendees.find((a) => String(a.user_id) === String(currentUser.id))
    : null
  const myStatus = myRsvp?.status || null

  const RsvpPills = () => (
    <div style={{ display: 'flex', gap: '6px' }}>
      {[
        { label: '✓ Going',         value: 'going' },
        { label: '? Maybe',          value: 'maybe' },
        { label: "✕ Can't Make It",  value: 'not_going' },
      ].map(({ label, value }) => (
        <button
          key={value}
          onClick={() => onRsvpChange && onRsvpChange(value)}
          style={{
            ...pillBase,
            ...(myStatus === value ? rsvpActive : rsvpInactive),
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )

  const deadlineLabel = (() => {
    if (!rsvpDeadline || eventStatus !== 'scheduled') return null
    const d = new Date(toUTC(rsvpDeadline))
    const now = new Date()
    if (d <= now) return null
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `RSVP by ${months[d.getMonth()]} ${d.getDate()}`
  })()

  return (
    <>
    <Card>
      <Card.Header
        title={maxAttendees ? `Attendance (${going}/${maxAttendees} seats)` : `Attendance (${going}/${total})`}
        action={eventStatus === 'scheduled' ? <RsvpPills /> : null}
      />
      <Card.Body>
        {/* RSVP deadline chip */}
        {deadlineLabel && (
          <div style={{ marginBottom: '10px' }}>
            <StatusChip status="date-warning" label={deadlineLabel} />
          </div>
        )}

        {/* Summary counts */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--glass)',
            marginBottom: '10px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#22d3a0' }}>
            Going: {going}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b' }}>
            Maybe: {maybe}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t3)' }}>
            No: {notGoing}
          </span>
          {spotsLeft !== null && (
            <span style={{ fontSize: '12px', fontWeight: 600, color: spotsLeft === 0 ? '#f87171' : 'var(--blue)' }}>
              {spotsLeft === 0 ? '🔴 Full' : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
            </span>
          )}
        </div>

        {attendees.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '20px',
              color: 'var(--t3)',
              fontSize: '13px',
            }}
          >
            No RSVPs yet
          </div>
        ) : (
          <div>
            {attendees.map((a) => (
              <div
                key={a.user_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  padding: '8px 10px',
                  background: 'var(--s3)',
                  borderRadius: '10px',
                  border: '1px solid var(--glass)',
                  marginBottom: '6px',
                }}
              >
                <button
                  onClick={() => setSelectedAttendee(a)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
                >
                  <Avatar
                    user={{ full_name: a.full_name || a.username, avatar_url: a.avatar_url }}
                    size="sm"
                  />
                </button>
                <span
                  style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--t2)', cursor: 'pointer' }}
                  onClick={() => setSelectedAttendee(a)}
                >
                  {a.full_name || a.username || 'Member'}
                </span>
                <StatusChip
                  status={rsvpStatusMap[a.status] || 'maybe'}
                  label={a.status === 'not_going' ? "Can't Make It" : a.status || 'invited'}
                />
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>

    {selectedAttendee && (
      <UserStatsModal
        member={selectedAttendee}
        onClose={() => setSelectedAttendee(null)}
      />
    )}
  </>
  )
}
