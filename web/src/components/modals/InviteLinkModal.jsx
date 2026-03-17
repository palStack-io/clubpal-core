import { useState, useEffect } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { groupsApi } from '../../api/groups'

const JOIN_SITE = 'clubpal.io'

const inputStyle = {
  background: 'var(--s2)',
  border: '1px solid var(--glass)',
  borderRadius: '10px',
  padding: '8px 12px',
  fontSize: '13px',
  color: 'var(--t1)',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--t3)',
  marginBottom: '5px',
  display: 'block',
}

const sectionStyle = {
  background: 'var(--s3)',
  border: '1px solid var(--glass)',
  borderRadius: '14px',
  padding: '16px',
  marginBottom: '12px',
}

const EXPIRY_OPTIONS = [
  { label: '24 hours', expiry_type: 'days', expiry_days: 1 },
  { label: '3 days',   expiry_type: 'days', expiry_days: 3 },
  { label: '7 days',   expiry_type: 'days', expiry_days: 7 },
  { label: 'Never',    expiry_type: 'never', expiry_days: null },
]

function formatExpiry(inviteCode) {
  if (!inviteCode) return null
  if (inviteCode.expiry_type === 'never') return 'Never expires'
  if (inviteCode.expires_at) {
    const d = new Date(inviteCode.expires_at)
    const now = new Date()
    const diffMs = d - now
    if (diffMs <= 0) return 'Expired'
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHrs < 24) return `Expires in ${diffHrs}h`
    const diffDays = Math.floor(diffHrs / 24)
    return `Expires in ${diffDays}d`
  }
  return null
}

export default function InviteLinkModal({ isOpen, onClose, groupId, groupName, isAdmin }) {
  const [inviteCode, setInviteCode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)
  const [pendingExpiry, setPendingExpiry] = useState(null)
  const [pendingBehavior, setPendingBehavior] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    groupsApi.getActiveInviteCode(groupId)
      .then(ic => {
        setInviteCode(ic || null)
        setPendingExpiry(ic?.expiry_type === 'days' ? ic.expiry_days : null)
        setPendingBehavior(ic?.join_behavior || 'instant')
      })
      .catch(() => setInviteCode(null))
      .finally(() => setLoading(false))
  }, [isOpen, groupId])

  const joinLink = `https://${JOIN_SITE}/join/${inviteCode?.code}`

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode.code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(joinLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const expiryDays = pendingExpiry
      const expiryType = expiryDays ? 'days' : 'never'
      const ic = await groupsApi.generateInviteCode(groupId, {
        join_behavior: pendingBehavior || 'instant',
        expiry_type: expiryType,
        expiry_days: expiryDays,
      })
      setInviteCode(ic)
      setShowRegenConfirm(false)
    } catch {}
    finally { setRegenerating(false) }
  }

  const handleGenerateFirst = async () => {
    setRegenerating(true)
    try {
      const ic = await groupsApi.generateInviteCode(groupId, {
        join_behavior: 'instant',
        expiry_type: 'never',
        expiry_days: null,
      })
      setInviteCode(ic)
      setPendingBehavior('instant')
      setPendingExpiry(null)
    } catch {}
    finally { setRegenerating(false) }
  }

  const expiryLabel = formatExpiry(inviteCode)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Link" size="md">
      {loading ? (
        <div style={{ color: 'var(--t3)', fontSize: '13px', padding: '12px 0' }}>Loading…</div>
      ) : !inviteCode ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔗</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--t2)', marginBottom: '6px' }}>No invite link yet</div>
          <div style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '20px' }}>
            {isAdmin ? 'Generate a link to share with people you want to invite.' : 'Ask an admin to generate an invite link.'}
          </div>
          {isAdmin && (
            <Button variant="primary" loading={regenerating} onClick={handleGenerateFirst}>
              Generate Invite Link
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Join link */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Share this link</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{
                flex: 1, ...inputStyle,
                fontSize: '12px', color: 'var(--t3)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                cursor: 'text',
              }}>
                {joinLink}
              </div>
              <Button variant="primary" onClick={copyLink} style={{ flexShrink: 0 }}>
                {copiedLink ? '✓ Copied!' : 'Copy link'}
              </Button>
            </div>

            {/* Code row */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{
                flex: 1, ...inputStyle,
                fontFamily: 'monospace', fontSize: '16px', fontWeight: 700,
                letterSpacing: '2px', color: 'var(--t1)',
              }}>
                {inviteCode.code}
              </div>
              <Button variant="ghost" onClick={copyCode} style={{ flexShrink: 0 }}>
                {copiedCode ? '✓ Copied!' : 'Copy code'}
              </Button>
            </div>

            {/* Status badges */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: 'var(--t3)', background: 'var(--s2)', borderRadius: '100px', padding: '3px 9px', border: '1px solid var(--glass)' }}>
                {inviteCode.join_behavior === 'approval' ? '✋ Approval required' : '⚡ Instant join'}
              </span>
              {expiryLabel && (
                <span style={{
                  fontSize: '11px', borderRadius: '100px', padding: '3px 9px', border: '1px solid var(--glass)',
                  background: expiryLabel === 'Expired' ? 'rgba(248,113,113,0.1)' : 'var(--s2)',
                  color: expiryLabel === 'Expired' ? '#f87171' : 'var(--t3)',
                }}>
                  ⏱ {expiryLabel}
                </span>
              )}
              {inviteCode.used_count > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--t3)', background: 'var(--s2)', borderRadius: '100px', padding: '3px 9px', border: '1px solid var(--glass)' }}>
                  {inviteCode.used_count} joined
                </span>
              )}
            </div>
          </div>

          {/* Admin settings */}
          {isAdmin && (
            <>
              <div style={sectionStyle}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t2)', marginBottom: '12px' }}>Link Settings</div>

                <label style={labelStyle}>Expires after</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  {EXPIRY_OPTIONS.map(opt => {
                    const isActive = opt.expiry_type === 'never'
                      ? pendingExpiry === null
                      : pendingExpiry === opt.expiry_days
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setPendingExpiry(opt.expiry_days)}
                        style={{
                          padding: '6px 14px', borderRadius: '100px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                          border: isActive ? '1px solid var(--rose-border)' : '1px solid var(--glass)',
                          background: isActive ? 'rgba(244,63,94,0.10)' : 'var(--s2)',
                          color: isActive ? 'var(--rose-soft)' : 'var(--t3)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>

                <label style={labelStyle}>Join behavior</label>
                <select
                  value={pendingBehavior}
                  onChange={e => setPendingBehavior(e.target.value)}
                  style={{ ...inputStyle, appearance: 'none' }}
                >
                  <option value="instant">⚡ Instant join</option>
                  <option value="approval">✋ Admin approval required</option>
                </select>
              </div>

              {/* Regenerate */}
              {showRegenConfirm ? (
                <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '12px', padding: '14px 16px', marginBottom: '12px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--t2)', marginBottom: '12px' }}>
                    ⚠️ The old link stops working immediately. Generate a new link with the settings above?
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="primary" onClick={handleRegenerate} loading={regenerating}>Generate new link</Button>
                    <Button variant="ghost" onClick={() => setShowRegenConfirm(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" onClick={() => setShowRegenConfirm(true)} style={{ marginBottom: '12px' }}>
                  🔄 Generate new link
                </Button>
              )}
            </>
          )}
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  )
}
