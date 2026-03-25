// ─── Tab definitions ──────────────────────────────────────────────────────────
export const TABS = [
  { key: 'all',         label: 'All',        emoji: '✦',  color: '#f43f5e', headline: 'go next',   eyebrow: 'Explore Everything',   route: null,                     apiType: null      },
  { key: 'restaurants', label: 'Eats',        emoji: '🍽️', color: '#f97316', headline: 'eat',       eyebrow: 'Find somewhere to eat', route: '/discover/restaurants', apiType: 'dining'  },
  { key: 'movies',      label: 'Movies',      emoji: '🎬', color: '#6366f1', headline: 'watch',     eyebrow: 'Pick a movie night',    route: '/discover/movies',      apiType: 'movies',  locBased: false },
  { key: 'shows',       label: 'TV Shows',    emoji: '📺', color: '#a855f7', headline: 'binge',     eyebrow: 'Find your next series', route: '/discover/shows',       apiType: 'shows',   locBased: false },
  { key: 'books',       label: 'Books',       emoji: '📚', color: '#f59e0b', headline: 'read',      eyebrow: 'Find your next read',   route: '/discover/books',       apiType: 'books'   },
  { key: 'hikes',       label: 'Hikes',       emoji: '🥾', color: '#14b8a6', headline: 'explore',   eyebrow: 'Get outside together',  route: '/discover/hikes',       apiType: 'hiking'  },
  { key: 'games',       label: 'Games',       emoji: '🎮', color: '#22d3a0', headline: 'play',      eyebrow: 'Plan a game night',     route: '/discover/games',       apiType: 'gaming',  locBased: false },
  { key: 'arts',        label: 'Arts',        emoji: '🎨', color: '#ec4899', headline: 'see',       eyebrow: 'Explore culture',       route: '/discover/arts',        apiType: 'arts'    },
]

// ─── Quick-search pills per tab ───────────────────────────────────────────────
export const PILLS = {
  all:         ['🔥 Trending', '⭐ Top Rated', '📍 Near Me', '🆕 New'],
  restaurants: ['🍜 Ramen', '🍕 Italian', '🌮 Mexican', '⭐ Top Rated', '🌙 Open Late'],
  movies:      ['🚀 Sci-Fi', '😂 Comedy', '🎭 Drama', '🔥 Now Playing'],
  shows:       ['📺 Drama', '😂 Comedy', '🔥 Trending', '✨ New Season'],
  books:       ['📖 Fiction', '🧠 Non-Fiction', '🔮 Sci-Fi', '❤️ Romance'],
  hikes:       ['🌿 Easy', '⛰️ Moderate', '🏔️ Hard', '🌊 Waterfall'],
  games:       ['🎲 Board', '🕹️ Party', '🧩 Strategy', '🎯 Trivia'],
  arts:        ['🎭 Theater', '🏛️ Museum', '🎵 Concerts', '🖼️ Gallery'],
}

