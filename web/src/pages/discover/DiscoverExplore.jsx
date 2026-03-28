import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../components/shell/AppShell'
import SearchHero from '../../components/discover/SearchHero'
import CreateEventModal from '../../components/modals/CreateEventModal'
import CreatePollModal from '../../components/modals/CreatePollModal'
import { TABS, PILLS, MOCK_PICKS } from './discoverData'
import { enrichApi } from '../../api/enrich'
import { groupsApi } from '../../api/groups'
import { eventsApi } from '../../api/events'
import { useAuth } from '../../contexts/AuthContext'
import { gatewayClient } from '../../api/client'

// ─── Per-tab data shape ───────────────────────────────────────────────────────
const TAB_SCHEMA = {
  restaurants: { id: 'place_id',  name: 'name',  image: 'photo_url',     meta: i => [i.rating && `★ ${i.rating}`, i.price_level && '$'.repeat(i.price_level), i.distance].filter(Boolean).join(' · '), category: i => i.types?.[0] || 'Restaurant', loc: i => i.formatted_address || i.address },
  movies:      { id: 'tmdb_id',   name: 'title', image: 'poster_url',    meta: i => [i.rating && `★ ${i.rating}`, i.release_date?.slice(0,4)].filter(Boolean).join(' · '),                               category: i => i.genre || 'Movie',           loc: () => null },
  shows:       { id: 'tmdb_id',   name: 'name',  image: 'poster_url',    meta: i => [i.rating && `★ ${i.rating}`, i.first_air_date?.slice(0,4)].filter(Boolean).join(' · '),                             category: i => i.genre || 'TV Show',         loc: () => null },
  books:       { id: 'volume_id', name: 'title', image: 'cover_url',     meta: i => [i.author, i.year && `(${i.year})`].filter(Boolean).join(' '),                                                        category: () => 'Book',                      loc: () => null },
  hikes:       { id: 'place_id',  name: 'name',  image: 'photo_url',     meta: i => [i.rating && `★ ${i.rating}`, i.distance].filter(Boolean).join(' · '),                                               category: i => i.difficulty || 'Hike',       loc: i => i.address },
  games:       { id: 'igdb_id',   name: 'name',  image: 'cover_url',     meta: i => [i.rating && `★ ${i.rating}`, i.year && `(${i.year})`].filter(Boolean).join(' '),                                    category: i => i.genre || 'Game',            loc: () => null },
  arts:        { id: 'place_id',  name: 'name',  image: 'photo_url',     meta: i => [i.rating && `★ ${i.rating}`, i.distance].filter(Boolean).join(' · '),                                               category: i => i.types?.[0] || 'Arts',       loc: i => i.formatted_address },
}

const DETAIL_ROUTE = {
  restaurants: id => `/discover/restaurants/${id}`,
  movies:      id => `/discover/movies/${id}`,
  shows:       id => `/discover/shows/${id}`,
  books:       id => `/discover/books/${id}`,
  hikes:       id => `/discover/hikes/${id}`,
  games:       id => `/discover/games/${id}`,
  arts:        id => `/discover/arts/${id}`,
}

// API type → tab key (for search routing)
const APITYPE_TO_TAB = { dining: 'restaurants', movies: 'movies', shows: 'shows', books: 'books', hiking: 'hikes', gaming: 'games', arts: 'arts' }

// ─── Normalize raw API items → common card shape ──────────────────────────────
function normalizeItems(data, tabKey) {
  const schema = TAB_SCHEMA[tabKey]
  if (!schema) return []
  const raw = Array.isArray(data) ? data : (data?.results ?? data?.items ?? [])
  return raw.slice(0, 12).map((item, i) => ({
    id:       item[schema.id] || item.id || String(i),
    name:     item[schema.name] || item.name || item.title || '—',
    imageUrl: item[schema.image] || item.photo_url || item.poster_url || item.thumbnail_url || item.cover_url || null,
    meta:     schema.meta(item),
    category: schema.category(item),
    location: schema.loc(item),
    _tabKey:  tabKey,
    _raw:     item,
  }))
}

