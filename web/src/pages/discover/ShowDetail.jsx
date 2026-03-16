import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
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

export default function ShowDetail() {
  const { tmdbId } = useParams()
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

  if (loading) return <AppShell><Spinner /></AppShell>
  if (!show) return (
    <AppShell>
      <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--t3)' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>📺</div>
        <div style={{ fontWeight: 700, color: 'var(--t2)' }}>Show not found</div>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      {/* Backdrop hero */}
      <div style={{ position: 'relative', width: '100%', height: '220px', background: '#000', overflow: 'hidden' }}>
        {show.backdrop_url ? (
          <img src={show.backdrop_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
        ) : show.poster_url ? (
          <img src={show.poster_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', opacity: 0.5 }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ fontSize: '64px' }}>📺</span>
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
          {show.poster_url && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img
                src={show.poster_url}
                alt={show.title}
                style={{ width: '88px', height: '124px', objectFit: 'cover', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
              />
              {inLibrary && (
                <div style={{
                  position: 'absolute', top: '6px', right: '6px',
                  background: 'var(--green)', color: '#000', fontSize: '8px', fontWeight: 800,
                  padding: '2px 6px', borderRadius: '100px', letterSpacing: '0.5px',
                }}>
                  IN LIBRARY
                </div>
              )}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--t1)', margin: '0 0 6px' }}>{show.title}</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {show.rating && (
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>★ {show.rating.toFixed(1)}</span>
              )}
              {show.first_air_date && (
                <span style={{ fontSize: '12px', color: 'var(--t3)' }}>{show.first_air_date.slice(0, 4)}</span>
              )}
              {show.number_of_seasons != null && (
                <span style={{ fontSize: '12px', color: 'var(--t3)' }}>{show.number_of_seasons} season{show.number_of_seasons !== 1 ? 's' : ''}</span>
              )}
              {show.number_of_episodes != null && (
                <span style={{ fontSize: '12px', color: 'var(--t3)' }}>{show.number_of_episodes} ep</span>
              )}
            </div>
            {show.genres?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {show.genres.map(g => (
                  <span key={g} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '100px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: 600 }}>{g}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Overview */}
        {show.overview && (
          <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>Overview</div>
            <p style={{ fontSize: '13px', color: 'var(--t2)', lineHeight: 1.65, margin: 0 }}>{show.overview}</p>
          </div>
        )}

        {/* Trailer */}
        {show.trailer_key && (
          <div style={{ borderRadius: '14px', overflow: 'hidden', aspectRatio: '16/9', marginBottom: '16px' }}>
            <iframe
              title="trailer"
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${show.trailer_key}`}
              allowFullScreen
              style={{ border: 0, display: 'block' }}
            />
          </div>
        )}

        {/* Cast */}
        {show.cast_list?.length > 0 && (
          <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '14px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>Cast</div>
            <div style={{ display: 'grid', gap: '6px' }}>
              {show.cast_list.slice(0, 6).map((c, i) => (
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
            Pick This Show
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
        <PickModal title={show.title} location={null} activityType="movies" onClose={() => setShowPick(false)} onPollGroup={() => { setShowPick(false); setShowPoll(true) }} />
      )}
      <CreatePollModal isOpen={showPoll} onClose={() => setShowPoll(false)} activityName={show?.title} activityType="movies" onCreated={() => setShowPoll(false)} />
    </AppShell>
  )
}
