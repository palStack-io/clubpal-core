import { useState, useEffect } from 'react'
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
        label="My Groups"
        title={loading ? 'My Groups' : `${groups.length} Group${groups.length !== 1 ? 's' : ''}`}
        subtitle="Manage your clubs and rotations"
        hasStats
      >
        <Button variant="ghost" size="sm" onClick={() => navigate('/groups/join')}>🔗 Join</Button>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ New</Button>
      </PageHero>

      {/* Floating stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          padding: '0 20px',
          transform: 'translateY(-28px)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {stats.map(stat => (
          <div
            key={stat.label}
            style={{
              background: 'var(--s2)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '14px',
              padding: '14px 10px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--t1)', letterSpacing: '-1px', lineHeight: 1 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '5px' }}>
              {stat.label}
            </div>
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
          marginTop: '-8px',
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
              {groups.length === 0 ? 'No groups yet' : 'No groups in this category'}
            </div>
            <div style={{ fontSize: '13px', marginBottom: '16px' }}>
              {groups.length === 0 ? 'Create your first group to get started!' : 'Try a different filter'}
            </div>
            {groups.length === 0 && (
              <Button variant="primary" onClick={() => setShowCreate(true)}>Create a Group</Button>
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

      <CreateGroupModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(groupId) => { setShowCreate(false); navigate(`/groups/${groupId}`) }}
      />
    </AppShell>
  )
}
