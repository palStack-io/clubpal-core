import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { FormGroup, FormInput, FormTextarea, FormRow } from '../ui/Form'

export default function PickEventModal({ isOpen, onClose, onConfirm, item, activityType, loading }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')

  const handleConfirm = () => {
    if (!date) return
    onConfirm({ item, date, time, notes })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Your Pick"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirm} loading={loading} disabled={!date}>
            Confirm Pick
          </Button>
        </>
      }
    >
      {item && (
        <div
          style={{
            background: 'var(--s3)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '28px' }}>
            {activityType === 'restaurants' ? '🍽️' : activityType === 'movies' ? '🎬' : '📍'}
          </span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t1)' }}>{item.name || item.title}</div>
            {item.rating && <div style={{ fontSize: '12px', color: 'var(--t3)' }}>★ {item.rating}</div>}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <FormRow>
          <FormGroup label="Date" required>
            <FormInput type="date" value={date} onChange={e => setDate(e.target.value)} />
          </FormGroup>
          <FormGroup label="Time">
            <FormInput type="time" value={time} onChange={e => setTime(e.target.value)} />
          </FormGroup>
        </FormRow>
        <FormGroup label="Notes (optional)">
          <FormTextarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any details for the group..."
            style={{ minHeight: '80px' }}
          />
        </FormGroup>
      </div>
    </Modal>
  )
}
