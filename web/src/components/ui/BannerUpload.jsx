import { useRef, useState } from 'react'
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline'

/**
 * BannerUpload — drag-drop or click-to-pick banner image.
 * Props:
 *   value       : current preview URL (string | null)
 *   onChange    : (file: File | null) => void — called on pick/remove
 *   aspectRatio : CSS ratio string, default '16/5'
 *   label       : string, default 'Banner Image'
 */
export default function BannerUpload({ value, onChange, aspectRatio = '16/5', label = 'Banner Image' }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    onChange(file)
  }

  const handleInputChange = (e) => {
    handleFile(e.target.files?.[0] ?? null)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0] ?? null)
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: '8px' }}>
        {label}
      </label>

      <div
        onClick={() => !value && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          position: 'relative',
          aspectRatio,
          borderRadius: '14px',
          overflow: 'hidden',
          border: `2px ${dragging ? 'solid' : 'dashed'} ${dragging ? 'var(--rose)' : value ? 'transparent' : 'var(--glass)'}`,
          background: value ? 'transparent' : 'var(--s3)',
          cursor: value ? 'default' : 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {value ? (
          <>
            <img
              src={value}
              alt="Banner preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {/* Overlay controls */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
              padding: '10px',
              opacity: 0,
              transition: 'opacity 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.35)'; e.currentTarget.style.opacity = '1' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0)'; e.currentTarget.style.opacity = '0' }}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  style={{ fontSize: '12px', fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '8px', padding: '5px 12px', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onChange(null) }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', cursor: 'pointer' }}
                >
                  <XMarkIcon style={{ width: '14px', height: '14px', color: '#fff' }} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <PhotoIcon style={{ width: '32px', height: '32px', color: 'var(--t3)', margin: '0 auto 8px' }} />
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--t2)', margin: '0 0 4px' }}>
              {dragging ? 'Drop image here' : 'Click or drag to upload'}
            </p>
            <p style={{ fontSize: '12px', color: 'var(--t3)', margin: 0 }}>PNG, JPG, WEBP · Shown as banner</p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />
    </div>
  )
}
