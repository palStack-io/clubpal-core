import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../ui/Card'
import Avatar from '../ui/Avatar'
import { groupsApi } from '../../api/groups'

function TurnQueueItem({ member, position, isCurrentTurn, isYou }) {
  const highlight = isCurrentTurn
  return (
    <div className={`cp-queue-item${highlight ? ' is-you' : ''}`}>
      <div
        style={{
          width: '20px', height: '20px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10px', fontWeight: 700, flexShrink: 0,
          background: highlight ? 'var(--rose)' : 'var(--s4)',
          color: highlight ? '#fff' : 'var(--t3)',
          boxShadow: highlight ? '0 0 8px rgba(244,63,94,0.4)' : 'none',
        }}
      >
        {position}
      </div>
      <Avatar user={member} size="sm" />
      <span style={{
        flex: 1, fontSize: '12px', fontWeight: 600,
        color: highlight ? 'var(--t1)' : 'var(--t2)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {isYou
          ? (isCurrentTurn ? 'You' : 'You')
          : (member.full_name || member.username || `User #${member.user_id}`)}
      </span>
      {isCurrentTurn && (
        <span style={{
          fontSize: '10px', fontWeight: 700,
          color: 'var(--rose-soft)', background: 'var(--rose-glow)',
          padding: '2px 7px', borderRadius: '100px',
        }}>
          {isYou ? 'Your turn' : 'Now'}
        </span>
      )}
    </div>
  )
}

export default function TurnQueueCard({ groupId, groupName, currentUserId }) {
  const navigate = useNavigate()
  const [rotation, setRotation] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!groupId) return
    setLoading(true)
    Promise.all([
      groupsApi.getRotation(groupId),
      groupsApi.getMembers(groupId),
    ])
      .then(([rot, mems]) => {
        setRotation(rot)
        setMembers(Array.isArray(mems) ? mems : [])
      })
      .catch(() => { setRotation(null); setMembers([]) })
      .finally(() => setLoading(false))
  }, [groupId])

  // Backend returns user_id and turn_index (not current_user_id / current_turn_index)
  const currentTurnUserId = rotation?.user_id
  const turnIndex = rotation?.turn_index ?? 0

  // Sort by rotation_order, then rotate the array so current picker is first
  const sorted = [...members].sort((a, b) => (a.rotation_order ?? 999) - (b.rotation_order ?? 999))
  const ordered = sorted.length > 0
    ? [...sorted.slice(turnIndex), ...sorted.slice(0, turnIndex)]
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
                fontSize: '11px', fontWeight: 600, color: 'var(--rose)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
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
                  isCurrentTurn={String(userId) === String(currentTurnUserId)}
                  isYou={String(userId) === String(currentUserId)}
                />
              )
            })}
            {hasMore && (
              <button
                onClick={() => navigate(`/groups/${groupId}`)}
                style={{
                  marginTop: '4px', fontSize: '11px', color: 'var(--rose)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
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
