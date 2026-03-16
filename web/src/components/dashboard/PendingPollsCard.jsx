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

const RESPOND_OPTS = [
  { value: 'in',           label: "🙌 I'm in",  activeColor: '#22d3a0' },
  { value: 'done_loved',   label: '❤️ Loved it', activeColor: 'var(--rose)' },
  { value: 'done_pass',    label: '👎 Pass',      activeColor: 'var(--amber)' },
  { value: 'cant_make_it', label: "🚫 Can't",    activeColor: 'var(--t3)' },
]

// Poll the user needs to respond to
function PendingPollRow({ poll, onRespond, groupName }) {
  const navigate = useNavigate()
  const chip = deadlineChip(poll.deadline)
  const total = poll.summary?.total_members ?? '?'

  return (
    <div style={{
      borderRadius: '12px', padding: '12px 14px',
      background: 'var(--s3)', border: '1px solid var(--glass)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)', marginBottom: '2px' }}>
            🗳️ {poll.activity_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', color: 'var(--t3)' }}>{groupName}</span>
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
          style={{ fontSize: '11px', fontWeight: 600, color: 'var(--rose)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }}
        >
          View →
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
        {RESPOND_OPTS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onRespond?.(poll.id, opt.value)}
            style={{
              padding: '7px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
              background: 'var(--s4)', border: '1px solid var(--glass)', color: 'var(--t2)',
              cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = opt.activeColor; e.currentTarget.style.color = opt.activeColor }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass)'; e.currentTarget.style.color = 'var(--t2)' }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// Poll the user created — shows response progress
function MyPollRow({ poll, groupName }) {
  const navigate = useNavigate()
  const chip = deadlineChip(poll.deadline)
  const responded = poll.summary?.responded ?? 0
  const total = poll.summary?.total_members ?? 1
  const pct = total > 0 ? Math.round((responded / total) * 100) : 0
  const counts = poll.summary?.counts || {}
  const topResponse = Object.entries(counts).sort((a, b) => b[1] - a[1]).find(([, v]) => v > 0)

  const RESPONSE_LABELS = {
    in: "🙌 I'm in",
    done_loved: '❤️ Loved it',
    done_pass: '👎 Pass',
    cant_make_it: "🚫 Can't",
  }

  return (
    <div style={{
      borderRadius: '12px', padding: '12px 14px',
      background: 'var(--s3)', border: '1px solid rgba(99,102,241,0.2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            <span style={{
              fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px',
              color: 'var(--blue)', background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.2)', borderRadius: '4px', padding: '1px 5px',
            }}>
              Your Poll
            </span>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)', marginBottom: '2px' }}>
            📊 {poll.activity_name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', color: 'var(--t3)' }}>{groupName}</span>
            <span style={{ fontSize: '10px', color: 'var(--t4)' }}>·</span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: responded === total ? '#22d3a0' : 'var(--t2)' }}>
              {responded}/{total} responded
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
          style={{ fontSize: '11px', fontWeight: 600, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }}
        >
          View →
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: '6px' }}>
        <div style={{ height: '5px', background: 'var(--s4)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--blue), rgba(99,102,241,0.6))',
            borderRadius: '3px', transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Top response hint */}
      {topResponse && (
        <div style={{ fontSize: '10px', color: 'var(--t3)' }}>
          Leading: <span style={{ fontWeight: 700, color: 'var(--t2)' }}>{RESPONSE_LABELS[topResponse[0]] || topResponse[0]}</span>
          {' '}({topResponse[1]} vote{topResponse[1] !== 1 ? 's' : ''})
        </div>
      )}
    </div>
  )
}

export default function PendingPollsCard({ polls = [], myPolls = [], groups = [], loading = false, onRespond }) {
  const totalCount = polls.length + myPolls.length

  const getGroupName = (groupId) =>
    groups.find(g => g.id === groupId)?.name || 'Group'

  return (
    <Card>
      <Card.Header
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            💬 Group Polls
            {totalCount > 0 && (
              <span style={{
                fontSize: '11px', fontWeight: 700, color: 'var(--rose-soft)',
                background: 'var(--rose-glow)', borderRadius: '99px', padding: '2px 8px',
              }}>
                {totalCount}
              </span>
            )}
          </span>
        }
        action={
          totalCount > 0
            ? <span style={{ fontSize: '11px', color: 'var(--t3)' }}>
                {polls.length > 0 ? 'Awaiting your vote' : 'Tracking responses'}
              </span>
            : null
        }
      />
      <Card.Body>
        {loading ? (
          <div style={{ color: 'var(--t3)', fontSize: '12px', padding: '8px 0' }}>Loading polls…</div>
        ) : totalCount === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '28px', marginBottom: '6px' }}>💬</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t3)' }}>No active polls</div>
            <div style={{ fontSize: '11px', color: 'var(--t4)', marginTop: '2px' }}>Polls from your groups will appear here</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* My polls first — creator sees status */}
            {myPolls.slice(0, 2).map(poll => (
              <MyPollRow
                key={`mine-${poll.id}`}
                poll={poll}
                groupName={getGroupName(poll.group_id)}
              />
            ))}
            {/* Polls needing response */}
            {polls.slice(0, 3).map(poll => (
              <PendingPollRow
                key={`pending-${poll.id}`}
                poll={poll}
                groupName={getGroupName(poll.group_id)}
                onRespond={onRespond}
              />
            ))}
            {(polls.length + myPolls.length) > 5 && (
              <div style={{ fontSize: '11px', color: 'var(--t3)', textAlign: 'center', paddingTop: '4px' }}>
                +{(polls.length + myPolls.length) - 5} more across your groups
              </div>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
