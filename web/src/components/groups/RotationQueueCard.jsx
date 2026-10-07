import { useState } from 'react'
import Card from '../ui/Card'
import Avatar from '../ui/Avatar'
import { groupsApi } from '../../api/groups'

const MAX_VISIBLE = 8

function QueueItem({ member, position, isYou, isCurrent, isAdmin, onSkip, onSet, actionLoading }) {
  const loading = actionLoading === member.user_id

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 12px',
        borderRadius: '10px',
        marginBottom: '6px',
        background: isCurrent
          ? 'rgba(244,63,94,0.10)'
          : isYou
          ? 'rgba(244,63,94,0.05)'
          : 'var(--s3)',
        border: isCurrent
          ? '1px solid rgba(244,63,94,0.28)'
          : isYou
          ? '1px solid rgba(244,63,94,0.12)'
          : '1px solid var(--glass)',
      }}
    >
      {/* Position circle */}
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: isCurrent ? 'var(--rose)' : 'var(--s4)',
          color: isCurrent ? '#fff' : 'var(--t4)',
          fontSize: '10px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: isCurrent ? '0 0 8px rgba(244,63,94,0.4)' : 'none',
        }}
      >
        {position}
      </div>

      <Avatar
        user={{ full_name: member.full_name, username: member.username, avatar_url: member.avatar_url }}
        size="sm"
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: isCurrent ? 'var(--t1)' : isYou ? 'var(--t1)' : 'var(--t2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {isYou ? 'You' : (member.full_name || member.username)}
        </div>
        {member.picks_count != null && (
          <div style={{ fontSize: '9px', color: 'var(--t4)', marginTop: '1px' }}>
            Picked {member.picks_count} {member.picks_count === 1 ? 'time' : 'times'}
          </div>
        )}
      </div>

      {/* "Now" pill */}
      {isCurrent && !isAdmin && (
        <div
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--rose-soft)',
            background: 'rgba(244,63,94,0.12)',
            padding: '2px 7px',
            borderRadius: '100px',
            flexShrink: 0,
          }}
        >
          Now
        </div>
      )}

      {/* Admin controls */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {isCurrent ? (
            <>
              <span style={{
                fontSize: '9px', fontWeight: 700, color: 'var(--rose-soft)',
                background: 'rgba(244,63,94,0.12)', padding: '2px 6px',
                borderRadius: '100px', alignSelf: 'center',
              }}>
                Now
              </span>
              <button
                onClick={onSkip}
                disabled={loading}
                title="Skip this person's turn"
                style={{
                  padding: '3px 9px',
                  borderRadius: '6px',
                  border: '1px solid rgba(245,158,11,0.3)',
                  background: 'rgba(245,158,11,0.1)',
                  color: 'var(--amber)',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                  transition: 'all 0.12s',
                }}
              >
                {loading ? '…' : 'Skip →'}
              </button>
            </>
          ) : (
            <button
              onClick={onSet}
              disabled={loading}
              title={`Set ${member.full_name || member.username} as the current picker`}
              style={{
                padding: '3px 9px',
                borderRadius: '6px',
                border: '1px solid var(--glass)',
                background: 'transparent',
                color: 'var(--t3)',
                fontSize: '10px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)'
                e.currentTarget.style.background = 'rgba(99,102,241,0.08)'
                e.currentTarget.style.color = '#6366f1'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--glass)'
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--t3)'
              }}
            >
              {loading ? '…' : 'Set turn'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function RotationQueueCard({ rotation, currentUserId, isAdmin = false, groupId, onRotationChange }) {
  const members = rotation?.members || []
  const visible = members.slice(0, MAX_VISIBLE)
  const overflow = members.length - MAX_VISIBLE
  const [actionLoading, setActionLoading] = useState(null)
  const [error, setError] = useState('')

  const handleSkip = async () => {
    const currentId = rotation?.current_user_id
    setActionLoading(currentId)
    setError('')
    try {
      await groupsApi.skipRotation(groupId)
      onRotationChange?.()
    } catch {
      setError('We couldn\'t skip that turn. Give it another go.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSet = async (userId) => {
    setActionLoading(userId)
    setError('')
    try {
      await groupsApi.setRotation(groupId, userId)
      onRotationChange?.()
    } catch {
      setError('We couldn\'t set that turn. Give it another go.')
    } finally {
      setActionLoading(null)
    }
  }

  const headerAction = isAdmin ? (
    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t4)', background: 'var(--s3)', border: '1px solid var(--glass)', padding: '2px 8px', borderRadius: '6px' }}>
      Admin
    </span>
  ) : (
    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t3)' }}>
      {members.length} {members.length === 1 ? 'member' : 'members'}
    </span>
  )

  return (
    <Card>
      <Card.Header title="Turn Queue" action={headerAction} />
      <Card.Body>
        {isAdmin && (
          <div style={{
            fontSize: '11px', color: 'var(--t3)', marginBottom: '12px', lineHeight: 1.5,
            background: 'var(--s3)', border: '1px solid var(--glass)',
            borderRadius: '8px', padding: '8px 10px',
          }}>
            Skip the current picker or set any member as the active turn. Rotation continues in order from the selected person.
          </div>
        )}

        {members.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--t3)', textAlign: 'center', padding: '16px' }}>
            No turn order yet. Set one up whenever you're ready.
          </div>
        ) : (
          <div>
            {visible.map((member, i) => (
              <QueueItem
                key={member.user_id}
                member={member}
                position={i + 1}
                isYou={member.user_id === currentUserId}
                isCurrent={member.user_id === rotation?.current_user_id}
                isAdmin={isAdmin}
                actionLoading={actionLoading}
                onSkip={handleSkip}
                onSet={() => handleSet(member.user_id)}
              />
            ))}
            {overflow > 0 && (
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--rose-soft)',
                  textAlign: 'center',
                  marginTop: '4px',
                  cursor: 'pointer',
                }}
              >
                +{overflow} more
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ fontSize: '11px', color: '#f87171', marginTop: '8px', textAlign: 'center' }}>
            {error}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
