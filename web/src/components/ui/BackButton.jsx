import { useNavigate } from 'react-router-dom'

export default function BackButton({ onClick, to, label = 'Back' }) {
  const navigate = useNavigate()
  const handleClick = onClick ?? (to ? () => navigate(to) : () => navigate(-1))

  return (
    <button
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '4px 12px',
        borderRadius: '100px',
        border: '1px solid var(--rose-border)',
        background: 'rgba(244,63,94,0.08)',
        color: 'var(--rose-soft)',
        fontSize: '11px',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'background 0.12s',
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.16)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.08)' }}
    >
      ← {label}
    </button>
  )
}
