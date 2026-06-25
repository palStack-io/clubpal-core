export default function GuestList({ guests = [], memberGroups = [], accentColor = '#f43f5e' }) {
  const going = guests.filter(g => g.status === 'going')

  return (
    <div>
      {going.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ color: 'var(--t2)', fontSize: '0.78rem', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>External guests</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {going.map(g => (
              <span key={g.id} style={{
                background: 'var(--s3)', color: 'var(--t1)', borderRadius: 20,
                padding: '4px 12px', fontSize: '0.85rem',
              }}>
                {g.name}{' '}
                <span style={{ color: accentColor, fontSize: '0.7rem' }}>Guest</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {memberGroups.map(mg => mg.members.length > 0 && (
        <div key={mg.group_id} style={{ marginBottom: 10 }}>
          <p style={{ color: 'var(--t2)', fontSize: '0.78rem', marginBottom: 4 }}>
            {mg.members.length} club member{mg.members.length !== 1 ? 's' : ''} going
          </p>
        </div>
      ))}
    </div>
  )
}
