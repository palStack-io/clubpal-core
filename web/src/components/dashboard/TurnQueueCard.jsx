import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../ui/Card'
import Avatar from '../ui/Avatar'
import { groupsApi } from '../../api/groups'

function TurnQueueItem({ member, position, isYou }) {
  return (
    <div className={`cp-queue-item${isYou ? ' is-you' : ''}`}>
      {/* Position circle */}
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: 700,
          flexShrink: 0,
          background: isYou ? 'var(--rose)' : 'var(--s4)',
          color: isYou ? '#ffffff' : 'var(--t3)',
          boxShadow: isYou ? '0 0 8px rgba(244,63,94,0.4)' : 'none',
        }}
      >
        {position}
      </div>

      <Avatar user={member} size="sm" />

      <span
        style={{
          flex: 1,
          fontSize: '12px',
          fontWeight: 600,
          color: isYou ? 'var(--t1)' : 'var(--t2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {isYou ? 'You' : (member.full_name || member.username)}
      </span>

      {isYou && (
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--rose-soft)',
            background: 'var(--rose-glow)',
            padding: '2px 7px',
            borderRadius: '100px',
          }}
        >
          Now
        </span>
      )}
    </div>
  )
}

export default function TurnQueueCard({ groupId, groupName, currentUserId }) {
  const navigate = useNavigate()
  const [rotation, setRotation] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!groupId) return
    setLoading(true)
    groupsApi.getRotation(groupId)
      .then(data => setRotation(data))
      .catch(() => setRotation(null))
      .finally(() => setLoading(false))
  }, [groupId])

  const members = rotation?.members || []
  const currentIndex = rotation?.current_turn_index ?? 0
  const effectiveCurrentUserId = currentUserId || rotation?.current_user_id

  const ordered = members.length > 0
    ? [...members.slice(currentIndex), ...members.slice(0, currentIndex)]
    : []

  const visible = ordered.slice(0, 5)
  const hasMore = ordered.length > 5

  return (
    <Card>
      <Card.Header
        title="Turn Queue"
        action={
          groupId && groupName ? (
            <button
              onClick={() => navigate(`/groups/${groupId}`)}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--rose)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {groupName} →
            </button>
          ) : null
        }
      />
      <Card.Body>
        {loading ? (
          <div style={{ color: 'var(--t3)', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>
            Loading queue…
          </div>
        ) : visible.length === 0 ? (
          <div style={{ color: 'var(--t3)', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>
            No rotation data.
          </div>
        ) : (
          <>
            {visible.map((member, i) => {
              const userId = member.user_id || member.id
              return (
                <TurnQueueItem
                  key={userId || i}
                  member={member}
                  position={i + 1}
                  isYou={userId === effectiveCurrentUserId}
                />
              )
            })}
            {hasMore && (
              <button
                onClick={() => navigate(`/groups/${groupId}`)}
                style={{
                  marginTop: '4px',
                  fontSize: '11px',
                  color: 'var(--rose)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
              >
                View all {ordered.length} members →
              </button>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  )
}
