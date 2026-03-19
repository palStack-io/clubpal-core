export default function KpiCard({ value, label }) {
  return (
    <div className="cp-stat-tile" style={{ padding: '16px 18px' }}>
      <div className="cp-stat-tile-value" style={{ fontSize: '30px', letterSpacing: '-1.5px' }}>
        {value}
      </div>
      <div className="cp-stat-tile-label" style={{ fontSize: '10px', marginTop: '6px' }}>
        {label}
      </div>
    </div>
  )
}
