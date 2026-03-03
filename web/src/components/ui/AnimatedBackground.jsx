import './animatedThemes.css'

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

export default function AnimatedBackground({ bgType, bgValue, style = {} }) {
  if (!bgType || bgType === 'default') return null

  const base = {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    pointerEvents: 'none',
    borderRadius: 'inherit',
    overflow: 'hidden',
    ...style,
  }

  if (bgType === 'color') {
    return (
      <div style={base}>
        <div style={{ position: 'absolute', inset: 0, background: bgValue }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.4))' }} />
      </div>
    )
  }

  if (bgType === 'gradient') {
    return (
      <div style={base}>
        <div style={{ position: 'absolute', inset: 0, background: bgValue }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.35))' }} />
      </div>
    )
  }

  if (bgType === 'image') {
    return (
      <div style={base}>
        <img
          src={bgValue}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.6))',
          }}
        />
      </div>
    )
  }

  if (bgType === 'theme') {
    const cls = THEME_CLASSES[bgValue]
    if (!cls) return null
    return (
      <div style={base}>
        <div className={cls} style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.3))' }} />
      </div>
    )
  }

  return null
}

export { THEME_CLASSES }
