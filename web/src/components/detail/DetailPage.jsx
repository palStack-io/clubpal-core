import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookmarkIcon } from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid'
import AppShell from '../shell/AppShell'
import BackButton from '../ui/BackButton'
import CreateEventModal from '../modals/CreateEventModal'
import CreatePollModal from '../modals/CreatePollModal'
import PickModal from '../discover/PickModal'
import { PhotoCarouselImage, CarouselArrow, CarouselDots } from './PhotoCarousel'
import InfoCard from './InfoCard'
import ReviewCard from './ReviewCard'
import RatingBreakdown from './RatingBreakdown'
import HoursBlock from './HoursBlock'
import MapBlock from './MapBlock'
import { useAuth } from '../../contexts/AuthContext'
import { gatewayClient } from '../../api/client'

// ─── Google Fonts (injected once) ───────────────────────────────────────────
const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=DM+Sans:wght@400;500;600;700&display=swap'

function injectFonts() {
  if (document.getElementById('clubpal-detail-fonts')) return
  const link = document.createElement('link')
  link.id = 'clubpal-detail-fonts'
  link.rel = 'stylesheet'
  link.href = FONT_URL
  document.head.appendChild(link)
}

// ─── Per-type configuration ──────────────────────────────────────────────────
const TYPE_CONFIG = {
  dining: {
    ctaLabel: 'Pick This Restaurant',
    accentBg: 'linear-gradient(135deg, var(--rose) 0%, var(--rose-soft) 100%)',
    accentColor: '#f43f5e',
    activityType: 'dining',
    italic: false,
    notFoundEmoji: '🍽️',
    notFoundLabel: 'Restaurant not found',
    tagStyle: { bg: 'rgba(244,63,94,0.14)', color: '#fb7185' },
    hasMap: true,
    hasHours: true,
    normalize: (d) => ({
      title: d.name,
      photos: (d.photo_object_keys || []).map(p => p?.url || p).filter(Boolean),
      posterUrl: null,
      tags: d.cuisine ? [d.cuisine] : [],
      rating: d.rating ?? null,
      metaItems: [
        d.rating ? `★ ${Number(d.rating).toFixed(1)}` : null,
        d.price_level ? '$'.repeat(d.price_level) : null,
        d.hours?.openNow != null ? (d.hours.openNow ? '● Open' : '● Closed') : null,
      ].filter(Boolean),
      metaColors: {
        [d.rating ? `★ ${Number(d.rating).toFixed(1)}` : null]: '#f5c842',
        [d.hours?.openNow != null ? (d.hours.openNow ? '● Open' : '● Closed') : null]:
          d.hours?.openNow ? 'var(--green)' : '#f87171',
      },
      infoFields: [
        { label: 'Cuisine', value: d.cuisine },
        { label: 'Price', value: d.price_level ? '$'.repeat(d.price_level) : null },
        { label: 'Phone', value: d.phone, href: d.phone ? `tel:${d.phone}` : null },
        { label: 'Website', value: d.website ? 'Visit website ↗' : null, href: d.website },
      ].filter(f => f.value),
      descriptionLabel: 'About',
      description: d.description,
      address: d.address,
      phone: d.phone,
      website: d.website,
      lat: d.lat,
      lng: d.lng,
      hours: d.hours,
      trailerKey: null,
      castList: null,
      inLibrary: false,
      reviews: d.reviews || [],
      ratingBreakdown: d.ratingBreakdown || null,
    }),
  },

  movie: {
    ctaLabel: 'Select for Watch Party',
    accentBg: '#6366f1',
    accentColor: '#6366f1',
    activityType: 'movies',
    italic: true,
    notFoundEmoji: '🎬',
    notFoundLabel: 'Movie not found',
    tagStyle: { bg: 'rgba(99,102,241,0.15)', color: '#818cf8' },
    hasMap: false,
    hasHours: false,
    normalize: (d) => ({
      title: d.title,
      photos: [d.backdrop_url, d.poster_url].filter(Boolean),
      posterUrl: d.poster_url || null,
      tags: d.genres || [],
      rating: d.rating ?? null,
      metaItems: [
        d.rating ? `★ ${Number(d.rating).toFixed(1)}` : null,
        d.release_date ? d.release_date.slice(0, 4) : null,
        d.runtime ? `${d.runtime} min` : null,
        d.rating_label || null,
      ].filter(Boolean),
      metaColors: { [d.rating ? `★ ${Number(d.rating).toFixed(1)}` : null]: '#f5c842' },
      infoFields: [
        { label: 'Director', value: d.director },
        { label: 'Studio', value: d.studio },
        {
          label: 'Cast',
          value: d.cast_list?.slice(0, 3).map(c => c.name).join(', ') || d.cast,
        },
        { label: 'Box Office', value: d.box_office || d.boxOffice },
      ].filter(f => f.value),
      descriptionLabel: 'Synopsis',
      description: d.overview || d.synopsis,
      address: null, phone: null, website: null, lat: null, lng: null, hours: null,
      trailerKey: d.trailer_key || null,
      castList: d.cast_list || null,
      inLibrary: false,
      reviews: d.reviews || [],
      ratingBreakdown: d.ratingBreakdown || null,
    }),
  },

  book: {
    ctaLabel: 'Select for Reading Party',
    accentBg: '#a855f7',
    accentColor: '#a855f7',
    activityType: 'books',
    italic: true,
    notFoundEmoji: '📚',
    notFoundLabel: 'Book not found',
    tagStyle: { bg: 'rgba(168,85,247,0.15)', color: '#c084fc' },
    hasMap: false,
    hasHours: false,
    normalize: (d) => ({
      title: d.title,
      photos: d.cover_url ? [d.cover_url] : [],
      posterUrl: d.cover_url || null,
      tags: d.categories || d.genres || [],
      rating: d.rating ?? null,
      metaItems: [
        d.rating ? `★ ${Number(d.rating).toFixed(1)}` : null,
        d.page_count ? `${d.page_count} pages` : null,
        d.published_date ? d.published_date.slice(0, 4) : null,
      ].filter(Boolean),
      metaColors: { [d.rating ? `★ ${Number(d.rating).toFixed(1)}` : null]: '#f5c842' },
      infoFields: [
        { label: 'Author', value: Array.isArray(d.authors) ? d.authors.join(', ') : d.author },
        { label: 'Publisher', value: d.publisher },
        { label: 'Awards', value: d.awards },
        { label: 'Length', value: d.page_count ? `${d.page_count} pages` : null },
      ].filter(f => f.value),
      descriptionLabel: 'Description',
      description: d.description,
      address: null, phone: null,
      website: d.preview_link || null,
      lat: null, lng: null, hours: null,
      trailerKey: null,
      castList: null,
      inLibrary: false,
      reviews: d.reviews || [],
      ratingBreakdown: d.ratingBreakdown || null,
    }),
  },

  game: {
    ctaLabel: 'Select for Game Night',
    accentBg: '#22d3ee',
    accentColor: '#22d3ee',
    activityType: 'gaming',
    italic: false,
    notFoundEmoji: '🎮',
    notFoundLabel: 'Game not found',
    tagStyle: { bg: 'rgba(34,211,238,0.14)', color: '#22d3ee' },
    hasMap: false,
    hasHours: false,
    normalize: (d) => ({
      title: d.name || d.title,
      photos: d.screenshots?.length ? d.screenshots : d.cover_url ? [d.cover_url] : [],
      posterUrl: d.cover_url || null,
      tags: d.genres || (d.genre ? [d.genre] : []),
      rating: d.rating ?? null,
      metaItems: [
        d.rating ? `★ ${Number(d.rating).toFixed(1)}` : null,
        d.genre || d.genres?.[0],
        d.release_year ? String(d.release_year) : null,
      ].filter(Boolean),
      metaColors: { [d.rating ? `★ ${Number(d.rating).toFixed(1)}` : null]: '#f5c842' },
      infoFields: [
        { label: 'Developer', value: d.developer },
        { label: 'Publisher', value: d.publisher },
        { label: 'Genre', value: d.genre || d.genres?.join(', ') },
        { label: 'Avg. Playtime', value: d.avg_playtime || d.avgPlaytime },
      ].filter(f => f.value),
      descriptionLabel: 'About',
      description: d.summary || d.about || d.description,
      address: null, phone: null, website: null, lat: null, lng: null, hours: null,
      trailerKey: null,
      castList: null,
      inLibrary: false,
      reviews: d.reviews || [],
      ratingBreakdown: d.ratingBreakdown || null,
    }),
  },

  show: {
    ctaLabel: 'Select for Watch Party',
    accentBg: '#dc2626',
    accentColor: '#dc2626',
    activityType: 'shows',
    italic: true,
    notFoundEmoji: '📺',
    notFoundLabel: 'Show not found',
    tagStyle: { bg: 'rgba(220,38,38,0.14)', color: '#f87171' },
    hasMap: false,
    hasHours: false,
    normalize: (d, extra = {}) => ({
      title: d.title,
      photos: [d.backdrop_url, d.poster_url].filter(Boolean),
      posterUrl: d.poster_url || null,
      tags: d.genres || [],
      rating: d.rating ?? null,
      metaItems: [
        d.rating ? `★ ${Number(d.rating).toFixed(1)}` : null,
        d.first_air_date ? d.first_air_date.slice(0, 4) : null,
        d.number_of_seasons ? `${d.number_of_seasons} season${d.number_of_seasons !== 1 ? 's' : ''}` : null,
        d.number_of_episodes ? `${d.number_of_episodes} ep` : null,
      ].filter(Boolean),
      metaColors: { [d.rating ? `★ ${Number(d.rating).toFixed(1)}` : null]: '#f5c842' },
      infoFields: [
        { label: 'Creator', value: d.creator || d.created_by },
        { label: 'Network', value: d.network || d.networks?.[0] },
        { label: 'Episodes', value: d.number_of_episodes ? `${d.number_of_episodes} episodes` : null },
        { label: 'Status', value: d.status },
      ].filter(f => f.value),
      descriptionLabel: 'Synopsis',
      description: d.overview || d.synopsis,
      address: null, phone: null, website: null, lat: null, lng: null, hours: null,
      trailerKey: d.trailer_key || null,
      castList: d.cast_list || null,
      inLibrary: extra.inLibrary || false,
      reviews: d.reviews || [],
      ratingBreakdown: d.ratingBreakdown || null,
    }),
  },

  hike: {
    ctaLabel: 'Plan This Hike',
    accentBg: '#14b8a6',
    accentColor: '#14b8a6',
    activityType: 'hiking',
    italic: false,
    notFoundEmoji: '🥾',
    notFoundLabel: 'Hike not found',
    tagStyle: { bg: 'rgba(20,184,166,0.14)', color: '#2dd4bf' },
    hasMap: true,
    hasHours: false,
    normalize: (d) => ({
      title: d.name,
      photos: (d.photo_object_keys || []).map(p => p?.url || p).filter(Boolean),
      posterUrl: null,
      tags: d.difficulty ? [d.difficulty] : [],
      rating: d.rating ?? null,
      metaItems: [
        d.rating ? `★ ${Number(d.rating).toFixed(1)}` : null,
        d.difficulty,
        d.length,
      ].filter(Boolean),
      metaColors: { [d.rating ? `★ ${Number(d.rating).toFixed(1)}` : null]: '#f5c842' },
      infoFields: [
        { label: 'Difficulty', value: d.difficulty },
        { label: 'Length', value: d.length },
        { label: 'Elevation', value: d.elevation },
        { label: 'Type', value: d.trail_type },
      ].filter(f => f.value),
      descriptionLabel: 'About',
      description: d.description,
      address: d.address, phone: null, website: null,
      lat: d.lat, lng: d.lng, hours: null,
      trailerKey: null, castList: null, inLibrary: false,
      reviews: d.reviews || [],
      ratingBreakdown: d.ratingBreakdown || null,
    }),
  },

  arts: {
    ctaLabel: 'Plan This Visit',
    accentBg: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
    accentColor: '#f59e0b',
    activityType: 'arts',
    italic: false,
    notFoundEmoji: '🎨',
    notFoundLabel: 'Venue not found',
    tagStyle: { bg: 'rgba(245,158,11,0.14)', color: '#fbbf24' },
    hasMap: true,
    hasHours: true,
    normalize: (d) => ({
      title: d.name,
      photos: (d.photo_object_keys || []).map(p => p?.url || p).filter(Boolean),
      posterUrl: null,
      tags: d.type ? [d.type] : [],
      rating: d.rating ?? null,
      metaItems: [
        d.rating ? `★ ${Number(d.rating).toFixed(1)}` : null,
        d.type,
        d.hours?.openNow != null ? (d.hours.openNow ? '● Open' : '● Closed') : null,
      ].filter(Boolean),
      metaColors: {
        [d.rating ? `★ ${Number(d.rating).toFixed(1)}` : null]: '#f5c842',
        [d.hours?.openNow != null ? (d.hours.openNow ? '● Open' : '● Closed') : null]:
          d.hours?.openNow ? 'var(--green)' : '#f87171',
      },
      infoFields: [
        { label: 'Type', value: d.type },
        { label: 'Phone', value: d.phone, href: d.phone ? `tel:${d.phone}` : null },
        { label: 'Website', value: d.website ? 'Visit website ↗' : null, href: d.website },
        { label: 'Admission', value: d.admission },
      ].filter(f => f.value),
      descriptionLabel: 'About',
      description: d.description,
      address: d.address, phone: d.phone, website: d.website,
      lat: d.lat, lng: d.lng, hours: d.hours,
      trailerKey: null, castList: null, inLibrary: false,
      reviews: d.reviews || [],
      ratingBreakdown: d.ratingBreakdown || null,
    }),
  },
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
function Spinner({ accentColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
      <div
        style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--glass)',
          borderTopColor: accentColor || 'var(--rose)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
/**
 * Unified detail page shell for all 5 discover content types.
 *
 * Props:
 *   type      'dining' | 'movie' | 'book' | 'game' | 'show' | 'hike' | 'arts'
 *   itemId    string — the raw ID used to fetch this item (placeId, tmdbId, volumeId, etc.)
 *   data      Raw API response object
 *   extra     Extra per-type state (e.g. { inLibrary } for show)
 *   loading   boolean
 */
export default function DetailPage({ type, itemId, data: rawData, extra = {}, loading = false }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.dining
  const data = rawData ? cfg.normalize(rawData, extra) : null
  const { user } = useAuth()
  const navigate = useNavigate()

  const [photoIdx, setPhotoIdx] = useState(0)
  const [saved, setSaved]       = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [showPick, setShowPick] = useState(false)
  const [showPoll, setShowPoll] = useState(false)
  const [isWide, setIsWide]     = useState(() => typeof window !== 'undefined' && window.innerWidth >= 900)

  useEffect(() => {
    injectFonts()
    const check = () => setIsWide(window.innerWidth >= 900)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Check saved state once item is loaded
  useEffect(() => {
    if (!user || !itemId || !data) return
    gatewayClient.get(`/users/me/saved/${type}/${encodeURIComponent(itemId)}`)
      .then(() => setSaved(true))
      .catch(() => setSaved(false))
  }, [user, itemId, type, data?.title])

  // Loading state
  if (loading) {
    return <AppShell><Spinner accentColor={cfg.accentColor} /></AppShell>
  }

  // Not found state
  if (!data) {
    return (
      <AppShell>
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--t3)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>{cfg.notFoundEmoji}</div>
          <div style={{ fontWeight: 700, color: 'var(--t2)' }}>{cfg.notFoundLabel}</div>
        </div>
      </AppShell>
    )
  }

  const photos    = data.photos
  const heroH     = isWide ? 340 : 260
  const { tagStyle } = cfg

  // ── Hero section ───────────────────────────────────────────────────────────
  const HeroSection = (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: `${heroH}px`,
        background: '#000',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Photo or placeholder */}
      <div style={{ width: '100%', height: '100%' }}>
        <PhotoCarouselImage
          photos={photos}
          idx={photoIdx}
          height={heroH}
          type={type}
        />
      </div>

      {/* Gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 35%, transparent 52%, rgba(0,0,0,0.72) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Back pill — top left */}
      <div style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 4 }}>
        <BackButton />
      </div>

      {/* Save button — top right */}
      <button
        onClick={async () => {
          if (!user || !itemId || !data || saveLoading) return
          setSaveLoading(true)
          try {
            if (saved) {
              await gatewayClient.delete(`/users/me/saved/${type}/${encodeURIComponent(itemId)}`)
              setSaved(false)
            } else {
              await gatewayClient.post('/users/me/saved', {
                item_type: type,
                item_id: String(itemId),
                item_name: data.title,
                item_meta: {
                  rating: data.rating,
                  address: data.address,
                  photo: data.photos[0] || null,
                  poster: data.posterUrl || null,
                },
              })
              setSaved(true)
            }
          } catch {
            // silently ignore — button just won't update
          } finally {
            setSaveLoading(false)
          }
        }}
        title={saved ? 'Remove from saved' : 'Save'}
        style={{
          position: 'absolute',
          top: '14px',
          right: '14px',
          zIndex: 4,
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.45)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: saveLoading ? 'wait' : 'pointer',
          backdropFilter: 'blur(4px)',
          opacity: saveLoading ? 0.6 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {saved
          ? <BookmarkSolid style={{ width: '18px', height: '18px', color: cfg.accentColor }} />
          : <BookmarkIcon style={{ width: '18px', height: '18px', color: '#fff' }} />
        }
      </button>

      {/* Carousel arrows */}
      {photos.length > 1 && (
        <>
          <CarouselArrow
            direction="left"
            onClick={() => setPhotoIdx(i => (i - 1 + photos.length) % photos.length)}
          />
          <CarouselArrow
            direction="right"
            onClick={() => setPhotoIdx(i => (i + 1) % photos.length)}
          />
        </>
      )}

      {/* Carousel dots — bottom right */}
      <CarouselDots
        count={photos.length}
        activeIdx={photoIdx}
        onSelect={setPhotoIdx}
      />

      {/* IN LIBRARY badge (show type) */}
      {data.inLibrary && (
        <div
          style={{
            position: 'absolute',
            top: '14px',
            right: '58px',
            zIndex: 4,
            background: 'var(--green)',
            color: '#000',
            fontSize: '9px',
            fontWeight: 800,
            padding: '3px 8px',
            borderRadius: '100px',
            letterSpacing: '0.5px',
          }}
        >
          IN LIBRARY
        </div>
      )}

      {/* Hero bottom: tags → title → meta */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '0 16px 16px',
          zIndex: 3,
        }}
      >
        {/* Tag chips */}
        {data.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
            {data.tags.slice(0, 4).map(tag => (
              <span
                key={tag}
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '100px',
                  background: tagStyle.bg,
                  color: tagStyle.color,
                  backdropFilter: 'blur(6px)',
                  letterSpacing: '0.2px',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1
          style={{
            fontFamily: `'Playfair Display', Georgia, serif`,
            fontSize: '24px',
            fontWeight: 700,
            fontStyle: cfg.italic ? 'italic' : 'normal',
            color: '#fff',
            margin: '0 0 8px',
            lineHeight: 1.2,
            textShadow: '0 1px 8px rgba(0,0,0,0.5)',
            maxWidth: '80%',
          }}
        >
          {data.title}
        </h1>

        {/* Meta row */}
        {data.metaItems.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {data.metaItems.map((item, i) => (
              <span key={item}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: data.metaColors?.[item] || 'rgba(255,255,255,0.85)',
                  }}
                >
                  {item}
                </span>
                {i < data.metaItems.length - 1 && (
                  <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: '6px', fontSize: '10px' }}>
                    ·
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // ── CTA row ────────────────────────────────────────────────────────────────
  const CTARow = (
    <div style={{ display: 'flex', gap: '10px' }}>
      <button
        onClick={() => setShowPick(true)}
        style={{
          flex: 1,
          background: cfg.accentBg,
          color: '#fff',
          border: 'none',
          borderRadius: '12px',
          padding: '14px',
          fontSize: '15px',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: `'DM Sans', sans-serif`,
        }}
      >
        {cfg.ctaLabel}
      </button>
      <button
        onClick={() => setShowPoll(true)}
        style={{
          padding: isWide ? '14px 18px' : '14px 14px',
          background: 'var(--s3)',
          color: 'var(--t2)',
          border: '1px solid var(--glass)',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          fontFamily: `'DM Sans', sans-serif`,
        }}
      >
        {isWide ? '💬 Poll Club' : '💬'}
      </button>
    </div>
  )

  // ── Info grid (2-col) ─────────────────────────────────────────────────────
  const InfoGrid = data.infoFields.length > 0 && (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
      }}
    >
      {data.infoFields.map(f => (
        <InfoCard key={f.label} label={f.label} value={f.value} href={f.href} />
      ))}
    </div>
  )

  // ── Description card ──────────────────────────────────────────────────────
  const DescriptionCard = data.description && (
    <div
      style={{
        background: 'var(--s2)',
        border: '1px solid var(--glass)',
        borderRadius: '14px',
        padding: '16px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--t3)',
          textTransform: 'uppercase',
          letterSpacing: '0.7px',
          marginBottom: '8px',
        }}
      >
        {data.descriptionLabel}
      </div>
      <p style={{ fontSize: '13px', color: 'var(--t2)', lineHeight: 1.65, margin: 0 }}>
        {data.description}
      </p>
    </div>
  )

  // ── Trailer embed ─────────────────────────────────────────────────────────
  const TrailerEmbed = data.trailerKey && (
    <div
      style={{
        borderRadius: '14px',
        overflow: 'hidden',
        aspectRatio: '16/9',
        border: '1px solid var(--glass)',
      }}
    >
      <iframe
        title="trailer"
        width="100%"
        height="100%"
        src={`https://www.youtube.com/embed/${data.trailerKey}`}
        allowFullScreen
        style={{ border: 0, display: 'block' }}
      />
    </div>
  )

  // ── Cast list ─────────────────────────────────────────────────────────────
  const CastList = data.castList?.length > 0 && (
    <div
      style={{
        background: 'var(--s2)',
        border: '1px solid var(--glass)',
        borderRadius: '14px',
        padding: '16px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--t3)',
          textTransform: 'uppercase',
          letterSpacing: '0.7px',
          marginBottom: '10px',
        }}
      >
        Cast
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {data.castList.slice(0, 6).map((c, i) => (
          <div key={i} style={{ fontSize: '13px', color: 'var(--t2)' }}>
            <span style={{ fontWeight: 600, color: 'var(--t1)' }}>{c.name}</span>
            {c.character && <span style={{ color: 'var(--t3)' }}> as {c.character}</span>}
          </div>
        ))}
      </div>
    </div>
  )

  // ── Photo thumbnail strip (web left column) ───────────────────────────────
  const PhotoStrip = isWide && photos.length > 1 && (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '6px',
      }}
    >
      {photos.slice(0, 3).map((p, i) => {
        const src = p?.url || p
        return (
          <button
            key={i}
            onClick={() => setPhotoIdx(i)}
            style={{
              height: '70px',
              borderRadius: '10px',
              overflow: 'hidden',
              border: `2px solid ${i === photoIdx ? cfg.accentColor : 'var(--glass)'}`,
              cursor: 'pointer',
              padding: 0,
              background: 'var(--s3)',
            }}
          >
            <img
              src={src}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </button>
        )
      })}
    </div>
  )

  // ── Reviews section ───────────────────────────────────────────────────────
  const reviewsToShow = data.reviews.slice(0, isWide ? 3 : 2)
  const ReviewsSection = reviewsToShow.length > 0 && (
    <div>
      <div
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--t2)',
          marginBottom: '10px',
        }}
      >
        Reviews
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {reviewsToShow.map((r, i) => (
          <ReviewCard key={i} review={r} index={i} />
        ))}
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // LAYOUT: MOBILE (default)
  // ─────────────────────────────────────────────────────────────────────────
  if (!isWide) {
    return (
      <AppShell>
        {HeroSection}

        <div
          style={{
            padding: '20px 16px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            fontFamily: `'DM Sans', sans-serif`,
          }}
        >
          {InfoGrid}
          {DescriptionCard}
          {TrailerEmbed}
          {CastList}
          {cfg.hasMap && <MapBlock lat={data.lat} lng={data.lng} address={data.address} />}
          {cfg.hasHours && <HoursBlock hours={data.hours} />}
          {ReviewsSection}
          {CTARow}
        </div>

        {/* Modals */}
        {showPick && (
          <CreateEventModal
            isOpen={true}
            initialTitle={data.title}
            initialLocation={data.address || null}
            initialImageUrl={data.photos?.[0] || null}
            activityType={cfg.activityType}
            onClose={() => setShowPick(false)}
            onCreated={(id) => { setShowPick(false); navigate(`/events/${id}`) }}
            onPollGroup={() => { setShowPick(false); setShowPoll(true) }}
          />
        )}
        <CreatePollModal
          isOpen={showPoll}
          onClose={() => setShowPoll(false)}
          activityName={data.title}
          activityType={cfg.activityType}
          onCreated={() => setShowPoll(false)}
        />
      </AppShell>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LAYOUT: WEB ≥ 900px — two-column below hero
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AppShell>
      {HeroSection}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          borderTop: '1px solid var(--glass)',
          fontFamily: `'DM Sans', sans-serif`,
          minHeight: '0',
        }}
      >
        {/* Left column */}
        <div
          style={{
            borderRight: '1px solid var(--glass)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {PhotoStrip}
          {InfoGrid}
          {DescriptionCard}
          {TrailerEmbed}
          {CastList}
          {cfg.hasMap && <MapBlock lat={data.lat} lng={data.lng} address={data.address} />}
          {cfg.hasHours && <HoursBlock hours={data.hours} />}
        </div>

        {/* Right column */}
        <div
          style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {data.ratingBreakdown && <RatingBreakdown data={data.ratingBreakdown} />}
          {ReviewsSection}
          <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
            {CTARow}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showPick && (
        <PickModal
          title={data.title}
          location={data.address || null}
          activityType={cfg.activityType}
          onClose={() => setShowPick(false)}
          onPollGroup={() => { setShowPick(false); setShowPoll(true) }}
        />
      )}
      <CreatePollModal
        isOpen={showPoll}
        onClose={() => setShowPoll(false)}
        activityName={data.title}
        activityType={cfg.activityType}
        onCreated={() => setShowPoll(false)}
      />
    </AppShell>
  )
}
