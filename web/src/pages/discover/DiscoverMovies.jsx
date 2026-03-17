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
import { authApi } from '../../api/auth'
import { useAuth } from '../../contexts/AuthContext'

const TMDB_TABS = [
  { id: 'popular', label: 'Popular' },
  { id: 'now-playing', label: 'Now Playing' },
  { id: 'upcoming', label: 'Upcoming' },
]

function SetupBanner({ onNavigate }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 18px', background: 'rgba(244,63,94,0.08)',
      border: '1px solid rgba(244,63,94,0.2)', borderRadius: '12px',
      marginBottom: '20px', flexWrap: 'wrap', gap: '10px',
    }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)', marginBottom: '2px' }}>
          No personalized feed yet
        </div>
        <div style={{ fontSize: '12px', color: 'var(--t3)' }}>
          Complete your discover setup to see movies curated for you.
        </div>
      </div>
      <button
        onClick={onNavigate}
        style={{
          background: 'var(--rose)', color: '#fff', border: 'none',
          borderRadius: '8px', padding: '7px 16px', fontSize: '12px',
          fontWeight: 700, cursor: 'pointer',
        }}
      >
        Set Up Feed →
      </button>
    </div>
  )
}

export default function DiscoverMovies() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [config, setConfig] = useState(null)
  const [tab, setTab] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [setupRequired, setSetupRequired] = useState(false)
  const [pickItem, setPickItem] = useState(null)
  const [pollItem, setPollItem] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [radarrSet, setRadarrSet] = useState(new Set())

  const hasRadarr = config?.radarr_url?.configured
  const hasTmdb = config?.tmdb_api_key?.configured

  const tabs = [
    ...(hasRadarr ? [{ id: 'library', label: 'Library' }] : []),
    { id: 'my-feed', label: 'My Feed' },
    ...(hasTmdb ? TMDB_TABS : []),
  ]

  // Load config on mount; set default tab based on what's configured
  useEffect(() => {
    enrichApi.getConfig()
      .then(c => {
        setConfig(c)
        setTab(c?.radarr_url?.configured ? 'library' : 'my-feed')
      })
      .catch(() => setTab('my-feed'))
  }, [])

  // Fetch Radarr ID set for badge overlay on non-library tabs
  useEffect(() => {
    enrichApi.getRadarrLibrary()
      .then(d => setRadarrSet(new Set(d?.tmdb_ids || [])))
      .catch(() => {})
  }, [])

  const loadPersonalFeed = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const data = await enrichApi.getUserDiscover(user.id, 'movies')
      if (data.setup_required) {
        setSetupRequired(true)
        setResults([])
      } else {
        setSetupRequired(false)
        setResults(data?.results || [])
      }
    } catch { setResults([]) }
    finally { setLoading(false) }
  }

  const loadTab = async (t) => {
    setLoading(true)
    setSetupRequired(false)
    try {
      let data
      if (t === 'library') data = await enrichApi.moviesLibrary()
      else if (t === 'popular') data = await enrichApi.moviesPopular()
      else if (t === 'now-playing') data = await enrichApi.moviesNowPlaying()
      else data = await enrichApi.moviesUpcoming()
      setResults(data?.results || [])
    } catch { setResults([]) }
    finally { setLoading(false) }
  }

  const doSearch = async (q) => {
    if (!q) return tab === 'my-feed' ? loadPersonalFeed() : loadTab(tab)
    setLoading(true)
    setSetupRequired(false)
    try {
      const data = await enrichApi.searchMovies(q)
      setResults(data?.results || [])
    } catch { setResults([]) }
    finally { setLoading(false) }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await authApi.refreshPreferences()
      await loadPersonalFeed()
      setTab('my-feed')
    } catch {}
    finally { setRefreshing(false) }
  }

  useEffect(() => {
    if (!tab) return
    if (tab === 'my-feed') loadPersonalFeed()
    else loadTab(tab)
  }, [tab, user?.id])

  return (
    <AppShell activeRoute="/discover/movies">
      <Topbar title="Movies">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh personal feed"
          style={{
            background: 'var(--s3)', border: '1px solid var(--glass)', borderRadius: '20px',
            padding: '5px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--t2)',
            cursor: 'pointer', opacity: refreshing ? 0.6 : 1,
          }}
        >
          {refreshing ? '⏳' : '🔄'} Refresh
        </button>
      </Topbar>

      <SearchHero
        eyebrow="Find something to watch"
        headline="What's on your group's watchlist?"
        onSearch={doSearch}
        suggestions={['🎬 Action', '😂 Comedy', '😱 Horror', '🏆 Award winners']}
      />

      <div style={{ padding: '20px 24px 24px' }}>
        {setupRequired && tab === 'my-feed' && <SetupBanner onNavigate={() => navigate('/settings')} />}

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
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎬</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t2)' }}>No results found</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Try a different search or tab</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            {results.map((item, i) => (
              <div key={item.tmdb_id || i} style={{ position: 'relative' }}>
                {(item.in_library || radarrSet.has(item.tmdb_id)) && (
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
                    subtitle: item.release_date ? item.release_date.slice(0, 4) : undefined,
                  }}
                  activityType="movies"
                  onClick={() => navigate(`/discover/movies/${item.tmdb_id}`)}
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
