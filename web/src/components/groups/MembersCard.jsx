import { useState, useRef, useEffect } from 'react'
import Card from '../ui/Card'
import Avatar from '../ui/Avatar'

function RoleBadge({ role }) {
  if (role === 'owner') {
    return (
      <span
        style={{
          background: 'var(--rose)',
          color: '#fff',
          fontSize: '10px',
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: '100px',
        }}
      >
        Owner
      </span>
    )
  }
  if (role === 'admin') {
    return (
      <span
        style={{
          background: 'rgba(245,158,11,0.12)',
          color: '#f59e0b',
          border: '1px solid rgba(245,158,11,0.25)',
          fontSize: '10px',
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: '100px',
        }}
      >
        Admin
      </span>
    )
  }
  return null
}

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
        right: 0,
        top: '32px',
        background: 'var(--s1)',
        border: '1px solid var(--glass)',
        borderRadius: '10px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        zIndex: 20,
        minWidth: '160px',
        overflow: 'hidden',
      }}
    >
      {member.role === 'member' && (
        <button
          onClick={() => { onRoleChange(member.user_id, 'admin'); onClose() }}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '10px 14px',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--t2)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--glass)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          Make Admin
        </button>
      )}
      {member.role === 'admin' && (
        <button
          onClick={() => { onRoleChange(member.user_id, 'member'); onClose() }}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '10px 14px',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--t2)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--glass)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          Make Member
        </button>
      )}

      <div style={{ height: '1px', background: 'var(--glass)', margin: '0' }} />

      <button
        onClick={() => { onRemove(member.user_id); onClose() }}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '10px 14px',
          fontSize: '12px',
          fontWeight: 500,
          color: '#f87171',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.06)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        Remove from group
      </button>
    </div>
  )
}

function MemberRow({ member, canManage, currentUserId, onRoleChange, onRemove }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isCurrentUser = member.user_id === currentUserId

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        position: 'relative',
      }}
    >
      {/* Avatar */}
      <Avatar
        user={{ full_name: member.full_name, username: member.username, avatar_url: member.avatar_url }}
        size="md"
      />

      {/* Info block */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--t1)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {member.full_name || member.username || 'Unknown'}
          {isCurrentUser && (
            <span style={{ fontSize: '10px', color: 'var(--t3)', fontWeight: 500, marginLeft: '6px' }}>
              (you)
            </span>
          )}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '1px', textTransform: 'capitalize' }}>
          {member.role || 'member'}
        </div>
      </div>

      {/* Role badge */}
      {(member.role === 'owner' || member.role === 'admin') && (
        <RoleBadge role={member.role} />
      )}

      {/* Context menu trigger */}
      {canManage && !isCurrentUser && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            style={{
              width: '28px',
              height: '28px',
              background: 'var(--s3)',
              border: '1px solid var(--glass)',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              color: 'var(--t3)',
              flexShrink: 0,
            }}
          >
            ⋯
          </button>
          {menuOpen && (
            <ContextMenu
              member={member}
              onRoleChange={onRoleChange}
              onRemove={onRemove}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function PendingInviteRow({ email }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        opacity: 0.45,
      }}
    >
      <div
        style={{
          width: '30px', height: '30px', borderRadius: '50%',
          background: 'var(--s4)', border: '1px dashed var(--t4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', flexShrink: 0,
        }}
      >
        ✉️
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px', fontWeight: 600, color: 'var(--t2)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {email}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '1px' }}>
          Invite pending
        </div>
      </div>
      <span
        style={{
          fontSize: '10px', fontWeight: 600, color: 'var(--t4)',
          background: 'var(--s4)', borderRadius: '6px', padding: '2px 7px',
        }}
      >
        ⏳ Awaiting
      </span>
    </div>
  )
}

export default function MembersCard({ members = [], pendingInvites = [], canManage, currentUserId, onRoleChange, onRemove, onInvite }) {
  const totalCount = members.length + pendingInvites.length
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
      <Card.Header title={`Members (${totalCount})`} action={headerAction} />
      <Card.Body style={{ overflow: 'visible' }}>
        {members.length === 0 && pendingInvites.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--t3)', textAlign: 'center', padding: '16px' }}>
            No members yet
          </div>
        ) : (
          <div>
            {members.map((member, i) => (
              <div
                key={member.user_id}
                style={(i === members.length - 1 && pendingInvites.length === 0) ? { borderBottom: 'none' } : {}}
              >
                <MemberRow
                  member={member}
                  canManage={canManage}
                  currentUserId={currentUserId}
                  onRoleChange={onRoleChange}
                  onRemove={onRemove}
                />
              </div>
            ))}
            {pendingInvites.map((inv, i) => (
              <div
                key={inv.email}
                style={i === pendingInvites.length - 1 ? { borderBottom: 'none' } : {}}
              >
                <PendingInviteRow email={inv.email} />
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
