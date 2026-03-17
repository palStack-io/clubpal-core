import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../components/shell/AppShell'
import Topbar from '../../components/shell/Topbar'
import ResultCard from '../../components/discover/ResultCard'
import CreateEventModal from '../../components/modals/CreateEventModal'
import CreatePollModal from '../../components/modals/CreatePollModal'
import SearchHero from '../../components/discover/SearchHero'
import { enrichApi } from '../../api/enrich'
import { authApi } from '../../api/auth'
import { useAuth } from '../../contexts/AuthContext'

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
          Complete your discover setup to see books curated for your tastes.
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

export default function DiscoverBooks() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [searched, setSearched] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const [pickItem, setPickItem] = useState(null)
  const [pollItem, setPollItem] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadPersonalFeed = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const data = await enrichApi.getUserDiscover(user.id, 'books')
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

  const doSearch = async (q) => {
    if (!q) { setSearched(false); return loadPersonalFeed() }
    setLoading(true)
    setSearched(true)
    setSetupRequired(false)
    try {
      const data = await enrichApi.searchBooks({ query: q })
      setResults(data?.results || [])
    } catch { setResults([]) }
    finally { setLoading(false) }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await authApi.refreshPreferences()
      setSearched(false)
      await loadPersonalFeed()
    } catch {}
    finally { setRefreshing(false) }
  }

  useEffect(() => { loadPersonalFeed() }, [user?.id])

  return (
    <AppShell activeRoute="/discover/books">
      <Topbar title="Books">
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
        eyebrow="Find your next read"
        headline="What should your book club read?"
        onSearch={doSearch}
        suggestions={['📖 Fiction', '🔍 Mystery', '🚀 Sci-Fi', '❤️ Romance']}
      />

      <div style={{ padding: '20px 24px 24px' }}>
        {setupRequired && !searched && <SetupBanner onNavigate={() => navigate('/settings')} />}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} style={{ borderRadius: '16px', overflow: 'hidden', background: 'var(--s2)', border: '1px solid var(--glass)' }}>
                <div style={{ aspectRatio: '2/3', background: 'var(--s3)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ padding: '12px' }}>
                  <div style={{ height: '12px', width: '80%', background: 'var(--s3)', borderRadius: '6px', marginBottom: '6px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: '10px', width: '60%', background: 'var(--s3)', borderRadius: '5px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 && !setupRequired ? (
          <div style={{ textAlign: 'center', padding: '64px 32px', color: 'var(--t3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>{searched ? '📖' : '📚'}</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t2)' }}>
              {searched ? 'No results found' : 'Search for a book'}
            </div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              {searched ? 'Try a different title or author' : 'Enter a title, author, or ISBN to get started'}
            </div>
          </div>
        ) : results.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            {results.map((item, i) => (
              <div key={item.volume_id || i} style={{ position: 'relative' }}>
                <ResultCard
                  result={{
                    name: item.title,
                    photo_url: item.cover_url,
                    rating: item.rating,
                    subtitle: item.authors?.length > 0 ? item.authors.join(', ') : undefined,
                  }}
                  activityType="books"
                  onClick={() => navigate(`/discover/books/${item.volume_id}`)}
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
        ) : null}
      </div>

      {pickItem && (
        <CreateEventModal
          isOpen={true}
          initialTitle={pickItem.title}
          initialLocation={pickItem.location}
          activityType="books"
          onClose={() => setPickItem(null)}
          onCreated={(id) => { setPickItem(null); navigate(`/events/${id}`) }}
          onPollGroup={({ title }) => { setPickItem(null); setPollItem({ title, location: null }) }}
        />
      )}
      <CreatePollModal
        isOpen={!!pollItem}
        onClose={() => setPollItem(null)}
        activityName={pollItem?.title}
        activityType="books"
        onCreated={() => setPollItem(null)}
      />

      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.7} }`}</style>
    </AppShell>
  )
}
