import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { authApi } from '../../api/auth'
import { enrichApi } from '../../api/enrich'

const ACTIVITIES = [
  { id: 'dining',  emoji: '🍽️', label: 'Dining' },
  { id: 'movies',  emoji: '🎬', label: 'Movies' },
  { id: 'shows',   emoji: '📺', label: 'Shows' },
  { id: 'books',   emoji: '📚', label: 'Books' },
  { id: 'hiking',  emoji: '🥾', label: 'Hiking' },
  { id: 'gaming',  emoji: '🎮', label: 'Gaming' },
  { id: 'arts',    emoji: '🎨', label: 'Arts' },
]

const LOCATION_ACTIVITIES = new Set(['dining', 'hiking', 'arts'])

const MOVIE_GENRES = ['Action', 'Comedy', 'Drama', 'Thriller', 'Horror', 'Sci-Fi', 'Animation', 'Romance']
const SHOW_GENRES  = ['Drama', 'Comedy', 'Crime', 'Sci-Fi', 'Reality', 'Documentary', 'Animation', 'Thriller']
const BOOK_GENRES  = ['Fiction', 'Non-Fiction', 'Sci-Fi', 'Mystery', 'Fantasy', 'History', 'Biography']
const GAME_TYPES   = [
  { id: 'video_game', label: 'Video Games' },
  { id: 'board_game', label: 'Board Games' },
]

const RADIUS_OPTS_STD   = [5, 10, 25, 50]
const RADIUS_OPTS_HIKE  = [10, 25, 50, 100]

