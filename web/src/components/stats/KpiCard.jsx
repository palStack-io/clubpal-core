export default function KpiCard({ value, label }) {
  return (
    <div
      style={{
        background: 'var(--s2)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '14px',
        padding: '16px 18px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ fontSize: '30px', fontWeight: 900, color: 'var(--t1)', letterSpacing: '-1.5px', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '6px' }}>
        {label}
      </div>
    </div>
  )
}
