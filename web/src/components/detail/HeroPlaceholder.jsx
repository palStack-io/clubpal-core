const HERO_GRADIENTS = {
  dining: ['#b8a898', '#7a6050'],
  movie:  ['#1a1035', '#0d0820'],
  book:   ['#2d4a3e', '#1a2e26'],
  game:   ['#0f1a2e', '#071018'],
  show:   ['#1e1010', '#0e0808'],
  hike:   ['#1a2e1a', '#0d1a0d'],
  arts:   ['#2e1a0d', '#1a0d06'],
}

const HERO_ICONS = {
  dining: '🍽️',
  movie:  '🎬',
  book:   '📚',
  game:   '🎮',
  show:   '📺',
  hike:   '🥾',
  arts:   '🎨',
}

export default function HeroPlaceholder({ type = 'dining', height = 260 }) {
  const [from, to] = HERO_GRADIENTS[type] || HERO_GRADIENTS.dining
  const icon = HERO_ICONS[type] || '✨'
  const id = `hpg-${type}`

  const gridLines = type === 'game' ? Array.from({ length: 16 }, (_, i) => i) : []

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 800 ${height}`}
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>

      <rect width="800" height={height} fill={`url(#${id})`} />

      {/* Game: subtle grid overlay */}
      {gridLines.map(i => (
        <g key={i}>
          <line x1={i * 50} y1="0" x2={i * 50} y2={height} stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
          <line x1="0" y1={i * 20} x2="800" y2={i * 20} stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
        </g>
      ))}

      {/* Subtle vignette ring */}
      <ellipse cx="400" cy={height / 2} rx="300" ry={height * 0.55}
        fill="rgba(0,0,0,0)" stroke="rgba(255,255,255,0.04)" strokeWidth="60" />

      {/* Center icon */}
      <text
        x="400"
        y={height / 2 + 24}
        textAnchor="middle"
        fontSize="72"
        fill="rgba(255,255,255,0.12)"
      >
        {icon}
      </text>
    </svg>
  )
}
