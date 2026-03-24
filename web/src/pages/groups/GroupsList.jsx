import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../components/shell/AppShell'
import PageHero from '../../components/shell/PageHero'
import Button from '../../components/ui/Button'
import ActivityPill from '../../components/ui/ActivityPill'
import GroupCard from '../../components/groups/GroupCard'
import CreateGroupModal from '../../components/modals/CreateGroupModal'
import { groupsApi } from '../../api/groups'
import { useAuth } from '../../contexts/AuthContext'

const PILLS = [
  { id: 'all',    label: 'All' },
  { id: 'dining', label: '🍽️ Dining' },
  { id: 'movies', label: '🎬 Movies' },
  { id: 'books',  label: '📚 Books' },
  { id: 'gaming', label: '🎮 Gaming' },
  { id: 'arts',   label: '🎨 Arts' },
  { id: 'hiking', label: '🥾 Hiking' },
]

function SkeletonCard() {
  return (
    <div style={{ borderRadius: '20px', background: 'var(--s2)', border: '1px solid var(--glass)', overflow: 'hidden' }}>
      <div style={{ height: '140px', background: 'var(--s3)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ padding: '14px 16px' }}>
        {[80, 60, 40].map(w => (
          <div key={w} style={{ height: '10px', width: `${w}%`, background: 'var(--s3)', borderRadius: '5px', marginBottom: '8px', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    </div>
  )
}

export default function GroupsList() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const joinInputRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    groupsApi.getUserGroups(user.id)
      .then(data => setGroups(Array.isArray(data) ? data : data?.groups || []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false))
  }, [user?.id])

  const filtered = filter === 'all'
    ? groups
    : groups.filter(g => g.activity_type?.toLowerCase() === filter)

  // Count per activity for stats
  const activityCounts = PILLS.slice(1).reduce((acc, p) => {
    acc[p.id] = groups.filter(g => g.activity_type?.toLowerCase() === p.id).length
    return acc
  }, {})
  const topActivity = Object.entries(activityCounts).sort((a, b) => b[1] - a[1])[0]

  const stats = [
    { label: 'Total',    value: loading ? '—' : groups.length },
    { label: 'Showing',  value: loading ? '—' : filtered.length },
    { label: 'Top Type', value: loading || !topActivity ? '—' : topActivity[0] },
  ]

  return (
    <AppShell activeRoute="/groups">
      <PageHero
        label="My Clubs"
        title={loading ? 'My Clubs' : `${groups.length} Club${groups.length !== 1 ? 's' : ''}`}
        subtitle="Manage your clubs and rotations"
        hasStats
      >
        <Button variant="ghost" size="sm" onClick={() => { setShowJoin(true); setTimeout(() => joinInputRef.current?.focus(), 80) }}>🔗 Join</Button>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ New</Button>
      </PageHero>

      {/* Floating stats */}
      <div className="cp-floating-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {stats.map(stat => (
          <div key={stat.label} className="cp-stat-tile">
            <div className="cp-stat-tile-value">{stat.value}</div>
            <div className="cp-stat-tile-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Sticky filter bar */}
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
        }}
      >
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '2px' }}>
          {PILLS.map(p => (
            <ActivityPill
              key={p.id}
              label={p.label}
              active={filter === p.id}
              onClick={() => setFilter(p.id)}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px 24px' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 32px', color: 'var(--t3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t2)', marginBottom: '6px' }}>
              {groups.length === 0 ? 'No clubs yet' : 'No clubs in this category'}
            </div>
            <div style={{ fontSize: '13px', marginBottom: '16px' }}>
              {groups.length === 0 ? 'Create your first club to get started!' : 'Try a different filter'}
            </div>
            {groups.length === 0 && (
              <Button variant="primary" onClick={() => setShowCreate(true)}>Create a Club</Button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            {filtered.map(g => (
              <GroupCard key={g.id} group={g} currentUserId={user?.id} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:0.4; } 50% { opacity:0.7; } }
      `}</style>

      {/* Join by code modal */}
      {showJoin && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => { setShowJoin(false); setJoinCode('') }}
        >
          <div
            style={{ width: '100%', maxWidth: '360px', background: 'var(--s2)', border: '1px solid var(--s4)', borderRadius: '20px', padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)', marginBottom: '6px' }}>Join a Club</div>
            <div style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '20px', lineHeight: 1.5 }}>
              Enter the invite code shared by your club admin.
            </div>
            <input
              ref={joinInputRef}
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
              placeholder="e.g. ABC-1234"
              maxLength={10}
              onKeyDown={e => {
                if (e.key === 'Enter' && joinCode.trim().length >= 4) {
                  const code = joinCode.trim()
                  setShowJoin(false); setJoinCode('')
                  navigate(`/join/${code}`)
                }
              }}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--s3)', border: '1px solid var(--rose-border)',
                borderRadius: '12px', padding: '14px 16px',
                fontSize: '22px', fontWeight: 800, color: 'var(--t1)',
                textAlign: 'center', letterSpacing: '4px', outline: 'none',
                marginBottom: '16px',
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { setShowJoin(false); setJoinCode('') }}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', background: 'var(--s3)', border: '1px solid var(--s4)', color: 'var(--t2)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (joinCode.trim().length >= 4) {
                    const code = joinCode.trim()
                    setShowJoin(false); setJoinCode('')
                    navigate(`/join/${code}`)
                  }
                }}
                disabled={joinCode.trim().length < 4}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', background: joinCode.trim().length >= 4 ? 'var(--rose)' : 'var(--s3)', border: 'none', color: joinCode.trim().length >= 4 ? '#fff' : 'var(--t3)', fontWeight: 700, fontSize: '13px', cursor: joinCode.trim().length >= 4 ? 'pointer' : 'default' }}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateGroupModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(groupId) => { setShowCreate(false); navigate(`/groups/${groupId}`) }}
      />
    </AppShell>
  )
}
