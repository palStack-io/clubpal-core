import { useState, useEffect } from 'react'
import { billSplitApi } from '../../api/billSplit'
import Card from '../ui/Card'

function StatCell({ label, value }) {
  return (
    <div
      style={{
        background: 'var(--s2)',
        borderRadius: '12px',
        padding: '14px',
        border: '1px solid var(--glass)',
      }}
    >
      <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--t1)', letterSpacing: '-0.5px', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: '5px' }}>
        {label}
      </div>
    </div>
  )
}

function SkeletonCell() {
  return (
    <div
      style={{
        background: 'var(--s2)',
        borderRadius: '12px',
        padding: '14px',
        border: '1px solid var(--glass)',
      }}
    >
      <div
        style={{
          height: '22px',
          width: '60px',
          background: 'var(--s4)',
          borderRadius: '6px',
          marginBottom: '8px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
      <div
        style={{
          height: '11px',
          width: '80px',
          background: 'var(--s4)',
          borderRadius: '4px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
    </div>
  )
}

export default function AdminOCRStatsCard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null) // null | 'no-key' | 'no-stats' | 'forbidden' | 'error'

  useEffect(() => {
    billSplitApi.getOCRStats()
      .then(data => {
        setStats(data)
        setLoading(false)
      })
      .catch(e => {
        setLoading(false)
        const code = e.response?.status
        if (code === 403) setStatus('forbidden')
        else if (code === 404) setStatus('no-stats')
        else setStatus('error')
      })
  }, [])

  const noKeyWarning = stats && !stats.key_configured

  const statItems = stats ? [
    { label: 'Calls Today', value: stats.calls_today ?? '—' },
    { label: 'Calls This Month', value: stats.calls_this_month ?? '—' },
    { label: 'Success Rate', value: stats.success_rate_pct != null ? `${Math.round(stats.success_rate_pct)}%` : '—' },
    { label: 'Avg Items Extracted', value: stats.avg_items_extracted != null ? Number(stats.avg_items_extracted).toFixed(1) : '—' },
    { label: 'High Confidence %', value: stats.high_confidence_pct != null ? `${Math.round(stats.high_confidence_pct)}%` : '—' },
    { label: 'Est. Cost This Month', value: stats.estimated_cost_usd != null ? `$${Number(stats.estimated_cost_usd).toFixed(2)}` : '—' },
  ] : []

  return (
    <Card>
      <Card.Header title="Receipt OCR Stats" />
      <Card.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* No-key warning */}
          {noKeyWarning && (
            <div
              style={{
                borderRadius: '12px',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.15)',
                padding: '12px 14px',
                fontSize: '13px',
                color: '#f59e0b',
              }}
            >
              No Google Cloud Vision API key configured — receipt scanning is disabled. Add a key in the Integrations section above.
            </div>
          )}

          {/* Status messages */}
          {status === 'forbidden' && (
            <p style={{ fontSize: '13px', color: 'var(--t3)', margin: 0 }}>
              You don't have permission to view OCR stats.
            </p>
          )}
          {status === 'no-stats' && (
            <p style={{ fontSize: '13px', color: 'var(--t3)', margin: 0 }}>
              No OCR stats yet. Stats appear after the first receipt scan.
            </p>
          )}
          {status === 'error' && (
            <p style={{ fontSize: '13px', color: '#f87171', margin: 0 }}>
              Failed to load stats.
            </p>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCell key={i} />)}
            </div>
          )}

          {/* Stats grid */}
          {!loading && stats && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {statItems.map(s => <StatCell key={s.label} label={s.label} value={s.value} />)}
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  )
}
