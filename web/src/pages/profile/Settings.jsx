import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import AppShell from '../../components/shell/AppShell'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import { FormSection, FormRow, FormGroup, FormInput } from '../../components/ui/Form'
import CreateApiKeyModal from '../../components/modals/CreateApiKeyModal'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { gatewayClient, enrichClient } from '../../api/client'
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import { authApi } from '../../api/auth'
import { enrichApi } from '../../api/enrich'
import { GoogleLogin } from '@react-oauth/google'

const NAV_SECTIONS = [
  { group: 'Account', items: [
    { id: 'profile', icon: '👤', label: 'Profile' },
    { id: 'security', icon: '🔒', label: 'Security' },
    { id: 'notifications', icon: '🔔', label: 'Notifications' },
    { id: 'discover', icon: '🗺️', label: 'Discover' },
  ]},
  { group: 'System', items: [
    { id: 'apikeys', icon: '🔑', label: 'API Keys' },
    { id: 'integrations', icon: '🛡️', label: 'Admin Panel', adminOnly: true },
    { id: 'appearance', icon: '🎨', label: 'Appearance' },
  ]},
  { group: 'App', items: [
    { id: 'about', icon: 'ℹ️', label: 'About' },
  ]},
]

function SettingsNav({ active, onChange, isAdmin }) {
  return (
    <div
      style={{
        background: 'var(--s1)',
        borderRight: '1px solid var(--glass)',
        padding: '16px 8px',
        minHeight: 'calc(100vh - 56px)',
      }}
    >
      {NAV_SECTIONS.map(section => {
        const items = section.items.filter(item => !item.adminOnly || isAdmin)
        if (!items.length) return null
        return (
          <div key={section.group} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'var(--t4)', padding: '0 8px', marginBottom: '4px' }}>
              {section.group}
            </div>
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: active === item.id ? 'rgba(244,63,94,0.15)' : 'transparent',
                  color: active === item.id ? 'var(--rose-soft)' : item.adminOnly ? 'var(--rose-soft)' : 'var(--t2)',
                  fontSize: '13px',
                  fontWeight: active === item.id ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: '2px',
                  transition: 'all 0.12s',
                }}
              >
                <span>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.adminOnly && (
                  <span style={{
                    fontSize: '8px', fontWeight: 800, letterSpacing: '0.5px',
                    textTransform: 'uppercase', color: 'var(--rose)',
                    background: 'var(--rose-glow)', border: '1px solid var(--rose-border)',
                    borderRadius: '4px', padding: '1px 4px',
                  }}>
                    Admin
                  </span>
                )}
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}

const AVATAR_EMOJIS = [
  '😀','😎','🤩','🥳','😄','🤓','🧑‍💻','🧙','🦸','🧝','🧜','🎭',
  '🦊','🐱','🐶','🐻','🦁','🐯','🦋','🦄','🐸','🐼','🐨','🦖',
  '🌟','⚡','🔥','💎','🌈','🎯','👾','🎪','🚀','🌊','🍀','🎸',
]

function EmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'var(--s3)',
          border: '1px solid var(--glass)',
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '12px',
          color: 'var(--t2)',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        {value ? `${value} Change` : 'Pick Emoji'}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              zIndex: 50,
              background: 'var(--s2)',
              border: '1px solid var(--glass)',
              borderRadius: '12px',
              padding: '10px',
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: '4px',
              width: '264px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            {/* Clear option */}
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              title="Use initials"
              style={{
                gridColumn: '1 / -1',
                background: value === null ? 'rgba(244,63,94,0.15)' : 'var(--s3)',
                border: `1px solid ${value === null ? 'rgba(244,63,94,0.22)' : 'transparent'}`,
                borderRadius: '6px',
                padding: '5px',
                fontSize: '11px',
                color: value === null ? 'var(--rose-soft)' : 'var(--t3)',
                cursor: 'pointer',
                fontWeight: 600,
                marginBottom: '4px',
              }}
            >
              Use initials
            </button>
            {AVATAR_EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => { onChange(emoji); setOpen(false) }}
                style={{
                  background: value === emoji ? 'rgba(244,63,94,0.15)' : 'transparent',
                  border: `1px solid ${value === emoji ? 'rgba(244,63,94,0.22)' : 'transparent'}`,
                  borderRadius: '6px',
                  padding: '5px',
                  fontSize: '20px',
                  lineHeight: 1,
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (value !== emoji) e.currentTarget.style.background = 'var(--s4)' }}
                onMouseLeave={e => { if (value !== emoji) e.currentTarget.style.background = 'transparent' }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ProfileSection({ user }) {
  const { updateUser } = useAuth()
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    username: user?.username || '',
    email: user?.email || '',
  })
  const [selectedEmoji, setSelectedEmoji] = useState(
    user?.avatar_url && !user.avatar_url.startsWith('http') && !user.avatar_url.startsWith('/')
      ? user.avatar_url
      : null
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Preview user for Avatar component
  const previewUser = {
    ...user,
    full_name: form.full_name,
    avatar_url: selectedEmoji !== null ? selectedEmoji : (
      user?.avatar_url && (user.avatar_url.startsWith('http') || user.avatar_url.startsWith('/'))
        ? user.avatar_url
        : null
    ),
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = { full_name: form.full_name }
      if (form.username !== user?.username) payload.username = form.username
      if (form.email !== user?.email) payload.email = form.email
      // Send emoji or explicit null to clear
      if (selectedEmoji !== null) {
        payload.avatar_url = selectedEmoji
      } else if (user?.avatar_url && !user.avatar_url.startsWith('http') && !user.avatar_url.startsWith('/')) {
        // Was emoji, now cleared
        payload.avatar_url = null
      }
      const r = await gatewayClient.patch('/users/me', payload)
      updateUser(r.data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      alert(e?.response?.data?.detail || 'Failed to save changes.')
    }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)', marginBottom: '16px' }}>
        Profile Settings
      </div>

      <FormSection title="Personal Info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Avatar user={previewUser} size="xl" />
          <div>
            <div style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '6px' }}>Avatar</div>
            <EmojiPicker value={selectedEmoji} onChange={setSelectedEmoji} />
          </div>
        </div>
        <FormRow>
          <FormGroup label="Full Name">
            <FormInput value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </FormGroup>
          <FormGroup label="Username">
            <FormInput value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          </FormGroup>
        </FormRow>
        <div style={{ marginTop: '12px' }}>
          <FormGroup label="Email">
            <FormInput type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </FormGroup>
        </div>
      </FormSection>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          {saved ? '✓ Saved!' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

function ApiKeysSection() {
  const [keys, setKeys] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    gatewayClient.get('/api-keys')
      .then(r => setKeys(Array.isArray(r.data) ? r.data : r.data?.keys || []))
      .catch(() => setKeys([]))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async (name) => {
    const r = await gatewayClient.post('/api-keys', { name })
    setKeys(prev => [r.data, ...prev])
    return r.data.key || r.data.token || r.data.id
  }

  const handleRevoke = async (keyId) => {
    try {
      await gatewayClient.delete(`/api-keys/${keyId}`)
      setKeys(prev => prev.filter(k => k.id !== keyId))
    } catch {}
  }

  return (
    <div>
      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)', marginBottom: '16px' }}>API Keys</div>

      <FormSection>
        <p style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '14px' }}>
          Create API keys for external integrations like Home Assistant.
        </p>
        <Button variant="primary" onClick={() => setShowCreate(true)} style={{ marginBottom: '14px', width: 'fit-content' }}>
          + Create New Key
        </Button>

        {loading ? (
          <div style={{ color: 'var(--t3)', fontSize: '13px' }}>Loading…</div>
        ) : keys.length === 0 ? (
          <div style={{ color: 'var(--t3)', fontSize: '13px' }}>No API keys yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Status', 'Last Used', 'Actions'].map(h => (
                  <th key={h} style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--t4)', background: 'var(--s4)', borderBottom: '1px solid var(--glass)', padding: '8px 10px', textAlign: 'left' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id}>
                  <td style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t1)', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '11px 10px' }}>{k.name}</td>
                  <td style={{ fontSize: '12px', color: 'var(--t2)', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '11px 10px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: 700, background: 'rgba(34,211,160,0.1)', color: '#22d3a0', border: '1px solid rgba(34,211,160,0.2)' }}>
                      Active
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--t2)', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '11px 10px' }}>
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={{ fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '11px 10px' }}>
                    <button
                      onClick={() => handleRevoke(k.id)}
                      style={{ background: 'none', border: 'none', fontSize: '11px', fontWeight: 600, color: '#f87171', cursor: 'pointer' }}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </FormSection>

      <CreateApiKeyModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const { logout } = useAuth()

  return (
    <div>
      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)', marginBottom: '16px' }}>Appearance</div>

      <FormSection title="Color Scheme">
        <div style={{ display: 'flex', gap: '10px' }}>
          {[
            { value: 'light', label: '☀️ Light' },
            { value: 'dark',  label: '🌙 Dark' },
            { value: 'system', label: '💻 System' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: `1px solid ${theme === opt.value ? 'rgba(244,63,94,0.22)' : 'var(--glass)'}`,
                background: theme === opt.value ? 'rgba(244,63,94,0.15)' : 'var(--s3)',
                color: theme === opt.value ? 'var(--rose-soft)' : 'var(--t2)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FormSection>

      <FormSection title="Session">
        <p style={{ fontSize: '13px', color: 'var(--t2)', marginBottom: '12px' }}>
          Sign out of your account on this device.
        </p>
        <Button variant="danger" onClick={logout}>Sign Out</Button>
      </FormSection>
    </div>
  )
}

const INTEGRATION_FIELDS = [
  {
    group: '🔵 Google',
    description: 'Maps/Places powers discovery features (restaurants, hikes, arts, geocoding, books). Cloud Vision powers receipt OCR for bill splits.',
    fields: [
      { key: 'google_api_key', label: 'Google Maps / Places API Key', placeholder: 'AIza…' },
      { key: 'google_cloud_vision_api_key', label: 'Google Cloud Vision API Key', placeholder: 'AIza…' },
    ],
  },
  {
    group: '🎬 Movies & TV',
    description: 'TMDB powers movie search and discovery. Radarr and Sonarr overlay "In Library" badges on movie and TV show cards.',
    fields: [
      { key: 'tmdb_api_key', label: 'TMDB API Key', placeholder: 'eyJhb…' },
      { key: 'radarr_url', label: 'Radarr URL', placeholder: 'http://192.168.1.10:7878', type: 'text' },
      { key: 'radarr_api_key', label: 'Radarr API Key', placeholder: 'Your Radarr API key' },
      { key: 'sonarr_url', label: 'Sonarr URL', placeholder: 'http://192.168.1.10:8989', type: 'text' },
      { key: 'sonarr_api_key', label: 'Sonarr API Key', placeholder: 'Your Sonarr API key' },
    ],
  },
  {
    group: '🎮 Games',
    description: 'Powers video game search and popular game discovery via Twitch/IGDB.',
    fields: [
      { key: 'igdb_client_id', label: 'IGDB Client ID', placeholder: 'Twitch application client ID' },
      { key: 'igdb_client_secret', label: 'IGDB Client Secret', placeholder: 'Twitch application client secret' },
    ],
  },
]

function StatusBadge({ configured }) {
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: '100px',
      fontSize: '10px',
      fontWeight: 700,
      background: configured ? 'rgba(34,211,160,0.1)' : 'rgba(255,255,255,0.05)',
      color: configured ? '#22d3a0' : 'var(--t3)',
      border: `1px solid ${configured ? 'rgba(34,211,160,0.2)' : 'var(--glass)'}`,
    }}>
      {configured ? '✓ Configured' : 'Not set'}
    </span>
  )
}

