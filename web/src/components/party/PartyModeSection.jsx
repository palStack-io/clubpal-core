import BringListBuilder from './BringListBuilder'

const VIBE_COLORS = [
  { label: 'Rose',   value: '#f43f5e' },
  { label: 'Amber',  value: '#f59e0b' },
  { label: 'Green',  value: '#22d3a0' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Blue',   value: '#6366f1' },
]

const STYLES = [
  { key: 'glass',   label: 'Glass',   desc: 'Frosted, translucent' },
  { key: 'neon',    label: 'Neon',    desc: 'Glowing accent border' },
  { key: 'minimal', label: 'Minimal', desc: 'Clean, flat' },
]

export default function PartyModeSection({
  accentColor, onAccentChange,
  style, onStyleChange,
  bringListEnabled, onBringListToggle,
  items, onItemsChange,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Vibe color */}
      <div>
        <p style={{ margin: '0 0 10px', color: 'var(--t2)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Vibe Color
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {VIBE_COLORS.map(c => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => onAccentChange(c.value)}
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: c.value, border: 'none', cursor: 'pointer',
                outline: accentColor === c.value ? `3px solid ${c.value}` : 'none',
                outlineOffset: 3,
                boxShadow: accentColor === c.value ? `0 0 0 2px var(--bg)` : 'none',
                transition: 'outline 0.15s',
              }}
            />
          ))}
        </div>
      </div>

      {/* Style */}
      <div>
        <p style={{ margin: '0 0 10px', color: 'var(--t2)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Invite Style
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {STYLES.map(s => (
            <button
              key={s.key}
              type="button"
              onClick={() => onStyleChange(s.key)}
              style={{
                padding: '12px 8px', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${style === s.key ? accentColor : 'var(--s3)'}`,
                background: style === s.key ? `${accentColor}18` : 'var(--s2)',
                color: style === s.key ? accentColor : 'var(--t2)',
                fontWeight: 600, fontSize: '0.82rem',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: '0.9rem', marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Bring list */}
      <div style={{ borderTop: '1px solid var(--s3)', paddingTop: 16 }}>
        <BringListBuilder
          enabled={bringListEnabled}
          onToggle={onBringListToggle}
          items={items}
          onItemsChange={onItemsChange}
        />
      </div>

    </div>
  )
}
