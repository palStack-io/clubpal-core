import { useState } from 'react'
import Card from '../ui/Card'
import Button from '../ui/Button'

function newItem() {
  return {
    id: crypto.randomUUID(),
    name: '',
    price: '',
    assigned_to: [],
  }
}

export default function OCRReview({ items, tax, tip, confidence, onChange, onNext, onBack }) {
  const grandTotal =
    items.reduce((s, i) => s + parseFloat(i.price || 0), 0) +
    parseFloat(tax || 0) +
    parseFloat(tip || 0)

  const subtotal = items.reduce((s, i) => s + parseFloat(i.price || 0), 0)
  const tipPct = subtotal > 0 ? ((parseFloat(tip || 0) / subtotal) * 100).toFixed(0) : 0

  const updateItem = (id, field, value) => {
    onChange(
      items.map(item => item.id === id ? { ...item, [field]: value } : item),
      tax,
      tip
    )
  }

  const deleteItem = (id) => {
    onChange(items.filter(item => item.id !== id), tax, tip)
  }

  const addItem = () => {
    onChange([...items, newItem()], tax, tip)
  }

  const inputStyle = {
    background: 'var(--s3)',
    border: '1px solid var(--glass)',
    borderRadius: '8px',
    padding: '6px 10px',
    fontSize: '13px',
    color: 'var(--t1)',
    outline: 'none',
    width: '100%',
  }

  const numberInputStyle = {
    ...inputStyle,
    width: '96px',
    flexShrink: 0,
  }

  return (
    <Card>
      <Card.Header
        title="Review Items"
        action={
          confidence != null && confidence < 0.8 ? (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#f59e0b',
                background: 'rgba(245,158,11,0.10)',
                border: '1px solid rgba(245,158,11,0.20)',
                borderRadius: '100px',
                padding: '3px 8px',
              }}
            >
              ⚠ Low confidence — please review
            </span>
          ) : null
        }
      />
      <Card.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Low confidence banner */}
          {confidence != null && confidence < 0.8 && (
            <div
              style={{
                borderRadius: '12px',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.15)',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#f59e0b',
              }}
            >
              The scan had low confidence ({Math.round(confidence * 100)}%). Please double-check each item and amount.
            </div>
          )}

          {/* Items list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '4px' }}>
              <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Item</span>
              <span style={{ width: '96px', fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Price</span>
              <span style={{ width: '24px' }} />
            </div>

            {items.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  value={item.name}
                  placeholder="Item name"
                  style={inputStyle}
                  onChange={e => updateItem(item.id, 'name', e.target.value)}
                  onFocus={e => e.target.style.borderColor = 'var(--rose-border)'}
                  onBlur={e => e.target.style.borderColor = 'var(--glass)'}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.price}
                  placeholder="0.00"
                  style={numberInputStyle}
                  onChange={e => updateItem(item.id, 'price', e.target.value)}
                  onFocus={e => e.target.style.borderColor = 'var(--rose-border)'}
                  onBlur={e => e.target.style.borderColor = 'var(--glass)'}
                />
                <button
                  onClick={() => deleteItem(item.id)}
                  style={{
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: 'var(--t3)',
                    fontSize: '16px',
                    flexShrink: 0,
                    borderRadius: '6px',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}
                  title="Remove item"
                >
                  ×
                </button>
              </div>
            ))}

            <button
              onClick={addItem}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--rose)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              + Add item
            </button>
          </div>

          {/* Tax and tip */}
          <div
            style={{
              background: 'var(--s2)',
              borderRadius: '12px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              border: '1px solid var(--glass)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ flex: 1, fontSize: '13px', color: 'var(--t2)', fontWeight: 500 }}>Tax</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={tax}
                style={numberInputStyle}
                onChange={e => onChange(items, e.target.value, tip)}
                onFocus={e => e.target.style.borderColor = 'var(--rose-border)'}
                onBlur={e => e.target.style.borderColor = 'var(--glass)'}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ flex: 1, fontSize: '13px', color: 'var(--t2)', fontWeight: 500 }}>
                Tip
                {subtotal > 0 && (
                  <span style={{ fontSize: '11px', color: 'var(--t3)', marginLeft: '6px' }}>
                    ({tipPct}% of subtotal)
                  </span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={tip}
                style={numberInputStyle}
                onChange={e => onChange(items, tax, e.target.value)}
                onFocus={e => e.target.style.borderColor = 'var(--rose-border)'}
                onBlur={e => e.target.style.borderColor = 'var(--glass)'}
              />
            </div>
            <div
              style={{
                borderTop: '1px solid var(--glass)',
                paddingTop: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t1)' }}>Grand Total</span>
              <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--rose-soft)', letterSpacing: '-0.5px' }}>
                ${grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button variant="ghost" onClick={onBack}>← Back</Button>
            <Button variant="primary" onClick={onNext} disabled={items.length === 0}>
              Next →
            </Button>
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}
