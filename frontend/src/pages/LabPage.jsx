import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
// 👉 jsPDF Imports
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Activity, AlertTriangle, BadgeIndianRupee, Beaker, CheckCircle2, ClipboardCheck, Download, FileUp, Microscope, Plus, Printer, ReceiptIndianRupee, TestTubes, Timer, Zap } from 'lucide-react'
import api from '../utils/api'
import Modal from '../components/common/Modal'
import StatCard, { Badge, Spinner } from '../components/common/StatCard'
import { fmt } from '../utils/helpers'

const COMMON_TESTS = [
  { name: 'Complete Blood Count', code: 'CBC', category: 'Hematology', unit: '', ref_range: '' },
  { name: 'Liver Function Test', code: 'LFT', category: 'Biochemistry', unit: '', ref_range: '' },
  { name: 'Renal Function Test', code: 'RFT', category: 'Biochemistry', unit: '', ref_range: '' },
  { name: 'Electrolytes', code: 'ELEC', category: 'Biochemistry', unit: 'mmol/L', ref_range: '' },
  { name: 'Troponin I', code: 'TROPI', category: 'Cardiac Markers', unit: 'ng/L', ref_range: '< 14' },
  { name: 'HbA1c', code: 'HBA1C', category: 'Biochemistry', unit: '%', ref_range: '4.0 - 5.6' },
  { name: 'Blood Glucose - Fasting', code: 'FBS', category: 'Biochemistry', unit: 'mg/dL', ref_range: '70 - 100' },
  { name: 'Lipid Profile', code: 'LIPID', category: 'Biochemistry', unit: '', ref_range: '' },
  { name: 'PT/INR', code: 'PTINR', category: 'Coagulation', unit: 'INR', ref_range: '0.8 - 1.2' },
  { name: 'ABG', code: 'ABG', category: 'Blood Gas', unit: '', ref_range: '' },
  { name: 'Urine Routine', code: 'URINE', category: 'Urinalysis', unit: '', ref_range: '' },
  { name: 'Blood Culture', code: 'BCULT', category: 'Microbiology', unit: '', ref_range: 'No growth' },
]

const TABS = [
  { key: 'queue', label: 'All live', params: {} },
  { key: 'stat', label: 'STAT', params: { is_stat: true } },
  { key: 'processing', label: 'Processing', params: { status: 'PROCESSING' } },
  { key: 'resulted', label: 'Resulted', params: { status: 'RESULTED' } },
  { key: 'completed', label: 'Completed', params: { status: 'VERIFIED' } },
  { key: 'charges', label: 'Charges', params: {} },
]

const LAB_ATTACHMENTS_KEY = 'medicore_lab_report_attachments'

