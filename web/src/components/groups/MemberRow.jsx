import Avatar from '../ui/Avatar'

const roleBg = {
  owner: 'rgba(244,63,94,0.15)',
  admin: 'rgba(245,158,11,0.1)',
  member: 'rgba(255,255,255,0.06)',
}
const roleText = {
  owner: 'var(--rose-soft)',
  admin: 'var(--amber)',
  member: 'var(--t3)',
}
const roleBorder = {
  owner: 'rgba(244,63,94,0.22)',
  admin: 'rgba(245,158,11,0.2)',
  member: 'var(--glass)',
}

export default function MemberRow({ member, canManage, onRoleChange, onRemove }) {
  const role = member.role || 'member'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 0',
        borderBottom: '1px solid var(--glass)',
      }}
    >
      <Avatar user={{ full_name: member.full_name, avatar_url: member.avatar_url }} size="md" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t1)' }}>
          {member.full_name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--t3)' }}>@{member.username}</div>
      </div>

      {/* Role badge */}
      <span
        style={{
          padding: '3px 8px',
          borderRadius: '100px',
          fontSize: '10px',
          fontWeight: 700,
          background: roleBg[role] || roleBg.member,
          color: roleText[role] || roleText.member,
          border: `1px solid ${roleBorder[role] || roleBorder.member}`,
        }}
      >
        {role}
      </span>

      {/* Actions */}
      {canManage && role !== 'owner' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={role}
            onChange={e => onRoleChange && onRoleChange(member.user_id, e.target.value)}
            style={{
              fontSize: '11px',
              background: 'var(--s3)',
              border: '1px solid var(--glass)',
              borderRadius: '6px',
              color: 'var(--t2)',
              padding: '3px 6px',
              cursor: 'pointer',
            }}
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </select>
          <button
            onClick={() => onRemove && onRemove(member.user_id)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '11px',
              fontWeight: 600,
              color: '#f87171',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  )
}
