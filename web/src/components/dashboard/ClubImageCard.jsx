import { useNavigate } from 'react-router-dom'

const MONO_GRADIENTS = [
  'linear-gradient(135deg, #f43f5e, #6366f1)',
  'linear-gradient(135deg, #a855f7, #6366f1)',
  'linear-gradient(135deg, #f59e0b, #f43f5e)',
  'linear-gradient(135deg, #14b8a6, #6366f1)',
  'linear-gradient(135deg, #6366f1, #a855f7)',
]

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function gradientFor(name = '') {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return MONO_GRADIENTS[h % MONO_GRADIENTS.length]
}

export default function ClubImageCard({ group }) {
  const navigate = useNavigate()
  const grad = gradientFor(group.name)
  const bg = group.banner_url
    ? { backgroundImage: `url(${group.banner_url})` }
    : { backgroundImage: grad }

  const members = group.member_count || 0
  const meta = [
    `${members} member${members !== 1 ? 's' : ''}`,
    group.activity_type,
  ].filter(Boolean).join(' · ')

  return (
    <div
      className="cp-club-card"
      style={bg}
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/groups/${group.id}`)}
      onKeyDown={e => { if (e.key === 'Enter') navigate(`/groups/${group.id}`) }}
    >
      <div className="cp-club-card-scrim" />
      <div className="cp-club-card-body">
        <div className="cp-club-card-info">
          <div className="cp-club-card-name">{group.activity_emoji ? `${group.activity_emoji} ` : ''}{group.name}</div>
          <div className="cp-club-card-meta">{meta}</div>
        </div>
        <div className="cp-club-monogram" style={{ background: grad }}>
          {initials(group.name)}
        </div>
      </div>
    </div>
  )
}
