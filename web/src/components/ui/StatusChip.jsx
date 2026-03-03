const VARIANTS = {
  going: {
    background: 'rgba(34,211,160,0.10)',
    color: '#22d3a0',
    border: '1px solid rgba(34,211,160,0.20)',
  },
  'not-going': {
    background: 'rgba(248,113,113,0.08)',
    color: '#f87171',
    border: '1px solid rgba(248,113,113,0.15)',
  },
  maybe: {
    background: 'rgba(245,158,11,0.08)',
    color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.15)',
  },
  'turn-now': {
    background: 'rgba(244,63,94,0.15)',
    color: '#fb7185',
    border: '1px solid rgba(244,63,94,0.22)',
  },
  pending: {
    background: 'rgba(245,158,11,0.10)',
    color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.20)',
  },
  'date-chip': {
    background: 'rgba(244,63,94,0.08)',
    color: '#fb7185',
    border: '1px solid rgba(244,63,94,0.22)',
  },
  'date-warning': {
    background: 'rgba(245,158,11,0.08)',
    color: '#f59e0b',
    border: '1px solid rgba(245,158,11,0.20)',
  },
}

export default function StatusChip({ status, label, size = 'sm' }) {
  const variant = VARIANTS[status] || VARIANTS['date-chip']
  const isSmall = size === 'sm'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: isSmall ? '3px 8px' : '4px 10px',
        borderRadius: '100px',
        fontSize: isSmall ? '10px' : '11px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        ...variant,
      }}
    >
      {label || status}
    </span>
  )
}
