import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { MapPinIcon, PhoneIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import AppShell from '../../components/shell/AppShell'
import BackButton from '../../components/ui/BackButton'
import { enrichApi } from '../../api/enrich'
import PickModal from '../../components/discover/PickModal'
import CreatePollModal from '../../components/modals/CreatePollModal'

const ACCENT = '#f59e0b'
const MAPS_EMBED_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid var(--glass)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default function ArtsDetail() {
  const { placeId } = useParams()
  const [place, setPlace] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPick, setShowPick] = useState(false)
  const [showPoll, setShowPoll] = useState(false)

  useEffect(() => {
    enrichApi.getArts(placeId)
      .then(setPlace)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [placeId])

  if (loading) return <AppShell><Spinner /></AppShell>
  if (!place) return (
    <AppShell>
      <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--t3)' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎭</div>
        <div style={{ fontWeight: 700, color: 'var(--t2)' }}>Venue not found</div>
      </div>
    </AppShell>
  )

  const photos = place.photo_object_keys || []
  const weekdays = place.hours?.weekdayDescriptions || []

  return (
    <AppShell>
      {/* Hero photo */}
      <div style={{ position: 'relative', width: '100%', height: '260px', background: 'var(--s3)', overflow: 'hidden' }}>
        {photos[0]?.url ? (
          <img src={photos[0].url} alt={place.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ fontSize: '56px' }}>🎭</span>
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(8,8,10,0.85) 100%)' }} />
      </div>

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
          {place.rating && (
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>★ {place.rating.toFixed(1)}</span>
          )}
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
            style={{ flex: 1, background: ACCENT, color: '#0a0a0f', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}
          >
            Pick This Venue
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
        <PickModal title={place.name} location={place.address} activityType="arts" onClose={() => setShowPick(false)} onPollGroup={() => { setShowPick(false); setShowPoll(true) }} />
      )}
      <CreatePollModal isOpen={showPoll} onClose={() => setShowPoll(false)} activityName={place?.name} activityType="arts" onCreated={() => setShowPoll(false)} />
    </AppShell>
  )
}
