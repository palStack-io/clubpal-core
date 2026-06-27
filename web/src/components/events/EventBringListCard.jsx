import { useEffect, useMemo, useState } from 'react'
import Card from '../ui/Card'
import { eventsApi } from '../../api/events'

export default function EventBringListCard({ event, attendees = [], currentUser, onUpdated }) {
  const [data, setData] = useState(null)
  const [bringNote, setBringNote] = useState('')
  const [claimItemId, setClaimItemId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Host/creator management state
  const [newLabel, setNewLabel] = useState('')
  const [newEmoji, setNewEmoji] = useState('')
  const [newMax, setNewMax] = useState(1)
  const [editingId, setEditingId] = useState(null)
  const [editDraft, setEditDraft] = useState({ label: '', emoji: '', max_claims: 1 })
  const [managing, setManaging] = useState(false)
  const [manageError, setManageError] = useState('')

  const isHost = !!currentUser && (currentUser.id === event?.host_user_id || currentUser.id === event?.created_by)

  const attendeeNames = useMemo(() => {
    return Object.fromEntries(attendees.map(a => [a.user_id, a.full_name || a.username || `User #${a.user_id}`]))
  }, [attendees])

  // Reload the item list + claim counts (NOT the personal fields — those come from `attendees`)
  async function refresh() {
    const res = await eventsApi.getEventBringList(event.id)
    setData(res)
    return res
  }

  useEffect(() => {
    if (!event?.bring_list_enabled) return
    refresh().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, event?.bring_list_enabled])

  // Pre-fill the current user's note + claim from the attendee list (re-syncs after save)
  useEffect(() => {
    const mine = attendees.find(a => String(a.user_id) === String(currentUser?.id))
    setBringNote(mine?.bring_note || '')
    setClaimItemId(mine?.claim_item_id ? String(mine.claim_item_id) : '')
  }, [attendees, currentUser?.id])

  if (!event?.bring_list_enabled) return null

  async function save() {
    setSaving(true)
    setError('')
    try {
      await eventsApi.updateMyEventBring(event.id, {
        bring_note: bringNote.trim() || null,
        claim_item_id: claimItemId ? Number(claimItemId) : null,
      })
      await refresh()
      onUpdated && onUpdated()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not save what you are bringing.')
    } finally {
      setSaving(false)
    }
  }

  async function addItem() {
    if (!newLabel.trim()) return
    setManaging(true)
    setManageError('')
    try {
      await eventsApi.addEventBringItem(event.id, { label: newLabel.trim(), emoji: newEmoji.trim(), max_claims: Number(newMax) || 1 })
      setNewLabel(''); setNewEmoji(''); setNewMax(1)
      await refresh()
      onUpdated && onUpdated()
    } catch (err) {
      setManageError(err?.response?.data?.detail || 'Could not add item.')
    } finally {
      setManaging(false)
    }
  }

  async function saveEdit(itemId) {
    setManaging(true)
    setManageError('')
    try {
      await eventsApi.editEventBringItem(event.id, itemId, {
        label: editDraft.label.trim() || undefined,
        emoji: editDraft.emoji.trim(),
        max_claims: Number(editDraft.max_claims) || 1,
      })
      setEditingId(null)
      await refresh()
      onUpdated && onUpdated()
    } catch (err) {
      setManageError(err?.response?.data?.detail || 'Could not update item.')
    } finally {
      setManaging(false)
    }
  }

  async function removeItem(itemId) {
    setManaging(true)
    setManageError('')
    try {
      await eventsApi.deleteEventBringItem(event.id, itemId)
      if (String(claimItemId) === String(itemId)) setClaimItemId('')
      await refresh()
      onUpdated && onUpdated()
    } catch (err) {
      setManageError(err?.response?.data?.detail || 'Could not remove item.')
    } finally {
      setManaging(false)
    }
  }

  const items = data?.items || []

  return (
    <Card>
      <Card.Header title="Bring List" subtitle="Coordinate what everyone is bringing." />
      <Card.Body>
        {/* Host/creator management */}
        {isHost && (
          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--glass)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--rose-soft)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>
              Manage items
            </div>
            {items.map(item => (
              <div key={item.id} style={{ marginBottom: 8 }}>
                {editingId === item.id ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={editDraft.emoji} onChange={e => setEditDraft(d => ({ ...d, emoji: e.target.value }))} style={{ width: 44, padding: '8px', borderRadius: 8, border: '1px solid var(--s3)', background: 'var(--s2)', color: 'var(--t1)', textAlign: 'center' }} />
                    <input value={editDraft.label} onChange={e => setEditDraft(d => ({ ...d, label: e.target.value }))} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--s3)', background: 'var(--s2)', color: 'var(--t1)' }} />
                    <input type="number" min={1} max={20} value={editDraft.max_claims} onChange={e => setEditDraft(d => ({ ...d, max_claims: Number(e.target.value) }))} style={{ width: 54, padding: '8px', borderRadius: 8, border: '1px solid var(--s3)', background: 'var(--s2)', color: 'var(--t1)', textAlign: 'center' }} />
                    <button type="button" disabled={managing} onClick={() => saveEdit(item.id)} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'var(--rose)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Save</button>
                    <button type="button" onClick={() => setEditingId(null)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--glass)', background: 'none', color: 'var(--t3)', cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--s3)', borderRadius: 8 }}>
                    <span style={{ flex: 1, color: 'var(--t1)', fontSize: '0.9rem' }}>
                      {item.emoji} {item.label} <span style={{ color: 'var(--t3)', fontSize: '0.8rem' }}>{item.claimed_count}/{item.max_claims}</span>
                    </span>
                    <button type="button" onClick={() => { setEditingId(item.id); setEditDraft({ label: item.label, emoji: item.emoji || '', max_claims: item.max_claims }) }} style={{ color: 'var(--t2)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>Edit</button>
                    <button type="button" onClick={() => removeItem(item.id)} style={{ color: 'var(--rose)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>×</button>
                  </div>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input placeholder="🍕" value={newEmoji} onChange={e => setNewEmoji(e.target.value)} style={{ width: 44, padding: '10px 8px', borderRadius: 8, border: '1px solid var(--s3)', background: 'var(--s2)', color: 'var(--t1)', textAlign: 'center' }} />
              <input placeholder="Add a needed item" value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())} style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--s3)', background: 'var(--s2)', color: 'var(--t1)' }} />
              <input type="number" min={1} max={20} value={newMax} onChange={e => setNewMax(Number(e.target.value))} style={{ width: 54, padding: '10px 8px', borderRadius: 8, border: '1px solid var(--s3)', background: 'var(--s2)', color: 'var(--t1)', textAlign: 'center' }} />
              <button type="button" disabled={managing} onClick={addItem} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--rose)', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem' }}>+</button>
            </div>
            {manageError && <div style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{manageError}</div>}
          </div>
        )}

        {items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {items.map(item => {
              const full = item.claimed_count >= item.max_claims && String(claimItemId) !== String(item.id)
              return (
                <label key={item.id} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px',
                  borderRadius: 12, border: `1px solid ${String(claimItemId) === String(item.id) ? 'var(--rose-border)' : 'var(--glass)'}`,
                  background: String(claimItemId) === String(item.id) ? 'var(--rose-glow)' : 'var(--s3)',
                  opacity: full ? 0.55 : 1,
                }}>
                  <input
                    type="radio"
                    name="event-bring-item"
                    disabled={full || saving}
                    checked={String(claimItemId) === String(item.id)}
                    onChange={() => setClaimItemId(String(item.id))}
                    style={{ marginTop: 3 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)' }}>
                      {item.emoji || '•'} {item.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                      {item.claimed_count}/{item.max_claims} claimed
                      {item.claimed_by?.length > 0 && ` · ${item.claimed_by.map(c => attendeeNames[c.user_id] || `User #${c.user_id}`).join(', ')}`}
                    </div>
                  </div>
                </label>
              )
            })}
            {claimItemId && (
              <button type="button" onClick={() => setClaimItemId('')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--t3)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Clear item claim
              </button>
            )}
          </div>
        )}

        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--t3)', marginBottom: 6 }}>
          What are you bringing?
        </label>
        <textarea
          value={bringNote}
          onChange={e => setBringNote(e.target.value)}
          placeholder="Homemade dip, folding chairs, extra ice..."
          style={{
            width: '100%', minHeight: 74, resize: 'vertical', borderRadius: 12,
            border: '1px solid var(--glass)', background: 'var(--s3)', color: 'var(--t1)',
            padding: '10px 12px', fontFamily: 'inherit', fontSize: 13, outline: 'none',
          }}
        />
        {error && <div style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{error}</div>}
        <button
          type="button"
          disabled={saving}
          onClick={save}
          style={{
            marginTop: 10, width: '100%', borderRadius: 10, border: '1px solid var(--rose-border)',
            background: 'var(--rose)', color: '#fff', padding: '10px 12px',
            fontSize: 13, fontWeight: 800, cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save bring details'}
        </button>
      </Card.Body>
    </Card>
  )
}
