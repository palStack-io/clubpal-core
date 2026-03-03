import Card from '../ui/Card'
import Avatar from '../ui/Avatar'

const MAX_VISIBLE = 5

function QueueItem({ member, position, isYou, isCurrent }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 12px',
        borderRadius: '10px',
        marginBottom: '6px',
        background: isYou ? 'rgba(244,63,94,0.15)' : 'var(--s3)',
        border: isYou ? '1px solid rgba(244,63,94,0.22)' : '1px solid var(--glass)',
      }}
    >
      {/* Position circle */}
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: isYou ? 'var(--rose)' : 'var(--s4)',
          color: isYou ? '#fff' : 'var(--t4)',
          fontSize: '10px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: isYou ? '0 0 8px rgba(244,63,94,0.4)' : 'none',
        }}
      >
        {position}
      </div>

      {/* Avatar */}
      <Avatar
        user={{ full_name: member.full_name, avatar_url: member.avatar_url }}
        size="sm"
      />

      {/* Name block */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: isYou ? 'var(--t1)' : 'var(--t2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {isYou ? 'You' : member.full_name}
        </div>
        {member.picks_count != null && (
          <div style={{ fontSize: '9px', color: 'var(--t4)', marginTop: '1px' }}>
            Picked {member.picks_count} {member.picks_count === 1 ? 'time' : 'times'}
          </div>
        )}
      </div>

      {/* "Now" pill for current picker */}
      {isCurrent && (
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
    </div>
  )
}

export default function RotationQueueCard({ rotation, currentUserId }) {
  const members = rotation?.members || []
  const visible = members.slice(0, MAX_VISIBLE)
  const overflow = members.length - MAX_VISIBLE

  const headerAction = (
    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t3)' }}>
      {members.length} {members.length === 1 ? 'member' : 'members'}
    </span>
  )

  return (
    <Card>
      <Card.Header title="Turn Queue" action={headerAction} />
      <Card.Body>
        {members.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--t3)', textAlign: 'center', padding: '16px' }}>
            No rotation set
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
                View all {members.length}
              </div>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
