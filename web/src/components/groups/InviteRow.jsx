import Avatar from '../ui/Avatar'
import StatusChip from '../ui/StatusChip'

export default function InviteRow({ invite, onRemove }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
        padding: '9px 12px',
        background: 'var(--s3)',
        borderRadius: '10px',
        border: '1px solid var(--glass)',
        marginBottom: '6px',
      }}
    >
      <Avatar
        user={{ full_name: invite.email.split('@')[0] }}
        size="sm"
      />
      <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'var(--t1)' }}>
        {invite.email}
      </span>
      <StatusChip variant={invite.status === 'accepted' ? 'going' : 'pending'}>
        {invite.status === 'accepted' ? 'Accepted' : 'Pending'}
      </StatusChip>
      {onRemove && (
        <button
          onClick={() => onRemove(invite.email)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t4)', fontSize: '14px', lineHeight: 1 }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
