import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../../components/shell/AppShell'
import Topbar from '../../components/shell/Topbar'
import Button from '../../components/ui/Button'
import { FormSection, FormRow, FormGroup, FormInput, FormSelect } from '../../components/ui/Form'
import ActivityTypePicker from '../../components/groups/ActivityTypePicker'
import ConfirmDeleteModal from '../../components/modals/ConfirmDeleteModal'
import { groupsApi } from '../../api/groups'

const JOIN_SITE = 'clubapp.palstack.io'

const ROTATION_TYPE_MAP = { sequential: 'round_robin', random: 'random', manual: 'none' }
const ROTATION_MODE_MAP = { round_robin: 'sequential', random: 'random', none: 'manual' }

export default function EditGroup() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', description: '', rotation_mode: 'sequential', activity_type: 'dining', email_reminders_enabled: false })
  const [members, setMembers] = useState([])
  const [memberOrder, setMemberOrder] = useState([])
  const [reorderSaving, setReorderSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [error, setError] = useState('')
  // Invite code state
  const [inviteCode, setInviteCode] = useState(null)
  const [inviteLoading, setInviteLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)
  const [joinRequests, setJoinRequests] = useState([])
  const [reviewingId, setReviewingId] = useState(null)
  const dragItem = useRef(null)
  const dragOver = useRef(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!id) return
    Promise.all([
      groupsApi.getById(id),
      groupsApi.getMembers(id),
      groupsApi.getActiveInviteCode(id).catch(() => null),
      groupsApi.getJoinRequests(id).catch(() => []),
    ]).then(([g, m, ic, jrs]) => {
        setForm({
          name: g.name || '',
          description: g.description || '',
          rotation_mode: ROTATION_MODE_MAP[g.rotation_type] || 'sequential',
          activity_type: g.activity_type?.toLowerCase() || 'dining',
          email_reminders_enabled: g.email_reminders_enabled ?? false,
        })
        const sorted = (m || []).sort((a, b) => (a.rotation_order ?? 999) - (b.rotation_order ?? 999))
        setMembers(sorted)
        setMemberOrder(sorted.map(m => m.user_id))
        setInviteCode(ic)
        setJoinRequests(Array.isArray(jrs) ? jrs : [])
      })
      .catch(() => setError('We couldn\'t load your group. Refresh and try again.'))
      .finally(() => { setLoading(false); setInviteLoading(false) })
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
      setError('Hmm, that didn\'t save. Mind trying again?')
    } finally {
      setReorderSaving(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('What should we call your group?'); return }
    setError('')
    setSaving(true)
    try {
      await groupsApi.update(id, {
        name: form.name,
        description: form.description,
        rotation_type: ROTATION_TYPE_MAP[form.rotation_mode] || 'round_robin',
        activity_type: form.activity_type,
        email_reminders_enabled: form.rotation_mode === 'manual' ? form.email_reminders_enabled : false,
      })
      window.location.href = `/groups/${id}`
    } catch (e) {
      setError(e.response?.data?.detail || 'Hmm, that didn\'t save. Mind trying again?')
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerate = async () => {
    if (!inviteCode) return
    setRegenerating(true)
    try {
      const newCode = await groupsApi.generateInviteCode(id, {
        join_behavior: inviteCode.join_behavior,
        expiry_type: inviteCode.expiry_type,
        expiry_days: inviteCode.expiry_days,
      })
      setInviteCode(newCode)
      setShowRegenConfirm(false)
    } catch {
      setError('We couldn\'t make a new code. Give it another go.')
    } finally {
      setRegenerating(false)
    }
  }

  const handleUpdateCodeSettings = async (patch) => {
    if (!inviteCode) return
    setRegenerating(true)
    try {
      const newCode = await groupsApi.generateInviteCode(id, {
        join_behavior: patch.join_behavior ?? inviteCode.join_behavior,
        expiry_type: patch.expiry_type ?? inviteCode.expiry_type,
        expiry_days: patch.expiry_days !== undefined ? patch.expiry_days : inviteCode.expiry_days,
      })
      setInviteCode(newCode)
    } catch {
      setError('We couldn\'t update those invite settings. Give it another go.')
    } finally {
      setRegenerating(false)
    }
  }

  const handleReviewRequest = async (requestId, action) => {
    setReviewingId(requestId)
    try {
      await groupsApi.reviewJoinRequest(requestId, action)
      setJoinRequests(prev => prev.filter(r => r.id !== requestId))
    } catch {
      setError('We couldn\'t review that request. Give it another go.')
    } finally {
      setReviewingId(null)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await groupsApi.delete(id)
      navigate('/groups')
    } catch {
      setError('We couldn\'t delete that group. Give it another go.')
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
                  Drag to reorder — person at top picks first
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
                <div
                  style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: '10px', padding: '14px', cursor: 'pointer' }}
                  onClick={() => set('email_reminders_enabled', !form.email_reminders_enabled)}
                >
                  <div style={{ width: '40px', height: '22px', borderRadius: '11px', background: form.email_reminders_enabled ? 'var(--amber)' : 'var(--glass)', position: 'relative', transition: 'background 0.2s', flexShrink: 0, marginTop: '1px' }}>
                    <div style={{ position: 'absolute', top: '2px', left: form.email_reminders_enabled ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '9px', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: form.email_reminders_enabled ? 'var(--amber)' : 'var(--t2)' }}>Enable monthly email reminder for the next pick</div>
                    <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '3px', lineHeight: 1.4 }}>When enabled, all group members will be emailed to vote on who picks next when rotation advances</div>
                  </div>
                </div>
              </FormSection>
            )}

            {/* ── Invite Code Section ── */}
            <FormSection title="Invite Code">
              {inviteLoading ? (
                <div style={{ color: 'var(--t3)', fontSize: '13px' }}>Loading…</div>
              ) : !inviteCode ? (
                <div style={{ color: 'var(--t3)', fontSize: '13px' }}>
                  No invite code found.{' '}
                  <button
                    style={{ color: 'var(--rose)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                    onClick={() => groupsApi.generateInviteCode(id, { join_behavior: 'instant', expiry_type: 'never' }).then(setInviteCode)}
                  >
                    Generate one
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Code + link row */}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{
                      flex: 1, background: 'var(--s3)', border: '1px solid var(--s4)',
                      borderRadius: '10px', padding: '10px 14px',
                      fontFamily: 'monospace', fontSize: '18px', fontWeight: 700,
                      color: 'var(--t1)', letterSpacing: '2px',
                    }}>
                      {inviteCode.code}
                    </div>
                    <Button variant="ghost" onClick={() => navigator.clipboard.writeText(inviteCode.code)}>
                      Copy code
                    </Button>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div style={{
                      flex: 1, background: 'var(--s3)', border: '1px solid var(--s4)',
                      borderRadius: '10px', padding: '9px 14px',
                      fontSize: '12px', color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {JOIN_SITE}/join/{inviteCode.code}
                    </div>
                    <Button variant="ghost" onClick={() => navigator.clipboard.writeText(`https://${JOIN_SITE}/join/${inviteCode.code}`)}>
                      Copy link
                    </Button>
                  </div>

                  {/* Settings row */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <FormGroup label="Join behavior" style={{ flex: 1, minWidth: '140px' }}>
                      <FormSelect
                        value={inviteCode.join_behavior}
                        onChange={e => handleUpdateCodeSettings({ join_behavior: e.target.value })}
                        disabled={regenerating}
                      >
                        <option value="instant">Instant join</option>
                        <option value="approval">Admin approval</option>
                      </FormSelect>
                    </FormGroup>
                    <FormGroup label="Expires" style={{ flex: 1, minWidth: '140px' }}>
                      <FormSelect
                        value={inviteCode.expiry_type === 'days' ? String(inviteCode.expiry_days || 7) : 'never'}
                        onChange={e => handleUpdateCodeSettings({
                          expiry_type: e.target.value === 'never' ? 'never' : 'days',
                          expiry_days: e.target.value === 'never' ? null : parseInt(e.target.value),
                        })}
                        disabled={regenerating}
                      >
                        <option value="never">Never</option>
                        <option value="1">24 hours</option>
                        <option value="3">3 days</option>
                        <option value="7">7 days</option>
                      </FormSelect>
                    </FormGroup>
                  </div>

                  {/* Regenerate */}
                  {showRegenConfirm ? (
                    <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', padding: '12px 14px' }}>
                      <p style={{ fontSize: '13px', color: 'var(--t2)', marginBottom: '10px' }}>
                        Old code stops working immediately. Anyone with the old link won't be able to join.
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Button variant="primary" onClick={handleRegenerate} loading={regenerating}>Yes, regenerate</Button>
                        <Button variant="ghost" onClick={() => setShowRegenConfirm(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <Button variant="ghost" onClick={() => setShowRegenConfirm(true)}>
                      Regenerate code
                    </Button>
                  )}
                </div>
              )}
            </FormSection>

            {/* ── Join Requests (approval mode only) ── */}
            {inviteCode?.join_behavior === 'approval' && (
              <FormSection title={`Join Requests${joinRequests.length > 0 ? ` (${joinRequests.length})` : ''}`}>
                {joinRequests.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--t3)', padding: '10px 0' }}>No requests waiting right now.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {joinRequests.map(req => (
                      <div key={req.id} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        background: 'var(--s3)', border: '1px solid var(--glass)',
                        borderRadius: '10px', padding: '12px 14px',
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'var(--rose)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '14px', flexShrink: 0,
                        }}>
                          #{req.user_id}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>User #{req.user_id}</div>
                          <div style={{ fontSize: '11px', color: 'var(--t3)' }}>
                            Requested {new Date(req.requested_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Button
                            variant="primary"
                            loading={reviewingId === req.id}
                            onClick={() => handleReviewRequest(req.id, 'approve')}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            loading={reviewingId === req.id}
                            onClick={() => handleReviewRequest(req.id, 'decline')}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
