import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { FilmIcon } from '@heroicons/react/24/outline'
import AppShell from '../../components/shell/AppShell'
import BackButton from '../../components/ui/BackButton'
import { enrichApi } from '../../api/enrich'
import PickModal from '../../components/discover/PickModal'
import CreatePollModal from '../../components/modals/CreatePollModal'

const ACCENT = '#6366f1'

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid var(--glass)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default function MovieDetail() {
  const { tmdbId } = useParams()
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

  if (loading) return <AppShell><Spinner /></AppShell>
  if (!movie) return (
    <AppShell>
      <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--t3)' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎬</div>
        <div style={{ fontWeight: 700, color: 'var(--t2)' }}>Movie not found</div>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      {/* Backdrop hero */}
      <div style={{ position: 'relative', width: '100%', height: '220px', background: '#000', overflow: 'hidden' }}>
        {movie.backdrop_url ? (
          <img src={movie.backdrop_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
        ) : movie.poster_url ? (
          <img src={movie.poster_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', opacity: 0.5 }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <FilmIcon style={{ width: '56px', height: '56px', color: 'var(--t4)' }} />
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(8,8,10,0.92) 100%)' }} />
      </div>

      <div style={{ padding: '20px', maxWidth: '720px' }}>
        <div style={{ marginBottom: '16px' }}>
          <BackButton />
        </div>

        {/* Poster + title */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
          {movie.poster_url && (
            <img
              src={movie.poster_url}
              alt={movie.title}
              style={{ width: '88px', height: '124px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--t1)', margin: '0 0 6px' }}>{movie.title}</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {movie.rating && (
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>★ {movie.rating.toFixed(1)}</span>
              )}
              {movie.release_date && (
                <span style={{ fontSize: '12px', color: 'var(--t3)' }}>{movie.release_date.slice(0, 4)}</span>
              )}
              {movie.runtime && (
                <span style={{ fontSize: '12px', color: 'var(--t3)' }}>{movie.runtime} min</span>
              )}
            </div>
            {movie.genres?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {movie.genres.map(g => (
                  <span key={g} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '100px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 600 }}>{g}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Overview */}
        {movie.overview && (
          <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>Overview</div>
            <p style={{ fontSize: '13px', color: 'var(--t2)', lineHeight: 1.65, margin: 0 }}>{movie.overview}</p>
          </div>
        )}

        {/* Trailer */}
        {movie.trailer_key && (
          <div style={{ borderRadius: '14px', overflow: 'hidden', aspectRatio: '16/9', marginBottom: '16px' }}>
            <iframe
              title="trailer"
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${movie.trailer_key}`}
              allowFullScreen
              style={{ border: 0, display: 'block' }}
            />
          </div>
        )}

        {/* Cast */}
        {movie.cast_list?.length > 0 && (
          <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '14px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>Cast</div>
            <div style={{ display: 'grid', gap: '6px' }}>
              {movie.cast_list.slice(0, 6).map((c, i) => (
                <div key={i} style={{ fontSize: '13px', color: 'var(--t2)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--t1)' }}>{c.name}</span>
                  {c.character && <span style={{ color: 'var(--t3)' }}> as {c.character}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowPick(true)}
            style={{ flex: 1, background: ACCENT, color: '#fff', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}
          >
            Pick This Movie
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
        <PickModal title={movie.title} location={null} activityType="movies" onClose={() => setShowPick(false)} onPollGroup={() => { setShowPick(false); setShowPoll(true) }} />
      )}
      <CreatePollModal isOpen={showPoll} onClose={() => setShowPoll(false)} activityName={movie?.title} activityType="movies" onCreated={() => setShowPoll(false)} />
    </AppShell>
  )
}
