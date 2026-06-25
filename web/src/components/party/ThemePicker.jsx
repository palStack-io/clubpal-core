const ACTIVITIES = [
  { type: 'dining',  label: '🍽️ Dining',  accent: '#f59e0b' },
  { type: 'hiking',  label: '🥾 Hiking',  accent: '#22d3a0' },
  { type: 'gaming',  label: '🎮 Gaming',  accent: '#a855f7' },
  { type: 'movies',  label: '🎬 Movies',  accent: '#6366f1' },
  { type: 'arts',    label: '🎨 Arts',    accent: '#fb7185' },
  { type: 'other',   label: '🎉 Other',   accent: '#f43f5e' },
]

export default function ThemePicker({ value, onChange }) {
  return (
    <div>
      <p style={{ color: 'var(--t2)', fontSize: '0.85rem', marginBottom: 10 }}>Activity type</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {ACTIVITIES.map(a => (
          <button
            key={a.type}
            type="button"
            onClick={() => onChange(a.type)}
            style={{
              padding: '14px 8px', borderRadius: 10,
              border: `2px solid ${value === a.type ? a.accent : 'var(--s3)'}`,
              background: value === a.type ? `${a.accent}22` : 'var(--s2)',
              color: value === a.type ? a.accent : 'var(--t2)',
              fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
              transition: 'all 0.15s',
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}
