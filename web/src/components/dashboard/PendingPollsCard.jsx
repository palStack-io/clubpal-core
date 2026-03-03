import { useNavigate } from 'react-router-dom'
import Card from '../ui/Card'

function deadlineChip(dt) {
  try {
    const diff = new Date(dt).getTime() - Date.now()
    if (diff < 0) return { label: 'Expired', color: 'var(--t4)' }
    const hrs = Math.ceil(diff / 3_600_000)
    if (hrs < 24) return { label: `${hrs}h left`, color: 'var(--amber)' }
    const days = Math.ceil(hrs / 24)
    return { label: `${days}d left`, color: 'var(--t3)' }
  } catch { return null }
}

const OPTS = [
  { value: 'in',           label: '🙌 I\'m in',   activeColor: '#22d3a0' },
  { value: 'done_loved',   label: '❤️ Loved it',  activeColor: 'var(--rose)' },
  { value: 'done_pass',    label: '👎 Pass',       activeColor: 'var(--amber)' },
  { value: 'cant_make_it', label: '🚫 Can\'t',    activeColor: 'var(--t3)' },
]

function PollRow({ poll, onRespond, groupName }) {
  const navigate = useNavigate()
  const chip = deadlineChip(poll.deadline)
  const responded = poll.summary?.total_members ?? '?'
  const total = poll.summary?.total_members ?? '?'

  return (
    <div style={{
      borderRadius: '12px', padding: '12px 14px',
      background: 'var(--s3)', border: '1px solid var(--glass)',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)', marginBottom: '2px' }}>
            🗳️ {poll.activity_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', color: 'var(--t3)' }}>
              {groupName}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--t4)' }}>·</span>
            <span style={{ fontSize: '10px', color: 'var(--t3)' }}>
              {poll.summary?.responded ?? 0}/{total} responded
            </span>
            {chip && (
              <>
                <span style={{ fontSize: '10px', color: 'var(--t4)' }}>·</span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: chip.color }}>{chip.label}</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate(`/groups/${poll.group_id}`)}
          style={{
            fontSize: '11px', fontWeight: 600, color: 'var(--rose)',
            background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0,
          }}
        >
          View →
        </button>
      </div>

      {/* Response buttons 2×2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
        {OPTS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onRespond?.(poll.id, opt.value)}
            style={{
              padding: '7px 8px', borderRadius: '8px',
              fontSize: '11px', fontWeight: 700,
              background: 'var(--s4)', border: '1px solid var(--glass)',
              color: 'var(--t2)', cursor: 'pointer', textAlign: 'left',
              transition: 'border-color 0.12s, color 0.12s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = opt.activeColor
              e.currentTarget.style.color = opt.activeColor
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--glass)'
              e.currentTarget.style.color = 'var(--t2)'
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function PendingPollsCard({ polls = [], groups = [], loading = false, onRespond }) {
  if (!loading && polls.length === 0) return null

  const getGroupName = (groupId) =>
    groups.find(g => g.id === groupId)?.name || 'Group'

  return (
    <Card>
      <Card.Header
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            💬 Group Pulse
            {polls.length > 0 && (
              <span style={{
                fontSize: '11px', fontWeight: 700, color: 'var(--rose-soft)',
                background: 'var(--rose-glow)', borderRadius: '99px', padding: '2px 8px',
              }}>
                {polls.length}
              </span>
            )}
          </span>
        }
        action={
          <span style={{ fontSize: '11px', color: 'var(--t3)' }}>
            Awaiting your vote
          </span>
        }
      />
      <Card.Body>
        {loading ? (
          <div style={{ color: 'var(--t3)', fontSize: '12px', padding: '8px 0' }}>Loading polls…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {polls.slice(0, 3).map(poll => (
              <PollRow
                key={poll.id}
                poll={poll}
                groupName={getGroupName(poll.group_id)}
                onRespond={onRespond}
              />
            ))}
            {polls.length > 3 && (
              <div style={{
                fontSize: '11px', color: 'var(--t3)',
                textAlign: 'center', paddingTop: '4px',
              }}>
                +{polls.length - 3} more poll{polls.length - 3 !== 1 ? 's' : ''} across your groups
              </div>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
