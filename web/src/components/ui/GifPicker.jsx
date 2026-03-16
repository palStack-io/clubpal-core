import { useState, useRef, useEffect, useCallback } from 'react'

const GIPHY_SEARCH_URL = 'https://api.giphy.com/v1/gifs/search'
const GIPHY_TRENDING_URL = 'https://api.giphy.com/v1/gifs/trending'

function getGiphyKey() {
  return localStorage.getItem('giphy_api_key') || import.meta.env.VITE_GIPHY_API_KEY || ''
}

// ── Curated fallback GIFs (shown when no Tenor API key) ─────────────────────
// Stable giphy media CDN URLs organized by category
const CURATED = {
  '🔥 Trending': [
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
    'https://media.giphy.com/media/xT9IgG50Lg7russbD6/giphy.gif',
    'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif',
    'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
    'https://media.giphy.com/media/3ohhwytHcusSCXXOUg/giphy.gif',
  ],
  '👍 Reactions': [
    'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
    'https://media.giphy.com/media/XreQmk7ETCak0/giphy.gif',
    'https://media.giphy.com/media/3oEjHV0z8S7WM4MwnK/giphy.gif',
    'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif',
    'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif',
    'https://media.giphy.com/media/3oKIPwoeGErMmaI43S/giphy.gif',
  ],
  '😂 LOL': [
    'https://media.giphy.com/media/5C0a8IItAWRebylDRX/giphy.gif',
    'https://media.giphy.com/media/ZqlvCTNHpqrio/giphy.gif',
    'https://media.giphy.com/media/lqSDx8SqNpHyE/giphy.gif',
    'https://media.giphy.com/media/3o7qDEq2bMbcbPRQ2c/giphy.gif',
    'https://media.giphy.com/media/GRnmFaJhFQZsA/giphy.gif',
    'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif',
  ],
  '🎉 Celebrate': [
    'https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif',
    'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
    'https://media.giphy.com/media/l3q2Z6S6n38zjPswo/giphy.gif',
    'https://media.giphy.com/media/TdfyKrN7HGTIY/giphy.gif',
    'https://media.giphy.com/media/26gsccje7r3RPqkKk/giphy.gif',
    'https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif',
  ],
  '❤️ Love': [
    'https://media.giphy.com/media/l0HlNQ03J5JxX6lva/giphy.gif',
    'https://media.giphy.com/media/3o6ZtpxSZbQRRnwCKQ/giphy.gif',
    'https://media.giphy.com/media/26FLdaDQ5f9kONF0Q/giphy.gif',
    'https://media.giphy.com/media/l2JhtKtDWYNKdRpoA/giphy.gif',
    'https://media.giphy.com/media/3oEdv3mAmEMCpiJetO/giphy.gif',
    'https://media.giphy.com/media/xT9IgAakXAITp6tNpe/giphy.gif',
  ],
  '😮 OMG': [
    'https://media.giphy.com/media/14rMkzeGMMLFNC/giphy.gif',
    'https://media.giphy.com/media/ToMjGpx9F5ktZw8qPUQ/giphy.gif',
    'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
    'https://media.giphy.com/media/l0IypeKl9NJhPFMrK/giphy.gif',
    'https://media.giphy.com/media/3ohhwCFoFvMCYSrNBO/giphy.gif',
    'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif',
  ],
  '👋 Hello': [
    'https://media.giphy.com/media/l0MYEqEzwMWFCg8rm/giphy.gif',
    'https://media.giphy.com/media/3o6ZtaO9BZHcOjmErm/giphy.gif',
    'https://media.giphy.com/media/dzaUX7CAG0Ihi/giphy.gif',
    'https://media.giphy.com/media/ASd0Ukj0y3qMM/giphy.gif',
    'https://media.giphy.com/media/26BRBupa6nRdnADGw/giphy.gif',
    'https://media.giphy.com/media/l3fZFup9GVSQ4cD96/giphy.gif',
  ],
  '🙄 Nope': [
    'https://media.giphy.com/media/26BRgripe2MqipbNS/giphy.gif',
    'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif',
    'https://media.giphy.com/media/vSaHCHSMuIj5S/giphy.gif',
    'https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif',
    'https://media.giphy.com/media/3oEdv9Y9MDM1rBLOSA/giphy.gif',
    'https://media.giphy.com/media/3oKIPavRPgJYaNI97W/giphy.gif',
  ],
}

const CATEGORIES = Object.keys(CURATED)

const GIPHY_CATEGORIES = [
  { label: '🔥 Trending', term: '' },
  { label: '👍 Reactions', term: 'reaction' },
  { label: '😂 LOL', term: 'lol funny' },
  { label: '🎉 Celebrate', term: 'celebrate' },
  { label: '❤️ Love', term: 'love' },
  { label: '😮 OMG', term: 'omg shocked' },
  { label: '👋 Hello', term: 'hello wave' },
  { label: '🙄 Nope', term: 'no nope' },
]

