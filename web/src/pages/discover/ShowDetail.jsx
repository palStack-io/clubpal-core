import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../../components/ui/BackButton'
import { enrichApi } from '../../api/enrich'
import PickModal from '../../components/discover/PickModal'
import CreatePollModal from '../../components/modals/CreatePollModal'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import { PageLoader } from '../../components/ui/LoadingSpinner'

const ACCENT = '#6366f1'

export default function ShowDetail() {
  const { tmdbId } = useParams()
  const navigate = useNavigate()
  const [show, setShow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPick, setShowPick] = useState(false)
  const [showPoll, setShowPoll] = useState(false)
  const [inLibrary, setInLibrary] = useState(false)

  useEffect(() => {
    enrichApi.getShow(tmdbId)
      .then(setShow)
      .catch(() => {})
      .finally(() => setLoading(false))

    enrichApi.getSonarrLibrary()
      .then(d => setInLibrary((d?.tmdb_ids || []).includes(Number(tmdbId))))
      .catch(() => {})
  }, [tmdbId])

  if (loading) return <Layout><PageLoader /></Layout>
  if (!show) return <Layout><div className="p-6 text-gray-500">Show not found.</div></Layout>

  return (
    <Layout>
      <main className="flex-1 overflow-y-auto">
        {/* Backdrop */}
        <div className="relative w-full h-52 bg-gray-900">
          {show.backdrop_url ? (
            <img src={show.backdrop_url} alt="" className="w-full h-full object-cover opacity-70" />
          ) : show.poster_url ? (
            <img src={show.poster_url} alt="" className="w-full h-full object-cover object-top opacity-70" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span style={{ fontSize: '64px' }}>📺</span>
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          <BackButton />

          <div className="flex gap-4">
            {show.poster_url && (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img src={show.poster_url} alt={show.title} className="w-20 h-28 object-cover rounded-lg shadow" />
                {inLibrary && (
                  <div style={{
                    position: 'absolute', top: '6px', right: '6px',
                    background: '#22d3a0', color: '#000', fontSize: '8px', fontWeight: 800,
                    padding: '2px 6px', borderRadius: '100px', letterSpacing: '0.5px',
                  }}>
                    IN LIBRARY
                  </div>
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900">{show.title}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {show.rating && (
                  <span className="text-sm font-medium text-amber-500">★ {show.rating.toFixed(1)}</span>
                )}
                {show.first_air_date && (
                  <span className="text-sm text-gray-500">{show.first_air_date.slice(0, 4)}</span>
                )}
                {show.number_of_seasons != null && (
                  <span className="text-sm text-gray-500">{show.number_of_seasons} season{show.number_of_seasons !== 1 ? 's' : ''}</span>
                )}
                {show.number_of_episodes != null && (
                  <span className="text-sm text-gray-500">{show.number_of_episodes} episodes</span>
                )}
              </div>
              {show.genres?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {show.genres.map(g => (
                    <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{g}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {show.overview && (
            <p className="text-sm text-gray-600 leading-relaxed">{show.overview}</p>
          )}

          {/* Trailer */}
          {show.trailer_key && (
            <div className="rounded-xl overflow-hidden aspect-video">
              <iframe
                title="trailer"
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${show.trailer_key}`}
                allowFullScreen
                style={{ border: 0 }}
              />
            </div>
          )}

          {/* Cast */}
          {show.cast_list?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Cast</h3>
              <div className="space-y-1">
                {show.cast_list.slice(0, 6).map((c, i) => (
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
              Pick This Show
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setShowPoll(true)}>💬 Poll Group</Button>
          </div>
        </div>
      </main>

      {showPick && (
        <PickModal title={show.title} location={null} activityType="movies" onClose={() => setShowPick(false)} onPollGroup={() => { setShowPick(false); setShowPoll(true) }} />
      )}
      <CreatePollModal isOpen={showPoll} onClose={() => setShowPoll(false)} activityName={show?.title} activityType="movies" onCreated={() => setShowPoll(false)} />
    </Layout>
  )
}
