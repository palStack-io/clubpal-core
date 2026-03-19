import { useState, useRef, useEffect } from 'react'
import Card from '../ui/Card'
import Avatar from '../ui/Avatar'

function ContextMenu({ member, onRoleChange, onRemove, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        top: 'calc(100% + 8px)',
        background: 'var(--s1)',
        border: '1px solid var(--glass)',
        borderRadius: '10px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        zIndex: 30,
        minWidth: '160px',
        overflow: 'hidden',
      }}
    >
      {/* Name header */}
      <div style={{ padding: '8px 14px 6px', fontSize: '12px', fontWeight: 700, color: 'var(--t1)', borderBottom: '1px solid var(--glass)' }}>
        {member.full_name || member.username || 'Unknown'}
      </div>
      {member.role === 'member' && (
        <button
          onClick={() => { onRoleChange(member.user_id, 'admin'); onClose() }}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '12px', fontWeight: 500, color: 'var(--t2)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--glass)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          Make Admin
        </button>
      )}
      {member.role === 'admin' && (
        <button
          onClick={() => { onRoleChange(member.user_id, 'member'); onClose() }}
          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '12px', fontWeight: 500, color: 'var(--t2)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--glass)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          Make Member
        </button>
      )}
      <div style={{ height: '1px', background: 'var(--glass)' }} />
      <button
        onClick={() => { onRemove(member.user_id); onClose() }}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: '12px', fontWeight: 500, color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer' }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.06)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        Remove from group
      </button>
    </div>
  )
}

function MemberBubble({ member, isCurrent, isCurrentUser, canManage, onRoleChange, onRemove, turnPosition, hasRotation }) {
  const [menuOpen, setMenuOpen] = useState(false)
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
        onClick={canManage && !isCurrentUser ? () => setMenuOpen(v => !v) : undefined}
        style={{
          position: 'relative',
          padding: '3px',
          borderRadius: '50%',
          border: 'none',
          cursor: canManage && !isCurrentUser ? 'pointer' : 'default',
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

      {/* Context menu for admins */}
      {menuOpen && canManage && !isCurrentUser && (
        <ContextMenu
          member={member}
          onRoleChange={onRoleChange}
          onRemove={onRemove}
          onClose={() => setMenuOpen(false)}
        />
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
                canManage={canManage}
                onRoleChange={onRoleChange}
                onRemove={onRemove}
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
  )
}
