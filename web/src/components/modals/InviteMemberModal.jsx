import { useState, useEffect, useRef } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import { gatewayClient, groupsClient } from '../../api/client'

const isEmailLike = (v) => v.includes('@') && !v.startsWith('@')
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

export default function InviteMemberModal({
  isOpen, onClose, groupId, groupName, onAdded, currentMemberIds = [],
}) {
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState([])
  const [selected, setSelected]     = useState(null)
  const [emailList, setEmailList]   = useState([])   // pending email invites
  const [searching, setSearching]   = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [successInfo, setSuccessInfo] = useState(null) // { type, data }
  const debounceRef = useRef(null)
  const inputRef    = useRef(null)

  // ── Reset on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return
    setQuery(''); setResults([]); setSelected(null)
    setEmailList([]); setError(''); setSuccessInfo(null)
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [isOpen])

  // ── Debounced username search ─────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // Don't search if it looks like an email or a user is already picked
    if (!query.trim() || selected || isEmailLike(query)) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await gatewayClient.get('/users/search', { params: { username: query.trim() } })
        const list = Array.isArray(data) ? data : data?.results || []
        setResults(list.filter(u => !currentMemberIds.includes(u.id)))
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
  }, [query])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelect = (user) => {
    setSelected(user); setQuery(user.username); setResults([]); setError('')
  }

  const handleClearInput = () => {
    setSelected(null); setQuery(''); setResults([])
    setTimeout(() => inputRef.current?.focus(), 40)
  }

  const handleAddEmail = () => {
    const email = query.trim()
    if (!isValidEmail(email)) { setError('Enter a valid email address.'); return }
    if (emailList.includes(email)) { setError('Already in the list.'); return }
    setEmailList(prev => [...prev, email])
    setQuery(''); setError('')
    setTimeout(() => inputRef.current?.focus(), 40)
  }

  const handleKeyDown = (e) => {
    if (isEmailLike(query)) {
      if (e.key === 'Enter') { e.preventDefault(); handleAddEmail() }
      if (e.key === 'Escape') handleClearInput()
    } else {
      if (e.key === 'Enter' && results.length === 1) handleSelect(results[0])
      if (e.key === 'Escape') { setResults([]); setQuery('') }
    }
  }

  // Add username directly to group
  const handleAddMember = async () => {
    if (!selected) return
    setLoading(true); setError('')
    try {
      await groupsClient.post(`/groups/${groupId}/members`, { user_id: selected.id })
      setSuccessInfo({ type: 'user', data: selected })
      onAdded?.()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Could not add member.')
    } finally { setLoading(false) }
  }

  // Send all email invites
  const handleSendInvites = async () => {
    if (!emailList.length) return
    setLoading(true); setError('')
    try {
      await Promise.all(
        emailList.map(email =>
          gatewayClient.post('/invites/send', {
            email,
            group_id: groupId,
            group_name: groupName || 'the club',
          })
        )
      )
      setSuccessInfo({ type: 'emails', data: emailList })
      onAdded?.()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Some invites could not be sent.')
    } finally { setLoading(false) }
  }

  const handleAddAnother = () => {
    setQuery(''); setResults([]); setSelected(null)
    setEmailList([]); setError(''); setSuccessInfo(null)
    setTimeout(() => inputRef.current?.focus(), 80)
  }

  // ── Footer button ─────────────────────────────────────────────────────────
  const footerAction = (() => {
    if (selected) return { label: 'Add Member', fn: handleAddMember, disabled: false }
    if (emailList.length > 0) return {
      label: `Send ${emailList.length} Invite${emailList.length > 1 ? 's' : ''}`,
      fn: handleSendInvites, disabled: false,
    }
    return { label: 'Add Member', fn: null, disabled: true }
  })()

  // ── Success screen ────────────────────────────────────────────────────────
  if (successInfo) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={successInfo.type === 'user' ? 'Member Added!' : 'Invites Sent!'}
        footer={
          <>
            <Button variant="ghost" onClick={handleAddAnother}>Add Another</Button>
            <Button variant="primary" onClick={onClose}>Done</Button>
          </>
        }
      >
        <div style={{ textAlign: 'center', padding: '8px 0 12px' }}>
          {successInfo.type === 'user' ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                <Avatar user={successInfo.data} size="lg" />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t1)', marginBottom: '4px' }}>
                {successInfo.data.full_name || successInfo.data.username}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '12px' }}>
                @{successInfo.data.username}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px', borderRadius: '100px',
                background: 'rgba(34,211,160,0.12)', border: '1px solid rgba(34,211,160,0.25)',
                fontSize: '12px', fontWeight: 600, color: 'var(--green, #22d3a0)',
              }}>
                ✓ Added to club
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✉️</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t1)', marginBottom: '8px' }}>
                {successInfo.data.length} invite{successInfo.data.length > 1 ? 's' : ''} sent
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                {successInfo.data.map(email => (
                  <div key={email} style={{ fontSize: '12px', color: 'var(--t3)' }}>{email}</div>
                ))}
              </div>
              <div style={{
                marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px', borderRadius: '100px',
                background: 'rgba(34,211,160,0.12)', border: '1px solid rgba(34,211,160,0.25)',
                fontSize: '12px', fontWeight: 600, color: 'var(--green, #22d3a0)',
              }}>
                ✓ They'll receive an email link to join
              </div>
            </>
          )}
        </div>
      </Modal>
    )
  }

  // ── Main screen ───────────────────────────────────────────────────────────
  const emailMode = isEmailLike(query) && !selected

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Member"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={footerAction.fn}
            loading={loading}
            disabled={footerAction.disabled}
          >
            {footerAction.label}
          </Button>
        </>
      }
    >
      {/* Input */}
      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--s3)', border: '1px solid var(--glass)',
          borderRadius: '10px', padding: '8px 12px',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--t3)', flexShrink: 0 }}>
            {emailMode ? '✉' : '@'}
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null); setError('') }}
            onKeyDown={handleKeyDown}
            placeholder="Username or email address…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: '14px', color: 'var(--t1)',
            }}
            autoComplete="off"
          />
          {searching && (
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              border: '2px solid var(--t4)', borderTopColor: 'var(--rose-soft)',
              animation: 'spin 0.6s linear infinite', flexShrink: 0,
            }} />
          )}
          {/* Email add button */}
          {emailMode && isValidEmail(query) && (
            <button
              onClick={handleAddEmail}
              style={{
                background: 'var(--rose)', border: 'none', borderRadius: '6px',
                padding: '3px 8px', cursor: 'pointer',
                fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0,
              }}
            >+ Add</button>
          )}
          {/* Clear button */}
          {(selected || query) && !emailMode && (
            <button
              onClick={handleClearInput}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: '16px', lineHeight: 1, padding: 0, flexShrink: 0 }}
            >×</button>
          )}
        </div>

        {/* Username search hint */}
        {!emailMode && !query && (
          <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--t4)', textAlign: 'center' }}>
            Search by username, or type an email to send an invite
          </div>
        )}

        {/* Email Enter hint */}
        {emailMode && !isValidEmail(query) && (
          <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--t4)', textAlign: 'center' }}>
            Finish the email address then press Enter or click + Add
          </div>
        )}
        {emailMode && isValidEmail(query) && (
          <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--t4)', textAlign: 'center' }}>
            Press Enter or click + Add — you can queue multiple emails
          </div>
        )}

        {/* Username search dropdown */}
        {results.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
            background: 'var(--s2)', border: '1px solid var(--glass)',
            borderRadius: '10px', overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}>
            {results.map(u => (
              <button
                key={u.id}
                onClick={() => handleSelect(u)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                  borderBottom: '1px solid var(--glass)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--s3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <Avatar user={u} size="sm" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>
                    {u.full_name || u.username}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--t3)' }}>@{u.username}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* No results */}
        {!searching && !isEmailLike(query) && query.trim().length >= 2 && results.length === 0 && !selected && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--t3)', textAlign: 'center', padding: '6px 0' }}>
            No users found for "{query}"
          </div>
        )}
      </div>

      {/* Selected username preview */}
      {selected && (
        <div style={{
          marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', background: 'var(--rose-glow)',
          border: '1px solid var(--rose-border)', borderRadius: '10px',
        }}>
          <Avatar user={selected} size="sm" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>
              {selected.full_name || selected.username}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--t3)' }}>@{selected.username}</div>
          </div>
          <span style={{ fontSize: '13px', color: 'var(--green)' }}>Will be added directly</span>
        </div>
      )}

      {/* Email invite list */}
      {emailList.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '11px', color: 'var(--t3)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pending invites ({emailList.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {emailList.map(email => (
              <div key={email} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '7px 10px', background: 'var(--s3)',
                border: '1px solid var(--glass)', borderRadius: '8px',
              }}>
                <span style={{ fontSize: '13px', flex: 1, color: 'var(--t2)' }}>✉ {email}</span>
                <button
                  onClick={() => setEmailList(prev => prev.filter(e => e !== email))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', fontSize: '14px', padding: 0 }}
                >×</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--t4)' }}>
            They'll receive an email with a link to join the club.
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          marginTop: '10px', padding: '8px 12px', borderRadius: '8px',
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
          fontSize: '12px', color: '#f87171',
        }}>
          {error}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </Modal>
  )
}
