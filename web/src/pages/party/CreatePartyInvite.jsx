import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { groupsClient, eventsClient } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import AppShell from '../../components/shell/AppShell'
import ThemePicker from '../../components/party/ThemePicker'
import BringListBuilder from '../../components/party/BringListBuilder'

const STEPS = ['Details', 'Groups', 'Theme', 'Bring List', 'Publish']

export default function CreatePartyInvite() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const [step, setStep]                   = useState(0)
  const [groups, setGroups]               = useState([])
  const [selectedGroups, setSelectedGroups] = useState([])
  const [form, setForm]                   = useState({
    title: '', scheduled_date: '', location: '', activity_type: 'other',
    bring_list_enabled: false, bring_list_type: 'freeform', items: [],
  })
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [createdToken, setCreatedToken] = useState(null)

  useEffect(() => {
    groupsClient.get('/groups').then(r => setGroups(r.data)).catch(() => {})
  }, [])

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function toggleGroup(id) {
    setSelectedGroups(g => g.includes(id) ? g.filter(x => x !== id) : [...g, id])
  }

  function nextStep() {
    if (step === 0 && !form.title.trim()) { setError('Event title is required'); return }
    if (step === 1 && selectedGroups.length === 0) { setError('Select at least one club'); return }
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
        group_id: selectedGroups[0],
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
      setStep(4)
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

  return (
    <AppShell>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>
        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i <= step ? 'var(--rose)' : 'var(--s3)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        <h1 style={{ color: 'var(--t1)', margin: '0 0 4px', fontSize: '1.5rem' }}>Party Invite ✨</h1>
        <p style={{ color: 'var(--t2)', marginBottom: 24, marginTop: 0 }}>{STEPS[step]}</p>

        {/* Step 0: Details */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              placeholder="Event title *"
              value={form.title}
              onChange={e => setField('title', e.target.value)}
              style={inputStyle}
              autoFocus
            />
            <input
              type="datetime-local"
              value={form.scheduled_date}
              onChange={e => setField('scheduled_date', e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="Location (optional)"
              value={form.location}
              onChange={e => setField('location', e.target.value)}
              style={inputStyle}
            />
          </div>
        )}

        {/* Step 1: Groups */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groups.length === 0 && <p style={{ color: 'var(--t2)' }}>No clubs found. Create a club first.</p>}
            {groups.map(g => (
              <div
                key={g.id}
                onClick={() => toggleGroup(g.id)}
                style={{
                  padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                  border: `2px solid ${selectedGroups.includes(g.id) ? 'var(--rose)' : 'var(--s3)'}`,
                  background: selectedGroups.includes(g.id) ? 'rgba(244,63,94,0.08)' : 'var(--s2)',
                  color: 'var(--t1)', transition: 'all 0.15s',
                }}
              >
                <span style={{ fontWeight: 600 }}>{g.name}</span>
                {selectedGroups.includes(g.id) && <span style={{ float: 'right', color: 'var(--rose)' }}>✓</span>}
              </div>
            ))}
          </div>
        )}

        {/* Step 2: Theme */}
        {step === 2 && (
          <ThemePicker value={form.activity_type} onChange={v => setField('activity_type', v)} />
        )}

        {/* Step 3: Bring list */}
        {step === 3 && (
          <BringListBuilder
            enabled={form.bring_list_enabled && form.activity_type !== 'dining'}
            onToggle={() => setField('bring_list_enabled', !form.bring_list_enabled)}
            items={form.items}
            onItemsChange={v => setField('items', v)}
          />
        )}

        {/* Step 4: Published */}
        {step === 4 && createdToken && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>🎉</div>
            <p style={{ color: 'var(--t1)', fontWeight: 700, fontSize: '1.2rem', marginBottom: 8 }}>Your invite is live!</p>
            <div style={{ background: 'var(--s2)', borderRadius: 10, padding: '12px 16px', margin: '16px 0', color: 'var(--t2)', fontSize: '0.88rem', wordBreak: 'break-all', border: '1px solid var(--s3)' }}>
              {window.location.origin}/p/{createdToken}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/p/${createdToken}`)}
                style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--rose)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >
                Copy Link
              </button>
              <button
                onClick={() => window.open(`/p/${createdToken}`, '_blank')}
                style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--s3)', background: 'var(--s2)', color: 'var(--t1)', cursor: 'pointer' }}
              >
                Preview
              </button>
              <button
                onClick={() => navigate(`/party-invites/${createdToken}/manage`)}
                style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid var(--s3)', background: 'var(--s2)', color: 'var(--t1)', cursor: 'pointer' }}
              >
                Manage
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        {step < 4 && (
          <div style={{ marginTop: 28 }}>
            {error && <p style={{ color: 'var(--rose)', fontSize: '0.85rem', marginBottom: 10 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              {step > 0 && (
                <button
                  onClick={() => { setError(''); setStep(s => s - 1) }}
                  style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--s3)', background: 'var(--s2)', color: 'var(--t1)', cursor: 'pointer' }}
                >
                  Back
                </button>
              )}
              {step < 3 && (
                <button
                  onClick={nextStep}
                  style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: 'var(--rose)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                >
                  Next
                </button>
              )}
              {step === 3 && (
                <button
                  onClick={publish}
                  disabled={loading}
                  style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: 'var(--rose)', color: '#fff', cursor: 'pointer', fontWeight: 700, opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Creating…' : 'Publish Invite ✨'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
