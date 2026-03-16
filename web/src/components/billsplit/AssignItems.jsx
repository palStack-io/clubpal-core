import Card from '../ui/Card'
import Button from '../ui/Button'

function getInitials(member) {
  const name = member.full_name || member.username || ''
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase() || '?'
}

function computeRunningTotal(userId, items, tax, tip, attendees) {
  const count = attendees.length
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

export default function AssignItems({ items, tax, tip, attendees, currentUser, onChange, onNext, onBack }) {
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

  const chipBase = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
    flexShrink: 0,
    border: '2px solid transparent',
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
                style={{
                  background: 'var(--s2)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  border: '1px solid var(--glass)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>
                      {item.name || 'Unnamed item'}
                    </span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t1)', flexShrink: 0, marginLeft: '12px' }}>
                    ${parseFloat(item.price || 0).toFixed(2)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {attendees.map(member => {
                    const isSelected = assigned.includes(member.user_id)
                    return (
                      <button
                        key={member.user_id}
                        title={member.full_name || member.username}
                        style={{
                          ...chipBase,
                          background: isSelected ? 'var(--rose)' : 'var(--s3)',
                          borderColor: isSelected ? 'var(--rose)' : 'var(--t4)',
                          color: isSelected ? '#fff' : 'var(--t2)',
                        }}
                        onClick={() => toggleAssign(item.id, member.user_id)}
                      >
                        {getInitials(member)}
                      </button>
                    )
                  })}

                  {isUnassigned && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#f59e0b',
                        background: 'rgba(245,158,11,0.10)',
                        border: '1px solid rgba(245,158,11,0.20)',
                        borderRadius: '100px',
                        padding: '3px 8px',
                        marginLeft: '4px',
                      }}
                    >
                      ⚠ Split evenly
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {/* Running totals */}
          {attendees.length > 0 && (
            <div
              style={{
                background: 'var(--s2)',
                borderRadius: '12px',
                padding: '12px 14px',
                border: '1px solid var(--glass)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
                Running Totals
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {attendees.map(member => {
                  const total = computeRunningTotal(member.user_id, items, tax, tip, attendees)
                  const isMe = String(member.user_id) === String(currentUser?.id)
                  return (
                    <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: isMe ? 'var(--t1)' : 'var(--t2)', fontWeight: isMe ? 600 : 400 }}>
                        {member.full_name || member.username || 'Member'}
                        {isMe && <span style={{ fontSize: '11px', color: 'var(--t3)', marginLeft: '4px' }}>(you)</span>}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: isMe ? 'var(--rose-soft)' : 'var(--t1)' }}>
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
            <Button variant="primary" onClick={onNext}>
              Next →
            </Button>
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}
