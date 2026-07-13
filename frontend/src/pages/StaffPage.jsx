// src/pages/StaffPage.jsx
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { CalendarDays, ClipboardCheck, Clock, RotateCcw, Save, Search, ShieldCheck, Stethoscope, UserPlus, Users } from 'lucide-react'
import api from '../utils/api'
import useAuthStore from '../context/authStore'
import Modal from '../components/common/Modal'
import StatCard, { Badge, Spinner } from '../components/common/StatCard'
import { fmt, MODULES, ROLE_LABELS } from '../utils/helpers'

const shiftTypes = ['MORNING', 'EVENING', 'NIGHT', 'ON_CALL']
const wards = ['OPD', 'Emergency', 'ICU', 'OT', 'Ward A', 'Ward B', 'Lab', 'Radiology', 'Pharmacy']
const leaveTypes = ['CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'PATERNITY', 'COMP_OFF']

export default function StaffPage() {
  const [tab, setTab] = useState('staff')
  const [role, setRole] = useState('')
  const [search, setSearch] = useState('')
  const [showStaffModal, setShowStaffModal] = useState(false)
  const [showRosterModal, setShowRosterModal] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [permissionDrafts, setPermissionDrafts] = useState({})
  const qc = useQueryClient()
  const { user, fetchMe } = useAuthStore()
  const staffForm = useForm({ defaultValues: { role: 'NURSE', is_active: true } })
  const rosterForm = useForm({ defaultValues: { shift: 'MORNING', date: new Date().toISOString().slice(0, 10), ward: 'OPD' } })
  const leaveForm = useForm({ defaultValues: { type: 'CASUAL', days: 1 } })
  const watchRole = staffForm.watch('role')

  const staffQuery = useQuery({
    queryKey: ['staff', role, search],
    queryFn: () => api.get('/staff', { params: { role, search } }).then(r => r.data.data),
  })
  const rosterQuery = useQuery({ queryKey: ['staff-roster'], queryFn: () => api.get('/staff/roster').then(r => r.data.data), refetchInterval: 60000 })
  const leavesQuery = useQuery({ queryKey: ['staff-leaves'], queryFn: () => api.get('/staff/leaves').then(r => r.data.data), refetchInterval: 60000 })
  const canManagePermissions = ['HOSPITAL_ADMIN', 'HR_MANAGER'].includes(user?.role)
  const permissionsQuery = useQuery({
    queryKey: ['staff-module-permissions'],
    queryFn: () => api.get('/staff/module-permissions').then(r => r.data.data),
    enabled: canManagePermissions,
  })

  const staff = staffQuery.data || []
  const roster = rosterQuery.data || []
  const leaves = leavesQuery.data || []
  const doctors = staff.filter(s => s.role === 'DOCTOR')
  const nurses = staff.filter(s => s.role === 'NURSE')
  const inactive = staff.filter(s => !s.is_active)
  const pendingLeaves = leaves.filter(l => l.status === 'PENDING')

  const coverage = useMemo(() => shiftTypes.map(shift => ({
    shift,
    count: roster.filter(r => r.shift === shift).length,
    wards: new Set(roster.filter(r => r.shift === shift).map(r => r.ward).filter(Boolean)).size,
  })), [roster])

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['staff'] })
    qc.invalidateQueries({ queryKey: ['staff-roster'] })
    qc.invalidateQueries({ queryKey: ['staff-leaves'] })
  }

  const createMut = useMutation({
    mutationFn: (d) => api.post('/staff', d),
    onSuccess: () => { toast.success('Staff member added'); refresh(); setShowStaffModal(false); staffForm.reset({ role: 'NURSE', is_active: true }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add staff'),
  })
  const rosterMut = useMutation({
    mutationFn: (d) => api.post('/staff/roster', d),
    onSuccess: () => { toast.success('Shift assigned'); refresh(); setShowRosterModal(false); rosterForm.reset({ shift: 'MORNING', date: new Date().toISOString().slice(0, 10), ward: 'OPD' }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to assign shift'),
  })
  const leaveMut = useMutation({
    mutationFn: (d) => api.post('/staff/leaves', d),
    onSuccess: () => { toast.success('Leave request submitted'); refresh(); setShowLeaveModal(false); leaveForm.reset({ type: 'CASUAL', days: 1 }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to request leave'),
  })
  const leaveStatusMut = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/staff/leaves/${id}`, { status }),
    onSuccess: () => { toast.success('Leave updated'); refresh() },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update leave'),
  })
  const permissionMut = useMutation({
    mutationFn: ({ role, modules }) => api.put(`/staff/module-permissions/${role}`, { modules }),
    onSuccess: async () => {
      toast.success('Module access updated')
      setPermissionDrafts({})
      qc.invalidateQueries({ queryKey: ['staff-module-permissions'] })
      await fetchMe().catch(() => {})
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update module access'),
  })

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Workforce Command Center</h1>
          <p className="page-sub">{staff.length} staff, {doctors.length} doctors, {pendingLeaves.length} pending leaves</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => setShowStaffModal(true)}><UserPlus size={16} /> Add Staff</button>
          <button className="btn" onClick={() => setShowRosterModal(true)}><CalendarDays size={16} /> Assign Shift</button>
          <button className="btn" onClick={() => setShowLeaveModal(true)}><Clock size={16} /> Leave</button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <StatCard icon={<Users size={22} />} value={staff.length} label="Active workforce" color="cyan" />
        <StatCard icon={<Stethoscope size={22} />} value={doctors.length} label="Doctors" color="green" />
        <StatCard icon={<ShieldCheck size={22} />} value={nurses.length} label="Nursing staff" color="blue" />
        <StatCard icon={<CalendarDays size={22} />} value={roster.length} label="Shifts today" color="purple" />
        <StatCard icon={<Clock size={22} />} value={pendingLeaves.length} label="Pending leaves" color="amber" />
      </div>

      <div className="tabs overflow-x-auto">
        {[['staff','Staff Directory'],['coverage','Coverage Matrix'],['leaves','Leave Desk'], ...(canManagePermissions ? [['permissions','Role Modules']] : [])].map(([k, l]) => <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'staff' && (
        <>
          <div className="card">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="relative md:col-span-8"><Search className="absolute left-3 top-2.5 text-slate-500" size={16} /><input className="input pl-9" placeholder="Search name, email, phone..." value={search} onChange={e => setSearch(e.target.value)} /></div>
              <select className="select md:col-span-4" value={role} onChange={e => setRole(e.target.value)}>
                <option value="">All Roles</option>
                {Object.entries(ROLE_LABELS).filter(([k]) => k !== 'SUPER_ADMIN').map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {staffQuery.isLoading ? <div className="flex justify-center py-20"><Spinner size="lg" /></div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {staff.map(s => <StaffCard key={s.id} staff={s} />)}
              {!staff.length && <div className="card text-xs text-slate-400">No staff found.</div>}
            </div>
          )}
        </>
      )}

      {tab === 'coverage' && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {coverage.map(c => (
            <div key={c.shift} className="card">
              <div className="flex items-center justify-between"><h2 className="text-sm font-semibold text-white">{c.shift}</h2><span className={c.count ? 'badge-green' : 'badge-red'}>{c.count} assigned</span></div>
              <div className="mt-3 text-xs text-slate-400">{c.wards} covered areas</div>
              <div className="divider" />
              <div className="space-y-2">
                {roster.filter(r => r.shift === c.shift).map(r => <div key={r.id} className="rounded-lg bg-navy-800 border border-default p-2 text-xs"><div className="text-white">{r.ward || 'General'}</div><div className="text-slate-400">{r.user_id}</div><Badge status={r.status} /></div>)}
                {!c.count && <div className="text-xs text-brand-red">Coverage gap detected.</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'leaves' && (
        <div className="card p-0 overflow-hidden">
          {leavesQuery.isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
            <table className="tbl">
              <thead><tr><th>User ID</th><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {leaves.map(l => <tr key={l.id}><td className="font-mono text-xs text-cyan">{l.user_id}</td><td><Badge status={l.type} /></td><td className="text-xs">{fmt.date(l.from_date)} - {fmt.date(l.to_date)}</td><td className="text-xs">{l.days}</td><td className="text-xs text-slate-400">{l.reason || '-'}</td><td><Badge status={l.status} /></td><td>{l.status === 'PENDING' && <div className="flex gap-1"><button className="btn text-xs px-2 py-1" onClick={() => leaveStatusMut.mutate({ id: l.id, status: 'APPROVED' })}>Approve</button><button className="btn text-xs px-2 py-1" onClick={() => leaveStatusMut.mutate({ id: l.id, status: 'REJECTED' })}>Reject</button></div>}</td></tr>)}
                {!leaves.length && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No leave requests.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'permissions' && canManagePermissions && (
        <PermissionsPanel
          data={permissionsQuery.data}
          loading={permissionsQuery.isLoading}
          drafts={permissionDrafts}
          setDrafts={setPermissionDrafts}
          mutate={permissionMut}
        />
      )}

      <StaffModal open={showStaffModal} onClose={() => setShowStaffModal(false)} form={staffForm} mutate={createMut} watchRole={watchRole} />
      <RosterModal open={showRosterModal} onClose={() => setShowRosterModal(false)} form={rosterForm} mutate={rosterMut} staff={staff} />
      <LeaveModal open={showLeaveModal} onClose={() => setShowLeaveModal(false)} form={leaveForm} mutate={leaveMut} />
    </div>
  )
}

function PermissionsPanel({ data, loading, drafts, setDrafts, mutate }) {
  const roles = data?.roles || []
  const moduleList = MODULES.filter(module => (data?.modules || []).includes(module.key))

  const currentModules = (roleRow) => drafts[roleRow.role] || roleRow.modules || []
  const setRoleModules = (role, modules) => setDrafts(prev => ({ ...prev, [role]: modules }))
  const toggleModule = (roleRow, moduleKey) => {
    const modules = currentModules(roleRow)
    const next = modules.includes(moduleKey)
      ? modules.filter(key => key !== moduleKey)
      : [...modules, moduleKey]
    setRoleModules(roleRow.role, next)
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Role module access</h2>
            <p className="text-xs text-slate-400 mt-1">Saved changes apply to every active user with that role after their next refresh or login.</p>
          </div>
          <span className="badge-blue text-[10px]">{moduleList.length} modules</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {roles.map(roleRow => {
          const selected = currentModules(roleRow)
          const isDirty = Boolean(drafts[roleRow.role])
          return (
            <div key={roleRow.role} className="card">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{ROLE_LABELS[roleRow.role] || roleRow.role}</h3>
                  <div className="text-xs text-slate-400">{selected.length} selected</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn text-xs px-2 py-1.5" type="button" onClick={() => setRoleModules(roleRow.role, roleRow.default_modules || [])}>
                    <RotateCcw size={14} /> Defaults
                  </button>
                  <button
                    className="btn-primary text-xs px-2 py-1.5"
                    type="button"
                    disabled={!isDirty || mutate.isPending}
                    onClick={() => mutate.mutate({ role: roleRow.role, modules: selected })}
                  >
                    <Save size={14} /> Save
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {moduleList.map(module => (
                  <label key={module.key} className="flex items-center gap-2 rounded-lg border border-default bg-navy-800 px-3 py-2 text-xs text-slate-200">
                    <input
                      type="checkbox"
                      className="accent-cyan"
                      checked={selected.includes(module.key)}
                      onChange={() => toggleModule(roleRow, module.key)}
                    />
                    <span>{module.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StaffCard({ staff }) {
  return (
    <div className="card-hover">
      <div className="flex items-start gap-3 mb-3">
        <div className="avatar-lg bg-gradient-to-br from-cyan to-brand-purple">{staff.first_name?.[0]}{staff.last_name?.[0]}</div>
        <div className="min-w-0">
          <div className="font-semibold text-white text-sm truncate">{staff.role === 'DOCTOR' ? 'Dr. ' : ''}{staff.first_name} {staff.last_name}</div>
          <div className="text-xs text-slate-400">{staff.designation || ROLE_LABELS[staff.role]}</div>
          <div className="text-[11px] text-slate-500 truncate">{staff.email}</div>
        </div>
      </div>
      <div className="flex gap-1 flex-wrap mb-2"><Badge status={staff.is_active ? 'ACTIVE' : 'INACTIVE'} /><span className="badge-blue text-[10px]">{ROLE_LABELS[staff.role]}</span>{staff.doctor_profile?.specialization && <span className="badge-purple text-[10px]">{staff.doctor_profile.specialization}</span>}</div>
      {staff.role === 'DOCTOR' && staff.doctor_profile && <div className="mt-2 grid grid-cols-2 gap-2 text-xs bg-navy-800 rounded-lg px-2.5 py-2"><span className="text-slate-400">Fee <strong className="text-white">{fmt.currency(staff.doctor_profile.consultation_fee)}</strong></span><span className="text-slate-400">Exp <strong className="text-white">{staff.doctor_profile.experience_years || 0}y</strong></span></div>}
    </div>
  )
}

function StaffModal({ open, onClose, form, mutate, watchRole }) {
  const { register, handleSubmit } = form
  return <Modal open={open} onClose={onClose} title="Add Staff Member" size="xl"><form onSubmit={handleSubmit(d => mutate.mutate(d))} className="space-y-3">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><Field label="First name" required><input className="input" {...register('first_name', { required: true })} /></Field><Field label="Last name" required><input className="input" {...register('last_name', { required: true })} /></Field><Field label="Employee phone"><input className="input" {...register('phone')} /></Field><Field label="Email" required><input type="email" className="input" {...register('email', { required: true })} /></Field><Field label="Role" required><select className="select" {...register('role', { required: true })}>{Object.entries(ROLE_LABELS).filter(([k]) => !['SUPER_ADMIN','PATIENT_PORTAL'].includes(k)).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></Field><Field label="Designation"><input className="input" {...register('designation')} /></Field></div>
    {watchRole === 'DOCTOR' && <div className="rounded-xl border border-default bg-navy-800 p-3"><h3 className="mb-3 text-xs font-semibold text-cyan">Doctor Credentialing</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><Field label="Specialization"><input className="input" {...register('doctor_profile.specialization')} /></Field><Field label="Qualification"><input className="input" {...register('doctor_profile.qualification')} /></Field><Field label="Registration no"><input className="input" {...register('doctor_profile.registration_no')} /></Field><Field label="Experience years"><input type="number" className="input" {...register('doctor_profile.experience_years')} /></Field><Field label="Consultation fee"><input type="number" className="input" {...register('doctor_profile.consultation_fee')} /></Field><Field label="Slot duration mins"><input type="number" className="input" {...register('doctor_profile.slot_duration_mins')} /></Field></div></div>}
    <Field label="Temporary password"><input type="password" className="input" placeholder="Default: Welcome@123" {...register('password')} /></Field>
    <SubmitRow loading={mutate.isPending} label="Add staff member" onCancel={onClose} />
  </form></Modal>
}

function RosterModal({ open, onClose, form, mutate, staff }) {
  const { register, handleSubmit } = form
  return <Modal open={open} onClose={onClose} title="Assign Shift" size="lg"><form onSubmit={handleSubmit(d => mutate.mutate(d))} className="space-y-3"><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Field label="Staff member" required><select className="select" {...register('user_id', { required: true })}><option value="">Select staff</option>{staff.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} - {ROLE_LABELS[s.role]}</option>)}</select></Field><Field label="Date"><input type="date" className="input" {...register('date', { required: true })} /></Field><Field label="Shift"><select className="select" {...register('shift')}>{shiftTypes.map(s => <option key={s}>{s}</option>)}</select></Field><Field label="Ward / area"><select className="select" {...register('ward')}>{wards.map(w => <option key={w}>{w}</option>)}</select></Field></div><SubmitRow loading={mutate.isPending} label="Assign shift" onCancel={onClose} /></form></Modal>
}

function LeaveModal({ open, onClose, form, mutate }) {
  const { register, handleSubmit } = form
  return <Modal open={open} onClose={onClose} title="Request Leave"><form onSubmit={handleSubmit(d => mutate.mutate(d))} className="space-y-3"><Field label="Type"><select className="select" {...register('type')}>{leaveTypes.map(t => <option key={t}>{t}</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label="From date" required><input type="date" className="input" {...register('from_date', { required: true })} /></Field><Field label="To date" required><input type="date" className="input" {...register('to_date', { required: true })} /></Field></div><Field label="Days" required><input type="number" min="1" className="input" {...register('days', { required: true })} /></Field><Field label="Reason"><textarea className="textarea" rows={3} {...register('reason')} /></Field><SubmitRow loading={mutate.isPending} label="Submit request" onCancel={onClose} /></form></Modal>
}

function Field({ label, required, children }) {
  return <div><label className="label">{label}{required ? ' *' : ''}</label>{children}</div>
}

function SubmitRow({ loading, label, onCancel }) {
  return <div className="flex gap-2 pt-2"><button type="submit" disabled={loading} className="btn-primary flex-1"><ClipboardCheck size={16} /> {loading ? 'Saving...' : label}</button><button type="button" className="btn flex-1" onClick={onCancel}>Cancel</button></div>
}