function chip(label, active, onClick) {
  return (
    <button
      key={label}
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: '100px',
        border: `1px solid ${active ? 'rgba(244,63,94,0.4)' : 'var(--glass)'}`,
        background: active ? 'rgba(244,63,94,0.15)' : 'var(--s3)',
        color: active ? 'var(--rose-soft)' : 'var(--t2)',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.12s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function RadiusPills({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
      <span style={{ fontSize: '12px', color: 'var(--t3)', width: '80px', flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {options.map(r => chip(`${r}mi`, value === r, () => onChange(r)))}
      </div>
    </div>
  )
}

const ACTIVITY_LABELS = { dining: 'Restaurants', movies: 'Movies', shows: 'Shows', books: 'Books', hiking: 'Trails', gaming: 'Games', arts: 'Arts & Culture' }
const ACTIVITY_EMOJIS_MAP = { dining: '🍽️', movies: '🎬', shows: '📺', books: '📚', hiking: '🥾', gaming: '🎮', arts: '🎨' }

export default function OnboardingWizard() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()

  const [step, setStep] = useState(1)
  const [activities, setActivities] = useState(['dining', 'movies', 'shows', 'books', 'hiking', 'gaming', 'arts'])
  const [locationAddress, setLocationAddress] = useState('')
  const [locationLat, setLocationLat] = useState(null)
  const [locationLng, setLocationLng] = useState(null)
  const [geoError, setGeoError] = useState('')
  const [radiusDining, setRadiusDining] = useState(10)
  const [radiusHiking, setRadiusHiking] = useState(25)
  const [radiusArts, setRadiusArts] = useState(10)
  const [movieGenres, setMovieGenres] = useState([])
  const [showGenres, setShowGenres] = useState([])
  const [bookGenres, setBookGenres] = useState([])
  const [gameTypes, setGameTypes] = useState(['video_game', 'board_game'])
  const [loading, setLoading] = useState(false)
  const [loadResult, setLoadResult] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [activeLoadIdx, setActiveLoadIdx] = useState(0)
  const geocodeTimeout = useRef(null)
  const loadIntervalRef = useRef(null)

  const handleSkip = () => {
    updateUser({ onboarding_complete: true })
    navigate('/dashboard')
  }

  const needsLocation = activities.some(a => LOCATION_ACTIVITIES.has(a))
  const needsGenres   = activities.some(a => ['movies', 'shows', 'books', 'gaming'].includes(a))

  // Total steps depend on selected activities
  const totalSteps = needsGenres ? 5 : 4

  const toggleActivity = (id) => {
    setActivities(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    )
  }

  const toggleList = (list, setList, val) => {
    setList(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }

  const handleGeolocation = () => {
    if (!navigator.geolocation) { setGeoError('Geolocation not supported'); return }
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setLocationLat(lat)
        setLocationLng(lng)
        try {
          const result = await enrichApi.geocode(`${lat},${lng}`)
          setLocationAddress(result.formatted_address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`)
        } catch {
          setLocationAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)
        }
      },
      () => setGeoError('Could not get location. Please type your city.')
    )
  }

  const handleAddressChange = (val) => {
    setLocationAddress(val)
    clearTimeout(geocodeTimeout.current)
    if (val.length > 3) {
      geocodeTimeout.current = setTimeout(async () => {
        try {
          const result = await enrichApi.geocode(val)
          if (result?.lat) {
            setLocationLat(result.lat)
            setLocationLng(result.lng)
          }
        } catch {}
      }, 600)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setLoadError('')
    setLoadResult(null)
    setActiveLoadIdx(0)
    // Animate through categories while waiting
    let idx = 0
    clearInterval(loadIntervalRef.current)
    loadIntervalRef.current = setInterval(() => {
      idx = Math.min(idx + 1, activities.length - 1)
      setActiveLoadIdx(idx)
    }, 2500)
    try {
      const prefs = {
        location_address: locationAddress || null,
        location_lat: locationLat,
        location_lng: locationLng,
        radius_dining: radiusDining,
        radius_hiking: radiusHiking,
        radius_arts: radiusArts,
        activities,
        book_genres: bookGenres.map(g => g.toLowerCase()),
        movie_genres: movieGenres.map(g => g.toLowerCase()),
        show_genres: showGenres.map(g => g.toLowerCase()),
        game_types: gameTypes,
      }
      const result = await authApi.updatePreferences(prefs)
      setLoadResult(result)
      clearInterval(loadIntervalRef.current)
      setActiveLoadIdx(activities.length)
      // Update user in context to mark onboarding complete
      updateUser({ onboarding_complete: true })
      setStep(6)
    } catch (e) {
      clearInterval(loadIntervalRef.current)
      setLoadError(e?.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const canProceedStep2 = activities.length > 0
  const canProceedStep3 = !needsLocation || (locationLat !== null && locationLng !== null)

  const overlay = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
    cursor: 'pointer',
  }

  const stopProp = (e) => e.stopPropagation()

  const card = {
    background: 'var(--s1)',
    border: '1px solid var(--glass)',
    borderRadius: '20px',
    padding: '32px',
    width: '100%',
    maxWidth: '520px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  }

  const h2 = { fontSize: '22px', fontWeight: 800, color: 'var(--t1)', marginBottom: '6px' }
  const sub = { fontSize: '13px', color: 'var(--t3)', marginBottom: '24px', lineHeight: 1.5 }

  const btnPrimary = (onClick, label, disabled = false, isLoading = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      style={{
        background: disabled ? 'var(--s4)' : 'var(--rose)',
        color: disabled ? 'var(--t4)' : '#fff',
        border: 'none',
        borderRadius: '10px',
        padding: '10px 24px',
        fontSize: '14px',
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.12s',
        opacity: isLoading ? 0.7 : 1,
      }}
    >
      {isLoading ? 'Loading…' : label}
    </button>
  )

  const progressDots = () => (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i + 1 <= step ? '20px' : '6px',
            height: '6px',
            borderRadius: '100px',
            background: i + 1 <= step ? 'var(--rose)' : 'var(--s4)',
            transition: 'all 0.2s',
          }}
        />
      ))}
    </div>
  )

  // ── Step 1: Welcome ────────────────────────────────────────────────────────
  if (step === 1) return (
    <div style={overlay} onClick={handleSkip}>
      <div style={card} onClick={stopProp}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>👋</div>
        <div style={h2}>Welcome to clubPal, {user?.full_name?.split(' ')[0] || user?.username}!</div>
        <div style={sub}>
          Let's personalize your discover feed so you see restaurants, movies, books, and more that match your taste and location.
          Takes about 30 seconds.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {btnPrimary(() => setStep(2), 'Get Started →')}
          <button
            type="button"
            onClick={handleSkip}
            style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--t4)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )

  // ── Step 2: Activities ─────────────────────────────────────────────────────
  if (step === 2) return (
    <div style={overlay} onClick={handleSkip}>
      <div style={card} onClick={stopProp}>
        {progressDots()}
        <div style={h2}>What do you enjoy?</div>
        <div style={sub}>Select all that apply — you can change this later in Settings.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '28px' }}>
          {ACTIVITIES.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleActivity(a.id)}
              style={{
                padding: '16px 12px',
                borderRadius: '14px',
                border: `1px solid ${activities.includes(a.id) ? 'rgba(244,63,94,0.4)' : 'var(--glass)'}`,
                background: activities.includes(a.id) ? 'rgba(244,63,94,0.12)' : 'var(--s2)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.12s',
              }}
            >
              <span style={{ fontSize: '28px' }}>{a.emoji}</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: activities.includes(a.id) ? 'var(--rose-soft)' : 'var(--t2)' }}>
                {a.label}
              </span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {btnPrimary(() => setStep(3), 'Next →', !canProceedStep2)}
        </div>
      </div>
    </div>
  )

  // ── Step 3: Location ───────────────────────────────────────────────────────
  if (step === 3) return (
    <div style={overlay} onClick={handleSkip}>
      <div style={card} onClick={stopProp}>
        {progressDots()}
        <div style={h2}>Where are you based?</div>
        <div style={sub}>
          {needsLocation
            ? 'We\'ll use this to find nearby restaurants, trails, and venues.'
            : 'Your location helps us tailor content — optional for movies, books, and games.'}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            value={locationAddress}
            onChange={e => handleAddressChange(e.target.value)}
            placeholder="City, state or ZIP code…"
            style={{
              flex: 1,
              background: 'var(--s2)',
              border: '1px solid var(--glass)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontSize: '13px',
              color: 'var(--t1)',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={handleGeolocation}
            title="Use my current location"
            style={{
              background: 'var(--s3)',
              border: '1px solid var(--glass)',
              borderRadius: '10px',
              padding: '10px 14px',
              cursor: 'pointer',
              fontSize: '18px',
            }}
          >
            📍
          </button>
        </div>

        {geoError && (
          <div style={{ fontSize: '11px', color: '#f87171', marginBottom: '12px' }}>{geoError}</div>
        )}

        {locationLat !== null && (
          <div style={{ fontSize: '11px', color: 'var(--t3)', marginBottom: '16px' }}>
            ✓ Located: {locationLat.toFixed(4)}, {locationLng.toFixed(4)}
          </div>
        )}

        {/* Radius selectors for location-based activities */}
        {activities.includes('dining') && locationLat !== null && (
          <RadiusPills label="Dining" value={radiusDining} onChange={setRadiusDining} options={RADIUS_OPTS_STD} />
        )}
        {activities.includes('hiking') && locationLat !== null && (
          <RadiusPills label="Hiking" value={radiusHiking} onChange={setRadiusHiking} options={RADIUS_OPTS_HIKE} />
        )}
        {activities.includes('arts') && locationLat !== null && (
          <RadiusPills label="Arts" value={radiusArts} onChange={setRadiusArts} options={RADIUS_OPTS_STD} />
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
          <button
            type="button"
            onClick={() => setStep(2)}
            style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--t3)', cursor: 'pointer' }}
          >
            ← Back
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            {needsLocation && !canProceedStep3 && (
              <button
                type="button"
                onClick={() => setStep(needsGenres ? 4 : 5)}
                style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--t3)', cursor: 'pointer' }}
              >
                Skip for now
              </button>
            )}
            {btnPrimary(() => setStep(needsGenres ? 4 : 5), 'Next →', needsLocation && !canProceedStep3 && false)}
          </div>
        </div>
      </div>
    </div>
  )

  // ── Step 4: Genres ─────────────────────────────────────────────────────────
  if (step === 4 && needsGenres) return (
    <div style={overlay} onClick={handleSkip}>
      <div style={card} onClick={stopProp}>
        {progressDots()}
        <div style={h2}>What do you like?</div>
        <div style={sub}>Select your favorites — we'll use this to curate your feed.</div>

        {activities.includes('movies') && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t2)', marginBottom: '10px' }}>🎬 Movie Genres</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {MOVIE_GENRES.map(g => chip(g, movieGenres.includes(g), () => toggleList(movieGenres, setMovieGenres, g)))}
            </div>
          </div>
        )}

        {activities.includes('shows') && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t2)', marginBottom: '10px' }}>📺 Show Genres</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {SHOW_GENRES.map(g => chip(g, showGenres.includes(g), () => toggleList(showGenres, setShowGenres, g)))}
            </div>
          </div>
        )}

        {activities.includes('books') && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t2)', marginBottom: '10px' }}>📚 Book Genres</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {BOOK_GENRES.map(g => chip(g, bookGenres.includes(g), () => toggleList(bookGenres, setBookGenres, g)))}
            </div>
          </div>
        )}

        {activities.includes('gaming') && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t2)', marginBottom: '10px' }}>🎮 Game Types</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {GAME_TYPES.map(g => chip(g.label, gameTypes.includes(g.id), () => toggleList(gameTypes, setGameTypes, g.id)))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
          <button
            type="button"
            onClick={() => setStep(3)}
            style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--t3)', cursor: 'pointer' }}
          >
            ← Back
          </button>
          {btnPrimary(() => setStep(5), 'Next →')}
        </div>
      </div>
    </div>
  )

  // ── Step 5: Loading ────────────────────────────────────────────────────────
  if (step === 5) {
    const counts = loadResult || {}
    return (
      <div style={overlay} onClick={loading ? undefined : handleSkip}>
        <div style={card} onClick={stopProp}>
          {progressDots()}
          <div style={h2}>{loading ? 'Building your feed…' : loadError ? 'Something went wrong' : 'Ready to load'}</div>
          <div style={sub}>
            {loading
              ? 'Fetching personalized results — this takes about 30–60 seconds.'
              : loadError
                ? 'An error occurred. You can try again or skip for now.'
                : 'We\'ll fetch results from each category you selected.'}
          </div>

          {/* Per-category rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            {activities.map((a, i) => {
              const isDone  = activeLoadIdx > i && !loading
              const isActive = loading && activeLoadIdx === i
              const isPast  = loading && activeLoadIdx > i
              const count   = counts[a]
              return (
                <div
                  key={a}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: isActive ? 'rgba(244,63,94,0.07)' : 'var(--s2)',
                    border: `1px solid ${isActive ? 'rgba(244,63,94,0.2)' : 'var(--glass)'}`,
                    transition: 'all 0.3s',
                  }}
                >
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>{ACTIVITY_EMOJIS_MAP[a]}</span>
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: isActive ? 'var(--t1)' : 'var(--t2)' }}>
                    {ACTIVITY_LABELS[a]}
                  </span>
                  {isPast || (isDone && count !== undefined) ? (
                    <span style={{ fontSize: '12px', color: 'var(--t3)' }}>
                      {count !== undefined ? `${count} found` : '✓'}
                    </span>
                  ) : isActive ? (
                    <div style={{
                      width: '14px', height: '14px', borderRadius: '50%',
                      border: '2px solid var(--rose)', borderTopColor: 'transparent',
                      animation: 'spin 0.8s linear infinite', flexShrink: 0,
                    }} />
                  ) : loading ? (
                    <span style={{ fontSize: '11px', color: 'var(--t4)' }}>queued</span>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--t4)' }}>ready</span>
                  )}
                </div>
              )
            })}
          </div>

          {!loading && !loadResult && !loadError && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setStep(needsGenres ? 4 : 3)}
                style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--t3)', cursor: 'pointer' }}
              >
                ← Back
              </button>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleSkip}
                  style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--t4)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Skip
                </button>
                {btnPrimary(handleSubmit, 'Load My Feed →')}
              </div>
            </div>
          )}

          {loading && (
            <div style={{ fontSize: '12px', color: 'var(--t4)', textAlign: 'center' }}>
              Don't close this screen…
            </div>
          )}

          {loadError && (
            <div>
              <div style={{ padding: '12px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '10px', fontSize: '12px', color: '#f87171', marginBottom: '16px' }}>
                {loadError}
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {btnPrimary(handleSubmit, 'Try Again')}
                <button
                  type="button"
                  onClick={handleSkip}
                  style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--t4)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── Step 6: Done ───────────────────────────────────────────────────────────
  if (step === 6) {
    const loaded = loadResult || {}
    const summary = Object.entries(loaded).map(([k, v]) => `${v} ${k}`).join(' · ')

    return (
      <div style={overlay} onClick={() => navigate('/dashboard')}>
        <div style={card} onClick={stopProp}>
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>🎉</div>
          <div style={h2}>Your feed is ready!</div>
          <div style={sub}>
            {summary
              ? `We found: ${summary}`
              : 'Your personalized discover feed is all set.'}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              style={{
                background: 'var(--rose)', color: '#fff', border: 'none',
                borderRadius: '10px', padding: '10px 24px', fontSize: '14px',
                fontWeight: 700, cursor: 'pointer',
              }}
            >
              Go to Dashboard →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
