import { useState, useEffect, useRef, useCallback } from 'react'
import { authApi } from '../../api/auth'

// ─── Nominatim geocode autocomplete (free, no key) ─────────────────────────
async function fetchLocationSuggestions(query) {
  if (!query || query.length < 2) return []
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    const data = await res.json()
    return data.map(item => ({
      label: item.display_name,
      short: [item.address?.city || item.address?.town || item.address?.village || item.address?.county, item.address?.state, item.address?.country].filter(Boolean).join(', '),
      lat: item.lat,
      lon: item.lon,
    }))
  } catch {
    return []
  }
}

export default function SearchHero({ eyebrow, headline, onSearch, suggestions = [] }) {
  const [query, setQuery] = useState('')
  const [activeChip, setActiveChip] = useState(null)
  const [location, setLocation] = useState(null)
  const [locationOverride, setLocationOverride] = useState(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    authApi.getPreferences()
      .then(prefs => { if (prefs?.location_address) setLocation(prefs.location_address) })
      .catch(() => {})
  }, [])

  const currentLocation = locationOverride ?? location

  const handleInput = (val) => {
    setQuery(val)
    setActiveChip(null)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onSearch(val, currentLocation), 350)
  }

  const handleSubmit = () => {
    clearTimeout(debounceRef.current)
    onSearch(query, currentLocation)
  }

  const handleChip = (chip) => {
    if (activeChip === chip) {
      setActiveChip(null)
      setQuery('')
      onSearch('', currentLocation)
    } else {
      const text = chip.split(' ').slice(1).join(' ')
      setActiveChip(chip)
      setQuery(text)
      clearTimeout(debounceRef.current)
      onSearch(text, currentLocation)
    }
  }

  const handleLocationChange = (newLoc) => {
    setLocationOverride(newLoc)
    clearTimeout(debounceRef.current)
    onSearch(query, newLoc)
  }

  // city-only label: "Sarasota, FL 34239, USA" → "Sarasota"
  const locationLabel = currentLocation ? currentLocation.split(',')[0] : null

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
        locationOverride={locationOverride}
        onChange={handleInput}
        onSubmit={handleSubmit}
        onLocationChange={handleLocationChange}
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