export default function GifPicker({ onSelect, onClose }) {
  const GIPHY_API_KEY = getGiphyKey()
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const ref = useRef()
  const debounceRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose?.()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Load initial category
  useEffect(() => {
    if (GIPHY_API_KEY) {
      loadGiphyCategory('')
    }
  }, [])

  const loadGiphyCategory = (term) => {
    setLoading(true)
    setIsSearching(false)
    const url = term
      ? `${GIPHY_SEARCH_URL}?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(term)}&limit=24&rating=g`
      : `${GIPHY_TRENDING_URL}?api_key=${GIPHY_API_KEY}&limit=24&rating=g`
    fetch(url)
      .then(r => r.json())
      .then(data => setResults(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const handleCategoryClick = (cat) => {
    setActiveCategory(cat)
    setQuery('')
    setIsSearching(false)
    if (GIPHY_API_KEY) {
      const giphyCat = GIPHY_CATEGORIES.find(c => c.label === cat)
      loadGiphyCategory(giphyCat?.term || '')
    }
  }

  const handleInputChange = (e) => {
    const val = e.target.value
    setQuery(val)

    // Pasted GIF URL — send immediately
    if (val.match(/^https?:\/\/.+\.(gif|webp|mp4)/i)) {
      onSelect?.(`[gif:${val.trim()}]`)
      onClose?.()
      return
    }

    if (!val.trim()) {
      setIsSearching(false)
      if (GIPHY_API_KEY) loadGiphyCategory(GIPHY_CATEGORIES.find(c => c.label === activeCategory)?.term || '')
      return
    }

    setIsSearching(true)

    if (GIPHY_API_KEY) {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setLoading(true)
        fetch(`${GIPHY_SEARCH_URL}?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(val)}&limit=24&rating=g`)
          .then(r => r.json())
          .then(data => setResults(data.data || []))
          .catch(() => {})
          .finally(() => setLoading(false))
      }, 400)
    }
  }

  const handleGiphySelect = (result) => {
    const url = result.images?.fixed_height_small?.url || result.images?.downsized?.url
    if (url) {
      onSelect?.(`[gif:${url}]`)
      onClose?.()
    }
  }

  const handleCuratedSelect = (url) => {
    onSelect?.(`[gif:${url}]`)
    onClose?.()
  }

  // ── What to show in the grid ───────────────────────────────────────────────
  const showCurated = !GIPHY_API_KEY && !isSearching
  const curatedGifs = showCurated ? (CURATED[activeCategory] || []) : []

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: '44px',
        left: '40px',
        zIndex: 50,
        width: '320px',
        background: 'var(--s1)',
        border: '1px solid var(--glass)',
        borderRadius: '14px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      {/* Search bar */}
      <div style={{ padding: '10px 10px 8px' }}>
        <input
          value={query}
          onChange={handleInputChange}
          placeholder={GIPHY_API_KEY ? 'Search GIFs…' : 'Paste a GIF URL…'}
          autoFocus
          style={{
            width: '100%',
            background: 'var(--s3)',
            border: '1px solid var(--glass)',
            borderRadius: '8px',
            padding: '7px 10px',
            fontSize: '12px',
            color: 'var(--t1)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--rose-border)'}
          onBlur={e => e.target.style.borderColor = 'var(--glass)'}
        />
      </div>

      {/* Category chips */}
      {!isSearching && (
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '0 10px 8px',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
              style={{
                padding: '4px 10px',
                borderRadius: '100px',
                border: '1px solid',
                borderColor: activeCategory === cat ? 'var(--rose-border)' : 'var(--glass)',
                background: activeCategory === cat ? 'rgba(244,63,94,0.12)' : 'var(--s3)',
                color: activeCategory === cat ? 'var(--rose-soft)' : 'var(--t3)',
                fontSize: '10px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.12s',
                flexShrink: 0,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '4px',
        padding: '0 10px 10px',
        maxHeight: '210px',
        overflowY: 'auto',
      }}>
        {/* Loading state */}
        {loading && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '24px', fontSize: '12px', color: 'var(--t3)' }}>
            Loading…
          </div>
        )}

        {/* Giphy results */}
        {!loading && GIPHY_API_KEY && results.map((r, i) => {
          const url = r.images?.fixed_height_small?.url || r.images?.downsized?.url
          if (!url) return null
          return (
            <img
              key={i}
              src={url}
              alt=""
              onClick={() => handleGiphySelect(r)}
              style={{
                width: '100%',
                height: '76px',
                objectFit: 'cover',
                borderRadius: '8px',
                cursor: 'pointer',
                border: '1px solid var(--glass)',
                transition: 'border-color 0.1s, transform 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--rose-soft)'; e.currentTarget.style.transform = 'scale(1.03)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass)'; e.currentTarget.style.transform = 'none' }}
            />
          )
        })}

        {/* Curated fallback (no API key) */}
        {!loading && showCurated && curatedGifs.map((url, i) => (
          <img
            key={i}
            src={url}
            alt=""
            onClick={() => handleCuratedSelect(url)}
            style={{
              width: '100%',
              height: '76px',
              objectFit: 'cover',
              borderRadius: '8px',
              cursor: 'pointer',
              border: '1px solid var(--glass)',
              transition: 'border-color 0.1s, transform 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--rose-soft)'; e.currentTarget.style.transform = 'scale(1.03)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass)'; e.currentTarget.style.transform = 'none' }}
            onError={e => e.currentTarget.style.display = 'none'}
          />
        ))}

        {/* No API key + searching: hint */}
        {!GIPHY_API_KEY && isSearching && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', fontSize: '12px', color: 'var(--t3)', lineHeight: 1.5 }}>
            Paste the GIF URL above to send it,
            <br />or add a Giphy key in <strong style={{ color: 'var(--rose-soft)' }}>Settings → Integrations</strong>.
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '4px 10px 6px', borderTop: '1px solid var(--glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '9px', color: 'var(--t4)' }}>
          {GIPHY_API_KEY ? 'Powered by GIPHY' : 'Curated GIFs'}
        </span>
        {!GIPHY_API_KEY && (
          <span style={{ fontSize: '9px', color: 'var(--t4)' }}>
            Add key in Settings → Integrations
          </span>
        )}
      </div>
    </div>
  )
}
