// src/pages/EmergencyPage.jsx
import { useMemo, useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Activity, AlertTriangle, Ambulance, CheckCircle2, Clock, Radio, ShieldAlert, Siren, Stethoscope, Zap } from 'lucide-react'
import api from '../utils/api'
import Modal from '../components/common/Modal'
import StatCard, { Badge, Spinner } from '../components/common/StatCard'
import { fmt } from '../utils/helpers'

const TRIAGE = {
  RED: { label: 'Immediate', target: 0, color: 'badge-red', ring: 'border-rose-300 bg-rose-50' },
  ORANGE: { label: 'Emergent', target: 10, color: 'badge-red', ring: 'border-orange-300 bg-orange-50' },
  YELLOW: { label: 'Urgent', target: 30, color: 'badge-amber', ring: 'border-amber-300 bg-amber-50' },
  GREEN: { label: 'Less Urgent', target: 60, color: 'badge-green', ring: 'border-emerald-300 bg-emerald-50' },
  BLUE: { label: 'Non-Urgent', target: 120, color: 'badge-blue', ring: 'border-blue-300 bg-blue-50' },
}

const DISPOSITIONS = ['ADMITTED', 'TRANSFERRED', 'DISCHARGED', 'EXPIRED']

function minutesSince(date) {
  if (!date) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000))
}

function patientLabel(c) {
  return c.patient_name || (c.unknown_patient ? 'Unknown patient' : 'Walk-in emergency')
}

