// src/pages/superadmin/SASettingsPage.jsx
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { Shield, Bell, Info, KeyRound, Lock, Globe } from 'lucide-react'

const TABS = [
  { key: 'security', label: 'Security & Password', icon: Shield },
  { key: 'broadcast', label: 'Broadcast', icon: Bell },
  { key: 'info', label: 'Platform Info', icon: Info },
]

export default function SASettingsPage() {
  const [activeTab, setActiveTab] = useState('security')

  const { register: regAnn, handleSubmit: hsAnn, reset: resetAnn } = useForm()
  const { register: regPw, handleSubmit: hsPw, reset: resetPw, watch: watchPw } = useForm()

  const annMut = useMutation({
    mutationFn: (d) => api.post('/superadmin/announcements', d),
    onSuccess: () => { toast.success('Announcement sent to all hospitals'); resetAnn() },
    onError: () => toast.error('Failed to send announcement'),
  })

  const pwMut = useMutation({
    mutationFn: (d) => api.put('/auth/change-password', d),
    onSuccess: () => { toast.success('Password changed'); resetPw() },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed'),
  })

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="page-header"><h1 className="page-title">Platform Settings</h1></div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl bg-slate-950/40 border border-default/60 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeTab === key ? 'bg-cyan/15 text-cyan shadow-sm border border-cyan/20' : 'text-slate-400 hover:text-white border border-transparent'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Security Tab ── */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-red/20 to-brand-amber/20 flex items-center justify-center"><KeyRound size={16} className="text-brand-amber" /></div>
              <div>
                <h3 className="text-sm font-semibold text-white">Change Super Admin Password</h3>
                <p className="text-[11px] text-slate-500">Update your own login credentials. This does not affect hospital staff passwords.</p>
              </div>
            </div>
            <form onSubmit={hsPw(d => pwMut.mutate(d))} className="space-y-3 max-w-md">
              <div><label className="label">Current Password</label><input type="password" className="input" {...regPw('currentPassword', { required: true })} /></div>
              <div><label className="label">New Password (min 8 chars)</label>
                <input type="password" className="input" {...regPw('newPassword', { required: true, minLength: 8 })} />
              </div>
              <div><label className="label">Confirm New Password</label>
                <input type="password" className="input" {...regPw('confirmPassword', {
                  required: true, validate: (v) => v === watchPw('newPassword') || 'Passwords do not match'
                })} />
              </div>
              <button type="submit" disabled={pwMut.isPending} className="btn-primary">
                {pwMut.isPending ? 'Changing...' : <><Lock size={14} /> Change Password</>}
              </button>
            </form>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan/20 to-brand-blue/20 flex items-center justify-center"><Globe size={16} className="text-cyan" /></div>
              <div>
                <h3 className="text-sm font-semibold text-white">Session & Security</h3>
                <p className="text-[11px] text-slate-500">Your super admin session is managed via JWT tokens.</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {[['Auth Method', 'JWT (Access + Refresh Tokens)'],['Token Expiry', '24 hours'],['Refresh Token', '7 days'],['Password Hashing', 'bcrypt (12 rounds)'],['MFA', 'Not enabled (coming soon)']].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-default pb-2 last:border-0">
                  <span className="text-slate-400">{k}</span>
                  <span className="text-white font-mono text-xs">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Broadcast Tab ── */}
      {activeTab === 'broadcast' && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-purple/20 to-brand-pink/20 flex items-center justify-center"><Bell size={16} className="text-brand-purple" /></div>
            <div>
              <h3 className="text-sm font-semibold text-white">📢 Broadcast Announcement</h3>
              <p className="text-[11px] text-slate-500">Send an announcement to all hospitals. It will appear in their dashboard immediately.</p>
            </div>
          </div>
          <form onSubmit={hsAnn(d => annMut.mutate({ ...d, hospital_id: null }))} className="space-y-3">
            <div><label className="label">Title *</label><input className="input" {...regAnn('title', { required: true })} /></div>
            <div><label className="label">Message *</label><textarea className="textarea h-24" {...regAnn('body', { required: true })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Priority</label>
                <select className="select" {...regAnn('priority')}>
                  <option value="NORMAL">Normal</option>
                  <option value="URGENT">Urgent</option>
                  <option value="EMERGENCY">Emergency</option>
                </select>
              </div>
              <div><label className="label">Expiry Date</label><input type="date" className="input" {...regAnn('expires_at')} /></div>
            </div>
            <button type="submit" disabled={annMut.isPending} className="btn-primary">
              {annMut.isPending ? 'Sending...' : '📢 Broadcast to All Hospitals'}
            </button>
          </form>
        </div>
      )}

      {/* ── Platform Info Tab ── */}
      {activeTab === 'info' && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-green/20 to-cyan/20 flex items-center justify-center"><Info size={16} className="text-brand-green" /></div>
            <div>
              <h3 className="text-sm font-semibold text-white">Platform Information</h3>
              <p className="text-[11px] text-slate-500">Technical details about the MediCore platform.</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {[['Platform', 'Dr.AiSolnex HMS'],['Version', 'v1.0.0'],['Build', '2026-01-01'],['Backend', 'Node.js + Express + PostgreSQL'],['Frontend', 'React 18 + Vite + Tailwind CSS'],['Database', 'PostgreSQL 15 via Prisma ORM'],['Real-time', 'Socket.io'],['Auth', 'JWT + Refresh Tokens'],['Deployment', 'Docker / Docker Compose']].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-default pb-2 last:border-0">
                <span className="text-slate-400">{k}</span>
                <span className="text-white font-mono text-xs">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
