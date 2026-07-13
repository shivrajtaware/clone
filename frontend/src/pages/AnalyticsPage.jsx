// src/pages/AnalyticsPage.jsx
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import api from '../utils/api'
import StatCard from '../components/common/StatCard'
import { Spinner } from '../components/common/StatCard'
import { fmt } from '../utils/helpers'

const CHART_COLORS = ['#00d4e0','#7c6ef9','#10d97e','#ffb830','#ff4757','#f06292','#3b9eff']

export default function AnalyticsPage() {
  const { data: dash, isLoading } = useQuery({ queryKey: ['analytics-dashboard'], queryFn: () => api.get('/analytics/dashboard').then(r => r.data.data) })
  const { data: revenue } = useQuery({ queryKey: ['analytics-revenue'], queryFn: () => api.get('/analytics/revenue').then(r => r.data.data) })
  const { data: depts } = useQuery({ queryKey: ['analytics-depts'], queryFn: () => api.get('/analytics/departments').then(r => r.data.data) })
  const { data: quality } = useQuery({ queryKey: ['analytics-quality'], queryFn: () => api.get('/analytics/quality-metrics').then(r => r.data.data) })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const s = dash || {}

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Analytics Dashboard</h1><p className="page-sub">Hospital performance metrics and insights</p></div>
        <div className="flex gap-2">
          <select className="select w-36">
            <option>This Month</option><option>Last 3 Months</option><option>This Year</option>
          </select>
          <button className="btn">📊 Export PDF</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="📈" value={fmt.currency(s.revenue_month || 0)} label="Revenue This Month" color="cyan" />
        <StatCard icon="🛏️" value={`${s.bed_occupancy_pct || 0}%`} label="Avg Bed Occupancy" color={s.bed_occupancy_pct > 85 ? 'red' : 'green'} />
        <StatCard icon="📅" value={s.appointments_today || 0} label="OPD Visits Today" color="purple" />
      </div>

      {/* Revenue Chart */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Monthly Revenue</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={revenue || []} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" tick={{ fill: '#8da8c8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#8da8c8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/100000).toFixed(1)}L`} />
            <Tooltip contentStyle={{ background: '#0d1e38', border: '1px solid rgba(0,212,224,0.2)', borderRadius: 8, color: '#dce8f5' }} formatter={v => [fmt.currency(v), 'Revenue']} />
            <Bar dataKey="total" fill="#00d4e0" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Department + Quality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Department Occupancy</h3>
          <div className="space-y-3">
            {(depts || []).filter(d => d.total_beds > 0).map(d => (
              <div key={d.id}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-slate-300">{d.name}</span>
                  <span className="text-xs font-medium text-white">{d.occupancy_pct}%</span>
                </div>
                <div className="progress">
                  <div className="progress-bar" style={{ width: `${d.occupancy_pct}%`, background: d.occupancy_pct > 85 ? '#ff4757' : d.occupancy_pct > 70 ? '#ffb830' : '#00d4e0' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Quality Metrics</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label:'Mortality Rate', val:`${quality?.mortality_rate || 0}%`, ok: quality?.mortality_rate < 2 },
              { label:'Patient Satisfaction', val:`${quality?.patient_satisfaction || 0} ★`, ok: quality?.patient_satisfaction >= 4 },
              { label:'Readmission Rate', val:`${quality?.readmission_rate || 0}%`, ok: quality?.readmission_rate < 10 },
              { label:'Incidents (Month)', val: quality?.incidents_month || 0, ok: quality?.incidents_month < 5 },
              { label:'Lab TAT Compliance', val:'88%', ok: true },
              { label:'Discharge On-Time', val:'94%', ok: true },
            ].map(m => (
              <div key={m.label} className="vital-box">
                <div className={`vital-val text-base ${m.ok ? 'vital-ok' : 'vital-warn'}`}>{m.val}</div>
                <div className="vital-name">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
