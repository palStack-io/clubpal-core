import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { MapPinIcon, PhoneIcon, GlobeAltIcon, StarIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import AppShell from '../../components/shell/AppShell'
import BackButton from '../../components/ui/BackButton'
import { enrichApi } from '../../api/enrich'
import PickModal from '../../components/discover/PickModal'
import CreatePollModal from '../../components/modals/CreatePollModal'

const MAPS_EMBED_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

function PhotoCarousel({ photos }) {
  const [idx, setIdx] = useState(0)
  if (!photos?.length) return (
    <div style={{ width: '100%', height: '260px', background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <MapPinIcon style={{ width: '48px', height: '48px', color: 'var(--t4)' }} />
    </div>
  )
  return (
    <div style={{ position: 'relative', width: '100%', height: '260px', background: '#000', overflow: 'hidden' }}>
      <img src={photos[idx]?.url || photos[idx]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
      {/* gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(8,8,10,0.85) 100%)' }} />
      {photos.length > 1 && (
        <>
          <button
            onClick={() => setIdx(i => (i - 1 + photos.length) % photos.length)}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <ChevronLeftIcon style={{ width: '16px', height: '16px', color: '#fff' }} />
          </button>
          <button
            onClick={() => setIdx(i => (i + 1) % photos.length)}
            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <ChevronRightIcon style={{ width: '16px', height: '16px', color: '#fff' }} />
          </button>
          <div style={{ position: 'absolute', bottom: '12px', insetInline: 0, display: 'flex', justifyContent: 'center', gap: '6px' }}>
            {photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                style={{ width: '6px', height: '6px', borderRadius: '50%', background: i === idx ? '#fff' : 'rgba(255,255,255,0.4)', border: 'none', padding: 0, cursor: 'pointer' }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid var(--glass)', borderTopColor: 'var(--rose)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default function RestaurantDetail() {
  const { placeId } = useParams()
  const [place, setPlace] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPick, setShowPick] = useState(false)
  const [showPoll, setShowPoll] = useState(false)

  useEffect(() => {
    enrichApi.getPlace(placeId)
      .then(setPlace)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [placeId])

  if (loading) return <AppShell><Spinner /></AppShell>
  if (!place) return (
    <AppShell>
      <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--t3)' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🍽️</div>
        <div style={{ fontWeight: 700, color: 'var(--t2)' }}>Restaurant not found</div>
      </div>
    </AppShell>
  )

  const photos = place.photo_object_keys || []
  const weekdays = place.hours?.weekdayDescriptions || []

  return (
    <AppShell>
      <PhotoCarousel photos={photos} />

      <div style={{ padding: '20px', maxWidth: '720px' }}>
        <div style={{ marginBottom: '16px' }}>
          <BackButton />
        </div>

        {/* Title block */}
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--t1)', margin: '0 0 6px' }}>{place.name}</h1>
          {place.address && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', color: 'var(--t3)', fontSize: '13px', marginBottom: '8px' }}>
              <MapPinIcon style={{ width: '14px', height: '14px', flexShrink: 0, marginTop: '2px' }} />
              {place.address}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {place.rating && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>
                <StarIcon style={{ width: '13px', height: '13px' }} />
                {place.rating.toFixed(1)}
              </span>
            )}
            {place.price_level != null && (
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--rose-soft)' }}>
                {'$'.repeat(place.price_level) || 'Free'}
              </span>
            )}
            {place.hours?.openNow != null && (
              <span style={{ fontSize: '13px', fontWeight: 600, color: place.hours.openNow ? 'var(--green)' : '#f87171' }}>
                {place.hours.openNow ? '● Open now' : '● Closed'}
              </span>
            )}
          </div>
        </div>

        {/* Contact */}
        {(place.phone || place.website) && (
          <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '14px', padding: '14px 16px', marginBottom: '16px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {place.phone && (
              <a href={`tel:${place.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--t2)', fontSize: '13px', textDecoration: 'none' }}>
                <PhoneIcon style={{ width: '14px', height: '14px' }} />
                {place.phone}
              </a>
            )}
            {place.website && (
              <a href={place.website} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--t2)', fontSize: '13px', textDecoration: 'none' }}>
                <GlobeAltIcon style={{ width: '14px', height: '14px' }} />
                Website ↗
              </a>
            )}
          </div>
        )}

        {/* Hours */}
        {weekdays.length > 0 && (
          <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>Hours</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '4px' }}>
              {weekdays.map((d, i) => (
                <li key={i} style={{ fontSize: '12px', color: 'var(--t2)' }}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Map */}
        {place.lat && place.lng && (
          <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--glass)', height: '200px', marginBottom: '20px' }}>
            {MAPS_EMBED_KEY ? (
              <iframe
                title="map"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                src={`https://www.google.com/maps/embed/v1/place?key=${MAPS_EMBED_KEY}&q=${place.lat},${place.lng}`}
                allowFullScreen
              />
            ) : (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--s3)', fontSize: '13px', color: 'var(--blue)', textDecoration: 'underline' }}
              >
                View on Google Maps ↗
              </a>
            )}
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowPick(true)}
            style={{ flex: 1, background: 'linear-gradient(135deg, var(--rose) 0%, var(--rose-soft) 100%)', color: '#fff', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}
          >
            Pick This Restaurant
          </button>
          <button
            onClick={() => setShowPoll(true)}
            style={{ padding: '14px 18px', background: 'var(--s3)', color: 'var(--t2)', border: '1px solid var(--glass)', borderRadius: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            💬 Poll Group
          </button>
        </div>
      </div>

      {showPick && (
        <PickModal
          title={place.name}
          location={place.address}
          activityType="dining"
          onClose={() => setShowPick(false)}
          onPollGroup={() => { setShowPick(false); setShowPoll(true) }}
        />
      )}
      <CreatePollModal
        isOpen={showPoll}
        onClose={() => setShowPoll(false)}
        activityName={place?.name}
        activityType="dining"
        onCreated={() => setShowPoll(false)}
      />
    </AppShell>
  )
}
