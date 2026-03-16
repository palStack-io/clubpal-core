import AppShell from '../../components/shell/AppShell'
import AdminIntegrationsCard from '../../components/admin/AdminIntegrationsCard'
import AdminOCRStatsCard from '../../components/admin/AdminOCRStatsCard'

export default function AdminPage() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--t1)]">Admin</h1>
          <p className="text-[var(--t2)] text-sm mt-1">Manage integrations and monitor usage</p>
        </div>
        <AdminIntegrationsCard />
        <AdminOCRStatsCard />
      </div>
    </AppShell>
  )
}
