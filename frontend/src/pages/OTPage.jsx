import { useMemo, useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Camera, CheckCircle2, ClipboardCheck, Download, FileText, HeartPulse, Image, Play, Plus, Printer, ScanLine, ShieldCheck, Stethoscope, UploadCloud } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../utils/api'
import { getSocketUrl } from '../utils/runtimeConfig'
import Modal from '../components/common/Modal'
import StatCard, { Badge, Spinner } from '../components/common/StatCard'
import PatientSearch from '../components/patients/PatientSearch'
import { fmt } from '../utils/helpers'
import { printHtml } from '../utils/print'

const checks = {
  arrival: [['consent_done', 'Consent'], ['pre_anaesthesia', 'PAC'], ['blood_group_done', 'Blood'], ['fasting_confirmed', 'Fasting']],
  beforeCut: [['iv_access_done', 'IV'], ['site_marked', 'Site'], ['who_timeout', 'Timeout'], ['pre_meds_given', 'Antibiotic']],
  close: [['swab_count_pre', 'Count in'], ['swab_count_post', 'Count out'], ['implant_confirmed', 'Implant'], ['specimens_sent', 'Specimen']],
}
const allChecks = Object.values(checks).flat()
const templates = {
  standard: {
    label: 'General Surgery',
    diagnosis: 'Working diagnosis',
    indication: 'Indication for surgery',
    note: `PRE-OPERATIVE DETAILS
Pre-op diagnosis:
Planned procedure:
Indication:
Consent: Written informed consent explained and confirmed.
Antibiotic prophylaxis:
DVT / aspiration / allergy risk:

ANAESTHESIA & POSITIONING
Anaesthesia type:
ASA grade:
Airway / monitoring:
Position:
Skin preparation:
Draping:

TIMEOUT & SAFETY
Patient identity confirmed:
Procedure and site confirmed:
Imaging / investigations reviewed:
Blood availability:
Implants / special instruments:
Initial swab, needle and instrument count:

OPERATIVE FINDINGS
Primary findings:
Anatomical variations:
Contamination / adhesions / bleeding:

PROCEDURE PERFORMED
Incision / access:
Key operative steps:
Critical dissection / control points:
Specimen removed:
Irrigation / wash:
Drain placed:
Closure technique:
Dressing:

COUNTS & SIGN-OUT
Final swab, needle and instrument count:
Estimated blood loss:
Specimen labelling:
Complications:
Condition at transfer:

SURGEON'S REMARKS
`,
    plan: 'PACU monitoring, vitals charting, analgesia, antibiotics, VTE prophylaxis, diet, mobilization, drain care, wound care and escalation instructions.',
  },
  obstetric: {
    label: 'Obstetric / LSCS',
    diagnosis: 'Pregnancy / obstetric indication',
    indication: 'Maternal or fetal indication',
    note: `MATERNAL DETAILS
Gravida / para:
Gestational age:
Indication:
Risk factors:
Consent and counselling:

ANAESTHESIA & PREPARATION
Anaesthesia / analgesia:
Position:
Skin preparation and draping:
Antibiotic prophylaxis:
Blood availability:

DELIVERY DETAILS
Mode of delivery:
Incision / approach:
Baby delivered at:
Baby sex:
Birth weight:
APGAR:
Liquor:
Cord:
Placenta and membranes:

MATERNAL PROCEDURE DETAILS
Uterine incision / repair:
Hemostasis:
Uterotonics:
Tear / episiotomy / repair:
Bladder / bowel check:
Final count:
Estimated blood loss:

NEWBORN HANDOVER
Baby condition:
Resuscitation:
Shifted to:
Pediatrician / neonatal team:

MOTHER CONDITION
Vitals:
Bleeding:
Urine output:
Condition at transfer:

POST-DELIVERY INSTRUCTIONS
`,
    plan: 'Bleeding watch, fundal tone monitoring, vitals, urine output, analgesia, antibiotics, breastfeeding support, newborn handover and ward/PACU transfer.',
  },
  trauma: {
    label: 'Emergency / Trauma',
    diagnosis: 'Trauma / emergency diagnosis',
    indication: 'Emergency indication',
    note: `EMERGENCY CONTEXT
Arrival status:
Primary survey summary:
Indication for emergency OT:
Consent / emergency consent:
Pre-op resuscitation:

ANAESTHESIA & MONITORING
Anaesthesia:
Airway:
Lines:
Blood/products arranged:
Monitoring:

INJURY / FINDINGS
External injuries:
Internal findings:
Contamination:
Active bleeding source:

DAMAGE CONTROL / DEFINITIVE STEPS
Incision / access:
Bleeding control:
Repair / resection / fixation:
Packing:
Drains:
Temporary closure / definitive closure:

RESUSCITATION IN OT
Fluids:
Blood/products:
Vasopressors:
Urine output:
Temperature:

SIGN-OUT
Counts:
Estimated blood loss:
Complications:
ICU/PACU handover:
Re-look plan:
`,
    plan: 'High-dependency monitoring, serial vitals, repeat labs/imaging and escalation triggers.',
  },
}

