import { useState, useEffect } from 'react'
import { billSplitApi } from '../../api/billSplit'
import Card from '../ui/Card'
import Button from '../ui/Button'

const INTEGRATION_LABELS = {
  google_api_key: 'Google API Key (Places/Maps)',
  tmdb_api_key: 'TMDB API Key (Movies/Shows)',
  igdb_client_id: 'IGDB Client ID (Games)',
  igdb_client_secret: 'IGDB Client Secret (Games)',
  radarr_url: 'Radarr URL',
  radarr_api_key: 'Radarr API Key',
  sonarr_url: 'Sonarr URL',
  sonarr_api_key: 'Sonarr API Key',
  google_cloud_vision_api_key: 'Google Cloud Vision API Key (Receipt OCR)',
  giphy_api_key: 'GIPHY API Key (GIF Search)',
}

// URL fields use text input; all others use password
const TEXT_KEYS = new Set(['radarr_url', 'sonarr_url'])

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

  // Editable key state — keyed by integration key name
  const [editValues, setEditValues] = useState({})
  const [showValues, setShowValues] = useState({})
  const [savingKey, setSavingKey] = useState(null)
  const [saveResults, setSaveResults] = useState({})

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

  const handleSaveKey = async (key) => {
    const value = editValues[key] || ''
    if (!value.trim()) return
    setSavingKey(key)
    setSaveResults(prev => ({ ...prev, [key]: null }))
    try {
      await billSplitApi.updateIntegrations({ [key]: value.trim() })
      setSaveResults(prev => ({ ...prev, [key]: 'success' }))
      setEditValues(prev => ({ ...prev, [key]: '' }))
      const data = await billSplitApi.getIntegrations()
      setIntegrations(data)
    } catch {
      setSaveResults(prev => ({ ...prev, [key]: 'error' }))
    } finally {
      setSavingKey(null)
      setTimeout(() => setSaveResults(prev => ({ ...prev, [key]: null })), 3000)
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
              const isText = TEXT_KEYS.has(key)
              const editVal = editValues[key] || ''
              const showVal = showValues[key] || false
              const isSaving = savingKey === key
              const keyResult = saveResults[key] || null

              // Determine status
              let status = 'none'
              if (value?.source === 'db' || value?.configured_in === 'db') status = 'db'
              else if (value?.source === 'env' || value?.configured_in === 'env') status = 'env'
              else if (typeof value === 'string' && value) status = 'db'
              else if (value?.configured) status = value.source === 'env' ? 'env' : 'db'

              return (
                <div key={key} style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--t2)', fontWeight: 500 }}>{label}</span>
                    <StatusBadge status={status} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type={isText || showVal ? 'text' : 'password'}
                        placeholder={status !== 'none' ? '••••••••••••••••' : `Enter ${label.toLowerCase()}…`}
                        value={editVal}
                        style={inputStyle}
                        onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                        onFocus={e => e.target.style.borderColor = 'var(--rose-border)'}
                        onBlur={e => e.target.style.borderColor = 'var(--glass)'}
                      />
                      {!isText && (
                        <button
                          onClick={() => setShowValues(prev => ({ ...prev, [key]: !prev[key] }))}
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
                          {showVal ? 'Hide' : 'Show'}
                        </button>
                      )}
                      <Button
                        variant="primary"
                        size="sm"
                        loading={isSaving}
                        disabled={!editVal.trim()}
                        onClick={() => handleSaveKey(key)}
                      >
                        Save
                      </Button>
                    </div>
                    {keyResult === 'success' && (
                      <span style={{ fontSize: '12px', color: '#22d3a0' }}>Saved successfully.</span>
                    )}
                    {keyResult === 'error' && (
                      <span style={{ fontSize: '12px', color: '#f87171' }}>Failed to save. Please try again.</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
