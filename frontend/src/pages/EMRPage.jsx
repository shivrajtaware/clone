// src/pages/EMRPage.jsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../utils/api'
import Modal from '../components/common/Modal'
import { Badge, Spinner } from '../components/common/StatCard'
import { fmt, BG_DISPLAY } from '../utils/helpers'
import { DRUG_ROUTES, inferredLooseUnit, inferredPackUnit, packSize } from '../utils/drugForms'

const TABS = ['vitals','notes','prescriptions','lab','allergies','history']
const emptyLabOrder = { tests: [], is_stat: false, priority: 'ROUTINE', clinical_indication: '', specimen_notes: '' }
const emptyRxItem = { drug_name: '', generic_name: '', item_id: '', strength: '', form: '', dose: '', frequency: 'BD', route: 'Oral', duration: '', quantity: 1, quantity_unit: 'LOOSE', issue_mode: 'AUTO', pack_quantity: 1, instructions: '' }
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
const issueQtyLabel = (item) => {
  if (!item.quantity) return '—'
  const label = item.quantity_unit === 'PACK' ? inferredPackUnit(item) : inferredLooseUnit(item)
  return `${item.quantity} ${label}`
}
const effectiveQty = (item) => {
  if (item.issue_mode === 'PACK') return Math.max(1, Number.parseInt(item.pack_quantity || 1, 10))
  return calculatedQty(item)
}
const stripClientFields = (item) => {
  const { issue_mode, pack_quantity, unit, pack_unit, units_per_pack, ...payload } = item
  return { ...payload, quantity: effectiveQty(item), quantity_unit: issue_mode === 'PACK' ? 'PACK' : 'LOOSE' }
}

