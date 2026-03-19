import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'

const OPTIONS = [
  { value: 'going',     label: '✓ Going',         bg: 'rgba(34,211,160,0.15)', border: 'rgba(34,211,160,0.3)', color: '#22d3a0' },
  { value: 'maybe',     label: '? Maybe',          bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)', color: '#f59e0b' },
  { value: 'not_going', label: "✕ Can't Make It",  bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)', color: '#f87171' },
]

export default function RSVPModal({ isOpen, onClose, onSubmit, eventTitle, loading }) {
  const [selected, setSelected] = useState(null)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Your RSVP for ${eventTitle || 'this event'}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onSubmit(selected)} loading={loading} disabled={!selected}>
            Save RSVP
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setSelected(opt.value)}
            style={{
              width: '100%',
              padding: '16px',
              border: `2px solid ${selected === opt.value ? opt.border : 'var(--glass)'}`,
              borderRadius: '12px',
              background: selected === opt.value ? opt.bg : 'var(--s3)',
              color: selected === opt.value ? opt.color : 'var(--t2)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.12s',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </Modal>
  )
}
