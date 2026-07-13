// src/pages/superadmin/SAHospitalDetailPage.jsx
import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { Badge, Spinner, EmptyState } from '../../components/common/StatCard'
import StatCard from '../../components/common/StatCard'
import Modal from '../../components/common/Modal'
import { fmt, ROLE_LABELS } from '../../utils/helpers'
import { KeyRound, ShieldCheck, ShieldOff } from 'lucide-react'

const BED_TYPES = ['GENERAL', 'SEMI_PRIVATE', 'PRIVATE', 'DELUXE', 'ICU', 'HDU', 'NICU', 'PICU', 'LABOUR']
const BED_STATUS = ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'RESERVED', 'MAINTENANCE']

export default function SAHospitalDetailPage() {
  const { id } = useParams()
  const qc = useQueryClient()

  // Bed Management States
  const [showBedModal, setShowBedModal] = useState(false)
  const [showBatchBedModal, setShowBatchBedModal] = useState(false)
  const [editingBed, setEditingBed] = useState(null)
  const [bedSearch, setBedSearch] = useState('')
  const [bedWardFilter, setBedWardFilter] = useState('')
  const [bedStatusFilter, setBedStatusFilter] = useState('')
  const [bedTypeFilter, setBedTypeFilter] = useState('')
  const { register: registerBed, handleSubmit: handleBedSubmit, reset: resetBed } = useForm()
  const { register: registerBatchBed, handleSubmit: handleBatchBedSubmit, reset: resetBatchBed } = useForm()

  // Staff Access Control States
  const [showResetPwModal, setShowResetPwModal] = useState(null) // user object
  const { register: registerPw, handleSubmit: handlePwSubmit, reset: resetPw } = useForm()

  // 1. Fetch Hospital Details
  const { data: hospital, isLoading } = useQuery({
    queryKey: ['sa-hospital', id],
    queryFn: () => api.get(`/superadmin/hospitals/${id}`).then(r => r.data.data),
    enabled: !!id,
  })

  // 2. Fetch Beds for this Hospital
  const { data: bedsData, isLoading: isLoadingBeds } = useQuery({
    queryKey: ['beds', id],
    queryFn: () => api.get(`/beds`, { params: { hospital_id: id } }).then(r => r.data),
    enabled: !!id,
  })

  const beds = bedsData?.data || []

  const wardOptions = useMemo(() => [...new Set(beds.map(b => b.ward).filter(Boolean))].sort(), [beds])

  const filteredBeds = useMemo(() => beds.filter(b => {
    if (bedWardFilter && b.ward !== bedWardFilter) return false
    if (bedStatusFilter && b.status !== bedStatusFilter) return false
    if (bedTypeFilter && b.bed_type !== bedTypeFilter) return false
    if (bedSearch) {
      const q = bedSearch.toLowerCase()
      const hay = `${b.bed_no} ${b.ward} ${b.room_no || ''} ${b.floor || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }), [beds, bedWardFilter, bedStatusFilter, bedTypeFilter, bedSearch])

  // Hospital Toggle Mutation
  const toggleMut = useMutation({
    mutationFn: () => api.patch(`/superadmin/hospitals/${id}/toggle`),
    onSuccess: (r) => {
      toast.success(`Hospital ${r.data.data.is_active ? 'activated' : 'suspended'}`)
      qc.invalidateQueries(['sa-hospital', id])
    },
  })

  // Bed Mutations
  const createBedMut = useMutation({
    mutationFn: (body) => api.post('/beds', { ...body, hospital_id: id }),
    onSuccess: () => {
      toast.success('Bed added successfully!')
      qc.invalidateQueries(['beds', id])
      closeBedModal()
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add bed'),
  })

  const updateBedMut = useMutation({
    mutationFn: ({ bedId, body }) => api.put(`/beds/${bedId}`, body),
    onSuccess: () => {
      toast.success('Bed updated successfully!')
      qc.invalidateQueries(['beds', id])
      closeBedModal()
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update bed'),
  })

  const deleteBedMut = useMutation({
    mutationFn: (bedId) => api.delete(`/beds/${bedId}`),
    onSuccess: () => {
      toast.success('Bed deleted!')
      qc.invalidateQueries(['beds', id])
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to delete bed'),
  })

  const batchCreateBedMut = useMutation({
    mutationFn: async (body) => {
      const roomCount = Math.max(1, Number(body.room_count || 1))
      const bedsPerRoom = Math.max(1, Number(body.beds_per_room || body.quantity || 1))
      const roomStart = Number(body.room_start || 1)
      const bedStart = Number(body.start_number || 1)
      const pad = Math.max(1, Number(body.pad_length || 2))
      const roomPrefix = body.room_prefix || ''
      const bedPrefix = body.bed_prefix || 'B'
      const operations = []

      for (let r = 0; r < roomCount; r += 1) {
        const roomNo = body.room_no || `${roomPrefix}${roomStart + r}`
        for (let b = 0; b < bedsPerRoom; b += 1) {
          const bedNo = `${bedPrefix}-${roomNo}-${String(bedStart + b).padStart(pad, '0')}`
          operations.push(api.post('/beds', {
            hospital_id: id,
            ward: body.ward,
            floor: body.floor,
            room_no: roomNo,
            bed_no: bedNo,
            bed_type: body.bed_type,
            status: body.status,
          }))
        }
      }

      await Promise.all(operations)
    },    onSuccess: () => {
      toast.success('Beds created successfully!')
      qc.invalidateQueries(['beds', id])
      closeBatchBedModal()
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to create beds'),
  })

  // Staff mutations
  const resetPwMut = useMutation({
    mutationFn: ({ userId, newPassword }) => api.patch(`/superadmin/users/${userId}/reset-password`, { newPassword }),
    onSuccess: (r) => {
      toast.success(r.data.message || 'Password reset successfully')
      setShowResetPwModal(null); resetPw()
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to reset password'),
  })

  const toggleUserMut = useMutation({
    mutationFn: (userId) => api.patch(`/superadmin/users/${userId}/toggle`),
    onSuccess: (r) => {
      toast.success(r.data.message || 'User updated')
      qc.invalidateQueries(['sa-hospital', id])
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update user'),
  })

  // Bed Modal Handlers
  const openBedModal = (bed = null) => {
    setEditingBed(bed)
    if (bed) {
      resetBed({
        ward: bed.ward,
        room_no: bed.room_no,
        bed_no: bed.bed_no,
        floor: bed.floor,
        bed_type: bed.bed_type,
        status: bed.status
      })
    } else {
      resetBed({ bed_type: 'GENERAL', status: 'AVAILABLE' })
    }
    setShowBedModal(true)
  }

  const closeBedModal = () => {
    setShowBedModal(false)
    setEditingBed(null)
    resetBed()
  }

  const openBatchBedModal = () => {
    resetBatchBed({
      ward: '',
      floor: '',
      room_no: '',
      room_prefix: '',
      room_start: 101,
      room_count: 1,
      beds_per_room: 4,
      bed_prefix: 'B',
      start_number: 1,
      pad_length: 2,
      bed_type: 'GENERAL',
      status: 'AVAILABLE',
    })
    setShowBatchBedModal(true)
  }

  const closeBatchBedModal = () => {
    setShowBatchBedModal(false)
    resetBatchBed()
  }

  const onBedSubmit = (data) => {
    if (editingBed) {
      updateBedMut.mutate({ bedId: editingBed.id, body: data })
    } else {
      createBedMut.mutate(data)
    }
  }

  const onBatchBedSubmit = (data) => {
    batchCreateBedMut.mutate({ ...data, room_count: Number(data.room_count || 1), beds_per_room: Number(data.beds_per_room || 1), room_start: Number(data.room_start || 1), start_number: Number(data.start_number || 1), pad_length: Number(data.pad_length || 2) })
  }

  const openResetPwModal = (user) => {
    setShowResetPwModal(user)
    resetPw()
  }

  const onResetPwSubmit = (data) => {
    if (data.newPassword !== data.confirmPassword) { toast.error('Passwords do not match'); return }
    resetPwMut.mutate({ userId: showResetPwModal.id, newPassword: data.newPassword })
  }

  const bedStats = beds.reduce((acc, bed) => {
    acc.total += 1
    acc[bed.status] = (acc[bed.status] || 0) + 1
    return acc
  }, { total: 0, AVAILABLE: 0, OCCUPIED: 0, CLEANING: 0, RESERVED: 0, MAINTENANCE: 0 })

  const wardSummary = beds.reduce((acc, bed) => {
    const key = bed.ward || 'Unassigned'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const bedLayoutGroups = filteredBeds.reduce((acc, bed) => {
    const key = `${bed.floor || 'No floor'} / ${bed.ward || 'Unassigned'}`
    if (!acc[key]) acc[key] = []
    acc[key].push(bed)
    return acc
  }, {})

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (!hospital) return <div className="text-center py-20 text-slate-400">Hospital not found</div>

  const h = hospital

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="page-header flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/superadmin/hospitals" className="text-slate-400 hover:text-white text-sm">← Hospitals</Link>
            <span className="text-slate-600">/</span>
            <h1 className="page-title">{h.name}</h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-xs text-cyan">{h.code}</span>
            <Badge status={h.is_active ? 'ACTIVE' : 'SUSPENDED'} />
            <Badge status={h.license_type} />
          </div>
        </div>
        <div className="flex gap-2">
          <button className={`btn ${h.is_active ? 'text-brand-red border-brand-red/30 hover:bg-brand-red hover:text-white' : 'text-brand-green border-brand-green/30 hover:bg-brand-green hover:text-navy-900'}`}
            onClick={() => toggleMut.mutate()}>{h.is_active ? '⛔ Suspend' : '✅ Activate'}</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="🛏️" value={h._count?.beds || 0} label="Total Beds" color="cyan" />
        <StatCard icon="👥" value={h._count?.patients || 0} label="Total Patients" color="purple" />
        <StatCard icon="👤" value={h._count?.users || 0} label="Staff Users" color="blue" />
        <StatCard icon="📋" value={h._count?.bills || 0} label="Total Bills" color="green" />
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hospital Info */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-3">Hospital Information</h3>
          <div className="space-y-2 text-sm">
            {[['Address', h.address],['City', h.city],['State', h.state],['Pincode', h.pincode],['Phone', h.phone],['Email', h.email],['NABH No.', h.nabh_number],['GSTIN', h.gstin],['Bed Capacity', h.bed_capacity]].map(([k, v]) => v && (
              <div key={k} className="flex justify-between">
                <span className="text-slate-400">{k}</span>
                <span className="text-white">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* License Info */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-3">License Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">License Type</span><Badge status={h.license_type} /></div>
            <div className="flex justify-between"><span className="text-slate-400">Start Date</span><span>{fmt.date(h.license_start)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Expiry Date</span><span className={new Date(h.license_end) < new Date() ? 'text-brand-red font-medium' : ''}>{fmt.date(h.license_end)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Status</span>
              {new Date(h.license_end) < new Date() ? <span className="badge badge-red">Expired</span> :
               new Date(h.license_end) < new Date(Date.now() + 30 * 86400000) ? <span className="badge badge-amber">Expiring Soon</span> :
               <span className="badge badge-green">Active</span>}
            </div>
            <div className="mt-3"><span className="text-xs text-slate-400">Enabled Modules ({h.modules_enabled?.length})</span></div>
            <div className="flex flex-wrap gap-1 mt-1">{(h.modules_enabled || []).map(m => <span key={m} className="badge badge-cyan text-[9px]">{m}</span>)}</div>
          </div>
        </div>
      </div>

      {/* ══════════════ Bed Management Section ══════════════ */}
      <div className="card p-0 overflow-hidden mt-2">
        <div className="px-4 py-3 border-b border-default flex flex-wrap justify-between items-center gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">🛏️ Bed Command Center</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Create wards, floors, rooms, bed numbers, and operational bed status from one place.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn text-xs px-3 py-1.5" onClick={() => openBatchBedModal()}>⚡ Bulk Add</button>
            <button className="btn-primary text-xs px-3 py-1.5" onClick={() => openBedModal()}>+ Add Bed</button>
          </div>
        </div>

        {/* Status summary strip - color coded, click-to-filter */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 border-b border-default/60 bg-navy-900/80">
          {[
            ['', 'Total', bedStats.total || 0, 'slate'],
            ['AVAILABLE', 'Available', bedStats.AVAILABLE || 0, 'green'],
            ['OCCUPIED', 'Occupied', bedStats.OCCUPIED || 0, 'red'],
            ['RESERVED', 'Reserved', bedStats.RESERVED || 0, 'blue'],
            ['CLEANING', 'Cleaning / Maint.', (bedStats.CLEANING || 0) + (bedStats.MAINTENANCE || 0), 'amber'],
          ].map(([statusVal, label, count, color]) => (
            <button
              key={label}
              onClick={() => setBedStatusFilter(prev => prev === statusVal ? '' : statusVal)}
              className={`rounded-lg border p-2 text-center transition-all ${bedStatusFilter === statusVal ? `border-${color === 'slate' ? 'cyan' : color}-400 bg-${color === 'slate' ? 'cyan' : color}-400/10` : 'border-default/50 hover:border-default'}`}
            >
              <div className={`text-lg font-bold ${color === 'green' ? 'text-brand-green' : color === 'red' ? 'text-brand-red' : color === 'blue' ? 'text-brand-blue' : color === 'amber' ? 'text-brand-amber' : 'text-white'}`}>{count}</div>
              <div className="text-[10px] text-slate-400">{label}</div>
            </button>
          ))}
        </div>

        {/* Filters row - clearly labeled so it's obvious "where is what" */}
        <div className="flex flex-wrap items-end gap-2 p-3 border-b border-default/60">
          <div className="min-w-[180px] flex-1">
            <label className="label text-[10px]">Search (bed no / room / floor)</label>
            <input className="input text-xs" placeholder="e.g. B-01, 101, 2nd Floor" value={bedSearch} onChange={e => setBedSearch(e.target.value)} />
          </div>
          <div>
            <label className="label text-[10px]">Ward</label>
            <select className="select text-xs w-36" value={bedWardFilter} onChange={e => setBedWardFilter(e.target.value)}>
              <option value="">All Wards</option>
              {wardOptions.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-[10px]">Bed Type</label>
            <select className="select text-xs w-36" value={bedTypeFilter} onChange={e => setBedTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              {BED_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-[10px]">Status</label>
            <select className="select text-xs w-32" value={bedStatusFilter} onChange={e => setBedStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              {BED_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button className="btn text-xs px-2 py-1.5" onClick={() => { setBedSearch(''); setBedWardFilter(''); setBedStatusFilter(''); setBedTypeFilter('') }}>Clear</button>
          <div className="text-[11px] text-slate-500 ml-auto pb-1.5">Showing {filteredBeds.length} of {beds.length} beds</div>
        </div>

        {/* Ward overview chips */}
        <div className="p-3 border-b border-default/60 bg-navy-900/60">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">Ward Overview (click to filter)</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(wardSummary).map(([ward, count]) => (
              <button key={ward} onClick={() => setBedWardFilter(prev => prev === ward ? '' : ward)}
                className={`badge text-[10px] transition-all ${bedWardFilter === ward ? 'badge-purple' : 'badge-cyan'}`}>
                {ward}: {count}
              </button>
            ))}
            {Object.keys(wardSummary).length === 0 && <span className="text-xs text-slate-500">No bed layout created yet.</span>}
          </div>
        </div>

        {isLoadingBeds ? (
          <div className="flex justify-center py-8"><Spinner size="md" /></div>
        ) : filteredBeds.length === 0 ? (
          <EmptyState icon="🛏️" title="No beds found" description="Try clearing filters, or add beds to this hospital to manage admissions." />
        ) : (
          <>
          <div className="p-3 grid grid-cols-1 xl:grid-cols-2 gap-3 border-b border-default/60 bg-navy-900/50">
            {Object.entries(bedLayoutGroups).map(([group, groupBeds]) => (
              <div key={group} className="rounded-xl border border-cyan/15 bg-navy-900 p-3 shadow-lg shadow-cyan/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-white">{group}</div>
                  <div className="text-[10px] text-cyan">{groupBeds.filter(b => b.status === 'AVAILABLE').length} ready / {groupBeds.length}</div>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {groupBeds.map(bed => (
                    <button key={bed.id} onClick={() => openBedModal(bed)} title={`${bed.ward} ${bed.bed_no} - ${bed.status}`}
                      className={`aspect-square rounded-lg border text-[10px] font-bold transition-all ${bed.status === 'AVAILABLE' ? 'border-brand-green/40 bg-brand-green/10 text-brand-green' : bed.status === 'OCCUPIED' ? 'border-brand-red/40 bg-brand-red/10 text-brand-red' : bed.status === 'RESERVED' ? 'border-brand-blue/40 bg-brand-blue/10 text-brand-blue' : 'border-brand-amber/40 bg-brand-amber/10 text-brand-amber'}`}>
                      <div>{bed.bed_no}</div><div className="text-[8px] font-normal opacity-80">{bed.room_no || bed.bed_type}</div>{bed.admissions?.[0]?.patient && <div className="mt-0.5 truncate text-[8px] font-normal opacity-90">{bed.admissions[0].patient.first_name}</div>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Ward</th>
                  <th>Location</th><th>Bed</th><th>Type</th><th>Patient</th><th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBeds.map(bed => (
                  <tr key={bed.id}>
                    <td className="font-medium text-white text-xs">{bed.ward}</td>
                    <td className="text-xs text-slate-300"><div>{bed.floor || 'No floor'}</div><div className="text-[10px] text-slate-500">Room {bed.room_no || '-'}</div></td><td className="font-mono text-cyan text-xs">{bed.bed_no}</td><td className="text-xs">{bed.bed_type.replace('_', ' ')}</td><td className="text-xs text-slate-300">{bed.admissions?.[0]?.patient ? `${bed.admissions[0].patient.first_name} ${bed.admissions[0].patient.last_name || ''}` : '-'}</td><td>
                      <Badge
                        status={bed.status === 'AVAILABLE' ? 'ACTIVE' : bed.status === 'OCCUPIED' ? 'INACTIVE' : 'PENDING'}
                        label={bed.status}
                      />
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn text-[10px] px-2 py-1" onClick={() => openBedModal(bed)}>Edit</button>
                        <button
                          className="btn text-[10px] px-2 py-1 text-brand-red hover:bg-brand-red/10 border-brand-red/20"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this bed?')) {
                              deleteBedMut.mutate(bed.id)
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* ══════════════ Staff Users & Access Control ══════════════ */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-default">
          <div className="text-sm font-semibold text-white flex items-center gap-2"><KeyRound size={15} /> Staff Users & Access Control ({h.users?.length || 0})</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Reset any staff password or suspend their access — instantly, without needing the hospital admin.</p>
        </div>
        <table className="tbl">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Access Control</th></tr></thead>
          <tbody>
            {(h.users || []).map(u => (
              <tr key={u.id}>
                <td className="text-xs font-medium text-white">{u.first_name} {u.last_name}</td>
                <td className="text-xs text-slate-400">{u.email}</td>
                <td><span className="badge badge-blue text-[10px]">{ROLE_LABELS[u.role]}</span></td>
                <td><Badge status={u.is_active ? 'ACTIVE' : 'INACTIVE'} /></td>
                <td className="text-xs text-slate-400">{u.last_login ? fmt.ago(u.last_login) : 'Never'}</td>
                <td>
                  <div className="flex gap-1.5">
                    <button className="btn text-[10px] px-2 py-1 flex items-center gap-1" onClick={() => openResetPwModal(u)}>
                      <KeyRound size={11} /> Reset Password
                    </button>
                    <button
                      className={`btn text-[10px] px-2 py-1 flex items-center gap-1 ${u.is_active ? 'text-brand-red border-brand-red/20 hover:bg-brand-red/10' : 'text-brand-green border-brand-green/20 hover:bg-brand-green/10'}`}
                      onClick={() => toggleUserMut.mutate(u.id)}
                    >
                      {u.is_active ? <><ShieldOff size={11} /> Deactivate</> : <><ShieldCheck size={11} /> Activate</>}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invoices */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-default text-sm font-semibold text-white">Invoice History</div>
        <table className="tbl">
          <thead><tr><th>Period</th><th>Amount</th><th>Status</th><th>Paid On</th></tr></thead>
          <tbody>
            {(h.invoices || []).map(inv => (
              <tr key={inv.id}>
                <td className="text-xs">{fmt.date(inv.period_from)} — {fmt.date(inv.period_to)}</td>
                <td className="text-xs font-bold">{fmt.currency(inv.amount)}</td>
                <td><Badge status={inv.status} /></td>
                <td className="text-xs text-slate-400">{inv.paid_at ? fmt.date(inv.paid_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bed Management Modal */}
      <Modal open={showBedModal} onClose={closeBedModal} title={editingBed ? "Edit Bed" : "Add New Bed"}>
        <form onSubmit={handleBedSubmit(onBedSubmit)} className="space-y-4">
          <div className="rounded-xl border border-cyan/15 bg-navy-900 p-3">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Location</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className="label">Ward *</label><input className="input" placeholder="General Ward / ICU / Maternity" {...registerBed('ward', { required: true })} /></div>
              <div><label className="label">Floor</label><input className="input" placeholder="Ground / 1 / 2" {...registerBed('floor')} /></div>
              <div><label className="label">Room</label><input className="input" placeholder="101 / ICU-A" {...registerBed('room_no')} /></div>
            </div>
          </div>
          <div className="rounded-xl border border-cyan/15 bg-navy-900 p-3">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan">Bed Identity</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className="label">Bed Number *</label><input className="input font-mono" placeholder="B-01" {...registerBed('bed_no', { required: true })} /></div>
              <div><label className="label">Bed Type *</label><select className="select" {...registerBed('bed_type', { required: true })}>{BED_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></div>
              <div><label className="label">Operational Status *</label><select className="select" {...registerBed('status', { required: true })}>{BED_STATUS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
          </div>
          <div className="alert-cyan text-xs">Room pricing is managed only in Billing Config. Superadmin controls structure and availability here.</div>
          <div className="flex gap-2 pt-2"><button type="submit" disabled={createBedMut.isPending || updateBedMut.isPending} className="btn-primary flex-1">{createBedMut.isPending || updateBedMut.isPending ? 'Saving...' : 'Save Bed'}</button><button type="button" className="btn flex-1" onClick={closeBedModal}>Cancel</button></div>
        </form>
      </Modal>
      <Modal open={showBatchBedModal} onClose={closeBatchBedModal} title="Bulk Add Beds by Floor and Room" size="lg">
        <form onSubmit={handleBatchBedSubmit(onBatchBedSubmit)} className="space-y-4">
          <div className="rounded-xl border border-cyan/15 bg-navy-900 p-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">1. Location</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className="label">Ward *</label><input className="input" placeholder="General / ICU / Maternity" {...registerBatchBed('ward', { required: true })} /></div>
              <div><label className="label">Floor</label><input className="input" placeholder="1 / 2 / Ground" {...registerBatchBed('floor')} /></div>
              <div><label className="label">Fixed Room (optional)</label><input className="input" placeholder="101, leave blank for range" {...registerBatchBed('room_no')} /></div>
            </div>
          </div>

          <div className="rounded-xl border border-cyan/15 bg-navy-900 p-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">2. Room Range</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className="label">Room Prefix</label><input className="input" placeholder="A / ICU-" {...registerBatchBed('room_prefix')} /></div>
              <div><label className="label">Start Room No.</label><input type="number" className="input" {...registerBatchBed('room_start')} /></div>
              <div><label className="label">Number of Rooms</label><input type="number" min="1" className="input" {...registerBatchBed('room_count')} /></div>
            </div>
          </div>

          <div className="rounded-xl border border-cyan/15 bg-navy-900 p-3 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan">3. Beds Per Room</div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div><label className="label">Beds / Room</label><input type="number" min="1" className="input" {...registerBatchBed('beds_per_room')} /></div>
              <div><label className="label">Bed Prefix</label><input className="input" placeholder="B" {...registerBatchBed('bed_prefix')} /></div>
              <div><label className="label">Bed Start No.</label><input type="number" className="input" {...registerBatchBed('start_number')} /></div>
              <div><label className="label">Zero Pad</label><input type="number" className="input" {...registerBatchBed('pad_length')} /></div>
              <div><label className="label">Bed Type *</label><select className="select" {...registerBatchBed('bed_type', { required: true })}>{BED_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></div>
            </div>
            <div><label className="label">Initial Status *</label><select className="select" {...registerBatchBed('status', { required: true })}>{BED_STATUS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>

          <div className="alert-cyan text-xs">Example: floor 1, rooms 101-110, 4 beds per room creates B-101-01 to B-110-04.</div>
          <div className="flex gap-2 pt-2"><button type="submit" disabled={batchCreateBedMut.isPending} className="btn-primary flex-1">{batchCreateBedMut.isPending ? 'Creating beds...' : 'Create Room Bed Layout'}</button><button type="button" className="btn flex-1" onClick={closeBatchBedModal}>Cancel</button></div>
        </form>
      </Modal>
      {/* Reset Staff Password Modal */}
      <Modal open={!!showResetPwModal} onClose={() => setShowResetPwModal(null)} title={`Reset Password — ${showResetPwModal?.first_name} ${showResetPwModal?.last_name}`}>
        {showResetPwModal && (
          <form onSubmit={handlePwSubmit(onResetPwSubmit)} className="space-y-4">
            <div className="text-xs text-slate-400 bg-navy-800 rounded-lg px-3 py-2">
              🔐 As Super Admin you can force-reset this staff member's password. They will be logged out of all sessions immediately.
            </div>
            <div className="bg-navy-800 rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-400">User</span><span>{showResetPwModal.email}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Role</span><Badge status={showResetPwModal.role} label={ROLE_LABELS[showResetPwModal.role]} /></div>
            </div>
            <div><label className="label">New Password (min 8 chars) *</label><input type="password" className="input" {...registerPw('newPassword', { required: true, minLength: 8 })} /></div>
            <div><label className="label">Confirm New Password *</label><input type="password" className="input" {...registerPw('confirmPassword', { required: true })} /></div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={resetPwMut.isPending} className="btn-primary flex-1">
                {resetPwMut.isPending ? 'Resetting...' : '🔑 Reset Password'}
              </button>
              <button type="button" className="btn flex-1" onClick={() => setShowResetPwModal(null)}>Cancel</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
