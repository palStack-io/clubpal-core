import { useState } from 'react'
import Card from '../ui/Card'
import Avatar from '../ui/Avatar'
import UserStatsModal from '../ui/UserStatsModal'

// kept for dead-code removal — replaced by UserStatsModal
function MemberStatsPopup({ member, canManage, onRoleChange, onRemove, onClose }) {
  const [stats, setStats] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    ratingsClient.get(`/users/${member.user_id}/stats`)
      .then(r => setStats(r.data))
      .catch(() => {})
  }, [member.user_id])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const avg = stats?.average_score ?? stats?.avg_score ?? null
  const total = stats?.total_ratings ?? stats?.ratings_count ?? 0
  const vibe = avg != null && total > 0 ? vibeLabel(avg) : null
  const roleBadge = member.role === 'owner' ? { text: 'Owner', color: 'var(--rose)' }
    : member.role === 'admin' ? { text: 'Admin', color: 'var(--amber)' }
    : null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onMouseDown={onClose}
    >
      <div
        ref={ref}
        onMouseDown={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '400px',
          background: 'var(--s2)', border: '1px solid var(--glass)',
          borderRadius: '20px', padding: '24px',
        }}
      >

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div style={{ borderRadius: '50%', border: '2.5px solid var(--rose-border)', padding: '3px' }}>
            <Avatar user={member} size="lg" style={{ width: '52px', height: '52px' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.4px' }}>
              {member.full_name || member.username || 'Member'}
            </div>
            {member.username && member.full_name && (
              <div style={{ fontSize: '12px', color: 'var(--t3)', marginTop: '2px' }}>@{member.username}</div>
            )}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
              {roleBadge && (
                <span style={{ fontSize: '10px', fontWeight: 700, color: roleBadge.color, background: `color-mix(in srgb, ${roleBadge.color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${roleBadge.color} 35%, transparent)`, borderRadius: '99px', padding: '2px 8px' }}>
                  {roleBadge.text}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%', background: 'var(--s4)', border: '1px solid var(--glass)', color: 'var(--t3)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}
          >×</button>
        </div>

        {/* Stats tiles */}
        {!stats ? (
          <div style={{ fontSize: '12px', color: 'var(--t4)', textAlign: 'center', padding: '12px 0' }}>Loading…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '10px', marginBottom: canManage ? '16px' : '0' }}>
            <div style={{ background: 'var(--s3)', borderRadius: '14px', padding: '14px', textAlign: 'center', border: '1px solid var(--glass)' }}>
              <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--t1)', letterSpacing: '-0.5px' }}>
                {avg != null ? avg.toFixed(1) : '—'}
              </div>
              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '4px' }}>Avg ★</div>
            </div>
            <div style={{ background: 'var(--s3)', borderRadius: '14px', padding: '14px', textAlign: 'center', border: '1px solid var(--glass)' }}>
              <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--t1)', letterSpacing: '-0.5px' }}>{total}</div>
              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '4px' }}>Rated</div>
            </div>
            <div style={{ background: 'var(--s3)', borderRadius: '14px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--glass)' }}>
              {vibe ? (
                <span style={{ fontSize: '12px', fontWeight: 800, color: vibe.color, textAlign: 'center', lineHeight: 1.3 }}>{vibe.label}</span>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--t4)', textAlign: 'center' }}>No ratings yet</span>
              )}
            </div>
          </div>
        )}

        {/* Admin actions */}
        {canManage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => { onRoleChange(member.user_id, member.role === 'admin' ? 'member' : 'admin'); onClose() }}
              style={{ width: '100%', padding: '11px', borderRadius: '12px', background: 'var(--s3)', border: '1px solid var(--glass)', color: 'var(--t2)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
            >
              {member.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
            </button>
            <button
              onClick={() => { onRemove(member.user_id); onClose() }}
              style={{ width: '100%', padding: '11px', borderRadius: '12px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
            >
              Remove from Club
            </button>
          </div>
        )}
      </div>
    </div>
  )
}


function MemberBubble({ member, isCurrent, isCurrentUser, onShowStats, turnPosition, hasRotation }) {
  const [hovered, setHovered] = useState(false)

  const displayName = member.full_name || member.username || '?'
  const roleBadge = member.role === 'owner' ? 'Owner' : member.role === 'admin' ? 'Admin' : null

  return (
    <div
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar ring */}
      <button
        type="button"
        onClick={() => onShowStats(member)}
        style={{
          position: 'relative',
          padding: '3px',
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          background: isCurrent
            ? 'linear-gradient(135deg, var(--rose), var(--rose-soft))'
            : 'transparent',
          boxShadow: isCurrent
            ? '0 0 12px rgba(244,63,94,0.5), 0 0 24px rgba(244,63,94,0.2)'
            : 'none',
          transition: 'box-shadow 0.2s, background 0.2s',
        }}
      >
        <div style={{
          borderRadius: '50%',
          border: isCurrent ? '2px solid var(--s2)' : '2px solid transparent',
          overflow: 'hidden',
        }}>
          <Avatar
            user={{ full_name: member.full_name, username: member.username, avatar_url: member.avatar_url }}
            size="lg"
            style={{ width: '40px', height: '40px', fontSize: '14px' }}
          />
        </div>

        {/* Turn position badge */}
        {hasRotation && turnPosition != null && (
          <div style={{
            position: 'absolute',
            bottom: '-2px',
            right: '-2px',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: isCurrent ? 'var(--rose)' : 'var(--s4)',
            border: '2px solid var(--s2)',
            color: isCurrent ? '#fff' : 'var(--t3)',
            fontSize: '9px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {turnPosition}
          </div>
        )}
      </button>

      {/* Tooltip on hover */}
      {hovered && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--s1)',
          border: '1px solid var(--glass)',
          borderRadius: '8px',
          padding: '6px 10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          zIndex: 20,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t1)' }}>
            {displayName}
            {isCurrentUser && <span style={{ fontWeight: 500, color: 'var(--t3)' }}> (you)</span>}
          </span>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {roleBadge && (
              <span style={{
                fontSize: '9px',
                fontWeight: 700,
                color: member.role === 'owner' ? '#fff' : '#f59e0b',
                background: member.role === 'owner' ? 'var(--rose)' : 'rgba(245,158,11,0.12)',
                borderRadius: '100px',
                padding: '1px 6px',
              }}>
                {roleBadge}
              </span>
            )}
            {isCurrent && (
              <span style={{
                fontSize: '9px',
                fontWeight: 700,
                color: 'var(--rose-soft)',
                background: 'rgba(244,63,94,0.12)',
                borderRadius: '100px',
                padding: '1px 6px',
              }}>
                Their turn
              </span>
            )}
          </div>
          {/* Tooltip arrow */}
          <div style={{
            position: 'absolute',
            bottom: '-4px',
            left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
            width: '8px',
            height: '8px',
            background: 'var(--s1)',
            borderRight: '1px solid var(--glass)',
            borderBottom: '1px solid var(--glass)',
          }} />
        </div>
      )}

    </div>
  )
}

