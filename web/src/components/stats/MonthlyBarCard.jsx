import Card from '../ui/Card'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function MonthlyBarCard({ monthly = [] }) {
  // monthly: [{ month: 1, count: N }, ...] (1-indexed)
  const data = MONTHS.map((label, i) => {
    const found = monthly.find(m => m.month === i + 1)
    return { label, count: found?.count || 0 }
  })
  const max = Math.max(...data.map(d => d.count), 1)

  return (
    <Card>
      <Card.Header title="Monthly Activity" />
      <Card.Body>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '8px',
            height: '90px',
          }}
        >
          {data.map((d, i) => {
            const h = Math.max(4, (d.count / max) * 70)
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                <div
                  title={`${d.label}: ${d.count}`}
                  style={{
                    width: '100%',
                    height: `${h}px`,
                    borderRadius: '4px 4px 0 0',
                    background: d.count > 0
                      ? 'linear-gradient(to top, var(--rose), var(--rose-soft))'
                      : 'var(--s4)',
                    opacity: d.count > 0 ? 0.85 : 0.3,
                    transition: 'height 0.3s ease',
                  }}
                />
                <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--t4)' }}>{d.label}</span>
              </div>
            )
          })}
        </div>
      </Card.Body>
    </Card>
  )
}
