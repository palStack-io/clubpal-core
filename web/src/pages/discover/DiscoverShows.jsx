import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../components/shell/AppShell'
import Topbar from '../../components/shell/Topbar'
import ActivityPill from '../../components/ui/ActivityPill'
import ResultCard from '../../components/discover/ResultCard'
import CreateEventModal from '../../components/modals/CreateEventModal'
import CreatePollModal from '../../components/modals/CreatePollModal'
import SearchHero from '../../components/discover/SearchHero'
import { enrichApi } from '../../api/enrich'
import { useAuth } from '../../contexts/AuthContext'

const TMDB_TABS = [
  { id: 'popular', label: 'Popular' },
  { id: 'top-rated', label: 'Top Rated' },
  { id: 'airing-today', label: 'Airing Today' },
]

export default function DiscoverShows() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [config, setConfig] = useState(null)
  const [tab, setTab] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [pickItem, setPickItem] = useState(null)
  const [pollItem, setPollItem] = useState(null)
  const [sonarrSet, setSonarrSet] = useState(new Set())

  const hasSonarr = config?.sonarr_url?.configured
  const hasTmdb = config?.tmdb_api_key?.configured

  const tabs = [
    ...(hasSonarr ? [{ id: 'library', label: 'Library' }] : []),
    ...(hasTmdb ? TMDB_TABS : []),
  ]

  // Load config on mount; set default tab based on what's configured
  useEffect(() => {
    enrichApi.getConfig()
      .then(c => {
        setConfig(c)
        setTab(c?.sonarr_url?.configured ? 'library' : 'popular')
      })
      .catch(() => setTab('popular'))
  }, [])

  // Fetch Sonarr ID set for badge overlay on non-library tabs
  useEffect(() => {
    enrichApi.getSonarrLibrary()
      .then(d => setSonarrSet(new Set(d?.tmdb_ids || [])))
      .catch(() => {})
  }, [])

  const loadTab = async (t) => {
    setLoading(true)
    try {
      let data
      if (t === 'library') data = await enrichApi.showsLibrary()
      else if (t === 'popular') data = await enrichApi.showsPopular()
      else if (t === 'top-rated') data = await enrichApi.showsTopRated()
      else data = await enrichApi.showsAiringToday()
      setResults(data?.results || [])
    } catch { setResults([]) }
    finally { setLoading(false) }
  }

  const doSearch = async (q) => {
    if (!q) return tab ? loadTab(tab) : null
    setLoading(true)
    try {
      const data = await enrichApi.searchShows(q)
      setResults(data?.results || [])
    } catch { setResults([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (tab) loadTab(tab) }, [tab])

  return (
    <AppShell activeRoute="/discover/shows">
      <Topbar title="TV Shows" />

      <SearchHero
        eyebrow="Find something to binge"
        headline="What's your group binge-watching?"
        onSearch={doSearch}
        suggestions={['📺 Drama', '😂 Comedy', '🔬 Sci-Fi', '🕵️ Crime']}
      />

      <div style={{ padding: '20px 24px 24px' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {tabs.map(p => (
            <ActivityPill key={p.id} label={p.label} active={tab === p.id} onClick={() => setTab(p.id)} />
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} style={{ borderRadius: '16px', overflow: 'hidden', background: 'var(--s2)', border: '1px solid var(--glass)' }}>
                <div style={{ aspectRatio: '2/3', background: 'var(--s3)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ padding: '12px' }}>
                  <div style={{ height: '12px', width: '80%', background: 'var(--s3)', borderRadius: '6px', marginBottom: '6px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: '10px', width: '50%', background: 'var(--s3)', borderRadius: '5px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 32px', color: 'var(--t3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📺</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t2)' }}>No results found</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Try a different search or tab</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            {results.map((item, i) => (
              <div key={item.tmdb_id || i} style={{ position: 'relative' }}>
                {(item.in_library || sonarrSet.has(item.tmdb_id)) && (
                  <div style={{
                    position: 'absolute', top: '8px', right: '8px', zIndex: 3,
                    background: '#22d3a0', color: '#000', fontSize: '9px', fontWeight: 800,
                    padding: '3px 7px', borderRadius: '100px', letterSpacing: '0.5px',
                  }}>
                    IN LIBRARY
                  </div>
                )}
                <ResultCard
                  result={{
                    name: item.title,
                    photo_url: item.poster_url,
                    rating: item.rating,
                    subtitle: item.first_air_date ? item.first_air_date.slice(0, 4) : undefined,
                  }}
                  activityType="movies"
                  onClick={() => navigate(`/discover/shows/${item.tmdb_id}`)}
                />
                <div style={{ position: 'absolute', bottom: '14px', right: '10px', display: 'flex', gap: '5px', zIndex: 2 }}>
                  <button
                    onClick={e => { e.stopPropagation(); setPollItem({ title: item.title, location: null }) }}
                    style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '8px', padding: '5px 8px', fontSize: '11px', fontWeight: 700, color: 'var(--t2)', cursor: 'pointer' }}
                  >
                    💬 Poll
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setPickItem({ title: item.title, location: null }) }}
                    style={{ background: 'var(--rose)', border: 'none', borderRadius: '8px', padding: '5px 10px', fontSize: '11px', fontWeight: 700, color: '#fff', cursor: 'pointer' }}
                  >
                    Pick
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pickItem && (
        <CreateEventModal
          isOpen={true}
          initialTitle={pickItem.title}
          initialLocation={pickItem.location}
          activityType="movies"
          onClose={() => setPickItem(null)}
          onCreated={(id) => { setPickItem(null); navigate(`/events/${id}`) }}
          onPollGroup={({ title }) => { setPickItem(null); setPollItem({ title, location: null }) }}
        />
      )}
      <CreatePollModal
        isOpen={!!pollItem}
        onClose={() => setPollItem(null)}
        activityName={pollItem?.title}
        activityType="movies"
        onCreated={() => setPollItem(null)}
      />

      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }`}</style>
    </AppShell>
  )
}
