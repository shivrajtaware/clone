// src/pages/BillingPage.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../utils/api'
import Modal from '../components/common/Modal'
import StatCard from '../components/common/StatCard'
import { Badge, Spinner } from '../components/common/StatCard'
import { fmt } from '../utils/helpers'

const emptyItem = { category: 'Consultation', description: '', quantity: 1, unit_price: 0 }
const defaultBill = { type: 'OPD', payment_mode: 'CASH', auto_apply: true, collect_payment: false, payment_reference: '' }
const defaultFee = { name: '', category: 'Consultation', trigger_code: 'CONSULTATION', amount: 0, is_active: true }
const categories = ['Registration','Consultation','Room Charge','Nursing','ICU','Procedure','Radiology','Pharmacy','Surgery','Anesthesia','Consumable','Respiratory','Monitoring','Ambulance','Emergency','Dietary','Documentation','Other']
const fallbackTriggers = [
  { code: 'MANUAL', label: 'Manual only' },
  { code: 'CONSULTATION', label: 'Consultation / OPD visit' },
  { code: 'REGISTRATION', label: 'Patient registration' },
  { code: 'ADMISSION_PER_NIGHT', label: 'Admit patient per night' },
  { code: 'NURSING_PER_DAY', label: 'Nursing charge per day' },
  { code: 'ICU_PER_DAY', label: 'ICU / critical care per day' },
  { code: 'RADIOLOGY_STUDY', label: 'Per radiology study' },
  { code: 'PHARMACY_DISPENSE', label: 'Per pharmacy dispense' },
  { code: 'AMBULANCE_TRIP', label: 'Per ambulance trip' },
  { code: 'EMERGENCY_VISIT', label: 'Emergency visit' },
  { code: 'OT_PROCEDURE', label: 'OT procedure' },
  { code: 'ANESTHESIA', label: 'Anesthesia service' },
  { code: 'PROCEDURE', label: 'Minor procedure / dressing' },
  { code: 'CONSUMABLE', label: 'Consumables / disposables' },
  { code: 'OXYGEN', label: 'Oxygen / respiratory support' },
  { code: 'MONITORING', label: 'Patient monitoring' },
  { code: 'DIET_ORDER', label: 'Dietary order' },
  { code: 'DOCUMENTATION', label: 'Certificate / documentation' },
]
const csv = (rows) => rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]))

const careTabs = [
  { key: 'OPD', label: 'OPD', title: 'Outpatient Billing', types: ['OPD'], hint: 'Fast consultation bills, walk-in payments, and same-day receipts.' },
  { key: 'IPD', label: 'IPD', title: 'Inpatient Billing', types: ['IPD_INTERIM', 'IPD_FINAL', 'PACKAGE'], hint: 'Admission, package, interim, and discharge billing workflow.' },
  { key: 'PHARMACY', label: 'Pharmacy', title: 'Pharmacy Billing', types: [], hint: 'Dispense invoices, GST, and walk-in medicine sales.' },
]
const statusTabs = [['bills','All Bills'],['pending','Pending'],['outstanding','Outstanding'],['fees','Fees']]
const billTypeOptions = {
  OPD: ['OPD'],
  IPD: ['IPD_INTERIM','IPD_FINAL','PACKAGE'],
  PHARMACY: ['PHARMACY'],
}

