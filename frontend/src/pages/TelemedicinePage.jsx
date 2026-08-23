import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Activity, CalendarClock, CheckCircle2, ClipboardList, ExternalLink,
  FileText, Link2, Mic, MonitorPlay, PhoneCall, Plus, Search, Send,
  ShieldCheck, Stethoscope, UserRound, Video, XCircle,
} from 'lucide-react'
import api from '../utils/api'
import useAuthStore from '../context/authStore'
import Modal from '../components/common/Modal'
import { Badge, EmptyState, Spinner } from '../components/common/StatCard'
import { fmt } from '../utils/helpers'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const TELE_STATUS = ['SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED']
const emptySession = { mode: 'VIDEO', provider: 'EXTERNAL_LINK', meeting_url: '' }
const emptyMedicine = { drug_name: '', dose: '', frequency: 'BD', duration: '', route: 'Oral', instructions: '' }

const statusLabel = (status) => ({
  SCHEDULED: 'Scheduled', ONGOING: 'Ongoing', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
}[status] || status || 'Scheduled')

const timeUntil = (date) => {
  if (!date) return 'Time not set'
  const diff = new Date(date).getTime() - Date.now()
  if (diff < 0) return 'Ready now'
  const mins = Math.floor(diff / 60000)
  return mins < 60 ? `In ${mins} min` : `In ${Math.floor(mins / 60)}h ${mins % 60}m`
}

