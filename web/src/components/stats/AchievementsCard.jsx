import Card from '../ui/Card'

const ACHIEVEMENTS = [
  { id: 'first_pick',     icon: '🎯', name: 'First Pick',    desc: 'Host your first event' },
  { id: 'social_butterfly', icon: '🦋', name: 'Social Butterfly', desc: 'Join 3+ clubs' },
  { id: 'critic',         icon: '⭐', name: 'Critic',        desc: 'Rate 10 events' },
  { id: 'globe_trotter',  icon: '🌍', name: 'Globetrotter',  desc: 'Try 5 activity types' },
  { id: 'streak_3',       icon: '🔥', name: 'On a Roll',     desc: '3 events in a row' },
  { id: 'host_5',         icon: '🏠', name: 'Super Host',    desc: 'Host 5 events' },
  { id: 'top_rated',      icon: '🏆', name: 'Top Rated',     desc: 'Avg rating 9+' },
  { id: 'early_bird',     icon: '🐦', name: 'Early Bird',    desc: 'First RSVP 5x' },
]

export default function AchievementsCard({ unlockedIds = [] }) {
  return (
    <Card>
      <Card.Header title="Achievements" action={<span style={{ fontSize: '11px', color: 'var(--t3)' }}>{unlockedIds.length}/{ACHIEVEMENTS.length} unlocked</span>} />
      <Card.Body>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {ACHIEVEMENTS.map(a => {
            const unlocked = unlockedIds.includes(a.id)
            return (
              <div
                key={a.id}
                style={{
                  background: unlocked ? 'rgba(244,63,94,0.15)' : 'var(--s3)',
                  border: `1px solid ${unlocked ? 'rgba(244,63,94,0.22)' : 'var(--glass)'}`,
                  borderRadius: '14px',
                  padding: '14px 12px',
                  textAlign: 'center',
                  opacity: unlocked ? 1 : 0.3,
                  filter: unlocked ? 'none' : 'grayscale(0.5)',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '26px', marginBottom: '6px' }}>{a.icon}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t1)', marginBottom: '3px' }}>{a.name}</div>
                <div style={{ fontSize: '10px', color: 'var(--t3)', lineHeight: 1.4 }}>{a.desc}</div>
              </div>
            )
          })}
        </div>
      </Card.Body>
    </Card>
  )
}
