import { useState, useRef } from 'react'
import './animatedThemes.css'

const PRESET_COLORS = [
  '#f43f5e', '#e11d48', '#ec4899', '#d946ef',
  '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6',
  '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981',
  '#22c55e', '#84cc16', '#f59e0b', '#f97316',
]

const THEMES = [
  { key: 'aurora', label: 'Aurora' },
  { key: 'gradient-wave', label: 'Gradient Wave' },
  { key: 'mesh-glow', label: 'Mesh Glow' },
  { key: 'starfield', label: 'Starfield' },
  { key: 'sunset', label: 'Sunset' },
  { key: 'ocean', label: 'Ocean' },
  { key: 'neon-pulse', label: 'Neon Pulse' },
  { key: 'particles-float', label: 'Particles' },
]

const THEME_CLASSES = {
  aurora: 'theme-aurora',
  'gradient-wave': 'theme-gradient-wave',
  'mesh-glow': 'theme-mesh-glow',
  starfield: 'theme-starfield',
  sunset: 'theme-sunset',
  ocean: 'theme-ocean',
  'neon-pulse': 'theme-neon-pulse',
  'particles-float': 'theme-particles-float',
}

const SCOPES = [
  { value: 'hero', label: 'Hero Only' },
  { value: 'full', label: 'Full Page' },
  { value: 'cards_hero', label: 'Cards + Hero' },
]

const tabStyle = (active) => ({
  flex: 1,
  padding: '7px',
  borderRadius: '8px',
  textAlign: 'center',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  transition: 'all 0.15s',
  background: active ? 'var(--s2)' : 'transparent',
  color: active ? 'var(--t1)' : 'var(--t3)',
  boxShadow: active ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
})

