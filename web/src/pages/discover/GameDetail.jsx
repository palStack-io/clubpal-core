import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PuzzlePieceIcon } from '@heroicons/react/24/outline'
import BackButton from '../../components/ui/BackButton'
import { enrichApi } from '../../api/enrich'
import PickModal from '../../components/discover/PickModal'
import CreatePollModal from '../../components/modals/CreatePollModal'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import { PageLoader } from '../../components/ui/LoadingSpinner'

const ACCENT = '#10b981'

export default function GameDetail() {
  const { igdbId } = useParams()
  const navigate = useNavigate()
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

  if (loading) return <Layout><PageLoader /></Layout>
  if (!game) return <Layout><div className="p-6 text-gray-500">Game not found.</div></Layout>

  return (
    <Layout>
      <main className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-4">
          <BackButton />

          <div className="flex gap-4">
            <div className="w-24 flex-shrink-0">
              {game.cover_url ? (
                <img src={game.cover_url} alt={game.name} className="w-full rounded-lg shadow" />
              ) : (
                <div className="w-full aspect-[3/4] bg-emerald-50 rounded-lg flex items-center justify-center">
                  <PuzzlePieceIcon className="h-8 w-8 text-emerald-200" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900">{game.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {game.rating && (
                  <span className="text-sm font-medium text-amber-500">★ {(game.rating / 20).toFixed(1)}</span>
                )}
                {game.release_date && (
                  <span className="text-sm text-gray-500">{game.release_date.slice(0, 4)}</span>
                )}
              </div>
              {game.genres?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {game.genres.map(g => (
                    <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{g}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {game.summary && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">About</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{game.summary}</p>
            </div>
          )}

          {game.platforms?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Platforms</h3>
              <p className="text-sm text-gray-500">{game.platforms.join(', ')}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button style={{ flex: 1, backgroundColor: ACCENT, borderColor: ACCENT }} size="lg" onClick={() => setShowPick(true)}>
              Pick This Game
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setShowPoll(true)}>💬 Poll Group</Button>
          </div>
        </div>
      </main>

      {showPick && (
        <PickModal title={game.name} location={null} activityType="gaming" onClose={() => setShowPick(false)} onPollGroup={() => { setShowPick(false); setShowPoll(true) }} />
      )}
      <CreatePollModal isOpen={showPoll} onClose={() => setShowPoll(false)} activityName={game?.name} activityType="gaming" onCreated={() => setShowPoll(false)} />
    </Layout>
  )
}
