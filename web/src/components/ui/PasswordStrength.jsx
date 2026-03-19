/**
 * Password strength meter — visual indicator for password quality
 */
const LEVELS = [
  { label: 'Weak', color: 'var(--error)', min: 0 },
  { label: 'Fair', color: 'var(--warning)', min: 1 },
  { label: 'Good', color: 'var(--amber)', min: 2 },
  { label: 'Strong', color: 'var(--success)', min: 3 },
]

function getStrength(password) {
  if (!password) return -1
  let score = 0
  if (password.length >= 8) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  return Math.min(score, 3)
}

export default function PasswordStrength({ password }) {
  const score = getStrength(password)
  if (score < 0) return null

  const level = LEVELS[score]

  return (
    <div style={{ marginTop: '6px' }}>
      <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
        {LEVELS.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: '3px',
              borderRadius: '2px',
              background: i <= score ? level.color : 'var(--glass)',
              transition: 'background 0.2s ease',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 'var(--text-xs)', color: level.color, fontWeight: 600 }}>
        {level.label}
      </span>
    </div>
  )
}
