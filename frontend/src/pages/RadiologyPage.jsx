// src/pages/RadiologyPage.jsx
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Activity, Brain, Camera, CheckCircle2, ClipboardEdit, Download, Eye, FileText, FileUp, HeartPulse, Image, MonitorUp, Plus, Radio, ScanLine, ShieldAlert, Zap } from 'lucide-react'
import api from '../utils/api'
import Modal from '../components/common/Modal'
import StatCard, { Badge, Spinner } from '../components/common/StatCard'
import { fmt } from '../utils/helpers'

const MODALITIES = [
  { key: 'XRAY', label: 'X-Ray', Icon: Image },
  { key: 'USG', label: 'USG', Icon: Radio },
  { key: 'CT', label: 'CT', Icon: ScanLine },
  { key: 'MRI', label: 'MRI', Icon: Brain },
  { key: 'ECHO', label: 'Echo', Icon: HeartPulse },
  { key: 'ECG', label: 'ECG', Icon: Activity },
  { key: 'MAMMOGRAPHY', label: 'Mammo', Icon: Camera },
  { key: 'FLUOROSCOPY', label: 'Fluoro', Icon: MonitorUp },
  { key: 'PET_CT', label: 'PET CT', Icon: Eye },
]

const STATUS_FLOW = ['ORDERED', 'SCHEDULED', 'IN_PROGRESS', 'PERFORMED', 'REPORTED', 'REVIEWED']