// ─── Pill → specific API endpoint map ────────────────────────────────────────
// Keys match the stripped pill label (emoji removed by SearchHero)
const PILL_ENDPOINTS = {
  all: {
    'Trending':  async ()    => { const [m,s,g] = await Promise.allSettled([enrichApi.moviesPopular(), enrichApi.showsPopular(), enrichApi.popularGames()]); return [...normalizeItems(m.value,'movies').slice(0,4), ...normalizeItems(s.value,'shows').slice(0,4), ...normalizeItems(g.value,'games').slice(0,4)] },
    'Top Rated': async ()    => { const [m,s]   = await Promise.allSettled([enrichApi.moviesPopular(), enrichApi.showsTopRated()]); return [...normalizeItems(m.value,'movies').slice(0,6), ...normalizeItems(s.value,'shows').slice(0,6)] },
    'Near Me':   async (loc) => normalizeItems(await enrichApi.searchPlaces({ query: 'restaurant', type: 'restaurant', ...(loc?{location:loc}:{}) }), 'restaurants'),
    'New':       async ()    => { const [m,s]   = await Promise.allSettled([enrichApi.moviesNowPlaying(), enrichApi.showsAiringToday()]); return [...normalizeItems(m.value,'movies').slice(0,6), ...normalizeItems(s.value,'shows').slice(0,6)] },
  },
  restaurants: {
    'Ramen':      async (loc) => normalizeItems(await enrichApi.searchPlaces({ query: 'ramen',                type: 'restaurant', ...(loc?{location:loc}:{}) }), 'restaurants'),
    'Italian':    async (loc) => normalizeItems(await enrichApi.searchPlaces({ query: 'italian restaurant',  type: 'restaurant', ...(loc?{location:loc}:{}) }), 'restaurants'),
    'Mexican':    async (loc) => normalizeItems(await enrichApi.searchPlaces({ query: 'mexican restaurant',  type: 'restaurant', ...(loc?{location:loc}:{}) }), 'restaurants'),
    'Top Rated':  async (loc) => normalizeItems(await enrichApi.searchPlaces({ query: 'top rated restaurant', type: 'restaurant', ...(loc?{location:loc}:{}) }), 'restaurants'),
    'Open Late':  async (loc) => normalizeItems(await enrichApi.searchPlaces({ query: 'restaurant open late night', type: 'restaurant', ...(loc?{location:loc}:{}) }), 'restaurants'),
  },
  movies: {
    'Sci-Fi':      async () => normalizeItems(await enrichApi.searchMovies('sci-fi'),  'movies'),
    'Comedy':      async () => normalizeItems(await enrichApi.searchMovies('comedy'),  'movies'),
    'Drama':       async () => normalizeItems(await enrichApi.searchMovies('drama'),   'movies'),
    'Now Playing': async () => normalizeItems(await enrichApi.moviesNowPlaying(),      'movies'),
  },
  shows: {
    'Drama':       async () => normalizeItems(await enrichApi.searchShows('drama'),   'shows'),
    'Comedy':      async () => normalizeItems(await enrichApi.searchShows('comedy'),  'shows'),
    'Trending':    async () => normalizeItems(await enrichApi.showsPopular(),          'shows'),
    'New Season':  async () => normalizeItems(await enrichApi.showsAiringToday(),      'shows'),
  },
  books: {
    'Fiction':     async () => normalizeItems(await enrichApi.searchBooks({ query: 'fiction bestseller' }),    'books'),
    'Non-Fiction': async () => normalizeItems(await enrichApi.searchBooks({ query: 'non-fiction bestseller' }),'books'),
    'Sci-Fi':      async () => normalizeItems(await enrichApi.searchBooks({ query: 'science fiction' }),       'books'),
    'Romance':     async () => normalizeItems(await enrichApi.searchBooks({ query: 'romance' }),               'books'),
  },
  hikes: {
    'Easy':      async (loc) => normalizeItems(await enrichApi.searchHikes({ query: 'easy hiking trail',     ...(loc?{location:loc}:{}) }), 'hikes'),
    'Moderate':  async (loc) => normalizeItems(await enrichApi.searchHikes({ query: 'moderate hiking trail', ...(loc?{location:loc}:{}) }), 'hikes'),
    'Hard':      async (loc) => normalizeItems(await enrichApi.searchHikes({ query: 'hard hiking trail',     ...(loc?{location:loc}:{}) }), 'hikes'),
    'Waterfall': async (loc) => normalizeItems(await enrichApi.searchHikes({ query: 'waterfall trail',       ...(loc?{location:loc}:{}) }), 'hikes'),
  },
  games: {
    'Board':    async () => normalizeItems(await enrichApi.searchGames({ query: 'board game' }),  'games'),
    'Party':    async () => normalizeItems(await enrichApi.searchGames({ query: 'party game' }),  'games'),
    'Strategy': async () => normalizeItems(await enrichApi.searchGames({ query: 'strategy' }),    'games'),
    'Trivia':   async () => normalizeItems(await enrichApi.searchGames({ query: 'trivia' }),       'games'),
  },
  arts: {
    'Theater':  async (loc) => normalizeItems(await enrichApi.searchArts({ query: 'theater',    ...(loc?{location:loc}:{}) }), 'arts'),
    'Museum':   async (loc) => normalizeItems(await enrichApi.searchArts({ query: 'museum',     ...(loc?{location:loc}:{}) }), 'arts'),
    'Concerts': async (loc) => normalizeItems(await enrichApi.searchArts({ query: 'concert',    ...(loc?{location:loc}:{}) }), 'arts'),
    'Gallery':  async (loc) => normalizeItems(await enrichApi.searchArts({ query: 'art gallery', ...(loc?{location:loc}:{}) }), 'arts'),
  },
}

