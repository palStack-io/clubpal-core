import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { groupsApi } from '../../api/groups'

const ACTIVITY_EMOJI = {
  dining: '🍽️', movies: '🎬', books: '📚', hiking: '🥾',
  gaming: '🎮', arts: '🎨', shows: '📺', default: '✨',
}

export default function JoinGroup() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()

  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [result, setResult] = useState(null) // { joined, requested, error }

  useEffect(() => {
    groupsApi.previewInviteCode(code)
      .then(setPreview)
      .catch(() => setPreview({ valid: false, error: 'We couldn\'t load that invite. Refresh and try again.' }))
      .finally(() => setLoading(false))
  }, [code])

  const handleJoin = async () => {
    if (!isAuthenticated) {
      navigate(`/login?next=/join/${code}`)
      return
    }
    setJoining(true)
    try {
      const res = await groupsApi.joinViaCode(code)
      setResult(res)
    } catch (e) {
      setResult({ error: e.response?.data?.detail || 'We couldn\'t join that group. Give it another go.' })
    } finally {
      setJoining(false)
    }
  }

  const emoji = ACTIVITY_EMOJI[preview?.activity_type?.toLowerCase()] ?? ACTIVITY_EMOJI.default

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'var(--s2)',
        border: '1px solid var(--s4)',
        borderRadius: '20px',
        padding: '32px 28px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Logo / brand */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--rose)', letterSpacing: '1px', textTransform: 'uppercase' }}>
            clubPal
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--t3)' }}>Loading…</div>
        ) : !preview?.valid ? (
          <InvalidState error={preview?.error} onGoHome={() => navigate('/')} />
        ) : result ? (
          <ResultState result={result} groupId={preview.group_id} groupName={preview.group_name} navigate={navigate} />
        ) : (
          <PreviewState
            preview={preview}
            emoji={emoji}
            code={code}
            isAuthenticated={isAuthenticated}
            joining={joining}
            onJoin={handleJoin}
          />
        )}
      </div>
    </div>
  )
}

function InvalidState({ error, onGoHome }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
      <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--t1)', marginBottom: '8px' }}>
        That invite code didn't work. Double-check it with whoever sent it.
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--t3)', marginBottom: '24px' }}>
        {error || 'That invite code didn\'t work. Double-check it with whoever sent it.'}
      </p>
      <button onClick={onGoHome} style={btnStyle('ghost')}>Go to clubPal</button>
    </div>
  )
}

function ResultState({ result, groupId, groupName, navigate }) {
  if (result.error) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
        <p style={{ color: 'var(--t2)', marginBottom: '20px' }}>{result.error}</p>
        <button onClick={() => navigate('/groups')} style={btnStyle('primary')}>My Groups</button>
      </div>
    )
  }
  if (result.joined) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--t1)', marginBottom: '8px' }}>
          You're in!
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--t3)', marginBottom: '24px' }}>
          Welcome to <strong style={{ color: 'var(--t1)' }}>{groupName}</strong>
        </p>
        <button onClick={() => navigate(`/groups/${groupId}`)} style={btnStyle('primary')}>
          Go to Group →
        </button>
      </div>
    )
  }
  if (result.requested) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✋</div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--t1)', marginBottom: '8px' }}>
          Request sent!
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--t3)', marginBottom: '24px' }}>
          The admin of <strong style={{ color: 'var(--t1)' }}>{groupName}</strong> will review your request.
          We'll notify you when it's approved.
        </p>
        <button onClick={() => navigate('/groups')} style={btnStyle('ghost')}>Back to My Groups</button>
      </div>
    )
  }
  return null
}

function PreviewState({ preview, emoji, code, isAuthenticated, joining, onJoin }) {
  const isInstant = preview.join_behavior === 'instant'
  return (
    <>
      {/* Group info */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '20px',
          background: 'linear-gradient(135deg, var(--rose) 0%, #be185d 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '32px', margin: '0 auto 16px',
        }}>
          {emoji}
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--t1)', marginBottom: '6px' }}>
          {preview.group_name}
        </h1>
        {preview.activity_type && (
          <span style={{
            fontSize: '11px', fontWeight: 600, color: 'var(--rose)',
            background: 'rgba(244,63,94,0.12)', borderRadius: '6px',
            padding: '3px 8px', textTransform: 'capitalize',
          }}>
            {preview.activity_type}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: '12px', marginBottom: '24px',
        background: 'var(--s3)', borderRadius: '12px', padding: '14px 16px',
      }}>
        <Stat label="Members" value={preview.member_count} />
        <div style={{ width: 1, background: 'var(--s4)' }} />
        <Stat
          label="Join type"
          value={isInstant ? 'Instant' : 'Approval'}
        />
        <div style={{ width: 1, background: 'var(--s4)' }} />
        <Stat label="Code" value={code} mono />
      </div>

      {/* Behavior hint */}
      <p style={{ fontSize: '13px', color: 'var(--t3)', textAlign: 'center', marginBottom: '20px' }}>
        {isInstant
          ? 'You\'ll join immediately and be added to the rotation queue.'
          : 'Your request will be sent to the group admin for approval.'}
      </p>

      {/* CTA */}
      <button
        onClick={onJoin}
        disabled={joining}
        style={{ ...btnStyle('primary'), width: '100%', opacity: joining ? 0.7 : 1 }}
      >
        {joining ? 'Joining…' : isAuthenticated
          ? `Join ${preview.group_name}`
          : 'Sign in to join'}
      </button>

      {!isAuthenticated && (
        <p style={{ fontSize: '12px', color: 'var(--t3)', textAlign: 'center', marginTop: '12px' }}>
          You'll be redirected to sign in and then returned to this page.
        </p>
      )}
    </>
  )
}

function Stat({ label, value, mono }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{
        fontSize: mono ? '13px' : '18px',
        fontWeight: 700,
        color: 'var(--t1)',
        fontFamily: mono ? 'monospace' : undefined,
        letterSpacing: mono ? '1px' : undefined,
      }}>
        {value}
      </div>
      <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '2px' }}>{label}</div>
    </div>
  )
}

function btnStyle(variant) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '11px 24px', borderRadius: '10px', fontWeight: 700, fontSize: '14px',
    cursor: 'pointer', border: 'none', transition: 'opacity 0.15s',
  }
  if (variant === 'primary') return { ...base, background: 'var(--rose)', color: '#fff' }
  return { ...base, background: 'var(--s3)', color: 'var(--t2)', border: '1px solid var(--s4)' }
}
