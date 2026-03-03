const ACTIVITIES = [
  { id: 'dining',  emoji: '🍽️', label: 'Dining' },
  { id: 'movies',  emoji: '🎬', label: 'Movies' },
  { id: 'books',   emoji: '📚', label: 'Books' },
  { id: 'gaming',  emoji: '🎮', label: 'Gaming' },
  { id: 'arts',    emoji: '🎨', label: 'Arts' },
  { id: 'hiking',  emoji: '🥾', label: 'Hiking' },
]

export default function ActivityTypePicker({ value, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
      {ACTIVITIES.map(a => {
        const selected = value === a.id
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onChange(a.id)}
            style={{
              border: `1px solid ${selected ? 'rgba(244,63,94,0.22)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '14px',
              padding: '14px 6px',
              textAlign: 'center',
              cursor: 'pointer',
              background: selected ? 'rgba(244,63,94,0.15)' : 'var(--s3)',
              transition: 'all 0.12s',
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '5px' }}>{a.emoji}</div>
            <div style={{ fontSize: '10px', fontWeight: 600, color: selected ? 'var(--rose-soft)' : 'var(--t3)' }}>
              {a.label}
            </div>
          </button>
        )
      })}
    </div>
  )
}
