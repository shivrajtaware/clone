import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Activity, CheckCircle2, IndianRupee, Plus, Settings2, Zap } from 'lucide-react'
import api from '../utils/api'
import Modal from '../components/common/Modal'
import StatCard, { Badge, Spinner } from '../components/common/StatCard'
import { fmt } from '../utils/helpers'

const FALLBACK_TRIGGERS = [
  { code: 'MANUAL', label: 'Manual only', category: 'Other' },
  { code: 'CONSULTATION', label: 'Consultation / OPD visit', category: 'Consultation' },
  { code: 'REGISTRATION', label: 'Patient registration', category: 'Registration' },
  { code: 'ADMISSION_PER_NIGHT', label: 'Admit patient per night', category: 'Room Charge' },
  { code: 'NURSING_PER_DAY', label: 'Nursing charge per day', category: 'Nursing' },
  { code: 'ICU_PER_DAY', label: 'ICU / critical care per day', category: 'ICU' },
  { code: 'RADIOLOGY_STUDY', label: 'Per radiology study', category: 'Radiology' },
  { code: 'PHARMACY_DISPENSE', label: 'Per pharmacy dispense', category: 'Pharmacy' },
  { code: 'AMBULANCE_TRIP', label: 'Per ambulance trip', category: 'Ambulance' },
  { code: 'EMERGENCY_VISIT', label: 'Emergency visit', category: 'Emergency' },
  { code: 'OT_PROCEDURE', label: 'OT procedure', category: 'Surgery' },
  { code: 'ANESTHESIA', label: 'Anesthesia service', category: 'Anesthesia' },
  { code: 'PROCEDURE', label: 'Minor procedure / dressing', category: 'Procedure' },
  { code: 'CONSUMABLE', label: 'Consumables / disposables', category: 'Consumable' },
  { code: 'OXYGEN', label: 'Oxygen / respiratory support', category: 'Respiratory' },
  { code: 'MONITORING', label: 'Patient monitoring', category: 'Monitoring' },
  { code: 'DIET_ORDER', label: 'Dietary order', category: 'Dietary' },
  { code: 'DOCUMENTATION', label: 'Certificate / documentation', category: 'Documentation' },
]

const DEFAULT_FEE = { name: '', category: 'Consultation', trigger_code: 'CONSULTATION', amount: 0, is_active: true }
const CATEGORIES = ['Registration','Consultation','Room Charge','Nursing','ICU','Radiology','Pharmacy','Ambulance','Emergency','Surgery','Anesthesia','Procedure','Consumable','Respiratory','Monitoring','Dietary','Documentation','Other']

