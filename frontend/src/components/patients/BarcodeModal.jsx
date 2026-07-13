import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { Spinner } from '../common/StatCard'

export default function BarcodeModal({ patientId, patientName, onClose }) {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['barcode', patientId],
    queryFn: () => api.get(`/barcode/${patientId}`).then(r => r.data),
    enabled: !!patientId,
  })

  const regenerateMutation = useMutation({
    mutationFn: () => api.post(`/barcode/${patientId}/regenerate`).then(r => r.data.data),
    onSuccess: () => {
      toast.success('Barcode regenerated successfully')
      queryClient.invalidateQueries({ queryKey: ['barcode', patientId] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to regenerate barcode')
    },
  })

  const handleDownload = () => {
    if (patient?.barcode_image) {
      const link = document.createElement('a')
      link.href = patient.barcode_image
      link.download = `barcode-${patient.uhid}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('Barcode downloaded')
    } else {
      toast.error('Barcode image not available')
    }
  }

  const handlePrint = () => {
    if (patient?.barcode_image) {
      const printWindow = window.open('')
      printWindow.document.write(`
        <html>
          <head>
            <title>Patient Barcode - ${patient.uhid}</title>
            <style>
              body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #fff; }
              .print-container { text-align: center; }
              .barcode-img { max-width: 90%; height: auto; margin: 20px 0; }
              .patient-info { font-family: Arial, sans-serif; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="print-container">
              <div class="patient-info">
                <h2>${patient.first_name} ${patient.last_name}</h2>
                <p>UHID: ${patient.uhid}</p>
              </div>
              <img src="${patient.barcode_image}" class="barcode-img" alt="Patient Barcode" />
            </div>
            <script>window.print();</script>
          </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-navy-900 rounded-lg p-8">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  if (error || !data?.data?.patient) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-navy-900 rounded-lg p-6 space-y-4 max-w-sm w-full">
          <p className="text-slate-400 text-center">⚠️ Barcode data not available for this patient</p>
          <button onClick={onClose} className="btn-primary w-full">Close</button>
        </div>
      </div>
    )
  }

  const patient = data.data.patient
  const emrSummary = data.data.emrSummary

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-navy-900 rounded-lg max-w-md w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-default pb-3">
          <h2 className="text-lg font-bold text-white">Patient Barcode</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">×</button>
        </div>

        {/* Patient Info */}
        <div className="bg-navy-800 rounded-lg p-4 space-y-2">
          <div>
            <span className="text-xs text-slate-400">Name:</span>
            <p className="text-sm font-medium text-white">{patient.first_name} {patient.last_name}</p>
          </div>
          <div>
            <span className="text-xs text-slate-400">UHID:</span>
            <p className="text-sm font-mono text-cyan">{patient.uhid}</p>
          </div>
          {patient.blood_group && (
            <div>
              <span className="text-xs text-slate-400">Blood Group:</span>
              <p className="text-sm text-white">{patient.blood_group}</p>
            </div>
          )}
        </div>

        {/* Barcode Image */}
        {patient.barcode_image && (
          <div className="bg-navy-800 rounded-lg p-4 flex justify-center">
            <img
              src={patient.barcode_image}
              alt="Patient Barcode"
              className="max-w-full h-auto"
            />
          </div>
        )}

        {/* EMR Summary */}
        {emrSummary && (
          <div className="bg-navy-800 rounded-lg p-4 grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="text-2xl font-bold text-cyan">{emrSummary.admissions}</div>
              <div className="text-xs text-slate-400">Admissions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-brand-purple">{emrSummary.notes}</div>
              <div className="text-xs text-slate-400">EMR Notes</div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleDownload}
            className="flex-1 btn text-xs py-2"
          >
            📥 Download
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 btn text-xs py-2"
          >
            🖨️ Print
          </button>
        </div>

        {/* Regenerate */}
        <button
          onClick={() => {
            regenerateMutation.mutate()
          }}
          disabled={regenerateMutation.isPending}
          className="w-full btn-secondary text-xs py-2 disabled:opacity-50"
        >
          {regenerateMutation.isPending ? 'Regenerating...' : '🔄 Regenerate'}
        </button>

        {/* Close Button */}
        <button onClick={onClose} className="w-full btn-primary text-xs py-2">
          Close
        </button>
      </div>
    </div>
  )
}
