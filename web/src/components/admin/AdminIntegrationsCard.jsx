import { useState, useEffect } from 'react'
import { billSplitApi } from '../../api/billSplit'
import Card from '../ui/Card'
import Button from '../ui/Button'

const INTEGRATION_LABELS = {
  google_api_key: 'Google API Key (Places/Maps)',
  tmdb_api_key: 'TMDB API Key (Movies/Shows)',
  igdb_client_id: 'IGDB Client ID (Games)',
  igdb_client_secret: 'IGDB Client Secret (Games)',
  google_cloud_vision_api_key: 'Google Cloud Vision API Key (Receipt OCR)',
}

function StatusBadge({ status }) {
  const styles = {
    db: {
      background: 'rgba(34,211,160,0.10)',
      color: '#22d3a0',
      border: '1px solid rgba(34,211,160,0.20)',
      label: 'Configured (DB)',
    },
    env: {
      background: 'rgba(245,158,11,0.10)',
      color: '#f59e0b',
      border: '1px solid rgba(245,158,11,0.20)',
      label: 'Configured (env)',
    },
    none: {
      background: 'rgba(255,255,255,0.04)',
      color: 'var(--t3)',
      border: '1px solid var(--glass)',
      label: 'Not set',
    },
  }
  const s = styles[status] || styles.none
  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 700,
        borderRadius: '100px',
        padding: '3px 8px',
        whiteSpace: 'nowrap',
        ...s,
      }}
    >
      {s.label}
    </span>
  )
}

export default function AdminIntegrationsCard() {
  const [integrations, setIntegrations] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Vision key edit state
  const [visionKey, setVisionKey] = useState('')
  const [showVisionKey, setShowVisionKey] = useState(false)
  const [savingVision, setSavingVision] = useState(false)
  const [saveResult, setSaveResult] = useState(null) // 'success' | 'error'

  useEffect(() => {
    billSplitApi.getIntegrations()
      .then(data => {
        setIntegrations(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load integrations.')
        setLoading(false)
      })
  }, [])

  const handleSaveVisionKey = async () => {
    if (!visionKey.trim()) return
    setSavingVision(true)
    setSaveResult(null)
    try {
      await billSplitApi.updateIntegrations({ google_cloud_vision_api_key: visionKey.trim() })
      setSaveResult('success')
      setVisionKey('')
      // Refresh
      const data = await billSplitApi.getIntegrations()
      setIntegrations(data)
    } catch {
      setSaveResult('error')
    } finally {
      setSavingVision(false)
      setTimeout(() => setSaveResult(null), 3000)
    }
  }

  const inputStyle = {
    background: 'var(--s3)',
    border: '1px solid var(--glass)',
    borderRadius: '8px',
    padding: '6px 10px',
    fontSize: '13px',
    color: 'var(--t1)',
    outline: 'none',
    flex: 1,
    minWidth: 0,
  }

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid var(--glass)',
    gap: '12px',
  }

  return (
    <Card>
      <Card.Header title="Integrations" />
      <Card.Body>
        {loading && (
          <div style={{ color: 'var(--t3)', fontSize: '13px', padding: '8px 0' }}>Loading...</div>
        )}
        {error && (
          <div style={{ color: '#f87171', fontSize: '13px', padding: '8px 0' }}>{error}</div>
        )}
        {integrations && (
          <div>
            {Object.entries(integrations).map(([key, value]) => {
              const label = INTEGRATION_LABELS[key] || key
              const isVisionKey = key === 'google_cloud_vision_api_key'

              // Determine status
              let status = 'none'
              if (value?.source === 'db' || value?.configured_in === 'db') status = 'db'
              else if (value?.source === 'env' || value?.configured_in === 'env') status = 'env'
              else if (typeof value === 'string' && value) status = 'db'
              else if (value?.configured) status = value.source === 'env' ? 'env' : 'db'

              return (
                <div key={key} style={isVisionKey ? { ...rowStyle, flexDirection: 'column', alignItems: 'stretch' } : rowStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--t2)', fontWeight: 500 }}>{label}</span>
                    <StatusBadge status={status} />
                  </div>

                  {isVisionKey && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type={showVisionKey ? 'text' : 'password'}
                          placeholder="Enter new API key"
                          value={visionKey}
                          style={inputStyle}
                          onChange={e => setVisionKey(e.target.value)}
                          onFocus={e => e.target.style.borderColor = 'var(--rose-border)'}
                          onBlur={e => e.target.style.borderColor = 'var(--glass)'}
                        />
                        <button
                          onClick={() => setShowVisionKey(v => !v)}
                          style={{
                            background: 'var(--s3)',
                            border: '1px solid var(--glass)',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '12px',
                            color: 'var(--t2)',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          {showVisionKey ? 'Hide' : 'Show'}
                        </button>
                        <Button
                          variant="primary"
                          size="sm"
                          loading={savingVision}
                          disabled={!visionKey.trim()}
                          onClick={handleSaveVisionKey}
                        >
                          Save
                        </Button>
                      </div>
                      {saveResult === 'success' && (
                        <span style={{ fontSize: '12px', color: '#22d3a0' }}>Key saved successfully.</span>
                      )}
                      {saveResult === 'error' && (
                        <span style={{ fontSize: '12px', color: '#f87171' }}>Failed to save. Please try again.</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
