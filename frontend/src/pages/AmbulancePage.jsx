// src/pages/AmbulancePage.jsx
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Activity, Ambulance, ClipboardCheck, Clock, Fuel, MapPin, Plus, Radio, Route, Siren } from 'lucide-react'
import api from '../utils/api'
import Modal from '../components/common/Modal'
import StatCard, { Badge, Spinner } from '../components/common/StatCard'
import { fmt } from '../utils/helpers'

const ambulanceTypes = ['BLS', 'ALS', 'NEONATAL', 'MORTUARY']
const tripFlow = ['DISPATCHED', 'EN_ROUTE', 'PICKED_UP', 'ARRIVED', 'COMPLETED']
const minutesSince = (d) => d ? Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000)) : 0
const nextStatus = (status) => tripFlow[Math.min(tripFlow.indexOf(status) + 1, tripFlow.length - 1)] || 'EN_ROUTE'

export default function AmbulancePage() {
  const [dispatchAmbulance, setDispatchAmbulance] = useState(null)
  const [showFleetModal, setShowFleetModal] = useState(false)
  const [closeTrip, setCloseTrip] = useState(null)
  const qc = useQueryClient()
  const fleetForm = useForm({ defaultValues: { type: 'BLS', status: 'AVAILABLE', fuel_level: 80, is_active: true } })
  const dispatchForm = useForm()
  const closeForm = useForm()

  const { data: fleet, isLoading: fleetLoading } = useQuery({ queryKey: ['ambulances'], queryFn: () => api.get('/ambulance').then(r => r.data.data), refetchInterval: 20000 })
  const { data: trips, isLoading } = useQuery({ queryKey: ['ambulance-trips'], queryFn: () => api.get('/ambulance/trips').then(r => r.data.data), refetchInterval: 15000 })
  const vehicles = fleet || []
  const tripRows = trips || []
  const activeTrips = tripRows.filter(t => !['COMPLETED', 'CANCELLED'].includes(t.status))
  const available = vehicles.filter(a => a.status === 'AVAILABLE')
  const avgResponse = activeTrips.length ? Math.round(activeTrips.reduce((sum, t) => sum + minutesSince(t.call_time), 0) / activeTrips.length) : 0

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ambulances'] })
    qc.invalidateQueries({ queryKey: ['ambulance-trips'] })
  }

  const fleetMut = useMutation({
    mutationFn: (payload) => api.post('/ambulance', payload),
    onSuccess: () => { toast.success('Ambulance registered'); refresh(); setShowFleetModal(false); fleetForm.reset({ type: 'BLS', status: 'AVAILABLE', fuel_level: 80, is_active: true }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to register ambulance'),
  })
  const dispatchMut = useMutation({
    mutationFn: ({ id, ...payload }) => api.post(`/ambulance/${id}/dispatch`, payload),
    onSuccess: () => { toast.success('Ambulance dispatched'); refresh(); setDispatchAmbulance(null); dispatchForm.reset() },
    onError: (e) => toast.error(e.response?.data?.message || 'Dispatch failed'),
  })
  const statusMut = useMutation({
    mutationFn: ({ id, ...payload }) => api.patch(`/ambulance/trips/${id}/status`, payload),
    onSuccess: () => { toast.success('Trip updated'); refresh(); setCloseTrip(null); closeForm.reset() },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update trip'),
  })

  const criticalTrips = useMemo(() => activeTrips.filter(t => minutesSince(t.call_time) > 15 && !['PICKED_UP','ARRIVED'].includes(t.status)), [activeTrips])

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ambulance Command Center</h1>
          <p className="page-sub">{vehicles.length} vehicles, {available.length} available, {activeTrips.length} live trips</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" disabled={!available.length} onClick={() => setDispatchAmbulance(available[0] || null)}><Siren size={16} /> Dispatch</button>
          <button className="btn" onClick={() => setShowFleetModal(true)}><Plus size={16} /> Fleet</button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <StatCard icon={<Ambulance size={22} />} value={vehicles.length} label="Fleet size" color="cyan" />
        <StatCard icon={<Activity size={22} />} value={available.length} label="Available now" color="green" />
        <StatCard icon={<Radio size={22} />} value={activeTrips.length} label="Live calls" color="amber" />
        <StatCard icon={<Clock size={22} />} value={`${avgResponse}m`} label="Avg active response" color={avgResponse > 15 ? 'red' : 'blue'} />
        <StatCard icon={<Siren size={22} />} value={criticalTrips.length} label="SLA breach risk" color="red" />
      </div>

      {criticalTrips.length > 0 && <div className="alert-red"><Siren size={18} /> <span>{criticalTrips.length} active calls crossed 15 minutes before pickup or arrival.</span></div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-default text-sm font-semibold text-white">Live Dispatch Board</div>
          {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Vehicle</th><th>Patient</th><th>Pickup</th><th>SLA</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {tripRows.map(t => {
                    const age = minutesSince(t.call_time)
                    return (
                      <tr key={t.id}>
                        <td><div className="text-xs font-semibold text-white">{t.ambulance?.vehicle_no}</div><div className="text-[10px] text-slate-500">{t.ambulance?.type}</div></td>
                        <td><div className="text-xs text-white">{t.patient_name || 'Unknown'}</div><div className="text-[10px] text-slate-500">{t.patient_id || 'No registered UHID'}</div></td>
                        <td className="text-xs"><div>{t.pickup_address}</div><div className="text-slate-500">{fmt.time(t.call_time)}</div></td>
                        <td><span className={age > 15 && !['PICKED_UP','ARRIVED','COMPLETED'].includes(t.status) ? 'badge-red' : 'badge-green'}>{age} min</span></td>
                        <td><Badge status={t.status} /></td>
                        <td>
                          {!['COMPLETED','CANCELLED'].includes(t.status) && (
                            <div className="flex gap-1">
                              <button className="btn text-xs px-2 py-1" onClick={() => statusMut.mutate({ id: t.id, status: nextStatus(t.status) })}>{nextStatus(t.status)}</button>
                              <button className="btn text-xs px-2 py-1" onClick={() => setCloseTrip(t)}>Close</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {!tripRows.length && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No trips today</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-3">Fleet Readiness</h2>
          {fleetLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
            <div className="space-y-2">
              {vehicles.map(a => (
                <div key={a.id} className={`rounded-lg border p-3 ${a.status === 'AVAILABLE' ? 'border-brand-green/30 bg-brand-green/5' : 'border-brand-amber/30 bg-brand-amber/5'}`}>
                  <div className="flex justify-between gap-2"><div className="font-semibold text-xs text-white">{a.vehicle_no}</div><Badge status={a.status} /></div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <span>Type: <strong className="text-white">{a.type}</strong></span>
                    <span className={Number(a.fuel_level || 0) < 25 ? 'text-brand-red' : ''}>Fuel: <strong>{a.fuel_level || 0}%</strong></span>
                    <span className="col-span-2 flex items-center gap-1"><MapPin size={12} /> {a.last_location || 'Location not updated'}</span>
                  </div>
                  {a.status === 'AVAILABLE' && <button className="btn-primary text-xs w-full mt-3" onClick={() => setDispatchAmbulance(a)}>Dispatch this vehicle</button>}
                </div>
              ))}
              {!vehicles.length && <div className="text-xs text-slate-400 text-center py-6">No ambulances registered.</div>}
            </div>
          )}
        </div>
      </div>

      <Modal open={showFleetModal} onClose={() => setShowFleetModal(false)} title="Register Ambulance" size="lg">
        <form onSubmit={fleetForm.handleSubmit(d => fleetMut.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Vehicle no" required><input className="input" {...fleetForm.register('vehicle_no', { required: true })} /></Field>
            <Field label="Type"><select className="select" {...fleetForm.register('type')}>{ambulanceTypes.map(t => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Driver ID"><input className="input" {...fleetForm.register('driver_id')} /></Field>
            <Field label="Fuel level"><input type="number" min="0" max="100" className="input" {...fleetForm.register('fuel_level')} /></Field>
            <Field label="Base / last location"><input className="input" {...fleetForm.register('last_location')} /></Field>
          </div>
          <SubmitRow loading={fleetMut.isPending} label="Save vehicle" onCancel={() => setShowFleetModal(false)} />
        </form>
      </Modal>

      <Modal open={!!dispatchAmbulance} onClose={() => setDispatchAmbulance(null)} title={`Dispatch ${dispatchAmbulance?.vehicle_no || ''}`} size="lg">
        <form onSubmit={dispatchForm.handleSubmit(d => dispatchMut.mutate({ id: dispatchAmbulance?.id, ...d }))} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Patient UHID / reference"><input className="input" {...dispatchForm.register('patient_id')} /></Field>
            <Field label="Patient name"><input className="input" {...dispatchForm.register('patient_name')} /></Field>
            <Field label="Pickup address" required><input className="input" {...dispatchForm.register('pickup_address', { required: true })} /></Field>
            <Field label="Call priority"><select className="select" {...dispatchForm.register('priority')}><option>Emergency</option><option>Urgent</option><option>Routine</option></select></Field>
          </div>
          <Field label="Paramedic notes"><textarea className="textarea" rows={3} {...dispatchForm.register('paramedic_notes')} /></Field>
          <SubmitRow loading={dispatchMut.isPending} label="Dispatch now" onCancel={() => setDispatchAmbulance(null)} />
        </form>
      </Modal>

      <Modal open={!!closeTrip} onClose={() => setCloseTrip(null)} title="Close Ambulance Trip">
        <form onSubmit={closeForm.handleSubmit(d => statusMut.mutate({ id: closeTrip?.id, status: 'COMPLETED', ...d }))} className="space-y-3">
          <Field label="KM covered"><input type="number" step="0.1" className="input" {...closeForm.register('km_covered')} /></Field>
          <Field label="Paramedic notes"><textarea className="textarea" rows={4} {...closeForm.register('paramedic_notes')} /></Field>
          <SubmitRow loading={statusMut.isPending} label="Complete trip" onCancel={() => setCloseTrip(null)} />
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
