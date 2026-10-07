import { useState, useEffect } from 'react'
import AppShell from '../components/shell/AppShell'
import StatsHero from '../components/stats/StatsHero'
import KpiCard from '../components/stats/KpiCard'
import ActivityDonutCard from '../components/stats/ActivityDonutCard'
import MonthlyBarCard from '../components/stats/MonthlyBarCard'
import AchievementsCard from '../components/stats/AchievementsCard'
import { eventsApi } from '../api/events'
import { groupsApi } from '../api/groups'
import { ratingsClient } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function Stats() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [groups, setGroups] = useState([])
  const [avgRating, setAvgRating] = useState('—')
  const [loading, setLoading] = useState(true)

  const year = new Date().getFullYear()

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      eventsApi.getUserEvents(user.id).catch(() => []),
      groupsApi.getUserGroups(user.id).catch(() => []),
      ratingsClient.get(`/users/${user.id}/stats`).then(r => r.data).catch(() => null),
    ]).then(([evs, grps, ratingStats]) => {
      setEvents(Array.isArray(evs) ? evs : evs?.events || [])
      setGroups(Array.isArray(grps) ? grps : grps?.groups || [])
      if (ratingStats?.average_score) {
        setAvgRating(Number(ratingStats.average_score).toFixed(1))
      }
    }).finally(() => setLoading(false))
  }, [user?.id])

  const now = new Date()
  const effectiveStatus = (e) => {
    if (e.status === 'scheduled' || e.status === 'in_progress') {
      const d = e.scheduled_date || e.event_date
      if (d && new Date(d) < now) return 'completed'
    }
    return e.status
  }
  const completed = events.filter(e => effectiveStatus(e) === 'completed')
  const thisYear = completed.filter(e => {
    const d = e.event_date || e.scheduled_date
    return d && new Date(d).getFullYear() === year
  })

  // Activity breakdown
  const breakdown = Object.entries(
    thisYear.reduce((acc, e) => {
      const type = e.activity_type?.toLowerCase() || 'dining'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})
  ).map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  // Monthly breakdown
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const count = thisYear.filter(e => {
      const d = e.event_date || e.scheduled_date
      return d && new Date(d).getMonth() === i
    }).length
    return { month: i + 1, count }
  })

  // Picks made = events where user was host
  const picksCount = thisYear.filter(e => String(e.host_user_id) === String(user?.id)).length

  return (
    <AppShell activeRoute="/stats">
      {/* Hero — no topbar, spans full width */}
      <StatsHero
        user={user}
        year={year}
        totalEvents={thisYear.length}
        groupCount={groups.length}
      />

      {/* KPI row — lifted */}
      <div className="cp-floating-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <KpiCard value={thisYear.length} label="Total Events" />
        <KpiCard value={avgRating} label="Avg Rating" />
        <KpiCard value={picksCount} label="Picks Made" />
        <KpiCard value={groups.length} label="Groups" />
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <ActivityDonutCard breakdown={breakdown} />
          <MonthlyBarCard monthly={monthly} />
        </div>
        <AchievementsCard unlockedIds={[
          ...(thisYear.length >= 1 ? ['first_pick'] : []),
          ...(groups.length >= 3 ? ['social_butterfly'] : []),
          ...(completed.length >= 10 ? ['critic'] : []),
          ...(picksCount >= 5 ? ['host_5'] : []),
        ]} />
      </div>
    </AppShell>
  )
}
