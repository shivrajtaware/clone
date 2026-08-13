import { useMemo, useState, useEffect} from 'react'
import { io } from 'socket.io-client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../utils/api'
import { getSocketUrl } from '../utils/runtimeConfig'
import Modal from '../components/common/Modal'
import StatCard, { Badge, EmptyState, Spinner } from '../components/common/StatCard'
import { DRUG_FORMS, DRUG_ROUTES } from '../utils/drugForms'

const newItem = () => ({
  drug_name: '',
  generic_name: '',
  strength: '',
  form: '',
  dose: '',
  frequency: 'BD',
  duration: '3 days',
  route: 'Oral',
  instructions: '',
  quantity: '',
})

const newForm = () => ({
  name: '',
  condition: '',
  description: '',
  is_active: true,
  items: [newItem()],
})

const toForm = (stack) => ({
  name: stack.name || '',
  condition: stack.condition || '',
  description: stack.description || '',
  is_active: stack.is_active !== false,
  items: (stack.items?.length ? stack.items : [newItem()]).map(item => ({
    drug_name: item.drug_name || '',
    generic_name: item.generic_name || '',
    strength: item.strength || '',
    form: item.form || '',
    dose: item.dose || '',
    frequency: item.frequency || 'BD',
    duration: item.duration || '',
    route: item.route || 'Oral',
    instructions: item.instructions || '',
    quantity: item.quantity ?? '',
  })),
})

const toPayload = (form) => ({
  name: form.name.trim(),
  condition: form.condition.trim() || null,
  description: form.description.trim() || null,
  is_active: form.is_active,
  items: form.items.map((item, index) => ({
    ...item,
    drug_name: item.drug_name.trim(),
    generic_name: item.generic_name.trim() || null,
    strength: item.strength.trim() || null,
    form: item.form.trim() || null,
    dose: item.dose.trim(),
    frequency: item.frequency.trim(),
    duration: item.duration.trim(),
    route: item.route.trim() || 'Oral',
    instructions: item.instructions.trim() || null,
    quantity: item.quantity === '' ? null : Number(item.quantity),
    sort_order: index,
  })),
})

