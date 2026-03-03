// Avatar — supports both legacy name (string) and new user (object) prop
const gradients = [
  'linear-gradient(135deg, #fb7185, #f43f5e)',
  'linear-gradient(135deg, #60a5fa, #3b82f6)',
  'linear-gradient(135deg, #34d399, #10b981)',
  'linear-gradient(135deg, #a78bfa, #7c3aed)',
  'linear-gradient(135deg, #fbbf24, #f59e0b)',
  'linear-gradient(135deg, #f472b6, #ec4899)',
  'linear-gradient(135deg, #818cf8, #4f46e5)',
]

const sizes = {
  sm: { width: '24px', height: '24px', fontSize: '9px' },
  md: { width: '30px', height: '30px', fontSize: '11px' },
  lg: { width: '38px', height: '38px', fontSize: '13px' },
  // legacy aliases
  xs: { width: '24px', height: '24px', fontSize: '9px' },
  xl: { width: '48px', height: '48px', fontSize: '16px' },
}

function getInitials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default function Avatar({ user, name, size = 'md', color, className = '', style: styleProp = {} }) {
  const displayName = user?.full_name || user?.username || (typeof name === 'string' ? name : '') || ''
  const avatarUrl = user?.avatar_url

  const initials = getInitials(displayName)
  const gradientIdx = displayName ? displayName.charCodeAt(0) % gradients.length : 0
  const bg = color || gradients[gradientIdx]

  const sizeStyle = sizes[size] || sizes.md

  const baseStyle = {
    ...sizeStyle,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    flexShrink: 0,
    ...styleProp,
  }

  if (avatarUrl) {
    // Emoji avatar — stored as emoji string, not a URL
    const isEmoji = avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('/')
    if (isEmoji) {
      return (
        <div style={{ ...baseStyle, background: bg }} className={className}>
          <span style={{ fontSize: `calc(${sizeStyle.fontSize} * 1.9)`, lineHeight: 1 }}>{avatarUrl}</span>
        </div>
      )
    }
    return (
      <img
        src={avatarUrl}
        alt={displayName}
        style={{ ...baseStyle, objectFit: 'cover' }}
        className={className}
      />
    )
  }

  return (
    <div style={{ ...baseStyle, background: bg, color: '#ffffff' }} className={className}>
      {initials}
    </div>
  )
}
