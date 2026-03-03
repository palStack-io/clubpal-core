import { useState } from 'react'
import BaseModal from './BaseModal'
import Button from '../ui/Button'
import { FormGroup, FormSelect, FormTextarea } from '../ui/Form'

export default function SkipTurnModal({ isOpen, onClose, onConfirm, loading }) {
  const [reason, setReason] = useState('No ideas yet')
  const [other, setOther] = useState('')

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Skip Your Turn?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onConfirm(reason === 'Other' ? other : reason)} loading={loading}>
            Skip Turn
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <FormGroup label="Reason (optional)">
          <FormSelect value={reason} onChange={e => setReason(e.target.value)}>
            <option>No ideas yet</option>
            <option>Not available</option>
            <option>Other</option>
          </FormSelect>
        </FormGroup>
        {reason === 'Other' && (
          <FormGroup label="Tell us more">
            <FormTextarea
              value={other}
              onChange={e => setOther(e.target.value)}
              rows={3}
              placeholder="Reason..."
            />
          </FormGroup>
        )}
      </div>
    </BaseModal>
  )
}
