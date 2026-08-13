// src/pages/ICUPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'
import toast from 'react-hot-toast'
import {
  Activity,
  AlertTriangle,
  BedDouble,
  ClipboardList,
  HeartPulse,
  Pill,
  Radar,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Waves,
} from 'lucide-react'
import api from '../utils/api'
import { getSocketUrl } from '../utils/runtimeConfig'
import StatCard, { EmptyState } from '../components/common/StatCard'
import Modal from '../components/common/Modal'
import PatientSearch from '../components/patients/PatientSearch'
import { fmt } from '../utils/helpers'
import useAuthStore from '../context/authStore'

const riskOf = (scores = {}) => {
  const sofa = Number(scores?.sofa || 0)
  const apache = Number(scores?.apache2 || 0)
  if (sofa >= 10 || apache >= 25) return 'critical'
  if (sofa >= 6 || apache >= 18) return 'watch'
  return 'stable'
}

const VitalTile = ({ label, value, unit, critical, warning }) => (
  <div className={`vital-box ${critical ? 'border-rose-300 bg-rose-50' : warning ? 'border-amber-300 bg-amber-50' : ''}`}>
    <div className={`vital-val text-base ${critical ? 'vital-critical' : warning ? 'vital-warn' : 'vital-ok'}`}>{value ?? '-'}</div>
    <div className="vital-unit">{unit}</div>
    <div className="vital-name">{label}</div>
  </div>
)

