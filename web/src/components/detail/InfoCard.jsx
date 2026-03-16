/** Single info card: label + value, optional link. */
export default function InfoCard({ label, value, href, children }) {
  if (!value && !children) return null

  return (
    <div
      style={{
        background: 'var(--s2)',
        border: '1px solid var(--glass)',
        borderRadius: '14px',
        padding: '13px 15px',
      }}
    >
      <div
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--t3)',
          textTransform: 'uppercase',
          letterSpacing: '0.7px',
          marginBottom: '5px',
        }}
      >
        {label}
      </div>
      {children ?? (
        href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--blue)',
              textDecoration: 'none',
              wordBreak: 'break-word',
            }}
          >
            {value}
          </a>
        ) : (
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--t1)',
              wordBreak: 'break-word',
              lineHeight: 1.4,
            }}
          >
            {value}
          </div>
        )
      )}
    </div>
  )
}
