// src/pages/PatientDetailPage.jsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../utils/api'
import BarcodeModal from '../components/patients/BarcodeModal'
import Modal from '../components/common/Modal'
import { Badge, Spinner } from '../components/common/StatCard'
import { fmt, BG_DISPLAY } from '../utils/helpers'

export default function PatientDetailPage() {
  const { id } = useParams()
  const [showBarcodeModal, setShowBarcodeModal] = useState(false)
  const [showDischargeModal, setShowDischargeModal] = useState(false)
  
  // State for the Edit Modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editData, setEditData] = useState({})
  
  const qc = useQueryClient()
  
  // Safely fetch data and catch errors
  const { data: patient, isLoading, isError, error } = useQuery({
    queryKey: ['patient', id],
    // Added fallback: if r.data.data is undefined, it uses r.data
    queryFn: () => api.get(`/patients/${id}`).then(r => r.data.data || r.data),
    enabled: !!id,
  })

  const dischargeMut = useMutation({
    mutationFn: ({admission_id, final_diagnosis}) => api.post('/beds/discharge', {
      admission_id,
      final_diagnosis: final_diagnosis || '',
      condition_at_discharge: 'Improved',
      auto_bill: true
    }),
    onSuccess: (response) => {
      const message = response.data.message || 'Patient discharged successfully'
      toast.success(message)
      qc.invalidateQueries(['patient', id])
      qc.invalidateQueries({ queryKey: ['beds'] })
      qc.invalidateQueries({ queryKey: ['bills'] })
      if (response.data.data?.bill) {
        toast.success(`💳 Bill ${response.data.data.bill.bill_no} created`)
      }
      setShowDischargeModal(false)
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Discharge failed'
      toast.error(message)
    },
  })

  // Mutation to handle patient updates
  const updateMut = useMutation({
    mutationFn: (body) => api.put(`/patients/${id}`, body).then(r => r.data),
    onSuccess: () => {
      toast.success('Patient details updated successfully!')
      qc.invalidateQueries(['patient', id])
      setShowEditModal(false)
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update patient details')
  })

  // ── Error Handling Display ──
  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  if (isError) return (
    <div className="text-center py-20 text-brand-red">
      <h2 className="text-xl font-bold mb-2">Error connecting to server</h2>
      <p>{error?.message || 'Unknown error occurred.'}</p>
      <p className="text-sm text-slate-400 mt-2">Please check if your backend server is running.</p>
    </div>
  )
  if (!patient) return <div className="text-center py-20 text-slate-400">Patient not found in database.</div>

  const p = patient
  const currentAdmission = p.admissions?.find(a => a.status === 'ADMITTED')

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <div className="avatar-lg bg-gradient-to-br from-cyan to-brand-purple">{p.first_name?.[0]}{p.last_name?.[0]}</div>
          <div>
            <h1 className="text-xl font-bold text-white">{p.first_name} {p.last_name}</h1>
            <div className="text-sm text-slate-400">{p.uhid} · {p.gender} · {fmt.age(p.dob)} · {p.blood_group ? BG_DISPLAY[p.blood_group] : 'BG Unknown'}</div>
            <div className="flex gap-1 mt-1 flex-wrap">
              {p.allergies?.map(a => <span key={a.id} className="badge badge-red text-xs">⚠️ {a.allergen}</span>)}
              {currentAdmission && <span className="badge badge-cyan">Admitted · {currentAdmission.bed?.ward} {currentAdmission.bed?.bed_no}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/emr/${p.id}`} className="btn-primary">📋 Open EMR</Link>
          <button onClick={() => setShowBarcodeModal(true)} className="btn">📊 View Barcode</button>
          <Link to="/billing" className="btn">💳 Bills</Link>
          <Link to="/appointments" className="btn">📅 Book Appointment</Link>
          {currentAdmission && <button onClick={() => setShowDischargeModal(true)} className="btn bg-brand-red hover:bg-brand-red/90">🚪 Discharge</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Personal Details */}
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-white">Personal Details</h3>
            <button 
              onClick={() => {
                setEditData({
                  phone: p.phone || '',
                  email: p.email || '',
                  address: p.address || '',
                  city: p.city || '',
                  aadhar_no: p.aadhar_no || '',
                  language: p.language || 'English',
                  religion: p.religion || '',
                  occupation: p.occupation || '',
                  marital_status: p.marital_status || ''
                })
                setShowEditModal(true)
              }}
              className="btn text-xs px-2 py-1 text-cyan border-cyan/30 hover:bg-cyan/10"
            >
              Edit
            </button>
          </div>
          <div className="space-y-2 text-sm">
            {[['Phone', p.phone],['Email', p.email],['Address', p.address],['City', p.city],['Aadhar No.', p.aadhar_no],['Language', p.language],['Religion', p.religion],['Occupation', p.occupation],['Marital Status', p.marital_status]].map(([label, val]) => val && (
              <div key={label} className="flex justify-between">
                <span className="text-slate-400">{label}</span>
                <span className="text-white text-right max-w-[60%]">{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Contacts */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-3">Emergency Contacts</h3>
          {(p.emergency_contacts || []).length === 0 ? <p className="text-xs text-slate-400">No emergency contacts</p> : p.emergency_contacts.map(c => (
            <div key={c.id} className="bg-navy-800 rounded-lg p-3 mb-2">
              <div className="font-medium text-white text-sm">{c.name} {c.is_primary && <span className="badge badge-cyan text-[10px] ml-1">Primary</span>}</div>
              <div className="text-xs text-slate-400">{c.relation} · {c.phone}</div>
            </div>
          ))}
        </div>

        {/* Insurance */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-3">Insurance</h3>
          {(p.insurance_details || []).filter(i => i.is_active).length === 0 ? <p className="text-xs text-slate-400">No active insurance</p> : p.insurance_details.filter(i => i.is_active).map(ins => (
            <div key={ins.id} className="bg-navy-800 rounded-lg p-3 mb-2">
              <div className="font-medium text-white text-sm">{ins.provider_name}</div>
              <div className="text-xs text-slate-400">Policy: {ins.policy_no}</div>
              {ins.tpa_name && <div className="text-xs text-slate-400">TPA: {ins.tpa_name}</div>}
              {ins.valid_to && <div className="text-xs text-slate-400">Valid till: {fmt.date(ins.valid_to)}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Admission History */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-default text-sm font-semibold text-white">Admission History</div>
        <table className="tbl">
          <thead><tr><th>Admission Date</th><th>Discharge</th><th>Ward/Bed</th><th>Diagnosis</th><th>Status</th></tr></thead>
          <tbody>
            {(p.admissions || []).map(a => (
              <tr key={a.id}>
                <td className="text-xs">{fmt.date(a.admission_date)}</td>
                <td className="text-xs text-slate-400">{a.discharge_date ? fmt.date(a.discharge_date) : '—'}</td>
                <td className="text-xs">{a.bed?.ward} · {a.bed?.bed_no}</td>
                <td className="text-xs">{a.provisional_diagnosis || a.final_diagnosis || '—'}</td>
                <td><Badge status={a.status} /></td>
              </tr>
            ))}
            {(!p.admissions || p.admissions.length === 0) && <tr><td colSpan={5} className="text-center py-6 text-slate-400">No admission history</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Barcode Modal */}
      {showBarcodeModal && (
        <BarcodeModal
          patientId={p.id}
          patientName={`${p.first_name} ${p.last_name}`}
          onClose={() => setShowBarcodeModal(false)}
        />
      )}

      {/* Discharge Modal */}
      <Modal open={showDischargeModal} onClose={() => setShowDischargeModal(false)} title="Discharge Patient" size="lg">
        <div className="space-y-4">
          <div className="bg-brand-red/10 border border-brand-red/30 rounded-lg p-3">
            <p className="text-sm text-brand-red">⚠️ This will discharge the patient and clear all current admission data (vitals, prescriptions, lab tests, allergies). This data will only be available in the History tab after discharge.</p>
          </div>
          
          <div>
            <label className="label">Final Diagnosis</label>
            <input 
              type="text" 
              className="input" 
              placeholder={currentAdmission?.provisional_diagnosis || 'e.g. Pneumonia'} 
              defaultValue={currentAdmission?.provisional_diagnosis || ''}
              id="final_diagnosis_input"
            />
          </div>

          <div>
            <label className="label">Condition at Discharge</label>
            <select className="select" id="condition_input" defaultValue="Improved">
              <option value="Improved">Improved</option>
              <option value="Stable">Stable</option>
              <option value="Stable but requires follow-up">Stable but requires follow-up</option>
              <option value="Against Medical Advice">Against Medical Advice (AMA)</option>
              <option value="Expired">Expired</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button 
              className="btn-primary flex-1" 
              disabled={dischargeMut.isPending}
              onClick={() => {
                const finalDiag = document.getElementById('final_diagnosis_input').value || currentAdmission?.provisional_diagnosis || '';
                dischargeMut.mutate({ admission_id: currentAdmission.id, final_diagnosis: finalDiag })
              }}
            >
              {dischargeMut.isPending ? 'Processing...' : '✅ Confirm Discharge'}
            </button>
            <button className="btn flex-1" onClick={() => setShowDischargeModal(false)}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Edit Personal Details Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Personal Details" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone Number</label>
              <input className="input" value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} />
            </div>
          </div>
          
          <div>
            <label className="label">Address</label>
            <input className="input" value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label">City</label>
              <input className="input" value={editData.city} onChange={e => setEditData({...editData, city: e.target.value})} />
            </div>
            <div>
              <label className="label">Aadhar No.</label>
              <input className="input" value={editData.aadhar_no} onChange={e => setEditData({...editData, aadhar_no: e.target.value})} />
            </div>
          </div>
          <div>
              <label className="label">State</label>
              <input className="input" value={editData.state} onChange={e => setEditData({...editData, state : e.target.value})} />
            </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Language</label>
              <input className="input" value={editData.language} onChange={e => setEditData({...editData, language: e.target.value})} />
            </div>
            
            <div>
              <label className="label">Marital Status</label>
              <select className="select" value={editData.marital_status} onChange={e => setEditData({...editData, marital_status: e.target.value})}>
                <option value="">Select</option>
                <option value="SINGLE">SINGLE</option>
                <option value="MARRIED">MARRIED</option>
                <option value="DIVORCED">DIVORCED</option>
                <option value="WIDOWED">WIDOWED</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-2 pt-3">
            <button 
              disabled={updateMut.isPending} 
              onClick={() => updateMut.mutate(editData)} 
              className="btn-primary flex-1"
            >
              {updateMut.isPending ? 'Saving...' : 'Save Changes'}
            </button>
            <button 
              onClick={() => setShowEditModal(false)} 
              className="btn flex-1"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

    </div>
  )
}