function PendingInviteBubble({ email }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        width: '40px', height: '40px', borderRadius: '50%',
        background: 'var(--s3)',
        border: '2px dashed var(--t4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '16px',
        opacity: 0.5,
      }}>
        ✉️
      </div>
      {hovered && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--s1)',
          border: '1px solid var(--glass)',
          borderRadius: '8px',
          padding: '6px 10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          zIndex: 20,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t2)' }}>{email}</span>
          <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--t4)' }}>Invite pending</span>
          <div style={{
            position: 'absolute',
            bottom: '-4px',
            left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
            width: '8px',
            height: '8px',
            background: 'var(--s1)',
            borderRight: '1px solid var(--glass)',
            borderBottom: '1px solid var(--glass)',
          }} />
        </div>
      )}
    </div>
  )
}

export default function MembersCard({ members = [], pendingInvites = [], canManage, currentUserId, onRoleChange, onRemove, onInvite, rotation, rotationType }) {
  const totalCount = members.length + pendingInvites.length
  const [selectedMember, setSelectedMember] = useState(null)
  const isManual = rotationType === 'none'
  const hasRotation = !isManual && !!(rotation?.current_user_id)

  // Sort by rotation_order when rotation is active
  const sortedMembers = hasRotation
    ? [...members].sort((a, b) => (a.rotation_order ?? 9999) - (b.rotation_order ?? 9999))
    : members

  // Assign 1-based positions only to members that have a rotation_order
  const rotationPositions = {}
  if (hasRotation) {
    let pos = 1
    sortedMembers.forEach(m => {
      if (m.rotation_order != null) {
        rotationPositions[m.user_id] = pos++
      }
    })
  }

  const headerAction = (
    <button
      onClick={onInvite}
      style={{
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--rose-soft)',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: '6px',
      }}
    >
      + Invite
    </button>
  )

  return (
    <>
    <Card style={{ overflow: 'visible' }}>
      <Card.Header
        title={`Members (${totalCount})`}
        action={headerAction}
      />
      {hasRotation && (
        <div style={{ padding: '4px 16px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            🔄 Turn order active
          </span>
        </div>
      )}
      <Card.Body style={{ overflow: 'visible' }}>
        {sortedMembers.length === 0 && pendingInvites.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--t3)', textAlign: 'center', padding: '16px' }}>
            No members yet
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'center',
            padding: '8px 0',
          }}>
            {sortedMembers.map(member => (
              <MemberBubble
                key={member.user_id}
                member={member}
                isCurrent={hasRotation && member.user_id === rotation.current_user_id}
                isCurrentUser={member.user_id === currentUserId}
                onShowStats={setSelectedMember}
                turnPosition={hasRotation ? (rotationPositions[member.user_id] ?? null) : null}
                hasRotation={hasRotation}
              />
            ))}
            {pendingInvites.map(inv => (
              <PendingInviteBubble key={inv.email} email={inv.email} />
            ))}
          </div>
        )}
      </Card.Body>
    </Card>

    {selectedMember && (
      <UserStatsModal
        member={selectedMember}
        canManage={canManage && selectedMember.user_id !== currentUserId}
        onRoleChange={onRoleChange}
        onRemove={onRemove}
        onClose={() => setSelectedMember(null)}
      />
    )}
  </>
  )
}
