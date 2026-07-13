// src/pages/AppointmentsPage.jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { io } from 'socket.io-client'
import toast from 'react-hot-toast'
import api from '../utils/api'
import useAuthStore from '../context/authStore'
import Modal from '../components/common/Modal'
import { Badge, Spinner, EmptyState } from '../components/common/StatCard'
import StatCard from '../components/common/StatCard'
import { fmt } from '../utils/helpers'
import { DRUG_ROUTES, inferredLooseUnit, inferredPackUnit, packSize } from '../utils/drugForms'

const VISIT_TYPES = ['REGULAR', 'FOLLOW_UP', 'TELECONSULT', 'HOME_VISIT', 'EMERGENCY']
const STATUS_OPTIONS = ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED', 'NO_SHOW', 'CANCELLED']
const QUEUE_STATUSES = ['BOOKED', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION']
const COMMON_TESTS = [
  { name: 'Complete Blood Count (CBC)', code: 'CBC', category: 'Hematology' },
  { name: 'Blood Glucose - Random', code: 'RBS', category: 'Biochemistry' },
  { name: 'CRP', code: 'CRP', category: 'Biochemistry' },
  { name: 'Urine Routine', code: 'URE', category: 'Urinalysis' },
  { name: 'Dengue NS1 / IgM', code: 'DENGUE', category: 'Serology' },
  { name: 'Malaria Parasite', code: 'MP', category: 'Hematology' },
  { name: 'Liver Function Test (LFT)', code: 'LFT', category: 'Biochemistry' },
  { name: 'Renal Function Test (RFT)', code: 'RFT', category: 'Biochemistry' },
]

const frequencyPerDay = (frequency = '') => ({ OD: 1, BD: 2, TDS: 3, QID: 4, NOCTE: 1, STAT: 1, SOS: 1 }[String(frequency).trim().toUpperCase()] || 1)
const parseDoseUnits = (dose = '') => {
  const raw = String(dose).trim().toLowerCase()
  const fraction = raw.match(/(\d+)\s*\/\s*(\d+)/)
  if (fraction) return Number(fraction[1]) / Number(fraction[2])
  const range = raw.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/)
  if (range) return Math.max(Number(range[1]), Number(range[2]))
  const number = raw.match(/\d+(?:\.\d+)?/)
  return number ? Number(number[0]) : 1
}
const parseDurationDays = (duration = '') => {
  const raw = String(duration).trim().toLowerCase()
  const number = raw.match(/\d+(?:\.\d+)?/)
  const amount = number ? Number(number[0]) : 1
  if (raw.includes('week')) return amount * 7
  if (raw.includes('month')) return amount * 30
  return amount
}
const calculatedQty = (item) => Math.max(1, Math.ceil(parseDoseUnits(item.dose) * frequencyPerDay(item.frequency) * parseDurationDays(item.duration)))
const effectiveQty = (item) => {
  if (item.issue_mode === 'PACK') return Math.max(1, Number.parseInt(item.pack_quantity || 1, 10))
  return calculatedQty(item)
}
const stripClientFields = (item) => {
  const { issue_mode, pack_quantity, unit, pack_unit, units_per_pack, ...payload } = item
  return { ...payload, quantity: effectiveQty(item), quantity_unit: issue_mode === 'PACK' ? 'PACK' : 'LOOSE' }
}

const emptyRxItem = { drug_name: '', generic_name: '', item_id: '', strength: '', form: '', dose: '', frequency: 'BD', route: 'Oral', duration: '', quantity: 1, quantity_unit: 'LOOSE', issue_mode: 'AUTO', pack_quantity: 1, instructions: '', unit: '', pack_unit: 'container', units_per_pack: 1 }

const resolveSocketUrl = () => {
  const configured = import.meta.env.VITE_SOCKET_URL?.trim()
  if (configured) return configured

  if (typeof window === 'undefined') return 'http://localhost:5000'

  const apiBase = import.meta.env.VITE_API_URL || '/api'
  if (/^https?:\/\//i.test(apiBase)) {
    try {
      const parsed = new URL(apiBase)
      parsed.pathname = ''
      return `${parsed.protocol}//${parsed.host}`
    } catch {}
  }

  const { protocol, hostname } = window.location
  const host = hostname === 'localhost' || hostname === '127.0.0.1' ? 'localhost' : hostname
  return `${protocol}//${host}:5000`
}

