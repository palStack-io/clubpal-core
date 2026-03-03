import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { CheckBadgeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import { ratingsApi } from '../../api/ratings'
import { eventsApi } from '../../api/events'
import { groupsApi } from '../../api/groups'
import AppShell from '../../components/shell/AppShell'
import Topbar from '../../components/shell/Topbar'
import Card, { CardHeader } from '../../components/ui/Card'
import Avatar from '../../components/ui/Avatar'
import { StarDisplay } from '../../components/ui/StarRating'

export default function Profile() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [ratings, setRatings] = useState([])
  const [groupCount, setGroupCount] = useState(0)
  const [hostCount, setHostCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      ratingsApi.getUserStats(user.id),
      ratingsApi.getUserRatings(user.id),
      groupsApi.getUserGroups(user.id),
      eventsApi.getUserHosting(user.id),
    ]).then(([s, r, g, h]) => {
      setStats(s)
      setRatings((r || []).slice(0, 5))
      setGroupCount((Array.isArray(g) ? g : g?.groups || []).length)
      setHostCount((Array.isArray(h) ? h : h?.events || []).length)
    }).catch(console.error).finally(() => setLoading(false))
  }, [user.id])

  return (
    <AppShell activeRoute="/profile">
      <Topbar title="Profile" />

      <div style={{ padding: '24px', maxWidth: '700px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: '80px', borderRadius: '14px', background: 'var(--s2)', border: '1px solid var(--glass)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Profile card */}
            <Card padding>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Avatar user={user} size="lg" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)', marginBottom: '2px' }}>
                    {user?.full_name || user?.username}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '4px' }}>
                    @{user?.username} · {user?.email}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {user?.email_verified ? (
                      <>
                        <CheckBadgeIcon style={{ width: '14px', height: '14px', color: 'var(--green)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--green)' }}>Email verified</span>
                      </>
                    ) : (
                      <>
                        <ExclamationTriangleIcon style={{ width: '14px', height: '14px', color: 'var(--amber)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--amber)' }}>Email not verified</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {user?.created_at && (
                <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--glass)', fontSize: '12px', color: 'var(--t4)' }}>
                  Member since {format(new Date(user.created_at), 'MMMM yyyy')}
                </div>
              )}
            </Card>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {[
                { label: 'Groups', value: groupCount },
                { label: 'Events Hosted', value: hostCount },
                { label: 'Avg Rating', value: stats?.average_score ? stats.average_score.toFixed(1) : '—' },
                { label: 'Ratings', value: stats?.total_ratings || 0 },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    background: 'var(--s2)',
                    border: '1px solid var(--glass)',
                    borderRadius: '14px',
                    padding: '16px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--t1)', marginBottom: '4px' }}>{value}</div>
                  <div style={{ fontSize: '11px', color: 'var(--t3)', fontWeight: 600 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Recent ratings */}
            {ratings.length > 0 && (
              <Card>
                <Card.Header title="Recent Ratings Received" />
                <Card.Body>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {ratings.map(r => (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <Avatar user={{ full_name: r.rater_full_name, username: r.rater_username }} size="sm" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)' }}>
                              {r.rater_full_name || r.rater_username || `User #${r.rater_user_id}`}
                            </span>
                            <StarDisplay score={r.score} size="sm" />
                          </div>
                          {r.comment && (
                            <p style={{ fontSize: '13px', color: 'var(--t2)', margin: '0 0 2px' }}>{r.comment}</p>
                          )}
                          <p style={{ fontSize: '11px', color: 'var(--t4)', margin: 0 }}>
                            {r.created_at ? format(new Date(r.created_at), 'MMM d, yyyy') : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }`}</style>
    </AppShell>
  )
}
