// src/pages/CommunicationPage.jsx
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Bell, ClipboardCheck, Megaphone, MessageSquare, Send, Users } from 'lucide-react'
import api from '../utils/api'
import Modal from '../components/common/Modal'
import StatCard, { Spinner } from '../components/common/StatCard'
import { fmt, ROLE_LABELS } from '../utils/helpers'

export default function CommunicationPage() {
  const [tab, setTab] = useState('announcements')
  const [showModal, setShowModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')
  const qc = useQueryClient()
  const form = useForm({ defaultValues: { priority: 'NORMAL', target_roles: [] } })
  const msgForm = useForm()
  const { data: ann, isLoading: annLoading } = useQuery({ queryKey: ['announcements'], queryFn: () => api.get('/communication/announcements').then(r => r.data.data), refetchInterval: 45000 })
  const { data: staff } = useQuery({ queryKey: ['staff-for-messages'], queryFn: () => api.get('/staff').then(r => r.data.data) })
  const { data: messages, isLoading: msgLoading } = useQuery({
    queryKey: ['messages', selectedUser],
    queryFn: () => api.get('/communication/messages', { params: { to_user_id: selectedUser } }).then(r => r.data.data),
    enabled: !!selectedUser,
    refetchInterval: 15000,
  })
  const announcements = ann || []
  const people = staff || []

  const annMut = useMutation({
    mutationFn: (data) => api.post('/communication/announcements', { ...data, target_roles: Array.isArray(data.target_roles) ? data.target_roles : [] }),
    onSuccess: () => { toast.success('Announcement published'); qc.invalidateQueries({ queryKey: ['announcements'] }); setShowModal(false); form.reset({ priority: 'NORMAL', target_roles: [] }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to publish announcement'),
  })
  const msgMut = useMutation({
    mutationFn: (payload) => api.post('/communication/messages', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['messages', selectedUser] }); msgForm.reset() },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to send message'),
  })

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Communication Command Hub</h1><p className="page-sub">Broadcasts, staff messaging, urgent alerts and operational communication</p></div>
        <button className="btn-primary" onClick={() => setShowModal(true)}><Megaphone size={16} /> New Announcement</button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon={<Bell size={22} />} value={announcements.length} label="Active announcements" color="cyan" />
        <StatCard icon={<Megaphone size={22} />} value={announcements.filter(a => ['URGENT','EMERGENCY'].includes(a.priority)).length} label="Urgent broadcasts" color="red" />
        <StatCard icon={<Users size={22} />} value={people.length} label="Reachable staff" color="green" />
        <StatCard icon={<MessageSquare size={22} />} value={(messages || []).length} label="Open thread msgs" color="blue" />
      </div>

      <div className="tabs overflow-x-auto">
        {[['announcements','Announcements'],['messages','Direct Messages']].map(([k,l]) => <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'announcements' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {annLoading ? <div className="card flex justify-center py-10"><Spinner /></div> : announcements.map(a => (
            <div key={a.id} className={`card ${['URGENT','EMERGENCY'].includes(a.priority) ? 'border-brand-red/30 bg-brand-red/5' : ''}`}>
              <div className="flex justify-between gap-3 mb-2"><h2 className="text-sm font-semibold text-white">{a.title}</h2><span className={a.priority === 'NORMAL' ? 'badge-blue' : 'badge-red'}>{a.priority}</span></div>
              <p className="text-xs text-slate-300">{a.body}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500"><span>{fmt.ago(a.created_at)}</span>{a.expires_at && <span>Expires {fmt.date(a.expires_at)}</span>}{a.target_roles?.length > 0 && <span>{a.target_roles.join(', ')}</span>}</div>
            </div>
          ))}
          {!annLoading && !announcements.length && <div className="card text-xs text-slate-400">No announcements.</div>}
        </div>
      )}

      {tab === 'messages' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-3">Staff Directory</h2>
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {people.map(p => <button key={p.id} className={`w-full rounded-lg border p-3 text-left ${selectedUser === p.id ? 'border-cyan bg-cyan/10' : 'border-default bg-navy-800'}`} onClick={() => setSelectedUser(p.id)}><div className="text-xs font-semibold text-white">{p.first_name} {p.last_name}</div><div className="text-[11px] text-slate-400">{ROLE_LABELS[p.role]} | {p.email}</div></button>)}
            </div>
          </div>
          <div className="card xl:col-span-2">
            <h2 className="text-sm font-semibold text-white mb-3">Secure Staff Thread</h2>
            {!selectedUser ? <div className="text-xs text-slate-400 py-10 text-center">Select a staff member to start a conversation.</div> : (
              <>
                <div className="space-y-2 max-h-[420px] overflow-y-auto mb-3">
                  {msgLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (messages || []).map(m => <div key={m.id} className="rounded-lg border border-default bg-navy-800 p-3"><div className="text-xs text-white">{m.content}</div><div className="text-[10px] text-slate-500 mt-1">{fmt.ago(m.created_at)}</div></div>)}
                  {!msgLoading && !(messages || []).length && <div className="text-xs text-slate-400 py-8 text-center">No messages yet.</div>}
                </div>
                <form onSubmit={msgForm.handleSubmit(d => msgMut.mutate({ to_user_id: selectedUser, content: d.content, type: 'TEXT' }))} className="flex gap-2">
                  <input className="input" placeholder="Type message..." {...msgForm.register('content', { required: true })} />
                  <button className="btn-primary" disabled={msgMut.isPending}><Send size={16} /></button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Announcement" size="lg">
        <form onSubmit={form.handleSubmit(d => annMut.mutate(d))} className="space-y-3">
          <Field label="Title" required><input className="input" {...form.register('title', { required: true })} /></Field>
          <Field label="Message" required><textarea className="textarea" rows={4} {...form.register('body', { required: true })} /></Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Field label="Priority"><select className="select" {...form.register('priority')}>{['NORMAL','URGENT','EMERGENCY'].map(p => <option key={p}>{p}</option>)}</select></Field><Field label="Expires at"><input type="date" className="input" {...form.register('expires_at')} /></Field></div>
          <SubmitRow loading={annMut.isPending} label="Publish broadcast" onCancel={() => setShowModal(false)} />
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
