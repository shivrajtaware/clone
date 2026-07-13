// src/pages/superadmin/SAInvoicesPage.jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../utils/api'
import { Badge, Spinner } from '../../components/common/StatCard'
import StatCard from '../../components/common/StatCard'
import { fmt } from '../../utils/helpers'

export default function SAInvoicesPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['sa-invoices'],
    queryFn: () => api.get('/superadmin/invoices').then(r => r.data.data),
  })

  const markPaidMut = useMutation({
    mutationFn: (id) => api.patch(`/superadmin/invoices/${id}/mark-paid`),
    onSuccess: () => { toast.success('Invoice marked as paid'); qc.invalidateQueries(['sa-invoices']) },
  })

  const invoices = data || []
  const totalRevenue    = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + parseFloat(i.amount), 0)
  const pendingRevenue  = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + parseFloat(i.amount), 0)

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header"><div><h1 className="page-title">Invoices & Billing</h1><p className="page-sub">Platform subscription billing</p></div></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon="💰" value={fmt.currency(totalRevenue)} label="Total Collected" color="green" />
        <StatCard icon="⏳" value={fmt.currency(pendingRevenue)} label="Pending Collection" color="amber" />
        <StatCard icon="📋" value={invoices.filter(i => i.status === 'PENDING').length} label="Pending Invoices" color="red" />
        <StatCard icon="✅" value={invoices.filter(i => i.status === 'PAID').length} label="Paid Invoices" color="cyan" />
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <table className="tbl">
            <thead><tr><th>Hospital</th><th>Period</th><th>Amount</th><th>Status</th><th>Created</th><th>Paid On</th><th>Actions</th></tr></thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id}>
                  <td>
                    <div className="text-xs font-medium text-white">{inv.hospital?.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{inv.hospital?.code}</div>
                  </td>
                  <td className="text-xs">{fmt.date(inv.period_from)} — {fmt.date(inv.period_to)}</td>
                  <td className="text-sm font-bold text-white">{fmt.currency(inv.amount)}</td>
                  <td><Badge status={inv.status} /></td>
                  <td className="text-xs text-slate-400">{fmt.date(inv.created_at)}</td>
                  <td className="text-xs text-slate-400">{inv.paid_at ? fmt.date(inv.paid_at) : '—'}</td>
                  <td>
                    {inv.status === 'PENDING' && (
                      <button className="btn text-xs px-2 py-1 text-brand-green border-brand-green/30 hover:bg-brand-green hover:text-navy-900"
                        onClick={() => markPaidMut.mutate(inv.id)}
                        disabled={markPaidMut.isPending}>
                        ✅ Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No invoices found</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
