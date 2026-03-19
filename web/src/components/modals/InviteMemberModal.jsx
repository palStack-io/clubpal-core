import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { FormGroup, FormInput } from '../ui/Form'

export default function InviteMemberModal({ isOpen, onClose, onInvite, onResend, loading, successEmail, onInviteAnother, pendingInvites = [] }) {
  const [email, setEmail] = useState('')
  const [resendingEmail, setResendingEmail] = useState(null)
  const [resentEmail, setResentEmail] = useState(null)

  const handleSubmit = () => {
    if (!email.trim()) return
    onInvite(email.trim())
    setEmail('')
  }

  const handleResend = async (inv) => {
    if (!onResend || resendingEmail) return
    setResendingEmail(inv.email)
    setResentEmail(null)
    try {
      await onResend(inv)
      setResentEmail(inv.email)
      setTimeout(() => setResentEmail(null), 2500)
    } finally {
      setResendingEmail(null)
    }
  }

  if (successEmail) {
    return (
      <Modal
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
      </Modal>
    )
  }

  return (
    <Modal
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
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</span>
              {onResend && (
                <button
                  onClick={() => handleResend(inv)}
                  disabled={!!resendingEmail}
                  style={{
                    flexShrink: 0,
                    fontSize: '11px',
                    fontWeight: 600,
                    color: resentEmail === inv.email ? 'var(--green, #22c55e)' : 'var(--rose-soft)',
                    background: 'none',
                    border: 'none',
                    cursor: resendingEmail ? 'default' : 'pointer',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    opacity: resendingEmail && resendingEmail !== inv.email ? 0.4 : 1,
                    transition: 'color 0.2s',
                  }}
                >
                  {resendingEmail === inv.email ? '...' : resentEmail === inv.email ? 'Sent!' : 'Resend'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
