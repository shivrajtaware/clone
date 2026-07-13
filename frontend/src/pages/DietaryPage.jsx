// src/pages/DietaryPage.jsx
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Apple, ClipboardCheck, Flame, Search, ShieldAlert, Utensils } from 'lucide-react'
import api from '../utils/api'
import Modal from '../components/common/Modal'
import StatCard, { Badge, Spinner } from '../components/common/StatCard'
import { fmt } from '../utils/helpers'

const dietTypes = ['Regular', 'Soft', 'Liquid', 'Diabetic', 'Renal', 'Cardiac', 'High Protein', 'Low Sodium', 'Nil By Mouth', 'Tube Feed']
const csvList = (value) => String(value || '').split(',').map(v => v.trim()).filter(Boolean)

export default function DietaryPage() {
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const qc = useQueryClient()
  const form = useForm({ defaultValues: { diet_type: 'Regular', restrictions: '', allergies: '', is_tube_feed: false, is_active: true } })
  const { data, isLoading } = useQuery({ queryKey: ['diet-orders'], queryFn: () => api.get('/dietary/orders').then(r => r.data.data), refetchInterval: 45000 })
  const orders = data || []
  const rows = useMemo(() => orders.filter(o => {
    const q = search.toLowerCase().trim()
    if (!q) return true
    return [o.patient?.first_name, o.patient?.last_name, o.patient?.uhid, o.diet_type, ...(o.allergies || []), ...(o.restrictions || [])].some(v => String(v || '').toLowerCase().includes(q))
  }), [orders, search])
  const allergyRisk = orders.filter(o => o.allergies?.length).length
  const tubeFeeds = orders.filter(o => o.is_tube_feed).length
  const highCal = orders.filter(o => Number(o.calories || 0) >= 2200).length

  const refresh = () => qc.invalidateQueries({ queryKey: ['diet-orders'] })
  const dietMut = useMutation({
    mutationFn: (payload) => api.post('/dietary/orders', { ...payload, restrictions: csvList(payload.restrictions), allergies: csvList(payload.allergies) }),
    onSuccess: () => { toast.success('Diet order created'); refresh(); setShowModal(false); form.reset({ diet_type: 'Regular', restrictions: '', allergies: '', is_tube_feed: false, is_active: true }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to create diet order'),
  })
  const statusMut = useMutation({
    mutationFn: ({ id, is_active }) => api.patch(`/dietary/orders/${id}`, { is_active }),
    onSuccess: () => { toast.success('Diet order updated'); refresh() },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update diet order'),
  })

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Dietary Intelligence & Nutrition</h1><p className="page-sub">{orders.length} active diet orders with allergy and restriction controls</p></div>
        <button className="btn-primary" onClick={() => setShowModal(true)}><Utensils size={16} /> New Diet Order</button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon={<Apple size={22} />} value={orders.length} label="Active diets" color="green" />
        <StatCard icon={<ShieldAlert size={22} />} value={allergyRisk} label="Allergy flags" color="red" />
        <StatCard icon={<Utensils size={22} />} value={tubeFeeds} label="Tube feeds" color="amber" />
        <StatCard icon={<Flame size={22} />} value={highCal} label="High calorie plans" color="blue" />
      </div>

      {allergyRisk > 0 && <div className="alert-red"><ShieldAlert size={18} /> <span>{allergyRisk} diet orders include allergy controls. Verify tray labels before dispatch.</span></div>}

      <div className="card">
        <div className="relative"><Search className="absolute left-3 top-2.5 text-slate-500" size={16} /><input className="input pl-9" placeholder="Search patient, UHID, diet, allergies..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Patient</th><th>Diet Protocol</th><th>Safety Flags</th><th>Nutrition</th><th>Timeline</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {rows.map(o => (
                  <tr key={o.id}>
                    <td><div className="text-xs font-medium text-white">{o.patient?.first_name} {o.patient?.last_name}</div><div className="text-[10px] text-slate-400">{o.patient?.uhid}</div></td>
                    <td><div className="text-xs text-white">{o.diet_type}</div><div className="text-[10px] text-slate-500">{o.is_tube_feed ? 'Tube feed protocol' : 'Oral diet'}</div></td>
                    <td><div className="flex flex-wrap gap-1">{(o.allergies || []).map(a => <span key={a} className="badge-red text-[10px]">{a}</span>)}{(o.restrictions || []).map(r => <span key={r} className="badge-amber text-[10px]">{r}</span>)}{!o.allergies?.length && !o.restrictions?.length && <span className="badge-green">Clear</span>}</div></td>
                    <td className="text-xs">{o.calories ? `${o.calories} kcal` : '-'}</td>
                    <td className="text-xs text-slate-400">{fmt.date(o.start_date)}{o.end_date ? ` - ${fmt.date(o.end_date)}` : ''}</td>
                    <td><Badge status={o.is_active ? 'ACTIVE' : 'INACTIVE'} /></td>
                    <td><button className="btn text-xs px-2 py-1" onClick={() => statusMut.mutate({ id: o.id, is_active: !o.is_active })}>{o.is_active ? 'Hold' : 'Activate'}</button></td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No diet orders</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nutrition Order" size="lg">
        <form onSubmit={form.handleSubmit(d => dietMut.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Patient UHID / reference" required><input className="input" {...form.register('patient_id', { required: true })} /></Field>
            <Field label="Diet type" required><select className="select" {...form.register('diet_type', { required: true })}>{dietTypes.map(d => <option key={d}>{d}</option>)}</select></Field>
            <Field label="Calories target"><input type="number" className="input" {...form.register('calories')} /></Field>
            <Field label="End date"><input type="date" className="input" {...form.register('end_date')} /></Field>
          </div>
          <Field label="Restrictions"><input className="input" placeholder="Comma separated: low salt, low sugar" {...form.register('restrictions')} /></Field>
          <Field label="Allergies"><input className="input" placeholder="Comma separated: peanut, egg" {...form.register('allergies')} /></Field>
          <Field label="Notes"><textarea className="textarea" rows={3} {...form.register('notes')} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('is_tube_feed')} /> Tube feed with intake monitoring</label>
          <SubmitRow loading={dietMut.isPending} label="Create nutrition order" onCancel={() => setShowModal(false)} />
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
