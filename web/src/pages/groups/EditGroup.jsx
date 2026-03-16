import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../components/shell/AppShell'
import Topbar from '../../components/shell/Topbar'
import Button from '../../components/ui/Button'
import { FormSection, FormRow, FormGroup, FormInput, FormSelect } from '../../components/ui/Form'
import ActivityTypePicker from '../../components/groups/ActivityTypePicker'
import ConfirmDeleteModal from '../../components/modals/ConfirmDeleteModal'
import { groupsApi } from '../../api/groups'

const ROTATION_TYPE_MAP = { sequential: 'round_robin', random: 'random', manual: 'none' }
const ROTATION_MODE_MAP = { round_robin: 'sequential', random: 'random', none: 'manual' }

export default function EditGroup() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', description: '', rotation_mode: 'sequential', activity_type: 'dining' })
  const [members, setMembers] = useState([])
  const [memberOrder, setMemberOrder] = useState([])
  const [reorderSaving, setReorderSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [error, setError] = useState('')
  const dragItem = useRef(null)
  const dragOver = useRef(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!id) return
    Promise.all([groupsApi.getById(id), groupsApi.getMembers(id)])
      .then(([g, m]) => {
        setForm({
          name: g.name || '',
          description: g.description || '',
          rotation_mode: ROTATION_MODE_MAP[g.rotation_type] || 'sequential',
          activity_type: g.activity_type?.toLowerCase() || 'dining',
        })
        const sorted = (m || []).sort((a, b) => (a.rotation_order ?? 999) - (b.rotation_order ?? 999))
        setMembers(sorted)
        setMemberOrder(sorted.map(m => m.user_id))
      })
      .catch(() => setError('Failed to load group.'))
      .finally(() => setLoading(false))
  }, [id])

  const handleDragStart = (index) => { dragItem.current = index }
  const handleDragEnter = (index) => { dragOver.current = index }
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null) return
    setMemberOrder(prev => {
      const copy = [...prev]
      const [moved] = copy.splice(dragItem.current, 1)
      copy.splice(dragOver.current, 0, moved)
      return copy
    })
    dragItem.current = null
    dragOver.current = null
  }

  const handleSaveOrder = async () => {
    setReorderSaving(true)
    try {
      await groupsApi.reorderRotation(id, memberOrder)
    } catch {
      setError('Failed to save order.')
    } finally {
      setReorderSaving(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Group name is required.'); return }
    setError('')
    setSaving(true)
    try {
      await groupsApi.update(id, {
        name: form.name,
        description: form.description,
        rotation_type: ROTATION_TYPE_MAP[form.rotation_mode] || 'round_robin',
        activity_type: form.activity_type,
      })
      navigate(`/groups/${id}`)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await groupsApi.delete(id)
      navigate('/groups')
    } catch {
      setError('Failed to delete group.')
      setShowDelete(false)
      setDeleting(false)
    }
  }

  return (
    <AppShell activeRoute="/groups">
      <Topbar title="Edit Group" onBack={() => navigate(`/groups/${id}`)}>
        <Button variant="ghost" onClick={() => navigate(`/groups/${id}`)}>Cancel</Button>
        <Button variant="primary" onClick={handleSave} loading={saving}>Save Changes</Button>
      </Topbar>

      <div style={{ padding: '20px 24px', maxWidth: '720px' }}>
        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#f87171', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)' }}>Loading…</div>
        ) : (
          <>
            <FormSection title="Group Details">
              <FormRow>
                <FormGroup label="Group Name" required>
                  <FormInput value={form.name} onChange={e => set('name', e.target.value)} />
                </FormGroup>
                <FormGroup label="Description">
                  <FormInput value={form.description} onChange={e => set('description', e.target.value)} />
                </FormGroup>
              </FormRow>
              <div style={{ marginTop: '12px' }}>
                <FormGroup label="Turn Rotation Mode">
                  <FormSelect value={form.rotation_mode} onChange={e => set('rotation_mode', e.target.value)}>
                    <option value="sequential">Sequential</option>
                    <option value="random">Random</option>
                    <option value="manual">Manual</option>
                  </FormSelect>
                </FormGroup>
              </div>
            </FormSection>

            <FormSection title="Activity Type">
              <ActivityTypePicker value={form.activity_type} onChange={v => set('activity_type', v)} />
            </FormSection>

            {form.rotation_mode === 'sequential' && memberOrder.length > 0 && (
              <FormSection title="Turn Order">
                <div style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '10px' }}>
                  ↕ Drag to reorder — person at top picks first
                </div>
                {memberOrder.map((userId, index) => {
                  const member = members.find(m => m.user_id === userId)
                  return (
                    <div
                      key={userId}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragEnter={() => handleDragEnter(index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={e => e.preventDefault()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        marginBottom: '6px',
                        background: 'var(--s3)',
                        border: '1px solid var(--glass)',
                        cursor: 'grab',
                        userSelect: 'none',
                      }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--rose)', minWidth: '20px', textAlign: 'center' }}>
                        {index + 1}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>
                          User #{userId}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--t4)', textTransform: 'uppercase' }}>
                          {member?.role || 'member'}
                        </div>
                      </div>
                      <span style={{ fontSize: '16px', color: 'var(--t4)' }}>⠿</span>
                    </div>
                  )
                })}
                <Button variant="ghost" onClick={handleSaveOrder} loading={reorderSaving} style={{ marginTop: '8px' }}>
                  Save Turn Order
                </Button>
              </FormSection>
            )}

            {form.rotation_mode === 'manual' && (
              <FormSection title="Manual Rotation">
                <div style={{ fontSize: '13px', color: 'var(--t2)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '12px 14px' }}>
                  ✉️ When rotation advances, all group members will be emailed to vote on who picks next.
                </div>
              </FormSection>
            )}

            <FormSection title="Danger Zone">
              <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: '14px', padding: '20px' }}>
                <p style={{ fontSize: '13px', color: 'var(--t2)', marginBottom: '12px' }}>
                  Deleting this group is permanent. All events and ratings will be lost.
                </p>
                <Button variant="danger" onClick={() => setShowDelete(true)}>Delete Group</Button>
              </div>
            </FormSection>
          </>
        )}
      </div>

      <ConfirmDeleteModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        itemName={`"${form.name}"`}
      />
    </AppShell>
  )
}