export default function BackgroundPicker({
  bgType = 'default',
  bgValue = '',
  bgScope = 'hero',
  onChange,
  onImageUpload,
  imageUploading = false,
}) {
  const [tab, setTab] = useState(
    bgType === 'image' ? 'image' : bgType === 'theme' ? 'themes' : 'color'
  )
  const [gradientMode, setGradientMode] = useState(false)
  const [gradColor1, setGradColor1] = useState('#f43f5e')
  const [gradColor2, setGradColor2] = useState('#6366f1')
  const fileRef = useRef()

  const emit = (type, value) => {
    onChange?.({ bg_type: type, bg_value: value })
  }

  const handleColorClick = (color) => {
    if (gradientMode) return
    emit('color', color)
  }

  const handleGradientApply = () => {
    emit('gradient', `linear-gradient(135deg, ${gradColor1}, ${gradColor2})`)
  }

  const handleThemeClick = (key) => {
    emit('theme', key)
  }

  const handleReset = () => {
    onChange?.({ bg_type: 'default', bg_value: '' })
  }

  const handleScopeChange = (scope) => {
    onChange?.({ bg_scope: scope })
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) onImageUpload?.(file)
  }

  const isSelected = (type, value) => bgType === type && bgValue === value

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', background: 'var(--s4)', borderRadius: '10px', padding: '3px', marginBottom: '14px' }}>
        {['color', 'image', 'themes'].map(t => (
          <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
            {t === 'color' ? 'Color' : t === 'image' ? 'Image' : 'Themes'}
          </button>
        ))}
      </div>

      {/* Color tab */}
      {tab === 'color' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px', marginBottom: '12px' }}>
            {PRESET_COLORS.map(c => (
              <div
                key={c}
                onClick={() => handleColorClick(c)}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: '8px',
                  background: c,
                  cursor: 'pointer',
                  border: isSelected('color', c) ? '2px solid #fff' : '2px solid transparent',
                  boxShadow: isSelected('color', c) ? `0 0 0 1px ${c}` : 'none',
                  transition: 'all 0.12s',
                }}
              />
            ))}
          </div>

          {/* Custom color */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t3)' }}>Custom:</label>
            <input
              type="color"
              value={bgType === 'color' ? bgValue : '#f43f5e'}
              onChange={e => emit('color', e.target.value)}
              style={{ width: '32px', height: '32px', border: 'none', background: 'none', cursor: 'pointer' }}
            />
          </div>

          {/* Gradient toggle */}
          <div style={{ borderTop: '1px solid var(--glass)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t3)' }}>Gradient</label>
              <button
                onClick={() => setGradientMode(v => !v)}
                style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--glass)',
                  background: gradientMode ? 'var(--rose-soft)' : 'var(--s3)',
                  color: gradientMode ? '#fff' : 'var(--t3)',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {gradientMode ? 'On' : 'Off'}
              </button>
            </div>
            {gradientMode && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input type="color" value={gradColor1} onChange={e => setGradColor1(e.target.value)}
                  style={{ width: '32px', height: '32px', border: 'none', background: 'none', cursor: 'pointer' }} />
                <span style={{ fontSize: '11px', color: 'var(--t4)' }}>→</span>
                <input type="color" value={gradColor2} onChange={e => setGradColor2(e.target.value)}
                  style={{ width: '32px', height: '32px', border: 'none', background: 'none', cursor: 'pointer' }} />
                <div style={{
                  flex: 1, height: '28px', borderRadius: '6px',
                  background: `linear-gradient(135deg, ${gradColor1}, ${gradColor2})`,
                }} />
                <button
                  onClick={handleGradientApply}
                  style={{
                    padding: '5px 12px', borderRadius: '6px', border: 'none',
                    background: 'var(--rose-soft)', color: '#fff', fontSize: '11px',
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image tab */}
      {tab === 'image' && (
        <div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          {bgType === 'image' && bgValue ? (
            <div
              style={{ position: 'relative', height: '120px', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }}
              onClick={() => fileRef.current?.click()}
            >
              <img src={bgValue} alt="Background" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.45)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0)'}
              >
                <span style={{ color: '#fff', fontSize: '13px', fontWeight: 700, opacity: 0, transition: 'opacity 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                >
                  Change Image
                </span>
              </div>
              {imageUploading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: '13px' }}>Uploading...</span>
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                height: '120px', background: 'var(--s2)', borderRadius: '12px',
                border: '1px dashed rgba(255,255,255,0.15)', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              <span style={{ fontSize: '28px' }}>🖼️</span>
              <span style={{ fontSize: '12px', color: 'var(--rose-soft)' }}>Upload background image</span>
            </div>
          )}
        </div>
      )}

      {/* Themes tab */}
      {tab === 'themes' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {THEMES.map(t => (
            <div
              key={t.key}
              onClick={() => handleThemeClick(t.key)}
              style={{
                borderRadius: '10px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: isSelected('theme', t.key) ? '2px solid var(--rose-soft)' : '2px solid var(--glass)',
                transition: 'all 0.12s',
              }}
            >
              <div
                className={THEME_CLASSES[t.key]}
                style={{ height: '48px', position: 'relative' }}
              />
              <div style={{
                padding: '5px 6px', textAlign: 'center', fontSize: '9px',
                fontWeight: 600, color: isSelected('theme', t.key) ? 'var(--t1)' : 'var(--t3)',
                background: 'var(--s3)',
              }}>
                {t.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scope selector */}
      <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--glass)' }}>
        <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t3)', display: 'block', marginBottom: '6px' }}>
          Apply to
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {SCOPES.map(s => (
            <label
              key={s.value}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                fontSize: '11px', fontWeight: 500, color: bgScope === s.value ? 'var(--t1)' : 'var(--t3)',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="bg_scope"
                checked={bgScope === s.value}
                onChange={() => handleScopeChange(s.value)}
                style={{ accentColor: 'var(--rose)' }}
              />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      {/* Reset button */}
      {bgType !== 'default' && (
        <button
          onClick={handleReset}
          style={{
            marginTop: '10px', padding: '5px 12px', borderRadius: '6px',
            border: '1px solid var(--glass)', background: 'var(--s3)',
            color: 'var(--t3)', fontSize: '11px', fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Reset to Default
        </button>
      )}
    </div>
  )
}
