import { useState } from 'react'
import Card from '../ui/Card'

const ACHIEVEMENTS = [
  { id: 'first_pick',       icon: '🎯', name: 'First Pick',        desc: 'Host your first event' },
  { id: 'social_butterfly', icon: '🦋', name: 'Social Butterfly',  desc: 'Join 3+ clubs' },
  { id: 'critic',           icon: '⭐', name: 'Critic',            desc: 'Rate 10 events' },
  { id: 'globe_trotter',   icon: '🌍', name: 'Globetrotter',      desc: 'Try 5 activity types' },
  { id: 'streak_3',         icon: '🔥', name: 'On a Roll',         desc: '3 events in a row' },
  { id: 'host_5',           icon: '🏠', name: 'Super Host',        desc: 'Host 5 events' },
  { id: 'top_rated',        icon: '🏆', name: 'Top Rated',         desc: 'Avg rating 9+' },
  { id: 'early_bird',       icon: '🐦', name: 'Early Bird',        desc: 'First RSVP 5x' },
]

function AchievementModal({ achievement, unlocked, onClose }) {
  if (!achievement) return null
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--s2)', border: `1px solid ${unlocked ? 'var(--rose-border)' : 'var(--glass)'}`, borderRadius: '20px', padding: '28px 32px', maxWidth: '320px', width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: '52px', marginBottom: '12px', filter: unlocked ? 'none' : 'grayscale(1)', opacity: unlocked ? 1 : 0.4 }}>{achievement.icon}</div>
        <div style={{ fontSize: '16px', fontWeight: 800, color: unlocked ? 'var(--t1)' : 'var(--t3)', marginBottom: '8px', letterSpacing: '-0.3px' }}>{achievement.name}</div>
        <div style={{ fontSize: '13px', color: 'var(--t2)', lineHeight: 1.5, marginBottom: '16px' }}>{achievement.desc}</div>
        {unlocked ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--rose-glow)', border: '1px solid var(--rose-border)', borderRadius: '100px', padding: '5px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--rose-soft)' }}>
            ✓ Unlocked
          </div>
        ) : (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--s3)', border: '1px solid var(--glass)', borderRadius: '100px', padding: '5px 14px', fontSize: '11px', fontWeight: 700, color: 'var(--t3)' }}>
            🔒 Not yet unlocked
          </div>
        )}
        <button
          onClick={onClose}
          style={{ display: 'block', margin: '16px auto 0', background: 'none', border: 'none', color: 'var(--t3)', fontSize: '12px', cursor: 'pointer' }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default function AchievementsCard({ unlockedIds = [] }) {
  const [selected, setSelected] = useState(null)

  return (
    <>
      <Card>
        <Card.Header title="Achievements" action={<span style={{ fontSize: '11px', color: 'var(--t3)' }}>{unlockedIds.length}/{ACHIEVEMENTS.length} unlocked</span>} />
        <Card.Body>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {ACHIEVEMENTS.map(a => {
              const unlocked = unlockedIds.includes(a.id)
              return (
                <div
                  key={a.id}
                  onClick={() => setSelected(a)}
                  style={{
                    background: unlocked ? 'rgba(244,63,94,0.15)' : 'var(--s3)',
                    border: `1px solid ${unlocked ? 'rgba(244,63,94,0.22)' : 'var(--glass)'}`,
                    borderRadius: '14px',
                    padding: '14px 12px',
                    textAlign: 'center',
                    opacity: unlocked ? 1 : 0.3,
                    filter: unlocked ? 'none' : 'grayscale(0.5)',
                    transition: 'all 0.15s',
                    cursor: 'pointer',
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
      {selected && (
        <AchievementModal
          achievement={selected}
          unlocked={unlockedIds.includes(selected.id)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
