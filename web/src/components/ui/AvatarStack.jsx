import Avatar from './Avatar'

export default function AvatarStack({ users = [], maxVisible = 3, size = 'sm' }) {
  const visible = users.slice(0, maxVisible)
  const overflow = users.length - maxVisible

  const sizeMap = {
    sm: { width: '24px', height: '24px', fontSize: '9px' },
    md: { width: '30px', height: '30px', fontSize: '11px' },
  }
  const s = sizeMap[size] || sizeMap.sm

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((user, i) => (
        <div
          key={user.id || user.user_id || i}
          style={{
            marginLeft: i === 0 ? 0 : '-6px',
            border: '2px solid var(--s2)',
            borderRadius: '50%',
            flexShrink: 0,
          }}
        >
          <Avatar user={user} size={size} />
        </div>
      ))}
      {overflow > 0 && (
        <div
          style={{
            marginLeft: '-6px',
            ...s,
            borderRadius: '50%',
            background: 'var(--s4)',
            border: '2px solid var(--s2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            fontWeight: 700,
            color: 'var(--t3)',
            flexShrink: 0,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
