// src/pages/RegisterPage.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import api from '../utils/api'
import { Badge, Spinner, EmptyState } from '../components/common/StatCard'
import { fmt } from '../utils/helpers'

// Helper function to convert 24h time string to 12h am/pm format (For OPD Time Column)
const formatTimeAMPM = (timeStr) => {
  if (!timeStr) return '—';
  const [h, m] = timeStr.split(':');
  if (!h || !m) return timeStr;
  let hours = parseInt(h, 10);
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${hours}:${m} ${ampm}`;
};

// Helper function to format full Date object to "Date Time am/pm" (For IPD PDF Export)
const formatDateTimeAMPM = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const date = d.toLocaleDateString();
  let hours = d.getHours();
  let minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${date} ${hours}:${minutes} ${ampm}`;
};

export default function RegisterPage() {
  const [tab, setTab]               = useState('opd')
  const [search, setSearch]         = useState('')

  // ── OPD History Query ────────────────────────────────────────
  const opdQuery = useQuery({
    queryKey: ['register-opd-history', search],
    queryFn: () => api.get('/register/opd/history', { params: { search } }).then(r => r.data.data),
  })

  // ── IPD History Query ────────────────────────────────────────
  const ipdQuery = useQuery({
    queryKey: ['register-ipd-history', search],
    queryFn: () => api.get('/register/ipd/history', { params: { search } }).then(r => r.data.data),
  })

  const opdData = opdQuery.data || []
  const ipdData = ipdQuery.data || []

  // ── Export PDF ───────────────────────────────────────────────
  const exportPDF = () => {
    const data = tab === 'opd' ? opdData : ipdData
    if (!data.length) return toast.error('No data to export')

    const doc = new jsPDF('landscape')
    const title = tab === 'opd' ? 'OPD Patient History Report' : 'IPD Patient History Report'
    
    doc.setFontSize(14)
    doc.text(title, 14, 15)
    doc.setFontSize(10)
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22)

    const headers = tab === 'opd'
      ? [['S.No', 'Patient Name', 'Mobile', 'UHID', 'Address', 'Doctor', 'Date', 'Time', 'Complaint', 'Status']]
      : [['S.No', 'Patient Name', 'Mobile', 'UHID', 'Admission Date & Time', 'Discharge Date', 'Ward/Bed', 'Diagnosis', 'Bill No', 'Status']]

    const rows = tab === 'opd'
      ? data.map((r, i) => [
          i + 1,
          `${r.patient?.first_name || ''} ${r.patient?.last_name || ''}`.trim(),
          r.patient?.phone || '—',
          r.patient?.uhid || '—',
          r.patient?.address || '—',
          r.doctor ? `Dr. ${r.doctor.first_name} ${r.doctor.last_name}` : '—',
          r.appointment_date ? new Date(r.appointment_date).toLocaleDateString() : '—',
          formatTimeAMPM(r.slot_time), 
          r.chief_complaint || '—',
          r.status || '—',
        ])
      : data.map((r, i) => [
          i + 1,
          `${r.patient?.first_name || ''} ${r.patient?.last_name || ''}`.trim(),
          r.patient?.phone || '—',
          r.patient?.uhid || '—',
          formatDateTimeAMPM(r.admission_date),
          r.discharge_date ? formatDateTimeAMPM(r.discharge_date) : '—',
          r.bed ? `${r.bed.ward} / ${r.bed.bed_no}` : '—',
          r.provisional_diagnosis || r.final_diagnosis || '—',
          r.bills?.length > 0 ? r.bills.map(b => b.bill_no).join(', ') : '—',
          r.status || '—',
        ])

    autoTable(doc, {
      startY: 28,
      head: headers,
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [14, 165, 233] },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    })

    doc.save(tab === 'opd' ? 'OPD_History.pdf' : 'IPD_History.pdf')
    toast.success(`${tab.toUpperCase()} history exported as PDF!`)
  }

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Patient Register</h1>
          <p className="page-sub">History of all booked OPD appointments and IPD admissions</p>
        </div>
        <div className="flex gap-2">
          <button className="btn bg-red-500 hover:bg-red-600 border-none" onClick={exportPDF}>📄 Export PDF</button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
        <div className="card text-center">
          <div className="text-2xl font-bold text-cyan">{opdData.length}</div>
          <div className="text-xs text-slate-400 mt-1">Total Completed/Cancelled OPD Patients</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-brand-purple">{ipdData.length}</div>
          <div className="text-xs text-slate-400 mt-1">Total IPD Admissions</div>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="card">
        <input
          className="input w-full"
          placeholder="Search by patient name, UHID, mobile number..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 border-b border-default">
        <button
          onClick={() => setTab('opd')}
          className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
            tab === 'opd'
              ? 'bg-cyan/10 text-cyan border-b-2 border-cyan'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🏥 OPD History
          <span className="ml-2 badge badge-cyan">{opdData.length}</span>
        </button>
        <button
          onClick={() => setTab('ipd')}
          className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
            tab === 'ipd'
              ? 'bg-brand-purple/10 text-brand-purple border-b-2 border-brand-purple'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          🛏️ IPD History
          <span className="ml-2 badge badge-purple">{ipdData.length}</span>
        </button>
      </div>

      {/* ── OPD History Table ── */}
      {tab === 'opd' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-default flex items-center justify-between">
            <div className="text-sm font-semibold text-white">OPD History</div>
          </div>
          {opdQuery.isLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : opdData.length === 0 ? (
            <EmptyState
              icon="🏥"
              title="No OPD history found"
              description="No outpatient visits match your search."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Patient Name</th>
                    <th>Mobile Number</th>
                    <th>UHID</th>
                    <th>Address</th>
                    <th>Doctor</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Chief Complaint</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {opdData.map((record, index) => (
                    <tr key={record.id}>
                      <td className="text-xs text-slate-400 font-mono">{index + 1}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="avatar-sm bg-gradient-to-br from-cyan to-brand-purple text-[10px] flex-shrink-0">
                            {record.patient?.first_name?.[0]}{record.patient?.last_name?.[0]}
                          </div>
                          <div className="font-medium text-white text-xs">
                            {record.patient?.first_name} {record.patient?.last_name}
                          </div>
                        </div>
                      </td>
                      <td className="text-xs font-mono">{record.patient?.phone || '—'}</td>
                      <td className="font-mono text-xs text-cyan">{record.patient?.uhid || '—'}</td>
                      <td className="text-xs max-w-[150px] truncate">{record.patient?.address || '—'}</td>
                      <td className="text-xs">
                        {record.doctor
                          ? `Dr. ${record.doctor.first_name} ${record.doctor.last_name}`
                          : '—'}
                      </td>
                      <td className="text-xs text-slate-400">
                        {record.appointment_date ? new Date(record.appointment_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="text-xs text-slate-400">
                        {formatTimeAMPM(record.slot_time)}
                      </td>
                      <td className="text-xs max-w-[180px]">
                        <div className="line-clamp-2">{record.chief_complaint || '—'}</div>
                      </td>
                      <td><Badge status={record.status} /></td>
                      <td>
                        <Link to={`/patients/${record.patient?.id}`} className="btn text-xs px-2 py-1">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── IPD History Table ── */}
      {tab === 'ipd' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-default flex items-center justify-between">
            <div className="text-sm font-semibold text-white">IPD Admission History</div>
          </div>
          {ipdQuery.isLoading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : ipdData.length === 0 ? (
            <EmptyState
              icon="🛏️"
              title="No IPD history found"
              description="No admissions match your search."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Patient Name</th>
                    <th>Mobile Number</th>
                    <th>UHID</th>
                    <th>Admission Date & Time</th>
                    <th>Discharge Date</th>
                    <th>Ward / Bed</th>
                    <th>Diagnosis</th>
                    <th>Status</th>
                    <th>Bill</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ipdData.map((record, index) => (
                    <tr key={record.id}>
                      <td className="text-xs text-slate-400 font-mono">{index + 1}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="avatar-sm bg-gradient-to-br from-brand-purple to-cyan text-[10px] flex-shrink-0">
                            {record.patient?.first_name?.[0]}{record.patient?.last_name?.[0]}
                          </div>
                          <div className="font-medium text-white text-xs">
                            {record.patient?.first_name} {record.patient?.last_name}
                          </div>
                        </div>
                      </td>
                      <td className="text-xs font-mono">{record.patient?.phone || '—'}</td>
                      <td className="font-mono text-xs text-cyan">{record.patient?.uhid || '—'}</td>
                      <td className="text-xs text-slate-400">
                        {/* Table Display Update */}
                        <div>{record.admission_date ? new Date(record.admission_date).toLocaleDateString() : '—'}</div>
                        <div className="text-[10px] text-slate-500">
                          {record.admission_date
                            ? new Date(record.admission_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                            : ''}
                        </div>
                      </td>
                      <td className="text-xs text-slate-400">
                        {record.discharge_date ? (
                          <div>
                            <div>{new Date(record.discharge_date).toLocaleDateString()}</div>
                            <div className="text-[10px] text-slate-500">
                              {new Date(record.discharge_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </div>
                          </div>
                        ) : (
                          <span className="badge badge-cyan">Still Admitted</span>
                        )}
                      </td>
                      <td className="text-xs">
                        {record.bed
                          ? <span className="badge badge-cyan">{record.bed.ward} · {record.bed.bed_no}</span>
                          : '—'}
                      </td>
                      <td className="text-xs max-w-[160px]">
                        <div className="line-clamp-2">
                          {record.provisional_diagnosis || record.final_diagnosis || '—'}
                        </div>
                      </td>
                      <td><Badge status={record.status} /></td>
                      <td>
                        {record.bills && record.bills.length > 0 ? (
                          // Change this line in your RegisterPage.jsx
                        <Link 
                             to={`/billing?type=IPD&billId=${record.bills[0].id}`} 
                             className="btn text-[10px] px-2 py-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/30 whitespace-nowrap"
>
                              📄 View Bill
                      </Link>
                        ) : (
                          <span className="text-xs text-slate-500">No Bill</span>
                        )}
                      </td>
                      <td>
                        <Link to={`/patients/${record.patient?.id}`} className="btn text-xs px-2 py-1">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  )
}