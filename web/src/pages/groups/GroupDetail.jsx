import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import AppShell from '../../components/shell/AppShell'
import { PageLoader } from '../../components/ui/LoadingSpinner'
import GroupHeroCard from '../../components/groups/GroupHeroCard'
import GroupEventsCard from '../../components/groups/GroupEventsCard'
import MembersCard from '../../components/groups/MembersCard'
import CommentsCard from '../../components/events/CommentsCard'
import AnimatedBackground from '../../components/ui/AnimatedBackground'
import InviteMemberModal from '../../components/modals/InviteMemberModal'
import InviteLinkModal from '../../components/modals/InviteLinkModal'
import ConfirmDeleteModal from '../../components/modals/ConfirmDeleteModal'
import EditGroupModal from '../../components/modals/EditGroupModal'
import CreateEventModal from '../../components/modals/CreateEventModal'
import CreatePollModal from '../../components/modals/CreatePollModal'
import PollCard from '../../components/groups/PollCard'
import { groupsApi } from '../../api/groups'
import { eventsApi } from '../../api/events'
import { ratingsApi } from '../../api/ratings'
import { gatewayClient } from '../../api/client'

async function enrichWithProfiles(items, uidField) {
  if (!items?.length) return items || []
  const fn = typeof uidField === 'function' ? uidField : (item => item[uidField])
  const uids = [...new Set(items.map(fn).filter(Boolean))]
  if (!uids.length) return items
  const profiles = await Promise.all(
    uids.map(uid => gatewayClient.get(`/users/${uid}/profile`).then(r => r.data).catch(() => ({ id: uid })))
  )
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
  return items.map(item => {
    const { id: _pid, ...profileFields } = profileMap[fn(item)] || {}
    return { ...item, ...profileFields }
  })
}

function activeSinceLabel(createdAt) {
  if (!createdAt) return 'New'
  const years = Math.floor((Date.now() - new Date(createdAt)) / (365.25 * 24 * 60 * 60 * 1000))
  return years === 0 ? 'New' : `${years}yr`
}

