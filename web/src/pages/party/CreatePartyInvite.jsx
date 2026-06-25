import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../../components/shell/AppShell'

export default function CreatePartyInvite() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/', { replace: true })
  }, [])
  return (
    <AppShell>
      <div style={{ padding: 24, color: 'var(--t2)', fontSize: '0.9rem' }}>
        Redirecting… To create a party invite, open an event and toggle "Make it public".
      </div>
    </AppShell>
  )
}