function SectionTitle({ icon: Icon, title, hint }) {
  return <div data-section-title={title} className="flex items-center justify-between gap-3 mb-3">
    <div className="flex items-center gap-2"><Icon size={16} className="text-cyan" /><h2 className="text-sm font-semibold text-white">{title}</h2></div>
    {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
  </div>
}

export default function TelemedicinePage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const isDoctor = user?.role === 'DOCTOR'
  const [selectedId, setSelectedId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [search, setSearch] = useState('')
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [sessionForm, setSessionForm] = useState(emptySession)
  const [note, setNote] = useState({ subjective: '', objective: '', assessment: '', plan: '' })
  const [medicines, setMedicines] = useState([])
  const [showPrescription, setShowPrescription] = useState(false)
  const [fulfillmentMode, setFulfillmentMode] = useState('HOSPITAL_PHARMACY')
  const [completedPrescription, setCompletedPrescription] = useState(null)
  const [completedPlan, setCompletedPlan] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['telemedicine-workspace', statusFilter],
    queryFn: () => api.get('/appointments', {
      params: {
        type: 'TELECONSULT',
        limit: 100,
        doctor_id: isDoctor ? user.id : undefined,
        status: statusFilter === 'ACTIVE' ? 'BOOKED,CONFIRMED,CHECKED_IN,IN_CONSULTATION' : undefined,
      },
    }).then(r => r.data),
    enabled: !!user,
  })

  const appointments = data?.data || []
  const visible = appointments.filter(a => {
    const haystack = `${a.patient?.first_name || ''} ${a.patient?.last_name || ''} ${a.patient?.uhid || ''}`.toLowerCase()
    return haystack.includes(search.toLowerCase())
  })
  const selected = visible.find(a => a.id === selectedId) || visible[0]
  const currentStatus = selected?.status === 'IN_CONSULTATION'
    ? 'ONGOING'
    : selected?.status === 'COMPLETED'
      ? 'COMPLETED'
      : selected?.status === 'CANCELLED'
        ? 'CANCELLED'
        : (selected?.telemedicine_session?.status || 'SCHEDULED')

  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ['telemedicine-patient', selected?.patient?.id],
    queryFn: () => api.get(`/patients/${selected.patient.id}`).then(r => r.data.data),
    enabled: !!selected?.patient?.id,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['telemedicine-workspace'] })
    qc.invalidateQueries({ queryKey: ['appointments'] })
    qc.invalidateQueries({ queryKey: ['emr', selected?.patient?.id] })
    qc.invalidateQueries({ queryKey: ['pharmacy-prescriptions'] })
  }

  const sessionMut = useMutation({
    mutationFn: () => api.post(`/appointments/${selected.id}/telemedicine`, sessionForm),
    onSuccess: () => { toast.success('Consultation room is ready'); setShowSessionModal(false); setSessionForm(emptySession); refresh() },
    onError: e => toast.error(e.response?.data?.message || 'Unable to configure consultation room'),
  })

  const statusMut = useMutation({
    mutationFn: status => api.patch(`/appointments/${selected.id}/telemedicine/status`, { status }),
    onSuccess: () => { toast.success('Telemedicine status updated'); refresh() },
    onError: e => toast.error(e.response?.data?.message || 'Unable to update consultation status'),
  })

  const completeMut = useMutation({
    mutationFn: () => api.post(`/appointments/${selected.id}/telemedicine/complete`, {
      subjective: note.subjective,
      objective: note.objective,
      assessment: note.assessment,
      plan: note.plan,
      notes: note.subjective,
      findings: note.objective,
      diagnosis: note.assessment,
      medicines,
      fulfillment_mode: fulfillmentMode,
      consultation_fee: 0,
      collect_payment: false,
    }),
    onSuccess: (response) => { const result = response.data?.data; setCompletedPrescription(result?.prescription || null); setCompletedPlan(note.plan); setStatusFilter('ALL'); toast.success('Consultation completed and saved to EMR'); setNote({ subjective: '', objective: '', assessment: '', plan: '' }); setMedicines([]); refresh() },
    onError: e => toast.error(e.response?.data?.message || 'Unable to complete consultation'),
  })

  const setSelected = (appointment) => {
    setSelectedId(appointment.id)
    setNote({ subjective: appointment.chief_complaint || '', objective: '', assessment: '', plan: '' })
    setMedicines([])
    setCompletedPrescription(null)
    setCompletedPlan('')
    setFulfillmentMode('HOSPITAL_PHARMACY')
  }

  const downloadPrescription = () => {
    if (!completedPrescription?.items?.length) return toast.error('No prescription was created for this consultation')
    const doc = new jsPDF()
    const patientName = `${selected.patient?.first_name || ''} ${selected.patient?.last_name || ''}`.trim()
    doc.setFontSize(18); doc.setTextColor(16, 71, 92); doc.text('TELEMEDICINE PRESCRIPTION', 14, 18)
    doc.setFontSize(9); doc.setTextColor(90, 90, 90); doc.text('Computer-generated prescription · Verify dosage and instructions with the prescribing doctor', 14, 25)
    doc.setDrawColor(16, 71, 92); doc.line(14, 29, 196, 29)
    doc.setFontSize(11); doc.setTextColor(30, 30, 30); doc.text(`Patient: ${patientName}`, 14, 40); doc.text(`UHID: ${selected.patient?.uhid || '—'}`, 14, 47)
    doc.text(`Doctor: Dr. ${selected.doctor?.first_name || ''} ${selected.doctor?.last_name || ''}`, 110, 40); doc.text(`Date: ${fmt.date(new Date())}`, 110, 47)
    autoTable(doc, { startY: 56, head: [['#', 'Medicine', 'Dose', 'Frequency', 'Duration', 'Instructions']], body: completedPrescription.items.map((item, index) => [index + 1, `${item.drug_name || ''}${item.strength ? ` ${item.strength}` : ''}`, item.dose || '—', item.frequency || '—', item.duration || '—', item.instructions || '—']), theme: 'grid', headStyles: { fillColor: [16, 71, 92] }, styles: { fontSize: 9, cellPadding: 3 } })
    const y = (doc.lastAutoTable?.finalY || 100) + 14
    doc.setFontSize(10); doc.text('Consultation plan:', 14, y); doc.setFontSize(9); const plan = doc.splitTextToSize(completedPlan || 'Follow the doctor\'s advice and attend the recommended follow-up.', 180); doc.text(plan, 14, y + 7)
    doc.setFontSize(8); doc.setTextColor(100, 100, 100); doc.text('This prescription was issued during a telemedicine consultation. Keep this document with your medical records.', 14, 285)
    doc.save(`telemedicine-prescription-${selected.patient?.uhid || 'patient'}.pdf`)
  }

  const totals = useMemo(() => ({
    scheduled: appointments.filter(a => (a.telemedicine_session?.status || 'SCHEDULED') === 'SCHEDULED').length,
    ongoing: appointments.filter(a => a.telemedicine_session?.status === 'ONGOING' || a.status === 'IN_CONSULTATION').length,
    ready: appointments.filter(a => !!a.telemedicine_session?.meeting_url).length,
  }), [appointments])

  return <div className="space-y-4 animate-fade-in">
    <div className="page-header">
      <div><div className="flex items-center gap-2"><Video className="text-cyan" size={22} /><h1 className="page-title">Telemedicine Command Center</h1></div><p className="page-sub">Secure remote consultations · clinical workspace · EMR-connected</p></div>
      <Link to="/appointments" className="btn-primary"><Plus size={15} /> Schedule Teleconsultation</Link>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="stat-card cyan"><CalendarClock size={18} className="text-cyan mb-2" /><div className="text-2xl font-bold text-white">{totals.scheduled}</div><div className="text-xs text-slate-400">Scheduled sessions</div></div>
      <div className="stat-card purple"><Activity size={18} className="text-purple-300 mb-2" /><div className="text-2xl font-bold text-white">{totals.ongoing}</div><div className="text-xs text-slate-400">Live consultations</div></div>
      <div className="stat-card green"><ShieldCheck size={18} className="text-green-300 mb-2" /><div className="text-2xl font-bold text-white">{totals.ready}</div><div className="text-xs text-slate-400">Rooms ready</div></div>
      <div className="stat-card amber"><ClipboardList size={18} className="text-amber-300 mb-2" /><div className="text-2xl font-bold text-white">{appointments.length}</div><div className="text-xs text-slate-400">Queue total</div></div>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-4 min-h-[620px]">
      <section className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-default"><SectionTitle icon={MonitorPlay} title="Consultation queue" hint="Live queue" /><div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-slate-400" /><input className="input pl-9" placeholder="Search patient or UHID" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="flex gap-1 mt-3"><button className={`btn text-xs flex-1 ${statusFilter === 'ACTIVE' ? 'bg-cyan/15 text-cyan border-cyan/30' : ''}`} onClick={() => setStatusFilter('ACTIVE')}>Active</button><button className={`btn text-xs flex-1 ${statusFilter === 'ALL' ? 'bg-cyan/15 text-cyan border-cyan/30' : ''}`} onClick={() => setStatusFilter('ALL')}>All</button></div></div>
        {isLoading ? <div className="py-12 flex justify-center"><Spinner /></div> : visible.length === 0 ? <EmptyState icon="video" title="No teleconsultations" description="Schedule a Teleconsultation appointment to populate this queue." action={<Link to="/appointments" className="btn-primary mt-2">Schedule one</Link>} /> : <div className="divide-y divide-default max-h-[560px] overflow-y-auto">{visible.map(a => {
          const s = a.status === 'IN_CONSULTATION' ? 'ONGOING' : a.status === 'COMPLETED' ? 'COMPLETED' : a.status === 'CANCELLED' ? 'CANCELLED' : (a.telemedicine_session?.status || 'SCHEDULED')
          return <button key={a.id} onClick={() => setSelected(a)} className={`w-full text-left p-4 hover:bg-white/5 transition ${selected?.id === a.id ? 'bg-cyan/10 border-l-2 border-cyan' : ''}`}><div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2"><div className="avatar-sm"><UserRound size={15} /></div><div><div className="text-sm font-semibold text-white">{a.patient?.first_name} {a.patient?.last_name}</div><div className="text-[11px] text-slate-400">{a.patient?.uhid} · {a.slot_time || 'Scheduled'}</div></div></div><Badge status={s} /></div><div className="mt-3 flex items-center justify-between text-[11px]"><span className="text-slate-400">{fmt.date(a.appointment_date)}</span><span className={a.telemedicine_session ? 'text-green-300' : 'text-amber-300'}>{a.telemedicine_session ? 'Room ready' : 'Room setup needed'}</span></div></button>
        })}</div>}
      </section>

      {!selected ? <div className="card flex items-center justify-center"><EmptyState icon="video" title="Select a consultation" description="Choose a patient from the queue to open the clinical workspace." /></div> : <main className="space-y-4">
        <section className="card bg-gradient-to-r from-cyan/10 via-navy-800 to-purple-500/10 border-cyan/20"><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="h-12 w-12 rounded-2xl bg-cyan/15 flex items-center justify-center text-cyan"><Stethoscope size={24} /></div><div><div className="text-lg font-bold text-white">{selected.patient?.first_name} {selected.patient?.last_name}</div><div className="text-xs text-slate-400">{selected.patient?.uhid} · Dr. {selected.doctor?.first_name} {selected.doctor?.last_name} · {timeUntil(selected.appointment_date)}</div></div></div><div className="flex items-center gap-2 flex-wrap"><Badge status={currentStatus} />{selected.telemedicine_session?.mode && <Badge status={selected.telemedicine_session.mode} label={selected.telemedicine_session.mode === 'VIDEO' ? 'Video consultation' : 'Audio consultation'} />}</div></div></section>

        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-4">
          <section className="card bg-[#ffffff]"><SectionTitle icon={Video} title="Consultation room" hint="Provider-neutral · hospital controlled" />{selected.telemedicine_session?.meeting_url ? <div className="rounded-xl border border-cyan/30 bg-[#f3fbfc] p-4"><div className="flex items-center gap-3"><div className="h-11 w-11 rounded-xl bg-cyan/15 text-cyan flex items-center justify-center">{selected.telemedicine_session.mode === 'AUDIO' ? <PhoneCall size={22} /> : <Video size={22} />}</div><div className="flex-1 min-w-0"><div className="text-sm font-semibold text-[#24121e]">{selected.telemedicine_session.mode === 'AUDIO' ? 'Audio consultation room' : 'Video consultation room'}</div><div className="text-xs text-[#5b4050] truncate">{selected.telemedicine_session.meeting_url}</div></div><a href={selected.telemedicine_session.meeting_url} target="_blank" rel="noreferrer" className="btn-primary shrink-0">{selected.telemedicine_session.mode === 'AUDIO' ? <PhoneCall size={15} /> : <Video size={15} />} Join</a></div><div className="mt-4 flex flex-wrap gap-2">{currentStatus === 'SCHEDULED' && <button className="btn-primary" onClick={() => statusMut.mutate('ONGOING')}><MonitorPlay size={15} /> Start consultation</button>}{currentStatus === 'ONGOING' && <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#15803d]"><span className="h-2 w-2 rounded-full bg-[#16a34a] animate-pulse" /> Consultation in progress</span>}<button className="btn" onClick={() => { setSessionForm({ mode: selected.telemedicine_session.mode, provider: selected.telemedicine_session.provider, meeting_url: selected.telemedicine_session.meeting_url }); setShowSessionModal(true) }}><Link2 size={15} /> Change room</button></div></div> : <div className="rounded-xl border border-dashed border-amber-400/40 bg-amber-400/5 p-5"><div className="flex gap-3"><Link2 className="text-amber-300 shrink-0" size={20} /><div><div className="text-sm font-semibold text-[#24121e]">Consultation room is not configured</div><p className="text-xs text-[#5b4050] mt-1">Add an approved hospital-hosted or external HTTPS link. This system does not create paid calling accounts.</p><button className="btn-primary mt-3" onClick={() => setShowSessionModal(true)}><Link2 size={15} /> Configure room</button></div></div></div>}</section>

          <section className="card"><SectionTitle icon={UserRound} title="Patient snapshot" hint={patientLoading ? 'Loading…' : ''}/>{patient ? <div className="space-y-3 text-xs"><div className="grid grid-cols-2 gap-2"><div className="rounded-lg bg-white/5 p-3"><div className="text-slate-400">Gender</div><div className="text-white mt-1">{patient.gender || '—'}</div></div><div className="rounded-lg bg-white/5 p-3"><div className="text-slate-400">Phone</div><div className="text-white mt-1">{patient.phone || '—'}</div></div></div><div className="rounded-lg bg-white/5 p-3"><div className="text-slate-400">Chief complaint</div><div className="text-white mt-1">{selected.chief_complaint || 'Not provided'}</div></div><div className="flex gap-2"><Link className="btn flex-1 justify-center" to={`/patients/${selected.patient.id}`}>Patient profile</Link><Link className="btn flex-1 justify-center" to={`/emr/${selected.patient.id}`}>Open EMR</Link></div></div> : <Spinner size="sm" />}</section>
        </div>

        <section className="card"><SectionTitle icon={FileText} title="Clinical consultation record" hint="Saved to patient EMR on completion"/><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><label className="label">Patient story / subjective<textarea className="textarea min-h-24 mt-1" value={note.subjective} onChange={e => setNote({ ...note, subjective: e.target.value })} placeholder="Symptoms, duration, patient-reported history…" /></label><label className="label">Remote observations / objective<textarea className="textarea min-h-24 mt-1" value={note.objective} onChange={e => setNote({ ...note, objective: e.target.value })} placeholder="Visible findings, reported vitals, examination limitations…" /></label><label className="label">Assessment / diagnosis<textarea className="textarea min-h-24 mt-1" value={note.assessment} onChange={e => setNote({ ...note, assessment: e.target.value })} placeholder="Clinical impression and differential…" /></label><label className="label">Care plan / follow-up<textarea className="textarea min-h-24 mt-1" value={note.plan} onChange={e => setNote({ ...note, plan: e.target.value })} placeholder="Advice, follow-up, escalation or referral…" /></label></div></section>

        <section className="card"><SectionTitle icon={ClipboardList} title="Prescription fulfilment" hint="Choose how the patient receives medicines"/><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><button type="button" className={`text-left rounded-xl border p-4 transition ${fulfillmentMode === 'PRESCRIPTION_ONLY' ? 'border-cyan bg-cyan/10' : 'border-default bg-white/5'}`} onClick={() => setFulfillmentMode('PRESCRIPTION_ONLY')}><div className="font-semibold text-white">Prescription only</div><div className="text-xs text-slate-400 mt-1">Create a signed-style PDF the patient can download, print, or send to a local pharmacy. Nothing enters the hospital pharmacy queue.</div></button><button type="button" className={`text-left rounded-xl border p-4 transition ${fulfillmentMode === 'HOSPITAL_PHARMACY' ? 'border-cyan bg-cyan/10' : 'border-default bg-white/5'}`} onClick={() => setFulfillmentMode('HOSPITAL_PHARMACY')}><div className="font-semibold text-white">Hospital pharmacy</div><div className="text-xs text-slate-400 mt-1">Use hospital inventory suggestions and send the prescription to the existing pharmacy dispensing workflow.</div></button></div><div className="flex items-center justify-between gap-3 mt-4"><div className="text-xs text-slate-400">{fulfillmentMode === 'PRESCRIPTION_ONLY' ? 'Remote patient: issue a downloadable prescription.' : 'Hospital fulfilment: medicines must be selected from inventory.'}</div><button className="btn" onClick={() => setShowPrescription(!showPrescription)}>{showPrescription ? 'Hide medicines' : 'Add medicine'}</button></div>{showPrescription && <div className="space-y-3 mt-3">{medicines.map((m, i) => <TelemedicineMedicineRow key={i} item={m} index={i} inventoryMode={fulfillmentMode === 'HOSPITAL_PHARMACY'} onChange={(updates) => setMedicines(medicines.map((x, j) => j === i ? { ...x, ...updates } : x))} />)}<button className="btn w-full" onClick={() => setMedicines([...medicines, { ...emptyMedicine }])}><Plus size={15} /> Add medicine</button><p className="text-[11px] text-slate-400">{fulfillmentMode === 'HOSPITAL_PHARMACY' ? 'Suggestions come only from this hospital\'s current pharmacy inventory.' : 'Enter the prescribed medicine manually; no inventory link is required.'}</p></div>}{completedPrescription?.items?.length > 0 && <div className="mt-4 rounded-lg border border-green-400/30 bg-green-400/10 p-3 flex flex-wrap items-center justify-between gap-2"><div className="text-sm text-green-200">Prescription saved for the patient.</div><button className="btn-primary" onClick={downloadPrescription}>Download prescription PDF</button></div>}</section>

        <div className="flex flex-wrap justify-between gap-2"><div className="flex gap-2">{currentStatus !== 'CANCELLED' && currentStatus !== 'COMPLETED' && <button className="btn text-brand-red" onClick={() => statusMut.mutate('CANCELLED')}><XCircle size={15} /> Cancel session</button>}</div><div className="flex gap-2">{currentStatus === 'ONGOING' && <button className="btn-primary" disabled={completeMut.isPending} onClick={() => completeMut.mutate()}><CheckCircle2 size={15} /> {completeMut.isPending ? 'Saving…' : 'Complete & save consultation'}</button>}{currentStatus === 'SCHEDULED' && <button className="btn" onClick={() => document.querySelector('textarea')?.focus()}><ClipboardList size={15} /> Prepare notes</button>}</div></div>
      </main>}
    </div>

    <Modal open={showSessionModal} onClose={() => setShowSessionModal(false)} title="Configure consultation room" size="md"><div className="space-y-4"><div className="rounded-lg bg-cyan/10 border border-cyan/20 p-3 text-xs text-slate-300"><ShieldCheck size={15} className="inline text-cyan mr-1" /> Use an approved HTTPS room from your self-hosted Jitsi/BigBlueButton deployment or another hospital-approved provider.</div><div className="grid grid-cols-2 gap-3"><div><label className="label">Mode</label><select className="select" value={sessionForm.mode} onChange={e => setSessionForm({ ...sessionForm, mode: e.target.value })}><option value="VIDEO">Video Call</option><option value="AUDIO">Audio Call</option></select></div><div><label className="label">Provider</label><select className="select" value={sessionForm.provider} onChange={e => setSessionForm({ ...sessionForm, provider: e.target.value })}><option value="EXTERNAL_LINK">External link</option><option value="SELF_HOSTED">Self-hosted</option><option value="CUSTOM">Custom provider</option></select></div></div><div><label className="label">Room URL</label><input className="input" placeholder="https://hospital.example/room/…" value={sessionForm.meeting_url} onChange={e => setSessionForm({ ...sessionForm, meeting_url: e.target.value })} /></div><div className="flex justify-end gap-2"><button className="btn" onClick={() => setShowSessionModal(false)}>Cancel</button><button className="btn-primary" disabled={sessionMut.isPending || !sessionForm.meeting_url} onClick={() => sessionMut.mutate()}><Send size={15} /> Save room</button></div></div></Modal>
  </div>
}

function TelemedicineMedicineRow({ item, index, inventoryMode, onChange }) {
  const query = String(item.drug_name || '').trim()
  const { data, isFetching } = useQuery({
    queryKey: ['telemedicine-pharmacy-suggestions', query],
    queryFn: () => api.get('/pharmacy/medicine-suggestions', { params: { search: query } }).then(r => r.data.data),
    enabled: inventoryMode && query.length >= 2,
    staleTime: 30000,
  })
  const suggestions = data || []
  return <div className="grid grid-cols-1 md:grid-cols-12 gap-2 rounded-lg border border-default p-3">
    <div className="relative md:col-span-4"><input className="input" placeholder={inventoryMode ? 'Search hospital inventory' : 'Medicine name'} value={item.drug_name || ''} onChange={e => onChange({ drug_name: e.target.value, item_id: inventoryMode ? '' : undefined })} />{inventoryMode && query.length >= 2 && <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-default bg-navy-700 shadow-xl">{isFetching && <div className="p-2 text-xs text-slate-400">Searching hospital inventory…</div>}{!isFetching && suggestions.length === 0 && <div className="p-2 text-xs text-slate-400">No matching in hospital pharmacy</div>}{suggestions.map(stock => <button type="button" key={stock.id} className="block w-full p-2 text-left hover:bg-navy-600" onMouseDown={() => onChange({ item_id: stock.id, drug_name: stock.brand_name || stock.generic_name, generic_name: stock.generic_name, strength: stock.strength, form: stock.form, unit: stock.unit, pack_unit: stock.pack_unit })}><div className="text-xs text-white">{stock.brand_name || stock.generic_name}{stock.strength ? ` ${stock.strength}` : ''}</div><div className="text-[10px] text-slate-400">{stock.form || 'Medicine'} · Available: {stock.current_stock ?? 0}</div></button>)}</div>}</div>
    <input className="input md:col-span-2" placeholder="Dose" value={item.dose || ''} onChange={e => onChange({ dose: e.target.value })} />
    <select className="select md:col-span-2" value={item.frequency || 'BD'} onChange={e => onChange({ frequency: e.target.value })}>{['OD','BD','TDS','QID','SOS','STAT'].map(x => <option key={x}>{x}</option>)}</select>
    <input className="input md:col-span-2" placeholder="Duration" value={item.duration || ''} onChange={e => onChange({ duration: e.target.value })} />
    <input className="input md:col-span-2" placeholder="Instructions" value={item.instructions || ''} onChange={e => onChange({ instructions: e.target.value })} />
    {inventoryMode && <div className="md:col-span-12 text-[11px] text-cyan">{item.item_id ? `Linked to hospital inventory: ${item.generic_name || item.drug_name}` : 'Select a medicine from the hospital inventory suggestions.'}</div>}
  </div>
}
