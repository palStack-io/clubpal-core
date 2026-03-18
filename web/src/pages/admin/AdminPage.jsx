import { useState } from 'react'
import AppShell from '../../components/shell/AppShell'
import AdminIntegrationsCard from '../../components/admin/AdminIntegrationsCard'
import AdminOCRStatsCard from '../../components/admin/AdminOCRStatsCard'
import AdminUsersCard from '../../components/admin/AdminUsersCard'

const TABS = [
  { id: 'integrations', label: 'Integrations' },
  { id: 'users', label: 'Users' },
]

export default function AdminPage() {
  const [tab, setTab] = useState('integrations')

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--t1)]">Admin</h1>
          <p className="text-[var(--t2)] text-sm mt-1">Manage integrations and monitor usage</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--glass)', marginBottom: '4px' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? 'var(--rose)' : 'var(--t3)',
                borderBottom: tab === t.id ? '2px solid var(--rose)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'integrations' && (
          <>
            <AdminIntegrationsCard />
            <AdminOCRStatsCard />
          </>
        )}
        {tab === 'users' && <AdminUsersCard />}
      </div>
    </AppShell>
  )
}
