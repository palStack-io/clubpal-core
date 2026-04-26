export const ACTIVITY_CONFIG = {
  dining: {
    key: 'dining',
    label: 'Dining',
    emoji: '🍽️',
    color: '#f43f5e',
    soft: '#fb7185',
    dim: '#fda4af',
    bg: 'rgba(244,63,94,0.14)',
    border: 'rgba(244,63,94,0.28)',
    rgb: '244,63,94',
  },
  movies: {
    key: 'movies',
    label: 'Movies',
    emoji: '🎬',
    color: '#6366f1',
    soft: '#818cf8',
    dim: '#a5b4fc',
    bg: 'rgba(99,102,241,0.14)',
    border: 'rgba(99,102,241,0.28)',
    rgb: '99,102,241',
  },
  books: {
    key: 'books',
    label: 'Books',
    emoji: '📚',
    color: '#a855f7',
    soft: '#c084fc',
    dim: '#d8b4fe',
    bg: 'rgba(168,85,247,0.14)',
    border: 'rgba(168,85,247,0.28)',
    rgb: '168,85,247',
  },
  hiking: {
    key: 'hiking',
    label: 'Hiking',
    emoji: '🥾',
    color: '#14b8a6',
    soft: '#2dd4bf',
    dim: '#5eead4',
    bg: 'rgba(20,184,166,0.14)',
    border: 'rgba(20,184,166,0.28)',
    rgb: '20,184,166',
  },
  gaming: {
    key: 'gaming',
    label: 'Gaming',
    emoji: '🎮',
    color: '#22d3a0',
    soft: '#34d399',
    dim: '#6ee7b7',
    bg: 'rgba(34,211,160,0.14)',
    border: 'rgba(34,211,160,0.28)',
    rgb: '34,211,160',
  },
  arts: {
    key: 'arts',
    label: 'Arts',
    emoji: '🎨',
    color: '#f59e0b',
    soft: '#fbbf24',
    dim: '#fcd34d',
    bg: 'rgba(245,158,11,0.14)',
    border: 'rgba(245,158,11,0.28)',
    rgb: '245,158,11',
  },
  other: {
    key: 'other',
    label: 'Other',
    emoji: '✨',
    color: '#64748b',
    soft: '#94a3b8',
    dim: '#cbd5e1',
    bg: 'rgba(100,116,139,0.14)',
    border: 'rgba(100,116,139,0.28)',
    rgb: '100,116,139',
  },
};

export const ACTIVITY_LIST = Object.values(ACTIVITY_CONFIG);

/** Map a group emoji or activity_type string to an activity config entry. */
export function resolveActivity(hint) {
  if (!hint) return ACTIVITY_CONFIG.dining;
  const h = hint.toLowerCase();
  if (h.includes('dining') || h.includes('food') || h.includes('restaurant') || h.includes('🍽') || h.includes('🍜') || h.includes('🍣') || h.includes('🍕')) return ACTIVITY_CONFIG.dining;
  if (h.includes('movie') || h.includes('film') || h.includes('cinema') || h.includes('🎬') || h.includes('🎥')) return ACTIVITY_CONFIG.movies;
  if (h.includes('book') || h.includes('read') || h.includes('📚') || h.includes('📖')) return ACTIVITY_CONFIG.books;
  if (h.includes('hik') || h.includes('trail') || h.includes('outdoor') || h.includes('🥾') || h.includes('🏔')) return ACTIVITY_CONFIG.hiking;
  if (h.includes('game') || h.includes('gaming') || h.includes('🎮') || h.includes('🕹')) return ACTIVITY_CONFIG.gaming;
  if (h.includes('art') || h.includes('museum') || h.includes('culture') || h.includes('🎨') || h.includes('🎭')) return ACTIVITY_CONFIG.arts;
  if (h in ACTIVITY_CONFIG) return ACTIVITY_CONFIG[h];
  return ACTIVITY_CONFIG.dining;
}
