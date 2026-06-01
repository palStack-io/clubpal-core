import { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import { groupsApi } from '../../api/groups'
import { eventsApi } from '../../api/events'

export default function AddEventAttendeesModal({ isOpen, onClose, eventId, groupId, attendeeIds = [], onAdded }) {
  const [members, setMembers] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !groupId) return
    setLoading(true)
    setError('')
    groupsApi.getMembers(groupId)
      .then((list) => setMembers(Array.isArray(list) ? list : []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false))
  }, [isOpen, groupId])

  const selectable = useMemo(
    () => members.filter((m) => !attendeeIds.includes(m.user_id)),
    [members, attendeeIds]
  )

  const toggle = (uid) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  const handleAdd = async () => {
    if (!selectedIds.size) return
    setSaving(true)
    setError('')
    try {
      await Promise.all([...selectedIds].map((uid) => eventsApi.addAttendee(eventId, uid)))
      onAdded?.()
      onClose?.()
    } catch {
      setError('Could not add some attendees. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Attendees"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleAdd} loading={saving} disabled={!selectedIds.size}>
            Add Selected
          </Button>
        </>
      )}
    >
      {loading ? (
        <div style={{ color: 'var(--t3)', fontSize: '13px' }}>Loading members…</div>
      ) : selectable.length === 0 ? (
        <div style={{ color: 'var(--t3)', fontSize: '13px' }}>Everyone in this group is already in the event.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
          {selectable.map((m) => (
            <button
              key={m.user_id}
              onClick={() => toggle(m.user_id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                textAlign: 'left',
                padding: '10px',
                borderRadius: '10px',
                border: selectedIds.has(m.user_id) ? '1px solid var(--rose-border)' : '1px solid var(--glass)',
                background: selectedIds.has(m.user_id) ? 'rgba(244,63,94,0.12)' : 'var(--s3)',
                color: 'var(--t1)',
                cursor: 'pointer',
              }}
            >
              <Avatar user={{ full_name: m.full_name || m.username, avatar_url: m.avatar_url }} size="sm" />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{m.full_name || m.username || `User ${m.user_id}`}</span>
            </button>
          ))}
        </div>
      )}
      {error && <div style={{ marginTop: '10px', color: '#f87171', fontSize: '12px' }}>{error}</div>}
    </Modal>
  )
}