// ─── Mock picks (fallback / skeleton data) ───────────────────────────────────
export const MOCK_PICKS = {
  restaurants: [
    { id: 'r1', name: "Stephanie's on Newbury", meta: '★ 4.7 · $$$',  emoji: '🥂', bg: 'linear-gradient(150deg,#312e81,#4c1d95)', category: 'Fine Dining',  location: '190 Newbury St, Boston' },
    { id: 'r2', name: 'Mooo Beacon Hill',        meta: '★ 4.5 · $$$$', emoji: '🥩', bg: 'linear-gradient(150deg,#7c2d12,#9a3412)', category: 'Steakhouse',   location: '15 Beacon St, Boston'   },
    { id: 'r3', name: 'Harpoon Brewery',          meta: '★ 4.3 · $$',  emoji: '🍺', bg: 'linear-gradient(150deg,#1e3a5f,#1d4ed8)', category: 'Brewery',      location: '306 Northern Ave'        },
    { id: 'r4', name: 'Olive Garden',             meta: '★ 4.1 · $$',  emoji: '🍝', bg: 'linear-gradient(150deg,#14532d,#166534)', category: 'Italian',      location: '100 Cambridgeside Pl'    },
    { id: 'r5', name: 'The Paramount',            meta: '★ 4.6 · $$$', emoji: '🥞', bg: 'linear-gradient(150deg,#881337,#9f1239)', category: 'American',     location: '44 Charles St, Boston'   },
    { id: 'r6', name: 'Toro',                     meta: '★ 4.8 · $$$', emoji: '🫙', bg: 'linear-gradient(150deg,#78350f,#92400e)', category: 'Spanish',      location: '1704 Washington St'      },
  ],
  movies: [
    { id: 'm1', name: 'The Last Nebula', meta: '2024 · Sci-Fi',   emoji: '🌌', bg: 'linear-gradient(150deg,#0f172a,#1e1b4b)', category: 'Sci-Fi'   },
    { id: 'm2', name: 'Echo Protocol',  meta: '2024 · Thriller',  emoji: '🤖', bg: 'linear-gradient(150deg,#022c22,#064e3b)', category: 'Thriller' },
    { id: 'm3', name: 'Wildfire',        meta: '2024 · Drama',    emoji: '🔥', bg: 'linear-gradient(150deg,#450a0a,#7f1d1d)', category: 'Drama'    },
  ],
  shows: [
    { id: 's1', name: 'Orbital Drift', meta: 'S2 · Sci-Fi',   emoji: '🛸', bg: 'linear-gradient(150deg,#0c1445,#1e3a5f)', category: 'Sci-Fi'   },
    { id: 's2', name: 'The Watcher',   meta: 'S1 · Thriller',  emoji: '👁️', bg: 'linear-gradient(150deg,#1a0533,#2d1b4e)', category: 'Thriller' },
    { id: 's3', name: 'Greenfield',    meta: 'S3 · Drama',     emoji: '🌿', bg: 'linear-gradient(150deg,#052e16,#14532d)', category: 'Drama'    },
  ],
  books: [
    { id: 'b1', name: 'The Folded Map',   meta: 'Literary Fiction', emoji: '🗺️', bg: 'linear-gradient(150deg,#1c1917,#44403c)', category: 'Fiction' },
    { id: 'b2', name: 'Soft Machines',    meta: 'Sci-Fi',           emoji: '⚙️', bg: 'linear-gradient(150deg,#030712,#111827)', category: 'Sci-Fi'  },
    { id: 'b3', name: 'Under Salt Water', meta: 'Literary Fiction', emoji: '🌊', bg: 'linear-gradient(150deg,#082f49,#164e63)', category: 'Fiction' },
  ],
  hikes: [
    { id: 'h1', name: 'Crystal Lake Loop', meta: '4.2 mi · Moderate', emoji: '💎', bg: 'linear-gradient(150deg,#082f49,#0c4a6e)', category: 'Lake'   },
    { id: 'h2', name: 'Blue Hills Summit', meta: '6.1 mi · Hard',     emoji: '🏔️', bg: 'linear-gradient(150deg,#0c1445,#1e3a5f)', category: 'Summit' },
    { id: 'h3', name: 'Skyline Ridge',     meta: '3.8 mi · Easy',     emoji: '🌄', bg: 'linear-gradient(150deg,#1a2e05,#365314)', category: 'Ridge'  },
  ],
  games: [
    { id: 'g1', name: 'Trivia Night Live', meta: 'Party · 4–12 players', emoji: '🧠', bg: 'linear-gradient(150deg,#2e1065,#4c1d95)', category: 'Trivia'    },
    { id: 'g2', name: 'Catan Online',      meta: 'Strategy · 3–6',       emoji: '🏝️', bg: 'linear-gradient(150deg,#431407,#7c2d12)', category: 'Strategy'  },
    { id: 'g3', name: 'Jackbox Party 9',   meta: 'Party · 2–8 players',  emoji: '🎪', bg: 'linear-gradient(150deg,#3b0764,#581c87)', category: 'Party'     },
  ],
  arts: [
    { id: 'a1', name: 'ICA Boston',             meta: 'Contemporary Art', emoji: '🖼️', bg: 'linear-gradient(150deg,#0f172a,#1e1b4b)', category: 'Museum'  },
    { id: 'a2', name: 'Boston Symphony Hall',   meta: 'Classical Music',  emoji: '🎻', bg: 'linear-gradient(150deg,#1c1917,#292524)', category: 'Concert' },
    { id: 'a3', name: 'Huntington Theatre',     meta: 'Live Theater',     emoji: '🎭', bg: 'linear-gradient(150deg,#2e1065,#4a044e)', category: 'Theater' },
  ],
}

// Tag all mock items so the UI knows not to navigate to detail pages
Object.keys(MOCK_PICKS).forEach(key => {
  MOCK_PICKS[key] = MOCK_PICKS[key].map(i => ({ ...i, _isMock: true }))
})

MOCK_PICKS.all = [
  ...MOCK_PICKS.restaurants.slice(0, 2).map(i => ({ ...i, _tabKey: 'restaurants', _isMock: true })),
  { ...MOCK_PICKS.movies[0], _tabKey: 'movies', _isMock: true },
  { ...MOCK_PICKS.hikes[0],  _tabKey: 'hikes',  _isMock: true },
  { ...MOCK_PICKS.shows[0],  _tabKey: 'shows',  _isMock: true },
  { ...MOCK_PICKS.books[0],  _tabKey: 'books',  _isMock: true },
]

