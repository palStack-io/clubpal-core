import { Link, useNavigate } from 'react-router-dom'
import ClubImageCard from './ClubImageCard'
import Card from '../ui/Card'
import Button from '../ui/Button'

export default function MyClubsCard({ groups = [], loading = false, onCreate }) {
  const navigate = useNavigate()

  // Empty state
  if (!loading && groups.length === 0) {
    return (
      <Card>
        <Card.Body>
          <div style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', marginBottom: 4 }}>Every great group starts with one person. Start yours.</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 14 }}>
              Create a group to start planning outings with your people.
            </div>
            <Button variant="primary" size="sm" onClick={onCreate}>+ Create a Group</Button>
          </div>
        </Card.Body>
      </Card>
    )
  }

  // Most-visited first: by visit_count, then most-recently-visited, then default order
  const shown = [...groups]
    .sort((a, b) =>
      (b.visit_count || 0) - (a.visit_count || 0) ||
      new Date(b.last_visited_at || 0) - new Date(a.last_visited_at || 0)
    )
    .slice(0, 4)

  return (
    <div>
      <div className="cp-section-head">
        <div className="cp-section-title">My Groups</div>
        <Link to="/groups" className="cp-section-link">View All Groups ›</Link>
      </div>
      <div className="cp-clubs-grid">
        {loading
          ? Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="cp-club-card cp-skeleton" style={{ background: 'var(--s3)' }} />
            ))
          : shown.map(g => <ClubImageCard key={g.id} group={g} />)}
      </div>
    </div>
  )
}
