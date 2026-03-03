import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapPinIcon, PhoneIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import BackButton from '../../components/ui/BackButton'
import { enrichApi } from '../../api/enrich'
import PickModal from '../../components/discover/PickModal'
import CreatePollModal from '../../components/modals/CreatePollModal'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import { PageLoader } from '../../components/ui/LoadingSpinner'

const ACCENT = '#f59e0b'
const MAPS_EMBED_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

export default function ArtsDetail() {
  const { placeId } = useParams()
  const navigate = useNavigate()
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

  if (loading) return <Layout><PageLoader /></Layout>
  if (!place) return <Layout><div className="p-6 text-gray-500">Venue not found.</div></Layout>

  const photos = place.photo_object_keys || []
  const weekdays = place.hours?.weekdayDescriptions || []

  return (
    <Layout>
      <main className="flex-1 overflow-y-auto">
        <div className="w-full h-52 bg-amber-50 overflow-hidden">
          {photos[0]?.url ? (
            <img src={photos[0].url} alt={place.name} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <MapPinIcon className="h-16 w-16 text-amber-200" />
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          <BackButton />

          <div>
            <h1 className="text-xl font-bold text-gray-900">{place.name}</h1>
            {place.address && (
              <p className="text-sm text-gray-500 mt-1 flex items-start gap-1">
                <MapPinIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {place.address}
              </p>
            )}
            {place.rating && (
              <p className="text-sm font-medium text-amber-500 mt-1">★ {place.rating.toFixed(1)}</p>
            )}
          </div>

          {(place.phone || place.website) && (
            <div className="flex gap-4">
              {place.phone && (
                <a href={`tel:${place.phone}`} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                  <PhoneIcon className="h-4 w-4" />{place.phone}
                </a>
              )}
              {place.website && (
                <a href={place.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                  <GlobeAltIcon className="h-4 w-4" />Website
                </a>
              )}
            </div>
          )}

          {weekdays.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Hours</h3>
              <ul className="space-y-0.5">
                {weekdays.map((d, i) => <li key={i} className="text-xs text-gray-600">{d}</li>)}
              </ul>
            </div>
          )}

          {place.lat && place.lng && (
            <div className="rounded-xl overflow-hidden border border-gray-200 h-48">
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
                  className="flex items-center justify-center h-full bg-gray-50 text-sm text-blue-600 underline"
                >
                  View on Google Maps
                </a>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button style={{ flex: 1, backgroundColor: ACCENT, borderColor: ACCENT }} size="lg" onClick={() => setShowPick(true)}>
              Pick This Venue
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setShowPoll(true)}>💬 Poll Group</Button>
          </div>
        </div>
      </main>

      {showPick && (
        <PickModal title={place.name} location={place.address} activityType="arts" onClose={() => setShowPick(false)} onPollGroup={() => { setShowPick(false); setShowPoll(true) }} />
      )}
      <CreatePollModal isOpen={showPoll} onClose={() => setShowPoll(false)} activityName={place?.name} activityType="arts" onCreated={() => setShowPoll(false)} />
    </Layout>
  )
}
