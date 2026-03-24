import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppShell from '../../components/shell/AppShell'
import Topbar from '../../components/shell/Topbar'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import MemberRow from '../../components/groups/MemberRow'
import InviteMemberModal from '../../components/modals/InviteMemberModal'
import ConfirmDeleteModal from '../../components/modals/ConfirmDeleteModal'
import TurnQueueItem from '../../components/dashboard/TurnQueueItem'
import { groupsApi } from '../../api/groups'
import { useAuth } from '../../contexts/AuthContext'
import { gatewayClient } from '../../api/client'

export default function ManageMembers() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [rotation, setRotation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [removeLoading, setRemoveLoading] = useState(false)

  const fetchAll = async () => {
    try {
      const [g, m, r] = await Promise.all([
        groupsApi.getById(id),
        groupsApi.getMembers(id),
        groupsApi.getRotation(id),
      ])
      setGroup(g)
      setMembers(m || [])
      setRotation(r)
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [id])

  const myRole = members.find(m => m.user_id === user?.id)?.role
  const isAdmin = myRole === 'owner' || myRole === 'admin'

  const handleInvite = async (email) => {
    setInviteLoading(true)
    try {
      await gatewayClient.post(`/groups/${id}/invite`, { email })
      setShowInvite(false)
    } catch {}
    finally { setInviteLoading(false) }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoveLoading(true)
    try {
      await groupsApi.removeMember(id, removeTarget)
      setRemoveTarget(null)
      fetchAll()
    } catch {}
    finally { setRemoveLoading(false) }
  }

  const handleRoleChange = async (uid, role) => {
    try {
      await groupsApi.updateMemberRole(id, uid, role)
      fetchAll()
    } catch {}
  }

  const handleMoveRotation = async (uid, direction) => {
    const sortedIds = [...members]
      .sort((a, b) => (a.rotation_order ?? 999) - (b.rotation_order ?? 999))
      .map(m => m.user_id)
    const idx = sortedIds.indexOf(uid)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sortedIds.length) return
    ;[sortedIds[idx], sortedIds[swapIdx]] = [sortedIds[swapIdx], sortedIds[idx]]
    try {
      await groupsApi.reorderRotation(id, sortedIds)
      fetchAll()
    } catch {}
  }

  const sortedMembers = [...members].sort((a, b) => (a.rotation_order ?? 999) - (b.rotation_order ?? 999))

  return (
    <AppShell activeRoute="/groups">
      <Topbar title={`${group?.name || 'Club'} · Members`} onBack={() => navigate(`/groups/${id}`)}>
        <Button variant="primary" onClick={() => setShowInvite(true)}>+ Invite Member</Button>
      </Topbar>

      <div style={{ padding: '24px' }}>
        {/* Rotation Queue */}
        <Card style={{ marginBottom: '14px' }}>
          <Card.Header
            title="Rotation Queue"
            action={<span style={{ fontSize: '11px', color: 'var(--t3)' }}>Use ↑↓ to reorder</span>}
          />
          <Card.Body>
            {sortedMembers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--t3)', fontSize: '13px' }}>
                {loading ? 'Loading…' : 'No members yet'}
              </div>
            ) : sortedMembers.map((m, i) => (
              <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                {/* Drag controls */}
                {isAdmin && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                      onClick={() => handleMoveRotation(m.user_id, 'up')}
                      disabled={i === 0}
                      style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: 'var(--t4)', padding: '1px 4px', opacity: i === 0 ? 0.3 : 1, fontSize: '11px' }}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMoveRotation(m.user_id, 'down')}
                      disabled={i === sortedMembers.length - 1}
                      style={{ background: 'none', border: 'none', cursor: i === sortedMembers.length - 1 ? 'default' : 'pointer', color: 'var(--t4)', padding: '1px 4px', opacity: i === sortedMembers.length - 1 ? 0.3 : 1, fontSize: '11px' }}
                    >
                      ↓
                    </button>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <TurnQueueItem
                    member={m}
                    position={i + 1}
                    isYou={m.user_id === user?.id}
                    isCurrent={m.user_id === rotation?.current_user_id}
                  />
                </div>
              </div>
            ))}
          </Card.Body>
        </Card>

        {/* Members list */}
        <Card>
          <Card.Header title={`Members (${members.length})`} />
          <Card.Body>
            {members.map(m => (
              <MemberRow
                key={m.user_id}
                member={m}
                canManage={isAdmin && m.user_id !== user?.id}
                onRoleChange={handleRoleChange}
                onRemove={(uid) => setRemoveTarget(uid)}
              />
            ))}
          </Card.Body>
        </Card>
      </div>

      <InviteMemberModal
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        onInvite={handleInvite}
        loading={inviteLoading}
      />
      <ConfirmDeleteModal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        loading={removeLoading}
        itemName="this member"
      />
    </AppShell>
  )
}
