import { useState } from 'react'

export default function BringListBuilder({ enabled, onToggle, items, onItemsChange }) {
  const [label, setLabel]     = useState('')
  const [emoji, setEmoji]     = useState('')
  const [maxClaims, setMax]   = useState(1)

  function normalizeItem(item) {
    return {
      ...item,
      label: (item.label || '').trim(),
      emoji: (item.emoji || '').trim(),
      max_claims: Math.max(1, Number(item.max_claims) || 1),
    }
  }

  function addItem() {
    if (!label.trim()) return
    onItemsChange([...items, normalizeItem({ label, emoji, max_claims: maxClaims })])
    setLabel(''); setEmoji(''); setMax(1)
  }

  function removeItem(i) {
    onItemsChange(items.filter((_, idx) => idx !== i))
  }

  function updateItem(i, patch) {
    onItemsChange(items.map((item, idx) => {
      if (idx !== i) return item
      const nextItem = { ...item, ...patch }
      return patch.max_claims !== undefined ? normalizeItem(nextItem) : nextItem
    }))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ color: 'var(--t1)', fontWeight: 600 }}>Bring list</span>
        <div
          onClick={onToggle}
          style={{
            width: 44, height: 24, borderRadius: 12, cursor: 'pointer', position: 'relative',
            background: enabled ? 'var(--rose)' : 'var(--s3)', transition: 'background 0.15s',
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: enabled ? 22 : 3, width: 18, height: 18,
            borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
          }} />
        </div>
      </div>

      {enabled && (
        <div>
          {items.map((item, i) => (
            <div key={item.id || i} style={{ display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr) 72px auto', gap: 8, alignItems: 'end', marginBottom: 8, padding: '10px 12px', background: 'var(--s3)', borderRadius: 10 }}>
              <input
                placeholder="🍕"
                value={item.emoji || ''}
                onChange={e => updateItem(i, { emoji: e.target.value })}
                style={{ width: '100%', padding: '10px 8px', borderRadius: 8, border: '1px solid var(--s2)', background: 'var(--s2)', color: 'var(--t1)', textAlign: 'center', fontSize: '1rem' }}
              />
              <input
                placeholder="Item name"
                value={item.label || ''}
                onChange={e => updateItem(i, { label: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--s2)', background: 'var(--s2)', color: 'var(--t1)' }}
              />
              <input
                type="number"
                min={1}
                max={20}
                value={Number(item.max_claims) || 1}
                onChange={e => updateItem(i, { max_claims: Number(e.target.value) || 1 })}
                style={{ width: '100%', padding: '10px 8px', borderRadius: 8, border: '1px solid var(--s2)', background: 'var(--s2)', color: 'var(--t1)', textAlign: 'center' }}
              />
              <button type="button" onClick={() => removeItem(i)} style={{ color: 'var(--rose)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, paddingBottom: 10 }}>×</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              placeholder="🍕"
              value={emoji}
              onChange={e => setEmoji(e.target.value)}
              style={{ width: 48, padding: '10px 8px', borderRadius: 8, border: '1px solid var(--s3)', background: 'var(--s2)', color: 'var(--t1)', textAlign: 'center', fontSize: '1rem' }}
            />
            <input
              placeholder="Item name"
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--s3)', background: 'var(--s2)', color: 'var(--t1)' }}
            />
            <input
              type="number"
              min={1} max={20}
              value={maxClaims}
              onChange={e => setMax(Number(e.target.value))}
              style={{ width: 54, padding: '10px 8px', borderRadius: 8, border: '1px solid var(--s3)', background: 'var(--s2)', color: 'var(--t1)', textAlign: 'center' }}
            />
            <button
              type="button"
              onClick={addItem}
              style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--rose)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem' }}
            >
              +
            </button>
          </div>
          <p style={{ color: 'var(--t3)', fontSize: '0.78rem', marginTop: 6 }}>
            Number = max people who can claim this item
          </p>
        </div>
      )}
    </div>
  )
}
