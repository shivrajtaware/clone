// src/pages/InventoryPage.jsx
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
  Activity, AlertTriangle, BarChart3, ClipboardCheck, Download, Filter, Gauge,
  History, MapPin, PackagePlus, Plus, QrCode, Search, ShieldCheck, SlidersHorizontal,
  Sparkles, Wrench,
} from 'lucide-react'
import api from '../utils/api'
import Modal from '../components/common/Modal'
import StatCard, { Badge, Spinner } from '../components/common/StatCard'
import { fmt } from '../utils/helpers'

const txTypes = ['RECEIPT', 'ISSUE', 'RETURN', 'ADJUSTMENT', 'TRANSFER']
const assetStatuses = ['ACTIVE', 'UNDER_MAINTENANCE', 'DISPOSED', 'LOST']
const assetCriticality = ['Critical - Life Support', 'High - Care Delivery', 'Medium - Operational', 'Low - Non Clinical']
const itemCategories = ['Medical Consumable', 'Surgical Consumable', 'PPE', 'Linen', 'Housekeeping', 'Stationery', 'Biomedical Spare', 'General']

const num = (v) => Number(v || 0)
const money = (v) => `Rs. ${num(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const daysUntil = (date) => date ? Math.ceil((new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000) : null
const stockStatus = (item) => {
  const stock = num(item.current_stock)
  const min = num(item.min_level)
  if (stock <= 0) return { label: 'Stockout', badge: 'badge-red', score: 100 }
  if (stock <= min) return { label: 'Reorder Now', badge: 'badge-red', score: 85 }
  if (stock <= min * 1.5) return { label: 'Watch', badge: 'badge-amber', score: 55 }
  return { label: 'Healthy', badge: 'badge-green', score: 15 }
}
const assetHealth = (asset) => {
  const due = daysUntil(asset.next_service)
  if (asset.status === 'UNDER_MAINTENANCE') return { label: 'In Service Bay', badge: 'badge-amber', score: 75 }
  if (asset.status !== 'ACTIVE') return { label: asset.status, badge: 'badge-gray', score: 60 }
  if (due !== null && due < 0) return { label: 'Service Overdue', badge: 'badge-red', score: 90 }
  if (due !== null && due <= 7) return { label: 'Due This Week', badge: 'badge-amber', score: 65 }
  if (due !== null && due <= 30) return { label: 'Due Soon', badge: 'badge-blue', score: 35 }
  return { label: 'Healthy', badge: 'badge-green', score: 10 }
}
const csv = (rows) => rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')

export default function InventoryPage() {
  const [tab, setTab] = useState('overview')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showItemModal, setShowItemModal] = useState(false)
  const [showAssetModal, setShowAssetModal] = useState(false)
  const [txItem, setTxItem] = useState(null)
  const [maintenanceAsset, setMaintenanceAsset] = useState(null)
  const qc = useQueryClient()

  const itemForm = useForm({ defaultValues: { category: 'Medical Consumable', unit: 'pcs', current_stock: 0, min_level: 10, is_consumable: true } })
  const assetForm = useForm({ defaultValues: { status: 'ACTIVE', category: 'Biomedical Equipment' } })
  const txForm = useForm({ defaultValues: { type: 'RECEIPT', quantity: 1 } })
  const maintenanceForm = useForm({ defaultValues: { type: 'Preventive Maintenance' } })

  const itemsQuery = useQuery({ queryKey: ['inventory'], queryFn: () => api.get('/inventory').then(r => r.data.data), refetchInterval: 45000 })
  const assetsQuery = useQuery({ queryKey: ['assets'], queryFn: () => api.get('/inventory/assets').then(r => r.data.data), refetchInterval: 45000 })
  const txQuery = useQuery({ queryKey: ['inventory-transactions'], queryFn: () => api.get('/inventory/transactions').then(r => r.data.data), refetchInterval: 45000 })
  const allItems = itemsQuery.data || []
  const allAssets = assetsQuery.data || []
  const transactions = txQuery.data || []

  const itemRows = useMemo(() => allItems.map(item => {
    const status = stockStatus(item)
    const min = Math.max(1, num(item.min_level))
    const stock = num(item.current_stock)
    const suggestedReorder = Math.max(0, Math.ceil((min * 2.5) - stock))
    return { ...item, status, suggestedReorder, fillRate: Math.min(100, Math.round((stock / (min * 2)) * 100)) }
  }), [allItems])

  const assetRows = useMemo(() => allAssets.map(asset => ({ ...asset, health: assetHealth(asset), days_to_service: daysUntil(asset.next_service) })), [allAssets])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return itemRows.filter(i => {
      const match = !q || [i.name, i.code, i.category, i.sub_category, i.location].some(v => String(v || '').toLowerCase().includes(q))
      const state = !statusFilter || i.status.label === statusFilter
      return match && state
    })
  }, [itemRows, search, statusFilter])

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase()
    return assetRows.filter(a => {
      const match = !q || [a.name, a.asset_tag, a.category, a.make, a.model, a.location, a.status].some(v => String(v || '').toLowerCase().includes(q))
      const state = !statusFilter || a.health.label === statusFilter || a.status === statusFilter
      return match && state
    })
  }, [assetRows, search, statusFilter])

  const metrics = useMemo(() => {
    const stockout = itemRows.filter(i => i.status.label === 'Stockout').length
    const reorder = itemRows.filter(i => ['Stockout', 'Reorder Now'].includes(i.status.label)).length
    const serviceDue = assetRows.filter(a => ['Service Overdue', 'Due This Week'].includes(a.health.label)).length
    const assetValue = assetRows.reduce((sum, a) => sum + num(a.purchase_cost), 0)
    const riskScore = Math.round((
      itemRows.reduce((sum, i) => sum + i.status.score, 0) +
      assetRows.reduce((sum, a) => sum + a.health.score, 0)
    ) / Math.max(1, itemRows.length + assetRows.length))
    return { stockout, reorder, serviceDue, assetValue, riskScore }
  }, [itemRows, assetRows])

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['inventory'] })
    qc.invalidateQueries({ queryKey: ['assets'] })
    qc.invalidateQueries({ queryKey: ['inventory-transactions'] })
  }

  const addItemMut = useMutation({
    mutationFn: (data) => api.post('/inventory', data),
    onSuccess: () => { toast.success('Inventory item added'); refresh(); setShowItemModal(false); itemForm.reset({ category: 'Medical Consumable', unit: 'pcs', current_stock: 0, min_level: 10, is_consumable: true }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add item'),
  })
  const addAssetMut = useMutation({
    mutationFn: (data) => api.post('/inventory/assets', data),
    onSuccess: () => { toast.success('Asset registered'); refresh(); setShowAssetModal(false); assetForm.reset({ status: 'ACTIVE', category: 'Biomedical Equipment' }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add asset'),
  })
  const txMut = useMutation({
    mutationFn: ({ id, ...data }) => api.post(`/inventory/${id}/transaction`, data),
    onSuccess: () => { toast.success('Stock movement posted'); refresh(); setTxItem(null); txForm.reset({ type: 'RECEIPT', quantity: 1 }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to post movement'),
  })
  const maintenanceMut = useMutation({
    mutationFn: ({ id, ...data }) => api.post(`/inventory/assets/${id}/maintenance`, data),
    onSuccess: () => { toast.success('Maintenance recorded'); refresh(); setMaintenanceAsset(null); maintenanceForm.reset({ type: 'Preventive Maintenance' }) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to record maintenance'),
  })

  const exportPlan = () => {
    const rows = [['Type', 'Name', 'Code/Tag', 'Status', 'Stock/Service', 'Recommendation']]
    itemRows.filter(i => i.suggestedReorder > 0).forEach(i => rows.push(['Inventory', i.name, i.code, i.status.label, `${i.current_stock} ${i.unit}`, `Reorder ${i.suggestedReorder} ${i.unit}`]))
    assetRows.filter(a => a.health.score >= 60).forEach(a => rows.push(['Asset', a.name, a.asset_tag, a.health.label, a.next_service ? fmt.date(a.next_service) : '', 'Schedule maintenance review']))
    const blob = new Blob([csv(rows)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inventory-command-plan-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const loading = itemsQuery.isLoading || assetsQuery.isLoading

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory Intelligence Center</h1>
          <p className="page-sub">Predictive stock control, asset lifecycle, service risk, and movement traceability</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={exportPlan}><Download size={16} /> Export Action Plan</button>
          <button className="btn-primary" onClick={() => setShowItemModal(true)}><PackagePlus size={16} /> Add Smart Item</button>
          <button className="btn" onClick={() => setShowAssetModal(true)}><Plus size={16} /> Register Asset</button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <StatCard icon={<Gauge size={22} />} value={`${metrics.riskScore}%`} label="Operational risk" color={metrics.riskScore > 65 ? 'red' : metrics.riskScore > 35 ? 'amber' : 'green'} />
        <StatCard icon={<AlertTriangle size={22} />} value={metrics.stockout} label="Stockouts" color="red" />
        <StatCard icon={<Sparkles size={22} />} value={metrics.reorder} label="AI reorder lines" color="amber" />
        <StatCard icon={<Wrench size={22} />} value={metrics.serviceDue} label="Service risks" color="blue" />
        <StatCard icon={<ShieldCheck size={22} />} value={money(metrics.assetValue)} label="Asset book value" color="cyan" />
      </div>

      {(metrics.reorder > 0 || metrics.serviceDue > 0) && (
        <div className="alert-amber">
          <Sparkles size={18} />
          <span><strong>{metrics.reorder}</strong> inventory lines need reorder action and <strong>{metrics.serviceDue}</strong> assets need service attention.</span>
        </div>
      )}

      <div className="tabs overflow-x-auto">
        {[
          ['overview', 'Command Center'], ['inventory', 'Smart Inventory'], ['assets', 'Asset Lifecycle'], ['movements', 'Stock Trace'], ['maintenance', 'Service Board'],
        ].map(([key, label]) => <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => { setTab(key); setStatusFilter('') }}>{label}</button>)}
      </div>

      <div className="card">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="relative lg:col-span-7">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
            <input className="input pl-9" placeholder="Search item, tag, category, make, model, location..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select lg:col-span-3" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All intelligence states</option>
            {['Stockout','Reorder Now','Watch','Healthy','Service Overdue','Due This Week','Due Soon','UNDER_MAINTENANCE'].map(s => <option key={s}>{s}</option>)}
          </select>
          <button className="btn lg:col-span-2" onClick={() => { setSearch(''); setStatusFilter('') }}><Filter size={16} /> Reset</button>
        </div>
      </div>

      {tab === 'overview' && <Overview items={itemRows} assets={assetRows} transactions={transactions} loading={loading} onMove={setTxItem} onMaintenance={setMaintenanceAsset} />}
      {tab === 'inventory' && <InventoryTable rows={filteredItems} loading={loading} onMove={setTxItem} />}
      {tab === 'assets' && <AssetsTable rows={filteredAssets} loading={loading} onMaintenance={setMaintenanceAsset} />}
      {tab === 'movements' && <TransactionsTable rows={transactions} loading={txQuery.isLoading} />}
      {tab === 'maintenance' && <MaintenanceBoard assets={filteredAssets} loading={loading} onMaintenance={setMaintenanceAsset} />}

      <ItemModal open={showItemModal} onClose={() => setShowItemModal(false)} form={itemForm} mutate={addItemMut} />
      <AssetModal open={showAssetModal} onClose={() => setShowAssetModal(false)} form={assetForm} mutate={addAssetMut} />
      <TransactionModal open={!!txItem} onClose={() => setTxItem(null)} item={txItem} form={txForm} mutate={txMut} />
      <MaintenanceModal open={!!maintenanceAsset} onClose={() => setMaintenanceAsset(null)} asset={maintenanceAsset} form={maintenanceForm} mutate={maintenanceMut} />
    </div>
  )
}

function Overview({ items, assets, transactions, loading, onMove, onMaintenance }) {
  const reorder = items.filter(i => i.suggestedReorder > 0).sort((a, b) => b.status.score - a.status.score).slice(0, 6)
  const service = assets.filter(a => a.health.score >= 35).sort((a, b) => b.health.score - a.health.score).slice(0, 6)
  if (loading) return <div className="card flex justify-center py-12"><Spinner /></div>
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="card xl:col-span-2">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Sparkles size={16} /> Reorder Intelligence</h2>
        <div className="space-y-2">
          {reorder.map(i => <ActionRow key={i.id} title={i.name} sub={`${i.category} | ${i.current_stock} ${i.unit} on hand | min ${i.min_level}`} badge={i.status} action={`Reorder ${i.suggestedReorder} ${i.unit}`} onClick={() => onMove(i)} />)}
          {!reorder.length && <div className="text-xs text-slate-400 py-6 text-center">No reorder actions needed.</div>}
        </div>
      </div>
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Wrench size={16} /> Service Intelligence</h2>
        <div className="space-y-2">
          {service.map(a => <ActionRow key={a.id} title={a.name} sub={`${a.asset_tag} | ${a.location || 'Unmapped'} | ${a.next_service ? fmt.date(a.next_service) : 'No due date'}`} badge={a.health} action="Service" onClick={() => onMaintenance(a)} />)}
          {!service.length && <div className="text-xs text-slate-400 py-6 text-center">No service risks detected.</div>}
        </div>
      </div>
      <div className="card xl:col-span-3">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><History size={16} /> Live Movement Feed</h2>
        <TransactionsTable rows={transactions.slice(0, 8)} compact />
      </div>
    </div>
  )
}

function ActionRow({ title, sub, badge, action, onClick }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-lg border border-default bg-navy-800 p-3">
      <div>
        <div className="text-xs font-semibold text-white">{title}</div>
        <div className="text-[11px] text-slate-400">{sub}</div>
      </div>
      <div className="flex items-center gap-2"><span className={badge.badge}>{badge.label}</span><button className="btn text-xs px-2 py-1" onClick={onClick}>{action}</button></div>
    </div>
  )
}

function InventoryTable({ rows, loading, onMove }) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-default flex items-center justify-between">
        <div className="text-sm font-semibold text-white">Smart Inventory Matrix</div>
        <span className="text-xs text-slate-400">{rows.length} lines</span>
      </div>
      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Item Intelligence</th><th>Stock Health</th><th>Reorder Plan</th><th>Storage</th><th>Trace</th><th>Action</th></tr></thead>
            <tbody>
              {rows.map(i => (
                <tr key={i.id}>
                  <td><div className="text-xs font-semibold text-white">{i.name}</div><div className="text-[10px] text-slate-500">{i.code || 'No code'} | {i.category}{i.sub_category ? ` / ${i.sub_category}` : ''}</div></td>
                  <td><div className="min-w-[130px]"><div className="flex items-center justify-between text-[11px] mb-1"><span>{i.current_stock} {i.unit}</span><span>{i.fillRate}%</span></div><div className="progress"><div className={`progress-bar ${i.fillRate < 50 ? 'bg-brand-red' : i.fillRate < 80 ? 'bg-brand-amber' : 'bg-brand-green'}`} style={{ width: `${Math.min(100, i.fillRate)}%` }} /></div></div></td>
                  <td><div className="text-xs text-white">{i.suggestedReorder > 0 ? `${i.suggestedReorder} ${i.unit}` : 'No action'}</div><div className="text-[10px] text-slate-500">Min level {i.min_level}</div></td>
                  <td className="text-xs"><div className="flex items-center gap-1"><MapPin size={13} /> {i.location || 'Unmapped'}</div><div className="text-[10px] text-slate-500">{i.is_consumable ? 'Consumable' : 'Non-consumable'}</div></td>
                  <td><span className={i.status.badge}>{i.status.label}</span></td>
                  <td><button className="btn text-xs px-2 py-1" onClick={() => onMove(i)}><Activity size={14} /> Move</button></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No inventory lines found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AssetsTable({ rows, loading, onMaintenance }) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-default flex items-center justify-between">
        <div className="text-sm font-semibold text-white">Asset Lifecycle Command</div>
        <span className="text-xs text-slate-400">{rows.length} assets</span>
      </div>
      {loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Asset</th><th>Identity</th><th>Lifecycle</th><th>Service SLA</th><th>Value</th><th>Action</th></tr></thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.id}>
                  <td><div className="text-xs font-semibold text-white">{a.name}</div><div className="text-[10px] text-slate-500">{a.category} | {a.make || '-'} {a.model || ''}</div></td>
                  <td><div className="font-mono text-xs text-cyan">{a.asset_tag}</div><div className="text-[10px] text-slate-500">{a.serial_no || 'No serial'}</div></td>
                  <td className="text-xs"><div>{a.location || 'Unmapped'}</div><Badge status={a.status} /></td>
                  <td><div className="text-xs text-white">{a.next_service ? fmt.date(a.next_service) : 'Not scheduled'}</div><div className={`text-[10px] ${a.days_to_service !== null && a.days_to_service < 0 ? 'text-brand-red' : 'text-slate-500'}`}>{a.days_to_service === null ? 'No SLA' : `${a.days_to_service} days`}</div><span className={a.health.badge}>{a.health.label}</span></td>
                  <td className="text-xs">{money(a.purchase_cost)}</td>
                  <td><button className="btn text-xs px-2 py-1" onClick={() => onMaintenance(a)}><Wrench size={14} /> Service</button></td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No assets registered.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TransactionsTable({ rows, loading, compact }) {
  if (loading) return <div className="card flex justify-center py-8"><Spinner /></div>
  return (
    <div className={compact ? '' : 'card p-0 overflow-hidden'}>
      {!compact && <div className="px-4 py-3 border-b border-default text-sm font-semibold text-white">Stock Trace Ledger</div>}
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Time</th><th>Item</th><th>Type</th><th>Qty</th><th>Departments</th><th>Reference</th></tr></thead>
          <tbody>
            {(rows || []).map(tx => <tr key={tx.id}><td className="text-xs text-slate-400">{fmt.ago(tx.created_at)}</td><td><div className="text-xs text-white">{tx.item?.name}</div><div className="text-[10px] text-slate-500">{tx.item?.code || tx.item?.category}</div></td><td><Badge status={tx.type} /></td><td className="text-xs">{tx.quantity} {tx.item?.unit}</td><td className="text-xs">{tx.from_dept || '-'} {'->'} {tx.to_dept || '-'}</td><td className="text-xs text-slate-400">{tx.reference || '-'}</td></tr>)}
            {(!rows || rows.length === 0) && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No stock movements yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MaintenanceBoard({ assets, loading, onMaintenance }) {
  if (loading) return <div className="card flex justify-center py-8"><Spinner /></div>
  const lanes = [
    ['Service Overdue', assets.filter(a => a.health.label === 'Service Overdue')],
    ['Due This Week', assets.filter(a => a.health.label === 'Due This Week')],
    ['Due Soon', assets.filter(a => a.health.label === 'Due Soon')],
    ['Healthy', assets.filter(a => a.health.label === 'Healthy')],
  ]
  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
      {lanes.map(([title, rows]) => (
        <div key={title} className="card">
          <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-semibold text-white">{title}</h2><span className="badge-gray">{rows.length}</span></div>
          <div className="space-y-2">
            {rows.map(a => <div key={a.id} className="rounded-lg border border-default bg-navy-800 p-3"><div className="text-xs font-semibold text-white">{a.name}</div><div className="text-[11px] text-slate-400">{a.asset_tag} | {a.location || 'Unmapped'}</div><div className="mt-2 flex items-center justify-between"><span className={a.health.badge}>{a.days_to_service === null ? 'No SLA' : `${a.days_to_service}d`}</span><button className="btn text-xs px-2 py-1" onClick={() => onMaintenance(a)}>Service</button></div></div>)}
            {!rows.length && <div className="text-xs text-slate-400 py-4 text-center">Empty lane</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

function ItemModal({ open, onClose, form, mutate }) {
  const { register, handleSubmit, watch } = form
  const stock = num(watch('current_stock'))
  const min = num(watch('min_level'))
  return <Modal open={open} onClose={onClose} title="Smart Inventory Item" size="xl"><form onSubmit={handleSubmit(d => mutate.mutate(d))} className="space-y-4">
    <Section title="Core Identity"><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><Field label="Item name" required><input className="input" {...register('name', { required: true })} /></Field><Field label="Item code / SKU"><input className="input" {...register('code')} /></Field><Field label="Category" required><select className="select" {...register('category', { required: true })}>{itemCategories.map(c => <option key={c}>{c}</option>)}</select></Field><Field label="Sub category"><input className="input" placeholder="Syringe / Gauze / Sensor" {...register('sub_category')} /></Field><Field label="Unit" required><input className="input" placeholder="pcs / box / roll / ml" {...register('unit', { required: true })} /></Field><Field label="Storage location"><input className="input" placeholder="CSSD-A1 / ICU Store" {...register('location')} /></Field></div></Section>
    <Section title="Stock Intelligence"><div className="grid grid-cols-1 md:grid-cols-4 gap-3"><Field label="Opening stock"><input type="number" step="0.01" min="0" className="input" {...register('current_stock')} /></Field><Field label="Minimum safe level"><input type="number" step="0.01" min="0" className="input" {...register('min_level')} /></Field><Field label="Reorder suggestion"><div className="rounded-lg border border-default bg-navy-800 px-3 py-2 text-sm text-white">{Math.max(0, Math.ceil((Math.max(1, min) * 2.5) - stock))}</div></Field><Field label="Risk state"><div className="rounded-lg border border-default bg-navy-800 px-3 py-2 text-sm"><span className={stockStatus({ current_stock: stock, min_level: min }).badge}>{stockStatus({ current_stock: stock, min_level: min }).label}</span></div></Field></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('is_consumable')} /> Consumable, issue from ward stock</label></Section>
    <SubmitRow loading={mutate.isPending} label="Save smart item" onCancel={onClose} />
  </form></Modal>
}

function AssetModal({ open, onClose, form, mutate }) {
  const { register, handleSubmit, watch } = form
  const tag = watch('asset_tag')
  return <Modal open={open} onClose={onClose} title="Asset Lifecycle Registration" size="xl"><form onSubmit={handleSubmit(d => mutate.mutate(d))} className="space-y-4">
    <Section title="Identity & Classification"><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><Field label="Asset tag" required><input className="input" placeholder="BIO-ICU-VENT-001" {...register('asset_tag', { required: true })} /></Field><Field label="Asset name" required><input className="input" {...register('name', { required: true })} /></Field><Field label="Category" required><input className="input" placeholder="Ventilator / Monitor / Pump" {...register('category', { required: true })} /></Field><Field label="Criticality"><select className="select" {...register('notes')}>{assetCriticality.map(c => <option key={c}>{c}</option>)}</select></Field><Field label="Status"><select className="select" {...register('status')}>{assetStatuses.map(s => <option key={s}>{s}</option>)}</select></Field><Field label="Location"><input className="input" placeholder="ICU Bed 04 / OT-2" {...register('location')} /></Field></div></Section>
    <Section title="Manufacturer & Commercial"><div className="grid grid-cols-1 md:grid-cols-4 gap-3"><Field label="Make"><input className="input" {...register('make')} /></Field><Field label="Model"><input className="input" {...register('model')} /></Field><Field label="Serial no"><input className="input" {...register('serial_no')} /></Field><Field label="Purchase cost"><input type="number" step="0.01" min="0" className="input" {...register('purchase_cost')} /></Field><Field label="Purchase date"><input type="date" className="input" {...register('purchase_date')} /></Field><Field label="Warranty end"><input type="date" className="input" {...register('warranty_end')} /></Field><Field label="AMC end"><input type="date" className="input" {...register('amc_end')} /></Field><Field label="Next service"><input type="date" className="input" {...register('next_service')} /></Field></div></Section>
    <Section title="Digital Tag Preview"><div className="rounded-lg border border-default bg-navy-800 p-3 flex items-center gap-3"><QrCode size={36} className="text-cyan" /><div><div className="font-mono text-sm text-white">{tag || 'ASSET-TAG'}</div><div className="text-xs text-slate-400">Ready for QR/label printing workflow</div></div></div></Section>
    <SubmitRow loading={mutate.isPending} label="Register lifecycle asset" onCancel={onClose} />
  </form></Modal>
}

function TransactionModal({ open, onClose, item, form, mutate }) {
  const { register, handleSubmit, watch } = form
  const type = watch('type')
  const qty = num(watch('quantity'))
  const nextStock = item ? num(item.current_stock) + (['RECEIPT', 'RETURN', 'ADJUSTMENT'].includes(type) ? qty : -qty) : 0
  return <Modal open={open} onClose={onClose} title={`Stock Movement - ${item?.name || ''}`} size="lg"><form onSubmit={handleSubmit(d => mutate.mutate({ id: item?.id, ...d }))} className="space-y-3">
    <div className="grid grid-cols-3 gap-3"><MetricBox label="Current" value={`${item?.current_stock || 0} ${item?.unit || ''}`} /><MetricBox label="Movement" value={`${qty || 0} ${item?.unit || ''}`} /><MetricBox label="Projected" value={`${nextStock} ${item?.unit || ''}`} danger={nextStock < 0} /></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Field label="Movement type"><select className="select" {...register('type')}>{txTypes.map(t => <option key={t}>{t}</option>)}</select></Field><Field label="Quantity" required><input type="number" step="0.01" min="0.01" className="input" {...register('quantity', { required: true })} /></Field><Field label="From department"><input className="input" placeholder="Central Store / ICU" {...register('from_dept')} /></Field><Field label="To department"><input className="input" placeholder="Ward / OT / Lab" {...register('to_dept')} /></Field></div>
    <Field label="Reference / reason"><input className="input" placeholder={type === 'ADJUSTMENT' ? 'Stock audit correction, damage, variance...' : 'Indent, PO, ward request, emergency issue...'} {...register('reference')} /></Field>
    <SubmitRow loading={mutate.isPending} label="Post traceable movement" onCancel={onClose} />
  </form></Modal>
}

function MaintenanceModal({ open, onClose, asset, form, mutate }) {
  const { register, handleSubmit } = form
  return <Modal open={open} onClose={onClose} title={`Maintenance Record - ${asset?.name || ''}`} size="lg"><form onSubmit={handleSubmit(d => mutate.mutate({ id: asset?.id, ...d }))} className="space-y-3">
    <div className="rounded-lg border border-default bg-navy-800 p-3"><div className="text-xs text-slate-400">Asset</div><div className="text-sm font-semibold text-white">{asset?.asset_tag} | {asset?.location || 'Unmapped'}</div></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Field label="Maintenance type" required><select className="select" {...register('type', { required: true })}>{['Preventive Maintenance','Breakdown Repair','Calibration','Safety Inspection','AMC Visit','Software Upgrade'].map(t => <option key={t}>{t}</option>)}</select></Field><Field label="Engineer / vendor"><input className="input" {...register('done_by')} /></Field><Field label="Cost"><input type="number" step="0.01" min="0" className="input" {...register('cost')} /></Field><Field label="Next due"><input type="date" className="input" {...register('next_due')} /></Field></div>
    <Field label="Work notes"><textarea className="textarea" rows={4} placeholder="Fault observed, parts replaced, calibration result, downtime..." {...register('notes')} /></Field>
    <SubmitRow loading={mutate.isPending} label="Close service event" onCancel={onClose} />
  </form></Modal>
}

function Section({ title, children }) {
  return <div className="rounded-xl border border-default bg-navy-800/60 p-3"><h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan"><SlidersHorizontal size={14} /> {title}</h3>{children}</div>
}

function Field({ label, required, children }) {
  return <div><label className="label">{label}{required ? ' *' : ''}</label>{children}</div>
}

function MetricBox({ label, value, danger }) {
  return <div className={`rounded-lg border p-3 ${danger ? 'border-brand-red bg-brand-red/10' : 'border-default bg-navy-800'}`}><div className="text-[10px] uppercase text-slate-500">{label}</div><div className={`text-sm font-semibold ${danger ? 'text-brand-red' : 'text-white'}`}>{value}</div></div>
}

function SubmitRow({ loading, label, onCancel }) {
  return <div className="flex gap-2 pt-2"><button type="submit" disabled={loading} className="btn-primary flex-1"><ClipboardCheck size={16} /> {loading ? 'Saving...' : label}</button><button type="button" className="btn flex-1" onClick={onCancel}>Cancel</button></div>
}