export default function EMRPage() {
  const { patientId } = useParams()
  const [tab, setTab] = useState('vitals')
  const [showVitalsModal, setShowVitalsModal] = useState(false)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [showRxModal, setShowRxModal] = useState(false)
  const [showAllergyModal, setShowAllergyModal] = useState(false)
  const [showLabModal, setShowLabModal] = useState(false)
  const [showDischargeModal, setShowDischargeModal] = useState(false)
  const [encounterType, setEncounterType] = useState('OPD')
  const [rxItems, setRxItems] = useState([emptyRxItem])
  const [labOrder, setLabOrder] = useState(emptyLabOrder)
  const [dischargeData, setDischargeData] = useState({ final_diagnosis: '', condition_at_discharge: '', follow_up_date: '', follow_up_instructions: '', diet_advice: '', activity_advice: '' })
  const qc = useQueryClient()

  const { data: patient } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => api.get(`/patients/${patientId}`).then(r => r.data.data),
    enabled: !!patientId,
  })

  const { data: emr, isLoading } = useQuery({
    queryKey: ['emr', patientId],
    queryFn: () => api.get(`/emr/${patientId}`).then(r => r.data.data),
    enabled: !!patientId,
  })

  const { register: regV, handleSubmit: hsV, reset: resetV } = useForm()
  const { register: regN, handleSubmit: hsN, reset: resetN } = useForm()
  const { register: regA, handleSubmit: hsA, reset: resetA } = useForm()

  const vitalsMut = useMutation({
    mutationFn: (d) => api.post(`/emr/${patientId}/vitals`, { ...d, encounter_type: encounterType }).then(r => r.data),
    onSuccess: (r) => {
      toast.success('Vitals recorded')
      if (r.alerts?.length) r.alerts.forEach(a => toast(a.message, { icon: '🚨', style: { background: '#1a0a0a', borderColor: '#ff4757' } }))
      qc.invalidateQueries({ queryKey: ['emr', patientId] })
      setShowVitalsModal(false)
      resetV()
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to record vitals'),
  })

  const noteMut = useMutation({
    mutationFn: (d) => api.post(`/emr/${patientId}/notes`, { ...d, encounter_type: encounterType }),
    onSuccess: () => { toast.success('Note saved'); qc.invalidateQueries({ queryKey: ['emr', patientId] }); setShowNoteModal(false); resetN() },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save note'),
  })

  const rxMut = useMutation({
    mutationFn: (d) => api.post(`/emr/${patientId}/prescriptions`, { ...d, encounter_type: encounterType }),
    onSuccess: () => { 
      toast.success('Prescription saved')
      qc.invalidateQueries({ queryKey: ['emr', patientId] })
      qc.invalidateQueries({ queryKey: ['pharmacy-dashboard'] })
      qc.invalidateQueries({ queryKey: ['pharmacy-inventory'] })
      qc.invalidateQueries({ queryKey: ['pharmacy-prescriptions'] })
      setShowRxModal(false)
      setRxItems([emptyRxItem])
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save prescription'),
  })

  const labOrderMut = useMutation({
    mutationFn: (d) => api.post(`/emr/${patientId}/external-lab-tests`, d),
    onSuccess: (r) => {
      toast.success('External lab tests added to EMR')
      qc.invalidateQueries({ queryKey: ['emr', patientId] })
      setShowLabModal(false)
      setLabOrder(emptyLabOrder)
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add lab tests'),
  })

  const allergyMut = useMutation({
    mutationFn: (d) => api.post(`/emr/${patientId}/allergies`, d),
    onSuccess: () => { toast.success('Allergy added'); qc.invalidateQueries({ queryKey: ['emr', patientId] }); setShowAllergyModal(false); resetA() },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add allergy'),
  })

  const dischargeMut = useMutation({
    mutationFn: (data) => {
      if (!data.admission_id) throw new Error('No active admission');
      return api.post('/beds/discharge', data);
    },
    onSuccess: (response) => {
      const message = response.data?.message || 'Patient discharged successfully';
      toast.success(message);
      qc.invalidateQueries({ queryKey: ['emr', patientId] });
      qc.invalidateQueries({ queryKey: ['patient', patientId] });
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['admissions'] });
      
      if (response.data?.data?.bill) {
        const bill = response.data.data.bill;
        const total = typeof bill.total_amt === 'string' ? parseFloat(bill.total_amt) : bill.total_amt;
        setTimeout(() => {
          toast.success(`💳 Bill ${bill.bill_no} created | Amount: ₹${total.toFixed(2)}`);
        }, 500);
      }
      
      setShowDischargeModal(false);
      setDischargeData({ final_diagnosis: '', condition_at_discharge: '', follow_up_date: '', follow_up_instructions: '', diet_advice: '', activity_advice: '' });
    },
    onError: (error) => {
      const message = error.response?.data?.message || error.message || 'Discharge failed';
      console.error('Discharge mutation error:', error);
      toast.error(message);
    },
  })

  if (!patientId) return <div className="p-8 text-center text-slate-400">Select a patient to view EMR. <Link to="/patients" className="text-cyan">Browse Patients →</Link></div>
  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  const p = patient
  const vitals = emr?.vitals || []
  const notes  = emr?.notes  || []
  const rxs    = emr?.prescriptions || []
  const labOrders = emr?.labOrders || []
  const allergies = emr?.allergies || []
  const admissions = emr?.admissions || []
  
  const currentAdmission = admissions.find(a => a.status === 'ADMITTED')
  const latestVitals = vitals[0] || null
  const updateRxItem = (idx, updates) => {
    setRxItems(prev => prev.map((row, i) => {
      if (i !== idx) return row
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

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Patient Banner */}
      {p && (
        <div className="card flex flex-col md:flex-row gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="avatar-lg bg-gradient-to-br from-cyan to-brand-purple text-base">{p.first_name?.[0]}{p.last_name?.[0]}</div>
            <div>
              <div className="text-lg font-bold text-white">{p.first_name} {p.last_name}</div>
              <div className="text-xs text-slate-400">{p.uhid} · {p.gender} · {fmt.age(p.dob)} · {p.blood_group ? BG_DISPLAY[p.blood_group] : 'BG Unknown'}</div>
              <div className="flex gap-1 mt-1 flex-wrap">
                {(emr?.allergies || []).map(a => <span key={a.id} className="badge badge-red">⚠️ {a.allergen}</span>)}
                {admissions[0] && <span className="badge badge-cyan">Admitted · {admissions[0].bed?.ward}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn text-xs" onClick={() => setShowVitalsModal(true)}>📊 Record Vitals</button>
            <button className="btn text-xs" onClick={() => setShowNoteModal(true)}>📝 Add SOAP Note</button>
            <button className="btn text-xs" onClick={() => setShowRxModal(true)}>💊 Prescribe</button>
            <button className="btn text-xs" onClick={() => setShowLabModal(true)}>🧪 Add Lab Tests</button>
            {currentAdmission && <button className="btn text-xs bg-brand-red hover:bg-brand-red/90" onClick={() => setShowDischargeModal(true)} disabled={dischargeMut.isPending}>🚪 Discharge Patient</button>}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 rounded-lg border border-default bg-navy-800 p-3">
        <span className="text-xs font-semibold text-slate-300">Record under</span>
        <select className="select max-w-40" value={encounterType} onChange={e => setEncounterType(e.target.value)}>
          <option value="OPD">OPD visit</option>
          <option value="IPD">IPD admission</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="tabs flex-wrap">
        {TABS.map(t => <div key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)}>{t === 'lab' ? 'External Lab Tests' : t.charAt(0).toUpperCase()+t.slice(1)}</div>)}
      </div>

      {/* VITALS TAB */}
      {tab === 'vitals' && (
        <div className="space-y-4">
          {true ? (
            <>
              {latestVitals && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Latest Vitals — {fmt.datetime(latestVitals.recorded_at)}</h3>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                    {[
                      { label:'SpO2', val: latestVitals.spo2, unit:'%', crit: latestVitals.spo2 < 90, warn: latestVitals.spo2 < 95 },
                      { label:'Blood Pressure', val: latestVitals.bp_systolic ? `${latestVitals.bp_systolic}/${latestVitals.bp_diastolic}` : null, unit:'mmHg', warn: latestVitals.bp_systolic > 140 },
                      { label:'Pulse', val: latestVitals.pulse, unit:'bpm', crit: latestVitals.pulse > 130 || latestVitals.pulse < 40 },
                      { label:'Temperature', val: latestVitals.temperature, unit:'°C', warn: latestVitals.temperature > 38.5 },
                      { label:'Resp. Rate', val: latestVitals.respiratory_rate, unit:'/min', warn: latestVitals.respiratory_rate > 24 },
                      { label:'Weight', val: latestVitals.weight, unit:'kg' },
                    ].map(v => (
                      <div key={v.label} className="vital-box">
                        <div className={`vital-val ${v.crit ? 'vital-critical' : v.warn ? 'vital-warn' : 'vital-ok'}`}>{v.val ?? '—'}</div>
                        <div className="vital-unit">{v.unit}</div>
                        <div className="vital-name">{v.label}</div>
                      </div>
                    ))}
                  </div>
                  {latestVitals.bmi && <div className="mt-2 text-xs text-slate-400">BMI: <span className="text-white font-medium">{latestVitals.bmi}</span> kg/m²</div>}
                </div>
              )}
              <div className="card">
                <h3 className="text-sm font-semibold text-white mb-3">OPD / IPD Vitals History</h3>
                <table className="tbl">
                  <thead><tr><th>Date/Time</th><th>BP</th><th>HR</th><th>SpO2</th><th>Temp</th><th>RR</th><th>Weight</th><th>Recorded By</th></tr></thead>
                  <tbody>
                    {vitals.map(v => (
                      <tr key={v.id}>
                        <td className="text-xs"><Badge status={v.encounter_type || 'OPD'} /> {fmt.datetime(v.recorded_at)}</td>
                        <td className={`text-xs ${v.bp_systolic > 140 ? 'text-brand-amber' : ''}`}>{v.bp_systolic ? `${v.bp_systolic}/${v.bp_diastolic}` : '—'}</td>
                        <td className="text-xs">{v.pulse ?? '—'}</td>
                        <td className={`text-xs font-medium ${v.spo2 < 90 ? 'text-brand-red' : v.spo2 < 95 ? 'text-brand-amber' : 'text-brand-green'}`}>{v.spo2 ? `${v.spo2}%` : '—'}</td>
                        <td className="text-xs">{v.temperature ? `${v.temperature}°C` : '—'}</td>
                        <td className="text-xs">{v.respiratory_rate ?? '—'}</td>
                        <td className="text-xs">{v.weight ? `${v.weight} kg` : '—'}</td>
                        <td className="text-xs text-slate-400">{v.recorded_by_user?.first_name} {v.recorded_by_user?.last_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="card text-center py-12 text-slate-400">
              <p className="text-lg mb-2">📋 Patient not currently admitted</p>
              <p className="text-sm">Current vitals only visible during active admission. View historical vitals in History tab.</p>
            </div>
          )}
        </div>
      )}

      {/* NOTES TAB */}
      {tab === 'notes' && (
        <div className="space-y-3">
          <button className="btn-primary text-sm" onClick={() => setShowNoteModal(true)}>+ Add SOAP Note</button>
          {notes.length === 0 ? <div className="text-center py-8 text-slate-400">No consultation notes yet.</div> : notes.map(n => (
            <div key={n.id} className="card">
              <div className="flex justify-between mb-3">
                <div>
                  <span className="text-sm font-semibold text-white">{n.doctor?.role === 'DOCTOR' ? 'Dr. ' : ''}{n.doctor?.first_name} {n.doctor?.last_name}</span>
                  <span className="text-xs text-slate-400 ml-2">{n.doctor?.designation}</span>
                </div>
                <span className="text-xs text-slate-400"><Badge status={n.encounter_type || 'OPD'} /> {fmt.datetime(n.visit_date)}</span>
              </div>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                {[['S — Subjective', n.subjective], ['O — Objective', n.objective], ['A — Assessment', n.assessment], ['P — Plan', n.plan]].map(([label, val]) => val && (
                  <div key={label} className="bg-navy-800 rounded-lg p-3">
                    <div className="text-xs font-semibold text-cyan mb-1">{label}</div>
                    <div className="text-xs text-slate-300">{val}</div>
                  </div>
                ))}
              </div>
              {n.icd10_codes?.length > 0 && <div className="mt-3 flex gap-1 flex-wrap">{n.icd10_codes.map(c => <span key={c} className="badge badge-blue">{c}</span>)}</div>}
            </div>
          ))}
        </div>
      )}

      {/* PRESCRIPTIONS TAB */}
      {tab === 'prescriptions' && (
        <div className="space-y-3">
          {true ? (
            <>
              <button className="btn-primary text-sm" onClick={() => setShowRxModal(true)}>+ New Prescription</button>
              {rxs.length === 0 ? <div className="text-center py-8 text-slate-400">No prescriptions yet.</div> : rxs.map(rx => (
                <div key={rx.id} className="card">
                  <div className="flex justify-between mb-3">
                    <span className="text-sm font-semibold text-white">{rx.doctor?.role === 'DOCTOR' ? 'Dr. ' : ''}{rx.doctor?.first_name} {rx.doctor?.last_name}</span>
                    <span className="text-xs text-slate-400"><Badge status={rx.encounter_type || 'OPD'} /> {fmt.date(rx.prescribed_at)}</span>
                  </div>
                  <table className="tbl">
                    <thead><tr><th>Drug</th><th>Dose</th><th>Frequency</th><th>Route</th><th>Duration</th><th>Qty</th><th>Instructions</th></tr></thead>
                    <tbody>
                      {rx.items.map(i => (
                        <tr key={i.id}>
                          <td className="font-medium text-white text-xs">{i.drug_name}{i.strength ? ` ${i.strength}` : ''}</td>
                          <td className="text-xs">{i.dose}</td>
                          <td className="text-xs">{i.frequency}</td>
                          <td><span className={`badge ${i.route === 'IV' ? 'badge-red' : i.route === 'SC' ? 'badge-amber' : 'badge-green'}`}>{i.route}</span></td>
                          <td className="text-xs">{i.duration}</td>
                          <td className="text-xs">{issueQtyLabel(i)}</td>
                          <td className="text-xs text-slate-400">{i.instructions || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </>
          ) : (
            <div className="card text-center py-12 text-slate-400">
              <p className="text-lg mb-2">💊 Patient not currently admitted</p>
              <p className="text-sm">Current prescriptions only visible during active admission. View historical prescriptions in History tab.</p>
            </div>
          )}
        </div>
      )}

      {/* LAB TAB */}
      {tab === 'lab' && (
        <div className="card">
          <div className="flex justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Tests advised for outside laboratory</h3>
            <button className="btn text-xs" onClick={() => setShowLabModal(true)}>+ Add Lab Tests</button>
          </div>
          {labOrders.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No external lab tests recorded.</div>
          ) : (
            <table className="tbl">
              <thead><tr><th>Reference</th><th>Tests</th><th>Priority</th><th>Location</th><th>Date</th></tr></thead>
              <tbody>
                {labOrders.map(o => (
                  <tr key={o.id}>
                    <td className="font-mono text-xs text-cyan">{o.order_no}</td>
                    <td className="text-xs">{o.items.map(i => i.test_name).join(', ')}</td>
                    <td>{o.is_stat ? <span className="badge badge-red">STAT</span> : <span className="badge badge-gray">Routine</span>}</td>
                    <td><span className="badge badge-gray">Outside hospital</span></td>
                    <td className="text-xs text-slate-400">{fmt.date(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ALLERGIES TAB */}
      {tab === 'allergies' && (
        <div className="space-y-3">
          {currentAdmission && <button className="btn-primary text-sm" onClick={() => setShowAllergyModal(true)}>+ Add Allergy</button>}
          {allergies.length === 0 ? <div className="text-center py-8 text-slate-400">{currentAdmission ? 'No allergies recorded.' : 'Patient not currently admitted'}</div> : (
            <div className="card">
              <table className="tbl">
                <thead><tr><th>Allergen</th><th>Type</th><th>Severity</th><th>Reaction</th><th>Noted On</th></tr></thead>
                <tbody>
                  {allergies.map(a => (
                    <tr key={a.id}>
                      <td className="font-medium text-brand-red text-xs">⚠️ {a.allergen}</td>
                      <td><Badge status={a.type} /></td>
                      <td><span className={`badge ${a.severity === 'ANAPHYLAXIS' ? 'badge-red' : a.severity === 'SEVERE' ? 'badge-red' : a.severity === 'MODERATE' ? 'badge-amber' : 'badge-green'}`}>{a.severity}</span></td>
                      <td className="text-xs">{a.reaction || '—'}</td>
                      <td className="text-xs text-slate-400">{fmt.date(a.noted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Admission History</h3>
          {admissions.length === 0 ? <div className="text-center py-8 text-slate-400">No admission history.</div> : (
            <div className="timeline space-y-3">
              {admissions.map(a => (
                <div key={a.id} className="tl-item pl-4 relative">
                  <div className="tl-dot" style={{ background: a.status === 'ADMITTED' ? '#00d4e0' : a.status === 'DISCHARGED' ? '#10d97e' : '#888' }}></div>
                  <div className="text-xs text-slate-400">{fmt.date(a.admission_date)}{a.discharge_date ? ` — ${fmt.date(a.discharge_date)}` : ' (Current)'}</div>
                  <div className="text-sm text-white mt-0.5">{a.provisional_diagnosis || a.final_diagnosis || 'Admission'}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{a.bed?.ward} · {a.bed?.bed_no} · <Badge status={a.status} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      <Modal open={showVitalsModal} onClose={() => setShowVitalsModal(false)} title="Record Vitals" size="lg">
        <form onSubmit={hsV(d => vitalsMut.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[['temperature','Temperature (°C)','37.0'],['pulse','Pulse (bpm)','72'],['bp_systolic','BP Systolic','120'],['bp_diastolic','BP Diastolic','80'],['spo2','SpO2 (%)','98'],['respiratory_rate','Resp. Rate (/min)','16'],['weight','Weight (kg)','70'],['height','Height (cm)','170'],['blood_glucose','Blood Glucose (mg/dL)','100']].map(([name, label, placeholder]) => (
              <div key={name}><label className="label">{label}</label><input type="number" step="0.1" className="input" placeholder={placeholder} {...regV(name)} /></div>
            ))}
          </div>
          <div><label className="label">GCS Score</label><input type="number" min="3" max="15" className="input" {...regV('gcs')} /></div>
          <div><label className="label">Notes</label><textarea className="textarea h-16" {...regV('notes')} /></div>
          <div className="flex gap-2"><button type="submit" disabled={vitalsMut.isPending} className="btn-primary flex-1">{vitalsMut.isPending ? 'Saving...' : '✅ Save Vitals'}</button><button type="button" className="btn flex-1" onClick={() => setShowVitalsModal(false)}>Cancel</button></div>
        </form>
      </Modal>

      <Modal open={showNoteModal} onClose={() => setShowNoteModal(false)} title="SOAP Consultation Note" size="lg">
        <form onSubmit={hsN(d => noteMut.mutate(d))} className="space-y-3">
          <div><label className="label">S — Subjective (Patient's complaints)</label><textarea className="textarea h-20" placeholder="Chief complaint, history of present illness..." {...regN('subjective')} /></div>
          <div><label className="label">O — Objective (Examination findings)</label><textarea className="textarea h-20" placeholder="Physical examination, vitals, investigations..." {...regN('objective')} /></div>
          <div><label className="label">A — Assessment (Diagnosis)</label><textarea className="textarea h-16" placeholder="Diagnosis, differential diagnosis..." {...regN('assessment')} /></div>
          <div><label className="label">P — Plan (Treatment)</label><textarea className="textarea h-20" placeholder="Medications, procedures, referrals, follow-up..." {...regN('plan')} /></div>
          <div><label className="label">ICD-10 Codes (comma-separated)</label><input className="input" placeholder="J18.9, I10, E11.9" {...regN('icd10_codes', { setValueAs: v => v ? v.split(',').map(s => s.trim()) : [] })} /></div>
          <div className="flex gap-2"><button type="submit" disabled={noteMut.isPending} className="btn-primary flex-1">{noteMut.isPending ? 'Saving...' : '✅ Save Note'}</button><button type="button" className="btn flex-1" onClick={() => setShowNoteModal(false)}>Cancel</button></div>
        </form>
      </Modal>

      <Modal open={showRxModal} onClose={() => setShowRxModal(false)} title="New Prescription" size="xl">
        <div className="space-y-3">
          {rxItems.map((item, idx) => (
            <div key={idx} className="rounded-lg border border-default bg-navy-800 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-white">Medicine {idx + 1}</div>
                  <div className="text-[11px] text-slate-400">Choose auto dose quantity or direct container issue.</div>
                </div>
                {rxItems.length > 1 && <button type="button" className="btn text-xs text-brand-red px-2 py-1" onClick={() => setRxItems(prev => prev.filter((_,i) => i!==idx))}>Remove</button>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                <div className="md:col-span-7">
                  <label className="label">Drug Name *</label>
                  <MedicineSuggestInput
                    item={item}
                    onChange={(updates) => updateRxItem(idx, updates)}
                  />
                </div>
                <div className="md:col-span-5"><label className="label">Strength</label><input className="input" placeholder="e.g. 500mg" value={item.strength||''} onChange={e => setRxItems(prev => prev.map((r,i) => i===idx ? {...r, strength: e.target.value} : r))} /></div>
                <div className="md:col-span-3"><label className="label">Dose</label><input className="input" placeholder="e.g. 1 tablet / 5 ml / 1 vial" value={item.dose} onChange={e => updateRxItem(idx, { dose: e.target.value })} /></div>
                <div className="md:col-span-3"><label className="label">Frequency</label>
                  <select className="select" value={item.frequency} onChange={e => updateRxItem(idx, { frequency: e.target.value })}>
                    {['OD','BD','TDS','QID','SOS','Nocte','Stat'].map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div className="md:col-span-3"><label className="label">Route</label>
                  <select className="select" value={item.route} onChange={e => setRxItems(prev => prev.map((r,i) => i===idx ? {...r, route: e.target.value} : r))}>
                    {DRUG_ROUTES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="md:col-span-3"><label className="label">Duration</label><input className="input" placeholder="e.g. 5 days" value={item.duration} onChange={e => updateRxItem(idx, { duration: e.target.value })} /></div>
                <div className="md:col-span-4">
                  <label className="label">Issue Option</label>
                  <select className="select" value={item.issue_mode || 'AUTO'} onChange={e => updateRxItem(idx, { issue_mode: e.target.value })}>
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
                      <input type="number" min="1" className="input" value={item.pack_quantity || 1} onChange={e => updateRxItem(idx, { pack_quantity: e.target.value })} />
                      <div className="mt-1 text-[11px] text-cyan">
                        {packSize(item) > 1 ? `${Number.parseInt(item.pack_quantity || 1, 10) * packSize(item)} ${inferredLooseUnit(item)} total` : 'Total units will be resolved in pharmacy'}
                      </div>
                    </>
                  ) : (
                    <input className="input" placeholder="Auto" value={effectiveQty(item)} readOnly />
                  )}
                </div>
                <div className="md:col-span-4"><label className="label">Instructions</label><input className="input" placeholder="e.g. After food" value={item.instructions||''} onChange={e => setRxItems(prev => prev.map((r,i) => i===idx ? {...r, instructions: e.target.value} : r))} /></div>
              </div>
              {item.item_id && <div className="mt-2 text-[11px] text-cyan">Linked to pharmacy stock: {item.generic_name || item.drug_name}{item.form ? ` | ${item.form}` : ''}</div>}
            </div>
          ))}
          <button type="button" className="btn text-sm w-full" onClick={() => setRxItems(prev => [...prev, { ...emptyRxItem }])}>+ Add Medicine</button>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={rxMut.isPending} onClick={() => rxMut.mutate({ items: rxItems.map(stripClientFields) })}>{rxMut.isPending ? 'Saving...' : 'Save Prescription'}</button>
            <button className="btn flex-1" onClick={() => setShowRxModal(false)}>Cancel</button>
          </div>
        </div>
      </Modal>

      <Modal open={showAllergyModal} onClose={() => setShowAllergyModal(false)} title="Add Allergy">
        <form onSubmit={hsA(d => allergyMut.mutate(d))} className="space-y-3">
          <div><label className="label">Allergen *</label><input className="input" placeholder="e.g. Penicillin, Peanuts" {...regA('allergen', { required: true })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Type *</label><select className="select" {...regA('type', { required: true })}>{['DRUG','FOOD','ENVIRONMENTAL','OTHER'].map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label className="label">Severity *</label><select className="select" {...regA('severity', { required: true })}>{['MILD','MODERATE','SEVERE','ANAPHYLAXIS'].map(s => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div><label className="label">Reaction Details</label><input className="input" placeholder="e.g. Skin rash, anaphylaxis" {...regA('reaction')} /></div>
          <div className="flex gap-2"><button type="submit" disabled={allergyMut.isPending} className="btn-primary flex-1">Save</button><button type="button" className="btn flex-1" onClick={() => setShowAllergyModal(false)}>Cancel</button></div>
        </form>
      </Modal>

      <Modal open={showLabModal} onClose={() => setShowLabModal(false)} title="Add External Lab Tests" size="lg">
        <div className="space-y-3">
          <div>
            <label className="label">Test Type *</label>
            <select className="select" value={labOrder.test_type || ''} onChange={e => setLabOrder({...labOrder, test_type: e.target.value, tests: []})}>
              <option value="">Select test type</option>
              {['Hematology','Chemistry','Immunology','Microbiology','Pathology'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          
          <div>
            <label className="label">Select Tests *</label>
            <div className="space-y-2 bg-navy-800 p-3 rounded-lg max-h-40 overflow-y-auto">
              {labOrder.test_type && (
                <>
                  {['CBC','RBC','WBC','Hemoglobin','Blood Sugar','Urine Routine','Liver Function','Kidney Function','Lipid Profile','Thyroid Profile','COVID-19 RT-PCR'].filter(t => true).map(test => (
                    <label key={test} className="flex items-center gap-2 text-sm">
                      <input 
                        type="checkbox" 
                        checked={labOrder.tests?.includes(test) || false}
                        onChange={e => {
                          if (e.target.checked) {
                            setLabOrder({...labOrder, tests: [...(labOrder.tests || []), test]})
                          } else {
                            setLabOrder({...labOrder, tests: (labOrder.tests || []).filter(t => t !== test)})
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-slate-300">{test}</span>
                    </label>
                  ))}
                </>
              )}
            </div>
          </div>

          <div>
            <label className="label">Priority</label>
            <select className="select" value={labOrder.is_stat ? 'STAT' : 'ROUTINE'} onChange={e => setLabOrder({...labOrder, is_stat: e.target.value === 'STAT'})}>
              <option value="ROUTINE">Routine</option>
              <option value="STAT">STAT (Urgent)</option>
            </select>
          </div>

          <div>
            <label className="label">Clinical Indication</label>
            <textarea className="textarea h-16" placeholder="e.g. Fever, suspected infection" value={labOrder.clinical_indication || ''} onChange={e => setLabOrder({...labOrder, clinical_indication: e.target.value})} />
          </div>

          <div className="flex gap-2">
            <button 
              className="btn-primary flex-1" 
              disabled={labOrderMut.isPending || !labOrder.tests?.length} 
              onClick={() => labOrderMut.mutate({ items: labOrder.tests.map(t => ({test_name: t})), is_stat: labOrder.is_stat, clinical_indication: labOrder.clinical_indication })}
            >
              {labOrderMut.isPending ? 'Saving...' : 'Save Lab Tests'}
            </button>
            <button className="btn flex-1" onClick={() => {setShowLabModal(false); setLabOrder(emptyLabOrder)}}>Cancel</button>
          </div>
        </div>
      </Modal>

      <Modal open={showDischargeModal} onClose={() => setShowDischargeModal(false)} title="Discharge Patient" size="lg">
        <div className="space-y-3">
          <div className="bg-blue-900 border border-cyan rounded-lg p-3">
            <div className="text-xs text-slate-300"><span className="text-cyan font-semibold">Admission Details:</span> {p?.first_name} {p?.last_name} · UHID: {p?.uhid}</div>
          </div>
          
          <div><label className="label">Final Diagnosis *</label><input className="input" placeholder="e.g. Pneumonia resolved" value={dischargeData.final_diagnosis} onChange={e => setDischargeData({...dischargeData, final_diagnosis: e.target.value.trim()})} required /></div>
          
          <div><label className="label">Condition at Discharge</label><select className="select" value={dischargeData.condition_at_discharge} onChange={e => setDischargeData({...dischargeData, condition_at_discharge: e.target.value})}><option value="">Select condition</option>{['IMPROVED','STABLE','UNCHANGED','DETERIORATED','TRANSFERRED'].map(c => <option key={c}>{c}</option>)}</select></div>
          
          <div><label className="label">Follow-up Date</label><input type="date" className="input" value={dischargeData.follow_up_date} onChange={e => setDischargeData({...dischargeData, follow_up_date: e.target.value})} /></div>
          
          <div><label className="label">Follow-up Instructions</label><textarea className="textarea h-16" placeholder="e.g. Review after 1 week, continue medications..." value={dischargeData.follow_up_instructions} onChange={e => setDischargeData({...dischargeData, follow_up_instructions: e.target.value})} /></div>
          
          <div><label className="label">Diet Advice</label><input className="input" placeholder="e.g. Light diet, high protein" value={dischargeData.diet_advice} onChange={e => setDischargeData({...dischargeData, diet_advice: e.target.value})} /></div>
          
          <div><label className="label">Activity Advice</label><input className="input" placeholder="e.g. Bed rest for 3 days" value={dischargeData.activity_advice} onChange={e => setDischargeData({...dischargeData, activity_advice: e.target.value})} /></div>
          
          <div className="bg-amber-900 border border-brand-amber rounded-lg p-3">
            <div className="text-xs text-slate-300">✓ Bill will be auto-generated with admission charges & services used</div>
          </div>
          
          <div className="flex gap-2">
            <button 
              className="btn-primary flex-1" 
              disabled={dischargeMut.isPending || !dischargeData.final_diagnosis.trim() || !currentAdmission}
              onClick={() => {
                if (currentAdmission && dischargeData.final_diagnosis.trim()) {
                  dischargeMut.mutate({ admission_id: currentAdmission.id, ...dischargeData, auto_bill: true });
                }
              }}
            >
              {dischargeMut.isPending ? '⏳ Discharging...' : '✅ Discharge & Generate Bill'}
            </button>
            <button className="btn flex-1" onClick={() => setShowDischargeModal(false)} disabled={dischargeMut.isPending}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

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
