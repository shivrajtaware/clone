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
import { DRUG_ROUTES, inferredLooseUnit, inferredPackUnit, packSize, normalizedDrugForm } from '../utils/drugForms'
import { getSocketUrl } from '../utils/runtimeConfig'

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
const LIQUID_FORMS = new Set(['syrup', 'suspension', 'drops'])
const PACKAGE_ONLY_FORMS = new Set(['syrup', 'suspension', 'drops', 'injection', 'ampoule', 'vial', 'infusion', 'iv', 'iv fluid', 'inhaler', 'nebule', 'ointment', 'cream', 'gel', 'lotion', 'suppository', 'patch', 'spray', 'bottle'])
const isPackageOnly = (item) => PACKAGE_ONLY_FORMS.has(normalizedDrugForm(item.form))
const issueOptions = (item) => {
  const form = normalizedDrugForm(item.form)
  if (isPackageOnly(item)) return [{ value: 'PACK', label: inferredPackUnit(item) }]
  if (['tablet', 'capsule'].includes(form) && packSize(item) > 1) {
    return [
      { value: 'PACK', label: `${inferredPackUnit(item)} (recommended)` },
      { value: 'LOOSE', label: inferredLooseUnit(item) },
    ]
  }
  return [{ value: 'LOOSE', label: inferredLooseUnit(item) }]
}
const issueMode = (item) => {
  const options = issueOptions(item)
  return options.some(option => option.value === item.quantity_unit) ? item.quantity_unit : options[0].value
}
const suggestedIssueQuantity = (item, mode = issueMode(item)) => {
  const requiredLooseUnits = calculatedQty(item)
  if (mode !== 'PACK') return requiredLooseUnits
  const size = Math.max(1, Number(packSize(item) || 1))
  return size > 1 ? Math.max(1, Math.ceil(requiredLooseUnits / size)) : 1
}
const issuePlan = (item) => {
  const mode = issueMode(item)
  const suggested = suggestedIssueQuantity(item, mode)
  const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : suggested
  return { mode, quantity, suggested, requiredLooseUnits: calculatedQty(item), size: packSize(item) }
}
const routeOptionsFor = (item) => {
  const form = normalizedDrugForm(item.form)
  if (['injection', 'ampoule', 'vial'].includes(form)) return ['IM', 'IV', 'SC']
  if (['infusion', 'iv'].includes(form)) return ['IV']
  if (form === 'inhaler') return ['Inhaled']
  if (form === 'nebule') return ['Nebulized']
  if (['cream', 'ointment', 'gel', 'lotion', 'patch', 'spray'].includes(form)) return ['Topical']
  if (form === 'suppository') return ['Rectal']
  if (form === 'drops') return ['Oral', 'Ophthalmic', 'Otic', 'Nasal']
  return ['Oral']
}
const routeFor = (item) => routeOptionsFor(item).includes(item.route) ? item.route : routeOptionsFor(item)[0]
const doseProfile = (item) => {
  const form = normalizedDrugForm(item.form)
  if (form === 'tablet') return { unit: 'tablet', choices: [0.5, 1, 2] }
  if (form === 'capsule') return { unit: 'capsule', choices: [1, 2] }
  if (['syrup', 'suspension'].includes(form)) return { unit: 'ml', choices: [2.5, 5, 10] }
  if (form === 'drops') return { unit: 'drop', choices: [1, 2, 3] }
  if (['injection', 'ampoule', 'vial'].includes(form)) return { unit: form === 'ampoule' || String(item.unit || '').toLowerCase().includes('ampoule') ? 'ampoule' : 'vial', choices: [1, 2] }
  if (['cream', 'ointment', 'gel', 'lotion'].includes(form)) return { unit: 'application', choices: [1, 2] }
  if (form === 'inhaler') return { unit: 'puff', choices: [1, 2] }
  if (form === 'nebule') return { unit: 'nebule', choices: [1, 2] }
  return { unit: inferredLooseUnit(item), choices: [1, 2] }
}
const doseText = (amount, unit) => `${amount} ${unit === 'ml' || Number(amount) === 1 ? unit : `${unit}s`}`
const doseAmount = (dose = '') => String(dose).match(/\d+(?:\.\d+)?/)?.[0] || ''
const stripClientFields = (item) => {
  const { issue_mode, pack_quantity, unit, pack_unit, units_per_pack, _quantityManual, ...payload } = item
  const plan = issuePlan(item)
  return { ...payload, quantity: plan.quantity, quantity_unit: plan.mode }
}

const emptyRxItem = { drug_name: '', generic_name: '', item_id: '', strength: '', form: '', dose: '', frequency: 'BD', route: 'Oral', duration: '', quantity: 1, quantity_unit: 'LOOSE', issue_mode: 'AUTO', pack_quantity: 1, instructions: '', unit: '', pack_unit: 'container', units_per_pack: 1 }