export default function ICUPage() {
  const { token } = useAuthStore()
  const qc = useQueryClient()
  const [liveVitals, setLiveVitals] = useState({})
  const [admitBed, setAdmitBed] = useState(null)
  const [selectedPatient, setSelectedPatient] = useState(null)

  const { data = [], isFetching } = useQuery({
    queryKey: ['icu-patients'],
    queryFn: () => api.get('/icu/patients').then(r => r.data.data || []),
    placeholderData: prev => prev || [],
    staleTime: 15000,
    refetchInterval: 45000,
  })

  const { data: doctors = [] } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => api.get('/staff', { params: { role: 'DOCTOR' } }).then(r => r.data.data || []),
  })

  const admitMut = useMutation({
    mutationFn: payload => api.post('/beds/admit', payload),
    onSuccess: () => {
      toast.success('Patient admitted to ICU')
      setAdmitBed(null)
      setSelectedPatient(null)
      qc.invalidateQueries({ queryKey: ['icu-patients'] })
      qc.invalidateQueries({ queryKey: ['beds'] })
    },
    onError: error => toast.error(error.response?.data?.message || 'ICU admission failed'),
  })

  useEffect(() => {
    if (!token) return
      const socket = io(getSocketUrl(), { auth: { token }, transports: ['websocket', 'polling'] })
    socket.emit('join:icu')
    socket.on('vitals:update', payload => {
      const map = {}
      ;(payload?.beds || []).forEach(b => { map[b.bed] = b })
      setLiveVitals(prev => ({ ...prev, ...map }))
    })
    return () => socket.disconnect()
  }, [token])

  const metrics = useMemo(() => {
    const occupied = data.filter(b => b.admissions?.[0])
    const ready = data.filter(b => !b.admissions?.[0] && ['AVAILABLE', 'RESERVED'].includes(b.status))
    const highRisk = occupied.filter(b => riskOf(b.admissions?.[0]?.icu_records?.[0]) === 'critical')
    const vented = occupied.filter(b => b.admissions?.[0]?.icu_records?.[0]?.vent_mode)
    return { occupied, ready, highRisk, vented }
  }, [data])

  const openFirstReadyBed = () => {
    const readyBed = data.find(b => !b.admissions?.[0] && ['AVAILABLE', 'RESERVED'].includes(b.status))
    if (!readyBed) return toast.error('No ready ICU/HDU bed available')
    setAdmitBed(readyBed)
  }

  return (
    <div className="space-y-4 icu-dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            ICU Command Center
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${isFetching ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
              <Radar size={12} /> {isFetching ? 'SYNC' : 'LIVE'}
            </span>
          </h1>
          <p className="page-sub">{data.length} ICU/HDU beds · acuity scoring · ventilator watch · nursing actions</p>
        </div>
        <button className="btn-primary" onClick={openFirstReadyBed}><BedDouble size={16} /> Admit ICU Patient</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<BedDouble size={22} />} value={metrics.occupied.length} label="Occupied ICU Beds" color="red" />
        <StatCard icon={<ShieldCheck size={22} />} value={metrics.ready.length} label="Ready Beds" color="green" />
        <StatCard icon={<AlertTriangle size={22} />} value={metrics.highRisk.length} label="Critical Acuity" color="amber" />
        <StatCard icon={<Waves size={22} />} value={metrics.vented.length} label="Ventilator Watch" color="cyan" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.length === 0 && (
            <div className="lg:col-span-2 card">
              <EmptyState icon={<HeartPulse />} title="No ICU beds found" description="Create ICU/HDU beds from Bed Management to activate this dashboard." />
            </div>
          )}

          {data.map(bed => {
            const adm = bed.admissions?.[0]
            const p = adm?.patient
            const scores = adm?.icu_records?.[0] || {}
            const live = liveVitals[bed.bed_no] || {}
            const risk = riskOf(scores)
            const occupied = Boolean(adm)
            const ready = !occupied && ['AVAILABLE', 'RESERVED'].includes(bed.status)
            return (
              <div key={bed.id} className={`card icu-bed-card ${risk === 'critical' ? 'border-brand-red/50' : risk === 'watch' ? 'border-brand-amber/50' : 'border-default'}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <HeartPulse size={16} /> {bed.bed_no} · {occupied ? `${p?.first_name || ''} ${p?.last_name || ''}` : 'Ready for admission'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {occupied ? `${p?.uhid || '-'} · ${p?.gender || '-'} · ${fmt.age(p?.dob)}` : `${bed.bed_type} · ${bed.status}`}
                    </div>
                  </div>
                  <span className={`badge ${risk === 'critical' ? 'badge-red' : risk === 'watch' ? 'badge-amber' : occupied ? 'badge-green' : ready ? 'badge-blue' : 'badge-gray'}`}>
                    {occupied ? risk.toUpperCase() : ready ? 'READY' : bed.status}
                  </span>
                </div>

                {occupied ? (
                  <>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-3">
                      <VitalTile label="SpO2" value={live.spo2} unit="%" critical={live.spo2 < 90} warning={live.spo2 < 95} />
                      <VitalTile label="BP" value={live.bp} unit="mmHg" warning={Number(String(live.bp || '').split('/')[0]) > 160} />
                      <VitalTile label="HR" value={live.hr} unit="bpm" critical={live.hr > 130 || live.hr < 40} />
                      <VitalTile label="Temp" value={live.temp} unit="C" warning={Number(live.temp) > 38.5} />
                      <VitalTile label="SOFA" value={scores.sofa} unit="" critical={scores.sofa >= 10} warning={scores.sofa >= 6} />
                      <VitalTile label="GCS" value={scores.gcs} unit="/15" warning={scores.gcs < 13} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div className="rounded-lg bg-white/80 border border-default p-2">APACHE II <strong className="block text-white">{scores.apache2 ?? '-'}</strong></div>
                      <div className="rounded-lg bg-white/80 border border-default p-2">RASS <strong className="block text-white">{scores.rass ?? '-'}</strong></div>
                      <div className="rounded-lg bg-white/80 border border-default p-2">Vent Mode <strong className="block text-cyan">{scores.vent_mode || 'Room air'}</strong></div>
                      <div className="rounded-lg bg-white/80 border border-default p-2">FiO2 <strong className="block text-white">{scores.fio2 ? `${scores.fio2}%` : '-'}</strong></div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button className="btn text-xs flex-1"><ClipboardList size={14} /> Flowsheet</button>
                      <button className="btn text-xs flex-1"><Stethoscope size={14} /> Scores</button>
                      <button className="btn text-xs flex-1"><Pill size={14} /> Meds</button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
                    <BedDouble className={`mx-auto mb-2 ${ready ? 'text-emerald-700' : 'text-slate-500'}`} size={28} />
                    <div className={`text-sm font-bold ${ready ? 'text-emerald-700' : 'text-slate-500'}`}>{ready ? 'Bed clean, monitored, and ready' : `Bed is ${bed.status.toLowerCase()}`}</div>
                    {ready ? (
                      <button className="btn-primary text-xs mt-3 relative z-10" onClick={() => setAdmitBed(bed)}>Admit Patient</button>
                    ) : (
                      <div className="text-xs text-slate-400 mt-2">Not available for admission</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <aside className="space-y-3">
          <div className="card">
            <div className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Activity size={16} /> Acuity Radar</div>
            {['critical', 'watch', 'stable'].map(level => (
              <div key={level} className="flex items-center justify-between py-2 border-b border-default last:border-b-0 text-xs">
                <span className="capitalize text-slate-400">{level}</span>
                <strong className="text-white">{metrics.occupied.filter(b => riskOf(b.admissions?.[0]?.icu_records?.[0]) === level).length}</strong>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Syringe size={16} /> Smart Rounds</div>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="alert-red py-2">Review critical SOFA/APACHE patients first.</div>
              <div className="alert-amber py-2">Check sedation, FiO2, and ventilator settings every round.</div>
              <div className="alert-green py-2">Ready beds are visible immediately for fast ICU admission.</div>
            </div>
          </div>
        </aside>
      </div>

      <Modal open={!!admitBed} onClose={() => { setAdmitBed(null); setSelectedPatient(null) }} title="Admit ICU Patient" size="lg">
        <form
          className="space-y-3"
          onSubmit={e => {
            e.preventDefault()
            const form = Object.fromEntries(new FormData(e.currentTarget))
            if (!selectedPatient?.id) return toast.error('Please select a patient')
            if (!form.admitting_doctor_id) return toast.error('Please select an admitting doctor')
            admitMut.mutate({
              patient_id: selectedPatient.id,
              bed_id: admitBed.id,
              admitting_doctor_id: form.admitting_doctor_id,
              admission_type: form.admission_type || 'EMERGENCY',
              provisional_diagnosis: form.provisional_diagnosis || 'ICU admission',
              estimated_los: form.estimated_los ? Number(form.estimated_los) : null,
              is_mlc: form.is_mlc === 'true',
            })
          }}
        >
          {admitBed && <div className="alert-cyan text-xs">Selected ICU bed: <strong>{admitBed.ward} - {admitBed.bed_no}</strong> ({admitBed.bed_type})</div>}
          <div><label className="label">Patient Search *</label><PatientSearch value={selectedPatient} onChange={setSelectedPatient} placeholder="Enter patient name or UHID..." /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">Admitting Doctor *</label><select className="select" name="admitting_doctor_id" required><option value="">Select doctor</option>{doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</option>)}</select></div>
            <div><label className="label">Admission Type</label><select className="select" name="admission_type"><option value="EMERGENCY">Emergency</option><option value="TRANSFER">Transfer</option><option value="ELECTIVE">Elective</option></select></div>
          </div>
          <div><label className="label">Provisional Diagnosis</label><input className="input" name="provisional_diagnosis" placeholder="Sepsis, respiratory failure, post-op monitoring..." /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label">Est. LOS (days)</label><input className="input" type="number" min="1" name="estimated_los" /></div>
            <div><label className="label">MLC Case?</label><select className="select" name="is_mlc"><option value="false">No</option><option value="true">Yes</option></select></div>
          </div>
          <div className="flex gap-2 pt-2">
            <button className="btn-primary flex-1" disabled={admitMut.isPending}>{admitMut.isPending ? 'Admitting...' : 'Confirm ICU Admission'}</button>
            <button type="button" className="btn flex-1" onClick={() => { setAdmitBed(null); setSelectedPatient(null) }}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