function SearchRow({ query, locationLabel, locationOverride, onChange, onSubmit, onLocationChange }) {
  const [focused, setFocused] = useState(false)
  const [editingLocation, setEditingLocation] = useState(false)
  const [locationInput, setLocationInput] = useState('')
  const [locSuggestions, setLocSuggestions] = useState([])
  const [loadingLoc, setLoadingLoc] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const locationInputRef = useRef(null)
  const locDebounceRef = useRef(null)
  const containerRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!editingLocation) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setEditingLocation(false)
        setLocSuggestions([])
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [editingLocation])

  const startEditLocation = () => {
    setLocationInput(locationOverride || locationLabel || '')
    setLocSuggestions([])
    setEditingLocation(true)
    setTimeout(() => locationInputRef.current?.focus(), 0)
  }

  const confirmLocation = (val) => {
    const value = (val ?? locationInput).trim()
    setEditingLocation(false)
    setLocSuggestions([])
    if (value) onLocationChange(value)
  }

  const handleLocInput = (val) => {
    setLocationInput(val)
    clearTimeout(locDebounceRef.current)
    if (val.length < 2) { setLocSuggestions([]); return }
    setLoadingLoc(true)
    locDebounceRef.current = setTimeout(async () => {
      const results = await fetchLocationSuggestions(val)
      setLocSuggestions(results)
      setLoadingLoc(false)
    }, 350)
  }

  const pickSuggestion = (suggestion) => {
    clearTimeout(locDebounceRef.current)
    const label = suggestion.short || suggestion.label
    setLocationInput(label)
    setLocSuggestions([])
    setLoadingLoc(false)
    setEditingLocation(false)
    onLocationChange(label)
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) return
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, { headers: { 'Accept-Language': 'en' } })
          const data = await res.json()
          const label = [data.address?.city || data.address?.town || data.address?.village || data.address?.county, data.address?.state, data.address?.country].filter(Boolean).join(', ')
          setLocationInput(label)
          setLocSuggestions([])
          setEditingLocation(false)
          onLocationChange(label)
        } catch {
          setEditingLocation(false)
        }
        setGpsLoading(false)
      },
      () => setGpsLoading(false),
      { timeout: 8000 }
    )
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'stretch',
        background: 'var(--s2)',
        border: `1.5px solid ${focused || editingLocation ? 'rgba(244,63,94,0.4)' : 'var(--glass)'}`,
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

        {/* Search input */}
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

        {/* Location badge / editor */}
        {editingLocation ? (
          <div style={{
            display: 'flex', alignItems: 'center', flexShrink: 0,
            background: 'var(--s3)', borderLeft: '1px solid var(--glass)',
            padding: '0 8px', gap: '4px',
          }}>
            <span style={{ fontSize: '11px', flexShrink: 0 }}>📍</span>
            <input
              ref={locationInputRef}
              type="text"
              value={locationInput}
              onChange={e => handleLocInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmLocation()
                if (e.key === 'Escape') { setEditingLocation(false); setLocSuggestions([]) }
              }}
              placeholder="City or area"
              style={{
                width: '130px', background: 'none', border: 'none', outline: 'none',
                fontSize: '11px', color: 'var(--t1)',
              }}
            />
            {loadingLoc && (
              <div style={{ width: '10px', height: '10px', border: '1.5px solid var(--glass)', borderTopColor: 'var(--rose)', borderRadius: '50%', animation: 'spin 0.6s linear infinite', flexShrink: 0 }}>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={startEditLocation}
            title="Change location"
            style={{
              display: 'flex', alignItems: 'center', flexShrink: 0,
              fontSize: '11px', color: locationOverride ? 'var(--rose-soft)' : 'var(--t3)',
              background: locationOverride ? 'rgba(244,63,94,0.08)' : 'var(--s3)',
              borderLeft: '1px solid var(--glass)',
              padding: '0 10px', maxWidth: '130px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              border: 'none', cursor: 'pointer', gap: '3px',
              borderLeft: '1px solid var(--glass)',
            }}
          >
            📍 {locationLabel || 'Set location'}
            <span style={{ fontSize: '9px', opacity: 0.6, marginLeft: '2px' }}>✎</span>
          </button>
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

      {/* Location suggestions dropdown */}
      {editingLocation && (locSuggestions.length > 0 || !locationInput) && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          width: '300px', maxWidth: '90vw',
          background: 'var(--s2)', border: '1px solid var(--glass)',
          borderRadius: '12px', overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          zIndex: 200,
        }}>
          {/* Use my location */}
          <button
            onMouseDown={(e) => { e.preventDefault(); useMyLocation() }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px', background: 'none', border: 'none',
              borderBottom: '1px solid var(--glass)', cursor: 'pointer',
              color: 'var(--t2)', fontSize: '13px', fontWeight: 600,
            }}
          >
            {gpsLoading ? (
              <div style={{ width: '14px', height: '14px', border: '2px solid var(--glass)', borderTopColor: 'var(--rose)', borderRadius: '50%', animation: 'spin 0.6s linear infinite', flexShrink: 0 }} />
            ) : (
              <span style={{ fontSize: '14px' }}>🎯</span>
            )}
            <span>{gpsLoading ? 'Detecting location…' : 'Use my current location'}</span>
          </button>

          {/* Suggestions */}
          {locSuggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '9px 14px', background: 'none', border: 'none',
                borderBottom: i < locSuggestions.length - 1 ? '1px solid var(--glass)' : 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--s3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span style={{ fontSize: '13px', marginTop: '1px', flexShrink: 0 }}>📍</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)', lineHeight: 1.3 }}>{s.short}</div>
                <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '1px', lineHeight: 1.4 }}>{s.label}</div>
              </div>
            </button>
          ))}

          {/* No results hint */}
          {locSuggestions.length === 0 && locationInput.length >= 2 && !loadingLoc && (
            <div style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--t3)', textAlign: 'center' }}>
              No results — press Enter to search anyway
            </div>
          )}
        </div>
      )}
    </div>
  )
}
