import { useState, useRef } from 'react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import { resolveMediaUrl as resolvePhotoUrl } from '../../utils/resolveMediaUrl'

const MAX_GRID = 9

export default function PhotoGalleryCard({ photos = [], currentUserId, onUpload, onDelete }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const fileRef = useRef()

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      onUpload && onUpload(files)
    }
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  const gridPhotos = photos.slice(0, MAX_GRID)
  const overflow = photos.length - MAX_GRID

  const currentPhoto = selectedIndex !== null ? photos[selectedIndex] : null

  const goPrev = (e) => {
    e.stopPropagation()
    setSelectedIndex((i) => (i > 0 ? i - 1 : photos.length - 1))
  }

  const goNext = (e) => {
    e.stopPropagation()
    setSelectedIndex((i) => (i < photos.length - 1 ? i + 1 : 0))
  }

  const closeLightbox = () => setSelectedIndex(null)

  const canDelete = (photo) =>
    currentUserId != null &&
    (String(photo.user_id) === String(currentUserId) || photo.is_admin)

  return (
    <Card>
      <Card.Header
        title={`Photos (${photos.length})`}
        action={
          <Button variant="primary" size="sm" onClick={() => fileRef.current?.click()}>
            📷 Add Photos
          </Button>
        }
      />
      <Card.Body>
        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {photos.length === 0 ? (
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: '14px',
              padding: '40px',
              textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📷</div>
            <div style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '4px' }}>
              No photos yet
            </div>
            <span style={{ fontSize: '12px', color: 'var(--rose-soft)' }}>
              Add the first one
            </span>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
            }}
          >
            {gridPhotos.map((photo, i) => (
              <div
                key={photo.id || i}
                style={{
                  position: 'relative',
                  aspectRatio: '1 / 1',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => setSelectedIndex(i)}
              >
                <img
                  src={resolvePhotoUrl(photo.public_url)}
                  alt={photo.caption || ''}
                  onError={e => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.parentElement.style.background = 'var(--s3)'
                    e.currentTarget.parentElement.style.display = 'flex'
                    e.currentTarget.parentElement.style.alignItems = 'center'
                    e.currentTarget.parentElement.style.justifyContent = 'center'
                    e.currentTarget.parentElement.innerHTML = '<span style="font-size:24px">📷</span>'
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                {hoveredIndex === i && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.45)',
                    }}
                  >
                    {canDelete(photo) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete && onDelete(photo.id)
                        }}
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          width: '24px',
                          height: '24px',
                          background: 'rgba(248,113,113,0.9)',
                          color: '#fff',
                          borderRadius: '50%',
                          border: 'none',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* "+N more" tile */}
            {overflow > 0 && (
              <div
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: '10px',
                  background: 'var(--s3)',
                  border: '1px solid var(--glass)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--rose-soft)',
                }}
                onClick={() => setSelectedIndex(MAX_GRID)}
              >
                +{overflow}
              </div>
            )}
          </div>
        )}
      </Card.Body>

      {/* Lightbox */}
      {selectedIndex !== null && currentPhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.92)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={closeLightbox}
        >
          {/* Image */}
          <img
            src={resolvePhotoUrl(currentPhoto.public_url)}
            alt={currentPhoto.caption || ''}
            onError={e => { e.currentTarget.src = ''; e.currentTarget.style.display = 'none' }}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '12px',
            }}
            onClick={(e) => e.stopPropagation()}
          />

          {/* Prev */}
          {photos.length > 1 && (
            <button
              onClick={goPrev}
              style={{
                position: 'absolute',
                left: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '48px',
                height: '48px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%',
                color: '#fff',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ‹
            </button>
          )}

          {/* Next */}
          {photos.length > 1 && (
            <button
              onClick={goNext}
              style={{
                position: 'absolute',
                right: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '48px',
                height: '48px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '50%',
                color: '#fff',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ›
            </button>
          )}

          {/* Close */}
          <button
            onClick={closeLightbox}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              width: '36px',
              height: '36px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '50%',
              border: 'none',
              color: '#fff',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>

          {/* Uploader + timestamp */}
          {(currentPhoto.uploader_name || currentPhoto.created_at) && (
            <div
              style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              {currentPhoto.uploader_name || ''}
              {currentPhoto.uploader_name && currentPhoto.created_at ? ' · ' : ''}
              {currentPhoto.created_at
                ? new Date(currentPhoto.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : ''}
            </div>
          )}

          {/* Caption */}
          {currentPhoto.caption && (
            <div
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                color: '#fff',
                fontSize: '13px',
                background: 'rgba(0,0,0,0.5)',
                padding: '6px 12px',
                borderRadius: '8px',
                whiteSpace: 'nowrap',
              }}
            >
              {currentPhoto.caption}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