export default function GroupDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [past, setPast] = useState([])
  const [rotation, setRotation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [showInviteLink, setShowInviteLink] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [removeLoading, setRemoveLoading] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [showCreatePoll, setShowCreatePoll] = useState(false)
  const [pollToConvert, setPollToConvert] = useState(null)
  const [polls, setPolls] = useState([])
  const [showAllPolls, setShowAllPolls] = useState(false)
  const [showPastPolls, setShowPastPolls] = useState(false)
  const [comments, setComments] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [groupAvgRatingFromEvents, setGroupAvgRatingFromEvents] = useState(null)
  const [pendingInvites, setPendingInvites] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [inviteSuccess, setInviteSuccess] = useState(null)
  const [inviteCode, setInviteCode] = useState(null)

  const fetchAll = async () => {
    try {
      const [g, m, u, r] = await Promise.all([
        groupsApi.getById(id),
        groupsApi.getMembers(id),
        eventsApi.getGroupEvents(id, 'scheduled'),
        groupsApi.getRotation(id),
      ])
      setGroup(g)
      setUpcoming(u || [])
      const enrichedMembers = await enrichWithProfiles(m || [], 'user_id')
      // Filter out ghost records left by deleted users (no name or username after enrichment)
      const liveMembers = enrichedMembers.filter(mb => mb.full_name || mb.username || mb.avatar_url)
      setMembers(liveMembers)
      if (r) {
        const rotationMembers = liveMembers
          .filter(mb => mb.rotation_order != null)
          .sort((a, b) => (a.rotation_order ?? 999) - (b.rotation_order ?? 999))
        setRotation({ ...r, current_user_id: r.user_id, members: rotationMembers })
      } else {
        setRotation(null)
      }
    } catch {
      /* leave group/members/upcoming/rotation at their prior state on failure */
    }
    finally { setLoading(false) }

    groupsApi.getActiveInviteCode(id).then(ic => setInviteCode(ic?.code || null)).catch(() => {})

    groupsApi.getComments(id).then(async c => {
      const arr = Array.isArray(c) ? c : []
      setComments(await enrichWithProfiles(arr, 'user_id'))
    }).catch(() => {})
    groupsApi.getGroupPolls(id, user?.id).then(p => setPolls(Array.isArray(p) ? p : [])).catch(() => {})

    // Load past events + leaderboard together so we can pass all event IDs for the avg rating
    Promise.all([
      eventsApi.getGroupEvents(id, 'completed').catch(() => []),
      eventsApi.getGroupEvents(id, 'scheduled').catch(() => []),
    ]).then(([pastEvs, upcomingEvs]) => {
      setPast(pastEvs || [])
      const allIds = [...(pastEvs || []), ...(upcomingEvs || [])]
        .map(e => e.id).filter(Boolean).join(',')
      const params = allIds ? `?event_ids=${allIds}` : ''
      return ratingsApi.getLeaderboard(id, params)
    }).then(d => {
      setLeaderboard(d?.leaderboard || [])
      setGroupAvgRatingFromEvents(d?.group_avg_rating ?? null)
    }).catch(() => {})
    gatewayClient.get(`/groups/${id}/pending-invites`).then(r => setPendingInvites(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    groupsApi.getJoinRequests(id).then(async rows => {
      const enriched = await enrichWithProfiles(Array.isArray(rows) ? rows : [], 'user_id')
      setPendingRequests(enriched)
    }).catch(() => {})
  }

  useEffect(() => { fetchAll() }, [id])

  // Record the visit (fire-and-forget) so most-visited ordering stays fresh
  useEffect(() => { if (id) groupsApi.recordVisit(id) }, [id])

  const myRole = members.find(m => m.user_id === user?.id)?.role
  const isAdmin = myRole === 'owner' || myRole === 'admin'
  const isMyTurn = rotation?.current_user_id === user?.id

  const handleInvite = async (email) => {
    setInviteLoading(true)
    try {
      await gatewayClient.post('/invites/send', {
        email,
        group_id: parseInt(id),
        invited_by: user.id,
        group_name: group.name,
      })
      setInviteSuccess(email)
      gatewayClient.get(`/groups/${id}/pending-invites`).then(r => setPendingInvites(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    } catch (err) {
      setInviteSuccess(null)
    } finally {
      setInviteLoading(false)
    }
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

  const handleAddComment = async (content) => {
    try {
      await groupsApi.addComment(id, user?.id, content)
      groupsApi.getComments(id).then(async c => {
        const arr = Array.isArray(c) ? c : []
        setComments(await enrichWithProfiles(arr, 'user_id'))
      }).catch(() => {})
    } catch {}
  }

  const handleDeleteComment = async (commentId) => {
    try {
      await groupsApi.deleteComment(id, commentId)
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch {}
  }

  const handleRotationChange = async () => {
    try {
      const r = await groupsApi.getRotation(id)
      if (r) {
        setRotation(prev => ({ ...r, current_user_id: r.user_id, members: prev?.members || [] }))
      } else {
        setRotation(null)
      }
    } catch {}
  }

  if (loading) return (
    <AppShell activeRoute="/groups">
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)' }}>Loading group…</div>
    </AppShell>
  )

  if (!group) return (
    <AppShell activeRoute="/groups">
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)' }}>We couldn't find that group. Double-check the link.</div>
    </AppShell>
  )

  const groupAvgRating = groupAvgRatingFromEvents != null
    ? Number(groupAvgRatingFromEvents).toFixed(1)
    : null

  const stats = [
    { label: 'Total Events', value: upcoming.length + past.length },
    { label: 'Avg Rating ★', value: groupAvgRating ?? '—' },
    { label: 'Active Since', value: activeSinceLabel(group.created_at) },
  ]

  const handleLeaveGroup = async () => {
    if (!window.confirm(`Leave ${group?.name || 'this group'}? You will lose access.`)) return
    try {
      await groupsApi.removeMember(id, user?.id)
      navigate('/groups')
    } catch (e) {
      alert(e?.response?.data?.detail || "We couldn't get you out of that group. Give it another go.")
    }
  }

  const heroActions = [
    { label: 'Invite Link', onClick: () => setShowInviteLink(true) },
    ...(isAdmin ? [{ label: 'Edit', onClick: () => setShowEdit(true) }] : []),
    ...(myRole !== 'owner' ? [{ label: 'Leave Group', onClick: handleLeaveGroup, danger: true }] : []),
  ]

  return (
    <AppShell activeRoute="/groups">
      {/* Full-width hero banner with controls embedded */}
      <GroupHeroCard
        group={group}
        members={members}
        rotation={rotation}
        currentUserId={user?.id}
        onBack={() => navigate('/groups')}
        actions={heroActions}
        inviteCode={inviteCode}
      />

      {/* Floating stats */}
      <div className="cp-floating-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {stats.map(stat => (
          <div key={stat.label} className="cp-stat-tile">
            <div className="cp-stat-tile-value">{stat.value}</div>
            <div className="cp-stat-tile-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ padding: '0 24px 24px', position: 'relative' }}>
        {group.bg_scope === 'full' && group.bg_type && group.bg_type !== 'default' && (
          <AnimatedBackground bgType={group.bg_type} bgValue={group.bg_value} style={{ borderRadius: 0 }} />
        )}


        <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: '14px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Group Pulse — polls section */}
            {(() => {
              const openPolls = polls.filter(p => p.status === 'open')
              const pastPolls = polls.filter(p => p.status !== 'open')
              const handleUpdate = updated => setPolls(prev => prev.map(p => p.id === updated.id ? updated : p))
              return (polls.length > 0 || true) ? (
                <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '16px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--t1)' }}>
                      Group Pulse {openPolls.length > 0 && <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--rose-soft)', background: 'var(--rose-glow)', borderRadius: '99px', padding: '2px 8px', marginLeft: '6px' }}>{openPolls.length} open</span>}
                    </span>
                    <button
                      onClick={() => setShowCreatePoll(true)}
                      style={{ fontSize: '11px', fontWeight: 700, color: 'var(--rose-soft)', background: 'var(--rose-glow)', border: '1px solid var(--rose-border)', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer' }}
                    >
                      + Poll
                    </button>
                  </div>

                  {/* Open polls */}
                  {openPolls.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--t3)', fontSize: '13px' }}>
                      No votes needed. Everyone's on the same page. · <button onClick={() => setShowCreatePoll(true)} style={{ color: 'var(--rose-soft)', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>Start one →</button>
                    </div>
                  )}
                  {(showAllPolls ? openPolls : openPolls.slice(0, 3)).map(poll => (
                    <PollCard key={poll.id} poll={poll} currentUserId={user?.id} onUpdated={handleUpdate} onConvertToEvent={p => setPollToConvert(p)} />
                  ))}
                  {openPolls.length > 3 && (
                    <button onClick={() => setShowAllPolls(v => !v)} style={{ width: '100%', padding: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--t3)', background: 'none', border: '1px solid var(--glass)', borderRadius: '10px', cursor: 'pointer', marginBottom: '8px' }}>
                      {showAllPolls ? 'Show less' : `See ${openPolls.length - 3} more active`}
                    </button>
                  )}

                  {/* Past polls collapsible */}
                  {pastPolls.length > 0 && (
                    <>
                      <button
                        onClick={() => setShowPastPolls(v => !v)}
                        style={{ width: '100%', padding: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--t3)', background: 'var(--s3)', border: '1px solid var(--glass)', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: openPolls.length > 0 ? '8px' : 0 }}
                      >
                        {showPastPolls ? '▲' : '▼'} Past Polls ({pastPolls.length})
                      </button>
                      {showPastPolls && pastPolls.map(poll => (
                        <PollCard key={poll.id} poll={poll} currentUserId={user?.id} onUpdated={handleUpdate} onConvertToEvent={p => setPollToConvert(p)} />
                      ))}
                    </>
                  )}
                </div>
              ) : null
            })()}
            <GroupEventsCard
              upcoming={upcoming}
              past={past}
              groupId={id}
              isMyTurn={isMyTurn}
              onNewEvent={() => setShowCreateEvent(true)}
            />
            <CommentsCard
              groupId={id}
              comments={comments}
              currentUser={user}
              onAdd={handleAddComment}
              onDelete={handleDeleteComment}
              members={members}
              mentionContext={{ linkType: 'group', linkId: Number(id) }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <MembersCard
              members={members}
              pendingInvites={pendingInvites}
              canManage={isAdmin}
              currentUserId={user?.id}
              onRoleChange={handleRoleChange}
              onRemove={uid => setRemoveTarget(uid)}
              onInvite={() => setShowInvite(true)}
              rotation={rotation}
              rotationType={group?.rotation_type}
              isAdmin={isAdmin}
              groupId={id}
              onRotationChange={handleRotationChange}
            />
            {isAdmin && pendingRequests.length > 0 && (
              <div style={{ background: 'var(--s3)', border: '1px solid var(--rose-border)', borderRadius: '16px', padding: '18px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)', marginBottom: '14px' }}>
                  Join Requests ({pendingRequests.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pendingRequests.map(req => (
                    <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--s2)', borderRadius: '10px', padding: '10px 12px', border: '1px solid var(--glass)' }}>
                      <span style={{ fontSize: '20px' }}>👤</span>
                      <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>
                        {req.full_name || req.username || `User #${req.user_id}`}
                      </span>
                      <button
                        onClick={async () => {
                          try {
                            await groupsApi.reviewJoinRequest(req.id, 'approve')
                            setPendingRequests(prev => prev.filter(r => r.id !== req.id))
                            fetchAll()
                          } catch {}
                        }}
                        style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.1)', color: '#16a34a', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await groupsApi.reviewJoinRequest(req.id, 'decline')
                            setPendingRequests(prev => prev.filter(r => r.id !== req.id))
                          } catch {}
                        }}
                        style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)', color: '#f87171', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Decline
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <InviteLinkModal
        isOpen={showInviteLink}
        onClose={() => setShowInviteLink(false)}
        groupId={id}
        groupName={group?.name}
        isAdmin={isAdmin}
      />
      <InviteMemberModal
        isOpen={showInvite}
        onClose={() => { setShowInvite(false); setInviteSuccess(null) }}
        groupId={parseInt(id)}
        groupName={group?.name}
        onInvite={handleInvite}
        onResend={(inv) => gatewayClient.post('/invites/send', {
          email: inv.email,
          group_id: parseInt(id),
          invited_by: user.id,
          group_name: group.name,
        })}
        loading={inviteLoading}
        successEmail={inviteSuccess}
        onInviteAnother={() => setInviteSuccess(null)}
        pendingInvites={pendingInvites}
      />
      <ConfirmDeleteModal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        loading={removeLoading}
        itemName="this member"
      />
      <EditGroupModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        group={group}
        members={members}
        currentUserId={user?.id}
        onSaved={() => { setShowEdit(false); fetchAll() }}
        onDeleted={() => navigate('/groups')}
        onMembersChanged={fetchAll}
      />
      <CreateEventModal
        isOpen={showCreateEvent}
        onClose={() => setShowCreateEvent(false)}
        groupId={id}
        groupName={group?.name}
        activityType={group?.activity_type}
        onCreated={(eventId) => { setShowCreateEvent(false); navigate(`/events/${eventId}`) }}
      />
      <CreateEventModal
        isOpen={!!pollToConvert}
        onClose={() => setPollToConvert(null)}
        groupId={id}
        groupName={group?.name}
        activityType={pollToConvert?.activity_type || group?.activity_type}
        initialTitle={pollToConvert?.activity_name}
        onCreated={(eventId) => {
          if (pollToConvert) groupsApi.closePoll(pollToConvert.id, user?.id).catch(() => {})
          setPollToConvert(null)
          navigate(`/events/${eventId}`)
        }}
      />
      <CreatePollModal
        isOpen={showCreatePoll}
        onClose={() => setShowCreatePoll(false)}
        groupId={parseInt(id)}
        onCreated={(poll) => {
          setPolls(prev => [poll, ...prev])
          setShowCreatePoll(false)
        }}
      />
    </AppShell>
  )
}
