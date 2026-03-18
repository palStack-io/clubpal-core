import { useState, useEffect } from 'react'
import { authApi } from '../../api/auth'
import { useAuth } from '../../contexts/AuthContext'
import Card from '../ui/Card'
import Button from '../ui/Button'

export default function AdminUsersCard() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  useEffect(() => {
    authApi.adminListUsers()
      .then(data => { setUsers(data); setLoading(false) })
      .catch(() => { setError('Failed to load users.'); setLoading(false) })
  }, [])

  const handleDelete = async (userId) => {
    setDeletingId(userId)
    try {
      await authApi.adminDeleteUser(userId)
      setUsers(u => u.filter(x => x.id !== userId))
    } catch {
      setError('Failed to remove user.')
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  return (
    <Card>
      <Card.Header title={`Users${users.length ? ` (${users.length})` : ''}`} />
      <Card.Body>
        {loading && <div style={{ color: 'var(--t3)', fontSize: '13px', padding: '8px 0' }}>Loading...</div>}
        {error && <div style={{ color: '#f87171', fontSize: '13px', padding: '8px 0' }}>{error}</div>}
        {!loading && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {users.map(u => (
              <div
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--glass)',
                  gap: '12px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>{u.username}</span>
                    {u.is_admin && (
                      <span style={{ fontSize: '10px', fontWeight: 700, background: 'rgba(244,63,94,0.12)', color: 'var(--rose)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '100px', padding: '1px 7px' }}>
                        admin
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--t3)', marginTop: '1px' }}>{u.email}</div>
                </div>

                <div style={{ flexShrink: 0 }}>
                  {confirmId === u.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--t2)' }}>Remove?</span>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={deletingId === u.id}
                        onClick={() => handleDelete(u.id)}
                      >
                        Yes
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmId(null)}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={u.id === currentUser?.id}
                      onClick={() => setConfirmId(u.id)}
                      style={{ color: u.id === currentUser?.id ? 'var(--t3)' : '#f87171' }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
