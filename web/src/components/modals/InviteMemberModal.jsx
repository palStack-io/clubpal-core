import { useState } from 'react'
import BaseModal from './BaseModal'
import Button from '../ui/Button'
import { FormGroup, FormInput } from '../ui/Form'

export default function InviteMemberModal({ isOpen, onClose, onInvite, loading, successEmail, onInviteAnother, pendingInvites = [] }) {
  const [email, setEmail] = useState('')

  const handleSubmit = () => {
    if (!email.trim()) return
    onInvite(email.trim())
    setEmail('')
  }

  if (successEmail) {
    return (
      <BaseModal
        isOpen={isOpen}
        onClose={onClose}
        title="Invite Sent!"
        footer={
          <>
            <Button variant="ghost" onClick={onInviteAnother}>Invite Another</Button>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </>
        }
      >
        <div style={{ textAlign: 'center', padding: '8px 0 12px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t1)', marginBottom: '6px' }}>
            Invite sent to
          </div>
          <div style={{ fontSize: '13px', color: 'var(--rose-soft)', fontWeight: 600, marginBottom: '10px' }}>
            {successEmail}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--t3)', lineHeight: 1.6 }}>
            They'll receive an email with a link to join the group.
          </div>
        </div>
      </BaseModal>
    )
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
          autoFocus
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
                color: 'var(--t3)',
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '10px' }}>⏳</span>
              {inv.email}
            </div>
          ))}
        </div>
      )}
    </BaseModal>
  )
}
