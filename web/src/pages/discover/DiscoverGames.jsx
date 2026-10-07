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

const CATEGORIES = [
  { id: 'my-feed', label: 'My Feed' },
  { id: 'video_game', label: 'Video Games' },
  { id: 'board_game', label: 'Board Games' },
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
          Your personal feed will fill in as you pick things you like.
        </div>
        <div style={{ fontSize: '12px', color: 'var(--t3)' }}>
          Complete your discover setup to see games curated for you.
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

export default function DiscoverGames() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('my-feed')
  const [setupRequired, setSetupRequired] = useState(false)
  const [pickItem, setPickItem] = useState(null)
  const [pollItem, setPollItem] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadPersonalFeed = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const data = await enrichApi.getUserDiscover(user.id, 'gaming')
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

  const loadPopular = async () => {
    setLoading(true)
    setSetupRequired(false)
    try {
      const data = await enrichApi.popularGames()
      setResults(data?.results || [])
    } catch { setResults([]) }
    finally { setLoading(false) }
  }

  const doSearch = async (q) => {
    if (!q) {
      if (category === 'my-feed') return loadPersonalFeed()
      return loadPopular()
    }
    setLoading(true)
    setSetupRequired(false)
    try {
      const params = { query: q, category: category === 'board_game' ? 'board_game' : undefined }
      const data = await enrichApi.searchGames(params)
      setResults(data?.results || [])
    } catch { setResults([]) }
    finally { setLoading(false) }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await authApi.refreshPreferences()
      await loadPersonalFeed()
      setCategory('my-feed')
    } catch {}
    finally { setRefreshing(false) }
  }

  useEffect(() => {
    if (category === 'my-feed') loadPersonalFeed()
    else loadPopular()
  }, [category, user?.id])

  return (
    <AppShell activeRoute="/discover/games">
      <Topbar title="Games">
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
          Refresh
        </button>
      </Topbar>

      <SearchHero
        eyebrow="Find a game"
        headline="What should your group play?"
        onSearch={doSearch}
        suggestions={['🎲 Board games', '🎮 Video games', '🃏 Card games', '🧩 Puzzles']}
      />

      <div style={{ padding: '20px 24px 24px' }}>
        {setupRequired && category === 'my-feed' && <SetupBanner onNavigate={() => navigate('/settings')} />}

        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {CATEGORIES.map(p => (
            <ActivityPill key={p.id} label={p.label} active={category === p.id} onClick={() => setCategory(p.id)} />
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ borderRadius: '16px', overflow: 'hidden', background: 'var(--s2)', border: '1px solid var(--glass)' }}>
                <div style={{ height: '160px', background: 'var(--s3)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ padding: '14px' }}>
                  <div style={{ height: '12px', width: '70%', background: 'var(--s3)', borderRadius: '6px', marginBottom: '8px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: '10px', width: '50%', background: 'var(--s3)', borderRadius: '5px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 32px', color: 'var(--t3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎮</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t2)' }}>Nothing matched. Try a different search.</div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>Try a different search or category</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            {results.map((item, i) => (
              <div key={item.igdb_id || i} style={{ position: 'relative' }}>
                <ResultCard
                  result={{
                    name: item.name,
                    photo_url: item.cover_url,
                    rating: item.rating ? item.rating / 20 : undefined,
                    subtitle: item.genres?.slice(0, 2).join(', '),
                  }}
                  activityType="games"
                  onClick={() => navigate(`/discover/games/${item.igdb_id}`)}
                />
                <div style={{ position: 'absolute', bottom: '14px', right: '10px', display: 'flex', gap: '5px', zIndex: 2 }}>
                  <button
                    onClick={e => { e.stopPropagation(); setPollItem({ title: item.name, location: null }) }}
                    style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '8px', padding: '5px 8px', fontSize: '11px', fontWeight: 700, color: 'var(--t2)', cursor: 'pointer' }}
                  >
                    Poll
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); setPickItem({ title: item.name, location: null }) }}
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
          activityType="gaming"
          onClose={() => setPickItem(null)}
          onCreated={(id) => { setPickItem(null); navigate(`/events/${id}`) }}
          onPollGroup={({ title }) => { setPickItem(null); setPollItem({ title, location: null }) }}
        />
      )}
      <CreatePollModal
        isOpen={!!pollItem}
        onClose={() => setPollItem(null)}
        activityName={pollItem?.title}
        activityType="gaming"
        onCreated={() => setPollItem(null)}
      />

      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }`}</style>
    </AppShell>
  )
}
