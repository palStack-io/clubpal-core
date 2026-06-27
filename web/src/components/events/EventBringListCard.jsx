import { useEffect, useMemo, useState } from 'react'
import Card from '../ui/Card'
import { eventsApi } from '../../api/events'

export default function EventBringListCard({ event, attendees = [], currentUser, onUpdated }) {
  const [data, setData] = useState(null)
  const [bringNote, setBringNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [claimingId, setClaimingId] = useState(null)

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

  // Reload the item list + claim counts
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

  // Pre-fill the current user's freeform note from the attendee list
  useEffect(() => {
    const mine = attendees.find(a => String(a.user_id) === String(currentUser?.id))
    setBringNote(mine?.bring_note || '')
  }, [attendees, currentUser?.id])

  if (!event?.bring_list_enabled) return null

  const items = data?.items || []

  // How many units the current member has claimed on a given item
  function myQuantity(item) {
    const mine = (item.claimed_by || []).find(c => !c.is_guest && String(c.user_id) === String(currentUser?.id))
    return mine?.quantity || 0
  }

  function claimerLabel(c) {
    const name = c.is_guest ? `${c.name || 'Guest'} (guest)` : (attendeeNames[c.user_id] || `User #${c.user_id}`)
    return c.quantity > 1 ? `${name} ×${c.quantity}` : name
  }

  async function setClaim(itemId, quantity) {
    setClaimingId(itemId)
    setError('')
    try {
      await eventsApi.claimEventBringItem(event.id, itemId, { quantity, note: null })
      await refresh()
      onUpdated && onUpdated()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not update your claim.')
    } finally {
      setClaimingId(null)
    }
  }

  async function saveNote() {
    setSaving(true)
    setError('')
    try {
      await eventsApi.updateMyEventBring(event.id, { bring_note: bringNote.trim() || null })
      await refresh()
      onUpdated && onUpdated()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not save your note.')
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
      await refresh()
      onUpdated && onUpdated()
    } catch (err) {
      setManageError(err?.response?.data?.detail || 'Could not remove item.')
    } finally {
      setManaging(false)
    }
  }

  const stepBtn = (disabled) => ({
    width: 28, height: 28, borderRadius: 8, border: '1px solid var(--glass)',
    background: 'var(--s2)', color: disabled ? 'var(--t4)' : 'var(--t1)',
    fontSize: '1.05rem', lineHeight: 1, cursor: disabled ? 'default' : 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
  })

  return (
    <Card>
      <Card.Header title="Bring List" subtitle="Tap an item to add it to what you'll bring." />
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

        {/* Tap-to-claim shopping list */}
        {items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {items.map(item => {
              const mine = myQuantity(item)
              const remaining = Math.max(0, item.max_claims - item.claimed_count)
              const claimed = mine > 0
              const full = remaining <= 0 && !claimed
              const busy = claimingId === item.id
              const others = (item.claimed_by || []).filter(c => c.is_guest || String(c.user_id) !== String(currentUser?.id))
              return (
                <div key={item.id} style={{
                  padding: '10px 12px', borderRadius: 12,
                  border: `1px solid ${claimed ? 'var(--rose-border)' : 'var(--glass)'}`,
                  background: claimed ? 'var(--rose-glow)' : 'var(--s3)',
                  opacity: full ? 0.55 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      type="button"
                      disabled={busy || (full && !claimed)}
                      onClick={() => setClaim(item.id, claimed ? 0 : 1)}
                      style={{
                        flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0,
                        cursor: busy || full ? 'default' : 'pointer', color: 'var(--t1)',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 800 }}>
                        {item.emoji || '•'} {item.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                        {item.claimed_count}/{item.max_claims} claimed{full ? ' · full' : remaining > 0 ? ` · ${remaining} left` : ''}
                      </div>
                    </button>
                    {claimed ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button type="button" disabled={busy} onClick={() => setClaim(item.id, mine - 1)} style={stepBtn(busy)}>−</button>
                        <span style={{ minWidth: 18, textAlign: 'center', fontWeight: 800, color: 'var(--rose-soft)' }}>{mine}</span>
                        <button type="button" disabled={busy || remaining <= 0} onClick={() => setClaim(item.id, mine + 1)} style={stepBtn(busy || remaining <= 0)}>+</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy || full}
                        onClick={() => setClaim(item.id, 1)}
                        style={{
                          padding: '7px 14px', borderRadius: 999, border: '1px solid var(--rose-border)',
                          background: full ? 'var(--s2)' : 'var(--rose)', color: full ? 'var(--t3)' : '#fff',
                          fontSize: 12, fontWeight: 800, cursor: busy || full ? 'default' : 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        {full ? 'Full' : "I'll bring"}
                      </button>
                    )}
                  </div>
                  {others.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
                      {others.map(claimerLabel).join(', ')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--t3)', marginBottom: 6 }}>
          Anything else you're bringing?
        </label>
        <textarea
          value={bringNote}
          onChange={e => setBringNote(e.target.value)}
          placeholder="Homemade dip, folding chairs, extra ice..."
          style={{
            width: '100%', minHeight: 64, resize: 'vertical', borderRadius: 12,
            border: '1px solid var(--glass)', background: 'var(--s3)', color: 'var(--t1)',
            padding: '10px 12px', fontFamily: 'inherit', fontSize: 13, outline: 'none',
          }}
        />
        {error && <div style={{ color: '#f87171', fontSize: 12, marginTop: 8 }}>{error}</div>}
        <button
          type="button"
          disabled={saving}
          onClick={saveNote}
          style={{
            marginTop: 10, width: '100%', borderRadius: 10, border: '1px solid var(--rose-border)',
            background: 'var(--rose)', color: '#fff', padding: '10px 12px',
            fontSize: 13, fontWeight: 800, cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save note'}
        </button>
      </Card.Body>
    </Card>
  )
}