const newMedicine = () => ({
  drug_name: '',
  generic_name: '',
  item_id: '',
  strength: '',
  form: '',
  dose: '',
  frequency: 'BD',
  duration: '3 days',
  route: 'Oral',
  instructions: '',
  quantity: '',
  collect_bill_here: false,
  charge_amount: '',
})

export default function AppointmentsPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState('queue')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [doctorFilter, setDoctorFilter] = useState('')
  const [patientSuggestOpen, setPatientSuggestOpen] = useState(false)
  const [opdAppointment, setOpdAppointment] = useState(null)
  const [opdStackId, setOpdStackId] = useState('')
  const [opdMedicines, setOpdMedicines] = useState([newMedicine()])
  const [opdTests, setOpdTests] = useState([])
  const [opdSampleType, setOpdSampleType] = useState('Blood')
  const [opdIsStat, setOpdIsStat] = useState(false)
  const [opdNotes, setOpdNotes] = useState('')
  const [opdFindings, setOpdFindings] = useState('')
  const [opdDiagnosis, setOpdDiagnosis] = useState('')
  const [opdAllergies, setOpdAllergies] = useState('')
  const [opdCollectPayment, setOpdCollectPayment] = useState(true)
  const [opdPaymentMode, setOpdPaymentMode] = useState('CASH')
  const [opdPaymentReference, setOpdPaymentReference] = useState('')
  const [opdConsultationFee, setOpdConsultationFee] = useState('')
  const { user, token } = useAuthStore()
  const qc = useQueryClient()
  useEffect(() => {
    const socketUrl = resolveSocketUrl()
    const socket = io(socketUrl, { auth: { token: localStorage.getItem('token') } })
    socket.on('appointments:refresh', () => {
      qc.invalidateQueries({ queryKey: ['appointments'] })
      qc.invalidateQueries({ queryKey: ['appt-stats'] })
    })
    return () => socket.disconnect()
  }, [qc])
  const { register, handleSubmit, watch, reset, setValue } = useForm({ defaultValues: { appointment_date: date } })
  const isDoctor = user?.role === 'DOCTOR'
  const effectiveDoctorId = isDoctor ? user?.id : doctorFilter
  const statusParam = activeTab === 'queue' ? QUEUE_STATUSES.join(',') : statusFilter

  const { data: apptData, isLoading } = useQuery({
    queryKey: ['appointments', date, activeTab, typeFilter, statusFilter, effectiveDoctorId],
    queryFn: () => api.get('/appointments', {
      params: {
        date,
        type: typeFilter || undefined,
        status: statusParam || undefined,
        doctor_id: effectiveDoctorId || undefined,
      },
    }).then(r => r.data),
    enabled: !isDoctor || !!user?.id,
  })

  const { data: statsData } = useQuery({
    queryKey: ['appt-stats', date, typeFilter, effectiveDoctorId],
    queryFn: () => api.get('/appointments/stats', {
      params: {
        date,
        type: typeFilter || undefined,
        doctor_id: effectiveDoctorId || undefined,
      },
    }).then(r => r.data.data),
    enabled: !isDoctor || !!user?.id,
  })

  const { data: doctors, refetch: refetchDoctors } = useQuery({
    queryKey: ['doctors'],
    queryFn: () => api.get('/staff', { params: { role: 'DOCTOR' } }).then(r => r.data.data),
    enabled: !!user && !isDoctor,
  })

  const { data: medicineStacks } = useQuery({
    queryKey: ['medicine-stacks'],
    queryFn: () => api.get('/medicine-stacks').then(r => r.data.data),
  })
  const labTests = []

  const watchDoctor = watch('doctor_id')
  const watchDate   = watch('appointment_date')
  const watchSlot   = watch('slot_time')
  const patientSearch = watch('patient_id') || ''

  const { data: slots } = useQuery({
    queryKey: ['slots', watchDoctor, watchDate],
    queryFn: () => api.get('/appointments/slots', { params: { doctor_id: watchDoctor, date: watchDate } }).then(r => r.data.data),
    enabled: !!watchDoctor && !!watchDate,
  })
  const selectedSlot = (slots || []).find(slot => slot.time === watchSlot)

  const { data: patientSuggestions, isFetching: patientsFetching } = useQuery({
    queryKey: ['patient-search', patientSearch],
    queryFn: () => api.get('/patients/search', { params: { q: patientSearch } }).then(r => r.data.data),
    enabled: showModal && patientSuggestOpen && patientSearch.trim().length >= 2,
    staleTime: 30000,
  })

  useEffect(() => {
    if (!token) return

    const socket = io(resolveSocketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    })

    socket.on('connect', () => {
      // eslint-disable-next-line no-console
      console.debug('Socket connected (appointments page)', socket.id)
    })
    socket.on('connect_error', (error) => {
      // eslint-disable-next-line no-console
      console.error('Socket connect error (appointments page)', error)
    })
    socket.on('disconnect', (reason) => {
      // eslint-disable-next-line no-console
      console.debug('Socket disconnected (appointments page)', reason)
    })

    socket.on('appointments:refresh', (payload) => {
      // eslint-disable-next-line no-console
      console.debug('Received appointments:refresh', payload)
      qc.invalidateQueries({ queryKey: ['appointments'] })
      qc.invalidateQueries({ queryKey: ['appt-stats'] })
      qc.refetchQueries({ queryKey: ['appointments'], type: 'active' })
      qc.refetchQueries({ queryKey: ['appt-stats'], type: 'active' })
    })

    socket.on('staff:refresh', () => {
      qc.invalidateQueries({ queryKey: ['doctors'] })
      qc.refetchQueries({ queryKey: ['doctors'], type: 'active' })
    })

    return () => socket.disconnect()
  }, [qc, token, refetchDoctors])

  useEffect(() => {
    if (showModal) refetchDoctors()
  }, [showModal, refetchDoctors])

  const createMut = useMutation({
    mutationFn: (body) => api.post('/appointments', body).then(r => r.data.data),
    onSuccess: (a) => { toast.success(`Appointment booked! Token: ${a.token_no}`); qc.invalidateQueries(['appointments']); setShowModal(false); setPatientSuggestOpen(false); reset() },
    onError: (e) => toast.error(e.response?.data?.message || 'Booking failed'),
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/appointments/${id}/status`, { status }),
    onSuccess: (_, vars) => {
      toast.success('Status updated')
      qc.invalidateQueries(['appointments'])
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Status update failed'),
  })

  const completeOpdMut = useMutation({
    mutationFn: (body) => api.post(`/appointments/${opdAppointment.id}/complete-opd`, body).then(r => r.data.data),
    onSuccess: (data) => {
      const sentTo = [
        data.pharmacy_queue ? 'pharmacy' : null,
        data.lab_queue ? 'lab' : null,
      ].filter(Boolean).join(' and ')
      const billText = data.bill_created ? ` Bill: ${data.bill?.bill_no || 'created'}` : ''
      toast.success(sentTo ? `OPD completed and sent to ${sentTo}.${billText}` : `OPD completed.${billText}`)
      qc.invalidateQueries(['appointments'])
      qc.invalidateQueries(['appt-stats'])
      qc.invalidateQueries(['lab-orders'])
      qc.invalidateQueries(['lab-stats'])
      qc.invalidateQueries(['pharmacy-prescriptions'])
      closeOpd()
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Unable to complete OPD'),
  })

  const appts = apptData?.data || []
  const activeStacks = (medicineStacks || []).filter(s => s.is_active)
  const selectedOpdStack = activeStacks.find(stack => stack.id === opdStackId)

  const openOpd = (appointment) => {
    setOpdAppointment(appointment)
    setOpdStackId(appointment.medicine_stack_id || '')
    setOpdMedicines([newMedicine()])
    setOpdTests([])
    setOpdSampleType('Blood')
    setOpdIsStat(false)
    setOpdNotes(appointment.notes || appointment.chief_complaint || '')
    setOpdFindings('')
    setOpdDiagnosis('')
    setOpdAllergies('')
    setOpdCollectPayment(true)
    setOpdPaymentMode('CASH')
    setOpdPaymentReference('')
    setOpdConsultationFee('')
  }

  const closeOpd = () => {
    setOpdAppointment(null)
    setOpdStackId('')
    setOpdMedicines([newMedicine()])
    setOpdTests([])
    setOpdSampleType('Blood')
    setOpdIsStat(false)
    setOpdNotes('')
    setOpdFindings('')
    setOpdDiagnosis('')
    setOpdAllergies('')
    setOpdCollectPayment(true)
    setOpdPaymentMode('CASH')
    setOpdPaymentReference('')
    setOpdConsultationFee('')
  }

  const updateOpdMedicine = (index, updates) => {
    setOpdMedicines(prev => prev.map((row, i) => {
      if (i !== index) return row
      const next = { ...row, ...updates }
      if (['dose', 'frequency', 'duration'].some(key => Object.prototype.hasOwnProperty.call(updates, key))) {
        next.quantity = calculatedQty(next)
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'drug_name') && !updates.item_id) {
        next.units_per_pack = 1
        next.pack_unit = ''
        next.unit = ''
      }
      return next
    }))
  }

  const submitOpd = () => {
    if (!opdAppointment) return
    if (!opdStackId) {
      const filledMedicines = opdMedicines.filter(item => item.drug_name.trim() || item.dose.trim() || item.duration.trim())
      const invalidMedicine = filledMedicines.some(item => !item.drug_name.trim() || !item.dose.trim() || !item.frequency.trim() || !item.duration.trim())
      if (invalidMedicine) {
        toast.error('Manual medicines need name, dose, frequency, and duration')
        return
      }
    }
    completeOpdMut.mutate({
      medicine_stack_id: opdStackId || undefined,
      medicines: opdStackId ? [] : opdMedicines.filter(item => item.drug_name.trim()).map(stripClientFields),
      consultation_fee: opdConsultationFee || 0,
      notes: [opdNotes, `Findings: ${opdFindings}`, `Diagnosis: ${opdDiagnosis}`, `Allergies: ${opdAllergies}`].filter(Boolean).join(' | '),
      collect_payment: opdCollectPayment,
      payment_mode: opdCollectPayment ? opdPaymentMode : undefined,
      payment_reference: opdPaymentReference || undefined,
    })
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Appointments & Scheduling</h1>
          <p className="page-sub">{isDoctor ? 'My OPD patients' : 'OPD queue'} · {appts.length} appointments on {fmt.date(date)}</p>
        </div>
        <div className="flex gap-2">
          <input type="date" className="input w-40" value={date} onChange={e => setDate(e.target.value)} />
          <button className="btn-primary" onClick={() => { setValue('appointment_date', date); setShowModal(true) }}>+ Book Appointment</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="📅" value={statsData?.total || 0} label="Total Booked" color="cyan" />
        <StatCard icon="✅" value={statsData?.completed || 0} label="Completed" color="green" />
        <StatCard icon="⏳" value={statsData?.pending || 0} label="Pending" color="amber" />
        <StatCard icon="❌" value={statsData?.no_show || 0} label="No-Show" color="red" />
      </div>

      <div className="tabs">
        {['queue','all'].map(t => <div key={t} className={`tab ${activeTab===t?'active':''}`} onClick={() => setActiveTab(t)}>{t === 'queue' ? '🎫 Today\'s Queue' : '📋 All Appointments'}</div>)}
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-3">
          <select className="select w-44" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Visit Types</option>
            {VISIT_TYPES.map(type => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
          </select>
          {!isDoctor && (
            <select className="select w-52" value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)}>
              <option value="">All Doctors</option>
              {(doctors || []).map(d => <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</option>)}
            </select>
          )}
          {activeTab === 'all' && (
            <select className="select w-44" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>)}
            </select>
          )}
          <button className="btn" onClick={() => { setTypeFilter(''); setStatusFilter(''); setDoctorFilter('') }}>Clear</button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? <div className="flex justify-center py-12"><Spinner size="lg" /></div> :
        appts.length === 0 ? <EmptyState icon="📅" title="No appointments" description="No appointments scheduled for this date." action={<button className="btn-primary mt-2" onClick={() => { setValue('appointment_date', date); setShowModal(true) }}>+ Book Appointment</button>} /> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Token</th><th>Time</th><th>Patient</th><th>Doctor</th><th>Department</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {appts.map(a => (
                  <tr key={a.id}>
                    <td><span className="badge badge-cyan font-mono">{a.token_no}</span></td>
                    <td className="font-medium text-cyan text-xs">{a.slot_time}</td>
                    <td>
                      <div className="text-xs font-medium text-white">{a.patient?.first_name} {a.patient?.last_name}</div>
                      <div className="text-[10px] text-slate-400">{a.patient?.uhid} · {a.patient?.phone}</div>
                    </td>
                    <td className="text-xs">Dr. {a.doctor?.first_name} {a.doctor?.last_name}</td>
                    <td className="text-xs text-slate-400">{a.department?.name || '—'}</td>
                    <td><div className="space-y-1"><Badge status={a.type} /><div className="text-[10px] text-slate-400">{fmt.currency(a.fee || 0)}</div></div></td>
                    <td><Badge status={a.status} /></td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <Link to={`/patients/${a.patient?.id}`} className="btn text-[10px] px-1.5 py-1">View</Link>
                        <Link to={`/emr/${a.patient?.id}`} className="btn text-[10px] px-1.5 py-1">EMR</Link>
                        {a.status === 'BOOKED' && <button className="btn text-[10px] px-1.5 py-1" onClick={() => statusMut.mutate({ id: a.id, status: 'CHECKED_IN' })}>Check In</button>}
                        {a.status === 'CHECKED_IN' && <button className="btn text-[10px] px-1.5 py-1" onClick={() => statusMut.mutate({ id: a.id, status: 'IN_CONSULTATION' })}>Start</button>}
                        {['CHECKED_IN','IN_CONSULTATION'].includes(a.status) && <button className="btn text-[10px] px-1.5 py-1 bg-cyan/10 border-cyan/30 text-cyan" onClick={() => openOpd(a)}>OPD</button>}
                        {['BOOKED','CONFIRMED'].includes(a.status) && <button className="btn text-[10px] px-1.5 py-1 text-brand-red" onClick={() => statusMut.mutate({ id: a.id, status: 'CANCELLED' })}>Cancel</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!opdAppointment} onClose={closeOpd} title="OPD Consultation" size="xl">
        {opdAppointment && (
          <div className="space-y-4 animate-fade-in">
            {/* Patient Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-cyan/20 to-brand-purple/20 border border-cyan/30 rounded-xl p-4">
              <div>
                <div className="text-sm font-semibold text-white">{opdAppointment.patient?.first_name} {opdAppointment.patient?.last_name}</div>
                <div className="text-xs text-slate-400">{opdAppointment.patient?.uhid} · {opdAppointment.patient?.phone || 'No phone'} · {opdAppointment.type?.replace(/_/g, ' ')}</div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge status={opdAppointment.status} />
                {opdAppointment.priority && <Badge status={opdAppointment.priority} />}
              </div>
            </div>

            {/* Consultation Form */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column - Patient Info */}
              <div className="space-y-3">
                <div className="bg-navy-800 rounded-xl p-4 border border-default">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <span>📋</span> Chief Complaint & Findings
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="label">Chief Complaint *</label>
                      <textarea className="textarea h-16" placeholder="Patient's main complaint/reason for visit..." value={opdNotes} onChange={e => setOpdNotes(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Examination Findings</label>
                      <textarea className="textarea h-16" placeholder="Physical examination, vitals, observations..." value={opdFindings} onChange={e => setOpdFindings(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Diagnosis *</label>
                      <textarea className="textarea h-16" placeholder="Final diagnosis or clinical impression..." value={opdDiagnosis} onChange={e => setOpdDiagnosis(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Known Allergies</label>
                      <input className="input" placeholder="e.g. Penicillin, Peanuts" value={opdAllergies} onChange={e => setOpdAllergies(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* External lab tests are recorded only from the patient's EMR. */}
              {false && <div className="bg-navy-800 rounded-xl p-4 border border-default">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <span>🧪</span> Lab Tests
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Sample Type</label>
                      <select className="select" value={opdSampleType} onChange={e => setOpdSampleType(e.target.value)}>
                        {['Blood','Urine','Stool','Sputum','CSF','Swab','Other'].map(type => <option key={type}>{type}</option>)}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={opdIsStat} onChange={e => setOpdIsStat(e.target.checked)} className="w-4 h-4" />
                        <span className="text-slate-300">STAT (Urgent)</span>
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto bg-navy-900 rounded-lg p-3 border border-default/50">
                    {(labTests.length ? labTests : COMMON_TESTS).map(test => {
                      const code = test.code || test.test_code || test.name
                      return <label key={code} className="flex items-center gap-2 cursor-pointer hover:bg-navy-800 rounded px-2 py-1 transition">
                        <input
                          type="checkbox"
                          checked={opdTests.some(t => (t.code || t.test_code || t.name) === code)}
                          onChange={e => {
                            if (e.target.checked) setOpdTests(prev => [...prev, { name: test.name, code: test.code || code, category: test.category }])
                            else setOpdTests(prev => prev.filter(t => (t.code || t.test_code || t.name) !== code))
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-xs text-slate-300">{test.name}{test.price !== undefined ? ` - ${fmt.currency(test.price)}` : ''}</span>
                      </label>
                    })}
                  </div>
                  <div className="text-xs text-slate-400">Selected: <span className="text-cyan font-semibold">{opdTests.length}</span> tests</div>
                </div>
              </div>}
            </div>

            <div className="bg-navy-800 rounded-xl p-4 border border-cyan/20">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Consultation Billing</h3>
                  <p className="text-xs text-slate-400 mt-1">Type the consultation fee for this visit. External lab tests are recorded only in EMR.</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={opdCollectPayment} onChange={e => setOpdCollectPayment(e.target.checked)} />
                  Collect now
                </label>
              </div>
              <div className="mt-3 max-w-sm">
                <label className="label">Consultation Fee</label>
                <input type="number" min="0" step="0.01" className="input" placeholder="Enter fee" value={opdConsultationFee} onChange={e => setOpdConsultationFee(e.target.value)} />
              </div>
              {opdCollectPayment && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="label">Payment Mode</label>
                    <select className="select" value={opdPaymentMode} onChange={e => setOpdPaymentMode(e.target.value)}>
                      {['CASH','UPI','CARD','ONLINE','NET_BANKING','CHEQUE'].map(mode => <option key={mode}>{mode}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Reference</label>
                    <input className="input" placeholder="UPI / card / online ref" value={opdPaymentReference} onChange={e => setOpdPaymentReference(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            {/* Medicines Section */}
            <div className="bg-navy-800 rounded-xl p-4 border border-default">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>💊</span> Prescriptions
                </h3>
              </div>

              <div className="mb-3">
                <label className="label">Medicine Stack</label>
                <div className="flex gap-2">
                  <select className="select flex-1" value={opdStackId} onChange={e => setOpdStackId(e.target.value)}>
                    <option value="">Use manual medicines</option>
                    {(medicineStacks || []).filter(s => s.is_active).map(stack => <option key={stack.id} value={stack.id}>{stack.name}{stack.condition ? ` - ${stack.condition}` : ''}</option>)}
                  </select>
                  {opdStackId && <button type="button" className="btn text-xs" onClick={() => setOpdStackId('')}>Clear</button>}
                </div>
              </div>

              {opdStackId ? (
                // Show selected stack medicines
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th></tr></thead>
                    <tbody>
                      {(medicineStacks || []).find(s => s.id === opdStackId)?.items?.map(item => (
                        <tr key={item.id}>
                          <td className="text-xs font-medium text-white">{item.drug_name}{item.strength ? ` ${item.strength}` : ''}</td>
                          <td className="text-xs">{item.dose}</td>
                          <td className="text-xs">{item.frequency}</td>
                          <td className="text-xs">{item.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                // Manual medicines with pharmacy suggestions
                <div className="space-y-3">
                  {opdMedicines.map((item, idx) => (
                    <div key={idx} className="rounded-lg border border-default bg-navy-900 p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-semibold text-white">Medicine {idx + 1}</div>
                          <div className="text-[11px] text-slate-400">Choose auto dose quantity or direct container issue.</div>
                        </div>
                        {opdMedicines.length > 1 && <button type="button" className="btn text-xs text-brand-red px-2 py-1" onClick={() => setOpdMedicines(prev => prev.filter((_,i) => i!==idx))}>Remove</button>}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        <div className="md:col-span-7">
                          <label className="label">Drug Name *</label>
                          <MedicineSuggestInput
                            item={item}
                            onChange={(updates) => updateOpdMedicine(idx, updates)}
                          />
                        </div>
                        <div className="md:col-span-5"><label className="label">Strength</label><input className="input" placeholder="e.g. 500mg" value={item.strength||''} onChange={e => setOpdMedicines(prev => prev.map((r,i) => i===idx ? {...r, strength: e.target.value} : r))} /></div>
                        <div className="md:col-span-3"><label className="label">Dose</label><input className="input" placeholder="e.g. 1 tablet" value={item.dose} onChange={e => updateOpdMedicine(idx, { dose: e.target.value })} /></div>
                        <div className="md:col-span-3"><label className="label">Frequency</label>
                          <select className="select" value={item.frequency} onChange={e => updateOpdMedicine(idx, { frequency: e.target.value })}>
                            {['OD','BD','TDS','QID','SOS','Nocte','Stat'].map(f => <option key={f}>{f}</option>)}
                          </select>
                        </div>
                        <div className="md:col-span-3"><label className="label">Route</label>
                          <select className="select" value={item.route} onChange={e => setOpdMedicines(prev => prev.map((r,i) => i===idx ? {...r, route: e.target.value} : r))}>
                            {DRUG_ROUTES.map(r => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                        <div className="md:col-span-3"><label className="label">Duration</label><input className="input" placeholder="e.g. 5 days" value={item.duration} onChange={e => updateOpdMedicine(idx, { duration: e.target.value })} /></div>
                        <div className="md:col-span-4">
                          <label className="label">Issue Option</label>
                          <select className="select" value={item.issue_mode || 'AUTO'} onChange={e => updateOpdMedicine(idx, { issue_mode: e.target.value })}>
                            <option value="AUTO">Auto from dosage</option>
                            <option value="PACK">Container/pack</option>
                          </select>
                          <div className="mt-1 text-[11px] text-slate-400">
                            {packSize(item) > 1 ? `1 ${inferredPackUnit(item)} = ${packSize(item)} ${inferredLooseUnit(item)}` : 'Pharmacy will use inventory container size during billing'}
                          </div>
                        </div>
                        <div className="md:col-span-4">
                          <label className="label">{item.issue_mode === 'PACK' ? `${inferredPackUnit(item)} Qty` : 'Dispense Qty'}</label>
                          {item.issue_mode === 'PACK' ? (
                            <>
                              <input type="number" min="1" className="input" value={item.pack_quantity || 1} onChange={e => updateOpdMedicine(idx, { pack_quantity: e.target.value })} />
                              <div className="mt-1 text-[11px] text-cyan">
                                {packSize(item) > 1 ? `${Number.parseInt(item.pack_quantity || 1, 10) * packSize(item)} ${inferredLooseUnit(item)} total` : 'Total units will be resolved in pharmacy'}
                              </div>
                            </>
                          ) : (
                            <input className="input" placeholder="Auto" value={effectiveQty(item)} readOnly />
                          )}
                        </div>
                        <div className="md:col-span-4"><label className="label">Instructions</label><input className="input" placeholder="e.g. After food" value={item.instructions||''} onChange={e => setOpdMedicines(prev => prev.map((r,i) => i===idx ? {...r, instructions: e.target.value} : r))} /></div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-cyan/30 bg-cyan/5 p-3">
                        <label className="flex items-center gap-2 text-sm text-white">
                          <input type="checkbox" checked={!!item.collect_bill_here} onChange={e => updateOpdMedicine(idx, { collect_bill_here: e.target.checked })} />
                          Collect bill here (given in OPD room)
                        </label>
                        {item.collect_bill_here && <div className="text-xs text-cyan">Selling price and GST are taken automatically from the earliest-expiry stock batch. Stock is issued immediately after OPD completion.</div>}
                      </div>
                      {item.item_id && <div className="mt-2 text-[11px] text-cyan">Linked to pharmacy stock: {item.generic_name || item.drug_name}{item.form ? ` | ${item.form}` : ''}</div>}
                    </div>
                  ))}
                  <button type="button" className="btn text-sm w-full" onClick={() => setOpdMedicines(prev => [...prev, { ...emptyRxItem }])}>+ Add Medicine</button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button type="button" disabled={completeOpdMut.isPending} className="btn-primary flex-1" onClick={submitOpd}>
                {completeOpdMut.isPending ? '⏳ Completing...' : '✅ Complete OPD'}
              </button>
              <button type="button" className="btn flex-1" onClick={closeOpd}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Book Appointment Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Book Appointment" size="lg">
        <form onSubmit={handleSubmit(d => createMut.mutate(d))} className="space-y-4">
          <div className="relative">
            <label className="label">Patient UHID, Name, or Phone *</label>
            <input
              className="input"
              placeholder="Start typing patient name..."
              autoComplete="off"
              {...register('patient_id', {
                required: true,
                onChange: () => setPatientSuggestOpen(true),
                onBlur: () => setTimeout(() => setPatientSuggestOpen(false), 150),
              })}
              onFocus={() => setPatientSuggestOpen(true)}
            />
            {patientSuggestOpen && patientSearch.trim().length >= 2 && (
              <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-default bg-navy-700 shadow-2xl">
                {patientsFetching && <div className="px-3 py-2 text-xs text-slate-400">Searching patients...</div>}
                {!patientsFetching && (patientSuggestions || []).map(patient => (
                  <button
                    type="button"
                    key={patient.id}
                    className="w-full px-3 py-2 text-left hover:bg-navy-600 transition-colors"
                    onMouseDown={() => {
                      setValue('patient_id', patient.uhid, { shouldValidate: true, shouldDirty: true })
                      setPatientSuggestOpen(false)
                    }}
                  >
                    <div className="text-xs font-medium text-white">{patient.first_name} {patient.last_name}</div>
                    <div className="text-[10px] text-slate-400">{patient.uhid} | {patient.phone || 'No phone'} | {patient.gender}</div>
                  </button>
                ))}
                {!patientsFetching && patientSuggestions?.length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-400">No matching patient found.</div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Doctor *</label>
              <select className="select" {...register('doctor_id', { required: true })}>
                <option value="">Select Doctor</option>
                {(doctors || []).map(d => <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name} — {d.department?.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input" {...register('appointment_date', { required: true })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Time Slot *</label>
              <input
                type="time"
                className="input"
                min="09:00"
                max="17:45"
                step="900"
                disabled={!watchDoctor || !watchDate}
                {...register('slot_time', { required: true })}
              />
              {watchDoctor && watchDate && watchSlot && (
                <p className={`mt-1 text-[11px] ${selectedSlot?.available ? 'text-emerald-400' : 'text-brand-red'}`}>
                  {selectedSlot?.available ? 'Available' : 'Choose an available 15-minute clinic slot.'}
                </p>
              )}
            </div>
            <div>
              <label className="label">Visit Type</label>
              <select className="select" {...register('type')}>
                {['REGULAR','FOLLOW_UP','TELECONSULT','HOME_VISIT','EMERGENCY'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Chief Complaint</label><input className="input" placeholder="Brief reason for visit..." {...register('chief_complaint')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <select className="select" {...register('priority')}>
                {['NORMAL','URGENT','EMERGENCY'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="rounded-lg border border-cyan/20 bg-cyan/10 px-3 py-2">
              <div className="text-xs font-semibold text-cyan">Consultation fee</div>
              <div className="text-[11px] text-slate-300">Enter fee manually while completing OPD.</div>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={createMut.isPending} className="btn-primary flex-1">{createMut.isPending ? 'Booking...' : '✅ Confirm Appointment'}</button>
            <button type="button" className="btn flex-1" onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// Medicine suggestion component with pharmacy integration for OPD
function MedicineSuggestInput({ item, onChange }) {
  const [open, setOpen] = useState(false)
  const query = String(item.drug_name || '').trim()
  const suggestions = useQuery({
    queryKey: ['pharmacy-medicine-suggestions', query],
    queryFn: () => api.get('/pharmacy/medicine-suggestions', { params: { search: query } }).then(r => r.data.data),
    enabled: query.length >= 2,
    staleTime: 30000,
  })
  const rows = suggestions.data || []

  const selectMedicine = (medicine) => {
    const displayName = [medicine.brand_name, medicine.generic_name].filter(Boolean).join(' / ') || medicine.generic_name
    onChange({
      item_id: medicine.id,
      drug_name: displayName,
      generic_name: medicine.generic_name,
      strength: medicine.strength || '',
      form: medicine.form || '',
      unit: medicine.unit || '',
      pack_unit: medicine.pack_unit || 'container',
      units_per_pack: medicine.units_per_pack || 1,
    })
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        className="input"
        placeholder="Start typing generic or brand name"
        value={item.drug_name}
        onFocus={() => setOpen(true)}
        onChange={e => {
          onChange({ drug_name: e.target.value, item_id: '', generic_name: '' })
          setOpen(true)
        }}
      />
      {open && query.length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-default bg-navy-900 shadow-xl">
          {suggestions.isLoading && <div className="px-3 py-2 text-xs text-slate-400">Searching pharmacy stock...</div>}
          {!suggestions.isLoading && rows.map(medicine => (
            <button key={medicine.id} type="button" className="block w-full border-b border-default px-3 py-2 text-left last:border-b-0 hover:bg-navy-800" onMouseDown={() => selectMedicine(medicine)}>
              <div className="text-xs font-semibold text-white">{medicine.brand_name || medicine.generic_name}</div>
              <div className="text-[11px] text-slate-400">{medicine.generic_name} | {medicine.form} {medicine.strength || ''} | Stock {medicine.stock_display || `${medicine.current_stock} ${medicine.unit}`} | {medicine.pack_size_label}</div>
            </button>
          ))}
          {!suggestions.isLoading && !rows.length && <div className="px-3 py-2 text-xs text-slate-400">No matching pharmacy stock found.</div>}
        </div>
      )}
    </div>
  )
}
