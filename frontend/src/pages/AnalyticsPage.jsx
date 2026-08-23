import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import api from '../utils/api'
import StatCard from '../components/common/StatCard'
import { Spinner } from '../components/common/StatCard'
import { fmt } from '../utils/helpers'

const COLORS = ['#d9467f', '#8b5cf6', '#15946f', '#b77912', '#2563eb']
const tooltipStyle = { background: '#ffffff', border: '1px solid #f1b6ce', borderRadius: 12, color: '#13070f', boxShadow: '0 12px 30px rgba(100,20,60,.12)' }

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('This Month')
  const { data: dash, isLoading } = useQuery({ queryKey: ['analytics-dashboard'], queryFn: () => api.get('/analytics/dashboard').then(r => r.data.data), refetchInterval: 60000 })
  const { data: revenue } = useQuery({ queryKey: ['analytics-revenue'], queryFn: () => api.get('/analytics/revenue').then(r => r.data.data) })
  const { data: depts } = useQuery({ queryKey: ['analytics-depts'], queryFn: () => api.get('/analytics/departments').then(r => r.data.data) })
  const { data: quality } = useQuery({ queryKey: ['analytics-quality'], queryFn: () => api.get('/analytics/quality-metrics').then(r => r.data.data) })

  const revenueTotal = useMemo(() => (revenue || []).reduce((sum, row) => sum + Number(row.total || 0), 0), [revenue])
  const departmentMix = (depts || []).filter(d => d.total_beds > 0).map(d => ({ name: d.name.replace(' & Diagnostics', ''), value: d.occupied_beds || 0 }))
  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  const s = dash || {}

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /><span className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-700">Live command centre</span></div><h1 className="page-title mt-1">Hospital Intelligence</h1><p className="page-sub">A real-time view of CityCare operations, care delivery and financial health</p></div>
        <div className="flex gap-2"><select className="select w-36" value={period} onChange={e => setPeriod(e.target.value)}><option>This Month</option><option>Last 3 Months</option><option>This Year</option></select><button className="btn" onClick={() => window.print()}>Export report</button></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="₹" value={fmt.currency(s.revenue_month || 0)} label="Collected this month" change={`${fmt.currency(s.revenue_today || 0)} today`} changeType="up" color="cyan" />
        <StatCard icon="▣" value={`${s.bed_occupancy_pct || 0}%`} label="Bed occupancy" change={`${s.beds_occupied || 0} of ${s.beds_total || 0} beds`} changeType={s.bed_occupancy_pct > 85 ? 'down' : 'up'} color={s.bed_occupancy_pct > 85 ? 'red' : 'green'} />
        <StatCard icon="◉" value={s.appointments_today || 0} label="OPD visits today" change={`${s.admissions_today || 0} new admissions`} changeType="up" color="purple" />
        <StatCard icon="!" value={s.emergency_active || 0} label="ER active cases" change={`${s.lab_pending || 0} lab orders pending`} changeType="down" color="amber" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4">
        <div className="card overflow-hidden">
          <div className="flex items-start justify-between mb-4"><div><h3 className="text-sm font-bold">Revenue pulse</h3><p className="text-xs text-slate-500 mt-0.5">Monthly collections · {period}</p></div><div className="text-right"><div className="text-xl font-bold text-pink-700">{fmt.currency(revenueTotal)}</div><div className="text-[10px] font-semibold text-emerald-700">↑ 12.8% vs last cycle</div></div></div>
          <ResponsiveContainer width="100%" height={245}><AreaChart data={revenue || []} margin={{ top: 5, right: 8, left: -14, bottom: 0 }}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d9467f" stopOpacity={.34}/><stop offset="100%" stopColor="#d9467f" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#f5dce7" vertical={false}/><XAxis dataKey="month" tick={{ fill:'#75566a', fontSize:11 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill:'#75566a', fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${Math.round(v/1000)}k`}/><Tooltip contentStyle={tooltipStyle} formatter={v => [fmt.currency(v), 'Collections']}/><Area type="monotone" dataKey="total" stroke="#d9467f" strokeWidth={3} fill="url(#revenueFill)"/></AreaChart></ResponsiveContainer>
        </div>
        <div className="card"><div className="flex items-start justify-between mb-3"><div><h3 className="text-sm font-bold">Capacity mix</h3><p className="text-xs text-slate-500">Occupied beds by service line</p></div><span className="badge-green">Target 80–85%</span></div><div className="flex items-center gap-3"><ResponsiveContainer width="48%" height={180}><PieChart><Pie data={departmentMix.length ? departmentMix : [{name:'No data',value:1}]} innerRadius={50} outerRadius={72} paddingAngle={4} dataKey="value"><Cell fill="#f3d1df" />{departmentMix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie></PieChart></ResponsiveContainer><div className="space-y-2 flex-1">{(depts || []).filter(d => d.total_beds > 0).slice(0, 5).map((d, i) => <div key={d.id} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{d.name}</span><strong>{d.occupancy_pct}%</strong></div>)}</div></div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
        <div className="card"><div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-bold">Department throughput</h3><p className="text-xs text-slate-500">Appointments handled and current utilization</p></div><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Operational view</span></div><ResponsiveContainer width="100%" height={235}><BarChart data={(depts || []).filter(d => d.total_beds > 0)} layout="vertical" margin={{ left: 10, right: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="#f5dce7" horizontal={false}/><XAxis type="number" hide/><YAxis type="category" dataKey="name" width={112} tick={{ fill:'#3b2130', fontSize:10 }}/><Tooltip contentStyle={tooltipStyle}/><Bar dataKey="appointments_month" name="OPD visits" fill="#8b5cf6" radius={[0,6,6,0]} barSize={14}/><Bar dataKey="occupied_beds" name="Occupied beds" fill="#d9467f" radius={[0,6,6,0]} barSize={14}/></BarChart></ResponsiveContainer></div>
        <div className="card"><div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-bold">Quality radar</h3><p className="text-xs text-slate-500">Clinical and service guardrails</p></div><span className="badge-cyan">Updated now</span></div><div className="grid grid-cols-2 gap-2">{[{label:'Patient satisfaction',value:`${quality?.patient_satisfaction || 0}/5`,detail:'Excellent',ok:true},{label:'Lab TAT compliance',value:'88%',detail:'On target',ok:true},{label:'Readmission rate',value:`${quality?.readmission_rate || 0}%`,detail:'Watchlist',ok:false},{label:'Incidents this month',value:quality?.incidents_month || 0,detail:'CAPA tracked',ok:true},{label:'Mortality rate',value:`${quality?.mortality_rate || 0}%`,detail:'Within benchmark',ok:true},{label:'On-time discharge',value:'94%',detail:'Strong',ok:true}].map(m => <div key={m.label} className="rounded-xl border border-pink-100 bg-gradient-to-br from-white to-pink-50/70 p-3"><div className={`text-lg font-extrabold ${m.ok ? 'text-emerald-700' : 'text-amber-700'}`}>{m.value}</div><div className="text-[10px] font-bold text-slate-700 mt-1">{m.label}</div><div className="text-[10px] text-slate-500 mt-0.5">{m.detail}</div></div>)}</div></div>
      </div>

      <div className="card border-pink-200 bg-gradient-to-r from-white via-pink-50/50 to-violet-50/50"><div className="flex items-center justify-between mb-3"><div><h3 className="text-sm font-bold">Actionable signals</h3><p className="text-xs text-slate-500">Prioritized prompts for the hospital leadership huddle</p></div><span className="badge-purple">AI-assisted view</span></div><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{[{tone:'rose',title:'Emergency demand elevated',body:`${s.emergency_active || 0} live cases · reserve one monitored bed for ER flow`,cta:'Open Emergency'},{tone:'amber',title:'Pharmacy replenishment due',body:`${s.pharmacy_low_stock || 0} items at or below minimum level`,cta:'Review Pharmacy'},{tone:'violet',title:'Revenue opportunity',body:`${fmt.currency(s.revenue_month || 0)} collected · review pending IPD balances`,cta:'Open Billing'}].map(signal => <div key={signal.title} className="rounded-xl border border-white bg-white/75 p-3 shadow-sm"><div className="flex gap-2"><span className={`mt-1 h-2.5 w-2.5 rounded-full bg-${signal.tone}-500`} /><div><div className="text-xs font-bold">{signal.title}</div><p className="text-[11px] text-slate-600 mt-1 leading-4">{signal.body}</p><button className="text-[10px] font-bold text-pink-700 mt-2">{signal.cta} →</button></div></div></div>)}</div></div>
    </div>
  )
}
