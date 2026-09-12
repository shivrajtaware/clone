// src/pages/PatientsPage.jsx
import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../utils/api'
import { getSocketUrl } from '../utils/runtimeConfig'
import Modal from '../components/common/Modal'
import BarcodeModal from '../components/patients/BarcodeModal'
import { Badge, Spinner, EmptyState, Pagination } from '../components/common/StatCard'
import { fmt, BLOOD_GROUPS, BG_DISPLAY, GENDERS } from '../utils/helpers'

// List of standard Indian States for the dropdown
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", 
  "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", 
  "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", 
  "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", 
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi"
];

// List of common Cities for the dropdown
const COMMON_CITIES = [
  "Bhor", "Mumbai", "Pune", "Shirwal", "Satara", "Nagpur", "Thane", "Nashik", 
  "Kalyan-Dombivli", "Vasai-Virar", "Aurangabad", "Navi Mumbai", "Solapur", 
  "Mira-Bhayandar", "Bhiwandi", "Amravati", "Nanded", "Kolhapur", "Ulhasnagar", 
  "Sangli-Miraj & Kupwad", "Malegaon", "Jalgaon", "Akola", "Latur", "Dhule", 
  "Ahmednagar", "Chandrapur", "Parbhani", "Ichalkaranji", "Jalna", "Ambarnath", 
  "Panvel", "Yavatmal", "Kamptee", "Gondia", "Wardha", "Hinganghat", "Bangalore", 
  "Hyderabad", "Chennai", "Kolkata", "Ahmedabad", "Surat"
];