// ─── Session state persistence (survives back-navigation) ────────────────────
const SS_EXPLORE_KEY = 'discover_explore'
function saveExploreState(tabKey, searchResults) {
  try { sessionStorage.setItem(SS_EXPLORE_KEY, JSON.stringify({ tabKey, searchResults, ts: Date.now() })) } catch {}
}
function loadExploreState() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SS_EXPLORE_KEY) || 'null')
    if (!s || Date.now() - s.ts > 10 * 60 * 1000) return null
    return s
  } catch { return null }
}

// ─── Bookmarked items via backend API ────────────────────────────────────────

// ─── Starred tab definition ───────────────────────────────────────────────────
const STARRED_TAB = { key: 'starred', label: 'Bookmarked', emoji: '🔖', color: '#f43f5e', headline: 'revisit', eyebrow: 'Your Bookmarks' }

// ─── Tab strip ────────────────────────────────────────────────────────────────
function TabStrip({ tabs, activeKey, onSelect, starredCount }) {
  const allTabs = [...tabs, STARRED_TAB]
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch',
      background: 'var(--bg)',
      borderBottom: '1px solid var(--glass)',
    }}>
      {allTabs.map(tab => {
        const isActive = tab.key === activeKey
        const isSaved  = tab.key === 'starred'
        return (
          <button
            key={tab.key}
            data-active={isActive}
            onClick={() => onSelect(tab.key)}
            style={{
              flex: isSaved ? '0 0 auto' : 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '5px',
              padding: isSaved ? '14px 14px 11px' : '14px 8px 11px',
              background: isActive ? `${tab.color}12` : 'none',
              border: 'none',
              borderBottom: `3px solid ${isActive ? tab.color : 'transparent'}`,
              borderLeft: isSaved ? '1px solid var(--glass)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s',
              position: 'relative',
            }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{tab.emoji}</span>
            <span style={{
              fontSize: '11px', fontWeight: isActive ? 700 : 500,
              color: isActive ? tab.color : 'var(--t3)',
              letterSpacing: '0.01em', whiteSpace: 'nowrap',
            }}>
              {tab.label}
            </span>
            {isSaved && starredCount > 0 && (
              <span style={{
                position: 'absolute', top: '6px', right: '6px',
                background: '#f59e0b', color: '#000',
                fontSize: '9px', fontWeight: 800,
                width: '16px', height: '16px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {starredCount > 9 ? '9+' : starredCount}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Pick card ────────────────────────────────────────────────────────────────
function PickCard({ item, tabKey, tabColor, starred, onStar, onPick, onPoll, onNavigate }) {
  const fallbackBg = item._raw?.bg || `linear-gradient(150deg, var(--s3), var(--s4))`
  const hasImage = !!item.imageUrl
  const tabEmoji = TABS.find(t => t.key === (item._tabKey || tabKey))?.emoji || '✦'

  return (
    <div style={{
      borderRadius: '16px', overflow: 'hidden',
      background: 'var(--s1)', border: '1px solid var(--glass)',
      display: 'flex', flexDirection: 'column',
      transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
      cursor: 'pointer',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.35)'; e.currentTarget.style.borderColor = `${tabColor}44` }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'var(--glass)' }}
    >
      {/* Visual area */}
      <div
        onClick={() => onNavigate(item)}
        style={{
          height: '148px', position: 'relative',
          background: hasImage ? `url(${item.imageUrl}) center/cover no-repeat` : fallbackBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {!hasImage && (
          <span style={{ fontSize: '40px', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}>{tabEmoji}</span>
        )}

        {/* Gradient overlay for readability */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)' }} />

        {/* Bookmark button */}
        <button
          onClick={e => { e.stopPropagation(); onStar(item.id, item) }}
          title={starred ? 'Remove bookmark' : 'Bookmark'}
          style={{
            position: 'absolute', top: '8px', right: '8px',
            width: '28px', height: '28px', borderRadius: '50%',
            background: starred ? 'rgba(244,63,94,0.85)' : 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(6px)',
            border: `1px solid ${starred ? '#f43f5e' : 'rgba(255,255,255,0.15)'}`,
            color: starred ? '#fff' : 'rgba(255,255,255,0.6)',
            fontSize: '13px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
        >
          {starred ? '🔖' : '🔖'}
        </button>

        {/* Category chip */}
        {item.category && (
          <span style={{
            position: 'absolute', bottom: '8px', left: '8px',
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            color: '#fff', fontSize: '10px', fontWeight: 600,
            padding: '3px 8px', borderRadius: '20px', textTransform: 'capitalize',
          }}>
            {item.category}
          </span>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div
          onClick={() => onNavigate(item)}
          style={{
            fontSize: '13px', fontWeight: 700, color: 'var(--t1)', lineHeight: 1.3,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}
        >
          {item.name}
        </div>
        {item.meta && (
          <div style={{ fontSize: '11px', color: 'var(--t3)' }}>{item.meta}</div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
          <button
            onClick={e => { e.stopPropagation(); onPoll(item) }}
            style={{
              flex: 1, padding: '7px 0',
              background: 'var(--s3)', border: '1px solid var(--glass)',
              borderRadius: '8px', fontSize: '11px', fontWeight: 600,
              color: 'var(--t2)', cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--s4)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--s3)'}
          >
            💬 Poll
          </button>
          <button
            onClick={e => { e.stopPropagation(); onPick(item) }}
            style={{
              flex: 1, padding: '7px 0',
              background: tabColor ? `${tabColor}22` : 'rgba(244,63,94,0.12)',
              border: `1px solid ${tabColor ? `${tabColor}44` : 'rgba(244,63,94,0.25)'}`,
              borderRadius: '8px', fontSize: '11px', fontWeight: 700,
              color: tabColor || 'var(--rose)', cursor: 'pointer',
            }}
          >
            Pick →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Trending card ────────────────────────────────────────────────────────────
function TrendingCard({ item, onPick, onPoll, onView }) {
  const isRealEvent = !!item._eventId
  return (
    <div style={{
      flexShrink: 0, width: '200px',
      borderRadius: '14px', overflow: 'hidden',
      background: 'var(--s1)', border: '1px solid var(--glass)',
      transition: 'transform 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = ''}
    >
      <div style={{
        height: '90px', position: 'relative',
        background: item.imageUrl ? `url(${item.imageUrl}) center/cover no-repeat` : (item.bg || 'linear-gradient(150deg, var(--s3), var(--s4))'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: isRealEvent ? 'pointer' : 'default',
      }}
        onClick={isRealEvent ? () => onView(item._eventId) : undefined}
      >
        {!item.imageUrl && <span style={{ fontSize: '28px' }}>{item.emoji}</span>}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)' }} />
        <span style={{
          position: 'absolute', top: '8px', right: '8px',
          background: item.badgeColor || 'var(--rose)',
          color: '#fff', fontSize: '9px', fontWeight: 700,
          padding: '2px 7px', borderRadius: '20px',
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          {item.badge}
        </span>
      </div>
      <div style={{ padding: '10px 10px 12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t1)', marginBottom: '2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {item.name}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--t3)', marginBottom: '8px', display: 'flex', gap: '6px' }}>
          {item.group && <span>👥 {item.group}</span>}
          {item.rating && <span>★ {item.rating}</span>}
        </div>
        {isRealEvent ? (
          <button
            onClick={() => onView(item._eventId)}
            style={{ width: '100%', padding: '5px 0', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '7px', fontSize: '10px', fontWeight: 700, color: 'var(--rose)', cursor: 'pointer' }}
          >
            View Event →
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              onClick={() => onPoll(item)}
              style={{ flex: 1, padding: '5px 0', background: 'var(--s3)', border: '1px solid var(--glass)', borderRadius: '7px', fontSize: '10px', fontWeight: 600, color: 'var(--t2)', cursor: 'pointer' }}
            >
              Poll
            </button>
            <button
              onClick={() => onPick(item)}
              style={{ flex: 1, padding: '5px 0', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '7px', fontSize: '10px', fontWeight: 700, color: 'var(--rose)', cursor: 'pointer' }}
            >
              Pick →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ borderRadius: '16px', overflow: 'hidden', background: 'var(--s1)', border: '1px solid var(--glass)' }}>
      <div style={{ height: '148px', background: 'var(--s2)', animation: 'cpShimmer 1.4s ease-in-out infinite' }} />
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ height: '13px', borderRadius: '6px', background: 'var(--s2)', marginBottom: '6px', animation: 'cpShimmer 1.4s ease-in-out infinite' }} />
        <div style={{ height: '11px', borderRadius: '6px', background: 'var(--s2)', width: '60%', animation: 'cpShimmer 1.4s ease-in-out infinite' }} />
      </div>
    </div>
  )
}

// ─── Activity type → badge colors ────────────────────────────────────────────
const ACTIVITY_BADGE = {
  dining:  { badge: 'Upcoming Eat',     badgeColor: '#f97316', emoji: '🍽️' },
  movies:  { badge: 'Movie Night',      badgeColor: '#6366f1', emoji: '🎬' },
  shows:   { badge: 'Watch Party',      badgeColor: '#a855f7', emoji: '📺' },
  books:   { badge: 'Book Club',        badgeColor: '#f59e0b', emoji: '📚' },
  hiking:  { badge: 'Outdoor Plan',     badgeColor: '#14b8a6', emoji: '🥾' },
  gaming:  { badge: 'Game Night',       badgeColor: '#22d3a0', emoji: '🎮' },
  arts:    { badge: 'Arts & Culture',   badgeColor: '#ec4899', emoji: '🎨' },
}

// activity_type string → tab key (for filtering)
const ACTIVITYTYPE_TO_TAB = {
  dining:  'restaurants',
  movies:  'movies',
  shows:   'shows',
  books:   'books',
  hiking:  'hikes',
  gaming:  'games',
  arts:    'arts',
}

// ─── Fetch real trending events from user's groups ────────────────────────────
async function fetchGroupTrending(userId) {
  try {
    const groups = await groupsApi.getUserGroups(userId)
    if (!groups?.length) return []

    // Fetch scheduled events for each group (cap at 5 groups to avoid too many requests)
    const groupSlice = groups.slice(0, 5)
    const results = await Promise.allSettled(
      groupSlice.map(g => eventsApi.getGroupEvents(g.id, 'scheduled').then(events => ({ group: g, events })))
    )

    const items = []
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      const { group, events } = r.value
      const eventList = Array.isArray(events) ? events : (events?.events ?? [])
      for (const ev of eventList.slice(0, 3)) {
        const actType = ev.activity_type || ev.type || null
        const badge = ACTIVITY_BADGE[actType] || { badge: 'Upcoming', badgeColor: '#f43f5e', emoji: '✦' }
        items.push({
          id:         `ev_${ev.id}`,
          name:       ev.title || ev.name || 'Untitled Event',
          badge:      badge.badge,
          badgeColor: badge.badgeColor,
          emoji:      badge.emoji,
          bg:         null,
          imageUrl:   ev.cover_url || null,
          group:      group.name,
          rating:     null,
          _eventId:   ev.id,
          _actType:   actType,
          _tabKey:    ACTIVITYTYPE_TO_TAB[actType] || 'all',
        })
      }
    }
    // Sort: show items with images first, then by group
    return items
  } catch {
    return []
  }
}

// ─── Fetch real tab data ──────────────────────────────────────────────────────
async function fetchTabItems(userId, tab) {
  if (!tab.apiType) return null
  try {
    const data = await enrichApi.getUserDiscover(userId, tab.apiType)
    if (data?.setup_required) return null
    const items = normalizeItems(data, tab.key)
    return items.length ? items : null
  } catch {
    try {
      let data
      if (tab.key === 'movies')  data = await enrichApi.moviesPopular()
      else if (tab.key === 'shows')  data = await enrichApi.showsPopular()
      else if (tab.key === 'games')  data = await enrichApi.popularGames()
      else return null
      const items = normalizeItems(data, tab.key)
      return items.length ? items : null
    } catch { return null }
  }
}

// Pref activity keys → tab apiType (they already match except these)
const PREF_TO_APITYPE = { hiking: 'hiking', gaming: 'gaming' }
const apiTypeFromPref = (p) => PREF_TO_APITYPE[p] ?? p

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DiscoverExplore() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeTabKey, setActiveTabKey] = useState(() => loadExploreState()?.tabKey || 'all')
  const [preferredActivities, setPreferredActivities] = useState([])
  const [picks, setPicks] = useState({})
  const [loading, setLoading] = useState({})
  const [searchResults, setSearchResults] = useState(() => loadExploreState()?.searchResults ?? null)
  const [starred, setStarred] = useState(() => new Set())
  const [starredItemsList, setStarredItemsList] = useState([])
  const [pickItem, setPickItem] = useState(null)  // { name, location, tabKey }
  const [pollItem, setPollItem] = useState(null)  // { name, tabKey }
  const [trendingItems, setTrendingItems] = useState([])
  const [trendingLoaded, setTrendingLoaded] = useState(false)

  const activeTab = TABS.find(t => t.key === activeTabKey) || TABS[0]

  // Map tab key → apiType (for modals)
  const tabApiType = activeTab?.apiType

  const handleTabSelect = (key) => {
    setActiveTabKey(key)
    setSearchResults(null)
    saveExploreState(key, null)
  }

  const isStarredView = activeTabKey === 'starred'

  // Load bookmarks from backend on mount
  useEffect(() => {
    if (!user?.id) return
    gatewayClient.get('/users/me/saved')
      .then(res => {
        const raw = Array.isArray(res.data) ? res.data : []
        setStarred(new Set(raw.map(it => String(it.item_id))))
        setStarredItemsList(raw.map(it => ({
          id: it.item_id,
          _tabKey: it.item_type,
          title: it.item_name,
          name: it.item_name,
          img: it.item_meta?.photo || null,
          sub: it.item_meta?.subtitle || null,
          rating: it.item_meta?.rating || null,
        })))
      })
      .catch(() => {})
  }, [user?.id])

  // Load user prefs to filter tabs
  useEffect(() => {
    if (!user?.id) return
    gatewayClient.get(`/users/${user.id}/preferences`)
      .then(res => {
        const acts = res.data?.activities ?? res.data?.prefs?.activities ?? []
        if (Array.isArray(acts) && acts.length > 0) setPreferredActivities(acts)
      })
      .catch(() => {})
  }, [user?.id])

  // Tabs visible to user — always show "all"; show others only if in user prefs (or no prefs set)
  const visibleTabs = TABS.filter(t =>
    t.key === 'all' || !preferredActivities.length ||
    preferredActivities.some(p => apiTypeFromPref(p) === t.apiType)
  )

  // Load real popular data for the "All" tab on mount
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    setLoading(l => ({ ...l, all: true }))
    Promise.allSettled([
      enrichApi.moviesPopular(),
      enrichApi.showsPopular(),
      enrichApi.popularGames(),
    ]).then(([movies, shows, games]) => {
      if (cancelled) return
      const items = [
        ...normalizeItems(movies.value, 'movies').slice(0, 2).map(i => ({ ...i, _tabKey: 'movies' })),
        ...normalizeItems(shows.value, 'shows').slice(0, 2).map(i => ({ ...i, _tabKey: 'shows' })),
        ...normalizeItems(games.value, 'games').slice(0, 2).map(i => ({ ...i, _tabKey: 'games' })),
      ]
      if (items.length) setPicks(p => ({ ...p, all: items }))
      setLoading(l => ({ ...l, all: false }))
    })
    return () => { cancelled = true }
  }, [user?.id])

  // Load real data for a tab on first visit
  useEffect(() => {
    if (!user?.id || picks[activeTabKey] || !activeTab?.apiType) return
    let cancelled = false
    setLoading(l => ({ ...l, [activeTabKey]: true }))
    fetchTabItems(user.id, activeTab).then(items => {
      if (cancelled) return
      setPicks(p => ({ ...p, [activeTabKey]: items || MOCK_PICKS[activeTabKey] || [] }))
      setLoading(l => ({ ...l, [activeTabKey]: false }))
    })
    return () => { cancelled = true }
  }, [activeTabKey, user?.id])

  // Load real trending data from user's groups (once on mount)
  useEffect(() => {
    if (!user?.id || trendingLoaded) return
    setTrendingLoaded(true)
    fetchGroupTrending(user.id).then(items => {
      if (items.length) setTrendingItems(items)
    })
  }, [user?.id])

  // Search handler (called by SearchHero on query or pill click)
  const handleSearch = useCallback(async (query, location) => {
    if (!query && !location) { setSearchResults(null); return }

    // ── Pill shortcut: exact-match stripped label → dedicated endpoint ──
    const pillFn = query && PILL_ENDPOINTS[activeTabKey]?.[query]
    if (pillFn) {
      try { setSearchResults(await pillFn(location) || []) }
      catch { setSearchResults([]) }
      return
    }

    // ── Generic text search ──
    const tab = TABS.find(t => t.key === activeTabKey)
    if (!tab?.apiType) {
      // 'all' tab with a text query — search across movies, shows, books (+ restaurants if location set)
      if (activeTabKey === 'all' && query) {
        try {
          const [movies, shows, books] = await Promise.allSettled([
            enrichApi.searchMovies(query),
            enrichApi.searchShows(query),
            enrichApi.searchBooks({ query }),
          ])
          const combined = [
            ...normalizeItems(movies.value, 'movies').slice(0, 4).map(i => ({ ...i, _tabKey: 'movies' })),
            ...normalizeItems(shows.value, 'shows').slice(0, 4).map(i => ({ ...i, _tabKey: 'shows' })),
            ...normalizeItems(books.value, 'books').slice(0, 4).map(i => ({ ...i, _tabKey: 'books' })),
          ]
          if (location) {
            const places = await enrichApi.searchPlaces({ query, type: 'restaurant', location }).catch(() => null)
            if (places) combined.unshift(...normalizeItems(places, 'restaurants').slice(0, 4).map(i => ({ ...i, _tabKey: 'restaurants' })))
          }
          const results = combined.length ? combined : []
          setSearchResults(results)
          saveExploreState(activeTabKey, results)
        } catch { setSearchResults([]) }
      } else if (activeTabKey === 'all' && location) {
        // Location changed with no query on 'all' tab — show nearby restaurants
        try {
          const data = await enrichApi.searchPlaces({ query: 'restaurant', type: 'restaurant', location })
          const results = normalizeItems(data, 'restaurants').map(i => ({ ...i, _tabKey: 'restaurants' }))
          setSearchResults(results)
          saveExploreState(activeTabKey, results)
        } catch { setSearchResults([]) }
      } else {
        setSearchResults(null)
        saveExploreState(activeTabKey, null)
      }
      return
    }
    try {
      const q = query || ''
      const loc = location
      let data
      if (tab.key === 'restaurants') data = await enrichApi.searchPlaces({ query: q || 'restaurant', type: 'restaurant', ...(loc ? { location: loc } : {}) })
      else if (tab.key === 'movies')  data = await enrichApi.searchMovies(q || 'popular')
      else if (tab.key === 'shows')   data = await enrichApi.searchShows(q || 'popular')
      else if (tab.key === 'books')   data = await enrichApi.searchBooks({ query: q || 'bestseller' })
      else if (tab.key === 'hikes')   data = await enrichApi.searchHikes({ query: q || 'hiking trail', ...(loc ? { location: loc } : {}) })
      else if (tab.key === 'games')   data = await enrichApi.searchGames({ query: q || 'popular' })
      else if (tab.key === 'arts')    data = await enrichApi.searchArts({ query: q || 'museum', ...(loc ? { location: loc } : {}) })
      const results = normalizeItems(data, tab.key)
      setSearchResults(results)
      saveExploreState(activeTabKey, results)
    } catch { setSearchResults([]) }
  }, [activeTabKey])

  const handleStar = (id, item) => {
    const strId = String(id)
    const itemType = item?._tabKey || activeTabKey || 'dining'
    if (starred.has(strId)) {
      setStarred(prev => { const next = new Set(prev); next.delete(strId); return next })
      setStarredItemsList(prev => prev.filter(it => String(it.id) !== strId))
      gatewayClient.delete(`/users/me/saved/${itemType}/${encodeURIComponent(strId)}`).catch(() => {})
    } else {
      setStarred(prev => new Set([...prev, strId]))
      setStarredItemsList(prev => [{
        id: strId, _tabKey: itemType,
        title: item?.name || item?.title || strId,
        name: item?.name || item?.title || strId,
        img: item?.img || null,
        sub: item?.sub || null,
        rating: item?.rating || null,
      }, ...prev])
      gatewayClient.post('/users/me/saved', {
        item_type: itemType,
        item_id: strId,
        item_name: item?.name || item?.title || strId,
        item_meta: { photo: item?.img, subtitle: item?.sub, rating: item?.rating },
      }).catch(() => {})
    }
  }

  const handlePick = (item) => {
    const raw = item._raw || {}
    const description = (raw.overview || raw.synopsis || raw.description || raw.about || raw.summary || '').trim() || null
    setPickItem({ name: item.name, location: item.location, imageUrl: item.imageUrl || null, tabKey: item._tabKey || activeTabKey, description })
  }
  const handlePoll = (item) => {
    setPollItem({ name: item.name, tabKey: item._tabKey || activeTabKey })
  }

  const handleNavigate = (item) => {
    const tabKey = item._tabKey || activeTabKey
    // Mock items don't have real API IDs — navigate to the category explore page instead
    if (item._isMock) {
      const tabRoute = TABS.find(t => t.key === tabKey)?.route
      if (tabRoute) navigate(tabRoute)
      return
    }
    const routeFn = DETAIL_ROUTE[tabKey]
    if (routeFn && item.id) navigate(routeFn(item.id))
  }

  const displayPicks = searchResults ?? picks[activeTabKey] ?? MOCK_PICKS[activeTabKey] ?? []

  // Filter trending items by active tab (show all on 'all' tab)
  const filteredTrending = activeTabKey === 'all'
    ? trendingItems
    : trendingItems.filter(i => i._tabKey === activeTabKey || i._tabKey === 'all')

  const isLoading = loading[activeTabKey]

  const handleViewEvent = (eventId) => navigate(`/events/${eventId}`)

  // Resolve apiType for modals from tabKey
  const getApiType = (tabKey) => TABS.find(t => t.key === tabKey)?.apiType || tabKey

  return (
    <AppShell>
      <style>{`
        @keyframes cpShimmer { 0%,100%{opacity:.5} 50%{opacity:.9} }
      `}</style>

      <TabStrip tabs={visibleTabs} activeKey={activeTabKey} onSelect={handleTabSelect} starredCount={starred.size} />

      {/* ── Starred view ── */}
      {isStarredView ? (
        <div style={{ padding: '28px 24px 40px', maxWidth: '1200px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t1)', margin: 0 }}>🔖 Bookmarks</h2>
            <span style={{ fontSize: '12px', color: 'var(--t4)' }}>{starredItemsList.length} bookmarked</span>
          </div>
          {starredItemsList.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--s1)', border: '1px solid var(--glass)', borderRadius: '16px' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔖</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t2)', marginBottom: '4px' }}>No bookmarks yet</div>
              <div style={{ fontSize: '12px', color: 'var(--t3)' }}>Tap 🔖 on any card to bookmark it</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '14px' }}>
              {starredItemsList.map(item => {
                const itemTab = TABS.find(t => t.key === (item._tabKey)) || TABS[0]
                return (
                  <PickCard
                    key={item.id}
                    item={item}
                    tabKey={item._tabKey || 'all'}
                    tabColor={itemTab.color}
                    starred={true}
                    onStar={handleStar}
                    onPick={handlePick}
                    onPoll={handlePoll}
                    onNavigate={handleNavigate}
                  />
                )
              })}
            </div>
          )}
        </div>
      ) : (
      <>

      {/* SearchHero — z-index keeps location dropdown above the card grid */}
      <div style={{ position: 'relative', zIndex: 30 }}>
        <SearchHero
          key={activeTabKey}
          eyebrow={activeTab?.eyebrow}
          headline={`${activeTab?.locBased === false ? 'What' : 'Where'} do you want to ${activeTab?.headline}?`}
          suggestions={PILLS[activeTabKey] ?? []}
          onSearch={handleSearch}
          hideLocation={activeTab?.locBased === false}
        />
      </div>

      <div style={{ padding: '28px 24px 40px', maxWidth: '1200px', position: 'relative', zIndex: 1 }}>

        {/* ── Picks ── */}
        <div style={{ marginBottom: '44px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t1)', margin: 0 }}>
              {searchResults !== null ? 'Search Results' : 'Picks for You'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {searchResults !== null && (
                <button
                  onClick={() => { setSearchResults(null); saveExploreState(activeTabKey, null) }}
                  style={{ fontSize: '12px', color: 'var(--rose)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  ✕ Clear
                </button>
              )}
              {searchResults === null && displayPicks.length > 0 && (
                <span style={{ fontSize: '12px', color: 'var(--t4)' }}>{displayPicks.length} picks</span>
              )}
            </div>
          </div>

          {isLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '14px' }}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : displayPicks.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--s1)', border: '1px solid var(--glass)', borderRadius: '16px' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>{activeTab?.emoji}</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t2)', marginBottom: '4px' }}>
                {searchResults !== null ? 'No results found' : 'No picks yet'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--t3)' }}>
                {searchResults !== null ? 'Try a different search or location' : 'Try a search term or filter above'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '14px' }}>
              {displayPicks.map(item => (
                <PickCard
                  key={item.id}
                  item={item}
                  tabKey={activeTabKey}
                  tabColor={activeTab?.color}
                  starred={starred.has(String(item.id))}
                  onStar={handleStar}
                  onPick={handlePick}
                  onPoll={handlePoll}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Trending ── */}
        {searchResults === null && filteredTrending.length > 0 && (
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--t1)', marginBottom: '16px' }}>
              Upcoming in Your Groups
            </h2>
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {filteredTrending.map(item => (
                <TrendingCard key={item.id} item={item} onPick={handlePick} onPoll={handlePoll} onView={handleViewEvent} />
              ))}
            </div>
          </div>
        )}

      </div>

      </> /* end non-starred view */
      )}

      {/* ── Create Event modal ── */}
      {pickItem && (
        <CreateEventModal
          isOpen={true}
          initialTitle={pickItem.name}
          initialLocation={pickItem.location}
          initialImageUrl={pickItem.imageUrl}
          initialDescription={pickItem.description}
          activityType={getApiType(pickItem.tabKey)}
          onClose={() => setPickItem(null)}
          onCreated={(id) => { setPickItem(null); navigate(`/events/${id}`) }}
          onPollGroup={({ title }) => { setPickItem(null); setPollItem({ name: title, tabKey: pickItem.tabKey }) }}
        />
      )}

      {/* ── Create Poll modal ── */}
      <CreatePollModal
        isOpen={!!pollItem}
        onClose={() => setPollItem(null)}
        activityName={pollItem?.name}
        activityType={pollItem ? getApiType(pollItem.tabKey) : undefined}
        onCreated={() => setPollItem(null)}
      />
    </AppShell>
  )
}