export default function BillingPage() {
  const [careTab, setCareTab] = useState('OPD')
  const [tab, setTab] = useState('bills')
  const [showNewBill, setShowNewBill] = useState(false)
  const [showPayment, setShowPayment] = useState(null)
  const [showFee, setShowFee] = useState(false)
  const [editingFee, setEditingFee] = useState(null)
  const [printBill, setPrintBill] = useState(null)
  const [billItems, setBillItems] = useState([emptyItem])
  const qc = useQueryClient()
  const billForm = useForm({ defaultValues: defaultBill })
  const paymentForm = useForm()
  const feeForm = useForm({ defaultValues: defaultFee })

  const patientRef = billForm.watch('patient_id')
  const billType = billForm.watch('type')
  const collectNow = billForm.watch('collect_payment')

  const currentCare = careTabs.find(c => c.key === careTab) || careTabs[0]

  const { data: billsData, isLoading } = useQuery({
    queryKey: ['bills', careTab, tab],
    enabled: tab !== 'fees',
    queryFn: () => api.get('/billing/bills', {
      params: {
        type_group: careTab,
        ...(tab === 'outstanding' && { status: 'PARTIAL_PAID' }),
        ...(tab === 'pending' && { status: 'GENERATED' }),
      },
    }).then(r => r.data),
  })

  const { data: feesData, isLoading: feesLoading } = useQuery({
    queryKey: ['billing-fees'],
    queryFn: () => api.get('/billing/fees').then(r => r.data),
  })

  const { data: triggerData } = useQuery({
    queryKey: ['billing-fee-triggers'],
    queryFn: () => api.get('/billing/fee-triggers').then(r => r.data),
  })

  const { data: summary } = useQuery({
    queryKey: ['billing-summary'],
    queryFn: () => api.get('/billing/summary').then(r => r.data.data),
    refetchInterval: 60000,
  })

  const createMut = useMutation({
    mutationFn: (d) => api.post('/billing/bills', d),
    onSuccess: (r) => {
      toast.success(`Bill ${r.data.data?.bill_no || r.data.bill_no} created`)
      qc.invalidateQueries({ queryKey: ['bills'] })
      qc.invalidateQueries({ queryKey: ['billing-summary'] })
      setShowNewBill(false)
      billForm.reset(defaultBill)
      setBillItems([emptyItem])
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to create bill'),
  })

  const paymentMut = useMutation({
    mutationFn: ({ billId, ...d }) => api.post(`/billing/bills/${billId}/payment`, d),
    onSuccess: (r) => {
      toast.success(`Payment recorded - ${r.data.data?.status || r.data.status}`)
      qc.invalidateQueries({ queryKey: ['bills'] })
      qc.invalidateQueries({ queryKey: ['billing-summary'] })
      setShowPayment(null)
      paymentForm.reset()
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to record payment'),
  })

  const feeMut = useMutation({
    mutationFn: (d) => editingFee ? api.put(`/billing/fees/${editingFee.id}`, d) : api.post('/billing/fees', d),
    onSuccess: () => {
      toast.success(editingFee ? 'Fee updated' : 'Fee added')
      qc.invalidateQueries({ queryKey: ['billing-fees'] })
      closeFeeModal()
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save fee'),
  })

  const feeStatusMut = useMutation({
    mutationFn: (fee) => api.patch(`/billing/fees/${fee.id}/status`, { is_active: !fee.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-fees'] }),
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update fee'),
  })

  const autoItemsMut = useMutation({
    mutationFn: () => api.get('/billing/auto-items', { params: { patient_id: patientRef, type: billType } }),
    onSuccess: (r) => {
      const rows = (r.data.data || []).map(({ total, ...item }) => item)
      if (!rows.length) {
        toast('No used services found since last bill')
        return
      }
      const autoKeys = new Set(rows.map(i => `${i.category}|${i.description}`))
      const manualRows = billItems.filter(i => i.description && !autoKeys.has(`${i.category}|${i.description}`))
      setBillItems([...rows, ...manualRows])
      billForm.setValue('auto_apply', false)
      toast.success('Used service fees loaded')
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not load used service fees'),
  })

  const bills = billsData?.data || []
  const careSummary = summary?.[careTab.toLowerCase()] || {}
  const fees = feesData?.data || []
  const triggers = triggerData?.data?.length ? triggerData.data : fallbackTriggers
  const total_items = billItems.reduce((sum, i) => sum + ((Number(i.quantity) || 0) * (Number(i.unit_price) || 0)), 0)
  const tax = 0
  const grand_total = total_items + tax

  const openNewBill = () => {
    billForm.reset({ ...defaultBill, type: (billTypeOptions[careTab] || ['OPD'])[0] })
    setBillItems([emptyItem])
    setShowNewBill(true)
  }

  const handleCareTabChange = (next) => {
    setCareTab(next)
    if (tab === 'fees') return
    setTab('bills')
  }

  const openFeeModal = (fee = null) => {
    setEditingFee(fee)
    feeForm.reset(fee ? { ...fee, amount: Number(fee.amount || 0) } : defaultFee)
    setShowFee(true)
  }

  const closeFeeModal = () => {
    setShowFee(false)
    setEditingFee(null)
    feeForm.reset(defaultFee)
  }

  const updateItem = (idx, patch) => setBillItems(p => p.map((row, i) => i === idx ? { ...row, ...patch } : row))
  const exportRevenueReport = async () => {
    const response = await api.get('/billing/bills', { params: { type_group: careTab, limit: 10000 } })
    const reportBills = response.data.data || []
    const rows = [['Bill No', 'Date', 'Patient', 'UHID', 'Type', 'Admission ID', 'Status', 'Taxable Value', 'GST', 'Invoice Total', 'Paid', 'Due', 'Payment Mode', 'Payment References', 'Charge Details']]
    reportBills.forEach(b => rows.push([b.bill_no, fmt.date(b.created_at), `${b.patient?.first_name || ''} ${b.patient?.last_name || ''}`.trim(), b.patient?.uhid, b.type, b.admission_id || '', b.status, b.subtotal, b.tax_amt, b.total_amt, b.paid_amt, b.due_amt, b.payment_mode || '', (b.payments || []).map(p => p.reference_no).filter(Boolean).join(' | '), (b.items || []).map(i => `${i.description} x${i.quantity}=${i.total}`).join(' | ')]))
    const blob = new Blob([csv(rows)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `revenue-report-${tab}-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const printInvoice = (bill) => {
    const win = window.open('', '_blank', 'width=900,height=800')
    if (!win) return toast.error('Allow pop-ups to print the invoice')
    const rows = (bill.items || []).map((item, i) => `<tr><td>${i + 1}</td><td>${esc(item.category)}</td><td>${esc(item.description)}</td><td class="num">${esc(item.quantity)}</td><td class="num">${esc(fmt.currency(item.unit_price))}</td><td class="num">${esc(fmt.currency(item.total))}</td></tr>`).join('')
    win.document.write(`<!doctype html><html><head><title>${esc(bill.bill_no)}</title><style>
      @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font:12px Arial;color:#111;margin:0}h1{font-size:20px;margin:0}.head,.meta,.sign{display:flex;justify-content:space-between;gap:24px}.head{border-bottom:2px solid #111;padding-bottom:10px}.meta{margin:14px 0}.box{border:1px solid #bbb;padding:10px;flex:1}table{width:100%;border-collapse:collapse}th,td{border:1px solid #aaa;padding:7px;text-align:left}th{background:#eee}.num{text-align:right}.totals{width:310px;margin:14px 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:3px}.grand{font-size:15px;font-weight:bold;border-top:2px solid #111}.sign{margin-top:70px}.line{border-top:1px solid #111;padding-top:6px;width:42%;text-align:center}.note{margin-top:18px;font-size:10px;color:#444}@media print{button{display:none}}</style></head><body>
      <div class="head"><div><h1>Hospital Tax Invoice / Receipt</h1><div>Original for recipient</div></div><div><b>${esc(bill.bill_no)}</b><br>${esc(fmt.datetime(bill.created_at))}</div></div>
      <div class="meta"><div class="box"><b>Patient</b><br>${esc(`${bill.patient?.first_name || ''} ${bill.patient?.last_name || ''}`.trim())}<br>UHID: ${esc(bill.patient?.uhid)}</div><div class="box"><b>Bill details</b><br>Type: ${esc(bill.type)}<br>Status: ${esc(bill.status)}<br>Payment: ${esc(bill.payment_mode || '-')}<br>Admission: ${esc(bill.admission_id || '-')}</div></div>
      <table><thead><tr><th>#</th><th>Category</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals"><div><span>Subtotal</span><b>${esc(fmt.currency(bill.subtotal))}</b></div><div><span>Discount</span><b>${esc(fmt.currency(bill.discount_amt))}</b></div><div><span>GST included / charged</span><b>${esc(fmt.currency(bill.tax_amt))}</b></div><div class="grand"><span>Invoice total</span><span>${esc(fmt.currency(bill.total_amt))}</span></div><div><span>Paid</span><b>${esc(fmt.currency(bill.paid_amt))}</b></div><div><span>Balance due</span><b>${esc(fmt.currency(bill.due_amt))}</b></div></div>
      <div class="sign"><div class="line">Patient / payer signature</div><div class="line">Authorized signatory and hospital stamp</div></div><div class="note">Computer-generated invoice. Preserve this document with payment and clinical records for audit.</div><script>window.onload=()=>window.print()</script></body></html>`)
    win.document.close()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Billing & Insurance</h1><p className="page-sub">Manage patient bills, fees, and payment collection</p></div>
        <div className="flex gap-2">
          <Link to="/billing-config" className="btn">Config</Link>
          {tab === 'fees' ? <button className="btn-primary" onClick={() => openFeeModal()}>+ Add Fee</button> : careTab !== 'PHARMACY' && <button className="btn-primary" onClick={openNewBill}>+ Generate {careTab} Bill</button>}
          <button className="btn" onClick={exportRevenueReport}>{careTab} Revenue Report</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon="Rs" value={fmt.currency(summary?.collected_today || 0)} label="Collected Today" color="green" />
        <StatCard icon="!" value={fmt.currency(summary?.total_outstanding || 0)} label="Total Outstanding" color="red" />
        <StatCard icon="#" value={summary?.bills_today || 0} label="Bills Today" color="cyan" />
        <StatCard icon="OPD" value={fmt.currency(summary?.opd?.revenue || 0)} label="OPD Revenue" color="blue" />
        <StatCard icon="IPD" value={fmt.currency(summary?.ipd?.revenue || 0)} label="IPD Revenue" color="purple" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {careTabs.map(care => {
          const selected = careTab === care.key
          const careData = summary?.[care.key.toLowerCase()] || {}
          return (
            <button
              key={care.key}
              type="button"
              onClick={() => handleCareTabChange(care.key)}
              className={`text-left rounded-2xl border p-4 transition-all ${selected ? 'border-cyan bg-cyan/10 shadow-glow-cyan' : 'border-default bg-white/5 hover:border-cyan/40 hover:bg-white/10'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.25em] text-cyan">{care.label}</div>
                  <div className="text-base font-bold text-white">{care.title}</div>
                </div>
                {selected && <Badge status="ACTIVE" label="Viewing" />}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div className="rounded-xl bg-navy-800 border border-default p-2"><div className="text-slate-500">Bills</div><div className="text-white font-bold">{careData.count || 0}</div></div>
                <div className="rounded-xl bg-navy-800 border border-default p-2"><div className="text-slate-500">Outstanding</div><div className="text-brand-red font-bold">{fmt.currency(careData.outstanding || 0)}</div></div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="tabs">
        {statusTabs.map(([k,l]) => <div key={k} className={`tab ${tab===k?'active':''}`} onClick={() => setTab(k)}>{l}</div>)}
      </div>

      {tab === 'fees' ? (
        <div className="card p-0 overflow-hidden">
          {feesLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Fee</th><th>Trigger</th><th>Category</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {fees.map(fee => (
                    <tr key={fee.id}>
                      <td className="text-xs font-medium text-white">{fee.name}</td>
                      <td className="text-xs text-slate-400">{triggers.find(t => t.code === fee.trigger_code)?.label || fee.trigger_code}</td>
                      <td className="text-xs text-slate-400">{fee.category}</td>
                      <td className="text-xs font-medium text-white">{fmt.currency(fee.amount)}</td>
                      <td><Badge status={fee.is_active ? 'ACTIVE' : 'INACTIVE'} /></td>
                      <td><div className="flex gap-1"><button className="btn text-[10px] px-1.5 py-1" onClick={() => openFeeModal(fee)}>Edit</button><button className="btn text-[10px] px-1.5 py-1" onClick={() => feeStatusMut.mutate(fee)}>{fee.is_active ? 'Disable' : 'Enable'}</button></div></td>
                    </tr>
                  ))}
                  {!fees.length && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No fees configured yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          {isLoading ? <div className="flex justify-center py-12"><Spinner /></div> :
          bills.length === 0 ? <div className="py-12 text-center text-slate-400">No bills found.</div> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Bill No.</th><th>Patient</th><th>Type</th><th>Total</th><th>Paid</th><th>Due</th><th>Payment Mode</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {bills.map(b => (
                    <tr key={b.id}>
                      <td className="font-mono text-xs text-cyan">{b.bill_no}</td>
                      <td><div className="text-xs font-medium text-white">{b.patient?.first_name} {b.patient?.last_name}</div><div className="text-[10px] text-slate-400">{b.patient?.uhid}</div></td>
                      <td><Badge status={b.type} /></td>
                      <td className="text-xs font-medium text-white">{fmt.currency(b.total_amt)}</td>
                      <td className="text-xs text-brand-green">{fmt.currency(b.paid_amt)}</td>
                      <td className={`text-xs font-medium ${parseFloat(b.due_amt) > 0 ? 'text-brand-red' : 'text-brand-green'}`}>{fmt.currency(b.due_amt)}</td>
                      <td className="text-xs text-slate-400">{b.payment_mode || '-'}</td>
                      <td><Badge status={b.status} /></td>
                      <td className="text-xs text-slate-400">{fmt.date(b.created_at)}</td>
                      <td><div className="flex gap-1 flex-wrap"><button className="btn text-[10px] px-1.5 py-1" onClick={() => setPrintBill(b)}>Print</button>{parseFloat(b.due_amt) > 0 && <button className="btn text-[10px] px-1.5 py-1 text-brand-green" onClick={() => setShowPayment(b)}>Pay</button>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal open={showNewBill} onClose={() => setShowNewBill(false)} title={`Generate ${careTab} Bill`} size="xl">
        <form onSubmit={billForm.handleSubmit(d => createMut.mutate({ ...d, items: billItems.filter(i => i.description), auto_apply: d.auto_apply === true }))}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Patient UHID *</label><input className="input" {...billForm.register('patient_id', { required: true })} /></div>
              <div><label className="label">Bill Type *</label>
                <select className="select" {...billForm.register('type', { required: true })}>
                  {billTypeOptions[careTab].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" {...billForm.register('auto_apply')} /> Apply configured fees automatically for services used since last bill</label>
            <button type="button" className="btn text-xs" disabled={!patientRef || autoItemsMut.isPending} onClick={() => autoItemsMut.mutate()}>{autoItemsMut.isPending ? 'Loading...' : 'Load Used Service Fees'}</button>
            <div className="divider" />
            <div className="text-sm font-semibold text-white mb-2">Charge Items</div>
            {billItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3"><select className="select text-xs" value={item.category} onChange={e => updateItem(idx, { category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
                <div className="col-span-4"><input className="input text-xs" placeholder="Description" value={item.description} onChange={e => updateItem(idx, { description: e.target.value })} /></div>
                <div className="col-span-2"><input type="number" className="input text-xs" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })} /></div>
                <div className="col-span-2"><input type="number" className="input text-xs" placeholder="Price" value={item.unit_price} onChange={e => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} /></div>
                <div className="col-span-1 text-right"><button type="button" className="btn-ghost text-brand-red text-xs" onClick={() => setBillItems(p => p.length > 1 ? p.filter((_, i) => i !== idx) : [emptyItem])}>x</button></div>
              </div>
            ))}
            <button type="button" className="btn text-xs w-full" onClick={() => setBillItems(p => [...p, emptyItem])}>+ Add Item</button>
            <div className="divider" />
            <div className="flex justify-end space-y-1 text-sm">
              <div className="w-48 space-y-1">
                <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span>{fmt.currency(total_items)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">GST</span><span>{fmt.currency(tax)}</span></div>
                <div className="flex justify-between font-bold text-white"><span>Total</span><span className="text-cyan">{fmt.currency(grand_total)}</span></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Discount (%)</label><input type="number" min="0" max="100" className="input" {...billForm.register('discount_pct')} /></div>
              <div><label className="label">Payment Mode</label>
                <select className="select" {...billForm.register('payment_mode')}>
                  {['CASH','UPI','CARD','ONLINE','NET_BANKING','INSURANCE_CASHLESS','CORPORATE_CREDIT','CHEQUE'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-cyan/20 bg-navy-800 p-3">
              <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" {...billForm.register('collect_payment')} /> Collect full payment now</label>
              <input className="input" disabled={!collectNow} placeholder="Payment reference" {...billForm.register('payment_reference')} />
            </div>
            <div><label className="label">Notes</label><textarea className="textarea h-16" {...billForm.register('notes')} /></div>
            <div className="flex gap-2 pt-2"><button type="submit" disabled={createMut.isPending} className="btn-primary flex-1">{createMut.isPending ? 'Creating...' : 'Generate & Save Bill'}</button><button type="button" className="btn flex-1" onClick={() => setShowNewBill(false)}>Cancel</button></div>
          </div>
        </form>
      </Modal>

      <Modal open={!!showPayment} onClose={() => setShowPayment(null)} title="Record Payment">
        {showPayment && (
          <form onSubmit={paymentForm.handleSubmit(d => paymentMut.mutate({ billId: showPayment.id, ...d }))} className="space-y-3">
            <div className="bg-navy-800 rounded-xl p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Bill No.</span><span className="font-mono text-cyan">{showPayment.bill_no}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Total</span><span>{fmt.currency(showPayment.total_amt)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Already Paid</span><span className="text-brand-green">{fmt.currency(showPayment.paid_amt)}</span></div>
              <div className="flex justify-between font-bold"><span className="text-slate-400">Balance Due</span><span className="text-brand-red">{fmt.currency(showPayment.due_amt)}</span></div>
            </div>
            <div><label className="label">Amount to Collect *</label><input type="number" step="0.01" max={showPayment.due_amt} className="input" defaultValue={showPayment.due_amt} {...paymentForm.register('amount', { required: true })} /></div>
            <div><label className="label">Payment Mode *</label><select className="select" {...paymentForm.register('mode', { required: true })}>{['CASH','CARD','UPI','NET_BANKING','INSURANCE_CASHLESS','CORPORATE_CREDIT','CHEQUE','ONLINE'].map(m => <option key={m}>{m}</option>)}</select></div>
            <div><label className="label">Reference / Transaction No.</label><input className="input" placeholder="UPI ref, cheque no, etc." {...paymentForm.register('reference_no')} /></div>
            <div className="flex gap-2 pt-2"><button type="submit" disabled={paymentMut.isPending} className="btn-primary flex-1">{paymentMut.isPending ? 'Processing...' : 'Confirm Payment'}</button><button type="button" className="btn flex-1" onClick={() => setShowPayment(null)}>Cancel</button></div>
          </form>
        )}
      </Modal>

      <Modal open={showFee} onClose={closeFeeModal} title={editingFee ? 'Edit Fee' : 'Add Fee'}>
        <form onSubmit={feeForm.handleSubmit(d => feeMut.mutate(d))} className="space-y-3">
          <div><label className="label">Fee Name *</label><input className="input" placeholder="Consultation fee" {...feeForm.register('name', { required: true })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Category</label><select className="select" {...feeForm.register('category')}>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="label">Amount *</label><input type="number" step="0.01" min="0" className="input" {...feeForm.register('amount', { required: true })} /></div>
          </div>
          <div><label className="label">Auto Apply When</label><select className="select" {...feeForm.register('trigger_code')}>{triggers.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}</select></div>
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" {...feeForm.register('is_active')} /> Active</label>
          <div className="flex gap-2 pt-2"><button type="submit" disabled={feeMut.isPending} className="btn-primary flex-1">{feeMut.isPending ? 'Saving...' : 'Save Fee'}</button><button type="button" className="btn flex-1" onClick={closeFeeModal}>Cancel</button></div>
        </form>
      </Modal>

      <Modal open={!!printBill} onClose={() => setPrintBill(null)} title="Printable Bill" size="xl">
        {printBill && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-default pb-3">
              <div>
                <div className="text-lg font-bold text-white">Dr.AiSolnex Hospital Bill</div>
                <div className="text-xs text-slate-400">Bill No: <span className="font-mono text-cyan">{printBill.bill_no}</span></div>
                <div className="text-xs text-slate-400">Date: {fmt.datetime(printBill.created_at)}</div>
              </div>
              <Badge status={printBill.status} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="card-sm"><div className="font-bold mb-1">Patient</div><div>{printBill.patient?.first_name} {printBill.patient?.last_name}</div><div className="text-xs text-slate-400">UHID: {printBill.patient?.uhid}</div></div>
              <div className="card-sm"><div className="font-bold mb-1">Summary</div><div className="flex justify-between"><span>Type</span><span>{printBill.type}</span></div><div className="flex justify-between"><span>Payment</span><span>{printBill.payment_mode || '-'}</span></div></div>
            </div>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>#</th><th>Category</th><th>Description</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
                <tbody>{(printBill.items || []).map((item, i) => <tr key={item.id || i}><td>{i + 1}</td><td>{item.category}</td><td>{item.description}</td><td>{item.quantity}</td><td>{fmt.currency(item.unit_price)}</td><td>{fmt.currency(item.total)}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{fmt.currency(printBill.subtotal)}</span></div>
                <div className="flex justify-between"><span>Discount</span><span>{fmt.currency(printBill.discount_amt)}</span></div>
                <div className="flex justify-between"><span>GST</span><span>{fmt.currency(printBill.tax_amt)}</span></div>
                <div className="flex justify-between font-bold text-base"><span>Total</span><span>{fmt.currency(printBill.total_amt)}</span></div>
                <div className="flex justify-between text-brand-green"><span>Paid</span><span>{fmt.currency(printBill.paid_amt)}</span></div>
                <div className="flex justify-between text-brand-red"><span>Due</span><span>{fmt.currency(printBill.due_amt)}</span></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8 pt-12 text-xs text-slate-400">
              <div className="border-t border-slate-500 pt-2 text-center">Patient / payer signature</div>
              <div className="border-t border-slate-500 pt-2 text-center">Authorized signatory and hospital stamp</div>
            </div>
            <div className="flex gap-2"><button className="btn-primary flex-1" onClick={() => printInvoice(printBill)}>Print Bill</button><button className="btn flex-1" onClick={() => setPrintBill(null)}>Close</button></div>
          </div>
        )}
      </Modal>
    </div>
  )
}