function IntegrationsSection({ user }) {
  const [status, setStatus] = useState({})
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [usageOpen, setUsageOpen] = useState(false)
  const [usage, setUsage] = useState([])
  const [usageLoading, setUsageLoading] = useState(false)
  const [limitEdits, setLimitEdits] = useState({})
  const [savingLimits, setSavingLimits] = useState(false)
  const [approvingBlock, setApprovingBlock] = useState(null)

  // Giphy key is stored client-side in localStorage (used by GifPicker)
  const [giphyKey, setGiphyKey] = useState(() => localStorage.getItem('giphy_api_key') || '')
  const [giphySaved, setGiphySaved] = useState(false)

  const handleSaveGiphy = () => {
    const trimmed = giphyKey.trim()
    if (trimmed) {
      localStorage.setItem('giphy_api_key', trimmed)
    } else {
      localStorage.removeItem('giphy_api_key')
    }
    setGiphySaved(true)
    setTimeout(() => setGiphySaved(false), 2500)
  }

  const loadUsage = () => {
    setUsageLoading(true)
    enrichClient.get('/api-usage')
      .then(r => setUsage(r.data?.summary || []))
      .catch(() => setUsage([]))
      .finally(() => setUsageLoading(false))
  }

  const approveBlock = async (apiName) => {
    setApprovingBlock(apiName)
    try {
      await gatewayClient.post(`/admin/api-blocks/${apiName}/approve`)
      loadUsage()
    } catch {}
    finally { setApprovingBlock(null) }
  }

  const saveLimit = async (apiName, value) => {
    const limit = parseInt(value)
    if (!limit || limit < 1) return
    setSavingLimits(true)
    try {
      await enrichClient.put('/api-usage/limits', { limits: { [apiName]: limit } })
      setLimitEdits(e => ({ ...e, [apiName]: undefined }))
      loadUsage()
    } catch {}
    finally { setSavingLimits(false) }
  }

  useEffect(() => { if (usageOpen) loadUsage() }, [usageOpen])

  useEffect(() => {
    if (!user?.is_admin) { setLoading(false); return }
    gatewayClient.get('/admin/integrations')
      .then(r => setStatus(r.data || {}))
      .catch(e => {
        const code = e?.response?.status
        if (code === 502 || code === 503 || code === 504) {
          setError('Backend service unavailable — restart the API gateway and try again.')
        }
      })
      .finally(() => setLoading(false))
  }, [user])

  const handleSave = async () => {
    const payload = {}
    Object.entries(form).forEach(([k, v]) => { if (v.trim()) payload[k] = v.trim() })
    if (!Object.keys(payload).length) return

    setSaving(true)
    setError(null)
    try {
      await gatewayClient.put('/admin/integrations', payload)
      // Refresh status
      const r = await gatewayClient.get('/admin/integrations')
      setStatus(r.data || {})
      setForm({})
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to save — check your permissions.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (key) => {
    try {
      await gatewayClient.delete(`/admin/integrations/${key}`)
      setStatus(prev => ({ ...prev, [key]: { configured: false, source: 'none' } }))
    } catch {}
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)' }}>Admin Panel</div>
        <span style={{
          fontSize: '10px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase',
          color: 'var(--rose)', background: 'var(--rose-glow)', border: '1px solid var(--rose-border)',
          borderRadius: '6px', padding: '2px 8px',
        }}>
          🛡️ Admin
        </span>
        {Object.keys(status).length > 0 && (() => {
          const allKeys = INTEGRATION_FIELDS.flatMap(g => g.fields.map(f => f.key))
          const giphyConfigured = !!localStorage.getItem('giphy_api_key')
          const backendConfigured = allKeys.filter(k => status[k]?.configured).length
          const total = allKeys.length + 1
          const configured = backendConfigured + (giphyConfigured ? 1 : 0)
          const allDone = configured === total
          return (
            <span style={{
              fontSize: '11px', fontWeight: 700,
              color: allDone ? '#22d3a0' : 'var(--t3)',
              background: allDone ? 'rgba(34,211,160,0.1)' : 'var(--s3)',
              border: `1px solid ${allDone ? 'rgba(34,211,160,0.2)' : 'var(--glass)'}`,
              borderRadius: '6px', padding: '2px 8px',
            }}>
              {configured}/{total} configured
            </span>
          )
        })()}
      </div>
      <p style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '16px' }}>
        You're the instance administrator. Configure external API integrations and manage server-wide settings.
      </p>


      {/* Giphy — available to all users, stored in localStorage */}
      <FormSection title="GIF Search (GIPHY)">
        <p style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '14px' }}>
          Add a free GIPHY API key to enable GIF search in comments. Without a key you can still browse curated GIFs or paste a URL.{' '}
          <a href="https://developers.giphy.com/docs/api/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--rose-soft)', textDecoration: 'none' }}>
            Get a free key →
          </a>
        </p>
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t2)' }}>GIPHY API Key</label>
            <StatusBadge configured={!!localStorage.getItem('giphy_api_key')} />
          </div>
          <FormInput
            type="password"
            placeholder={localStorage.getItem('giphy_api_key') ? '••••••••••••••••' : 'Your GIPHY API key…'}
            value={giphyKey}
            onChange={e => setGiphyKey(e.target.value)}
            autoComplete="off"
          />
          {localStorage.getItem('giphy_api_key') && (
            <button
              onClick={() => { localStorage.removeItem('giphy_api_key'); setGiphyKey(''); setGiphySaved(true); setTimeout(() => setGiphySaved(false), 2500) }}
              style={{ background: 'none', border: 'none', fontSize: '11px', fontWeight: 600, color: '#f87171', cursor: 'pointer', marginTop: '6px', padding: 0 }}
            >
              Remove key
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="primary" size="sm" onClick={handleSaveGiphy}>
            {giphySaved ? '✓ Saved!' : 'Save Key'}
          </Button>
        </div>
      </FormSection>

      {/* Admin-only backend keys */}
      {user?.is_admin && (
        <>
          <p style={{ fontSize: '12px', color: 'var(--t3)', margin: '20px 0 14px' }}>
            Admin: configure backend API keys for enrichment features. Keys are stored securely and never exposed in the UI.
            Environment variables always take precedence.
          </p>

          {loading ? (
            <div style={{ color: 'var(--t3)', fontSize: '13px' }}>Loading…</div>
          ) : (
            <>
              {INTEGRATION_FIELDS.map(group => (
            <FormSection key={group.group} title={group.group}>
              <p style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '14px' }}>{group.description}</p>
              {group.fields.map(field => {
                const st = status[field.key] || {}
                return (
                  <div key={field.key} style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t2)' }}>{field.label}</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <StatusBadge configured={st.configured} />
                        {st.configured && st.source === 'db' && (
                          <button
                            onClick={() => handleRemove(field.key)}
                            style={{ background: 'none', border: 'none', fontSize: '11px', fontWeight: 600, color: '#f87171', cursor: 'pointer' }}
                          >
                            Remove
                          </button>
                        )}
                        {st.configured && st.source === 'env' && (
                          <span style={{ fontSize: '10px', color: 'var(--t4)' }}>via env var</span>
                        )}
                      </div>
                    </div>
                    <FormInput
                      type={field.type || 'password'}
                      placeholder={st.configured && field.type !== 'text' ? '••••••••••••••••' : field.placeholder}
                      value={form[field.key] || ''}
                      onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                      autoComplete="off"
                    />
                  </div>
                )
              })}
            </FormSection>
          ))}

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', color: '#f87171', fontSize: '12px', marginBottom: '14px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {saved ? '✓ Saved!' : 'Save Keys'}
            </Button>
          </div>

          {/* API Usage & Quotas */}
          <div style={{ marginTop: '20px', background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '12px', overflow: 'hidden' }}>
            <button
              onClick={() => setUsageOpen(o => !o)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t2)', fontSize: '13px', fontWeight: 600 }}
            >
              <span>📊 API Usage & Daily Limits</span>
              <span style={{ fontSize: '10px', color: 'var(--t4)' }}>{usageOpen ? '▲' : '▼'}</span>
            </button>
            {usageOpen && (
              <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--glass)' }}>
                <p style={{ fontSize: '11px', color: 'var(--t3)', margin: '10px 0 12px' }}>
                  Daily limits stop live API calls once reached — cached results still serve normally.
                  Google's free tier gives ~$200/month credit (Places ≈ $0.017–0.032/req, Geocoding ≈ $0.005/req).
                </p>
                {usageLoading ? (
                  <div style={{ color: 'var(--t3)', fontSize: '12px' }}>Loading…</div>
                ) : usage.length === 0 ? (
                  <div style={{ color: 'var(--t3)', fontSize: '12px' }}>No usage data yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {usage.map(u => {
                      const todayLive = u.today_live || 0
                      const limit = u.daily_limit || 9999999
                      const barPct = limit < 9999999 ? Math.min(100, Math.round((todayLive / limit) * 100)) : 0
                      const exceeded = u.quota_exceeded
                      const blocked = u.blocked
                      const total30 = (u.total_live || 0) + (u.total_cached || 0)
                      const cachePct = total30 > 0 ? Math.round(((u.total_cached || 0) / total30) * 100) : 0
                      const costPerCall = u.api_name === 'google_places' ? 0.02 : u.api_name === 'google_geocoding' ? 0.005 : null
                      const estCost = costPerCall ? (u.total_live || 0) * costPerCall : null
                      const isEditing = limitEdits[u.api_name] !== undefined
                      const barColor = blocked ? '#ef4444' : exceeded ? '#f59e0b' : barPct > 75 ? '#f59e0b' : 'var(--rose)'

                      return (
                        <div key={u.api_name} style={{ background: 'var(--s3)', border: `1px solid ${blocked ? 'rgba(239,68,68,0.5)' : exceeded ? 'rgba(239,68,68,0.3)' : 'var(--glass)'}`, borderRadius: '10px', padding: '12px' }}>
                          {/* Header row */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t1)' }}>
                                {u.api_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              </span>
                              {blocked && <span style={{ fontSize: '10px', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.12)', padding: '1px 6px', borderRadius: '4px' }}>BLOCKED</span>}
                              {!blocked && exceeded && <span style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: '4px' }}>QUOTA HIT</span>}
                            </div>
                            {estCost !== null && (
                              <span style={{ fontSize: '10px', color: 'var(--t4)' }}>~${estCost.toFixed(2)} est. (30d)</span>
                            )}
                          </div>

                          {/* Blocked banner + approve button */}
                          {blocked && (
                            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', marginBottom: '2px' }}>API calls suspended</div>
                                <div style={{ fontSize: '10px', color: 'var(--t3)' }}>
                                  Quota was hit and the API was auto-blocked. Approve to resume — or raise the daily limit first.
                                  {u.blocked_at && <span style={{ display: 'block', marginTop: '2px', color: 'var(--t4)' }}>Blocked {new Date(u.blocked_at).toLocaleString()}</span>}
                                </div>
                              </div>
                              <button
                                onClick={() => approveBlock(u.api_name)}
                                disabled={approvingBlock === u.api_name}
                                style={{ flexShrink: 0, fontSize: '11px', fontWeight: 700, color: '#fff', background: approvingBlock === u.api_name ? 'var(--t4)' : '#22d3a0', border: 'none', borderRadius: '7px', padding: '6px 14px', cursor: approvingBlock === u.api_name ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                              >
                                {approvingBlock === u.api_name ? 'Approving…' : 'Approve & Resume'}
                              </button>
                            </div>
                          )}

                          {/* Progress bar — today's quota */}
                          {limit < 9999999 && (
                            <div style={{ marginBottom: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--t3)', marginBottom: '4px' }}>
                                <span>Today: {todayLive} / {limit} live calls</span>
                                <span style={{ color: barPct > 75 ? barColor : 'var(--t4)' }}>{barPct}%</span>
                              </div>
                              <div style={{ height: '6px', background: 'var(--s1)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${barPct}%`, background: barColor, borderRadius: '3px', transition: 'width 0.3s' }} />
                              </div>
                            </div>
                          )}

                          {/* 30-day stats */}
                          <div style={{ fontSize: '11px', color: 'var(--t3)', marginBottom: '8px' }}>
                            30d: {u.total_live || 0} live · {u.total_cached || 0} cached
                            {total30 > 0 && <span style={{ color: 'var(--t4)' }}> · {cachePct}% from cache</span>}
                          </div>

                          {/* Editable limit */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--t4)' }}>Daily limit:</span>
                            {isEditing ? (
                              <>
                                <input
                                  type="number"
                                  value={limitEdits[u.api_name]}
                                  onChange={e => setLimitEdits(ed => ({ ...ed, [u.api_name]: e.target.value }))}
                                  style={{ width: '70px', background: 'var(--s2)', border: '1px solid var(--rose-border)', borderRadius: '5px', padding: '3px 6px', fontSize: '11px', color: 'var(--t1)', outline: 'none' }}
                                  min="1"
                                  autoFocus
                                  onKeyDown={e => { if (e.key === 'Enter') saveLimit(u.api_name, limitEdits[u.api_name]); if (e.key === 'Escape') setLimitEdits(ed => ({ ...ed, [u.api_name]: undefined })) }}
                                />
                                <button onClick={() => saveLimit(u.api_name, limitEdits[u.api_name])} disabled={savingLimits} style={{ fontSize: '10px', fontWeight: 700, color: '#fff', background: 'var(--rose)', border: 'none', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer' }}>Save</button>
                                <button onClick={() => setLimitEdits(ed => ({ ...ed, [u.api_name]: undefined }))} style={{ fontSize: '10px', color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                              </>
                            ) : (
                              <>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t2)' }}>{limit < 9999999 ? limit.toLocaleString() : '∞'}/day</span>
                                <button
                                  onClick={() => setLimitEdits(ed => ({ ...ed, [u.api_name]: String(limit < 9999999 ? limit : '') }))}
                                  style={{ fontSize: '10px', color: 'var(--rose-soft)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
                                >
                                  Edit
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
        </>
      )}
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: '40px',
        height: '22px',
        borderRadius: '100px',
        border: 'none',
        background: checked ? 'var(--rose)' : 'var(--s4)',
        cursor: 'pointer',
        position: 'relative',
        flexShrink: 0,
        transition: 'background 0.15s',
      }}
    >
      <span style={{
        position: 'absolute',
        top: '3px',
        left: checked ? '21px' : '3px',
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

function NotificationRow({ label, description, checked, onChange }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      padding: '14px 0',
      borderBottom: '1px solid var(--glass)',
    }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '12px', color: 'var(--t3)' }}>{description}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

function NotificationsSection() {
  const [prefs, setPrefs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    gatewayClient.get('/users/me/notification-prefs')
      .then(r => setPrefs(r.data))
      .catch(() => setPrefs({ notify_rotation: true, notify_events: true, notify_reminders: true, notify_invites: true }))
      .finally(() => setLoading(false))
  }, [])

  const toggle = (key) => setPrefs(p => ({ ...p, [key]: !p[key] }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await gatewayClient.put('/users/me/notification-prefs', prefs)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)', marginBottom: '4px' }}>Notifications</div>
      <p style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '20px' }}>
        Choose which emails clubPal sends you. Transactional emails (invites, verification, password reset) are always sent.
      </p>

      {loading ? (
        <div style={{ color: 'var(--t3)', fontSize: '13px' }}>Loading…</div>
      ) : prefs && (
        <>
          <FormSection title="Email Notifications">
            <NotificationRow
              label="Rotation alerts"
              description="Email when it's your turn to pick an activity in a group."
              checked={prefs.notify_rotation}
              onChange={() => toggle('notify_rotation')}
            />
            <NotificationRow
              label="New events"
              description="Email when someone schedules a new event in one of your groups."
              checked={prefs.notify_events}
              onChange={() => toggle('notify_events')}
            />
            <NotificationRow
              label="Event reminders"
              description="Reminder email before an upcoming event you're attending."
              checked={prefs.notify_reminders}
              onChange={() => toggle('notify_reminders')}
            />
            <div style={{ paddingTop: '14px' }}>
              <NotificationRow
                label="Group invitations"
                description="Email when someone invites you to join a group."
                checked={prefs.notify_invites}
                onChange={() => toggle('notify_invites')}
              />
            </div>
          </FormSection>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {saved ? '✓ Saved!' : 'Save Preferences'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function SecuritySection() {
  const { user, updateUser } = useAuth()
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [revokingId, setRevokingId] = useState(null)
  const [linkError, setLinkError] = useState('')
  const [linkSuccess, setLinkSuccess] = useState('')

  const linkedProviders = user?.linked_providers || []

  const handleLinkGoogle = async (credential) => {
    setLinkError('')
    try {
      const updated = await authApi.linkOidc(credential, 'google')
      updateUser(updated)
      setLinkSuccess('Google account linked successfully!')
      setTimeout(() => setLinkSuccess(''), 3000)
    } catch (e) {
      setLinkError(e?.response?.data?.detail || 'Failed to link Google account.')
    }
  }

  const handleUnlink = async (provider) => {
    setLinkError('')
    try {
      await authApi.unlinkOidc(provider)
      updateUser({ linked_providers: linkedProviders.filter(p => p !== provider) })
      setLinkSuccess(`${provider.charAt(0).toUpperCase() + provider.slice(1)} account unlinked.`)
      setTimeout(() => setLinkSuccess(''), 3000)
    } catch (e) {
      setLinkError(e?.response?.data?.detail || 'Failed to unlink account.')
    }
  }

  const loadSessions = () => {
    setSessionsLoading(true)
    gatewayClient.get('/users/me/sessions')
      .then(r => setSessions(Array.isArray(r.data) ? r.data : r.data?.sessions || []))
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false))
  }

  useEffect(() => { loadSessions() }, [])

  const handleChangePassword = async () => {
    setPwError('')
    if (!pwForm.current || !pwForm.next) { setPwError('Please fill all fields.'); return }
    if (pwForm.next !== pwForm.confirm) { setPwError('New passwords do not match.'); return }
    if (pwForm.next.length < 8) { setPwError('New password must be at least 8 characters.'); return }
    setPwSaving(true)
    try {
      await gatewayClient.post('/auth/change-password', {
        current_password: pwForm.current,
        new_password: pwForm.next,
      })
      setPwForm({ current: '', next: '', confirm: '' })
      setPwSaved(true)
      setTimeout(() => setPwSaved(false), 2500)
      updateUser({ password_changed: true })
    } catch (e) {
      setPwError(e?.response?.data?.detail || 'Failed to change password.')
    } finally {
      setPwSaving(false)
    }
  }

  const handleRevoke = async (sessionToken) => {
    setRevokingId(sessionToken)
    try {
      await gatewayClient.delete(`/users/me/sessions/${sessionToken}`)
      setSessions(prev => prev.filter(s => s.session_token !== sessionToken))
    } catch {}
    finally { setRevokingId(null) }
  }

  const inputStyle = {
    background: 'var(--s2)',
    border: '1px solid var(--glass)',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '13px',
    color: 'var(--t1)',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const sectionStyle = {
    background: 'var(--s2)',
    border: '1px solid var(--glass)',
    borderRadius: '14px',
    padding: '16px',
    marginBottom: '16px',
  }

  const currentToken = localStorage.getItem('session_token')

  const deviceIcon = (ua) => {
    if (!ua) return '🖥️'
    const lower = ua.toLowerCase()
    if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone') || lower.includes('ipad')) return '📱'
    return '🖥️'
  }

  return (
    <div>
      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)', marginBottom: '4px' }}>Security</div>
      <p style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '20px' }}>
        Manage your password, linked accounts, and active sessions.
      </p>

      {/* Linked Accounts */}
      <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)', marginBottom: '14px' }}>Linked Accounts</div>
        <p style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '14px', marginTop: '-8px' }}>
          Link a social login so you can sign in without a password.
        </p>

        {linkError && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#f87171', marginBottom: '12px' }}>
            {linkError}
          </div>
        )}
        {linkSuccess && (
          <div style={{ background: 'rgba(34,211,160,0.1)', border: '1px solid rgba(34,211,160,0.2)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#22d3a0', marginBottom: '12px' }}>
            ✓ {linkSuccess}
          </div>
        )}

        {/* Google */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--s3)', borderRadius: '10px', border: '1px solid var(--glass)', marginBottom: '8px' }}>
          <span style={{ fontSize: '20px' }}>🔵</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>Google</div>
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '1px' }}>
              {linkedProviders.includes('google') ? '✓ Linked' : 'Not linked'}
            </div>
          </div>
          {linkedProviders.includes('google') ? (
            <button
              onClick={() => handleUnlink('google')}
              style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.08)', color: '#f87171', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Unlink
            </button>
          ) : (
            <GoogleLogin
              onSuccess={r => handleLinkGoogle(r.credential)}
              onError={() => setLinkError('Google sign-in failed.')}
              text="signin_with"
              shape="pill"
              size="small"
              theme="filled_black"
            />
          )}
        </div>

        {/* Apple — web sign-in not supported; show informational note */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--s3)', borderRadius: '10px', border: '1px solid var(--glass)' }}>
          <span style={{ fontSize: '20px' }}>🍎</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>Apple</div>
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '1px' }}>
              {linkedProviders.includes('apple') ? '✓ Linked' : 'Link from the mobile app'}
            </div>
          </div>
          {linkedProviders.includes('apple') && (
            <button
              onClick={() => handleUnlink('apple')}
              style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.08)', color: '#f87171', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Unlink
            </button>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)', marginBottom: '14px' }}>Change Password</div>
        <form onSubmit={e => { e.preventDefault(); handleChangePassword() }} autoComplete="on">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t3)', display: 'block', marginBottom: '4px' }}>Current Password</label>
              <input
                type="password"
                value={pwForm.current}
                onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                placeholder="••••••••"
                style={inputStyle}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t3)', display: 'block', marginBottom: '4px' }}>New Password</label>
              <input
                type="password"
                value={pwForm.next}
                onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                placeholder="At least 8 characters"
                style={inputStyle}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t3)', display: 'block', marginBottom: '4px' }}>Confirm New Password</label>
              <input
                type="password"
                value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="••••••••"
                style={inputStyle}
                autoComplete="new-password"
              />
            </div>
          </div>
          {pwError && (
            <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', fontSize: '12px', color: '#f87171' }}>
              {pwError}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <Button variant="primary" loading={pwSaving} type="submit">
              {pwSaved ? '✓ Password Changed!' : 'Update Password'}
            </Button>
          </div>
        </form>
      </div>

      {/* Active Sessions */}
      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--t1)', marginBottom: '14px' }}>Active Sessions</div>
        {sessionsLoading ? (
          <div style={{ color: 'var(--t3)', fontSize: '12px' }}>Loading sessions…</div>
        ) : sessions.length === 0 ? (
          <div style={{ color: 'var(--t3)', fontSize: '12px' }}>No sessions found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sessions.map(s => {
              const isCurrent = s.session_token === currentToken
              return (
                <div
                  key={s.session_token}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: isCurrent ? 'rgba(244,63,94,0.06)' : 'var(--s3)',
                    border: `1px solid ${isCurrent ? 'var(--rose-border)' : 'var(--glass)'}`,
                    borderRadius: '10px',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '20px', flexShrink: 0 }}>{deviceIcon(s.user_agent)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t1)' }}>
                          {s.user_agent ? s.user_agent.split(' ')[0] : 'Unknown device'}
                        </span>
                        {isCurrent && (
                          <span style={{ padding: '1px 6px', borderRadius: '100px', fontSize: '9px', fontWeight: 700, background: 'rgba(244,63,94,0.15)', color: 'var(--rose-soft)', border: '1px solid var(--rose-border)' }}>
                            Current
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '2px' }}>
                        {s.ip_address && `${s.ip_address} · `}
                        {s.last_used_at
                          ? `Last active ${new Date(s.last_used_at).toLocaleDateString()}`
                          : `Created ${new Date(s.created_at).toLocaleDateString()}`
                        }
                      </div>
                    </div>
                  </div>
                  {!isCurrent && (
                    <button
                      onClick={() => handleRevoke(s.session_token)}
                      disabled={revokingId === s.session_token}
                      style={{ background: 'none', border: 'none', fontSize: '11px', fontWeight: 600, color: '#f87171', cursor: 'pointer', flexShrink: 0, opacity: revokingId === s.session_token ? 0.5 : 1 }}
                    >
                      {revokingId === s.session_token ? 'Revoking…' : 'Revoke'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const ACTIVITY_OPTIONS = [
  { id: 'dining',  emoji: '🍽️', label: 'Dining' },
  { id: 'movies',  emoji: '🎬', label: 'Movies' },
  { id: 'books',   emoji: '📚', label: 'Books' },
  { id: 'hiking',  emoji: '🥾', label: 'Hiking' },
  { id: 'gaming',  emoji: '🎮', label: 'Gaming' },
  { id: 'arts',    emoji: '🎨', label: 'Arts' },
]
const MOVIE_GENRES_LIST = ['Action', 'Comedy', 'Drama', 'Thriller', 'Horror', 'Sci-Fi', 'Animation', 'Romance']
const BOOK_GENRES_LIST  = ['Fiction', 'Non-Fiction', 'Sci-Fi', 'Mystery', 'Fantasy', 'History', 'Biography']
const RADIUS_STD  = [5, 10, 25, 50]
const RADIUS_HIKE = [10, 25, 50, 100]

function DiscoverSection({ user }) {
  const [prefs, setPrefs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshed, setRefreshed] = useState(false)
  const [error, setError] = useState(null)
  const [geoAddress, setGeoAddress] = useState('')
  const [geoTimeout, setGeoTimeout] = useState(null)

  useEffect(() => {
    authApi.getPreferences()
      .then(p => {
        setPrefs(p)
        setGeoAddress(p.location_address || '')
      })
      .catch(() => setPrefs(null))
      .finally(() => setLoading(false))
  }, [])

  const updatePref = (key, val) => setPrefs(p => ({ ...p, [key]: val }))

  const toggleActivity = (id) => {
    setPrefs(p => ({
      ...p,
      activities: p.activities.includes(id)
        ? p.activities.filter(a => a !== id)
        : [...p.activities, id],
    }))
  }

  const toggleGenre = (field, val) => {
    setPrefs(p => ({
      ...p,
      [field]: p[field].includes(val)
        ? p[field].filter(v => v !== val)
        : [...p[field], val],
    }))
  }

  const handleAddressChange = (val) => {
    setGeoAddress(val)
    clearTimeout(geoTimeout)
    if (val.length > 3) {
      setGeoTimeout(setTimeout(async () => {
        try {
          const result = await enrichApi.geocode(val)
          if (result?.lat) {
            setPrefs(p => ({ ...p, location_lat: result.lat, location_lng: result.lng, location_address: result.formatted_address || val }))
          }
        } catch {}
      }, 600))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const updated = await authApi.updatePreferences({
        ...prefs,
        location_address: geoAddress || prefs.location_address,
      })
      setPrefs(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to save preferences.')
    } finally {
      setSaving(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      await authApi.refreshPreferences()
      setRefreshed(true)
      setTimeout(() => setRefreshed(false), 3000)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Refresh failed.')
    } finally {
      setRefreshing(false)
    }
  }

  const chipStyle = (active) => ({
    padding: '5px 12px',
    borderRadius: '100px',
    border: `1px solid ${active ? 'rgba(244,63,94,0.4)' : 'var(--glass)'}`,
    background: active ? 'rgba(244,63,94,0.15)' : 'var(--s3)',
    color: active ? 'var(--rose-soft)' : 'var(--t2)',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.12s',
  })

  const pillStyle = (active) => ({
    padding: '4px 12px',
    borderRadius: '100px',
    border: `1px solid ${active ? 'rgba(244,63,94,0.4)' : 'var(--glass)'}`,
    background: active ? 'rgba(244,63,94,0.15)' : 'var(--s3)',
    color: active ? 'var(--rose-soft)' : 'var(--t2)',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
  })

  if (loading) return <div style={{ color: 'var(--t3)', fontSize: '13px' }}>Loading…</div>

  return (
    <div>
      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)', marginBottom: '4px' }}>Discover Preferences</div>
      <p style={{ fontSize: '12px', color: 'var(--t3)', marginBottom: '20px' }}>
        Configure your personalized discover feed. Click "Save & Reload" to update your feed with new preferences.
      </p>

      {/* Location */}
      <FormSection title="Location">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <FormInput
            value={geoAddress}
            onChange={e => handleAddressChange(e.target.value)}
            placeholder="City, state or ZIP…"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => {
              if (!navigator.geolocation) return
              navigator.geolocation.getCurrentPosition(async pos => {
                const { latitude: lat, longitude: lng } = pos.coords
                setPrefs(p => ({ ...p, location_lat: lat, location_lng: lng }))
                try {
                  const r = await enrichApi.geocode(`${lat},${lng}`)
                  setGeoAddress(r.formatted_address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`)
                } catch { setGeoAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`) }
              })
            }}
            style={{ background: 'var(--s3)', border: '1px solid var(--glass)', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', fontSize: '16px' }}
            title="Use current location"
          >📍</button>
        </div>
        {prefs?.location_lat && (
          <div style={{ fontSize: '11px', color: 'var(--t3)' }}>
            ✓ {prefs.location_lat?.toFixed(4)}, {prefs.location_lng?.toFixed(4)}
          </div>
        )}
      </FormSection>

      {/* Activities */}
      <FormSection title="Activities">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {ACTIVITY_OPTIONS.map(a => (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleActivity(a.id)}
              style={{
                padding: '12px 8px',
                borderRadius: '10px',
                border: `1px solid ${prefs?.activities?.includes(a.id) ? 'rgba(244,63,94,0.4)' : 'var(--glass)'}`,
                background: prefs?.activities?.includes(a.id) ? 'rgba(244,63,94,0.12)' : 'var(--s2)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '22px' }}>{a.emoji}</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: prefs?.activities?.includes(a.id) ? 'var(--rose-soft)' : 'var(--t2)' }}>
                {a.label}
              </span>
            </button>
          ))}
        </div>
      </FormSection>

      {/* Radius */}
      {prefs?.location_lat && (
        <FormSection title="Radius">
          {prefs?.activities?.includes('dining') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--t3)', width: '70px' }}>Dining</span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {RADIUS_STD.map(r => (
                  <button key={r} type="button" onClick={() => updatePref('radius_dining', r)} style={pillStyle(prefs.radius_dining === r)}>{r}mi</button>
                ))}
              </div>
            </div>
          )}
          {prefs?.activities?.includes('hiking') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--t3)', width: '70px' }}>Hiking</span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {RADIUS_HIKE.map(r => (
                  <button key={r} type="button" onClick={() => updatePref('radius_hiking', r)} style={pillStyle(prefs.radius_hiking === r)}>{r}mi</button>
                ))}
              </div>
            </div>
          )}
          {prefs?.activities?.includes('arts') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--t3)', width: '70px' }}>Arts</span>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {RADIUS_STD.map(r => (
                  <button key={r} type="button" onClick={() => updatePref('radius_arts', r)} style={pillStyle(prefs.radius_arts === r)}>{r}mi</button>
                ))}
              </div>
            </div>
          )}
        </FormSection>
      )}

      {/* Movie Genres */}
      {prefs?.activities?.includes('movies') && (
        <FormSection title="Movie Genres">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {MOVIE_GENRES_LIST.map(g => (
              <button key={g} type="button"
                onClick={() => toggleGenre('movie_genres', g.toLowerCase())}
                style={chipStyle(prefs.movie_genres?.includes(g.toLowerCase()))}
              >{g}</button>
            ))}
          </div>
        </FormSection>
      )}

      {/* Book Genres */}
      {prefs?.activities?.includes('books') && (
        <FormSection title="Book Genres">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {BOOK_GENRES_LIST.map(g => (
              <button key={g} type="button"
                onClick={() => toggleGenre('book_genres', g.toLowerCase())}
                style={chipStyle(prefs.book_genres?.includes(g.toLowerCase()))}
              >{g}</button>
            ))}
          </div>
        </FormSection>
      )}

      {/* Game Types */}
      {prefs?.activities?.includes('gaming') && (
        <FormSection title="Game Types">
          <div style={{ display: 'flex', gap: '6px' }}>
            {[{id:'video_game',label:'Video Games'},{id:'board_game',label:'Board Games'}].map(g => (
              <button key={g.id} type="button"
                onClick={() => toggleGenre('game_types', g.id)}
                style={chipStyle(prefs.game_types?.includes(g.id))}
              >{g.label}</button>
            ))}
          </div>
        </FormSection>
      )}

      {/* Last refreshed */}
      {prefs?.last_loaded_at && (
        <div style={{ fontSize: '11px', color: 'var(--t4)', marginBottom: '16px' }}>
          Last updated: {new Date(prefs.last_loaded_at).toLocaleDateString()}
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', color: '#f87171', fontSize: '12px', marginBottom: '14px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Button
          variant="secondary"
          onClick={handleRefresh}
          loading={refreshing}
          disabled={!prefs?.onboarding_complete}
          title={prefs?.onboarding_complete ? 'Re-fetch all content with current preferences' : 'Complete onboarding first'}
        >
          {refreshed ? '✓ Refreshed!' : '🔄 Refresh Now'}
        </Button>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          {saved ? '✓ Saved!' : 'Save & Reload Feed'}
        </Button>
      </div>
    </div>
  )
}

function AboutSection() {
  return (
    <div style={{ padding: '32px', maxWidth: '600px' }}>
      <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--t1)', marginBottom: '24px' }}>About</div>

      <div style={{
        background: 'var(--s2)',
        border: '1px solid var(--glass)',
        borderRadius: '16px',
        padding: '28px',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <img src="/palStack.png" alt="palStack" style={{ height: '28px', objectFit: 'contain' }} />
          <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.5px' }}>palStack</span>
        </div>

        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--t1)', marginBottom: '12px', lineHeight: 1.5 }}>
          Your digital pal for everyday stuff
        </p>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--t2)', marginBottom: '12px', lineHeight: 1.6 }}>
          Life gets easier when you've got a pal
        </p>
        <p style={{ fontSize: '13px', color: 'var(--t3)', lineHeight: 1.7, marginBottom: '0' }}>
          That's what pals do—they show up and help with the everyday stuff. palStack is a collection of privacy-first tools
          that act like reliable friends: track your pantry to reduce waste, manage home repairs, budget your money, and
          coordinate group dining. Self-host for complete control or use our managed hosting—either way, no tracking,
          no data harvesting, just helpful tools that respect you.
        </p>
      </div>

      <a
        href="https://palstack.io"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 20px',
          background: 'rgba(244,63,94,0.15)',
          border: '1px solid rgba(244,63,94,0.22)',
          borderRadius: '10px',
          color: 'var(--rose-soft)',
          fontSize: '13px',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        <span>Learn more at palStack.io</span>
        <span style={{ fontSize: '12px' }}>→</span>
      </a>

      <div style={{ marginTop: '28px', padding: '16px', background: 'var(--s1)', borderRadius: '10px' }}>
        <div style={{ fontSize: '11px', color: 'var(--t4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>clubPal</div>
        <div style={{ fontSize: '12px', color: 'var(--t3)', lineHeight: 1.6 }}>
          Group outing coordination, rotation tracking, and activity discovery — built for friend groups who want to keep things fair and fun.
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const location = useLocation()
  const [section, setSection] = useState(location.state?.scrollTo || 'profile')

  const renderSection = () => {
    switch (section) {
      case 'profile': return <ProfileSection user={user} key={user?.id} />
      case 'apikeys': return <ApiKeysSection />
      case 'integrations': return <IntegrationsSection user={user} />
      case 'appearance': return <AppearanceSection />
      case 'security': return <SecuritySection />
      case 'notifications': return <NotificationsSection />
      case 'discover': return <DiscoverSection user={user} key={user?.id} />
      case 'about': return <AboutSection />
      default: return <ProfileSection user={user} />
    }
  }

  return (
    <AppShell activeRoute="/settings">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '200px 1fr',
          minHeight: 'calc(100vh - 56px)',
        }}
      >
        <SettingsNav active={section} onChange={setSection} isAdmin={!!user?.is_admin} />
        <div style={{ padding: '22px', background: 'var(--bg)' }}>
          {renderSection()}
        </div>
      </div>
    </AppShell>
  )
}