export default function BillingConfigPage() {
  const [fees, setFees] = useState([])
  const [triggers, setTriggers] = useState(FALLBACK_TRIGGERS)
  const [roomRates, setRoomRates] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  // Billing Rule States
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(DEFAULT_FEE)

  // Room Rate States
  const [showRateModal, setShowRateModal] = useState(false)
  const [editingRate, setEditingRate] = useState(null)
  const [rateForm, setRateForm] = useState({ daily_rate: 0 })

  const load = async () => {
    try {
      setLoading(true)
      const [feeRes, triggerRes, rateRes] = await Promise.all([
        api.get('/billing/fees'),
        api.get('/billing/fee-triggers'),
        api.get('/billing/room-rates')
      ])
      setFees(feeRes.data.data || [])
      setTriggers(triggerRes.data.data?.length ? triggerRes.data.data : FALLBACK_TRIGGERS)
      setRoomRates(rateRes.data.data || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load billing configuration')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const stats = useMemo(() => {
    const active = fees.filter(f => f.is_active)
    const automated = active.filter(f => f.trigger_code !== 'MANUAL')
    const activeTotal = active.reduce((sum, f) => sum + Number(f.amount || 0), 0)
    const covered = new Set(automated.map(f => f.trigger_code)).size
    const triggerCount = Math.max(1, triggers.filter(t => t.code !== 'MANUAL').length)
    return { active: active.length, automated: automated.length, activeTotal, coverage: Math.round((covered / triggerCount) * 100) }
  }, [fees, triggers])

  const filteredFees = fees.filter(f => filter === 'all' || (filter === 'active' ? f.is_active : !f.is_active))
  const triggerLabel = (code) => triggers.find(t => t.code === code)?.label || code

  const openForm = (fee = null) => {
    setEditing(fee)
    setForm(fee ? { ...fee, amount: Number(fee.amount || 0) } : { ...DEFAULT_FEE })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm({ ...DEFAULT_FEE })
  }

  const saveFee = async (e) => {
    e.preventDefault()
    try {
      if (editing) await api.put(`/billing/fees/${editing.id}`, form)
      else await api.post('/billing/fees', form)
      toast.success(editing ? 'Billing rule updated' : 'Billing rule added')
      closeForm()
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to save billing rule')
    }
  }

  const toggleFee = async (fee) => {
    try {
      await api.patch(`/billing/fees/${fee.id}/status`, { is_active: !fee.is_active })
      toast.success(!fee.is_active ? 'Rule activated' : 'Rule paused')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update rule')
    }
  }

  const loadDefaults = async () => {
    try {
      const res = await api.post('/billing/fees/defaults')
      toast.success(`${res.data.data?.created || 0} standard charges added`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to load standard charges')
    }
  }

  const openRateModal = (rate) => {
    setEditingRate(rate)
    setRateForm({ daily_rate: Number(rate.daily_rate || 0) })
    setShowRateModal(true)
  }
  const closeRateModal = () => {
    setShowRateModal(false)
    setEditingRate(null)
    setRateForm({ daily_rate: 0 })
  }
  const saveRate = async (e) => {
    e.preventDefault()
    try {
      await api.patch(`/billing/room-rates/${editingRate.id}`, { daily_rate: rateForm.daily_rate })
      toast.success('Room rate updated successfully')
      closeRateModal()
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update room rate')
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing Configuration</h1>
          <p className="page-sub">Automation rules that drive OPD, IPD, lab, pharmacy, and service billing</p>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={loadDefaults}>Load Standard Charges</button>
          <button className="btn-primary" onClick={() => openForm()}><Plus size={16} /> Add Charge</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Settings2 size={22} />} value={fees.length} label="Total Rules" color="cyan" />
        <StatCard icon={<CheckCircle2 size={22} />} value={stats.active} label="Active Rules" color="green" />
        <StatCard icon={<Zap size={22} />} value={`${stats.coverage}%`} label="Automation Coverage" color="amber" />
        <StatCard icon={<IndianRupee size={22} />} value={fmt.currency(stats.activeTotal)} label="Active Fee Value" color="purple" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-4 border-b border-default">
            <div>
              <h2 className="text-sm font-semibold text-white">Fee Automation Matrix</h2>
              <p className="text-xs text-slate-400">Consultation rules are used automatically when OPD is completed.</p>
            </div>
            <div className="tabs mb-0">
              {['all','active','inactive'].map(tab => <div key={tab} className={`tab ${filter === tab ? 'active' : ''}`} onClick={() => setFilter(tab)}>{tab}</div>)}
            </div>
          </div>
          {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Rule</th><th>Trigger</th><th>Category</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredFees.map(fee => (
                    <tr key={fee.id}>
                      <td className="text-xs font-medium text-white">{fee.name}</td>
                      <td className="text-xs text-slate-400">{triggerLabel(fee.trigger_code)}</td>
                      <td className="text-xs text-slate-400">{fee.category}</td>
                      <td className="text-xs font-semibold text-white">{fmt.currency(fee.amount)}</td>
                      <td><Badge status={fee.is_active ? 'ACTIVE' : 'INACTIVE'} /></td>
                      <td><div className="flex gap-1"><button className="btn text-[10px] px-2 py-1" onClick={() => openForm(fee)}>Edit</button><button className="btn text-[10px] px-2 py-1" onClick={() => toggleFee(fee)}>{fee.is_active ? 'Pause' : 'Activate'}</button></div></td>
                    </tr>
                  ))}
                  {!filteredFees.length && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No rules match this view.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
            <div><h3 className="text-sm font-semibold text-white">Ward & Bed Rate Management</h3><p className="text-[11px] text-slate-400">These rates are used for IPD room/bed billing. Bed layout stays in Bed Management; pricing stays here.</p></div>
            <button
              className="btn text-[10px] px-2 py-1"
              onClick={async () => {
              try {
                  const res = await api.post('/billing/room-rates/seed')
                  toast.success(`${res.data.data?.updated || res.data.data?.created || 0} empty bed rates filled`)
                  load()
                } catch (err) {
                  toast.error(err.response?.data?.message || 'Failed to apply standard rates')
                }
              }}
            >
              Fill Empty Rates
            </button>
            </div>
            {loading ? <div className="flex justify-center py-4"><Spinner size="sm" /></div> : (
              <div className="overflow-x-auto">
                <table className="tbl text-xs">
                  <thead><tr><th>Ward</th><th>Bed</th><th>Type</th><th>Status</th><th>Daily Rate</th><th>Action</th></tr></thead>
                  <tbody>
                    {roomRates.map(r => (
                      <tr key={r.id}>
                        <td className="font-medium text-slate-300">{r.ward || '-'}</td>
                        <td className="text-xs text-slate-400">{[r.floor, r.room_no, r.bed_no].filter(Boolean).join(' / ') || '-'}</td>
                        <td className="text-xs">{(r.room_type || r.bed_type || '-').replace('_', ' ')}</td>
                        <td><Badge status={r.status === 'AVAILABLE' ? 'ACTIVE' : r.status === 'OCCUPIED' ? 'INACTIVE' : 'PENDING'} label={r.status} /></td>
                        <td className="font-semibold text-white">{fmt.currency(r.daily_rate ?? r.rate_per_day)}</td>
                        <td><button className="btn text-[10px] px-2 py-1" onClick={() => openRateModal(r)}>Edit Rate</button></td>
                      </tr>
                    ))}
                    {!roomRates.length && <tr><td colSpan={6} className="text-center py-4 text-slate-400">No beds found. Create wards and beds from Bed Management first, then set rates here.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        <div className="card space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><Activity size={16} /> Automation Pipeline</div>
          {triggers.filter(t => t.code !== 'MANUAL').map(trigger => {
            const activeCount = fees.filter(f => f.trigger_code === trigger.code && f.is_active).length
            return (
              <div key={trigger.code} className="flex items-center justify-between gap-3 rounded-lg border border-default bg-navy-800 px-3 py-2">
                <div>
                  <div className="text-xs font-medium text-white">{trigger.label}</div>
                  <div className="text-[10px] text-slate-400">{trigger.category || 'Service'}</div>
                </div>
                <Badge status={activeCount ? 'ACTIVE' : 'INACTIVE'} label={activeCount ? `${activeCount} live` : 'not set'} />
              </div>
            )
          })}
        </div>
      </div>

      <Modal open={showForm} onClose={closeForm} title={editing ? 'Edit Billing Rule' : 'Add Billing Rule'}>
        <form onSubmit={saveFee} className="space-y-3">
          <div><label className="label">Rule Name *</label><input className="input" value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Category</label><select className="select" value={form.category} onChange={e => setForm(v => ({ ...v, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="label">Amount *</label><input type="number" min="0" step="0.01" className="input" value={form.amount} onChange={e => setForm(v => ({ ...v, amount: Number(e.target.value) || 0 }))} required /></div>
          </div>
          <div><label className="label">Auto Apply When</label><select className="select" value={form.trigger_code} onChange={e => setForm(v => ({ ...v, trigger_code: e.target.value }))}>{triggers.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}</select></div>
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={form.is_active} onChange={e => setForm(v => ({ ...v, is_active: e.target.checked }))} /> Active</label>
          <div className="flex gap-2 pt-2"><button type="submit" className="btn-primary flex-1">Save Rule</button><button type="button" className="btn flex-1" onClick={closeForm}>Cancel</button></div>
        </form>
      </Modal>

      <Modal open={showRateModal} onClose={closeRateModal} title={`Edit Bed Rate: ${editingRate?.ward || ''} ${editingRate?.bed_no || ''}`}>
        <form onSubmit={saveRate} className="space-y-3">
          <div>
            <label className="label">Daily Rate (₹) *</label>
            <input 
              type="number" 
              min="0" 
              step="0.01" 
              className="input" 
              value={rateForm.daily_rate} 
              onChange={e => setRateForm({ daily_rate: Number(e.target.value) || 0 })} 
              required 
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn-primary flex-1">Save Rate</button>
            <button type="button" className="btn flex-1" onClick={closeRateModal}>Cancel</button>
          </div>
        </form>
      </Modal>
      </div>
    </div>
  )
}