import { useState, useEffect } from 'react'
import AppShell from '../../components/shell/AppShell'
import PageHero from '../../components/shell/PageHero'
import Avatar from '../../components/ui/Avatar'
import { groupsApi } from '../../api/groups'
import { ratingsClient, gatewayClient } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

const MEDALS = ['🥇', '🥈', '🥉']

function StatBar({ value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ height: '4px', background: 'var(--s4)', borderRadius: '2px', overflow: 'hidden', flex: 1 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px' }} />
    </div>
  )
}

export default function Leaderboard() {
  const { user } = useAuth()
  const [groups, setGroups] = useState([])
  const [groupId, setGroupId] = useState('')
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    groupsApi.getUserGroups(user.id)
      .then(data => {
        const g = Array.isArray(data) ? data : data?.groups || []
        setGroups(g)
        if (g.length > 0) setGroupId(String(g[0].id))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.id])

  useEffect(() => {
    if (!groupId) return
    ratingsClient.get(`/groups/${groupId}/leaderboard`)
      .then(async r => {
        const raw = Array.isArray(r.data) ? r.data : r.data?.leaderboard || []
        // Enrich each entry with user profile (full_name, avatar_url, username)
        const enriched = await Promise.all(raw.map(entry =>
          gatewayClient.get(`/users/${entry.user_id}/profile`)
            .then(pr => ({ ...entry, ...pr.data }))
            .catch(() => entry)
        ))
        setEntries(enriched)
      })
      .catch(() => setEntries([]))
  }, [groupId])

  const selectedGroup = groups.find(g => String(g.id) === groupId)
  const maxHosted = Math.max(...entries.map(e => e.total_hosted_events || 0), 1)
  const maxRatings = Math.max(...entries.map(e => e.total_ratings || 0), 1)
  const topScore = entries[0] ? Number(entries[0].average_score || 0).toFixed(1) : '—'

  const stats = [
    { label: 'Members',   value: loading ? '—' : entries.length },
    { label: 'Top Score', value: loading ? '—' : topScore },
    { label: 'Groups',    value: loading ? '—' : groups.length },
  ]

  return (
    <AppShell activeRoute="/leaderboard">
      <PageHero
        label="Leaderboard"
        title={selectedGroup ? `${selectedGroup.name}` : 'Rankings'}
        subtitle="Who's picking the best outings?"
        hasStats
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

      {/* Sticky filter bar — group selector */}
      {groups.length > 1 && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            padding: '10px 20px',
            background: 'var(--bg)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--glass)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t3)', flexShrink: 0 }}>Group</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '2px' }}>
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setGroupId(String(g.id))}
                style={{
                  padding: '5px 12px',
                  borderRadius: '100px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: `1px solid ${String(g.id) === groupId ? 'rgba(244,63,94,0.22)' : 'var(--glass)'}`,
                  background: String(g.id) === groupId ? 'rgba(244,63,94,0.15)' : 'var(--s3)',
                  color: String(g.id) === groupId ? 'var(--rose-soft)' : 'var(--t3)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rankings */}
      <div style={{ padding: '20px 24px 24px' }}>
        <div
          style={{
            background: 'var(--s2)',
            border: '1px solid var(--glass)',
            borderRadius: '16px',
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--t3)' }}>Loading…</div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 32px', color: 'var(--t3)' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>🏆</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t2)' }}>No ratings yet</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>Complete and rate events to appear here</div>
            </div>
          ) : (
            <div>
              {entries.map((entry, i) => {
                const isYou = entry.user_id === user?.id
                return (
                  <div
                    key={entry.user_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '16px 20px',
                      borderBottom: i < entries.length - 1 ? '1px solid var(--glass)' : 'none',
                      background: isYou ? 'rgba(244,63,94,0.04)' : 'transparent',
                    }}
                  >
                    {/* Rank */}
                    <div style={{ width: '32px', textAlign: 'center', flexShrink: 0 }}>
                      {i < 3 ? (
                        <span style={{ fontSize: '20px' }}>{MEDALS[i]}</span>
                      ) : (
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t4)' }}>#{i + 1}</span>
                      )}
                    </div>

                    <Avatar user={{ full_name: entry.full_name, avatar_url: entry.avatar_url }} size="md" />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t1)' }}>
                          {entry.full_name || entry.username}
                        </span>
                        {isYou && (
                          <span style={{ fontSize: '10px', color: 'var(--rose-soft)', fontWeight: 600 }}>you</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--t4)', width: '60px' }}>Hosted</span>
                          <StatBar value={entry.total_hosted_events || 0} max={maxHosted} color="var(--rose)" />
                          <span style={{ fontSize: '11px', color: 'var(--t2)', fontWeight: 600, width: '20px', textAlign: 'right' }}>{entry.total_hosted_events || 0}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--t4)', width: '60px' }}>Avg Score</span>
                          <StatBar value={entry.average_score || 0} max={10} color="var(--amber)" />
                          <span style={{ fontSize: '11px', color: 'var(--t2)', fontWeight: 600, width: '20px', textAlign: 'right' }}>
                            {entry.average_score ? Number(entry.average_score).toFixed(1) : '—'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--t4)', width: '60px' }}>Ratings</span>
                          <StatBar value={entry.total_ratings || 0} max={maxRatings} color="var(--blue)" />
                          <span style={{ fontSize: '11px', color: 'var(--t2)', fontWeight: 600, width: '20px', textAlign: 'right' }}>{entry.total_ratings || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