export default function EmergencyPage() {
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [massCasualtyMode, setMassCasualtyMode] = useState(false)
  const qc = useQueryClient()
  useEffect(() => {
    const socket = io({ auth: { token: localStorage.getItem('token') } })
    socket.emit('join:emergency')
    socket.on('emergency:updated', () => {
      qc.invalidateQueries({ queryKey: ['emergency-cases'] })
      qc.invalidateQueries({ queryKey: ['emergency-stats'] })
    })
    return () => socket.disconnect()
  }, [qc])
  const { register, handleSubmit, reset } = useForm({ defaultValues: { triage_level: 'YELLOW', gender: '', is_mlc: false, unknown_patient: false } })

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['emergency-cases'],
    queryFn: () => api.get('/emergency').then(r => r.data.data),
    refetchInterval: 10000,
  })
  const { data: stats = {} } = useQuery({
    queryKey: ['emergency-stats'],
    queryFn: () => api.get('/emergency/stats').then(r => r.data.data),
    refetchInterval: 10000,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['emergency-cases'] })
    qc.invalidateQueries({ queryKey: ['emergency-stats'] })
  }

  const createMut = useMutation({
    mutationFn: (d) => api.post('/emergency', d),
    onSuccess: (r) => { toast.success(`Case ${r.data.data?.case_no} registered`); invalidate(); setShowModal(false); reset() },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not register case'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/emergency/${id}`, payload),
    onSuccess: () => { toast.success('Emergency case updated'); invalidate(); setSelected(null) },
    onError: (e) => toast.error(e.response?.data?.message || 'Update failed'),
  })

  const seenMut = useMutation({
    mutationFn: (id) => api.patch(`/emergency/${id}/seen`),
    onSuccess: () => { toast.success('Clinician response time recorded'); invalidate(); setSelected(null) },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not mark case as seen'),
  })

  const command = useMemo(() => {
    const redOrange = cases.filter(c => ['RED', 'ORANGE'].includes(c.triage_level)).length
    const unassigned = cases.filter(c => !c.doctor_id).length
    const breaches = cases.filter(c => !c.doctor_time && minutesSince(c.arrival_time) > (TRIAGE[c.triage_level]?.target || 60)).length
    return { redOrange, unassigned, breaches }
  }, [cases])

  const sortedCases = useMemo(() => [...cases].sort((a, b) => {
    const rank = ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE']
    return rank.indexOf(a.triage_level) - rank.indexOf(b.triage_level) || new Date(a.arrival_time) - new Date(b.arrival_time)
  }), [cases])

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Siren size={20} /> Emergency Command Center</h1>
          <p className="page-sub">Live triage, response targets, MLC tracking, and disposition control</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            className={massCasualtyMode ? 'btn-danger' : 'btn'}
            onClick={() => {
              setMassCasualtyMode(v => {
                const next = !v
                toast(next ? 'Mass casualty mode activated' : 'Mass casualty mode deactivated')
                return next
              })
            }}
          >
            <ShieldAlert size={16} /> {massCasualtyMode ? 'MCI active' : 'Mass casualty'}
          </button>
          <button className="btn-primary" onClick={() => setShowModal(true)}><Ambulance size={16} /> Register emergency</button>
        </div>
      </div>

      {massCasualtyMode && (
        <div className="alert-red">
          <ShieldAlert size={18} />
          <div>
            <div className="font-bold">Mass casualty command mode is active</div>
            <div className="text-xs">Prioritize RED and ORANGE cases, keep registration minimal, and record disposition when stable.</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard icon={<Siren size={22} />} value={stats.total || 0} label="Active cases" color="red" />
        <StatCard icon={<Zap size={22} />} value={stats.red || 0} label="Immediate" color="red" />
        <StatCard icon={<AlertTriangle size={22} />} value={stats.orange || 0} label="Emergent" color="amber" />
        <StatCard icon={<Clock size={22} />} value={`${stats.avgDoorMinutes || 0}m`} label="Avg door time" color="blue" />
        <StatCard icon={<ShieldAlert size={22} />} value={stats.mlc || 0} label="MLC active" color="purple" />
        <StatCard icon={<Activity size={22} />} value={stats.responseBreaches || command.breaches} label="Target breaches" color="red" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_.85fr] gap-4">
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-4 border-b border-default">
            <div>
              <div className="text-sm font-bold">Resuscitation Worklist</div>
              <div className="text-xs text-slate-400">{command.redOrange} critical, {command.unassigned} awaiting clinician</div>
            </div>
            <div className="flex gap-1 flex-wrap justify-end">
              {Object.entries(TRIAGE).map(([key, cfg]) => <span key={key} className={`badge ${cfg.color}`}>{key}: {stats[key.toLowerCase()] || 0}</span>)}
            </div>
          </div>
          {isLoading ? <div className="flex justify-center py-20"><Spinner size="lg" /></div> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Case</th><th>Triage</th><th>Patient</th><th>Chief Complaint</th><th>Door Time</th><th>Response</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {sortedCases.map(c => {
                    const mins = minutesSince(c.arrival_time)
                    const target = TRIAGE[c.triage_level]?.target ?? 60
                    const breached = !c.doctor_time && mins > target
                    return (
                      <tr key={c.id}>
                        <td className="font-mono text-xs text-cyan">{c.case_no}</td>
                        <td><span className={`badge ${TRIAGE[c.triage_level]?.color}`}>{c.triage_level} - {TRIAGE[c.triage_level]?.label}</span></td>
                        <td>
                          <div className="text-xs font-medium text-white">{patientLabel(c)}</div>
                          <div className="text-[10px] text-slate-400">{c.age_approx || 'Age N/A'} {c.gender || ''} {c.is_mlc && <span className="badge badge-red ml-1">MLC</span>}</div>
                        </td>
                        <td className="text-xs max-w-[210px]"><div className="line-clamp-2">{c.chief_complaint}</div></td>
                        <td className="text-xs"><span className={breached ? 'text-brand-red font-bold' : ''}>{mins}m</span><div className="text-[10px] text-slate-400">{fmt.time(c.arrival_time)}</div></td>
                        <td>{c.doctor_time ? <span className="badge badge-green">Seen</span> : breached ? <span className="badge badge-red">Escalate</span> : <span className="badge badge-amber">Waiting</span>}</td>
                        <td><Badge status={c.status} /></td>
                        <td><button className="btn text-xs px-2 py-1" onClick={() => setSelected(c)}>Command</button></td>
                      </tr>
                    )
                  })}
                  {sortedCases.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-slate-400">No active emergency cases</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center gap-2 text-sm font-bold mb-3"><Radio size={16} /> Triage Intelligence</div>
            <div className="space-y-2">
              {Object.entries(TRIAGE).map(([key, cfg]) => {
                const count = stats[key.toLowerCase()] || 0
                const pct = stats.total ? Math.min(100, Math.round((count / stats.total) * 100)) : 0
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1"><span>{key} {cfg.label}</span><span>{count}</span></div>
                    <div className="progress"><div className={`progress-bar ${key === 'RED' || key === 'ORANGE' ? 'bg-brand-red' : key === 'YELLOW' ? 'bg-brand-amber' : 'bg-brand-green'}`} style={{ width: `${pct}%` }} /></div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 text-sm font-bold mb-3"><Stethoscope size={16} /> Protocol Board</div>
            {[
              ['Primary survey', 'Airway, breathing, circulation, disability, exposure'],
              ['Golden hour', 'Prioritize RED and ORANGE cases for immediate clinician review'],
              ['MLC custody', 'Preserve chain-of-custody notes and police intimation number'],
              ['Disposition', 'Close active cases with admit, transfer, discharge, or expired'],
            ].map(([title, desc]) => (
              <div key={title} className="flex gap-2 py-2 border-b border-default last:border-0">
                <CheckCircle2 size={16} className="text-brand-green mt-0.5" />
                <div><div className="text-xs font-bold">{title}</div><div className="text-[11px] text-slate-400">{desc}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Register Emergency Case" size="lg">
        <form onSubmit={handleSubmit(d => createMut.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">Patient name</label><input className="input" placeholder="Unknown if not identified" {...register('patient_name')} /></div>
            <div><label className="label">Approx. age</label><input className="input" placeholder="45 yrs / adult / child" {...register('age_approx')} /></div>
            <div><label className="label">Gender</label><select className="select" {...register('gender')}><option value="">Unknown</option>{['MALE','FEMALE','OTHER'].map(g => <option key={g}>{g}</option>)}</select></div>
            <div><label className="label">Triage level *</label><select className="select" {...register('triage_level', { required: true })}>{Object.entries(TRIAGE).map(([k,v]) => <option key={k} value={k}>{k} - {v.label}</option>)}</select></div>
          </div>
          <div><label className="label">Chief complaint *</label><textarea className="textarea h-20" placeholder="Mechanism, symptoms, vitals, immediate risks" {...register('chief_complaint', { required: true })} /></div>
          <div><label className="label">Notes</label><textarea className="textarea h-16" placeholder="Allergies, pre-hospital care, belongings, police notes" {...register('notes')} /></div>
          <div className="flex items-center gap-4 flex-wrap text-sm">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...register('is_mlc')} /> Medico-legal case</label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...register('unknown_patient')} /> Unknown patient</label>
          </div>
          <div className="flex gap-2 pt-2"><button type="submit" disabled={createMut.isPending} className="btn-primary flex-1">{createMut.isPending ? 'Registering...' : 'Register case'}</button><button type="button" className="btn flex-1" onClick={() => setShowModal(false)}>Cancel</button></div>
        </form>
      </Modal>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Emergency Command Actions" size="lg">
        {selected && (
          <div className="space-y-4">
            <div className={`border rounded-xl p-3 ${TRIAGE[selected.triage_level]?.ring}`}>
              <div className="flex items-center justify-between gap-3">
                <div><div className="text-sm font-bold">{selected.case_no} - {patientLabel(selected)}</div><div className="text-xs text-slate-400">{selected.chief_complaint}</div></div>
                <span className={`badge ${TRIAGE[selected.triage_level]?.color}`}>{selected.triage_level}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {['RED','ORANGE','YELLOW','GREEN','BLUE'].map(level => <button key={level} className="btn text-xs" onClick={() => updateMut.mutate({ id: selected.id, payload: { triage_level: level } })}>Set {level}</button>)}
            </div>
            <button className="btn-primary w-full" disabled={seenMut.isPending || !!selected.doctor_time} onClick={() => seenMut.mutate(selected.id)}>
              {selected.doctor_time ? 'Clinician already seen' : 'Mark clinician seen now'}
            </button>
            <div>
              <label className="label">Disposition</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {DISPOSITIONS.map(status => <button key={status} className="btn text-xs" onClick={() => updateMut.mutate({ id: selected.id, payload: { status, disposition: status } })}>{status}</button>)}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
