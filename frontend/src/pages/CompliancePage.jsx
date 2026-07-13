// src/pages/CompliancePage.jsx
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { AlertTriangle, ClipboardCheck, FileWarning, Search, ShieldCheck, Target } from 'lucide-react'
import api from '../utils/api'
import Modal from '../components/common/Modal'
import StatCard, { Badge, Spinner } from '../components/common/StatCard'
import { fmt } from '../utils/helpers'

const incidentTypes = ['PATIENT_FALL','MEDICATION_ERROR','EQUIPMENT_FAILURE','NEAR_MISS','SENTINEL','ADVERSE_EVENT','COMPLAINT','OTHER']
const severities = ['MINOR','MODERATE','MAJOR','CATASTROPHIC']

export default function CompliancePage() {
  const [showModal, setShowModal] = useState(false)
  const [capaIncident, setCapaIncident] = useState(null)
  const [search, setSearch] = useState('')
  const qc = useQueryClient()
  const form = useForm({ defaultValues: { type: 'OTHER', severity: 'MINOR', status: 'OPEN' } })
  const capaForm = useForm({ defaultValues: { status: 'CAPA_PENDING' } })
  const { data: incidents, isLoading } = useQuery({ queryKey: ['incidents'], queryFn: () => api.get('/compliance/incidents').then(r => r.data.data), refetchInterval: 45000 })
  const rows = useMemo(() => {
    const q = search.toLowerCase().trim()
    const list = incidents || []
    if (!q) return list
    return list.filter(i => [i.incident_no, i.type, i.severity, i.description, i.location, i.status].some(v => String(v || '').toLowerCase().includes(q)))
  }, [incidents, search])
  const open = (incidents||[]).filter(i => i.status === 'OPEN').length
  const capa = (incidents||[]).filter(i => i.status === 'CAPA_PENDING').length
  const major = (incidents||[]).filter(i => ['MAJOR','CATASTROPHIC'].includes(i.severity)).length
  const closed = (incidents||[]).filter(i => i.status === 'CLOSED').length

  const refresh = () => qc.invalidateQueries({ queryKey: ['incidents'] })
  const incidentMut = useMutation({
    mutationFn: (data) => api.post('/compliance/incidents', data),
    onSuccess: () => { toast.success('Incident reported'); refresh(); setShowModal(false); form.reset({ type: 'OTHER', severity: 'MINOR', status: 'OPEN' }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to report incident'),
  })
  const capaMut = useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/compliance/incidents/${id}`, data),
    onSuccess: () => { toast.success('CAPA updated'); refresh(); setCapaIncident(null); capaForm.reset({ status: 'CAPA_PENDING' }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update CAPA'),
  })

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Compliance, Risk & CAPA Command</h1><p className="page-sub">Incident reporting, severity intelligence, RCA and corrective action tracking</p></div>
        <button className="btn-primary" onClick={() => setShowModal(true)}><FileWarning size={16} /> Report Incident</button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <StatCard icon={<ShieldCheck size={22} />} value={`${Math.max(0, 100 - open * 4 - major * 8)}%`} label="Risk posture" color={major ? 'red' : open ? 'amber' : 'green'} />
        <StatCard icon={<AlertTriangle size={22} />} value={open} label="Open incidents" color="amber" />
        <StatCard icon={<Target size={22} />} value={capa} label="CAPA pending" color="red" />
        <StatCard icon={<FileWarning size={22} />} value={major} label="Major severity" color="red" />
        <StatCard icon={<ClipboardCheck size={22} />} value={closed} label="Closed" color="green" />
      </div>

      {major > 0 && <div className="alert-red"><AlertTriangle size={18} /> <span>{major} major or catastrophic incidents require leadership review.</span></div>}

      <div className="card"><div className="relative"><Search className="absolute left-3 top-2.5 text-slate-500" size={16} /><input className="input pl-9" placeholder="Search incident, type, severity, location, description..." value={search} onChange={e => setSearch(e.target.value)} /></div></div>

      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-default text-sm font-semibold text-white">Incident & CAPA Register</div>
        {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Incident</th><th>Severity</th><th>Description</th><th>RCA / CAPA</th><th>Owner</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {rows.map(i => (
                  <tr key={i.id}>
                    <td><div className="font-mono text-xs text-cyan">{i.incident_no}</div><div className="text-[10px] text-slate-500">{i.type?.replace(/_/g,' ')} | {fmt.date(i.reported_at)}</div></td>
                    <td><span className={`badge ${i.severity === 'MINOR' ? 'badge-green' : i.severity === 'MODERATE' ? 'badge-amber' : 'badge-red'}`}>{i.severity}</span></td>
                    <td><div className="text-xs text-white max-w-md">{i.description}</div><div className="text-[10px] text-slate-500">{i.location || '-'}</div></td>
                    <td><div className="text-xs text-slate-300">{i.rca || 'RCA pending'}</div><div className="text-[10px] text-slate-500">{i.capa || 'CAPA pending'}</div></td>
                    <td className="text-xs">{i.capa_owner || i.reported_by}</td>
                    <td><Badge status={i.status} /></td>
                    <td><button className="btn text-xs px-2 py-1" onClick={() => { setCapaIncident(i); capaForm.reset({ status: i.status, rca: i.rca || '', capa: i.capa || '', capa_owner: i.capa_owner || '', capa_due: i.capa_due ? String(i.capa_due).slice(0, 10) : '' }) }}>CAPA</button></td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No incidents reported</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Report Incident" size="lg">
        <form onSubmit={form.handleSubmit(d => incidentMut.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Type"><select className="select" {...form.register('type')}>{incidentTypes.map(v => <option key={v}>{v}</option>)}</select></Field>
            <Field label="Severity"><select className="select" {...form.register('severity')}>{severities.map(v => <option key={v}>{v}</option>)}</select></Field>
          </div>
          <Field label="Location"><input className="input" {...form.register('location')} /></Field>
          <Field label="Description" required><textarea className="textarea" rows={4} {...form.register('description', { required: true })} /></Field>
          <SubmitRow loading={incidentMut.isPending} label="Report incident" onCancel={() => setShowModal(false)} />
        </form>
      </Modal>

      <Modal open={!!capaIncident} onClose={() => setCapaIncident(null)} title="RCA / CAPA Action" size="lg">
        <form onSubmit={capaForm.handleSubmit(d => capaMut.mutate({ id: capaIncident?.id, ...d }))} className="space-y-3">
          <Field label="Root cause analysis"><textarea className="textarea" rows={3} {...capaForm.register('rca')} /></Field>
          <Field label="Corrective / preventive action"><textarea className="textarea" rows={3} {...capaForm.register('capa')} /></Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><Field label="Owner"><input className="input" {...capaForm.register('capa_owner')} /></Field><Field label="Due date"><input type="date" className="input" {...capaForm.register('capa_due')} /></Field><Field label="Status"><select className="select" {...capaForm.register('status')}>{['OPEN','UNDER_REVIEW','CAPA_PENDING','CLOSED'].map(s => <option key={s}>{s}</option>)}</select></Field></div>
          <SubmitRow loading={capaMut.isPending} label="Update CAPA" onCancel={() => setCapaIncident(null)} />
        </form>
      </Modal>
    </div>
  )
}

function Field({ label, required, children }) {
  return <div><label className="label">{label}{required ? ' *' : ''}</label>{children}</div>
}

function SubmitRow({ loading, label, onCancel }) {
  return <div className="flex gap-2 pt-2"><button type="submit" disabled={loading} className="btn-primary flex-1"><ClipboardCheck size={16} /> {loading ? 'Saving...' : label}</button><button type="button" className="btn flex-1" onClick={onCancel}>Cancel</button></div>
}
