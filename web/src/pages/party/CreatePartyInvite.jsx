import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { eventsClient } from '../../api/client'
import { groupsApi } from '../../api/groups'
import { useAuth } from '../../contexts/AuthContext'
import AppShell from '../../components/shell/AppShell'
import ThemePicker from '../../components/party/ThemePicker'
import BringListBuilder from '../../components/party/BringListBuilder'

const STEPS = ['Details', 'Theme', 'Bring List', 'Publish']

export default function CreatePartyInvite() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const [step, setStep]                     = useState(0)
  const [groups, setGroups]                 = useState([])
  const [selectedGroups, setSelectedGroups] = useState([])
  const [form, setForm]                     = useState({
    title: '', scheduled_date: '', location: '', description: '',
    activity_type: 'other', bring_list_enabled: false, bring_list_type: 'freeform', items: [],
  })
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [createdToken, setCreatedToken] = useState(null)

  useEffect(() => {
    if (user?.id) groupsApi.getUserGroups(user.id).then(setGroups).catch(() => {})
  }, [user?.id])

  function setField(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function toggleGroup(id) {
    setSelectedGroups(g => g.includes(id) ? g.filter(x => x !== id) : [...g, id])
  }

  function nextStep() {
    if (step === 0 && !form.title.trim()) { setError('Event title is required'); return }
    setError('')
    setStep(s => s + 1)
  }

  async function publish() {
    setLoading(true)
    setError('')
    try {
      const eventRes = await eventsClient.post('/events', {
        title: form.title,
        scheduled_date: form.scheduled_date || null,
        location: form.location || null,
        description: form.description || null,
        group_id: selectedGroups[0] || null,
        activity_type: form.activity_type,
        bill_split_enabled: false,
        created_by: user.id,
      })
      const inviteRes = await eventsClient.post('/party-invites', {
        event_id: eventRes.data.id,
        group_ids: selectedGroups,
        theme_activity_type: form.activity_type,
        bring_list_enabled: form.bring_list_enabled,
        bring_list_type: form.bring_list_type,
        items: form.items,
      })
      setCreatedToken(inviteRes.data.token)
      setStep(STEPS.length)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to create invite')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    padding: '12px 14px', borderRadius: 10,
    border: '1px solid var(--s3)', background: 'var(--s2)',
    color: 'var(--t1)', fontSize: '1rem', width: '100%', boxSizing: 'border-box',
  }
  const labelStyle = { color: 'var(--t2)', fontSize: '0.8rem', marginBottom: 4, display: 'block' }

  const isDone = step >= STEPS.length

  return (
    <AppShell>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: 'var(--t1)', margin: '0 0 4px', fontSize: '1.4rem', fontWeight: 700 }}>
            {isDone ? '🎉 Invite live!' : 'New Party Invite ✨'}
          </h1>
          {!isDone && (
            <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: i <= step ? 'var(--rose)' : 'var(--s3)',
                  transition: 'background 0.2s',
                }} />
              ))}
            </div>
          )}
        </div>

        {/* Step 0: Details */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Event name *</label>
              <input
                placeholder="Summer BBQ, Game Night…"
                value={form.title}
                onChange={e => setField('title', e.target.value)}
                style={inputStyle}
                autoFocus
              />
            </div>
            <div>
              <label style={labelStyle}>Date & time</label>
              <input
                type="datetime-local"
                value={form.scheduled_date}
                onChange={e => setField('scheduled_date', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input
                placeholder="Address or venue name"
                value={form.location}
                onChange={e => setField('location', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                placeholder="What's the vibe? (optional)"
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }}
              />
            </div>

            {/* Optional group selector inline */}
            {groups.length > 0 && (
              <div>
                <label style={labelStyle}>Share with clubs (optional)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {groups.map(g => (
                    <div
                      key={g.id}
                      onClick={() => toggleGroup(g.id)}
                      style={{
                        padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                        border: `1.5px solid ${selectedGroups.includes(g.id) ? 'var(--rose)' : 'var(--s3)'}`,
                        background: selectedGroups.includes(g.id) ? 'rgba(244,63,94,0.08)' : 'var(--s2)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ color: 'var(--t1)', fontWeight: 500 }}>{g.name}</span>
                      {selectedGroups.includes(g.id) && (
                        <span style={{ color: 'var(--rose)', fontSize: '0.9rem' }}>✓</span>
                      )}
                    </div>
                  ))}
                </div>
                <p style={{ color: 'var(--t3)', fontSize: '0.78rem', marginTop: 6 }}>
                  Club members will be notified and auto-added as pending attendees.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Theme */}
        {step === 1 && (
          <ThemePicker value={form.activity_type} onChange={v => setField('activity_type', v)} />
        )}

        {/* Step 2: Bring list */}
        {step === 2 && (
          <BringListBuilder
            enabled={form.bring_list_enabled && form.activity_type !== 'dining'}
            onToggle={() => setField('bring_list_enabled', !form.bring_list_enabled)}
            items={form.items}
            onItemsChange={v => setField('items', v)}
          />
        )}

        {/* Done */}
        {isDone && createdToken && (
          <div>
            <div style={{
              background: 'var(--s2)', borderRadius: 14, padding: '16px 18px',
              border: '1px solid var(--s3)', marginBottom: 16,
            }}>
              <p style={{ color: 'var(--t3)', fontSize: '0.78rem', margin: '0 0 6px' }}>Share link</p>
              <p style={{ color: 'var(--t1)', fontSize: '0.92rem', margin: 0, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {window.location.origin}/p/{createdToken}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/p/${createdToken}`)}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: 'var(--rose)', color: '#fff', cursor: 'pointer', fontWeight: 700, minWidth: 120 }}
              >
                Copy Link
              </button>
              <button
                onClick={() => navigate(`/party-invites/${createdToken}/manage`)}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--s3)', background: 'var(--s2)', color: 'var(--t1)', cursor: 'pointer', minWidth: 120 }}
              >
                Manage
              </button>
            </div>
            <button
              onClick={() => window.open(`/p/${createdToken}`, '_blank')}
              style={{ width: '100%', marginTop: 10, padding: '10px', borderRadius: 10, border: '1px solid var(--s3)', background: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: '0.88rem' }}
            >
              Preview invite page →
            </button>
          </div>
        )}

        {/* Navigation */}
        {!isDone && (
          <div style={{ marginTop: 28 }}>
            {error && <p style={{ color: 'var(--rose)', fontSize: '0.85rem', marginBottom: 10 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              {step > 0 && (
                <button
                  onClick={() => { setError(''); setStep(s => s - 1) }}
                  style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid var(--s3)', background: 'var(--s2)', color: 'var(--t1)', cursor: 'pointer' }}
                >
                  Back
                </button>
              )}
              {step < STEPS.length - 1 && (
                <button
                  onClick={nextStep}
                  style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: 'var(--rose)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                >
                  Next
                </button>
              )}
              {step === STEPS.length - 1 && (
                <button
                  onClick={publish}
                  disabled={loading}
                  style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: 'var(--rose)', color: '#fff', cursor: 'pointer', fontWeight: 700, opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Creating…' : 'Publish ✨'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