const score = (s) => Math.round((allChecks.filter(([k]) => k === 'specimens_sent' ? s.specimens_sent : s.checklist?.[k]).length / allChecks.length) * 100)
const mins = (a, b = Date.now()) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000))
const addMinutes = (value, n) => { const d = new Date(value); d.setMinutes(d.getMinutes() + Number(n || 60)); return d.toISOString() }
const isDelivery = (text = '') => /delivery|lscs|cesarean|caesarean|obstetric|pregnan|birth|labou?r/i.test(text)
const roomClass = { AVAILABLE: 'border-brand-green/50 bg-brand-green/10', IN_USE: 'border-brand-red/50 bg-brand-red/10', CLEANING: 'border-brand-amber/50 bg-brand-amber/10', MAINTENANCE: 'border-slate-500/50 bg-white/5' }
const templateOrder = ['standard', 'obstetric', 'trauma']

function Field({ label, children }) {
  return <div><label className="label">{label}</label>{children}</div>
}

export default function OTPage() {
  const [bookOpen, setBookOpen] = useState(false)
  const [caseRow, setCaseRow] = useState(null)
  const [patient, setPatient] = useState(null)
  const [admit, setAdmit] = useState({ bed_id: '', admitting_doctor_id: '' })
  const qc = useQueryClient()
  const book = useForm({ defaultValues: { surgery_type: 'ELECTIVE', expected_minutes: 60 } })
  const sheet = useForm()
  const templateKey = isDelivery(book.watch('procedure')) ? 'obstetric' : 'standard'

  const { data: rooms, isLoading: roomsLoading } = useQuery({ queryKey: ['ot-rooms'], queryFn: () => api.get('/ot/rooms').then(r => r.data.data), refetchInterval: 10000 })
  const { data: schedule, isLoading } = useQuery({ queryKey: ['ot-schedule'], queryFn: () => api.get('/ot/schedule', { params: { view: 'action' } }).then(r => r.data.data), refetchInterval: 10000 })
  const { data: beds } = useQuery({ queryKey: ['ot-beds'], queryFn: () => api.get('/beds', { params: { status: 'AVAILABLE' } }).then(r => r.data.data), enabled: !!caseRow })
  const { data: doctors } = useQuery({ queryKey: ['ot-doctors'], queryFn: () => api.get('/staff', { params: { role: 'DOCTOR' } }).then(r => r.data.data), enabled: bookOpen || !!caseRow })
  const list = schedule || []
  const active = list.filter(x => x.status === 'IN_PROGRESS')
  const refresh = () => { qc.invalidateQueries({ queryKey: ['ot-schedule'] }); qc.invalidateQueries({ queryKey: ['ot-rooms'] }); qc.invalidateQueries({ queryKey: ['ot-beds'] }) }
  useEffect(() => {
      const socket = io(getSocketUrl(), {
      auth: { token: localStorage.getItem('token') }
    })

    socket.emit('join:ot')
    socket.on('ot:status', () => refresh())
    socket.on('ot:new', () => refresh())

    return () => {
      socket.off('ot:status')
      socket.off('ot:new')
      socket.disconnect()
    }
  }, [])

  const lanes = useMemo(() => ({
    planned: list.filter(x => ['SCHEDULED', 'PREP'].includes(x.status)),
    live: active,
    recovery: list.filter(x => x.status === 'COMPLETED'),
  }), [list])

  const scheduleMut = useMutation({
    mutationFn: (d) => api.post('/ot/schedule', { ...d, patient_id: patient?.id, scheduled_end: addMinutes(d.scheduled_start, d.expected_minutes) }),
    onSuccess: (res) => {
      const created = res.data.data
      qc.setQueryData(['ot-schedule'], old => {
        const rows = old || []
        return rows.some(r => r.id === created.id) ? rows : [...rows, created].sort((a, b) => new Date(a.scheduled_start) - new Date(b.scheduled_start))
      })
      toast.success('OT case booked')
      setBookOpen(false)
      setPatient(null)
      book.reset({ surgery_type: 'ELECTIVE', expected_minutes: 60 })
      refresh()
    },
    onError: e => toast.error(e.response?.data?.message || 'Could not book OT'),
  })
  const statusMut = useMutation({ mutationFn: ({ id, ...data }) => api.patch(`/ot/${id}/status`, data), onSuccess: refresh, onError: e => toast.error(e.response?.data?.message || 'Status update failed') })
  const checklistMut = useMutation({ mutationFn: ({ id, data }) => api.patch(`/ot/checklist/${id}`, data), onSuccess: refresh })
  const sheetMut = useMutation({
    mutationFn: ({ id, complete, ...data }) => complete ? api.patch(`/ot/${id}/status`, { status: 'COMPLETED', ...data }) : api.patch(`/ot/${id}/clinical-notes`, data),
    onSuccess: () => { toast.success('OT sheet saved'); setCaseRow(null); refresh() },
    onError: e => toast.error(e.response?.data?.message || 'Could not save case sheet'),
  })
  const admitMut = useMutation({
    mutationFn: ({ id, data }) => api.post(`/ot/${id}/admit-after-surgery`, data),
    onSuccess: () => { toast.success('Post-op admission created'); setCaseRow(null); refresh() },
    onError: e => toast.error(e.response?.data?.message || 'Admission failed'),
  })

  const openSheet = (row) => {
    const t = isDelivery(row.procedure) ? templates.obstetric : templates.standard
    setCaseRow(row)
    setAdmit({ bed_id: '', admitting_doctor_id: row.surgeon_id || '' })
    sheet.reset({
      diagnosis: row.diagnosis || t.diagnosis,
      indication: row.indication || t.indication,
      anesthesia_type: row.anesthesia_type || '',
      operative_notes: row.operative_notes || t.note,
      postop_plan: row.postop_plan || t.plan,
      recovery_status: row.recovery_status || 'Stable for PACU observation',
      complications: row.complications || '',
      implants_used: row.implants_used || '',
      specimens_sent: !!row.specimens_sent,
      blood_loss_ml: row.blood_loss_ml || '',
      note_attachments: row.note_attachments || [],
    })
  }
  const toggle = (row, key) => key === 'specimens_sent'
    ? sheet.setValue('specimens_sent', !sheet.watch('specimens_sent'))
    : row.checklist?.id && checklistMut.mutate({ id: row.checklist.id, data: { [key]: !row.checklist?.[key] } })
  const saveSheet = (data, complete = false) => {
    if (complete && !data.operative_notes?.trim()) return toast.error('Operative note is required')
    if (complete && !caseRow.checklist?.who_timeout) return toast.error('WHO timeout is required before sign-out')
    sheetMut.mutate({ id: caseRow.id, complete, ...data, blood_loss_ml: Number(data.blood_loss_ml || 0) })
  }
  const attachImages = async (files) => {
    const current = sheet.getValues('note_attachments') || []
    const reads = [...files].slice(0, 4).map(f => new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(f)
    }))
    sheet.setValue('note_attachments', [...current, ...(await Promise.all(reads))])
  }
  const exportCase = () => {
    const d = sheet.getValues()
    const p = caseRow.patient
    const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
    const now = new Date().toLocaleString()
    const images = (d.note_attachments || []).map(src => `<div class="photo"><img src="${src}" /></div>`).join('')
    const html = `
      <div class="doc">
        <header>
          <div>
            <div class="eyebrow">Operation Theatre Record</div>
            <h1>Operative Case Sheet</h1>
          </div>
          <div class="meta">Printed<br/><b>${esc(now)}</b></div>
        </header>
        <section class="grid">
          <div><span>Patient</span><b>${esc(p.first_name)} ${esc(p.last_name)}</b></div>
          <div><span>UHID</span><b>${esc(p.uhid)}</b></div>
          <div><span>Gender</span><b>${esc(p.gender || '-')}</b></div>
          <div><span>Phone</span><b>${esc(p.phone || '-')}</b></div>
          <div><span>Procedure</span><b>${esc(caseRow.procedure)}</b></div>
          <div><span>OT Suite</span><b>${esc(caseRow.ot_room?.name || '-')}</b></div>
          <div><span>Priority</span><b>${esc(caseRow.surgery_type)}</b></div>
          <div><span>Status</span><b>${esc(caseRow.status)}</b></div>
        </section>
        <section class="two">
          <article><h2>Diagnosis</h2><p>${esc(d.diagnosis)}</p></article>
          <article><h2>Indication</h2><p>${esc(d.indication)}</p></article>
        </section>
        <article><h2>Operative Note</h2><pre>${esc(d.operative_notes)}</pre></article>
        <section class="two">
          <article><h2>Anesthesia</h2><p>${esc(d.anesthesia_type)}</p></article>
          <article><h2>Estimated Blood Loss</h2><p>${esc(d.blood_loss_ml || '0')} ml</p></article>
          <article><h2>Complications / Alerts</h2><p>${esc(d.complications || 'None recorded')}</p></article>
          <article><h2>Implants / Consumables</h2><p>${esc(d.implants_used || 'None recorded')}</p></article>
        </section>
        <section class="two">
          <article><h2>PACU Recovery Status</h2><p>${esc(d.recovery_status)}</p></article>
          <article><h2>Post-op Plan</h2><p>${esc(d.postop_plan)}</p></article>
        </section>
        ${images ? `<article><h2>Attached Handwritten Notes</h2><div class="photos">${images}</div></article>` : ''}
        <footer>
          <div>Surgeon signature</div>
          <div>Anesthetist signature</div>
          <div>Nursing sign-out</div>
        </footer>
      </div>`
    printHtml(`<html><head><title>OT Case Sheet</title><style>
      @page{size:A4;margin:14mm}
      body{font-family:Inter,Arial,sans-serif;background:#f4f7fb;color:#111827;margin:0}
      .doc{background:white;max-width:920px;margin:0 auto;padding:28px;border:1px solid #d8e1ee}
      header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #0e7490;padding-bottom:16px;margin-bottom:18px}
      .eyebrow{text-transform:uppercase;letter-spacing:.12em;color:#0e7490;font-size:11px;font-weight:800}
      h1{margin:4px 0 0;font-size:28px} h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#0f172a;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin:0 0 8px}
      .meta{text-align:right;font-size:11px;color:#64748b}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
      .grid div,.two article,article{border:1px solid #e5e7eb;border-radius:8px;padding:10px;background:#fff}
      span{display:block;font-size:10px;text-transform:uppercase;color:#64748b;margin-bottom:4px} b{font-size:12px}
      .two{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
      p{white-space:pre-wrap;font-size:12px;line-height:1.55;margin:0}
      pre{white-space:pre-wrap;font:12px/1.55 "Consolas",monospace;margin:0}
      .photos{display:grid;grid-template-columns:1fr 1fr;gap:10px}.photo{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}.photo img{width:100%;display:block}
      footer{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:28px}footer div{border-top:1px solid #111827;padding-top:8px;font-size:11px;color:#334155}
    </style></head><body>${html}</body></html>`, 'OT Case Sheet').catch(() => toast.error('Could not open the print dialog'))
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Operation Theatre Command</h1><p className="page-sub">Patient-first booking, safety gating, live surgery control, photo notes and post-op admission</p></div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setBookOpen(true)}><Plus size={16} /> Book Surgery</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={<ScanLine size={20} />} value={(rooms || []).length} label="OT Suites" color="cyan" />
        <StatCard icon={<Play size={20} />} value={active.length} label="Live" color="red" />
        <StatCard icon={<ShieldCheck size={20} />} value={`${list.length ? Math.round(list.reduce((a, s) => a + score(s), 0) / list.length) : 0}%`} label="Safety" color="green" />
        <StatCard icon={<ClipboardCheck size={20} />} value={lanes.planned.length} label="Queued" color="amber" />
        <StatCard icon={<HeartPulse size={20} />} value={lanes.recovery.length} label="PACU" color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {(rooms || []).map(r => <div key={r.id} className={`card border ${roomClass[r.status] || ''}`}>
          <div className="flex items-center justify-between"><div className="font-bold text-white">{r.name}</div><Badge status={r.status} /></div>
          <div className="mt-2 text-xs text-slate-400">{(r.features || []).join(' | ') || 'Monitor | suction | cautery | anesthesia station'}</div>
          <div className="mt-3 text-xs text-cyan">{r.records?.[0]?.procedure || 'Ready after sterile check'}</div>
        </div>)}
        {roomsLoading && <div className="card flex justify-center py-8"><Spinner /></div>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {Object.entries(lanes).map(([lane, rows]) => <section key={lane} className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-white capitalize">{lane}</h2><span className="text-xs text-slate-400">{rows.length} cases</span></div>
          {isLoading ? <div className="card flex justify-center py-8"><Spinner /></div> : rows.map(s => <div key={s.id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div><div className="font-bold text-white">{s.procedure}</div><div className="text-xs text-slate-400">{s.patient?.first_name} {s.patient?.last_name} | {s.patient?.uhid}</div></div>
              <Badge status={s.status} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div><div className="text-slate-500">Room</div><div className="text-cyan">{s.ot_room?.name}</div></div>
              <div><div className="text-slate-500">Start</div><div className="text-white">{fmt.time(s.scheduled_start)}</div></div>
              <div><div className="text-slate-500">Clock</div><div className="text-white">{s.status === 'IN_PROGRESS' ? `${mins(s.actual_start)} min` : `${mins(s.scheduled_start, s.scheduled_end)} min`}</div></div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs"><span className="text-slate-400">Readiness</span><span className="text-white">{score(s)}%</span></div>
              <div className="h-1.5 rounded-full bg-navy-800 mt-1"><div className="h-full rounded-full bg-cyan" style={{ width: `${score(s)}%` }} /></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn text-xs flex items-center gap-1" onClick={() => openSheet(s)}><FileText size={14} /> Case</button>
              {s.status === 'SCHEDULED' && <button className="btn text-xs" onClick={() => statusMut.mutate({ id: s.id, status: 'PREP' })}>Prep</button>}
              {['SCHEDULED', 'PREP'].includes(s.status) && <button className="btn text-xs text-brand-red" onClick={() => statusMut.mutate({ id: s.id, status: 'IN_PROGRESS' })}>Start</button>}
            </div>
          </div>)}
          {!isLoading && !rows.length && <div className="card text-center py-8 text-xs text-slate-400">No cases</div>}
        </section>)}
      </div>

      <Modal open={bookOpen} onClose={() => setBookOpen(false)} title="Smart OT Booking" size="xl">
        <form onSubmit={book.handleSubmit(d => patient ? scheduleMut.mutate(d) : toast.error('Select registered patient'))} className="space-y-4">
          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Registered patient"><PatientSearch value={patient} onChange={setPatient} placeholder="Search UHID, name or phone" /></Field>
            <Field label="OT suite"><select className="select" {...book.register('ot_room_id', { required: true })}>{(rooms || []).map(r => <option key={r.id} value={r.id}>{r.name} - {r.status}</option>)}</select></Field>
            <Field label="Procedure"><input className="input" {...book.register('procedure', { required: true })} placeholder="LSCS / lap chole / debridement" /></Field>
            <Field label="Priority"><select className="select" {...book.register('surgery_type')}>{['ELECTIVE', 'SEMI_ELECTIVE', 'EMERGENCY'].map(x => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Diagnosis"><input className="input" {...book.register('diagnosis')} /></Field>
            <Field label="Indication"><input className="input" {...book.register('indication')} /></Field>
            <Field label="Start"><input type="datetime-local" className="input" {...book.register('scheduled_start', { required: true })} /></Field>
            <Field label="Duration minutes"><input type="number" min="15" step="5" className="input" {...book.register('expected_minutes')} /></Field>
            <Field label="Surgeon"><select className="select" {...book.register('surgeon_id')}><option value="">Assign later</option>{(doctors || []).map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}</select></Field>
            <Field label="Anesthesia plan"><input className="input" {...book.register('anesthesia_type')} placeholder="GA / spinal / regional / local" /></Field>
          </section>
          <div className="rounded-lg border border-cyan/30 bg-cyan/10 p-3 text-xs text-cyan flex gap-2"><Stethoscope size={16} /> Template loaded: {templateKey === 'obstetric' ? 'obstetric delivery workflow' : 'standard surgery workflow'}</div>
          <div className="flex gap-2"><button className="btn-primary flex-1" disabled={scheduleMut.isPending}>Book OT</button><button type="button" className="btn flex-1" onClick={() => setBookOpen(false)}>Cancel</button></div>
        </form>
      </Modal>

      <Modal open={!!caseRow} onClose={() => setCaseRow(null)} title="Digital OT Case Sheet" size="xl">
        {caseRow && <form onSubmit={sheet.handleSubmit(d => saveSheet(d, true))} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="card bg-white/5"><div className="text-slate-400">Patient</div><div className="text-white font-bold">{caseRow.patient?.first_name} {caseRow.patient?.last_name}</div><div className="text-cyan">{caseRow.patient?.uhid}</div></div>
            <div className="card bg-white/5"><div className="text-slate-400">Procedure</div><div className="text-white font-bold">{caseRow.procedure}</div><div className="text-cyan">{caseRow.surgery_type}</div></div>
            <div className="card bg-white/5"><div className="text-slate-400">Disposition</div><div className="text-white font-bold">{caseRow.admission_id ? 'IPD linked' : 'Post-op admission optional'}</div><div className="text-cyan">{caseRow.ot_room?.name}</div></div>
          </div>

          {Object.entries(checks).map(([title, group]) => <section key={title}>
            <div className="text-xs uppercase tracking-widest text-cyan mb-2">{title}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {group.map(([key, label]) => {
                const done = key === 'specimens_sent' ? sheet.watch('specimens_sent') : caseRow.checklist?.[key]
                return <button key={key} type="button" onClick={() => toggle(caseRow, key)} className={`rounded-lg border p-2 text-xs flex items-center justify-center gap-1 ${done ? 'border-brand-green bg-brand-green/15 text-brand-green' : 'border-default bg-white/5 text-slate-300'}`}><CheckCircle2 size={14} /> {label}</button>
              })}
            </div>
          </section>)}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Diagnosis"><input className="input" {...sheet.register('diagnosis')} /></Field>
            <Field label="Indication"><input className="input" {...sheet.register('indication')} /></Field>
            <Field label="Anesthesia"><input className="input" {...sheet.register('anesthesia_type')} /></Field>
            <Field label="Estimated blood loss ml"><input type="number" className="input" {...sheet.register('blood_loss_ml')} /></Field>
          </div>
          <section className="rounded-lg border border-default bg-navy-800/60 overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-default p-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-cyan">Structured operative note</div>
                <div className="text-[11px] text-slate-400 mt-1">Use a clinical template, then edit only the blanks during surgery sign-out.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {templateOrder.map(key => <button
                  key={key}
                  type="button"
                  className="btn text-xs"
                  onClick={() => {
                    sheet.setValue('diagnosis', templates[key].diagnosis)
                    sheet.setValue('indication', templates[key].indication)
                    sheet.setValue('operative_notes', templates[key].note)
                    sheet.setValue('postop_plan', templates[key].plan)
                  }}
                >{templates[key].label}</button>)}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr]">
              <aside className="border-b border-default p-3 lg:border-b-0 lg:border-r">
                {['Pre-op', 'Anesthesia', 'Findings', 'Steps', 'Counts', 'Handover'].map(x => (
                  <div key={x} className="mb-2 rounded-md border border-default bg-white/5 px-3 py-2 text-xs text-slate-300">{x}</div>
                ))}
              </aside>
              <textarea
                className="min-h-[420px] w-full resize-y bg-white px-4 py-3 font-mono text-[13px] leading-6 text-slate-950 outline-none"
                spellCheck="true"
                {...sheet.register('operative_notes')}
              />
            </div>
          </section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Complications / alerts"><textarea className="textarea h-24" {...sheet.register('complications')} /></Field>
            <Field label="Implants / consumables"><textarea className="textarea h-24" {...sheet.register('implants_used')} /></Field>
            <Field label="PACU recovery status"><textarea className="textarea h-24" {...sheet.register('recovery_status')} /></Field>
            <Field label="Post-op plan"><textarea className="textarea h-24" {...sheet.register('postop_plan')} /></Field>
          </div>

          <section>
            <div className="flex items-center justify-between mb-2"><div className="text-xs uppercase tracking-widest text-cyan">Photo notes</div><label className="btn text-xs flex items-center gap-1 cursor-pointer"><UploadCloud size={14} /> Upload<input type="file" accept="image/*" multiple className="hidden" onChange={e => attachImages(e.target.files)} /></label></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(sheet.watch('note_attachments') || []).map((src, i) => <div key={i} className="relative rounded-lg border border-default overflow-hidden aspect-video bg-navy-800"><img src={src} className="w-full h-full object-cover" /><Image size={16} className="absolute top-2 right-2 text-white" /></div>)}
              {!(sheet.watch('note_attachments') || []).length && <div className="rounded-lg border border-default bg-white/5 p-4 text-xs text-slate-400 flex items-center gap-2"><Camera size={16} /> No handwritten note images</div>}
            </div>
          </section>

          {!caseRow.admission_id && <section className="rounded-lg border border-brand-amber/40 bg-brand-amber/10 p-3 space-y-3">
            <div className="text-xs font-bold text-brand-amber">Post-op admission</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Available bed"><select className="select" value={admit.bed_id} onChange={e => setAdmit({ ...admit, bed_id: e.target.value })}><option value="">Auto allocate</option>{(beds || []).map(b => <option key={b.id} value={b.id}>{b.ward} / Bed {b.bed_no}</option>)}</select></Field>
              <Field label="Admitting doctor"><select className="select" value={admit.admitting_doctor_id} onChange={e => setAdmit({ ...admit, admitting_doctor_id: e.target.value })}><option value="">Select doctor</option>{(doctors || []).map(d => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>)}</select></Field>
            </div>
            <button type="button" className="btn text-xs" onClick={() => admitMut.mutate({ id: caseRow.id, data: { ...admit, provisional_diagnosis: sheet.getValues('diagnosis'), notes: sheet.getValues('postop_plan') } })}>Create Admission After Surgery</button>
          </section>}

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn flex items-center gap-1" onClick={exportCase}><Printer size={14} /> Export</button>
            <button type="button" className="btn flex items-center gap-1" onClick={sheet.handleSubmit(d => saveSheet(d, false))}><Download size={14} /> Save Draft</button>
            <button className="btn-primary flex-1 flex items-center justify-center gap-1" disabled={sheetMut.isPending}><ShieldCheck size={14} /> Sign Out + Complete</button>
          </div>
        </form>}
      </Modal>
    </div>
  )
}
