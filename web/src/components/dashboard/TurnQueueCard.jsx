import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../ui/Card'
import Avatar from '../ui/Avatar'
import { groupsApi } from '../../api/groups'
import { gatewayClient } from '../../api/client'

export default function TurnQueueCard({ groups = [], rotations = [], currentUserId, currentUser }) {
  const navigate = useNavigate()
  // membersMap: { [groupId]: member[] } — enriched with profile data
  const [membersMap, setMembersMap] = useState({})

  useEffect(() => {
    if (!groups.length) return
    groups.forEach(g => {
      groupsApi.getMembers(g.id)
        .then(async mems => {
          const list = Array.isArray(mems) ? mems : []
          // Enrich with user profiles (full_name, username, avatar_url)
          const profiles = await Promise.all(
            list.map(m =>
              gatewayClient.get(`/users/${m.user_id}/profile`)
                .then(r => r.data)
                .catch(() => ({ id: m.user_id }))
            )
          )
          const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
          const enriched = list.map(m => ({ ...m, ...profileMap[m.user_id] }))
          setMembersMap(prev => ({ ...prev, [g.id]: enriched }))
        })
        .catch(() => {})
    })
  }, [groups.map(g => g.id).join(',')])

  // Build one row per group that has rotation data
  const rows = groups
    .map((g, i) => {
      const rot = rotations[i]
      if (!rot) return null
      const members = membersMap[g.id] || []
      const picker = members.find(m => String(m.user_id) === String(rot.user_id))
      const isYou = String(rot.user_id) === String(currentUserId)
      return { group: g, rot, picker, isYou }
    })
    .filter(Boolean)

  return (
    <Card>
      <Card.Header title="Turn Queue" />
      <Card.Body>
        {rows.length === 0 ? (
          <div style={{ color: 'var(--t3)', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>
            No rotation data.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {rows.map(({ group, picker, isYou }) => (
              <div
                key={group.id}
                onClick={() => navigate(`/groups/${group.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 11px', borderRadius: '11px', cursor: 'pointer',
                  background: isYou ? 'var(--rose-glow)' : 'var(--s3)',
                  border: `1px solid ${isYou ? 'var(--rose-border)' : 'var(--glass)'}`,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <Avatar
                  user={isYou ? (currentUser || picker) : (picker || {})}
                  size="sm"
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isYou ? 'You' : (picker?.full_name || picker?.username || `User #${picker?.user_id ?? '?'}`)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {group.name}
                  </div>
                </div>
                {isYou ? (
                  <span style={{
                    fontSize: '10px', fontWeight: 700, flexShrink: 0,
                    color: 'var(--rose-soft)', background: 'var(--rose-glow)',
                    padding: '2px 8px', borderRadius: '100px',
                    border: '1px solid var(--rose-border)',
                  }}>
                    Your turn
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--t4)', flexShrink: 0 }}>→</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