export default function RadiologyPage() {
  const [showModal, setShowModal] = useState(false)
  const [reportOrder, setReportOrder] = useState(null)
  const [modality, setModality] = useState('ALL')
  const [studyFiles, setStudyFiles] = useState([])
  const qc = useQueryClient()
  const form = useForm({ defaultValues: { modality: 'XRAY', priority: 'NORMAL', contrast_required: false, is_stat: false } })
  const reportForm = useForm()

  const params = modality === 'ALL' ? {} : { modality }
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['radiology-orders', params],
    queryFn: () => api.get('/radiology/orders', { params }).then(r => r.data.data),
    refetchInterval: 20000,
  })
  const { data: stats = {} } = useQuery({
    queryKey: ['radiology-stats'],
    queryFn: () => api.get('/radiology/stats').then(r => r.data.data),
    refetchInterval: 20000,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['radiology-orders'] })
    qc.invalidateQueries({ queryKey: ['radiology-stats'] })
  }

  const orderMut = useMutation({
    mutationFn: (payload) => api.post('/radiology/orders', payload),
    onSuccess: () => { toast.success('Radiology order created'); invalidate(); setShowModal(false); form.reset({ modality: 'XRAY', priority: 'NORMAL', contrast_required: false, is_stat: false }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to create order'),
  })
  const statusMut = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/radiology/orders/${id}/status`, { status }),
    onSuccess: () => { toast.success('Imaging workflow updated'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message || 'Update failed'),
  })
  const reportMut = useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/radiology/orders/${id}/report`, payload),
    onSuccess: () => { toast.success('Radiology report saved'); invalidate(); setReportOrder(null); reportForm.reset() },
    onError: (e) => toast.error(e.response?.data?.message || 'Report failed'),
  })

  const modalityCounts = useMemo(() => {
    const counts = {}
    orders.forEach(o => { counts[o.modality] = (counts[o.modality] || 0) + 1 })
    return counts
  }, [orders])
  const statCount = orders.filter(o => o.is_stat).length

  const nextStatus = (status) => {
    const index = STATUS_FLOW.indexOf(status)
    return STATUS_FLOW[Math.min(index + 1, STATUS_FLOW.length - 1)]
  }

  const openReport = (order) => {
    setReportOrder(order)
    setStudyFiles(order.images_path || [])
    reportForm.reset({
      report: order.report || defaultReport(order),
      impression: order.impression || '',
    })
  }

  const printReport = () => {
    toast.success('Opening print dialog')
    setTimeout(() => window.print(), 50)
  }

  const uploadStudyFile = (file) => {
    if (!file) return
    if (file.size > 4 * 1024 * 1024) return toast.error('Use a file under 4 MB')
    const reader = new FileReader()
    reader.onload = () => {
      setStudyFiles(prev => [...prev, String(reader.result)])
      toast.success('Study file attached')
    }
    reader.onerror = () => toast.error('Could not read file')
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><ScanLine size={20} /> Radiology Intelligence Suite</h1>
          <p className="page-sub">Imaging worklist, modality load, contrast safety, and structured reporting</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> New imaging order</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard icon={<ScanLine size={22} />} value={stats.active || orders.length} label="Active studies" color="cyan" />
        <StatCard icon={<Zap size={22} />} value={stats.stat || statCount} label="STAT imaging" color="red" />
        <StatCard icon={<MonitorUp size={22} />} value={stats.scheduled || 0} label="Scheduled" color="blue" />
        <StatCard icon={<ClipboardEdit size={22} />} value={stats.performed || 0} label="For reporting" color="amber" />
        <StatCard icon={<FileText size={22} />} value={stats.reportedToday || 0} label="Reported today" color="green" />
        <StatCard icon={<ShieldAlert size={22} />} value={stats.contrast || 0} label="Contrast watch" color="purple" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-4">
        <div className="card">
          <div className="text-sm font-bold mb-3">Modality Command</div>
          <div className="grid grid-cols-2 xl:grid-cols-1 gap-2">
            <button className={`btn justify-between ${modality === 'ALL' ? 'border-brand-pink text-brand-pink' : ''}`} onClick={() => setModality('ALL')}><span>All studies</span><span className="badge badge-gray">{orders.length}</span></button>
            {MODALITIES.map(({ key, label, Icon }) => (
              <button key={key} className={`btn justify-between ${modality === key ? 'border-brand-pink text-brand-pink' : ''}`} onClick={() => setModality(key)}>
                <span className="inline-flex items-center gap-2"><Icon size={15} /> {label}</span>
                <span className="badge badge-gray">{modalityCounts[key] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-4 border-b border-default">
            <div><div className="text-sm font-bold">PACS Worklist</div><div className="text-xs text-slate-400">Protocol, perform, report, and review imaging studies</div></div>
            <div className="flex gap-1 flex-wrap justify-end">{STATUS_FLOW.slice(0, 5).map(s => <span key={s} className="badge badge-gray">{s}: {orders.filter(o => o.status === s).length}</span>)}</div>
          </div>
          {isLoading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Study</th><th>Patient</th><th>Modality</th><th>Protocol</th><th>Priority</th><th>Status</th><th>Schedule</th><th>Actions</th></tr></thead>
                <tbody>
                  {orders.map(o => {
                    const next = nextStatus(o.status)
                    return (
                      <tr key={o.id}>
                        <td className="font-mono text-xs text-cyan">{o.study_no}</td>
                        <td><div className="text-xs font-medium text-white">{o.patient?.first_name} {o.patient?.last_name}</div><div className="text-[10px] text-slate-400">{o.patient?.uhid}</div></td>
                        <td><span className="badge badge-blue">{o.modality}</span></td>
                        <td className="text-xs max-w-[200px]"><div className="font-medium">{o.body_part}</div><div className="text-[10px] text-slate-400 line-clamp-2">{o.clinical_info || 'No clinical info'}</div></td>
                        <td>{o.is_stat || o.priority === 'EMERGENCY' ? <span className="badge badge-red">STAT</span> : o.priority === 'URGENT' ? <span className="badge badge-amber">Urgent</span> : <span className="badge badge-gray">Routine</span>} {o.contrast_required && <span className="badge badge-purple ml-1">Contrast</span>}</td>
                        <td><Badge status={o.status} /></td>
                        <td className="text-xs text-slate-400">{o.scheduled_at ? fmt.datetime(o.scheduled_at) : fmt.ago(o.created_at)}</td>
                        <td>
                          <div className="flex gap-1 flex-wrap">
                            {!['REPORTED', 'REVIEWED'].includes(o.status) && <button className="btn text-[10px] px-2 py-1" onClick={() => statusMut.mutate({ id: o.id, status: next })}>Move to {next.replace('_', ' ')}</button>}
                            {['PERFORMED', 'IN_PROGRESS', 'REPORTED'].includes(o.status) && <button className="btn text-[10px] px-2 py-1" onClick={() => openReport(o)}>Report</button>}
                            {o.status === 'REPORTED' && <button className="btn text-[10px] px-2 py-1 text-brand-green" onClick={() => statusMut.mutate({ id: o.id, status: 'REVIEWED' })}>Review</button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {orders.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-slate-400">No radiology orders found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          ['AI protocol assist', 'Flags STAT, contrast, modality, and body-part combinations for faster routing.'],
          ['Contrast safety', 'Highlights active contrast studies so renal checks and consent are not missed.'],
          ['Structured reporting', 'Captures findings and impression directly into the study workflow.'],
        ].map(([title, desc]) => (
          <div key={title} className="card-sm flex gap-3">
            <CheckCircle2 size={18} className="text-brand-green mt-0.5" />
            <div><div className="text-sm font-bold">{title}</div><div className="text-xs text-slate-400">{desc}</div></div>
          </div>
        ))}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Radiology Order" size="lg">
        <form onSubmit={form.handleSubmit(d => orderMut.mutate({ ...d, contrast_required: !!d.contrast_required, is_stat: !!d.is_stat }))} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">Patient UHID *</label><input className="input" placeholder="Use exact registered UHID" {...form.register('patient_id', { required: true })} /></div>
            <div><label className="label">Modality</label><select className="select" {...form.register('modality')}>{MODALITIES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}</select></div>
            <div><label className="label">Body part / protocol *</label><input className="input" placeholder="CT brain plain, CXR PA view..." {...form.register('body_part', { required: true })} /></div>
            <div><label className="label">Priority</label><select className="select" {...form.register('priority')}>{['NORMAL','URGENT','EMERGENCY'].map(p => <option key={p}>{p}</option>)}</select></div>
            <div><label className="label">Scheduled at</label><input type="datetime-local" className="input" {...form.register('scheduled_at')} /></div>
          </div>
          <div><label className="label">Clinical info</label><textarea className="textarea" rows={3} placeholder="Indication, relevant history, provisional diagnosis" {...form.register('clinical_info')} /></div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" {...form.register('contrast_required')} /> Contrast required</label>
            <label className="flex items-center gap-2"><input type="checkbox" {...form.register('is_stat')} /> STAT</label>
          </div>
            <div className="flex gap-2"><button className="btn-primary flex-1" disabled={orderMut.isPending}>{orderMut.isPending ? 'Saving...' : 'Create order'}</button><button type="button" className="btn flex-1" onClick={() => setShowModal(false)}>Cancel</button></div>
        </form>
      </Modal>

      <Modal open={!!reportOrder} onClose={() => setReportOrder(null)} title="Structured Radiology Report" size="xl">
        {reportOrder && (
          <form onSubmit={reportForm.handleSubmit(d => reportMut.mutate({ id: reportOrder.id, payload: { ...d, images_path: studyFiles } }))} className="space-y-4">
            <div className="card-sm">
              <div className="text-sm font-bold">{reportOrder.study_no} - {reportOrder.modality} {reportOrder.body_part}</div>
              <div className="text-xs text-slate-400">{reportOrder.patient?.first_name} {reportOrder.patient?.last_name} - {reportOrder.patient?.uhid}</div>
            </div>
            <div><label className="label">Findings</label><textarea className="textarea min-h-[180px]" {...reportForm.register('report', { required: true })} /></div>
            <div><label className="label">Impression</label><textarea className="textarea min-h-[90px]" placeholder="Concise diagnostic impression" {...reportForm.register('impression', { required: true })} /></div>
            <div className="card-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-sm font-bold">Study attachments</div>
                  <div className="text-xs text-slate-400">{studyFiles.length ? `${studyFiles.length} file(s) attached` : 'Attach image/PDF from modality or PACS'}</div>
                </div>
                <label className="btn cursor-pointer"><FileUp size={14} /> Upload<input type="file" accept=".pdf,image/*" className="hidden" onChange={e => uploadStudyFile(e.target.files?.[0])} /></label>
              </div>
              <div className="flex gap-2 flex-wrap">
                {studyFiles.map((src, index) => (
                  <a key={`${src.slice(0, 32)}-${index}`} className="btn text-xs" href={src} download={`${reportOrder.study_no}-file-${index + 1}`}><Download size={13} /> File {index + 1}</a>
                ))}
                {!studyFiles.length && <span className="text-xs text-slate-400">No files uploaded yet</span>}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button className="btn-primary flex-1" disabled={reportMut.isPending}>{reportMut.isPending ? 'Saving...' : 'Save report'}</button>
              {reportOrder.status === 'REPORTED' && <button type="button" className="btn flex-1 text-brand-green" disabled={statusMut.isPending} onClick={() => statusMut.mutate({ id: reportOrder.id, status: 'REVIEWED' }, { onSuccess: () => setReportOrder(prev => prev ? { ...prev, status: 'REVIEWED' } : prev) })}>Mark reviewed</button>}
              {['REPORTED', 'REVIEWED'].includes(reportOrder.status) && <button type="button" className="btn flex-1" onClick={printReport}>Print</button>}
              <button type="button" className="btn flex-1" onClick={() => setReportOrder(null)}>Cancel</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

function defaultReport(order) {
  const contrast = order.contrast_required ? 'Contrast-enhanced study performed as per protocol.' : 'Non-contrast study performed as requested.'
  return `Study: ${order.modality} ${order.body_part}\nTechnique: ${contrast}\nFindings:\n\n`
}
