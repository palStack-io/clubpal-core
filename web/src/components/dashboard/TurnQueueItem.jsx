import Avatar from '../ui/Avatar'

export default function TurnQueueItem({ member, position, isYou, isCurrent }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 12px',
        borderRadius: '10px',
        background: isYou ? 'rgba(244,63,94,0.15)' : 'var(--s3)',
        border: `1px solid ${isYou ? 'rgba(244,63,94,0.22)' : 'var(--glass)'}`,
        marginBottom: '6px',
      }}
    >
      {/* Position */}
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
      <Avatar user={member} size="sm" />

      {/* Name */}
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

      {/* Current tag */}
      {isCurrent && (
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--rose-soft)',
            background: 'rgba(244,63,94,0.12)',
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
