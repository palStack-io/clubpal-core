import { useState, useRef } from 'react'
import { billSplitApi } from '../../api/billSplit'
import { eventsApi } from '../../api/events'
import Card from '../ui/Card'
import Button from '../ui/Button'

async function uploadReceiptAsEventPhoto(eventId, file) {
  await eventsApi.uploadPhoto(eventId, file)
}

export default function ReceiptUpload({ eventId, onOCRComplete, onManualEntry, onBack }) {
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef()

  const handleFile = async (file) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please upload a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB.')
      return
    }
    setError(null)
    setPreview(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setUploading(true)
    try {
      const [result] = await Promise.all([
        billSplitApi.uploadReceipt(file),
        eventId ? uploadReceiptAsEventPhoto(eventId, file).catch(() => {}) : Promise.resolve(),
      ])
      onOCRComplete(result)
    } catch (e) {
      setError('Scan failed — you can enter items manually below.')
      setUploading(false)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <Card>
      <Card.Header
        title={
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              style={{ color: 'var(--t3)', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => e.target.style.color = 'var(--t1)'}
              onMouseLeave={e => e.target.style.color = 'var(--t3)'}
            >
              ← Back
            </button>
            <span>Scan Receipt</span>
          </div>
        }
      />
      <Card.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Drop zone */}
          <div
            style={{
              border: `2px dashed ${dragOver ? 'var(--rose)' : 'var(--t4)'}`,
              borderRadius: '16px',
              padding: '32px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
              background: dragOver ? 'var(--rose-glow)' : 'transparent',
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="Receipt preview" style={{ maxHeight: '192px', margin: '0 auto', borderRadius: '8px', objectFit: 'contain', display: 'block' }} />
            ) : (
              <>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>🧾</div>
                <p style={{ color: 'var(--t1)', fontWeight: 500, fontSize: '14px', margin: 0 }}>Drop receipt image here</p>
                <p style={{ color: 'var(--t3)', fontSize: '12px', marginTop: '4px', marginBottom: 0 }}>or click to browse · JPEG, PNG, WebP · max 10MB</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>

          {uploading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--t2)' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid var(--rose)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '13px' }}>Scanning receipt...</span>
            </div>
          )}

          {error && (
            <div
              style={{
                borderRadius: '12px',
                background: 'rgba(245,158,11,0.10)',
                border: '1px solid rgba(245,158,11,0.20)',
                padding: '12px 16px',
                fontSize: '13px',
                color: '#f59e0b',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ textAlign: 'center' }}>
            <button
              style={{
                fontSize: '13px',
                color: 'var(--t2)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
              onMouseEnter={e => e.target.style.color = 'var(--rose)'}
              onMouseLeave={e => e.target.style.color = 'var(--t2)'}
              onClick={onManualEntry}
            >
              Enter items manually →
            </button>
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}
