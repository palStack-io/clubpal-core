import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Avatar from './Avatar'
import { ratingsClient } from '../../api/client'

function vibeLabel(avg) {
  if (avg >= 9) return { label: '🔥 Tough critic', color: 'var(--rose)' }
  if (avg >= 7) return { label: '👍 High standards', color: 'var(--green)' }
  if (avg >= 5) return { label: '⚖️ Balanced', color: 'var(--blue)' }
  return { label: '😌 Easy going', color: 'var(--amber)' }
}

export default function UserStatsModal({ member, canManage, onRoleChange, onRemove, onClose, isAdmin, isCurrent, rotationEnabled, onSkipTurn, onSetTurn, rotationActionLoading }) {
  const [stats, setStats] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    ratingsClient.get(`/users/${member.user_id}/stats`)
      .then(r => setStats(r.data))
      .catch(() => {})
  }, [member.user_id])

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const avg = stats?.average_score ?? stats?.avg_score ?? null
  const total = stats?.total_ratings ?? stats?.ratings_count ?? 0
  const hosted = stats?.total_hosted_events ?? 0
  const vibe = avg != null && total > 0 ? vibeLabel(avg) : null
  const roleBadge = member.role === 'owner' ? { text: 'Owner', color: 'var(--rose)' }
    : member.role === 'admin' ? { text: 'Admin', color: 'var(--amber)' }
    : null

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onMouseDown={onClose}
    >
      <div
        ref={ref}
        onMouseDown={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '400px',
          background: 'var(--s2)', border: '1px solid var(--glass)',
          borderRadius: '20px', padding: '24px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
          <div style={{ borderRadius: '50%', border: '2.5px solid var(--rose-border)', padding: '3px', flexShrink: 0 }}>
            <Avatar user={member} size="lg" style={{ width: '52px', height: '52px' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {member.full_name || member.username || 'Member'}
            </div>
            {member.username && member.full_name && (
              <div style={{ fontSize: '12px', color: 'var(--t3)', marginTop: '2px' }}>@{member.username}</div>
            )}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
              {roleBadge && (
                <span style={{ fontSize: '10px', fontWeight: 700, color: roleBadge.color, background: `color-mix(in srgb, ${roleBadge.color} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${roleBadge.color} 35%, transparent)`, borderRadius: '99px', padding: '2px 8px' }}>
                  {roleBadge.text}
                </span>
              )}
              {rotationEnabled && isCurrent && (
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--rose-soft)', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '99px', padding: '2px 8px' }}>
                  Their turn
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%', background: 'var(--s4)', border: '1px solid var(--glass)', color: 'var(--t3)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}
          >×</button>
        </div>

        {/* Stats tiles */}
        {!stats ? (
          <div style={{ fontSize: '12px', color: 'var(--t4)', textAlign: 'center', padding: '12px 0' }}>Loading…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: '10px', marginBottom: canManage ? '16px' : '0' }}>
            <div style={{ background: 'var(--s3)', borderRadius: '14px', padding: '14px', textAlign: 'center', border: '1px solid var(--glass)' }}>
              <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--t1)', letterSpacing: '-0.5px' }}>
                {avg != null ? Number(avg).toFixed(1) : '—'}
              </div>
              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '4px' }}>Avg ★</div>
            </div>
            <div style={{ background: 'var(--s3)', borderRadius: '14px', padding: '14px', textAlign: 'center', border: '1px solid var(--glass)' }}>
              <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--t1)', letterSpacing: '-0.5px' }}>{total}</div>
              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '4px' }}>Rated</div>
            </div>
            <div style={{ background: 'var(--s3)', borderRadius: '14px', padding: '14px', textAlign: 'center', border: '1px solid var(--glass)' }}>
              <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--t1)', letterSpacing: '-0.5px' }}>{hosted}</div>
              <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '4px' }}>Picks</div>
            </div>
            <div style={{ background: 'var(--s3)', borderRadius: '14px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--glass)' }}>
              {vibe ? (
                <span style={{ fontSize: '11px', fontWeight: 800, color: vibe.color, textAlign: 'center', lineHeight: 1.3 }}>{vibe.label}</span>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--t4)', textAlign: 'center' }}>No ratings yet</span>
              )}
            </div>
          </div>
        )}

        {/* Admin actions */}
        {(canManage || (isAdmin && rotationEnabled)) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Rotation controls — shown to admins when rotation is active */}
            {isAdmin && rotationEnabled && (
              isCurrent ? (
                <button
                  onClick={onSkipTurn}
                  disabled={rotationActionLoading}
                  style={{ width: '100%', padding: '11px', borderRadius: '12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--amber)', fontWeight: 700, fontSize: '13px', cursor: rotationActionLoading ? 'not-allowed' : 'pointer', opacity: rotationActionLoading ? 0.6 : 1 }}
                >
                  {rotationActionLoading ? '…' : 'Skip Turn →'}
                </button>
              ) : (
                <button
                  onClick={onSetTurn}
                  disabled={rotationActionLoading}
                  style={{ width: '100%', padding: '11px', borderRadius: '12px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', color: '#6366f1', fontWeight: 700, fontSize: '13px', cursor: rotationActionLoading ? 'not-allowed' : 'pointer', opacity: rotationActionLoading ? 0.6 : 1 }}
                >
                  {rotationActionLoading ? '…' : 'Set as Current Turn'}
                </button>
              )
            )}
            {canManage && (
              <>
                <button
                  onClick={() => { onRoleChange(member.user_id, member.role === 'admin' ? 'member' : 'admin'); onClose() }}
                  style={{ width: '100%', padding: '11px', borderRadius: '12px', background: 'var(--s3)', border: '1px solid var(--glass)', color: 'var(--t2)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  {member.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                </button>
                <button
                  onClick={() => { onRemove(member.user_id); onClose() }}
                  style={{ width: '100%', padding: '11px', borderRadius: '12px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  Remove from Club
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
