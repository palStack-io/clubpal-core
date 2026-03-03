import { useState, useEffect, useRef } from 'react'
import { authApi } from '../../api/auth'

export default function SearchHero({ eyebrow, headline, onSearch, suggestions = [] }) {
  const [query, setQuery] = useState('')
  const [activeChip, setActiveChip] = useState(null)
  const [location, setLocation] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    authApi.getPreferences()
      .then(prefs => { if (prefs?.location_address) setLocation(prefs.location_address) })
      .catch(() => {})
  }, [])

  const handleInput = (val) => {
    setQuery(val)
    setActiveChip(null)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onSearch(val), 350)
  }

  const handleSubmit = () => {
    clearTimeout(debounceRef.current)
    onSearch(query)
  }

  const handleChip = (chip) => {
    if (activeChip === chip) {
      setActiveChip(null)
      setQuery('')
      onSearch('')
    } else {
      const text = chip.split(' ').slice(1).join(' ')
      setActiveChip(chip)
      setQuery(text)
      clearTimeout(debounceRef.current)
      onSearch(text)
    }
  }

  // city-only location label: "Sarasota, FL 34239, USA" → "Sarasota"
  const locationLabel = location ? location.split(',')[0] : null

  return (
    <div style={{
      padding: '18px 24px 14px',
      background: 'linear-gradient(180deg, rgba(244,63,94,0.05) 0%, transparent 100%)',
      borderBottom: '1px solid var(--glass)',
    }}>
      {/* Eyebrow */}
      <div style={{
        fontSize: '10px', fontWeight: 700, color: 'rgba(244,63,94,0.7)',
        textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px',
      }}>
        {eyebrow}
      </div>

      {/* Headline */}
      <div style={{
        fontSize: '17px', fontWeight: 800, color: 'var(--t1)',
        marginBottom: '12px', lineHeight: 1.25,
      }}>
        {headline}
      </div>

      {/* Search row */}
      <SearchRow
        query={query}
        locationLabel={locationLabel}
        onChange={handleInput}
        onSubmit={handleSubmit}
      />

      {/* Suggestion chips */}
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
          {suggestions.map(chip => (
            <button
              key={chip}
              onClick={() => handleChip(chip)}
              style={{
                background: activeChip === chip ? 'rgba(244,63,94,0.1)' : 'var(--s2)',
                border: `1px solid ${activeChip === chip ? 'rgba(244,63,94,0.4)' : 'var(--glass)'}`,
                borderRadius: '20px', padding: '5px 12px',
                fontSize: '12px', fontWeight: activeChip === chip ? 700 : 500,
                color: activeChip === chip ? 'var(--rose)' : 'var(--t2)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SearchRow({ query, locationLabel, onChange, onSubmit }) {
  const [focused, setFocused] = useState(false)

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch',
      background: 'var(--s2)',
      border: `1.5px solid ${focused ? 'rgba(244,63,94,0.4)' : 'var(--glass)'}`,
      borderRadius: '12px', overflow: 'hidden',
      transition: 'border-color 0.15s',
      height: '42px',
    }}>
      {/* Icon */}
      <span style={{
        padding: '0 8px 0 13px', display: 'flex', alignItems: 'center',
        fontSize: '14px', color: 'var(--t4)', flexShrink: 0,
      }}>
        🔍
      </span>

      {/* Input */}
      <input
        type="text"
        value={query}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onSubmit()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search…"
        style={{
          flex: 1, background: 'none', border: 'none', outline: 'none',
          fontSize: '13px', color: 'var(--t1)', minWidth: 0,
        }}
      />

      {/* Location badge */}
      {locationLabel && (
        <div style={{
          display: 'flex', alignItems: 'center', flexShrink: 0,
          fontSize: '11px', color: 'var(--t3)',
          background: 'var(--s3)', borderLeft: '1px solid var(--glass)',
          padding: '0 10px', maxWidth: '110px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          📍 {locationLabel}
        </div>
      )}

      {/* Search button */}
      <button
        onClick={onSubmit}
        style={{
          flexShrink: 0, background: 'var(--rose)', color: '#fff',
          border: 'none', borderLeft: '1px solid rgba(244,63,94,0.3)',
          padding: '0 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
        }}
      >
        Search
      </button>
    </div>
  )
}
