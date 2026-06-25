import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { authApi } from '../../api/auth'
import { enrichApi } from '../../api/enrich'
import { gatewayClient } from '../../api/client'

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

const AVATAR_EMOJIS = [
  '😀','😎','🤩','🥳','😄','🤓','🧑‍💻','🧙','🦸','🧝','🧜','🎭',
  '🦊','🐱','🐶','🐻','🦁','🐯','🦋','🦄','🐸','🐼','🐨','🦖',
  '🌟','⚡','🔥','💎','🌈','🎯','👾','🎪','🚀','🌊','🍀','🎸',
]

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
  const [activities, setActivities] = useState([])
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
  const [selectedEmoji, setSelectedEmoji] = useState(null)
  const [avatarMode, setAvatarMode] = useState(null) // 'emoji' | 'photo' | null
  const [photoUrl, setPhotoUrl] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const geocodeTimeout = useRef(null)
  const [locationSuggestions, setLocationSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const autocompleteTimeout = useRef(null)

  const compressImage = (file) => new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const maxDim = 512
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg', 0.85,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })

  const handlePhotoSelect = async (e) => {
    const raw = e.target.files?.[0]
    if (!raw || !raw.type.startsWith('image/')) return
    const localUrl = URL.createObjectURL(raw)
    setPhotoPreview(localUrl)
    setAvatarMode('photo')
    setSelectedEmoji(null)
    setUploading(true)
    try {
      const file = await compressImage(raw)
      const { upload_url, public_url } = await authApi.getAvatarUploadUrl(file.name, file.type)
      await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      setPhotoUrl(public_url)
      setPhotoPreview(null)
      URL.revokeObjectURL(localUrl)
    } catch {
      setPhotoPreview(null)
      setPhotoUrl(null)
      setAvatarMode(null)
      URL.revokeObjectURL(localUrl)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSkip = async () => {
    updateUser({ onboarding_complete: true })
    navigate('/dashboard')
    try { await gatewayClient.post('/users/me/onboarding/complete') } catch {}
  }

  const needsLocation = activities.some(a => LOCATION_ACTIVITIES.has(a))
  const needsGenres   = activities.some(a => ['movies', 'shows', 'books', 'gaming'].includes(a))

  // Total steps depend on selected activities (+1 for emoji step)
  const totalSteps = needsGenres ? 6 : 5

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
    setLocationSuggestions([])
    setShowSuggestions(false)
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
    setLocationLat(null)
    setLocationLng(null)
    clearTimeout(autocompleteTimeout.current)
    if (val.length >= 2) {
      autocompleteTimeout.current = setTimeout(async () => {
        try {
          const suggestions = await enrichApi.autocomplete(val)
          setLocationSuggestions(suggestions || [])
          setShowSuggestions((suggestions || []).length > 0)
        } catch {
          setLocationSuggestions([])
        }
      }, 300)
    } else {
      setLocationSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleSelectSuggestion = async (suggestion) => {
    setLocationAddress(suggestion.description)
    setLocationSuggestions([])
    setShowSuggestions(false)
    try {
      const result = await enrichApi.geocode(suggestion.description)
      if (result?.lat) {
        setLocationLat(result.lat)
        setLocationLng(result.lng)
      }
    } catch {}
  }

  const handleSubmit = () => {
    // Navigate immediately — save happens in the background
    updateUser({ onboarding_complete: true })
    navigate('/dashboard')

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
    authApi.updatePreferences(prefs).catch(() => {})
    const avatarValue = avatarMode === 'photo' ? photoUrl : avatarMode === 'emoji' ? selectedEmoji : null
    if (avatarValue) {
      gatewayClient.patch('/users/me', { avatar_url: avatarValue }).catch(() => {})
    }
  }

  const canProceedStep2 = activities.length > 0
  const canProceedStep3 = !needsLocation || (locationLat !== null && locationLng !== null)

  const overlay = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    backdropFilter: 'blur(4px)',
    overflowY: 'auto',
    padding: '16px',
    cursor: 'pointer',
  }

  const stopProp = (e) => e.stopPropagation()

  const card = {
    background: 'var(--s1)',
    border: '1px solid var(--glass)',
    borderRadius: '20px',
    padding: '28px 24px',
    width: '100%',
    maxWidth: '520px',
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
    flexShrink: 0,
    margin: 'auto',
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
          Set up your profile so you can create groups, plan events, and coordinate with your friends — all in one place.
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

  // ── Step 2: Profile picture ────────────────────────────────────────────────
  if (step === 2) {
    const hasAvatar = avatarMode === 'photo' ? !!(photoUrl || photoPreview) : avatarMode === 'emoji' ? !!selectedEmoji : false
    const previewSrc = photoPreview || photoUrl
    const initial = user?.full_name ? user.full_name.charAt(0).toUpperCase() : '?'

    return (
      <div style={overlay} onClick={handleSkip}>
        <div style={card} onClick={stopProp}>
          {progressDots()}
          <div style={h2}>Add a profile picture</div>
          <div style={sub}>Upload a photo or pick an emoji — your group members will see this.</div>

          {/* Preview */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            background: 'var(--s2)', border: '1px solid var(--glass)',
            borderRadius: '16px', padding: '16px 20px', marginBottom: '24px',
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: avatarMode === 'emoji' && selectedEmoji ? 'rgba(244,63,94,0.12)'
                : previewSrc ? 'transparent' : 'var(--s3)',
              border: `2px solid ${hasAvatar ? 'rgba(244,63,94,0.3)' : 'var(--glass)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: avatarMode === 'emoji' ? '34px' : '24px',
              flexShrink: 0, transition: 'all 0.2s', overflow: 'hidden',
              position: 'relative',
            }}>
              {uploading ? (
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  border: '2px solid var(--rose)', borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite',
                }} />
              ) : avatarMode === 'photo' && previewSrc ? (
                <img src={previewSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : avatarMode === 'emoji' && selectedEmoji ? (
                selectedEmoji
              ) : (
                <span style={{ color: 'var(--t3)', fontWeight: 700 }}>{initial}</span>
              )}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t1)' }}>
                {user?.full_name || user?.username}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '2px' }}>
                {uploading ? 'Uploading…' : hasAvatar ? 'Looking good!' : 'Choose an option below'}
              </div>
            </div>
          </div>

          {/* Two option cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            {/* Upload photo option */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                padding: '20px 12px',
                borderRadius: '14px',
                border: `1px solid ${avatarMode === 'photo' && photoUrl ? 'rgba(244,63,94,0.4)' : 'var(--glass)'}`,
                background: avatarMode === 'photo' && photoUrl ? 'rgba(244,63,94,0.08)' : 'var(--s2)',
                cursor: uploading ? 'wait' : 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                transition: 'all 0.12s',
              }}
            >
              <span style={{ fontSize: '28px' }}>📷</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: avatarMode === 'photo' && photoUrl ? 'var(--rose-soft)' : 'var(--t2)' }}>
                {avatarMode === 'photo' && photoUrl ? 'Change Photo' : 'Upload Photo'}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handlePhotoSelect}
              style={{ display: 'none' }}
            />

            {/* Emoji option */}
            <button
              type="button"
              onClick={() => setAvatarMode(avatarMode === 'emoji' ? null : 'emoji')}
              style={{
                padding: '20px 12px',
                borderRadius: '14px',
                border: `1px solid ${avatarMode === 'emoji' ? 'rgba(244,63,94,0.4)' : 'var(--glass)'}`,
                background: avatarMode === 'emoji' ? 'rgba(244,63,94,0.08)' : 'var(--s2)',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                transition: 'all 0.12s',
              }}
            >
              <span style={{ fontSize: '28px' }}>😎</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: avatarMode === 'emoji' ? 'var(--rose-soft)' : 'var(--t2)' }}>
                Pick Emoji
              </span>
            </button>
          </div>

          {/* Emoji grid — shown when emoji mode is active */}
          {avatarMode === 'emoji' && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))', gap: '6px',
              marginBottom: '16px', padding: '12px',
              background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '12px',
            }}>
              {AVATAR_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => { setSelectedEmoji(prev => prev === emoji ? null : emoji); setPhotoUrl(null); setPhotoPreview(null) }}
                  style={{
                    aspectRatio: '1', borderRadius: '10px', fontSize: '22px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${selectedEmoji === emoji ? 'rgba(244,63,94,0.4)' : 'transparent'}`,
                    background: selectedEmoji === emoji ? 'rgba(244,63,94,0.12)' : 'transparent',
                    cursor: 'pointer', transition: 'all 0.1s', padding: 0,
                    boxShadow: selectedEmoji === emoji ? '0 0 0 2px rgba(244,63,94,0.2)' : 'none',
                  }}
                  onMouseEnter={e => { if (selectedEmoji !== emoji) e.currentTarget.style.background = 'var(--s3)' }}
                  onMouseLeave={e => { if (selectedEmoji !== emoji) e.currentTarget.style.background = 'transparent' }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" onClick={() => setStep(1)}
              style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--t3)', cursor: 'pointer' }}>
              ← Back
            </button>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {!hasAvatar && (
                <button type="button" onClick={() => setStep(3)}
                  style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--t4)', cursor: 'pointer', textDecoration: 'underline' }}>
                  Skip
                </button>
              )}
              {btnPrimary(() => setStep(3), hasAvatar ? 'Next →' : 'Skip →', uploading)}
            </div>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── Step 3: Activities ─────────────────────────────────────────────────────
  if (step === 3) return (
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
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button type="button" onClick={() => setStep(2)}
            style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--t3)', cursor: 'pointer' }}>
            ← Back
          </button>
          {btnPrimary(() => setStep(4), 'Next →', !canProceedStep2)}
        </div>
      </div>
    </div>
  )

  // ── Step 4: Location ───────────────────────────────────────────────────────
  if (step === 4) return (
    <div style={overlay} onClick={handleSkip}>
      <div style={card} onClick={stopProp}>
        {progressDots()}
        <div style={h2}>Where are you based?</div>
        <div style={sub}>
          {needsLocation
            ? 'We\'ll use this to find nearby restaurants, trails, and venues.'
            : 'Your location helps us tailor content — optional for movies, books, and games.'}
        </div>

        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={locationAddress}
              onChange={e => handleAddressChange(e.target.value)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => locationSuggestions.length > 0 && setShowSuggestions(true)}
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
          {showSuggestions && locationSuggestions.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: '52px', zIndex: 100,
              background: 'var(--s2)', border: '1px solid var(--glass)',
              borderRadius: '10px', overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {locationSuggestions.map((s, i) => (
                <button
                  key={s.place_id || i}
                  type="button"
                  onMouseDown={() => handleSelectSuggestion(s)}
                  style={{
                    width: '100%', textAlign: 'left', background: 'none', border: 'none',
                    borderBottom: i < locationSuggestions.length - 1 ? '1px solid var(--glass)' : 'none',
                    padding: '10px 14px', cursor: 'pointer',
                    fontSize: '13px', color: 'var(--t1)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--s3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  📍 {s.description}
                </button>
              ))}
            </div>
          )}
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
            onClick={() => setStep(3)}
            style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--t3)', cursor: 'pointer' }}
          >
            ← Back
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            {needsLocation && !canProceedStep3 && (
              <button
                type="button"
                onClick={() => setStep(needsGenres ? 5 : 6)}
                style={{ background: 'none', border: 'none', fontSize: '12px', color: 'var(--t3)', cursor: 'pointer' }}
              >
                Skip for now
              </button>
            )}
            {btnPrimary(() => setStep(needsGenres ? 5 : 6), 'Next →', needsLocation && !canProceedStep3 && false)}
          </div>
        </div>
      </div>
    </div>
  )

  // ── Step 5: Genres ─────────────────────────────────────────────────────────
  if (step === 5 && needsGenres) return (
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
            onClick={() => setStep(4)}
            style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--t3)', cursor: 'pointer' }}
          >
            ← Back
          </button>
          {btnPrimary(() => setStep(6), 'Next →')}
        </div>
      </div>
    </div>
  )

  // ── Step 6: Confirm & Finish ──────────────────────────────────────────────
  if (step === 6) {
    return (
      <div style={overlay} onClick={handleSkip}>
        <div style={card} onClick={stopProp}>
          {progressDots()}
          <div style={h2}>All set!</div>
          <div style={sub}>Your preferences are saved. Content will load in the background once you're on the dashboard.</div>

          {/* Per-category summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            {activities.map(a => (
              <div
                key={a}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'var(--s2)',
                  border: '1px solid var(--glass)',
                }}
              >
                <span style={{ fontSize: '20px', flexShrink: 0 }}>{ACTIVITY_EMOJIS_MAP[a]}</span>
                <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--t2)' }}>
                  {ACTIVITY_LABELS[a]}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--green)' }}>✓</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setStep(needsGenres ? 5 : 4)}
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
              {btnPrimary(handleSubmit, 'Finish & Go →')}
            </div>
          </div>
        </div>
      </div>
    )
  }


  return null
}
