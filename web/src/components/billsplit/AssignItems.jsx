import { useState, useRef } from 'react'
import Card from '../ui/Card'
import Button from '../ui/Button'

function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name || '').slice(0, 2).toUpperCase() || '?'
}

function computeRunningTotal(userId, items, tax, tip, allParticipants) {
  const count = allParticipants.length
  if (!count) return 0
  const taxPer = parseFloat(tax || 0) / count
  const tipPer = parseFloat(tip || 0) / count
  const unassignedTotal = items
    .filter(i => !i.assigned_to?.length)
    .reduce((s, i) => s + parseFloat(i.price || 0), 0)
  const unassignedPer = unassignedTotal / count
  const assigned = items
    .filter(i => i.assigned_to?.includes(userId))
    .reduce((s, i) => s + parseFloat(i.price || 0), 0)
  return assigned + unassignedPer + taxPer + tipPer
}

export default function AssignItems({ items, tax, tip, attendees, currentUser, onChange, guests, onGuestsChange, onNext, onBack }) {
  // Initialize below the minimum existing guest ID to avoid collisions on remount
  const nextGuestId = useRef(
    guests?.length ? Math.min(...guests.map(g => g.user_id)) - 1 : -1
  )
  const [addingGuest, setAddingGuest] = useState(false)
  const [guestNameInput, setGuestNameInput] = useState('')

  const allParticipants = [...attendees, ...(guests || [])]

  const toggleAssign = (itemId, userId) => {
    onChange(
      items.map(item => {
        if (item.id !== itemId) return item
        const assigned = item.assigned_to || []
        if (assigned.includes(userId)) {
          return { ...item, assigned_to: assigned.filter(id => id !== userId) }
        }
        return { ...item, assigned_to: [...assigned, userId] }
      })
    )
  }

  const assignAllToMe = () => {
    onChange(items.map(item => ({ ...item, assigned_to: [currentUser.id] })))
  }

  const addGuest = () => {
    const name = guestNameInput.trim()
    if (!name) return
    const guestId = nextGuestId.current--
    onGuestsChange([...(guests || []), { user_id: guestId, full_name: name, username: name, isGuest: true }])
    setGuestNameInput('')
    setAddingGuest(false)
  }

  const removeGuest = (guestId) => {
    onGuestsChange((guests || []).filter(g => g.user_id !== guestId))
    // Remove from all item assignments too
    onChange(items.map(it => ({
      ...it,
      assigned_to: (it.assigned_to || []).filter(uid => uid !== guestId),
    })))
  }

  const chipBase = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '50%', fontSize: '11px', fontWeight: 700,
    cursor: 'pointer', userSelect: 'none', flexShrink: 0,
    border: '2px solid transparent', transition: 'background 0.15s, border-color 0.15s',
  }

  return (
    <Card>
      <Card.Header
        title="Assign Items"
        action={
          <Button variant="subtle" size="sm" onClick={assignAllToMe}>
            Assign all to me
          </Button>
        }
      />
      <Card.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Items */}
          {items.map(item => {
            const assigned = item.assigned_to || []
            const isUnassigned = assigned.length === 0
            return (
              <div
                key={item.id}
                style={{ background: 'var(--s2)', borderRadius: '12px', padding: '12px 14px', border: '1px solid var(--glass)' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>
                    {item.name || 'Unnamed item'}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t1)', flexShrink: 0, marginLeft: '12px' }}>
                    ${parseFloat(item.price || 0).toFixed(2)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {allParticipants.map(member => {
                    const isSelected = assigned.includes(member.user_id)
                    const isGuest = member.isGuest
                    const label = isGuest ? (member.full_name || '').slice(0, 2).toUpperCase() : getInitials(member.full_name || member.username)
                    return (
                      <button
                        key={member.user_id}
                        title={`${member.full_name || member.username}${isGuest ? ' (guest)' : ''}`}
                        style={{
                          ...chipBase,
                          width: isGuest ? 'auto' : '32px',
                          height: '32px',
                          padding: isGuest ? '0 8px' : undefined,
                          background: isSelected ? (isGuest ? '#f59e0b' : 'var(--rose)') : 'var(--s3)',
                          borderColor: isSelected ? (isGuest ? '#f59e0b' : 'var(--rose)') : 'var(--t4)',
                          color: isSelected ? '#fff' : 'var(--t2)',
                        }}
                        onClick={() => toggleAssign(item.id, member.user_id)}
                      >
                        {isGuest ? `👤 ${member.full_name?.split(' ')[0]}` : label}
                      </button>
                    )
                  })}

                  {isUnassigned && (
                    <span style={{
                      fontSize: '11px', fontWeight: 700, color: '#f59e0b',
                      background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.20)',
                      borderRadius: '100px', padding: '3px 8px', marginLeft: '4px',
                    }}>
                      ⚠ Split evenly
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {/* Guests section */}
          <div style={{ background: 'var(--s2)', borderRadius: '12px', padding: '12px 14px', border: '1px solid var(--glass)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
              Guests (not on the app)
            </div>

            {(guests || []).map(g => (
              <div key={g.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: 'var(--t1)' }}>👤 {g.full_name}</span>
                <button
                  onClick={() => removeGuest(g.user_id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: '18px', lineHeight: 1, padding: '0 4px' }}
                >
                  ×
                </button>
              </div>
            ))}

            {addingGuest ? (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Guest name (e.g. Alex)"
                  value={guestNameInput}
                  onChange={e => setGuestNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addGuest(); if (e.key === 'Escape') setAddingGuest(false); }}
                  style={{ flex: 1, background: 'var(--s3)', border: '1px solid var(--glass)', borderRadius: '8px', padding: '6px 10px', fontSize: '13px', color: 'var(--t1)', outline: 'none' }}
                />
                <Button variant="primary" size="sm" onClick={addGuest}>Add</Button>
                <Button variant="ghost" size="sm" onClick={() => setAddingGuest(false)}>Cancel</Button>
              </div>
            ) : (
              <button
                onClick={() => { setGuestNameInput(''); setAddingGuest(true); }}
                style={{ marginTop: (guests || []).length ? '8px' : 0, background: 'none', border: '1px dashed var(--t4)', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', color: 'var(--t3)', cursor: 'pointer', width: '100%' }}
              >
                + Add Guest
              </button>
            )}
          </div>

          {/* Running totals */}
          {allParticipants.length > 0 && (
            <div style={{ background: 'var(--s2)', borderRadius: '12px', padding: '12px 14px', border: '1px solid var(--glass)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
                Running Totals
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {allParticipants.map(member => {
                  const total = computeRunningTotal(member.user_id, items, tax, tip, allParticipants)
                  const isMe = String(member.user_id) === String(currentUser?.id)
                  const isGuest = member.isGuest
                  return (
                    <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: isGuest ? '#f59e0b' : isMe ? 'var(--t1)' : 'var(--t2)', fontWeight: isMe ? 600 : 400 }}>
                        {isGuest ? `👤 ${member.full_name}` : (member.full_name || member.username || 'Member')}
                        {isMe && <span style={{ fontSize: '11px', color: 'var(--t3)', marginLeft: '4px' }}>(you)</span>}
                        {isGuest && <span style={{ fontSize: '11px', color: 'var(--t3)', marginLeft: '4px' }}>cash</span>}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: isGuest ? '#f59e0b' : isMe ? 'var(--rose-soft)' : 'var(--t1)' }}>
                        ${total.toFixed(2)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button variant="ghost" onClick={onBack}>← Back</Button>
            <Button variant="primary" onClick={onNext}>Next →</Button>
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}