export default function LabPage() {
  const [tab, setTab] = useState('queue')
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [selectedTests, setSelectedTests] = useState([])
  const [resultOrder, setResultOrder] = useState(null)
  
  // 👉 PDF Preview States
  const [reportOrder, setReportOrder] = useState(null)
  const [reportPdfUrl, setReportPdfUrl] = useState(null)
  
  const [billOrder, setBillOrder] = useState(null)
  const [billPdfUrl, setBillPdfUrl] = useState(null)

  const [showTestModal, setShowTestModal] = useState(false)
  const [editingTest, setEditingTest] = useState(null)
  const [attachments, setAttachments] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LAB_ATTACHMENTS_KEY) || '{}') } catch { return {} }
  })
  
  const qc = useQueryClient()
  useEffect(() => {
    const socket = io({ auth: { token: localStorage.getItem('token') } })
    socket.emit('join:lab')
    socket.on('lab:updated', () => {
      qc.invalidateQueries({ queryKey: ['lab-orders'] })
      qc.invalidateQueries({ queryKey: ['lab-stats'] })
    })
    return () => socket.disconnect()
  }, [qc])

  const { register, handleSubmit, reset, setValue } = useForm({ defaultValues: { sample_type: 'Blood', is_stat: 'false' } })
  const resultForm = useForm()
  const testForm = useForm({ defaultValues: { category: 'Biochemistry', sample_type: 'Blood', price: 0, is_active: true } })
  const billForm = useForm({ defaultValues: { collect_payment: true, payment_mode: 'CASH', payment_reference: '' } })
  
  const [patientQuery, setPatientQuery] = useState('')
  const [patientSuggestions, setPatientSuggestions] = useState([])
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false)

  useEffect(() => {
    const fetchPatients = async () => {
      if (patientQuery.length < 2) {
        setPatientSuggestions([])
        return
      }
      try {
        const res = await api.get('/patients', { params: { search: patientQuery, limit: 5 } })
        setPatientSuggestions(res.data.data || [])
      } catch (err) {
        console.error('Failed to fetch patients', err)
      }
    }
    const delay = setTimeout(fetchPatients, 300)
    return () => clearTimeout(delay)
  }, [patientQuery])

  const activeTab = TABS.find(t => t.key === tab) || TABS[0]
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['lab-orders', activeTab.params],
    queryFn: () => api.get('/lab/orders', { params: activeTab.params }).then(r => r.data),
    refetchInterval: 20000,
  })
  const { data: stats = {} } = useQuery({
    queryKey: ['lab-stats'],
    queryFn: () => api.get('/lab/stats').then(r => r.data.data),
    refetchInterval: 20000,
  })
  const { data: labTests = [] } = useQuery({
    queryKey: ['lab-tests'],
    queryFn: () => api.get('/lab/tests').then(r => r.data.data),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['lab-orders'] })
    qc.invalidateQueries({ queryKey: ['lab-stats'] })
  }

  const orderMut = useMutation({
    mutationFn: (d) => api.post('/lab/orders', d),
    onSuccess: () => { toast.success('Lab order created'); invalidate(); setShowOrderModal(false); reset(); setSelectedTests([]) },
    onError: (e) => toast.error(e.response?.data?.message || 'Order failed'),
  })
  const seedTestsMut = useMutation({
    mutationFn: () => api.post('/lab/tests/defaults'),
    onSuccess: () => { toast.success('Default lab tests added'); qc.invalidateQueries({ queryKey: ['lab-tests'] }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not add defaults'),
  })
  const saveTestMut = useMutation({
    mutationFn: (d) => editingTest ? api.put(`/lab/tests/${editingTest.id}`, d) : api.post('/lab/tests', d),
    onSuccess: () => { toast.success('Lab test saved'); qc.invalidateQueries({ queryKey: ['lab-tests'] }); setShowTestModal(false); setEditingTest(null); testForm.reset({ category: 'Biochemistry', sample_type: 'Blood', price: 0, is_active: true }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not save test'),
  })
  const billMut = useMutation({
    mutationFn: ({ id, ...body }) => api.post(`/lab/orders/${id}/bill`, body).then(r => r.data.data),
    onSuccess: (data) => { toast.success('Lab bill ready'); invalidate(); setBillOrder(data.order || { ...billOrder, bill: data.bill }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not generate bill'),
  })
  const statusMut = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/lab/orders/${id}/status`, { status }),
    onSuccess: () => { toast.success('Lab workflow updated'); invalidate() },
    onError: (e) => toast.error(e.response?.data?.message || 'Update failed'),
  })
  const verifyMut = useMutation({
    mutationFn: (id) => api.patch(`/lab/orders/${id}/verify`),
    onSuccess: () => { toast.success('Results verified'); invalidate() },
  })
  const resultMut = useMutation({
    mutationFn: ({ id, results }) => api.patch(`/lab/orders/${id}/results`, { results }),
    onSuccess: (r) => { toast.success(r.data?.message || 'Results saved'); invalidate(); setResultOrder(null); resultForm.reset() },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not save results'),
  })

  const orders = ordersData?.data || []
  const activeLabTests = labTests.filter(t => t.is_active)
  useEffect(() => {
    localStorage.setItem(LAB_ATTACHMENTS_KEY, JSON.stringify(attachments))
  }, [attachments])
  
  const analyzerLoad = useMemo(() => {
    const live = orders.filter(o => !['VERIFIED', 'REPORTED', 'REJECTED'].includes(o.status)).length
    return Math.min(100, Math.round((live / 30) * 100))
  }, [orders])

  // 👉 PDF Generator: Lab Bill
  const generateLabBillPDF = (order) => {
    const doc = new jsPDF()
    const bill = order.bill
    const safeCurrency = (val) => fmt.currency(val).replace(/₹/g, 'Rs. ')

    doc.setFontSize(22)
    doc.setTextColor(14, 165, 233)
    doc.setFont(undefined, 'bold')
    doc.text('Dr.AiSolnex Hospital', 14, 22)
    doc.setFontSize(10)
    doc.setTextColor(80)
    doc.setFont(undefined, 'normal')
    doc.text(`Bill No: ${bill.bill_no}`, 14, 30)
    doc.text(`Date: ${new Date(bill.created_at).toLocaleString()}`, 14, 35)

    doc.setDrawColor(200)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(14, 42, 85, 25, 3, 3, 'FD')
    doc.roundedRect(110, 42, 85, 25, 3, 3, 'FD')

    doc.setFontSize(11)
    doc.setTextColor(0)
    doc.setFont(undefined, 'bold')
    doc.text('Patient Details:', 18, 49)
    doc.text('Lab Order Details:', 114, 49)

    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(60)
    doc.text(`Name: ${order.patient?.first_name || ''} ${order.patient?.last_name || ''}`, 18, 56)
    doc.text(`UHID: ${order.patient?.uhid || '-'}`, 18, 62)
    doc.text(`Order No: ${order.order_no}`, 114, 56)
    doc.text(`Status: ${bill.status}`, 114, 62)

    autoTable(doc, {
      startY: 72,
      head: [['#', 'Test Description', 'Amount']],
      body: (bill.items || []).map((item, i) => [i + 1, item.description, safeCurrency(item.total)]),
      theme: 'striped',
      headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: { 0: { cellWidth: 10 }, 2: { halign: 'right' } },
    })

    const finalY = doc.lastAutoTable.finalY + 5
    autoTable(doc, {
      startY: finalY,
      margin: { left: 120 },
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2, halign: 'right' },
      columnStyles: { 0: { fontStyle: 'bold', textColor: 80 }, 1: { fontStyle: 'bold', textColor: 0 } },
      body: [
        ['Subtotal:', safeCurrency(bill.subtotal)],
        ['Paid Amount:', safeCurrency(bill.paid_amt)],
        ['Balance Due:', safeCurrency(bill.due_amt)],
      ],
      didParseCell: (data) => {
        if (data.row.index === 1) { data.cell.styles.textColor = [34, 197, 94] }
        if (data.row.index === 2) { data.cell.styles.textColor = [239, 68, 68] }
      },
    })
    return doc
  }

  // 👉 PDF Generator: Clinical Lab Report
  const generateLabReportPDF = (order) => {
    const doc = new jsPDF()
    doc.setFontSize(22)
    doc.setTextColor(14, 165, 233)
    doc.setFont(undefined, 'bold')
    doc.text('Dr.AiSolnex Hospital', 14, 22)
    doc.setFontSize(14)
    doc.setTextColor(0)
    doc.text('Laboratory Report', 14, 30)

    doc.setFontSize(10)
    doc.setTextColor(80)
    doc.setFont(undefined, 'normal')
    doc.text(`Order No: ${order.order_no}`, 14, 38)
    doc.text(`Date: ${new Date(order.created_at).toLocaleString()}`, 14, 43)

    doc.setDrawColor(200)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(14, 48, 182, 22, 3, 3, 'FD')
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.setFont(undefined, 'bold')
    doc.text(`Patient: ${order.patient?.first_name || ''} ${order.patient?.last_name || ''}`, 18, 55)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(60)
    doc.text(`UHID: ${order.patient?.uhid || '-'}  |  Gender: ${order.patient?.gender || '-'}`, 18, 62)
    doc.text(`Sample: ${order.sample_type || '-'}`, 110, 55)
    doc.text(`Status: ${order.status}`, 110, 62)

    const body = (order.items || []).map((item, i) => [
      i + 1, item.test_name, item.result || '-', item.unit || '-', item.ref_range || '-',
      item.is_critical ? 'CRITICAL' : item.is_abnormal ? 'ABNORMAL' : 'NORMAL'
    ])

    autoTable(doc, {
      startY: 75,
      head: [['#', 'Test Name', 'Result', 'Unit', 'Ref. Range', 'Flag']],
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 0: { cellWidth: 10 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const val = data.cell.raw
          if (val === 'CRITICAL') { data.cell.styles.textColor = [239, 68, 68]; data.cell.styles.fontStyle = 'bold' }
          else if (val === 'ABNORMAL') { data.cell.styles.textColor = [245, 158, 11]; data.cell.styles.fontStyle = 'bold' }
          else { data.cell.styles.textColor = [34, 197, 94] }
        }
      }
    })

    doc.setFontSize(9)
    doc.setTextColor(150)
    doc.text('*** End of Report ***', 105, doc.lastAutoTable.finalY + 15, { align: 'center' })
    return doc
  }

  // 👉 Hook to auto-generate PDF URLs when Modals open
  useEffect(() => {
    if (billOrder?.bill) {
      const doc = generateLabBillPDF(billOrder)
      setBillPdfUrl(doc.output('bloburl'))
    } else {
      setBillPdfUrl(null)
    }
  }, [billOrder])

  useEffect(() => {
    if (reportOrder) {
      const doc = generateLabReportPDF(reportOrder)
      setReportPdfUrl(doc.output('bloburl'))
    } else {
      setReportPdfUrl(null)
    }
  }, [reportOrder])

  const openResultEntry = (order) => {
    setResultOrder(order)
    const defaults = {}
    order.items?.forEach(item => {
      defaults[item.id] = {
        result: item.result || '',
        unit: item.unit || COMMON_TESTS.find(t => t.code === item.test_code)?.unit || '',
        ref_range: item.ref_range || COMMON_TESTS.find(t => t.code === item.test_code)?.ref_range || '',
        is_abnormal: !!item.is_abnormal,
        is_critical: !!item.is_critical,
        method: item.method || 'Automated analyzer',
        notes: item.notes || '',
      }
    })
    resultForm.reset(defaults)
  }

  const markReported = (order) => {
    statusMut.mutate({ id: order.id, status: 'REPORTED' }, {
      onSuccess: () => {
        toast.success('Lab report marked as reported')
        setReportOrder(prev => prev ? { ...prev, status: 'REPORTED' } : prev)
      },
    })
  }

  const openTestModal = (test = null) => {
    setEditingTest(test)
    testForm.reset(test || { category: 'Biochemistry', sample_type: 'Blood', price: 0, is_active: true })
    setShowTestModal(true)
  }

  const uploadReport = (orderId, file) => {
    if (!file) return
    if (file.size > 4 * 1024 * 1024) return toast.error('Use a report file under 4 MB')
    const reader = new FileReader()
    reader.onload = () => {
      setAttachments(prev => ({ ...prev, [orderId]: { name: file.name, type: file.type, size: file.size, dataUrl: reader.result } }))
      toast.success('Report attached')
    }
    reader.onerror = () => toast.error('Could not read file')
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Microscope size={20} /> Laboratory Automation Hub</h1>
          <p className="page-sub">Sample tracking, analyzer workload, critical values, and verified reports</p>
        </div>
        <button className="btn-primary" onClick={() => setShowOrderModal(true)}><Plus size={16} /> Order tests</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard icon={<TestTubes size={22} />} value={stats.pending || 0} label="Pending tests" color="cyan" />
        <StatCard icon={<Zap size={22} />} value={stats.stat || 0} label="STAT orders" color="red" />
        <StatCard icon={<AlertTriangle size={22} />} value={stats.critical || 0} label="Critical values" color="amber" />
        <StatCard icon={<Activity size={22} />} value={stats.processing || 0} label="Processing" color="blue" />
        <StatCard icon={<ClipboardCheck size={22} />} value={stats.completed || 0} label="Verified today" color="green" />
        <StatCard icon={<Beaker size={22} />} value={`${analyzerLoad}%`} label="Analyzer load" color="purple" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
        <div className="card p-0 overflow-hidden">
          <div className="p-4 border-b border-default">
            <div className="tabs mb-0">
              {TABS.map(t => <button key={t.key} type="button" className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>)}
            </div>
          </div>
          {tab === 'charges' ? (
            <div className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-white">Laboratory Charges</div>
                  <div className="text-xs text-slate-400">Set OPD lab test prices here. Billing is generated from these rates.</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn" onClick={() => seedTestsMut.mutate()} disabled={seedTestsMut.isPending}><Download size={14} /> Add defaults</button>
                  <button className="btn-primary" onClick={() => openTestModal()}><Plus size={14} /> New test</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Test</th><th>Code</th><th>Category</th><th>Sample</th><th>Reference</th><th>Price</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>{labTests.map(test => (
                    <tr key={test.id}>
                      <td className="text-xs font-medium text-white">{test.name}</td>
                      <td className="text-xs">{test.code || '-'}</td>
                      <td className="text-xs">{test.category || '-'}</td>
                      <td className="text-xs">{test.sample_type || '-'}</td>
                      <td className="text-xs">{test.ref_range || '-'}</td>
                      <td className="text-xs font-semibold text-cyan">{fmt.currency(test.price || 0)}</td>
                      <td>{test.is_active ? <span className="badge badge-green">Active</span> : <span className="badge badge-gray">Inactive</span>}</td>
                      <td><button className="btn text-[10px] px-2 py-1" onClick={() => openTestModal(test)}>Edit</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          ) : isLoading ? <div className="flex justify-center py-16"><Spinner size="lg" /></div> : orders.length === 0 ? (
            <div className="py-14 text-center text-slate-400">No lab orders found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Order</th><th>Patient</th><th>Tests</th><th>Priority</th><th>Sample</th><th>Stage</th><th>TAT</th><th>Actions</th></tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td className="font-mono text-xs text-cyan">{o.order_no}</td>
                      <td><div className="text-xs font-medium text-white">{o.patient?.first_name} {o.patient?.last_name}</div><div className="text-[10px] text-slate-400">{o.patient?.uhid}</div></td>
                      <td className="text-xs max-w-[220px]"><div className="line-clamp-2">{o.items?.map(i => i.test_name).join(', ')}</div></td>
                      <td>{o.is_stat ? <span className="badge badge-red">STAT</span> : <span className="badge badge-gray">Routine</span>}</td>
                      <td className="text-xs">{o.sample_type || 'Not set'}</td>
                      <td><Badge status={o.status} /></td>
                      <td className="text-xs text-slate-400">{fmt.ago(o.created_at)}</td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          {o.status === 'ORDERED' && <button className="btn text-[10px] px-2 py-1" onClick={() => statusMut.mutate({ id: o.id, status: 'COLLECTED' })}>Collect</button>}
                          {['COLLECTED', 'IN_TRANSIT'].includes(o.status) && <button className="btn text-[10px] px-2 py-1" onClick={() => statusMut.mutate({ id: o.id, status: 'RECEIVED' })}>Receive</button>}
                          {['RECEIVED', 'COLLECTED'].includes(o.status) && <button className="btn text-[10px] px-2 py-1" onClick={() => statusMut.mutate({ id: o.id, status: 'PROCESSING' })}>Process</button>}
                          {['PROCESSING', 'RECEIVED', 'RESULTED'].includes(o.status) && <button className="btn text-[10px] px-2 py-1" onClick={() => openResultEntry(o)}>Results</button>}
                          {o.status === 'RESULTED' && <button className="btn text-[10px] px-2 py-1 text-brand-green" onClick={() => verifyMut.mutate(o.id)}>Verify</button>}
                          {['ORDERED', 'COLLECTED', 'RECEIVED', 'PROCESSING'].includes(o.status) && <button className="btn text-[10px] px-2 py-1 text-brand-red" onClick={() => statusMut.mutate({ id: o.id, status: 'REJECTED' })}>Reject</button>}
                          <button className="btn text-[10px] px-2 py-1" onClick={() => setBillOrder(o)}><ReceiptIndianRupee size={12} /> Bill</button>
                          {['VERIFIED', 'REPORTED'].includes(o.status) && <button className="btn text-[10px] px-2 py-1" onClick={() => setReportOrder(o)}><Printer size={12} /> Report</button>}
                          <label className="btn text-[10px] px-2 py-1 cursor-pointer"><FileUp size={12} /> Upload<input type="file" accept=".pdf,image/*" className="hidden" onChange={e => uploadReport(o.id, e.target.files?.[0])} /></label>
                          {attachments[o.id] && <a className="btn text-[10px] px-2 py-1" href={attachments[o.id].dataUrl} download={attachments[o.id].name}><Download size={12} /> Download</a>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center gap-2 text-sm font-bold mb-3"><Timer size={16} /> Analyzer Pipeline</div>
            {[
              ['Collected', stats.collected || 0, 'bg-brand-blue'],
              ['Processing', stats.processing || 0, 'bg-brand-amber'],
              ['Critical', stats.critical || 0, 'bg-brand-red'],
              ['Rejected today', stats.rejected || 0, 'bg-slate-400'],
            ].map(([label, value, color]) => (
              <div key={label} className="mb-3 last:mb-0">
                <div className="flex justify-between text-xs mb-1"><span>{label}</span><span>{value}</span></div>
                <div className="progress"><div className={`progress-bar ${color}`} style={{ width: `${Math.min(100, Number(value) * 12)}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="flex items-center gap-2 text-sm font-bold mb-3"><CheckCircle2 size={16} /> Quality Gates</div>
            {['Barcode match before collection', 'Delta check before verification', 'Critical values require clinician alert', 'Rejected samples stay auditable'].map(item => (
              <div key={item} className="flex items-center gap-2 py-2 border-b border-default last:border-0 text-xs"><CheckCircle2 size={14} className="text-brand-green" /> {item}</div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={showOrderModal} onClose={() => setShowOrderModal(false)} title="Order Laboratory Tests" size="lg">
        <form onSubmit={handleSubmit(d => orderMut.mutate({ ...d, tests: selectedTests, is_stat: d.is_stat === 'true' }))} className="space-y-4">
          <div className="relative">
            <label className="label">Patient Name or UHID *</label>
            <input 
              className="input" 
              placeholder="Search by name, mobile, or UHID..."
              autoComplete="off"
              {...register('patient_id', { required: true })} 
              onChange={(e) => {
                register('patient_id').onChange(e)
                setPatientQuery(e.target.value)
                setShowPatientSuggestions(true)
              }}
            />
    
          {showPatientSuggestions && patientSuggestions.length > 0 && (
            <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
            {patientSuggestions.map((p) => (
              <li 
                key={p.id} 
                className="p-3 text-xs cursor-pointer hover:bg-cyan-50 border-b border-slate-100 last:border-b-0 text-slate-700"
                onClick={() => {
                  setValue('patient_id', p.uhid, { shouldValidate: true })
                  setShowPatientSuggestions(false)
                  setPatientQuery('')
                  }}
                >
                  <div className="font-semibold text-slate-900">{p.first_name} {p.last_name}</div>
                  <div className="text-[10px] text-slate-500">UHID: {p.uhid} • Mobile: {p.phone || 'N/A'}</div>
                </li>
              ))}
            </ul>
          )}
        </div> 
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">Sample type</label><select className="select" {...register('sample_type')}>{['Blood','Urine','Stool','Sputum','CSF','Swab','Tissue','Other'].map(s => <option key={s}>{s}</option>)}</select></div>
            <div><label className="label">Priority</label><select className="select" {...register('is_stat')}><option value="false">Routine</option><option value="true">STAT</option></select></div>
          </div>
          <div>
            <label className="label">Test menu *</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto bg-navy-800 rounded-xl p-3">
              {(activeLabTests.length ? activeLabTests : COMMON_TESTS).map(t => {
                const code = t.code || t.name
                return <label key={code} className="flex items-center gap-2 cursor-pointer hover:bg-navy-700 rounded-lg px-2 py-1.5">
                  <input type="checkbox" checked={selectedTests.some(s => (s.code || s.name) === code)} onChange={e => setSelectedTests(prev => e.target.checked ? [...prev, { name: t.name, code, category: t.category }] : prev.filter(s => (s.code || s.name) !== code))} />
                  <span className="text-xs"><span className="font-bold">{t.code || '-'}</span> - {t.name}{t.price !== undefined ? ` (${fmt.currency(t.price)})` : ''}</span>
                </label>
              })}
            </div>
          </div>
          <div><label className="label">Clinical notes</label><textarea className="textarea h-16" {...register('notes')} /></div>
          <div className="flex gap-2"><button type="submit" disabled={orderMut.isPending || !selectedTests.length} className="btn-primary flex-1">{orderMut.isPending ? 'Creating...' : 'Create order'}</button><button type="button" className="btn flex-1" onClick={() => setShowOrderModal(false)}>Cancel</button></div>
        </form>
      </Modal>

      <Modal open={showTestModal} onClose={() => { setShowTestModal(false); setEditingTest(null) }} title={editingTest ? 'Edit Lab Test' : 'New Lab Test'} size="lg">
        <form onSubmit={testForm.handleSubmit(d => saveTestMut.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">Test name *</label><input className="input" {...testForm.register('name', { required: true })} /></div>
            <div><label className="label">Code</label><input className="input" placeholder="CBC / LFT" {...testForm.register('code')} /></div>
            <div><label className="label">Category</label><input className="input" {...testForm.register('category')} /></div>
            <div><label className="label">Sample type</label><input className="input" {...testForm.register('sample_type')} /></div>
            <div><label className="label">Unit</label><input className="input" {...testForm.register('unit')} /></div>
            <div><label className="label">Price *</label><input type="number" min="0" step="0.01" className="input" {...testForm.register('price', { required: true })} /></div>
          </div>
          <div><label className="label">Reference range</label><input className="input" {...testForm.register('ref_range')} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...testForm.register('is_active')} /> Active</label>
          <div className="flex gap-2"><button className="btn-primary flex-1" disabled={saveTestMut.isPending}>{saveTestMut.isPending ? 'Saving...' : 'Save test'}</button><button type="button" className="btn flex-1" onClick={() => setShowTestModal(false)}>Cancel</button></div>
        </form>
      </Modal>

      {/* 👉 MODAL: LAB BILL PDF */}
      <Modal open={!!billOrder} onClose={() => setBillOrder(null)} title="Lab Bill" size="xl">
        {billOrder && (
          <div className="space-y-4">
            <div className="card-sm flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold">{billOrder.order_no}</div>
                <div className="text-xs text-slate-400">{billOrder.patient?.first_name} {billOrder.patient?.last_name} - {billOrder.patient?.uhid}</div>
              </div>
              {billOrder.bill ? <Badge status={billOrder.bill.status} /> : <span className="badge badge-amber">Not billed</span>}
            </div>

            {/* Bill Generation Form (If not billed yet) */}
            {!billOrder.bill && (
              <form onSubmit={billForm.handleSubmit(d => billMut.mutate({ id: billOrder.id, ...d }))} className="card-sm space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold"><BadgeIndianRupee size={16} /> Generate OPD lab bill</div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...billForm.register('collect_payment')} /> Collect payment now</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><label className="label">Payment mode</label><select className="select" {...billForm.register('payment_mode')}>{['CASH','UPI','CARD','ONLINE','NET_BANKING','CHEQUE','INSURANCE_CASHLESS','CORPORATE_CREDIT'].map(m => <option key={m}>{m}</option>)}</select></div>
                  <div><label className="label">Reference</label><input className="input" {...billForm.register('payment_reference')} /></div>
                </div>
                <button className="btn-primary w-full" disabled={billMut.isPending}>{billMut.isPending ? 'Generating...' : 'Generate Bill'}</button>
              </form>
            )}

            {/* PDF Viewer (If billed) */}
            {billOrder.bill && (
              <div className="space-y-4">
                {billPdfUrl ? (
                  <div className="h-[65vh] w-full rounded-xl overflow-hidden border border-default bg-white">
                    <iframe src={billPdfUrl} className="w-full h-full" title="PDF Preview" />
                  </div>
                ) : (
                  <div className="flex justify-center items-center h-[65vh] text-slate-400">
                    <span className="ml-3 font-semibold">Generating PDF...</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-4">
              {billOrder.bill && (
                <button 
                  className="btn-primary flex-1 font-semibold py-3" 
                  onClick={() => {
                    const doc = generateLabBillPDF(billOrder)
                    doc.save(`${billOrder.bill.bill_no}.pdf`)
                    toast.success('Bill downloaded successfully!')
                  }}
                >
                  <Download size={14} className="mr-2" /> Download PDF
                </button>
              )}
              <button className="btn flex-1 py-3" onClick={() => setBillOrder(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!resultOrder} onClose={() => setResultOrder(null)} title="Analyzer Result Entry" size="xl">
        {resultOrder && (
          <form onSubmit={resultForm.handleSubmit(values => {
            const results = resultOrder.items.map(item => ({ item_id: item.id, ...values[item.id] }))
            resultMut.mutate({ id: resultOrder.id, results })
          })} className="space-y-4">
            <div className="text-xs text-slate-400">{resultOrder.order_no} - {resultOrder.patient?.first_name} {resultOrder.patient?.last_name}</div>
            <div className="space-y-3">
              {resultOrder.items.map(item => (
                <div key={item.id} className="card-sm">
                  <div className="flex items-center justify-between gap-2 mb-2"><div className="text-sm font-bold">{item.test_name}</div><span className="badge badge-cyan">{item.test_code}</span></div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input className="input" placeholder="Result" {...resultForm.register(`${item.id}.result`, { required: true })} />
                    <input className="input" placeholder="Unit" {...resultForm.register(`${item.id}.unit`)} />
                    <input className="input" placeholder="Reference range" {...resultForm.register(`${item.id}.ref_range`)} />
                    <input className="input" placeholder="Method" {...resultForm.register(`${item.id}.method`)} />
                  </div>
                  <div className="flex gap-4 mt-2 text-xs flex-wrap">
                    <label className="flex items-center gap-2"><input type="checkbox" {...resultForm.register(`${item.id}.is_abnormal`)} /> Abnormal</label>
                    <label className="flex items-center gap-2"><input type="checkbox" {...resultForm.register(`${item.id}.is_critical`)} /> Critical</label>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2"><button className="btn-primary flex-1" disabled={resultMut.isPending}>{resultMut.isPending ? 'Saving...' : 'Save results'}</button><button type="button" className="btn flex-1" onClick={() => setResultOrder(null)}>Cancel</button></div>
          </form>
        )}
      </Modal>

      {/* 👉 MODAL: LAB REPORT PDF */}
      <Modal open={!!reportOrder} onClose={() => setReportOrder(null)} title="Laboratory Report" size="xl">
        {reportOrder && (
          <div className="space-y-4">
            <div className="card-sm flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold">Uploaded External Report</div>
                <div className="text-xs text-slate-400">{attachments[reportOrder.id]?.name || 'Attach signed PDF/image for handover'}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {attachments[reportOrder.id] && (
                  <a className="btn" href={attachments[reportOrder.id].dataUrl} download={attachments[reportOrder.id].name}><Download size={14} /> Download External</a>
                )}
                <label className="btn cursor-pointer"><FileUp size={14} /> Upload<input type="file" accept=".pdf,image/*" className="hidden" onChange={e => uploadReport(reportOrder.id, e.target.files?.[0])} /></label>
              </div>
            </div>

            {/* PDF Viewer for internal report */}
            <div className="space-y-4">
              {reportPdfUrl ? (
                <div className="h-[65vh] w-full rounded-xl overflow-hidden border border-default bg-white">
                  <iframe src={reportPdfUrl} className="w-full h-full" title="PDF Preview" />
                </div>
              ) : (
                <div className="flex justify-center items-center h-[65vh] text-slate-400">
                  <span className="ml-3 font-semibold">Generating Report...</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              {reportOrder.status === 'VERIFIED' && (
                <button 
                  className="btn-primary flex-1 py-3 font-semibold" 
                  disabled={statusMut.isPending} 
                  onClick={() => markReported(reportOrder)}
                >
                  Mark as Reported
                </button>
              )}
              <button 
                className="btn-primary flex-1 py-3 font-semibold" 
                onClick={() => {
                  const doc = generateLabReportPDF(reportOrder)
                  doc.save(`${reportOrder.order_no}-Report.pdf`)
                  toast.success('Report downloaded successfully!')
                }}
              >
                <Download size={14} className="mr-2 inline" /> Download PDF Report
              </button>
              <button className="btn flex-1 py-3" onClick={() => setReportOrder(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}