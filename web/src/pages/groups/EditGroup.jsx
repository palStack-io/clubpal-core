import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../components/shell/AppShell'
import Topbar from '../../components/shell/Topbar'
import Button from '../../components/ui/Button'
import { FormSection, FormRow, FormGroup, FormInput, FormSelect } from '../../components/ui/Form'
import ActivityTypePicker from '../../components/groups/ActivityTypePicker'
import ConfirmDeleteModal from '../../components/modals/ConfirmDeleteModal'
import { groupsApi } from '../../api/groups'

export default function EditGroup() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', description: '', rotation_mode: 'sequential', activity_type: 'dining' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!id) return
    groupsApi.getById(id)
      .then(g => setForm({
        name: g.name || '',
        description: g.description || '',
        rotation_mode: g.rotation_mode || 'sequential',
        activity_type: g.activity_type?.toLowerCase() || 'dining',
      }))
      .catch(() => setError('Failed to load group.'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Group name is required.'); return }
    setError('')
    setSaving(true)
    try {
      await groupsApi.update(id, form)
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
