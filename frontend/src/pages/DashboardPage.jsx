// src/pages/DashboardPage.jsx
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../utils/api'
import StatCard from '../components/common/StatCard'
import { Badge } from '../components/common/StatCard'
import { Spinner } from '../components/common/StatCard'
import { fmt } from '../utils/helpers'
import useAuthStore from '../context/authStore'

export default function DashboardPage() {
  const { user } = useAuthStore()

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => api.get('/analytics/dashboard').then(r => r.data.data),
    refetchInterval: 60000,
  })

  const { data: dashData, isLoading: loadingDash } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data.data),
    refetchInterval: 30000,
  })

  const { data: emergencyStats } = useQuery({
    queryKey: ['emergency-stats'],
    queryFn: () => api.get('/emergency/stats').then(r => r.data.data),
    refetchInterval: 15000,
  })

  if (loadingStats || loadingDash) return (
    <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  )

  const s = stats || {}
  const d = dashData || {}

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Good {getGreeting()}, {user?.first_name} 👋</h1>
          <p className="text-sm text-slate-400 mt-0.5">{fmt.date(new Date())} · {user?.hospital?.name}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/patients" className="btn-primary text-sm">+ New Patient</Link>
          <Link to="/appointments" className="btn text-sm">📅 Schedule</Link>
        </div>
      </div>

      {/* Critical Alerts */}
      {emergencyStats?.total > 0 && (
        <div className="alert-red">
          <span className="text-lg">🚨</span>
          <div>
            <strong>Emergency Active:</strong> {emergencyStats.red} critical, {emergencyStats.orange} urgent cases in ER.
            <Link to="/emergency" className="ml-2 underline text-brand-red">View Emergency →</Link>
          </div>
        </div>
      )}

      {/* Announcements */}
      {(d.announcements || []).slice(0, 1).map(a => (
        <div key={a.id} className={`alert-${a.priority === 'URGENT' ? 'red' : 'blue'}`}>
          <span>📢</span>
          <div><strong>{a.title}:</strong> {a.body}</div>
        </div>
      ))}

      {/* Stats Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="👥" value={s.patients_today || 0} label="New Patients Today" change={`+${s.admissions_today || 0} admitted`} changeType="up" color="cyan" />
        <StatCard icon="🛏️" value={`${s.beds_occupied || 0}/${s.beds_total || 0}`} label="Beds Occupied" change={`${s.bed_occupancy_pct || 0}% occupancy`} changeType={s.bed_occupancy_pct > 85 ? 'down' : 'up'} color={s.bed_occupancy_pct > 85 ? 'red' : 'green'} />
        <StatCard icon="📅" value={s.appointments_today || 0} label="Appointments Today" color="amber" />
        <StatCard icon="Rx" value={s.pharmacy_low_stock || 0} label="Low Stock Medicines" color="purple" />
      </div>

      {/* Stats Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="🚨" value={emergencyStats?.total || 0} label="Emergency Active" change={`${emergencyStats?.red || 0} critical`} changeType="down" color="red" />
        <StatCard icon="🔬" value={s.ot_today || 0} label="OT Cases Today" color="cyan" />
        <StatCard icon="👨‍⚕️" value={s.doctors_on_duty || 0} label="Staff On Duty" color="green" />
      </div>

      {/* Middle content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Admissions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Admissions</h3>
            <Link to="/patients" className="text-xs text-cyan hover:underline">View All →</Link>
          </div>
          {(d.recentPatients || []).length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No admissions today</p>
          ) : (
            <table className="tbl">
              <thead><tr><th>Patient</th><th>Ward</th><th>Time</th></tr></thead>
              <tbody>
                {(d.recentPatients || []).map(a => (
                  <tr key={a.id}>
                    <td>
                      <Link to={`/patients/${a.patient?.id}`} className="flex items-center gap-2 hover:text-cyan">
                        <div className="avatar-sm bg-gradient-to-br from-cyan to-brand-purple text-[10px]">
                          {a.patient?.first_name?.[0]}{a.patient?.last_name?.[0]}
                        </div>
                        <div>
                          <div className="font-medium text-white text-xs">{a.patient?.first_name} {a.patient?.last_name}</div>
                          <div className="text-[10px] text-slate-400">{a.patient?.uhid}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="text-xs">{a.bed?.ward} · {a.bed?.bed_no}</td>
                    <td className="text-xs text-slate-400">{fmt.time(a.admission_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Today's Appointments */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Today's Schedule</h3>
            <Link to="/appointments" className="text-xs text-cyan hover:underline">Full Schedule →</Link>
          </div>
          {(d.todayAppts || []).length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No appointments today</p>
          ) : (
            <table className="tbl">
              <thead><tr><th>Token</th><th>Patient</th><th>Doctor</th><th>Status</th></tr></thead>
              <tbody>
                {(d.todayAppts || []).slice(0, 6).map(a => (
                  <tr key={a.id}>
                    <td className="text-cyan font-medium text-xs">{a.token_no || '-'}</td>
                    <td className="text-xs">{a.patient?.first_name} {a.patient?.last_name}</td>
                    <td className="text-xs text-slate-400">Dr. {a.doctor?.last_name}</td>
                    <td><Badge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Low Stock + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">⚠️ Low Stock Alert</h3>
            <Link to="/pharmacy" className="text-xs text-cyan hover:underline">Pharmacy →</Link>
          </div>
          {(d.lowStockItems || []).length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">✅ All stock levels normal</p>
          ) : (d.lowStockItems || []).map(item => (
            <div key={item.id} className="flex items-center justify-between py-2 border-b border-default last:border-0">
              <div>
                <div className="text-xs font-medium text-white">{item.generic_name}</div>
                <div className="text-[10px] text-slate-400">{item.brand_name}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-brand-red">{item.current_stock} {item.unit}</div>
                <div className="text-[10px] text-slate-400">Min: {item.min_stock_level}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { to: '/patients', icon: '👤', label: 'Register Patient' },
              { to: '/appointments', icon: '📅', label: 'Book Appointment' },
              { to: '/beds', icon: '🛏️', label: 'Admit Patient' },
              { to: '/emr', icon: '🧪', label: 'Add Lab Tests' },
              { to: '/pharmacy', icon: '💊', label: 'Dispense Drug' },
              { to: '/billing', icon: '💳', label: 'Generate Bill' },
              { to: '/emergency', icon: '🚨', label: 'Emergency Case' },
              { to: '/compliance', icon: '📋', label: 'Report Incident' },
            ].map(({ to, icon, label }) => (
              <Link key={to} to={to} className="card-hover flex items-center gap-2 p-2.5 text-xs">
                <span>{icon}</span><span className="text-slate-300">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Morning'
  if (h < 17) return 'Afternoon'
  return 'Evening'
}
