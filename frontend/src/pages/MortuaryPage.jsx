// src/pages/MortuaryPage.jsx
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { ClipboardCheck, FileCheck, Search, ShieldAlert, Snowflake, UserCheck } from 'lucide-react'
import api from '../utils/api'
import Modal from '../components/common/Modal'
import StatCard, { Spinner } from '../components/common/StatCard'
import { fmt } from '../utils/helpers'

export default function MortuaryPage() {
  const [showModal, setShowModal] = useState(false)
  const [releaseRecord, setReleaseRecord] = useState(null)
  const [search, setSearch] = useState('')
  const qc = useQueryClient()
  const form = useForm({ defaultValues: { gender: 'MALE', is_pm_required: false, is_unclaimed: false } })
  const releaseForm = useForm()
  const { data, isLoading } = useQuery({ queryKey: ['mortuary'], queryFn: () => api.get('/mortuary').then(r => r.data.data), refetchInterval: 60000 })
  const records = data || []
  const inCustody = records.filter(r => !r.is_released)
  const pmRequired = records.filter(r => r.is_pm_required && !r.is_released)
  const unclaimed = records.filter(r => r.is_unclaimed && !r.is_released)
  const rows = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return records
    return records.filter(r => [r.body_tag, r.patient_name, r.storage_slot, r.nok_name, r.cause_of_death].some(v => String(v || '').toLowerCase().includes(q)))
  }, [records, search])

  const refresh = () => qc.invalidateQueries({ queryKey: ['mortuary'] })
  const registerMut = useMutation({
    mutationFn: (payload) => api.post('/mortuary', payload),
    onSuccess: () => { toast.success('Body registered'); refresh(); setShowModal(false); form.reset({ gender: 'MALE', is_pm_required: false, is_unclaimed: false }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to register body'),
  })
  const releaseMut = useMutation({
    mutationFn: ({ id, ...payload }) => api.patch(`/mortuary/${id}/release`, payload),
    onSuccess: () => { toast.success('Release recorded'); refresh(); setReleaseRecord(null); releaseForm.reset() },
    onError: (e) => toast.error(e.response?.data?.message || 'Release failed'),
  })

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Mortuary Custody Command</h1><p className="page-sub">{inCustody.length} in custody, {pmRequired.length} PM holds, {unclaimed.length} unclaimed</p></div>
        <button className="btn-primary" onClick={() => setShowModal(true)}><Snowflake size={16} /> Register Body</button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon={<Snowflake size={22} />} value={inCustody.length} label="In custody" color="cyan" />
        <StatCard icon={<ShieldAlert size={22} />} value={pmRequired.length} label="PM required" color="amber" />
        <StatCard icon={<UserCheck size={22} />} value={unclaimed.length} label="Unclaimed" color="red" />
        <StatCard icon={<FileCheck size={22} />} value={records.filter(r => r.is_released).length} label="Released" color="green" />
      </div>

      <div className="card"><div className="relative"><Search className="absolute left-3 top-2.5 text-slate-500" size={16} /><input className="input pl-9" placeholder="Search body tag, name, slot, NOK, cause..." value={search} onChange={e => setSearch(e.target.value)} /></div></div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Body Tag</th><th>Identity</th><th>Clinical / Legal</th><th>Storage</th><th>NOK</th><th>Custody</th><th>Action</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs text-cyan">{r.body_tag}</td>
                    <td><div className="text-xs font-medium text-white">{r.patient_name}</div><div className="text-[10px] text-slate-400">{r.age || '-'} / {r.gender || '-'}</div></td>
                    <td><div className="text-xs">{r.cause_of_death || '-'}</div><div className="flex gap-1 mt-1">{r.is_pm_required && <span className="badge-amber text-[10px]">PM Hold</span>}{r.is_unclaimed && <span className="badge-red text-[10px]">Unclaimed</span>}</div></td>
                    <td><div className="text-xs">{r.storage_slot || '-'}</div><div className="text-[10px] text-slate-500">DOD {fmt.date(r.dod)}</div></td>
                    <td className="text-xs">{r.nok_name || '-'}<div className="text-[10px] text-slate-500">{r.nok_phone || ''}</div></td>
                    <td>{r.is_released ? <span className="badge-green">Released {fmt.date(r.released_at)}</span> : <span className="badge-amber">In Custody</span>}</td>
                    <td>{!r.is_released && <button className="btn text-xs px-2 py-1" onClick={() => setReleaseRecord(r)}>Release</button>}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No records found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Register Body" size="lg">
        <form onSubmit={form.handleSubmit(d => registerMut.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Patient UHID / reference"><input className="input" {...form.register('patient_id')} /></Field>
            <Field label="Name" required><input className="input" {...form.register('patient_name', { required: true })} /></Field>
            <Field label="Age"><input className="input" {...form.register('age')} /></Field>
            <Field label="Gender"><select className="select" {...form.register('gender')}>{['MALE','FEMALE','OTHER'].map(g => <option key={g}>{g}</option>)}</select></Field>
            <Field label="Date of death"><input type="datetime-local" className="input" {...form.register('dod')} /></Field>
            <Field label="Storage slot"><input className="input" {...form.register('storage_slot')} /></Field>
            <Field label="NOK name"><input className="input" {...form.register('nok_name')} /></Field>
            <Field label="NOK phone"><input className="input" {...form.register('nok_phone')} /></Field>
          </div>
          <Field label="Cause of death"><textarea className="textarea" rows={3} {...form.register('cause_of_death')} /></Field>
          <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" {...form.register('is_pm_required')} /> Post-mortem required</label><label className="flex items-center gap-2"><input type="checkbox" {...form.register('is_unclaimed')} /> Unclaimed</label></div>
          <SubmitRow loading={registerMut.isPending} label="Register custody" onCancel={() => setShowModal(false)} />
        </form>
      </Modal>

      <Modal open={!!releaseRecord} onClose={() => setReleaseRecord(null)} title="Release Body">
        <form onSubmit={releaseForm.handleSubmit(d => releaseMut.mutate({ id: releaseRecord?.id, ...d }))} className="space-y-3">
          <div className="rounded-lg border border-default bg-navy-800 p-3 text-xs text-slate-300"><strong className="text-white">{releaseRecord?.body_tag}</strong> | {releaseRecord?.patient_name}</div>
          <Field label="Released to" required><input className="input" {...releaseForm.register('released_to', { required: true })} /></Field>
          <SubmitRow loading={releaseMut.isPending} label="Confirm release" onCancel={() => setReleaseRecord(null)} />
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