// ─── Trending in your groups (mock — no dedicated API endpoint yet) ───────────
export const MOCK_TRENDING = {
  all: [
    { id: 't1', name: 'The Last Nebula',   type: 'Movie',      badge: 'Upcoming',   badgeColor: '#6366f1', emoji: '🌌', bg: 'linear-gradient(150deg,#0f172a,#1e1b4b)', group: 'Movie Nights',    rating: 4.8 },
    { id: 't2', name: 'Vino & Verve',      type: 'Restaurant', badge: 'Top Choice', badgeColor: '#22d3a0', emoji: '🥂', bg: 'linear-gradient(150deg,#312e81,#4c1d95)', group: 'Food Crew',       rating: 4.6 },
    { id: 't3', name: 'Crystal Lake Loop', type: 'Hike',       badge: 'Outdoor',    badgeColor: '#14b8a6', emoji: '💎', bg: 'linear-gradient(150deg,#082f49,#0c4a6e)', group: 'Adventure Squad', rating: 4.5 },
  ],
  restaurants: [
    { id: 't4', name: 'Vino & Verve',  type: 'Restaurant', badge: 'Top Choice', badgeColor: '#22d3a0', emoji: '🥂', bg: 'linear-gradient(150deg,#312e81,#4c1d95)', group: 'Food Crew',   rating: 4.6 },
    { id: 't5', name: 'Ichigo Ramen',   type: 'Restaurant', badge: 'New Pick',   badgeColor: '#f43f5e', emoji: '🍜', bg: 'linear-gradient(150deg,#450a0a,#7f1d1d)', group: 'Ramen Gang',  rating: 4.7 },
  ],
  movies: [
    { id: 't6', name: 'The Last Nebula', type: 'Movie', badge: 'Upcoming', badgeColor: '#6366f1', emoji: '🌌', bg: 'linear-gradient(150deg,#0f172a,#1e1b4b)', group: 'Movie Nights', rating: 4.8 },
    { id: 't7', name: 'Wildfire',         type: 'Movie', badge: 'Trending', badgeColor: '#f97316', emoji: '🔥', bg: 'linear-gradient(150deg,#450a0a,#7f1d1d)', group: 'Film Club',    rating: 4.3 },
  ],
  shows: [
    { id: 't8', name: 'Orbital Drift', type: 'TV Show', badge: 'New Season', badgeColor: '#a855f7', emoji: '🛸', bg: 'linear-gradient(150deg,#0c1445,#1e3a5f)', group: 'Binge Club',    rating: 4.6 },
    { id: 't9', name: 'The Watcher',   type: 'TV Show', badge: 'Trending',   badgeColor: '#f43f5e', emoji: '👁️', bg: 'linear-gradient(150deg,#1a0533,#2d1b4e)', group: 'Watch Party',   rating: 4.4 },
  ],
  books: [
    { id: 't10', name: 'The Folded Map',   type: 'Book', badge: 'Trending', badgeColor: '#f59e0b', emoji: '🗺️', bg: 'linear-gradient(150deg,#1c1917,#44403c)', group: 'Book Club',  rating: 4.4 },
    { id: 't11', name: 'Under Salt Water', type: 'Book', badge: 'New',      badgeColor: '#22d3a0', emoji: '🌊', bg: 'linear-gradient(150deg,#082f49,#164e63)', group: 'Readers Co', rating: 4.6 },
  ],
  hikes: [
    { id: 't12', name: 'Crystal Lake Loop', type: 'Hike', badge: 'Outdoor', badgeColor: '#14b8a6', emoji: '💎', bg: 'linear-gradient(150deg,#082f49,#0c4a6e)', group: 'Adventure Squad', rating: 4.5 },
    { id: 't13', name: 'Blue Hills Summit', type: 'Hike', badge: 'Hard',    badgeColor: '#f43f5e', emoji: '🏔️', bg: 'linear-gradient(150deg,#0c1445,#1e3a5f)', group: 'Trail Blazers',   rating: 4.7 },
  ],
  games: [
    { id: 't14', name: 'Trivia Night Live', type: 'Game', badge: 'Party',    badgeColor: '#22d3a0', emoji: '🧠', bg: 'linear-gradient(150deg,#2e1065,#4c1d95)', group: 'Game Night',  rating: 4.9 },
    { id: 't15', name: 'Catan Online',      type: 'Game', badge: 'Strategy', badgeColor: '#f59e0b', emoji: '🏝️', bg: 'linear-gradient(150deg,#431407,#7c2d12)', group: 'Board Crew',  rating: 4.5 },
  ],
  arts: [
    { id: 't16', name: 'ICA Boston',            type: 'Arts', badge: 'Exhibit', badgeColor: '#ec4899', emoji: '🖼️', bg: 'linear-gradient(150deg,#0f172a,#1e1b4b)', group: 'Art Lovers', rating: 4.5 },
    { id: 't17', name: 'Boston Symphony Hall',  type: 'Arts', badge: 'Concert', badgeColor: '#a855f7', emoji: '🎻', bg: 'linear-gradient(150deg,#1c1917,#292524)', group: 'Culture Club', rating: 4.8 },
  ],
}
