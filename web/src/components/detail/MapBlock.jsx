const MAPS_EMBED_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

/** Map block — shows Google Maps iframe if key is set, else a styled link placeholder. */
export default function MapBlock({ lat, lng, address }) {
  if (!lat || !lng) return null

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`

  return (
    <div
      style={{
        borderRadius: '14px',
        overflow: 'hidden',
        border: '1px solid var(--glass)',
        height: '200px',
        position: 'relative',
      }}
    >
      {MAPS_EMBED_KEY ? (
        <iframe
          title="map"
          width="100%"
          height="100%"
          style={{ border: 0, display: 'block' }}
          src={`https://www.google.com/maps/embed/v1/place?key=${MAPS_EMBED_KEY}&q=${lat},${lng}`}
          allowFullScreen
        />
      ) : (
        /* SVG placeholder map */
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'block', width: '100%', height: '100%', textDecoration: 'none' }}
        >
          <svg
            width="100%"
            height="200"
            viewBox="0 0 600 200"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid slice"
          >
            <rect width="600" height="200" fill="var(--s3)" />
            {/* Road grid */}
            <line x1="0" y1="100" x2="600" y2="100" stroke="var(--s4)" strokeWidth="12" />
            <line x1="300" y1="0" x2="300" y2="200" stroke="var(--s4)" strokeWidth="8" />
            <line x1="0" y1="60" x2="600" y2="60" stroke="var(--s4)" strokeWidth="4" />
            <line x1="0" y1="145" x2="600" y2="145" stroke="var(--s4)" strokeWidth="4" />
            <line x1="160" y1="0" x2="160" y2="200" stroke="var(--s4)" strokeWidth="4" />
            <line x1="440" y1="0" x2="440" y2="200" stroke="var(--s4)" strokeWidth="4" />
            {/* Blocks */}
            <rect x="12" y="12" width="136" height="36" rx="4" fill="var(--s2)" />
            <rect x="12" y="112" width="136" height="24" rx="4" fill="var(--s2)" />
            <rect x="172" y="12" width="116" height="36" rx="4" fill="var(--s2)" />
            <rect x="452" y="64" width="136" height="24" rx="4" fill="var(--s2)" />
            <rect x="312" y="112" width="116" height="24" rx="4" fill="var(--s2)" />
            {/* Pin */}
            <circle cx="300" cy="100" r="20" fill="rgba(244,63,94,0.2)" />
            <circle cx="300" cy="100" r="10" fill="#f43f5e" />
            <circle cx="300" cy="100" r="4" fill="#fff" />
          </svg>

          {/* Open in Maps label */}
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              right: '10px',
              background: 'var(--s2)',
              border: '1px solid var(--glass)',
              borderRadius: '8px',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--blue)',
            }}
          >
            Open in Maps ↗
          </div>
        </a>
      )}
    </div>
  )
}