export default function PatientsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [gender, setGender] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedBarcodePatient, setSelectedBarcodePatient] = useState(null)
  const qc = useQueryClient()
  
  useEffect(() => {
    const socket = io(getSocketUrl(), { auth: { token: localStorage.getItem('token') } })
    socket.emit('join:patients')
    socket.on('patients:updated', () => {
      qc.invalidateQueries({ queryKey: ['patients'] })
    })
    return () => socket.disconnect()
  }, [qc])

  const { data, isLoading } = useQuery({
    queryKey: ['patients', page, search, gender],
    queryFn: () => api.get('/patients', { params: { page, limit: 20, search, gender } }).then(r => r.data),
    keepPreviousData: true,
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm()
  
  // Auto-suggest sathi navin states (he useForm chya khali add kar)
  const [addressQuery, setAddressQuery] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [addressLoading, setAddressLoading] = useState(false)

  // Auto-suggest fetch karnya sathi API call
  useEffect(() => {
    const fetchLocations = async () => {
      if (addressQuery.length < 3) {
        setAddressSuggestions([])
        return
      }
      try {
        setAddressLoading(true)
        // ArcGIS provides a free, India-focused address suggestion endpoint with exact lookup keys.
        const res = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest?text=${encodeURIComponent(addressQuery)}&countryCode=IND&maxSuggestions=8&f=json`)
        const data = await res.json()
        setAddressSuggestions((data.suggestions || []).map(suggestion => ({
          text: suggestion.text,
          magicKey: suggestion.magicKey,
          display_name: suggestion.text,
        })))
      } catch (err) {
        console.error('Failed to fetch locations', err)
        setAddressSuggestions([])
      } finally {
        setAddressLoading(false)
      }
    }

      // Debounce typing (api spam nako vhayla)
    const delay = setTimeout(fetchLocations, 500)
    return () => clearTimeout(delay)
  }, [addressQuery])

  const selectLocation = async (loc) => {
    try {
      setAddressLoading(true)
      const params = new URLSearchParams({
        SingleLine: loc.text || loc.display_name || '',
        magicKey: loc.magicKey || '',
        countryCode: 'IND',
        maxLocations: '1',
        outFields: '*',
        f: 'json',
      })
      const res = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?${params}`)
      const data = await res.json()
      const candidate = data.candidates?.[0]
      const attributes = candidate?.attributes || {}
      const address = candidate?.address || loc.display_name || loc.text
      setValue('address', address, { shouldValidate: true })
      if (attributes.City) setValue('city', attributes.City)
      if (attributes.Region) setValue('state', attributes.Region)
      if (attributes.Postal) setValue('pincode', attributes.Postal)
    } catch (err) {
      setValue('address', loc.display_name || loc.text || '', { shouldValidate: true })
    } finally {
      setAddressLoading(false)
    }
    setShowSuggestions(false)
    setAddressQuery('')
  }

  const submitPatient = (formData) => {
    const body = { ...formData }
    if (!body.dob && body.age !== '' && body.age != null) {
      const birthDate = new Date()
      birthDate.setFullYear(birthDate.getFullYear() - Number(body.age))
      body.dob = birthDate.toISOString().slice(0, 10)
    }
    delete body.age
    createMut.mutate(body)
  }

  const createMut = useMutation({
    mutationFn: (body) => api.post('/patients', body).then(r => r.data.data),
    onSuccess: (patient) => {
      toast.success(`Patient registered! UHID: ${patient.uhid}`)
      qc.invalidateQueries(['patients'])
      setShowModal(false)
      reset()
    },
    onError: (e) => {
      const details = e.response?.data?.errors
        ?.map(error => `${error.field}: ${error.message}`)
        .join(', ')
      toast.error(details || e.response?.data?.message || 'Registration failed')
    },
  })

  const patients = data?.data || []
  const meta     = data?.meta || {}

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Patient Management</h1>
          <p className="page-sub">{meta.total || 0} total patients registered</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => setShowModal(true)}>+ Register Patient</button>
          <button className="btn">📥 Import CSV</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-3">
          <input className="input flex-1 min-w-[200px]" placeholder="Search by name, UHID, phone, Aadhar..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          <select className="select w-36" value={gender} onChange={e => { setGender(e.target.value); setPage(1) }}>
            <option value="">All Gender</option>
            {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <button className="btn" onClick={() => { setSearch(''); setGender(''); setPage(1) }}>Clear</button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : patients.length === 0 ? (
          <EmptyState icon="👥" title="No patients found" description="Register your first patient to get started." action={<button className="btn-primary mt-2" onClick={() => setShowModal(true)}>+ Register Patient</button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>UHID</th><th>Patient Name</th><th>Age / Gender</th><th>Phone</th>
                    <th>Blood Group</th><th>Ward / Bed</th><th>Status</th><th>Registered</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map(p => {
                    const admission = p.admissions?.[0]
                    return (
                      <tr key={p.id}>
                        <td className="font-mono text-xs text-cyan">{p.uhid}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="avatar-sm bg-gradient-to-br from-cyan to-brand-purple text-[10px] flex-shrink-0">
                              {p.first_name?.[0]}{p.last_name?.[0]}
                            </div>
                            <div>
                              <div className="font-medium text-white text-xs">{p.first_name} {p.last_name}</div>
                              {p.allergies?.length > 0 && <div className="text-[10px] text-brand-red">⚠️ {p.allergies.length} allergy</div>}
                            </div>
                          </div>
                        </td>
                        <td className="text-xs">{fmt.age(p.dob)} · {p.gender}</td>
                        <td className="text-xs font-mono">{p.phone || '—'}</td>
                        <td className="text-xs">{p.blood_group ? BG_DISPLAY[p.blood_group] : '—'}</td>
                        <td className="text-xs">{admission ? `${admission.bed?.ward} · ${admission.bed?.bed_no}` : '—'}</td>
                        <td><Badge status={admission ? 'ADMITTED' : 'ACTIVE'} /></td>
                        <td className="text-xs text-slate-400">{fmt.date(p.created_at)}</td>
                        <td>
                          <div className="flex gap-1">
                            <Link to={`/patients/${p.id}`} className="btn text-xs px-2 py-1">View</Link>
                            <button
                              onClick={() => setSelectedBarcodePatient(p)}
                              className="btn text-xs px-2 py-1"
                              title="View Barcode"
                            >
                              📊 Barcode
                            </button>
                            <Link to={`/emr/${p.id}`} className="btn text-xs px-2 py-1">EMR</Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-3">
              <Pagination page={meta.page} pages={meta.pages} total={meta.total} limit={20} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {/* Register Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Register New Patient" size="lg">
        <form onSubmit={handleSubmit(submitPatient)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">First Name *</label><input className="input" {...register('first_name', { required: true })} /></div>
            <div><label className="label">Last Name *</label><input className="input" {...register('last_name', { required: true })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Age (years)</label><input type="number" min="0" max="130" className="input" placeholder="e.g. 42" {...register('age')} /></div>
            <div><label className="label">Date of Birth</label><input type="date" className="input" {...register('dob')} /></div>
            <div>
              <label className="label">Gender *</label>
              <select className="select" {...register('gender', { required: true })}>
                <option value="">Select</option>
                {GENDERS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Blood Group</label>
              <select className="select" {...register('blood_group')}>
                <option value="">Unknown</option>
                {BLOOD_GROUPS.map(b => <option key={b} value={b}>{BG_DISPLAY[b]}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Mobile Number (optional)</label><input className="input" placeholder="+91 XXXXX XXXXX" {...register('phone')} /></div>
            <div><label className="label">Email</label><input type="email" className="input" {...register('email')} /></div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div><label className="label">Aadhar / National ID</label><input className="input" placeholder="XXXX XXXX XXXX" {...register('aadhar_no')} /></div>
          </div>
          <div className="relative">
            <label className="label">Address</label>
              <input
                className="input"
                placeholder="Search area, landmark, village, or city..."
                autoComplete="off"
                {...register('address')}
              onChange={(e) => {
                register('address').onChange(e) // Keep form logic working
                setAddressQuery(e.target.value)
                setShowSuggestions(true)
              }}
            />
            {showSuggestions && addressLoading && <div className="absolute z-50 w-full mt-1 rounded-lg bg-white p-3 text-xs text-slate-500 shadow-xl">Searching locations…</div>}
            {showSuggestions && !addressLoading && addressSuggestions.length > 0 && (
                 <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {addressSuggestions.map((loc, idx) => (
                    <li 
                      key={idx} 
                      className="p-3 text-xs cursor-pointer hover:bg-cyan-50 border-b border-slate-100 last:border-b-0 text-slate-700"
                      onClick={() => {
                        selectLocation(loc)
                      }}
                      >
                        <div className="font-semibold text-slate-900">{loc.text}</div>
                        <div className="text-[10px] text-slate-500 line-clamp-1">{loc.display_name}</div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">City</label>
              <input className="input" list="city-list" {...register('city')} />
              <datalist id="city-list">
                {COMMON_CITIES.map(c => <option key={c} value={c} />)}
              </datalist>
              </div>
              <div>
              <label className="label">State</label>
                  <select className="select" {...register('state')}>
                  <option value="">Select State</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
              </div>
            <div>
              <label className="label">Pincode</label>
              <input className="input" placeholder="411001" {...register('pincode')} />
            </div>
          </div>
          
          <div><label className="label">Known Allergies (optional — comma separated)</label><input className="input" placeholder="e.g. Penicillin, Aspirin" {...register('_allergies_note')} /></div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={createMut.isPending} className="btn-primary flex-1">
              {createMut.isPending ? 'Registering...' : '✅ Register & Generate UHID'}
            </button>
            <button type="button" className="btn flex-1" onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Barcode Modal */}
      {selectedBarcodePatient && (
        <BarcodeModal
          patientId={selectedBarcodePatient.id}
          patientName={`${selectedBarcodePatient.first_name} ${selectedBarcodePatient.last_name}`}
          onClose={() => setSelectedBarcodePatient(null)}
        />
      )}
    </div>
  )
}