export default function MedicineStacksPage() {
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(newForm)
  const qc = useQueryClient()
  useEffect(() => {
      const socket = io(getSocketUrl(), { auth: { token: localStorage.getItem('token') } })
    socket.on('medicineStacks:updated', () => {
      qc.invalidateQueries({ queryKey: ['medicine-stacks'] })
    })
    return () => socket.disconnect()
  }, [qc])

  const { data, isLoading } = useQuery({
    queryKey: ['medicine-stacks'],
    queryFn: () => api.get('/medicine-stacks').then(r => r.data.data),
  })

  const stacks = data || []
  const stats = useMemo(() => ({
    total: stacks.length,
    active: stacks.filter(s => s.is_active).length,
    medicines: stacks.reduce((sum, stack) => sum + (stack.items?.length || 0), 0),
  }), [stacks])

  const createMut = useMutation({
    mutationFn: (body) => api.post('/medicine-stacks', body).then(r => r.data.data),
    onSuccess: () => {
      toast.success('Medicine stack created')
      qc.invalidateQueries(['medicine-stacks'])
      closeModal()
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Unable to save medicine stack'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => api.put(`/medicine-stacks/${id}`, body).then(r => r.data.data),
    onSuccess: () => {
      toast.success('Medicine stack updated')
      qc.invalidateQueries(['medicine-stacks'])
      closeModal()
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Unable to update medicine stack'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/medicine-stacks/${id}`),
    onSuccess: () => {
      toast.success('Medicine stack deleted')
      qc.invalidateQueries(['medicine-stacks'])
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Unable to delete medicine stack'),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(newForm())
    setShowModal(true)
  }

  const openEdit = (stack) => {
    setEditing(stack)
    setForm(toForm(stack))
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
    setForm(newForm())
  }

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const updateItem = (index, field, value) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }))
  }

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, newItem()] }))
  const removeItem = (index) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))

  const submit = (e) => {
    e.preventDefault()
    const body = toPayload(form)
    if (editing) updateMut.mutate({ id: editing.id, body })
    else createMut.mutate(body)
  }

  const saving = createMut.isPending || updateMut.isPending

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Medicine Stacks</h1>
          <p className="page-sub">{stats.active} active stacks ready for OPD check-in</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ Create Stack</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard icon="Rx" value={stats.total} label="Total Stacks" color="cyan" />
        <StatCard icon="ON" value={stats.active} label="Active" color="green" />
        <StatCard icon="M" value={stats.medicines} label="Medicines Added" color="purple" />
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : stacks.length === 0 ? (
          <EmptyState icon="Rx" title="No medicine stacks" description="Create a stack for cough, fever, cold, allergies, or any common OPD case." action={<button className="btn-primary mt-2" onClick={openCreate}>+ Create Stack</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Stack</th><th>Condition / Allergy</th><th>Medicines</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {stacks.map(stack => (
                  <tr key={stack.id}>
                    <td>
                      <div className="font-medium text-white text-xs">{stack.name}</div>
                      {stack.description && <div className="text-[10px] text-slate-400 max-w-[240px] truncate">{stack.description}</div>}
                    </td>
                    <td className="text-xs">{stack.condition || '-'}</td>
                    <td>
                      <div className="flex gap-1 flex-wrap max-w-md">
                        {(stack.items || []).slice(0, 4).map(item => (
                          <span key={item.id} className="badge badge-cyan">{item.drug_name}{item.strength ? ` ${item.strength}` : ''}</span>
                        ))}
                        {(stack.items || []).length > 4 && <span className="badge badge-gray">+{stack.items.length - 4}</span>}
                      </div>
                    </td>
                    <td><Badge status={stack.is_active ? 'ACTIVE' : 'INACTIVE'} /></td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn text-xs px-2 py-1" onClick={() => openEdit(stack)}>Edit</button>
                        <button className="btn text-xs px-2 py-1 text-brand-red" onClick={() => window.confirm('Delete this medicine stack?') && deleteMut.mutate(stack.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={closeModal} title={editing ? 'Edit Medicine Stack' : 'Create Medicine Stack'} size="xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Stack Name *</label>
              <input className="input" required value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="e.g. Fever Basic" />
            </div>
            <div>
              <label className="label">Condition / Allergy</label>
              <input className="input" value={form.condition} onChange={e => updateField('condition', e.target.value)} placeholder="e.g. Cough, fever, cold" />
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <input className="input" value={form.description} onChange={e => updateField('description', e.target.value)} placeholder="Optional internal note" />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => updateField('is_active', e.target.checked)} />
            <span>Active for OPD dropdown</span>
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Medicines</h3>
              <button type="button" className="btn text-xs" onClick={addItem}>+ Add Medicine</button>
            </div>

            {form.items.map((item, index) => (
              <div key={index} className="bg-navy-800 rounded-xl p-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <div className="md:col-span-2">
                    <label className="label">Drug Name *</label>
                    <input className="input" required value={item.drug_name} onChange={e => updateItem(index, 'drug_name', e.target.value)} placeholder="Generic or brand name" />
                  </div>
                  <div>
                    <label className="label">Strength</label>
                    <input className="input" value={item.strength} onChange={e => updateItem(index, 'strength', e.target.value)} placeholder="500mg" />
                  </div>
                  <div>
                    <label className="label">Form</label>
                    <input className="input" list="medicine-stack-forms" value={item.form} onChange={e => updateItem(index, 'form', e.target.value)} placeholder="Tablet / Syrup / Injection / Inhaler" />
                  </div>
                  <div>
                    <label className="label">Dose *</label>
                    <input className="input" required value={item.dose} onChange={e => updateItem(index, 'dose', e.target.value)} placeholder="1 tablet / 5 ml / 1 vial" />
                  </div>
                  <div>
                    <label className="label">Frequency *</label>
                    <select className="select" required value={item.frequency} onChange={e => updateItem(index, 'frequency', e.target.value)}>
                      {['OD','BD','TDS','QID','SOS','Nocte','Stat'].map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Route</label>
                    <select className="select" value={item.route} onChange={e => updateItem(index, 'route', e.target.value)}>
                      {DRUG_ROUTES.map(route => <option key={route}>{route}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Duration *</label>
                    <input className="input" required value={item.duration} onChange={e => updateItem(index, 'duration', e.target.value)} placeholder="3 days" />
                  </div>
                  <div>
                    <label className="label">Quantity</label>
                    <input type="number" min="0" className="input" value={item.quantity} onChange={e => updateItem(index, 'quantity', e.target.value)} />
                  </div>
                  <div className="md:col-span-3">
                    <label className="label">Instructions</label>
                    <input className="input" value={item.instructions} onChange={e => updateItem(index, 'instructions', e.target.value)} placeholder="e.g. After food" />
                  </div>
                  <div className="flex items-end">
                    <button type="button" disabled={form.items.length <= 1} className="btn-danger w-full text-xs" onClick={() => removeItem(index)}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Stack'}</button>
            <button type="button" className="btn flex-1" onClick={closeModal}>Cancel</button>
          </div>
        </form>
        <datalist id="medicine-stack-forms">{DRUG_FORMS.map(form => <option key={form} value={form} />)}</datalist>
      </Modal>
    </div>
  )
}
