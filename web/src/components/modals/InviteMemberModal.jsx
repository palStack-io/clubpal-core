import { useState } from 'react'
import BaseModal from './BaseModal'
import Button from '../ui/Button'
import { FormGroup, FormInput } from '../ui/Form'

export default function InviteMemberModal({ isOpen, onClose, onInvite, loading, pendingInvites = [] }) {
  const [email, setEmail] = useState('')

  const handleSubmit = () => {
    if (!email.trim()) return
    onInvite(email.trim())
    setEmail('')
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite Member"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading} disabled={!email.trim()}>
            Send Invite
          </Button>
        </>
      }
    >
      <FormGroup label="Email Address" required>
        <FormInput
          type="email"
          placeholder="member@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
        />
      </FormGroup>

      {pendingInvites.length > 0 && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--t3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Pending Invites
          </div>
          {pendingInvites.map(inv => (
            <div
              key={inv.email}
              style={{
                padding: '6px 10px',
                background: 'var(--s3)',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--t2)',
                marginBottom: '4px',
              }}
            >
              {inv.email}
            </div>
          ))}
        </div>
      )}
    </BaseModal>
  )
}
