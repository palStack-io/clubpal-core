import Card from '../ui/Card'

function timeAgo(dt) {
  try {
    const diff = Date.now() - new Date(dt).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d`
    return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return '' }
}

function initials(str = '') {
  return str.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '?'
}

const TYPE_CONFIG = {
  comment: {
    icon: null, // uses initials avatar
    bgColor: 'var(--s4)',
    borderColor: 'var(--glass)',
    verb: 'commented',
  },
  poll: {
    icon: '🗳️',
    bgColor: 'var(--rose-glow)',
    borderColor: 'var(--rose-border)',
    verb: 'new poll',
  },
  event: {
    icon: '📅',
    bgColor: 'rgba(99,102,241,0.1)',
    borderColor: 'rgba(99,102,241,0.2)',
    verb: 'new event',
  },
}

function FeedItem({ item, index, total }) {
  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.comment
  const isLast = index === total - 1

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      padding: '9px 0',
      borderBottom: isLast ? 'none' : '1px solid var(--glass)',
    }}>
      {/* Icon / avatar */}
      <div style={{
        width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
        background: cfg.bgColor, border: `1px solid ${cfg.borderColor}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: cfg.icon ? '14px' : '11px',
        fontWeight: 700, color: cfg.icon ? undefined : 'var(--t2)',
      }}>
        {cfg.icon || initials(item.actor || item.groupName)}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', lineHeight: '1.45', color: 'var(--t2)' }}>
          <span style={{ fontWeight: 700, color: 'var(--t1)' }}>{item.groupName}</span>
          {item.type === 'comment' && (
            <span style={{ color: 'var(--t3)' }}>
              {' — '}
              {item.content?.length > 55 ? item.content.slice(0, 55) + '…' : item.content}
            </span>
          )}
          {item.type === 'poll' && (
            <span style={{ color: 'var(--t3)' }}>
              {' · '}🗳️ New poll: <em style={{ fontStyle: 'normal', color: 'var(--rose-soft)' }}>{item.content}</em>
            </span>
          )}
          {item.type === 'event' && (
            <span style={{ color: 'var(--t3)' }}>
              {' · '}📅 {item.content}
            </span>
          )}
        </div>
      </div>

      {/* Time */}
      <div style={{
        fontSize: '10px', color: 'var(--t4)',
        flexShrink: 0, marginTop: '2px', whiteSpace: 'nowrap',
      }}>
        {timeAgo(item.created_at)}
      </div>
    </div>
  )
}

function SkeletonItem() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0' }}>
      <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: 'var(--s3)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: '11px', width: '70%', borderRadius: '5px', background: 'var(--s3)', marginBottom: '5px' }} />
        <div style={{ height: '10px', width: '45%', borderRadius: '5px', background: 'var(--s4)' }} />
      </div>
      <div style={{ width: '22px', height: '10px', borderRadius: '4px', background: 'var(--s4)', flexShrink: 0 }} />
    </div>
  )
}

export default function ActivityFeedCard({ items = [], loading = false }) {
  return (
    <Card>
      <Card.Header
        title="Activity"
        action={
          items.length > 0 && (
            <span style={{ fontSize: '10px', color: 'var(--t4)' }}>
              {items.length} recent
            </span>
          )
        }
      />
      <Card.Body>
        {loading ? (
          <div>
            {[0, 1, 2, 3].map(i => <SkeletonItem key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '20px 0',
            color: 'var(--t3)', fontSize: '12px',
          }}>
            No recent activity yet
          </div>
        ) : (
          <div>
            {items.map((item, i) => (
              <FeedItem
                key={`${item.type}-${item.id}-${i}`}
                item={item}
                index={i}
                total={items.length}
              />
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
