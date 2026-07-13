// src/pages/superadmin/SAAnalyticsPage.jsx
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import api from '../../utils/api'
import StatCard from '../../components/common/StatCard'
import { Spinner } from '../../components/common/StatCard'
import { fmt } from '../../utils/helpers'

export default function SAAnalyticsPage() {
  const { data: stats } = useQuery({ queryKey: ['sa-stats'], queryFn: () => api.get('/superadmin/stats').then(r => r.data.data) })
  const { data: hospitals, isLoading } = useQuery({ queryKey: ['sa-hospitals-analytics'], queryFn: () => api.get('/superadmin/hospitals').then(r => r.data.data) })

  const s = stats || {}
  const hs = hospitals || []

  const licenseData = [
    { name: 'Basic', count: hs.filter(h => h.license_type === 'BASIC').length, color: '#8da8c8' },
    { name: 'Professional', count: hs.filter(h => h.license_type === 'PROFESSIONAL').length, color: '#3b9eff' },
    { name: 'Enterprise', count: hs.filter(h => h.license_type === 'ENTERPRISE').length, color: '#7c6ef9' },
  ]

  const topByPatients = [...hs].sort((a, b) => (b.patient_count || 0) - (a.patient_count || 0)).slice(0, 8)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">Global Analytics</h1><p className="page-sub">Platform-wide performance metrics</p></div></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="🏥" value={s.total_hospitals || 0} label="Total Hospitals" color="cyan" />
        <StatCard icon="👥" value={(s.total_patients || 0).toLocaleString()} label="Total Patients" color="purple" />
        <StatCard icon="💰" value={fmt.currency(s.total_revenue || 0)} label="Total Platform Revenue" color="green" />
        <StatCard icon="✅" value={`${s.active_hospitals || 0} / ${s.total_hospitals || 0}`} label="Active / Total" color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* License Distribution Chart */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">License Type Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={licenseData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: '#8da8c8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8da8c8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0d1e38', border: '1px solid rgba(0,212,224,0.2)', borderRadius: 8 }} />
              {licenseData.map((entry, idx) => (
                <Bar key={idx} dataKey="count" fill={entry.color} radius={[4,4,0,0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Hospitals by Patients */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Top Hospitals by Patients</h3>
          <div className="space-y-2">
            {isLoading ? <Spinner /> : topByPatients.map((h, i) => (
              <div key={h.id}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-slate-300 truncate max-w-[60%]">{i+1}. {h.name}</span>
                  <span className="text-xs font-medium text-white">{h.patient_count?.toLocaleString() || 0}</span>
                </div>
                <div className="progress">
                  <div className="progress-bar" style={{ width: `${Math.min(100, ((h.patient_count || 0) / (topByPatients[0]?.patient_count || 1)) * 100)}%`, background: '#00d4e0' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full Hospital Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-default text-sm font-semibold text-white">All Hospitals Summary</div>
        {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <table className="tbl">
            <thead><tr><th>#</th><th>Hospital</th><th>City</th><th>License</th><th>Beds</th><th>Patients</th><th>Users</th><th>Status</th></tr></thead>
            <tbody>
              {hs.map((h, i) => (
                <tr key={h.id}>
                  <td className="text-xs text-slate-500">{i+1}</td>
                  <td className="text-xs font-medium text-white">{h.name}</td>
                  <td className="text-xs text-slate-400">{h.city}</td>
                  <td><span className={`badge text-[10px] ${h.license_type === 'ENTERPRISE' ? 'badge-purple' : h.license_type === 'PROFESSIONAL' ? 'badge-blue' : 'badge-gray'}`}>{h.license_type}</span></td>
                  <td className="text-xs">{h.bed_count}</td>
                  <td className="text-xs">{h.patient_count?.toLocaleString() || 0}</td>
                  <td className="text-xs">{h.user_count}</td>
                  <td><span className={`badge ${h.is_active ? 'badge-green' : 'badge-red'}`}>{h.is_active ? 'Active' : 'Suspended'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
