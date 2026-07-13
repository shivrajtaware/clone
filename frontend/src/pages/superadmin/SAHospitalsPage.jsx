// src/pages/superadmin/SAHospitalsPage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import Modal from '../../components/common/Modal'
import { Badge, Spinner } from '../../components/common/StatCard'
import { fmt, MODULES } from '../../utils/helpers'

export default function SAHospitalsPage() {
  const [search, setSearch]           = useState('')
  const [licenseFilter, setLicenseFilter] = useState('')
  const [activeFilter, setActiveFilter]   = useState('')
  const [showAddModal, setShowAddModal]   = useState(false)
  const [showModules, setShowModules]     = useState(null)   // hospital object
  const [showExtend, setShowExtend]       = useState(null)   // hospital object
  const [selectedModules, setSelectedModules] = useState([])
  const qc = useQueryClient()
  const { register, handleSubmit, reset } = useForm()
  const { register: regE, handleSubmit: hsE, reset: resetE } = useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['sa-hospitals', search, licenseFilter, activeFilter],
    queryFn: () => api.get('/superadmin/hospitals', {
      params: { search, ...(licenseFilter && { license_type: licenseFilter }), ...(activeFilter !== '' && { is_active: activeFilter }) }
    }).then(r => r.data.data),
  })

  const addMut = useMutation({
    mutationFn: (d) => api.post('/superadmin/hospitals', d),
    onSuccess: (r) => {
      toast.success(`Hospital "${r.data.data?.name}" added successfully!`)
      qc.invalidateQueries(['sa-hospitals']); qc.invalidateQueries(['sa-stats'])
      setShowAddModal(false); reset()
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add hospital'),
  })

  const toggleMut = useMutation({
    mutationFn: (id) => api.patch(`/superadmin/hospitals/${id}/toggle`),
    onSuccess: (r) => {
      toast.success(`Hospital ${r.data.data.is_active ? 'activated' : 'suspended'}`)
      qc.invalidateQueries(['sa-hospitals'])
    },
  })

  const extendMut = useMutation({
    mutationFn: ({ id, ...d }) => api.post(`/superadmin/hospitals/${id}/extend-license`, d),
    onSuccess: () => { toast.success('License extended!'); qc.invalidateQueries(['sa-hospitals']); setShowExtend(null); resetE() },
  })

  const modulesMut = useMutation({
    mutationFn: ({ id, modules }) => api.patch(`/superadmin/hospitals/${id}/modules`, { modules_enabled: modules }),
    onSuccess: () => { toast.success('Modules updated'); qc.invalidateQueries(['sa-hospitals']); setShowModules(null) },
  })

  const hospitals = data || []

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hospitals</h1>
          <p className="page-sub">{hospitals.length} registered hospitals</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Add Hospital</button>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3">
        <input className="input flex-1 min-w-[200px]" placeholder="Search by name, code, city..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="select w-40" value={licenseFilter} onChange={e => setLicenseFilter(e.target.value)}>
          <option value="">All Licenses</option>
          {['BASIC','PROFESSIONAL','ENTERPRISE'].map(l => <option key={l}>{l}</option>)}
        </select>
        <select className="select w-36" value={activeFilter} onChange={e => setActiveFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Suspended</option>
        </select>
        <button className="btn" onClick={() => { setSearch(''); setLicenseFilter(''); setActiveFilter('') }}>Clear</button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? <div className="flex justify-center py-12"><Spinner size="lg" /></div> :
        hospitals.length === 0 ? <div className="py-12 text-center text-slate-400">No hospitals found</div> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Hospital</th><th>Location</th><th>License</th><th>Beds</th>
                  <th>Patients</th><th>Users</th><th>License Status</th><th>Active</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hospitals.map(h => (
                  <tr key={h.id}>
                    <td>
                      <div className="text-sm font-semibold text-white">{h.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{h.code}</div>
                    </td>
                    <td className="text-xs text-slate-300">{h.city}, {h.state}</td>
                    <td>
                      <span className={`badge ${h.license_type === 'ENTERPRISE' ? 'badge-purple' : h.license_type === 'PROFESSIONAL' ? 'badge-blue' : 'badge-gray'}`}>
                        {h.license_type}
                      </span>
                    </td>
                    <td className="text-xs">{h.bed_count}</td>
                    <td className="text-xs">{(h.patient_count || 0).toLocaleString()}</td>
                    <td className="text-xs">{h.user_count}</td>
                    <td>
                      {h.license_status === 'EXPIRED' ? (
                        <span className="badge badge-red">⛔ Expired</span>
                      ) : h.license_status === 'EXPIRING_SOON' ? (
                        <span className="badge badge-amber">⚠️ {h.days_remaining}d left</span>
                      ) : (
                        <span className="badge badge-green">✅ {h.days_remaining}d left</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => toggleMut.mutate(h.id)}
                        className={`relative inline-flex h-5 w-9 rounded-full transition-colors cursor-pointer ${h.is_active ? 'bg-brand-green' : 'bg-slate-600'}`}
                      >
                        <span className={`inline-block w-4 h-4 bg-white rounded-full transition-transform mt-0.5 ${h.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <Link to={`/superadmin/hospitals/${h.id}`} className="btn text-[10px] px-1.5 py-1">View</Link>
                        <button className="btn text-[10px] px-1.5 py-1" onClick={() => { setShowExtend(h); resetE() }}>Extend</button>
                        <button className="btn text-[10px] px-1.5 py-1" onClick={() => { setShowModules(h); setSelectedModules(h.modules_enabled || []) }}>Modules</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Hospital Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Hospital" size="xl">
        <form onSubmit={handleSubmit(d => addMut.mutate(d))} className="space-y-4">
          <div className="text-xs text-slate-400 bg-navy-800 rounded-lg px-3 py-2">
            ℹ️ Adding a hospital creates an isolated tenant. Each hospital's data is completely separate.
          </div>

          <div className="text-sm font-semibold text-cyan border-b border-default pb-2">Hospital Details</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Hospital Name *</label><input className="input" placeholder="e.g. City General Hospital" {...register('name', { required: true })} /></div>
            <div><label className="label">Hospital Code * (unique, max 10 chars)</label><input className="input" placeholder="e.g. CITYHOSP1" maxLength={10} {...register('code', { required: true })} /></div>
            <div><label className="label">Bed Capacity</label><input type="number" className="input" placeholder="100" {...register('bed_capacity')} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">City</label><input className="input" {...register('city')} /></div>
            <div><label className="label">State</label><input className="input" {...register('state')} /></div>
            <div><label className="label">Pincode</label><input className="input" {...register('pincode')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Phone</label><input className="input" {...register('phone')} /></div>
            <div><label className="label">Email</label><input type="email" className="input" {...register('email')} /></div>
          </div>
          <div><label className="label">Address</label><input className="input" {...register('address')} /></div>

          <div className="text-sm font-semibold text-cyan border-b border-default pb-2 mt-4">License & Modules</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">License Type *</label>
              <select className="select" {...register('license_type', { required: true })}>
                <option value="BASIC">Basic — ₹9,999/year</option>
                <option value="PROFESSIONAL">Professional — ₹24,999/year</option>
                <option value="ENTERPRISE">Enterprise — ₹49,999/year</option>
              </select>
            </div>
            <div>
              <label className="label">License Duration (days)</label>
              <select className="select" {...register('license_days')}>
                <option value="30">30 days (Trial)</option>
                <option value="90">90 days</option>
                <option value="180">180 days (6 months)</option>
                <option value="365" selected>365 days (1 year)</option>
                <option value="730">730 days (2 years)</option>
              </select>
            </div>
          </div>

          <div className="text-sm font-semibold text-cyan border-b border-default pb-2 mt-4">Hospital Admin Account</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Admin Full Name</label><input className="input" placeholder="John Smith" {...register('admin_name')} /></div>
            <div><label className="label">Admin Email *</label><input type="email" className="input" placeholder="admin@hospital.com" {...register('admin_email', { required: true })} /></div>
          </div>
          <div><label className="label">Admin Password (default: Admin@123)</label><input type="password" className="input" placeholder="Leave blank for default" {...register('admin_password')} /></div>

          <div className="flex gap-2 pt-3">
            <button type="submit" disabled={addMut.isPending} className="btn-primary flex-1">
              {addMut.isPending ? 'Creating hospital...' : '🏥 Create Hospital & Admin Account'}
            </button>
            <button type="button" className="btn flex-1" onClick={() => setShowAddModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Extend License Modal */}
      <Modal open={!!showExtend} onClose={() => setShowExtend(null)} title={`Extend License — ${showExtend?.name}`}>
        {showExtend && (
          <form onSubmit={hsE(d => extendMut.mutate({ id: showExtend.id, ...d }))} className="space-y-4">
            <div className="bg-navy-800 rounded-xl p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Current License</span><Badge status={showExtend.license_type} /></div>
              <div className="flex justify-between"><span className="text-slate-400">Expires</span><span className={`font-medium ${showExtend.license_status === 'EXPIRED' ? 'text-brand-red' : 'text-brand-amber'}`}>{fmt.date(showExtend.license_end)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Days Remaining</span><span>{showExtend.days_remaining > 0 ? `${showExtend.days_remaining} days` : '⛔ Expired'}</span></div>
            </div>
            <div>
              <label className="label">Upgrade License Type (optional)</label>
              <select className="select" {...regE('license_type')}>
                <option value="">Keep current ({showExtend.license_type})</option>
                <option value="BASIC">Downgrade to Basic</option>
                <option value="PROFESSIONAL">Upgrade to Professional</option>
                <option value="ENTERPRISE">Upgrade to Enterprise</option>
              </select>
            </div>
            <div>
              <label className="label">Extend by (days) *</label>
              <select className="select" {...regE('days', { required: true })}>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days (6 months)</option>
                <option value="365">365 days (1 year)</option>
                <option value="730">730 days (2 years)</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={extendMut.isPending} className="btn-primary flex-1">
                {extendMut.isPending ? 'Extending...' : '✅ Extend License'}
              </button>
              <button type="button" className="btn flex-1" onClick={() => setShowExtend(null)}>Cancel</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Manage Modules Modal */}
      <Modal open={!!showModules} onClose={() => setShowModules(null)} title={`Manage Modules — ${showModules?.name}`} size="lg">
        {showModules && (
          <div className="space-y-4">
            <div className="text-xs text-slate-400 bg-navy-800 rounded-lg px-3 py-2">
              Enable or disable specific modules for this hospital. Changes take effect immediately.
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MODULES.map(m => (
                <label key={m.key} className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border transition-all ${selectedModules.includes(m.key) ? 'bg-cyan/8 border-cyan/30' : 'bg-navy-800 border-default'}`}>
                  <input
                    type="checkbox"
                    checked={selectedModules.includes(m.key)}
                    onChange={e => {
                      if (e.target.checked) setSelectedModules(prev => [...prev, m.key])
                      else setSelectedModules(prev => prev.filter(k => k !== m.key))
                    }}
                    className="rounded"
                  />
                  <span className="text-xs text-slate-300">{m.label}</span>
                </label>
              ))}
            </div>
            <div className="text-xs text-slate-400">{selectedModules.length} of {MODULES.length} modules enabled</div>
            <div className="flex gap-2">
              <button
                className="btn-primary flex-1"
                disabled={modulesMut.isPending}
                onClick={() => modulesMut.mutate({ id: showModules.id, modules: selectedModules })}
              >
                {modulesMut.isPending ? 'Saving...' : '✅ Save Module Config'}
              </button>
              <button className="btn flex-1" onClick={() => setShowModules(null)}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
