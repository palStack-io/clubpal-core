import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FilmIcon } from '@heroicons/react/24/outline'
import BackButton from '../../components/ui/BackButton'
import { enrichApi } from '../../api/enrich'
import PickModal from '../../components/discover/PickModal'
import CreatePollModal from '../../components/modals/CreatePollModal'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import { PageLoader } from '../../components/ui/LoadingSpinner'

const ACCENT = '#6366f1'

export default function MovieDetail() {
  const { tmdbId } = useParams()
  const navigate = useNavigate()
  const [movie, setMovie] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPick, setShowPick] = useState(false)
  const [showPoll, setShowPoll] = useState(false)

  useEffect(() => {
    enrichApi.getMovie(tmdbId)
      .then(setMovie)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tmdbId])

  if (loading) return <Layout><PageLoader /></Layout>
  if (!movie) return <Layout><div className="p-6 text-gray-500">Movie not found.</div></Layout>

  return (
    <Layout>
      <main className="flex-1 overflow-y-auto">
        {/* Backdrop */}
        <div className="relative w-full h-52 bg-gray-900">
          {movie.backdrop_url ? (
            <img src={movie.backdrop_url} alt="" className="w-full h-full object-cover opacity-70" />
          ) : movie.poster_url ? (
            <img src={movie.poster_url} alt="" className="w-full h-full object-cover object-top opacity-70" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <FilmIcon className="h-16 w-16 text-gray-600" />
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          <BackButton />

          <div className="flex gap-4">
            {movie.poster_url && (
              <img src={movie.poster_url} alt={movie.title} className="w-20 h-28 object-cover rounded-lg shadow flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900">{movie.title}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {movie.rating && (
                  <span className="text-sm font-medium text-amber-500">★ {movie.rating.toFixed(1)}</span>
                )}
                {movie.release_date && (
                  <span className="text-sm text-gray-500">{movie.release_date.slice(0, 4)}</span>
                )}
                {movie.runtime && (
                  <span className="text-sm text-gray-500">{movie.runtime} min</span>
                )}
              </div>
              {movie.genres?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {movie.genres.map(g => (
                    <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{g}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {movie.overview && (
            <p className="text-sm text-gray-600 leading-relaxed">{movie.overview}</p>
          )}

          {/* Trailer */}
          {movie.trailer_key && (
            <div className="rounded-xl overflow-hidden aspect-video">
              <iframe
                title="trailer"
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${movie.trailer_key}`}
                allowFullScreen
                style={{ border: 0 }}
              />
            </div>
          )}

          {/* Cast */}
          {movie.cast_list?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Cast</h3>
              <div className="space-y-1">
                {movie.cast_list.slice(0, 6).map((c, i) => (
                  <p key={i} className="text-sm text-gray-600">
                    <span className="font-medium">{c.name}</span>
                    {c.character && <span className="text-gray-400"> as {c.character}</span>}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button style={{ flex: 1, backgroundColor: ACCENT, borderColor: ACCENT }} size="lg" onClick={() => setShowPick(true)}>
              Pick This Movie
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setShowPoll(true)}>💬 Poll Group</Button>
          </div>
        </div>
      </main>

      {showPick && (
        <PickModal title={movie.title} location={null} activityType="movies" onClose={() => setShowPick(false)} onPollGroup={() => { setShowPick(false); setShowPoll(true) }} />
      )}
      <CreatePollModal isOpen={showPoll} onClose={() => setShowPoll(false)} activityName={movie?.title} activityType="movies" onCreated={() => setShowPoll(false)} />
    </Layout>
  )
}
