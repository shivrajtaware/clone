// src/pages/BedsPage.jsx
import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../utils/api'
import { getSocketUrl } from '../utils/runtimeConfig'
import Modal from '../components/common/Modal'
import PatientSearch from '../components/patients/PatientSearch'
import StatCard from '../components/common/StatCard'
import { Badge, Spinner } from '../components/common/StatCard'
import { fmt } from '../utils/helpers'

export default function BedsPage() {
  const [ward, setWard] = useState('')
  const [selectedBed, setSelectedBed] = useState(null)
  const [showAdmitModal, setShowAdmitModal] = useState(false)
  const [showDischargeModal, setShowDischargeModal] = useState(null)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const qc = useQueryClient()
    useEffect(() => {
      const socket = io(getSocketUrl(), { auth: { token: localStorage.getItem('token') } })
      socket.emit('join:beds')
      socket.on('beds:updated', () => {
        qc.invalidateQueries({ queryKey: ['beds'] })
        qc.invalidateQueries({ queryKey: ['bills'] })
        qc.invalidateQueries({ queryKey: ['billing-summary'] })
      })
      return () => socket.disconnect()
    }, [qc])

  const { data, isLoading } = useQuery({
    queryKey: ['beds', ward],
    queryFn: () => api.get('/beds', { params: ward ? { ward } : {} }).then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: wardsData } = useQuery({
    queryKey: ['wards'],
    queryFn: () => api.get('/beds/wards').then(r => r.data.data),
  })

  const { data: doctors } = useQuery({ queryKey: ['doctors'], queryFn: () => api.get('/staff', { params: { role: 'DOCTOR' } }).then(r => r.data.data) })

  const { register, handleSubmit, reset } = useForm()

  const admitMut = useMutation({
    mutationFn: (d) => api.post('/beds/admit', d),
    onSuccess: (data) => {
      // Admission successful
      toast.success('✅ Patient admitted successfully');
      qc.invalidateQueries(['beds']);
      setShowAdmitModal(false);
      setSelectedBed(null);
      setSelectedPatient(null);
      reset();
    },
    onError: (error) => {
      console.error('❌ Admission error:', error);
      const message = error.response?.data?.message || error.message || 'Admission failed';
      toast.error(`❌ ${message}`);
    },
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/beds/${id}/status`, { status }),
    onSuccess: () => { toast.success('Bed status updated'); qc.invalidateQueries(['beds']) },
  })

  const dischargeMut = useMutation({
    mutationFn: (admission_id) => api.post('/beds/discharge', { 
      admission_id, 
      condition_at_discharge: 'Improved',
      auto_bill: true 
    }),
    onSuccess: (response) => {
      const message = response.data.message || 'Patient discharged successfully';
      toast.success(message);
      qc.invalidateQueries({ queryKey: ['beds'] });
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['billing-summary'] });
      if (response.data.data?.bill) {
        toast.success(`💳 Bill ${response.data.data.bill.bill_no} created for ₹${(response.data.data.bill.total_amt || 0).toFixed(2)}`);
      }
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Discharge failed';
      toast.error(message);
    },
  })

  const beds = data?.data || []
  const stats = data?.stats || {}
  const wards = [...new Set(beds.map(b => b.ward))]

  const filteredBeds = ward ? beds.filter(b => b.ward === ward) : beds

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Bed & Ward Management</h1><p className="page-sub">Real-time bed status across all wards</p></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon="✅" value={stats.AVAILABLE || 0} label="Available" color="green" />
        <StatCard icon="🔴" value={stats.OCCUPIED || 0} label="Occupied" color="red" />
        <StatCard icon="🧹" value={stats.CLEANING || 0} label="Cleaning" color="amber" />
        <StatCard icon="🔵" value={stats.RESERVED || 0} label="Reserved" color="cyan" />
        <StatCard icon="🔧" value={stats.MAINTENANCE || 0} label="Maintenance" color="purple" />
      </div>

      {/* Ward Filter */}
      <div className="flex gap-2 flex-wrap">
        <button className={`tab ${!ward ? 'active' : ''}`} onClick={() => setWard('')}>All Wards</button>
        {wards.map(w => <button key={w} className={`tab ${ward===w ? 'active' : ''}`} onClick={() => setWard(w)}>{w}</button>)}
      </div>

      {isLoading ? <div className="flex justify-center py-20"><Spinner size="lg" /></div> : (
        <>
          {/* Bed Grid */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">{ward || 'All Wards'} — {filteredBeds.length} beds</h3>
              <div className="flex gap-3 text-xs">
                {[['bg-brand-green/20 border-brand-green/30','Available'],['bg-brand-red/20 border-brand-red/30','Occupied'],['bg-brand-amber/20 border-brand-amber/30','Cleaning'],['bg-brand-blue/20 border-brand-blue/30','Reserved']].map(([cls, label]) => (
                  <div key={label} className="flex items-center gap-1.5"><div className={`w-3 h-3 rounded border ${cls}`}></div><span className="text-slate-400">{label}</span></div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
              {filteredBeds.map(b => {
                const occupant = b.admissions?.[0]
                return (
                  <div
                    key={b.id}
                    className={`bed-cell ${
                      b.status === 'AVAILABLE' ? 'bed-available' :
                      b.status === 'OCCUPIED'  ? 'bed-occupied' :
                      b.status === 'CLEANING'  ? 'bed-cleaning' :
                      b.status === 'RESERVED'  ? 'bed-reserved' : 'bed-maintenance'
                    }`}
                    title={occupant ? `${occupant.patient?.first_name} ${occupant.patient?.last_name}` : b.status}
                    onClick={() => {
                      if (b.status === 'AVAILABLE') { setSelectedBed(b); setSelectedPatient(null); setShowAdmitModal(true) }
                      else if (b.status === 'CLEANING') statusMut.mutate({ id: b.id, status: 'AVAILABLE' })
                    }}
                  >
                    <div>{b.bed_no}</div>
                    <div className="text-[8px] opacity-70 truncate w-full text-center px-0.5">{b.status === 'OCCUPIED' && occupant ? occupant.patient?.last_name?.substring(0,6) : b.status.substring(0,4)}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Occupied beds list */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-default"><h3 className="text-sm font-semibold text-white">Admitted Patients</h3></div>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Bed</th><th>Patient</th><th>Doctor</th><th>Diagnosis</th><th>Admitted</th><th>Days</th><th>Actions</th></tr></thead>
                <tbody>
                  {beds.filter(b => b.status === 'OCCUPIED' && b.admissions?.[0]).map(b => {
                    const adm = b.admissions[0]
                    const days = Math.ceil((new Date() - new Date(adm.admission_date)) / 86400000)
                    return (
                      <tr key={b.id}>
                        <td><span className="badge badge-cyan">{b.ward} · {b.bed_no}</span></td>
                        <td>
                          <div className="text-xs font-medium text-white">{adm.patient?.first_name} {adm.patient?.last_name}</div>
                          <div className="text-[10px] text-slate-400">{adm.patient?.uhid}</div>
                        </td>
                        <td className="text-xs text-slate-400">—</td>
                        <td className="text-xs">{adm.provisional_diagnosis || '—'}</td>
                        <td className="text-xs text-slate-400">{fmt.date(adm.admission_date)}</td>
                        <td><span className={`badge ${days > 7 ? 'badge-amber' : 'badge-green'}`}>Day {days}</span></td>
                        <td>
                          <button 
                            className="btn text-xs px-2 py-1" 
                            onClick={() => setShowDischargeModal(adm)}
                          >
                            Discharge
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal open={showAdmitModal} onClose={() => { setShowAdmitModal(false); setSelectedBed(null); setSelectedPatient(null) }} title="Admit Patient" size="lg">
        <form onSubmit={(e) => {
          e.preventDefault();
          
          // Collect all form values manually
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData);
          
          // Validation
          if (!selectedPatient?.id) {
            toast.error('❌ Please select a patient');
            return;
          }
          if (!data.admitting_doctor_id) {
            toast.error('❌ Please select an admitting doctor');
            return;
          }
          if (!selectedBed?.id && !data.bed_id) {
            toast.error('❌ Please select a bed or auto-assign one');
            return;
          }

          // Prepare payload
          const payload = {
            patient_id: selectedPatient.id,
            bed_id: selectedBed?.id || data.bed_id,
            admitting_doctor_id: data.admitting_doctor_id,
            admission_type: data.admission_type || 'ELECTIVE',
            provisional_diagnosis: data.provisional_diagnosis || '',
            estimated_los: data.estimated_los ? parseInt(data.estimated_los) : null,
            is_mlc: data.is_mlc === 'true',
          };
          
          // Admitting patient with payload
          admitMut.mutate(payload);
        }} className="space-y-3">
          <div><label className="label">Patient Search *</label><PatientSearch value={selectedPatient} onChange={setSelectedPatient} placeholder="Enter patient name or UHID..." /></div>
          {!selectedBed && <div>
            <label className="label">Select Bed *</label>
            <select className="select" name="bed_id">
              <option value="">Auto-assign best available</option>
              {beds.filter(b => b.status === 'AVAILABLE').map(b => <option key={b.id} value={b.id}>{b.ward} — {b.bed_no} ({b.bed_type})</option>)}
            </select>
          </div>}
          {selectedBed && <div className="alert-cyan text-xs">🛏️ Selected Bed: <strong>{selectedBed.ward} — {selectedBed.bed_no}</strong> ({selectedBed.bed_type})</div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Admitting Doctor *</label>
              <select className="select" name="admitting_doctor_id" required>
                <option value="">Select doctor</option>
                {(doctors||[]).map(d => <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</option>)}
              </select>
            </div>
            <div><label className="label">Admission Type</label>
              <select className="select" name="admission_type">
                <option value="">Select type</option>
                {['ELECTIVE','EMERGENCY','TRANSFER'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Provisional Diagnosis</label><input className="input" name="provisional_diagnosis" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Est. Length of Stay (days)</label><input type="number" className="input" name="estimated_los" /></div>
            <div><label className="label">Is MLC Case?</label>
              <select className="select" name="is_mlc">
                <option value="false">No</option><option value="true">Yes — MLC</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={admitMut.isPending} className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed">{admitMut.isPending ? '⏳ Admitting Patient...' : '🛏️ Confirm Admission'}</button>
            <button type="button" className="btn flex-1" onClick={() => { setShowAdmitModal(false); setSelectedBed(null); setSelectedPatient(null) }}>Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Discharge Modal */}
      <Modal open={!!showDischargeModal} onClose={() => setShowDischargeModal(null)} title="Discharge Patient" size="lg">
        {showDischargeModal && (
          <div className="space-y-4">
            {/* Patient Info */}
            <div className="bg-navy-800 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-400">Patient</div>
                  <div className="text-sm font-semibold text-white">{showDischargeModal.patient?.first_name} {showDischargeModal.patient?.last_name}</div>
                  <div className="text-xs text-slate-400">{showDischargeModal.patient?.uhid}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Bed Location</div>
                  <div className="text-sm font-semibold text-white">{showDischargeModal.bed?.ward} — {showDischargeModal.bed?.bed_no}</div>
                  <div className="text-xs text-slate-400">Admitted: {fmt.date(showDischargeModal.admission_date)}</div>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="alert-amber text-xs">
              💳 <strong>Auto-billing enabled:</strong> A bill will be automatically generated with all service charges from this admission.
            </div>

            {/* Discharge Info Summary */}
            <div className="bg-navy-800 rounded-xl p-4 space-y-2 text-sm">
              <div><span className="text-slate-400">Diagnosis:</span> <span className="text-white font-medium">{showDischargeModal.provisional_diagnosis || 'Not recorded'}</span></div>
              <div><span className="text-slate-400">Admission Date:</span> <span className="text-white font-medium">{fmt.date(showDischargeModal.admission_date)}</span></div>
              <div><span className="text-slate-400">Length of Stay:</span> <span className="text-white font-medium">{Math.ceil((new Date() - new Date(showDischargeModal.admission_date)) / 86400000)} days</span></div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <button 
                onClick={() => {
                  dischargeMut.mutate(showDischargeModal.id);
                  setShowDischargeModal(null);
                }}
                disabled={dischargeMut.isPending}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                {dischargeMut.isPending ? '⏳ Processing...' : '✅ Confirm Discharge & Generate Bill'}
              </button>
              <button 
                onClick={() => setShowDischargeModal(null)}
                className="btn flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
