// src/pages/SettingsPage.jsx
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { KeyRound, Lock, ShieldCheck, UserCog } from 'lucide-react'
import api from '../utils/api'
import StatCard from '../components/common/StatCard'
import useAuthStore from '../context/authStore'
import { MODULES } from '../utils/helpers'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const { register, handleSubmit, watch, reset } = useForm()
  const newPassword = watch('newPassword') || ''
  const score = useMemo(() => {
    let value = 0
    if (newPassword.length >= 8) value += 25
    if (/[A-Z]/.test(newPassword)) value += 20
    if (/[a-z]/.test(newPassword)) value += 15
    if (/\d/.test(newPassword)) value += 20
    if (/[^A-Za-z0-9]/.test(newPassword)) value += 20
    return Math.min(100, value)
  }, [newPassword])
  const enabled = user?.hospital?.modules_enabled || []
  const licenseDays = user?.hospital?.license_end ? Math.ceil((new Date(user.hospital.license_end) - new Date()) / 86400000) : null

  const pwMut = useMutation({
    mutationFn: (d) => api.put('/auth/change-password', { ...d, confirmPassword: d.confirmPassword || d.newPassword }),
    onSuccess: () => { toast.success('Password changed successfully'); reset() },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  })

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">System Control Center</h1><p className="page-sub">Hospital license, enabled modules, identity, and account security</p></div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon={<ShieldCheck size={22} />} value={user?.hospital?.license_type || '-'} label="License" color="cyan" />
        <StatCard icon={<UserCog size={22} />} value={enabled.length} label="Enabled modules" color="green" />
        <StatCard icon={<Lock size={22} />} value={licenseDays === null ? '-' : `${licenseDays}d`} label="License remaining" color={licenseDays !== null && licenseDays < 30 ? 'red' : 'blue'} />
        <StatCard icon={<KeyRound size={22} />} value={user?.role?.replace(/_/g, ' ') || '-'} label="Current role" color="purple" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Hospital Profile</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Readonly label="Hospital Name" value={user?.hospital?.name} />
            <Readonly label="Hospital Code" value={user?.hospital?.code} />
            <Readonly label="License Type" value={user?.hospital?.license_type} />
            <Readonly label="Status" value={user?.hospital?.is_active ? 'Active' : 'Inactive'} />
          </div>
          <div className="divider" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {MODULES.filter(m => enabled.includes(m.key)).map(m => <div key={m.key} className="rounded-lg border border-default bg-navy-800 p-2"><div className="text-[11px] font-semibold text-white">{m.key}</div><div className="text-[10px] text-slate-500 truncate">{m.label}</div></div>)}
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Account Security</h3>
          <form onSubmit={handleSubmit(d => pwMut.mutate(d))} className="space-y-3">
            <Readonly label="Signed in as" value={`${user?.first_name || ''} ${user?.last_name || ''}`.trim()} />
            <div><label className="label">Current Password</label><input type="password" className="input" {...register('currentPassword', { required: true })} /></div>
            <div><label className="label">New Password</label><input type="password" className="input" {...register('newPassword', { required: true, minLength: 8 })} /></div>
            <div><label className="label">Password Strength</label><div className="progress"><div className={`progress-bar ${score < 50 ? 'bg-brand-red' : score < 80 ? 'bg-brand-amber' : 'bg-brand-green'}`} style={{ width: `${score}%` }} /></div></div>
            <button type="submit" disabled={pwMut.isPending || score < 50} className="btn-primary w-full">{pwMut.isPending ? 'Changing...' : 'Change Password'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}

function Readonly({ label, value }) {
  return <div><label className="label">{label}</label><input className="input" value={value || '-'} disabled /></div>
}
