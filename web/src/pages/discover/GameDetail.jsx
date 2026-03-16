import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { PuzzlePieceIcon } from '@heroicons/react/24/outline'
import AppShell from '../../components/shell/AppShell'
import BackButton from '../../components/ui/BackButton'
import { enrichApi } from '../../api/enrich'
import PickModal from '../../components/discover/PickModal'
import CreatePollModal from '../../components/modals/CreatePollModal'

const ACCENT = '#22d3a0'

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid var(--glass)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default function GameDetail() {
  const { igdbId } = useParams()
  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPick, setShowPick] = useState(false)
  const [showPoll, setShowPoll] = useState(false)

  useEffect(() => {
    enrichApi.getGame(igdbId)
      .then(setGame)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [igdbId])

  if (loading) return <AppShell><Spinner /></AppShell>
  if (!game) return (
    <AppShell>
      <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--t3)' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎮</div>
        <div style={{ fontWeight: 700, color: 'var(--t2)' }}>Game not found</div>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      {/* Hero — use cover as banner if available */}
      {game.cover_url && (
        <div style={{ position: 'relative', width: '100%', height: '200px', background: '#000', overflow: 'hidden' }}>
          <img src={game.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', opacity: 0.45, filter: 'blur(8px)', transform: 'scale(1.08)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(8,8,10,0.3) 0%, rgba(8,8,10,0.88) 100%)' }} />
        </div>
      )}

      <div style={{ padding: '20px', maxWidth: '720px' }}>
        <div style={{ marginBottom: '16px' }}>
          <BackButton />
        </div>

        {/* Cover + title */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
          <div style={{ width: '88px', flexShrink: 0 }}>
            {game.cover_url ? (
              <img
                src={game.cover_url}
                alt={game.name}
                style={{ width: '100%', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
              />
            ) : (
              <div style={{ width: '88px', aspectRatio: '3/4', background: 'rgba(34,211,160,0.12)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <PuzzlePieceIcon style={{ width: '28px', height: '28px', color: ACCENT }} />
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--t1)', margin: '0 0 6px' }}>{game.name}</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {game.rating && (
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>★ {(game.rating / 20).toFixed(1)}</span>
              )}
              {game.release_date && (
                <span style={{ fontSize: '12px', color: 'var(--t3)' }}>{game.release_date.slice(0, 4)}</span>
              )}
            </div>
            {game.genres?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {game.genres.map(g => (
                  <span key={g} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '100px', background: 'rgba(34,211,160,0.12)', color: ACCENT, fontWeight: 600 }}>{g}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        {game.summary && (
          <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>About</div>
            <p style={{ fontSize: '13px', color: 'var(--t2)', lineHeight: 1.65, margin: 0 }}>{game.summary}</p>
          </div>
        )}

        {/* Platforms */}
        {game.platforms?.length > 0 && (
          <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '14px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>Platforms</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {game.platforms.map(p => (
                <span key={p} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '100px', background: 'var(--s3)', color: 'var(--t2)', border: '1px solid var(--glass)' }}>{p}</span>
              ))}
            </div>
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowPick(true)}
            style={{ flex: 1, background: ACCENT, color: '#0a0a0f', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}
          >
            Pick This Game
          </button>
          <button
            onClick={() => setShowPoll(true)}
            style={{ padding: '14px 18px', background: 'var(--s3)', color: 'var(--t2)', border: '1px solid var(--glass)', borderRadius: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            💬 Poll Group
          </button>
        </div>
      </div>

      {showPick && (
        <PickModal title={game.name} location={null} activityType="gaming" onClose={() => setShowPick(false)} onPollGroup={() => { setShowPick(false); setShowPoll(true) }} />
      )}
      <CreatePollModal isOpen={showPoll} onClose={() => setShowPoll(false)} activityName={game?.name} activityType="gaming" onCreated={() => setShowPoll(false)} />
    </AppShell>
  )
}
