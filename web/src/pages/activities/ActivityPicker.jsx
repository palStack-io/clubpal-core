import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusIcon } from '@heroicons/react/24/outline'
import { activitiesApi } from '../../api/activities'
import AppShell from '../../components/shell/AppShell'
import Topbar from '../../components/shell/Topbar'
import ActivityPill from '../../components/ui/ActivityPill'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/Toast'

const CATEGORIES = ['All', 'Food & Drink', 'Entertainment', 'Outdoors', 'Games', 'Social']

const CATEGORY_ICONS = {
  'Food & Drink': '🍽️',
  'Entertainment': '🎬',
  'Outdoors': '🌿',
  'Games': '🎮',
  'Social': '💬',
}

export default function ActivityPicker() {
  const navigate = useNavigate()
  const toast = useToast()
  const [activities, setActivities] = useState([])
  const [popular, setPopular] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  useEffect(() => {
    Promise.all([activitiesApi.getAll(), activitiesApi.getPopular()])
      .then(([all, pop]) => {
        setActivities(all || [])
        setPopular((pop || []).map(a => a.id))
      })
      .catch(() => toast.error('We couldn\'t load activities. Refresh and try again.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = activities.filter(a => {
    const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase())
    const matchesCat = category === 'All' || a.category === category
    return matchesSearch && matchesCat
  })

  return (
    <AppShell activeRoute="/activities">
      <Topbar title="Activities" showSearch onSearch={q => setSearch(q)} />

      <div style={{ padding: '24px' }}>
        {/* Category pills */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <ActivityPill
              key={cat}
              label={cat !== 'All' && CATEGORY_ICONS[cat] ? `${CATEGORY_ICONS[cat]} ${cat}` : cat}
              active={category === cat}
              onClick={() => setCategory(cat)}
            />
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ height: '120px', borderRadius: '14px', background: 'var(--s2)', border: '1px solid var(--glass)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 32px', color: 'var(--t3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✨</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t2)' }}>Nothing matched. Try a different search.</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Try a different search or category</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            {filtered.map(activity => (
              <div
                key={activity.id}
                style={{
                  background: 'var(--s2)',
                  border: '1px solid var(--glass)',
                  borderRadius: '14px',
                  padding: '18px',
                  transition: 'border-color 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--rose-border)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--glass)'}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '24px', flexShrink: 0 }}>
                    {CATEGORY_ICONS[activity.category] || '✨'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {activity.name}
                      </span>
                      {popular.includes(activity.id) && (
                        <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--rose-soft)', background: 'rgba(244,63,94,0.1)', padding: '2px 6px', borderRadius: '100px', whiteSpace: 'nowrap' }}>
                          Popular
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t3)', background: 'var(--s3)', padding: '2px 8px', borderRadius: '100px' }}>
                      {activity.category}
                    </span>
                  </div>
                </div>
                {activity.description && (
                  <p style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '12px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {activity.description}
                  </p>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  style={{ width: '100%' }}
                  onClick={() => navigate(`/events/new?activityId=${activity.id}`)}
                >
                  <PlusIcon style={{ width: '14px', height: '14px', marginRight: '4px' }} />
                  Create Event
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }`}</style>
    </AppShell>
  )
}
