// src/pages/superadmin/SADashboardPage.jsx
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../../utils/api'
import StatCard from '../../components/common/StatCard'
import { Badge, Spinner } from '../../components/common/StatCard'
import { fmt } from '../../utils/helpers'

export default function SADashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['sa-stats'],
    queryFn: () => api.get('/superadmin/stats').then(r => r.data.data),
    refetchInterval: 60000,
  })
  const { data: hospitals } = useQuery({
    queryKey: ['sa-hospitals'],
    queryFn: () => api.get('/superadmin/hospitals').then(r => r.data.data),
  })
  const { data: invoices } = useQuery({
    queryKey: ['sa-invoices'],
    queryFn: () => api.get('/superadmin/invoices').then(r => r.data.data),
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const s = stats || {}
  const recentHospitals = (hospitals || []).slice(0, 5)
  const pendingInvoices = (invoices || []).filter(i => i.status === 'PENDING')

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Super Admin Dashboard</h1>
          <p className="page-sub">Full platform overview · {fmt.datetime(new Date())}</p>
        </div>
        <Link to="/superadmin/hospitals" className="btn-primary">+ Add Hospital</Link>
      </div>

      {/* Alerts */}
      {s.expired > 0 && (
        <div className="alert-red">🔴 <strong>{s.expired} hospital(s)</strong> have expired licenses. They cannot log in. <Link to="/superadmin/hospitals" className="underline ml-1">Manage →</Link></div>
      )}
      {s.expiring_soon > 0 && (
        <div className="alert-amber">⚠️ <strong>{s.expiring_soon} hospital(s)</strong> have licenses expiring within 30 days. <Link to="/superadmin/hospitals" className="underline ml-1">Renew →</Link></div>
      )}
      {pendingInvoices.length > 0 && (
        <div className="alert-blue">💰 <strong>{pendingInvoices.length} invoices</strong> pending payment. <Link to="/superadmin/invoices" className="underline ml-1">View Invoices →</Link></div>
      )}

      {/* Global Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="🏥" value={s.total_hospitals || 0} label="Total Hospitals" change={`${s.active_hospitals || 0} active`} changeType="up" color="cyan" />
        <StatCard icon="👥" value={(s.total_patients || 0).toLocaleString()} label="Total Patients" color="purple" />
        <StatCard icon="👤" value={(s.total_users || 0).toLocaleString()} label="Total Users" color="blue" />
        <StatCard icon="💰" value={fmt.currency(s.total_revenue || 0)} label="Platform Revenue" color="green" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="✅" value={s.active_hospitals || 0} label="Active Licenses" color="green" />
        <StatCard icon="⏳" value={s.expiring_soon || 0} label="Expiring Soon" color="amber" />
        <StatCard icon="❌" value={s.expired || 0} label="Expired Licenses" color="red" />
        <StatCard icon="📋" value={pendingInvoices.length} label="Pending Invoices" color="amber" />
      </div>

      {/* Recent Hospitals + Pending Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Hospitals</h3>
            <Link to="/superadmin/hospitals" className="text-xs text-cyan hover:underline">View All →</Link>
          </div>
          <div className="space-y-2">
            {recentHospitals.map(h => (
              <div key={h.id} className="flex items-center justify-between py-2 border-b border-default last:border-0">
                <div>
                  <div className="text-sm font-medium text-white">{h.name}</div>
                  <div className="text-xs text-slate-400">{h.city}, {h.state} · {h.bed_count} beds · {h.patient_count} patients</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge status={h.is_active ? 'ACTIVE' : 'SUSPENDED'} />
                  <span className={`text-[10px] ${h.license_status === 'EXPIRED' ? 'text-brand-red' : h.license_status === 'EXPIRING_SOON' ? 'text-brand-amber' : 'text-slate-400'}`}>
                    {h.license_status === 'EXPIRED' ? '⛔ Expired' : h.license_status === 'EXPIRING_SOON' ? `⚠️ ${h.days_remaining}d left` : `✅ ${h.days_remaining}d left`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Pending Invoices</h3>
            <Link to="/superadmin/invoices" className="text-xs text-cyan hover:underline">View All →</Link>
          </div>
          {pendingInvoices.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">✅ All invoices paid</p>
          ) : (
            <div className="space-y-2">
              {pendingInvoices.slice(0, 5).map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-default last:border-0">
                  <div>
                    <div className="text-sm font-medium text-white">{inv.hospital?.name}</div>
                    <div className="text-xs text-slate-400">{fmt.date(inv.period_from)} — {fmt.date(inv.period_to)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-brand-amber">{fmt.currency(inv.amount)}</div>
                    <Badge status={inv.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* License Distribution */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">License Distribution</h3>
        <div className="grid grid-cols-3 gap-4">
          {[['BASIC','Basic','gray'],['PROFESSIONAL','Professional','blue'],['ENTERPRISE','Enterprise','purple']].map(([type, label, color]) => {
            const count = (hospitals || []).filter(h => h.license_type === type).length
            const pct = hospitals?.length ? Math.round((count / hospitals.length) * 100) : 0
            return (
              <div key={type} className="text-center">
                <div className={`text-2xl font-bold mb-1 ${color === 'purple' ? 'text-brand-purple' : color === 'blue' ? 'text-brand-blue' : 'text-slate-300'}`}>{count}</div>
                <div className="text-xs text-slate-400">{label}</div>
                <div className="progress mt-2"><div className="progress-bar" style={{ width: `${pct}%`, background: color === 'purple' ? '#7c6ef9' : color === 'blue' ? '#3b9eff' : '#8da8c8' }} /></div>
                <div className="text-xs text-slate-500 mt-1">{pct}%</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
