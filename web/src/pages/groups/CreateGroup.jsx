import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../components/shell/AppShell'
import Topbar from '../../components/shell/Topbar'
import Button from '../../components/ui/Button'
import BannerUpload from '../../components/ui/BannerUpload'
import { FormSection, FormRow, FormGroup, FormInput, FormSelect } from '../../components/ui/Form'
import ActivityTypePicker from '../../components/groups/ActivityTypePicker'
import InviteRow from '../../components/groups/InviteRow'
import { groupsApi } from '../../api/groups'
import { gatewayClient } from '../../api/client'

// Map frontend rotation labels to backend rotation_type values
const ROTATION_TYPE_MAP = { sequential: 'round_robin', random: 'random', manual: 'none' }

async function uploadBanner(groupId, file) {
  const urlData = await groupsApi.getBannerUploadUrl(groupId, file.name, file.type)
  await fetch(urlData.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  await groupsApi.update(groupId, { banner_url: urlData.public_url })
  return urlData.public_url
}

export default function CreateGroup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    description: '',
    rotation_mode: 'sequential',
    activity_type: 'dining',
  })
  const [bannerFile, setBannerFile] = useState(null)
  const [bannerPreview, setBannerPreview] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const dragItem = useRef(null)
  const dragOver = useRef(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleBannerChange = (file) => {
    setBannerFile(file)
    setBannerPreview(file ? URL.createObjectURL(file) : null)
  }

  const handleAddInvite = () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email || invites.find(i => i.email === email)) return
    setInvites(prev => [...prev, { email, status: 'pending' }])
    setInviteEmail('')
  }

  const handleRemoveInvite = (email) => setInvites(prev => prev.filter(i => i.email !== email))

  const handleDragStart = (index) => { dragItem.current = index }
  const handleDragEnter = (index) => { dragOver.current = index }
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null) return
    setInvites(prev => {
      const copy = [...prev]
      const [moved] = copy.splice(dragItem.current, 1)
      copy.splice(dragOver.current, 0, moved)
      return copy
    })
    dragItem.current = null
    dragOver.current = null
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Group name is required.'); return }
    setError('')
    setLoading(true)
    try {
      const group = await groupsApi.create({
        name: form.name,
        description: form.description,
        rotation_type: ROTATION_TYPE_MAP[form.rotation_mode] || 'round_robin',
        activity_type: form.activity_type,
      })

      // Upload banner if provided
      if (bannerFile) {
        await uploadBanner(group.id, bannerFile).catch(console.error)
      }

      // Send invites
      await Promise.allSettled(
        invites.map(inv =>
          gatewayClient.post(`/groups/${group.id}/invite`, { email: inv.email })
        )
      )

      navigate(`/groups/${group.id}`)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create group.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell activeRoute="/groups">
      <Topbar title="Create New Group" onBack={() => navigate('/groups')}>
        <Button variant="ghost" onClick={() => navigate('/groups')}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} loading={loading}>Create Group</Button>
      </Topbar>

      <div style={{ padding: '20px 24px', maxWidth: '720px' }}>
        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#f87171', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <FormSection title="Group Banner">
          <BannerUpload
            value={bannerPreview}
            onChange={handleBannerChange}
            label="Group Banner Photo"
            aspectRatio="16/5"
          />
        </FormSection>

        <FormSection title="Group Details">
          <FormRow>
            <FormGroup label="Group Name" required>
              <FormInput
                placeholder="e.g. Friday Foodies"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
            </FormGroup>
            <FormGroup label="Description">
              <FormInput
                placeholder="Brief description..."
                value={form.description}
                onChange={e => set('description', e.target.value)}
              />
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

        <FormSection title="Invite Members">
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <FormInput
              type="email"
              placeholder="Email address..."
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddInvite() }}
              style={{ flex: 1 }}
            />
            <Button variant="primary" onClick={handleAddInvite}>Send Invite</Button>
          </div>
          {form.rotation_mode === 'sequential' && invites.length > 1 && (
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ↕ Drag to set turn order — first in list picks first
            </div>
          )}
          {form.rotation_mode === 'manual' && (
            <div style={{ fontSize: '11px', color: 'var(--amber)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px' }}>
              ✉️ Manual mode — all members will be emailed to vote for the next picker when rotation advances
            </div>
          )}
          {invites.map((inv, index) => (
            <div
              key={inv.email}
              draggable={form.rotation_mode === 'sequential'}
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: form.rotation_mode === 'sequential' ? 'grab' : 'default',
              }}
            >
              {form.rotation_mode === 'sequential' && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t4)', minWidth: '18px', textAlign: 'center' }}>
                  {index + 1}
                </span>
              )}
              <div style={{ flex: 1 }}>
                <InviteRow invite={inv} onRemove={handleRemoveInvite} />
              </div>
              {form.rotation_mode === 'sequential' && (
                <span style={{ fontSize: '14px', color: 'var(--t4)', cursor: 'grab', padding: '0 4px' }}>⠿</span>
              )}
            </div>
          ))}
        </FormSection>
      </div>
    </AppShell>
  )
}