const resolveSocketUrl = () => {
  const configured = getSocketUrl()
  if (configured) return configured

  if (typeof window === 'undefined') return 'http://localhost:5000'

  const apiBase = import.meta.env.VITE_API_URL || `${getSocketUrl()}/api`
  if (/^https?:\/\//i.test(apiBase)) {
    try {
      const parsed = new URL(apiBase)
      parsed.pathname = ''
      return `${parsed.protocol}//${parsed.host}`
    } catch {}
  }

  // The production reverse proxy serves the API and Socket.IO on the same
  // origin as the UI. Do not append :5000: that port is not exposed to the
  // browser in the client-hosted deployment.
  return window.location.origin
}

const newMedicine = () => ({
  drug_name: '',
  generic_name: '',
  item_id: '',
  strength: '',
  form: '',
  dose: '',
  frequency: 'BD',
  duration: '',
  route: 'Oral',
  instructions: '',
  quantity: 1,
  quantity_unit: 'LOOSE',
  unit: '',
  pack_unit: '',
  units_per_pack: 1,
  _quantityManual: false,
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
  const [patientInput, setPatientInput] = useState('')
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

  const patientSearch = patientInput
  const selectedVisitType = watch('type') || 'REGULAR'

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
    mutationFn: async (body) => {
      const appointment = (await api.post('/appointments', body)).data.data
      if (body.type === 'TELECONSULT' && body.meeting_url) {
        await api.post(`/appointments/${appointment.id}/telemedicine`, {
          mode: body.telemedicine_mode || 'VIDEO',
          provider: body.telemedicine_provider || 'EXTERNAL_LINK',
          meeting_url: body.meeting_url,
        })
      }
      return appointment
    },
    onSuccess: (a) => { toast.success(`Appointment booked! Token: ${a.token_no}`); qc.invalidateQueries(['appointments']); setShowModal(false); setPatientSuggestOpen(false); reset() },
    onError: (e) => toast.error(e.response?.data?.message || 'Booking failed'),
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status, telemedicine }) => telemedicine
      ? api.patch(`/appointments/${id}/telemedicine/status`, { status: status === 'IN_CONSULTATION' ? 'ONGOING' : status })
      : api.patch(`/appointments/${id}/status`, { status }),
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
      if (Object.prototype.hasOwnProperty.call(updates, 'quantity')) next._quantityManual = true
      if (Object.prototype.hasOwnProperty.call(updates, 'quantity_unit')) {
        next.quantity_unit = issueMode(next)
        next.quantity = suggestedIssueQuantity(next, next.quantity_unit)
        next._quantityManual = false
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'item_id') && updates.item_id) {
        next.route = routeFor(next)
        next.quantity_unit = issueMode(next)
        next.quantity = suggestedIssueQuantity(next, next.quantity_unit)
        next._quantityManual = false
      }
      if (['dose', 'frequency', 'duration'].some(key => Object.prototype.hasOwnProperty.call(updates, key))) {
        next.quantity = suggestedIssueQuantity(next)
        next._quantityManual = false
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'drug_name') && !updates.item_id) {
        next.units_per_pack = 1
        next.pack_unit = ''
        next.unit = ''
        next.quantity_unit = 'LOOSE'
        next.quantity = 1
        next._quantityManual = false
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
              <thead><tr><th>Token</th><th>Queue</th><th>Patient</th><th>Doctor</th><th>Department</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {appts.map(a => (
                  <tr key={a.id}>
                    <td><span className="badge badge-cyan font-mono">{a.token_no}</span></td>
                    <td className="font-medium text-cyan text-xs">{a.slot_time === 'WALK_IN' ? 'Walk-in' : 'Queue'}</td>
                    <td>
                      <div className="text-xs font-medium text-white">{a.patient?.first_name} {a.patient?.last_name}</div>
                      <div className="text-[10px] text-slate-400">{a.patient?.uhid} · {a.patient?.phone}</div>
                    </td>
                    <td className="text-xs">Dr. {a.doctor?.first_name} {a.doctor?.last_name}</td>
                    <td className="text-xs text-slate-400">{a.department?.name || '—'}</td>
                    <td><div className="space-y-1"><Badge status={a.type} /><div className="text-[10px] text-slate-400">{fmt.currency(a.fee || 0)}</div></div></td>
                    <td><Badge status={a.type === 'TELECONSULT' && a.telemedicine_session ? a.telemedicine_session.status : a.status} /></td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <Link to={`/patients/${a.patient?.id}`} className="btn text-[10px] px-1.5 py-1">View</Link>
                        <Link to={`/emr/${a.patient?.id}`} className="btn text-[10px] px-1.5 py-1">EMR</Link>
                        {a.type === 'TELECONSULT' && a.telemedicine_session?.meeting_url && <a href={a.telemedicine_session.meeting_url} target="_blank" rel="noreferrer" className="btn text-[10px] px-1.5 py-1 bg-cyan/10 border-cyan/30 text-cyan">{a.telemedicine_session.mode === 'AUDIO' ? 'Audio Call' : 'Video Call'}</a>}
                        {a.type === 'TELECONSULT' && a.telemedicine_session?.status === 'SCHEDULED' && <button className="btn text-[10px] px-1.5 py-1" onClick={() => statusMut.mutate({ id: a.id, status: 'IN_CONSULTATION', telemedicine: true })}>Start Call</button>}
                        {a.status === 'BOOKED' && <button className="btn text-[10px] px-1.5 py-1" onClick={() => statusMut.mutate({ id: a.id, status: 'CHECKED_IN' })}>Check In</button>}
                        {a.status === 'CHECKED_IN' && <button className="btn text-[10px] px-1.5 py-1" onClick={() => statusMut.mutate({ id: a.id, status: 'IN_CONSULTATION', telemedicine: a.type === 'TELECONSULT' })}>Start</button>}
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
                          <div className="text-[11px] text-slate-400">Select the medicine, enter the regimen, then review the suggested issue quantity.</div>
                        </div>
                        {opdMedicines.length > 1 && <button type="button" className="btn text-xs text-brand-red px-2 py-1" onClick={() => setOpdMedicines(prev => prev.filter((_,i) => i!==idx))}>Remove</button>}
                      </div>
                      <div className="mb-2">
                        <label className="label">Medicine *</label>
                        <MedicineSuggestInput item={item} onChange={(updates) => updateOpdMedicine(idx, updates)} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        <div className="md:col-span-12"><ClinicalPrescriptionControls item={item} onChange={(updates) => updateOpdMedicine(idx, updates)} /></div>
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
            <input className="input" placeholder="Start typing patient name..." autoComplete="off" value={patientInput}
              onChange={e => { setPatientInput(e.target.value); setValue('patient_id', '', { shouldValidate: true }); setPatientSuggestOpen(true) }}
              onBlur={() => setTimeout(() => setPatientSuggestOpen(false), 150)} onFocus={() => setPatientSuggestOpen(true)} />
            <input type="hidden" {...register('patient_id', { required: true })} />
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
                      setPatientInput(`${patient.first_name} ${patient.last_name} — ${patient.uhid}`)
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
              <label className="label">Queue Type</label>
              <select className="select" {...register('walk_in')}>
                <option value="">Advance booking</option>
                <option value="true">Direct walk-in</option>
              </select>
            </div>
            <div>
              <label className="label">Visit Type</label>
              <select className="select" {...register('type')}>
                {['REGULAR','FOLLOW_UP','TELECONSULT','HOME_VISIT','EMERGENCY'].map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </div>
          </div>
          {selectedVisitType === 'TELECONSULT' && (
            <div className="rounded-xl border border-cyan/30 bg-cyan/10 p-3 space-y-3">
              <div>
                <div className="text-sm font-semibold text-cyan">Telemedicine setup</div>
                <div className="text-[11px] text-slate-300 mt-1">Use a hospital-hosted Jitsi/BigBlueButton room or any approved external meeting link. MediCore does not create a paid calling account.</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Consultation mode</label><select className="select" {...register('telemedicine_mode')}><option value="VIDEO">Video Call</option><option value="AUDIO">Audio Call</option></select></div>
                <div><label className="label">Link type</label><select className="select" {...register('telemedicine_provider')}><option value="EXTERNAL_LINK">External meeting/call link</option><option value="SELF_HOSTED">Self-hosted hospital service</option><option value="CUSTOM">Custom provider</option></select></div>
              </div>
              <div><label className="label">Meeting or call URL *</label><input className="input" placeholder="https://..." {...register('meeting_url', { required: selectedVisitType === 'TELECONSULT' ? 'Meeting link is required' : false })} /></div>
            </div>
          )}
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
    enabled: open,
    staleTime: 30000,
  })
  const rows = suggestions.data || []

  const selectMedicine = (medicine) => {
    const displayName = [medicine.brand_name, medicine.generic_name].filter(Boolean).join(' / ') || medicine.generic_name
    const form = String(medicine.form || '').toLowerCase()
    onChange({
      item_id: medicine.id,
      drug_name: displayName,
      generic_name: medicine.generic_name,
      strength: medicine.strength || '',
      form: medicine.form || '',
      unit: medicine.unit || '',
      pack_unit: medicine.pack_unit || 'container',
      units_per_pack: medicine.units_per_pack || 1,
      dose: item.dose || '',
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
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-default bg-navy-900 shadow-xl">
          {suggestions.isLoading && <div className="px-3 py-2 text-xs text-slate-400">{query.length >= 2 ? 'Searching pharmacy stock...' : 'Choose an available medicine...'}</div>}
          {!suggestions.isLoading && rows.map(medicine => (
            <button key={medicine.id} type="button" className="block w-full border-b border-default px-3 py-2 text-left last:border-b-0 hover:bg-navy-800" onMouseDown={() => selectMedicine(medicine)}>
              <div className="text-xs font-semibold text-white">{medicine.brand_name || medicine.generic_name}</div>
              <div className="text-[11px] text-slate-400">{medicine.generic_name} | {medicine.form} {medicine.strength || ''} | Stock {medicine.stock_display || `${medicine.current_stock} ${medicine.unit}`} | {medicine.pack_size_label}</div>
            </button>
          ))}
          {!suggestions.isLoading && !rows.length && query.length >= 2 && <button type="button" className="block w-full px-3 py-2 text-left hover:bg-navy-800" onMouseDown={() => { onChange({ drug_name: query, item_id: '', generic_name: '' }); setOpen(false) }}>
            <div className="text-xs font-semibold text-cyan">Use “{query}” as prescribed medicine</div>
            <div className="text-[11px] text-slate-400">Not in inventory now — pharmacy can enter price and GST during billing.</div>
          </button>}
        </div>
      )}
    </div>
  )
}

function ClinicalPrescriptionControls({ item, onChange }) {
  const profile = doseProfile(item)
  const routes = routeOptionsFor(item)
  const regimenComplete = Boolean(item.dose && item.frequency && item.duration)
  const plan = issuePlan(item)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        {item.strength && <span className="rounded bg-navy-700 px-2 py-1 text-slate-200">{item.strength}</span>}
        {item.form && <span className="rounded bg-navy-700 px-2 py-1 text-slate-200">{item.form}</span>}
        {routes.length > 1 ? <label className="flex items-center gap-1">Route <select className="select w-auto py-1 text-xs" value={routeFor(item)} onChange={e => onChange({ route: e.target.value })}>{routes.map(route => <option key={route}>{route}</option>)}</select></label> : <span>Route: <b className="text-slate-200">{routeFor(item)}</b></span>}
        <span className="text-cyan">{regimenComplete ? `Dispense: ${plan.suggested} ${plan.mode === 'PACK' ? inferredPackUnit(item) : inferredLooseUnit(item)}` : 'Quantity will calculate after dose and duration.'}</span>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <div>
          <label className="label">Dose ({profile.unit})</label>
          <div className="flex gap-1">
            {profile.choices.map(amount => <button key={amount} type="button" className={`btn flex-1 px-2 py-1 text-xs ${item.dose === doseText(amount, profile.unit) ? 'border-cyan text-cyan' : ''}`} onClick={() => onChange({ dose: doseText(amount, profile.unit) })}>{amount}</button>)}
            <input className="input w-16 px-2 py-1 text-xs" type="number" min="0" step="0.5" placeholder="Other" value={doseAmount(item.dose)} onChange={e => onChange({ dose: e.target.value ? doseText(e.target.value, profile.unit) : '' })} />
          </div>
        </div>
        <div>
          <label className="label">Frequency</label>
          <div className="flex gap-1">{[['OD','OD'], ['BD','BD'], ['TDS','TDS'], ['QID','QID'], ['SOS','SOS/PRN']].map(([value, label]) => <button key={value} type="button" className={`btn flex-1 px-1 py-1 text-[11px] ${item.frequency === value ? 'border-cyan text-cyan' : ''}`} onClick={() => onChange({ frequency: value })}>{label}</button>)}</div>
        </div>
        <div>
          <label className="label">Duration</label>
          <div className="flex gap-1"><div className="flex min-w-0 flex-1 gap-1">{[3, 5, 7, 10].map(days => <button key={days} type="button" className={`btn flex-1 px-1 py-1 text-xs ${item.duration === `${days} days` ? 'border-cyan text-cyan' : ''}`} onClick={() => onChange({ duration: `${days} days` })}>{days}d</button>)}</div><input className="input w-16 shrink-0 px-1 py-1 text-[11px]" type="text" aria-label="Custom duration" placeholder="Other" value={item.duration && ![3, 5, 7, 10].some(days => item.duration === `${days} days`) ? item.duration : ''} onChange={e => onChange({ duration: e.target.value })} /></div>
        </div>
        <div>
          <label className="label">Instructions</label>
          <div className="flex gap-1">{[['Before food','BF'], ['After food','AF'], ['At bedtime','Bedtime'], ['As needed','PRN']].map(([value, label]) => <button key={value} type="button" className={`btn flex-1 px-1 py-1 text-[11px] ${item.instructions === value ? 'border-cyan text-cyan' : ''}`} onClick={() => onChange({ instructions: value })}>{label}</button>)}</div>
        </div>
      </div>
    </div>
  )
}
