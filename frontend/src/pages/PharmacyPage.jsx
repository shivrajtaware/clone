import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import {
  Activity, AlertTriangle, BadgeIndianRupee, Boxes, ClipboardCheck, CreditCard,
  Download, Eye, FileText, Filter, MapPin, PackageCheck, PackagePlus, Percent, Pill,
  Printer, ReceiptIndianRupee, RefreshCw, Search, ShieldCheck, ShoppingCart,
  Snowflake, Trash2, Truck, Undo2, Upload, Zap,
} from 'lucide-react'
import api from '../utils/api'
import Modal from '../components/common/Modal'
import StatCard, { Badge, Spinner } from '../components/common/StatCard'
import { fmt } from '../utils/helpers'
import useAuthStore from '../context/authStore'
import { DRUG_FORMS, baseQty, inferredLooseUnit, inferredPackUnit, packSize, stockText, normalizeDrugText, normalizedDrugForm } from '../utils/drugForms'
import { useEffect } from 'react'
import { io } from 'socket.io-client'


const categories = ['ANALGESIC', 'ANTIBIOTIC', 'ANTIHYPERTENSIVE', 'ANTIDIABETIC', 'DIURETIC', 'CARDIAC', 'NEUROLOGICAL', 'RESPIRATORY', 'ANTICOAGULANT', 'STEROID', 'ANTIEMETIC', 'ANTACID', 'VITAMIN', 'VACCINE', 'SURGICAL', 'CONSUMABLE', 'OTHER']
const forms = DRUG_FORMS
const gstSlabs = [0, 5, 12, 18, 28]
const paymentModes = ['CASH', 'UPI', 'CARD', 'ONLINE', 'NET_BANKING', 'CHEQUE', 'CORPORATE_CREDIT', 'INSURANCE_CASHLESS']
const money = (v) => `Rs. ${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const qty = (v) => Number.parseInt(v || 0, 10)
const numberValue = (v) => Number.isFinite(Number(v)) ? Number(v) : 0
const normalizeName = normalizeDrugText
const normalizedForm = normalizedDrugForm
const daysUntil = (date) => Math.ceil((new Date(date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
const invoiceDate = () => new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
const importHeaderAliases = {
  medicine: 'generic_name',
  'medicine name': 'generic_name',
  item: 'generic_name',
  'item name': 'generic_name',
  product: 'generic_name',
  'product name': 'generic_name',
  drug: 'generic_name',
  'drug name': 'generic_name',
  generic: 'generic_name',
  'generic name': 'generic_name',
  description: 'generic_name',
  brand: 'brand_name',
  'brand name': 'brand_name',
  'trade name': 'brand_name',
  category: 'category',
  type: 'category',
  group: 'category',
  form: 'form',
  'dosage form': 'form',
  strength: 'strength',
  composition: 'strength',
  'loose unit': 'unit',
  'base unit': 'unit',
  unit: 'unit',
  uom: 'unit',
  pack: 'pack_unit',
  'pack unit': 'pack_unit',
  packing: 'pack_unit',
  container: 'pack_unit',
  'container pack unit': 'pack_unit',
  'container unit': 'pack_unit',
  'units per pack': 'units_per_pack',
  'pack size': 'units_per_pack',
  'packing qty': 'units_per_pack',
  'strip size': 'units_per_pack',
  'units per container': 'units_per_pack',
  'prescription controlled': 'is_controlled',
  'is controlled': 'is_controlled',
  'cold chain': 'is_cold_chain',
  'is cold chain': 'is_cold_chain',
  'rack location': 'rack_location',
  batch: 'batch_no',
  'batch number': 'batch_no',
  'batch no': 'batch_no',
  lot: 'batch_no',
  'lot no': 'batch_no',
  mfg: 'mfg_date',
  'manufacturing date': 'mfg_date',
  'mfg date': 'mfg_date',
  expiry: 'expiry_date',
  exp: 'expiry_date',
  'exp date': 'expiry_date',
  'expiry date': 'expiry_date',
  qty: 'loose_quantity',
  quantity: 'loose_quantity',
  'total qty': 'loose_quantity',
  'received qty': 'loose_quantity',
  'loose qty': 'loose_quantity',
  'qty bought loose': 'loose_quantity',
  'qty bought loose units': 'loose_quantity',
  'pack quantity': 'pack_quantity',
  'pack qty': 'pack_quantity',
  'qty bought packs': 'pack_quantity',
  'qty bought pack': 'pack_quantity',
  'container quantity': 'pack_quantity',
  boxes: 'pack_quantity',
  'loose quantity': 'loose_quantity',
  mrp: 'mrp',
  'sale rate': 'selling_price',
  'selling rate': 'selling_price',
  'selling price': 'selling_price',
  'selling price required': 'selling_price',
  'customer selling price': 'selling_price',
  'customer rate': 'selling_price',
  'retail price': 'selling_price',
  'retail rate': 'selling_price',
  'customer price': 'selling_price',
  rate: 'cost_price',
  'purchase rate': 'cost_price',
  'purchase rate per pack': 'cost_price',
  'pack purchase rate': 'cost_price',
  'cost price': 'cost_price',
  cost: 'cost_price',
  ptr: 'cost_price',
  'taxable rate': 'taxable_rate',
  'taxable amount': 'taxable_rate',
  'taxable value': 'taxable_rate',
  'base rate': 'taxable_rate',
  gst: 'gst_pct',
  'gst %': 'gst_pct',
  'gst required': 'gst_pct',
  'gst rate required': 'gst_pct',
  'gst rate': 'gst_pct',
  'tax %': 'gst_pct',
  cgst: 'cgst_amt',
  'cgst amount': 'cgst_amt',
  sgst: 'sgst_amt',
  'sgst amount': 'sgst_amt',
  igst: 'igst_amt',
  'igst amount': 'igst_amt',
  'purchase total': 'purchase_total',
  'invoice total': 'purchase_total',
  supplier: 'supplier_name',
  'supplier name': 'supplier_name',
  vendor: 'supplier_name',
  'vendor name': 'supplier_name',
  'supplier phone': 'supplier_phone',
  phone: 'supplier_phone',
  'supplier gstin': 'supplier_gstin',
  gstin: 'supplier_gstin',
  'gst no': 'supplier_gstin',
  'supplier drug license': 'supplier_drug_license',
  'drug license': 'supplier_drug_license',
}
const normalizeHeader = (header) => {
  const key = String(header || '').trim().toLowerCase().replace(/_/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
  return importHeaderAliases[key] || key.replace(/\s+/g, '_')
}
const requiredImportFields = ['batch_no', 'expiry_date', 'mrp', 'selling_price', 'gst_pct']
const reviewImportFields = ['generic_name', 'brand_name', 'category', 'form', 'strength', 'pack_unit', 'units_per_pack', 'batch_no', 'mfg_date', 'expiry_date', 'pack_quantity', 'loose_quantity', 'mrp', 'selling_price', 'cost_price', 'taxable_rate', 'gst_pct', 'cgst_amt', 'sgst_amt', 'igst_amt', 'purchase_total']
const importColumnLabels = {
  generic_name: 'Medicine',
  brand_name: 'Brand',
  units_per_pack: 'Units/Pack',
  batch_no: 'Batch',
  mfg_date: 'Mfg',
  expiry_date: 'Expiry',
  pack_quantity: 'Qty Bought (Packs)',
  loose_quantity: 'Qty Bought (Loose)',
  mrp: 'MRP',
  selling_price: 'Selling Price *',
  cost_price: 'Purchase Rate/Pack',
  taxable_rate: 'Taxable Amount',
  gst_pct: 'GST %',
  cgst_amt: 'CGST',
  sgst_amt: 'SGST',
  igst_amt: 'IGST',
  purchase_total: 'Purchase Total',
}
const hasImportValue = (value) => value !== undefined && value !== null && String(value).trim() !== ''
const hasImportQty = (row) => qty(row.pack_quantity) > 0 || qty(row.loose_quantity) > 0
const headerScore = (row = []) => row.reduce((sum, cell) => {
  const key = normalizeHeader(cell)
  return sum + (['generic_name', 'batch_no', 'expiry_date', 'mrp', 'selling_price', 'cost_price', 'gst_pct', 'cgst_amt', 'sgst_amt', 'igst_amt', 'loose_quantity', 'pack_quantity', 'supplier_name'].includes(key) ? 3 : key ? 0.2 : 0)
}, 0)
const rowsToObjects = (rows) => {
  const headerIndex = rows.slice(0, 12).reduce((best, row, index) => headerScore(row) > headerScore(rows[best] || []) ? index : best, 0)
  const headers = (rows[headerIndex] || []).map(normalizeHeader)
  return rows.slice(headerIndex + 1)
    .filter(values => values.some(v => String(v).trim() !== ''))
    .map((values, index) => ({
      ...Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])),
      __row: headerIndex + index + 2,
    }))
}
const inferImportRow = (row) => {
  const text = [row.generic_name, row.brand_name, row.strength, row.form].map(v => String(v || '')).join(' ')
  const low = normalizeDrugText(text)
  const form = row.form || forms.find(f => low.includes(normalizeDrugText(f))) || 'Other'
  const unit = row.unit || inferredLooseUnit({ form, strength: row.strength })
  const packUnit = row.pack_unit || (['tablet', 'capsule'].includes(normalizedDrugForm(form)) ? 'strip' : 'pack')
  const units = row.units_per_pack || (['tablet', 'capsule'].includes(normalizedDrugForm(form)) ? 10 : 1)
  return { ...row, form, unit, pack_unit: packUnit, units_per_pack: units }
}

const parseCsv = (text) => {
  const rows = []
  let cell = ''
  let row = []
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '"' && quoted && next === '"') { cell += '"'; i += 1 }
    else if (ch === '"') quoted = !quoted
    else if (ch === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i += 1
      row.push(cell); cell = ''
      if (row.some(v => String(v).trim())) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.some(v => String(v).trim())) rows.push(row)
  return rowsToObjects(rows).map(inferImportRow)
}
const parseExcel = async (file) => {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }).filter(row => row.some(v => String(v).trim()))
  return rowsToObjects(rows).map(inferImportRow)
}

export default function PharmacyPage() {
  const [tab, setTab] = useState('dashboard')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importRows, setImportRows] = useState([])
  const [importErrors, setImportErrors] = useState([])
  const [importedColumns, setImportedColumns] = useState([])
  const [importMode, setImportMode] = useState('skip')
  const [selectedPrescription, setSelectedPrescription] = useState(null)
  const [dispenseRows, setDispenseRows] = useState([])
  const [rxPayment, setRxPayment] = useState({ payment_method: 'CASH', payment_reference: '' })
  const [selectedItem, setSelectedItem] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [reportType, setReportType] = useState('gst')
  const [walkInCustomer, setWalkInCustomer] = useState({ name: '', phone: '', gstin: '', payment_method: 'CASH', payment_reference: '', discount_pct: 0, received_amt: '' })
  const [posCart, setPosCart] = useState([])
  const qc = useQueryClient()
  const user = useAuthStore(s => s.user)

  useEffect(() => {
    const socket = io({ auth: { token: localStorage.getItem('token') } })
    socket.emit('join:pharmacy')
    socket.on('pharmacy:updated', () => {
        qc.invalidateQueries({ queryKey: ['pharmacy-dashboard'] })
        qc.invalidateQueries({ queryKey: ['pharmacy-inventory'] })
        qc.invalidateQueries({ queryKey: ['pharmacy-pos'] })
        qc.invalidateQueries({ queryKey: ['pharmacy-suppliers'] })
        })
      return () => socket.disconnect()
    }, [qc])

  const itemForm = useForm({ defaultValues: { category: 'OTHER', form: 'Other', unit: 'unit', pack_unit: 'pack', units_per_pack: 1, min_stock_level: 10, max_stock_level: 1000, reorder_quantity: 100 } })
  const batchForm = useForm()
  const adjustForm = useForm({ defaultValues: { type: 'ADJUSTMENT' } })
  const supplierForm = useForm()

  const dashboardQuery = useQuery({
    queryKey: ['pharmacy-dashboard'],
    queryFn: () => api.get('/pharmacy/dashboard').then(r => r.data.data),
    refetchInterval: 10000,
  })
  const inventoryQuery = useQuery({
    queryKey: ['pharmacy-inventory', search, statusFilter],
    queryFn: () => api.get('/pharmacy/inventory', {
      params: {
        search,
        ...(statusFilter === 'low' && { low_stock: true }),
        ...(statusFilter === 'out' && { out_stock: true }),
        ...(statusFilter === 'over' && { overstock: true }),
        ...(statusFilter === 'expiry' && { expiring: true }),
      },
    }).then(r => r.data.data),
    refetchInterval: tab === 'inventory' || tab === 'pos' ? 12000 : false,
  })
  const prescriptionsQuery = useQuery({
    queryKey: ['pharmacy-prescriptions'],
    queryFn: () => api.get('/pharmacy/prescriptions').then(r => r.data.data),
    enabled: tab === 'dispense',
    refetchInterval: 10000,
  })
  const dispenseInventoryQuery = useQuery({
    queryKey: ['pharmacy-inventory', 'dispense-all'],
    queryFn: () => api.get('/pharmacy/inventory').then(r => r.data.data),
    enabled: tab === 'dispense',
  })
  const supplierQuery = useQuery({
    queryKey: ['pharmacy-suppliers'],
    queryFn: () => api.get('/pharmacy/suppliers').then(r => r.data.data),
    enabled: ['suppliers', 'purchases'].includes(tab),
  })
  const reportsQuery = useQuery({
    queryKey: ['pharmacy-reports', reportType],
    queryFn: () => api.get('/pharmacy/reports', { params: { type: reportType } }).then(r => r.data.data),
    enabled: tab === 'reports',
    refetchInterval: tab === 'reports' ? 20000 : false,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['pharmacy-dashboard'] })
    qc.invalidateQueries({ queryKey: ['pharmacy-inventory'] })
    qc.invalidateQueries({ queryKey: ['pharmacy-pos'] })
    qc.invalidateQueries({ queryKey: ['pharmacy-suppliers'] })
  }

  const addMut = useMutation({
    mutationFn: (d) => api.post('/pharmacy/inventory', d),
    onSuccess: () => { toast.success('Medicine created'); invalidate(); setShowAddModal(false); itemForm.reset() },
  })
  const batchMut = useMutation({
    mutationFn: ({ id, ...d }) => api.post(`/pharmacy/inventory/${id}/batch`, d),
    onSuccess: () => { toast.success('Batch received'); invalidate(); setShowBatchModal(false); batchForm.reset() },
  })
  const adjustMut = useMutation({
    mutationFn: ({ id, ...d }) => api.post(`/pharmacy/inventory/${id}/adjust`, d),
    onSuccess: () => { toast.success('Stock adjusted'); invalidate(); setShowAdjustModal(false); adjustForm.reset({ type: 'ADJUSTMENT' }) },
  })
  const supplierMut = useMutation({
    mutationFn: (d) => api.post('/pharmacy/suppliers', d),
    onSuccess: () => { toast.success('Supplier added'); invalidate(); setShowSupplierModal(false); supplierForm.reset() },
  })
  const importMut = useMutation({
    mutationFn: (payload) => api.post('/pharmacy/inventory/import', payload),
    onSuccess: (res) => {
      const s = res.data.data || {}
      toast.success(`Imported ${s.rows || 0} rows, ${s.created_items || 0} new medicines, ${s.created_batches || 0} batches`)
      setShowImportModal(false)
      setImportedColumns([])
      setImportRows([])
      setImportErrors([])
      invalidate()
    },
    onError: (e) => setImportErrors(e.response?.data?.errors || [e.response?.data?.message || 'Import failed']),
  })
  const dispenseMut = useMutation({
    mutationFn: (payload) => api.post('/pharmacy/dispense', payload),
    onSuccess: (res) => {
      const sale = res.data.data
      toast.success(`Dispensed ${sale?.dispense_no}`)
      setReceipt({
        type: 'Prescription Sale',
        hospital: user?.hospital,
        patient: selectedPrescription?.patient,
        doctor: selectedPrescription?.doctor,
        invoice: sale?.invoice,
        items: sale?.allocated_items || [],
        bill: sale?.bill,
        payment_method: rxPayment.payment_method,
        payment_reference: rxPayment.payment_reference,
        cashier: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
      })
      setSelectedPrescription(null)
      setDispenseRows([])
      setRxPayment({ payment_method: 'CASH', payment_reference: '' })
      invalidate()
      qc.invalidateQueries({ queryKey: ['pharmacy-prescriptions'] })
      qc.invalidateQueries({ queryKey: ['billing'] })
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Dispense failed'),
  })
  const walkInSaleMut = useMutation({
    mutationFn: (payload) => api.post('/pharmacy/dispense', payload),
    onSuccess: (res) => {
      const sale = res.data.data
      toast.success(`Walk-in sale ${sale?.dispense_no} completed`)
      setReceipt({
        type: 'Walk-in Sale',
        hospital: user?.hospital,
        customer: { ...walkInCustomer },
        invoice: sale?.invoice,
        items: sale?.allocated_items || [],
        payment_method: walkInCustomer.payment_method,
        payment_reference: walkInCustomer.payment_reference,
        cashier: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
      })
      setPosCart([])
      setWalkInCustomer({ name: '', phone: '', gstin: '', payment_method: 'CASH', payment_reference: '', discount_pct: 0, received_amt: '' })
      invalidate()
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Walk-in sale failed'),
  })

  const dashboard = dashboardQuery.data || {}
  const stats = dashboard.stats || {}
  const items = inventoryQuery.data || []
  const prescriptions = prescriptionsQuery.data || []
  const suppliers = supplierQuery.data || []
  const pendingPrescriptions = prescriptions.filter(rx => rx.dispense_status === 'PENDING')
  const stockItemsForDispense = dispenseInventoryQuery.data || items
  const recentInvoices = dashboard.recent_invoices || []

  const statusCounts = useMemo(() => ({
    low: items.filter(i => i.is_low_stock).length,
    out: items.filter(i => i.is_out_of_stock).length,
    expiry: items.filter(i => i.expiring_soon || i.expired_stock > 0).length,
    over: items.filter(i => i.is_overstock).length,
  }), [items])
  const stockHealth = useMemo(() => {
    const total = stats.total_items || items.length || 0
    const problem = (stats.low_stock || 0) + (stats.out_of_stock || 0) + (stats.near_expiry || 0)
    return total ? Math.max(0, Math.round(((total - problem) / total) * 100)) : 100
  }, [stats, items.length])
  const liveStatus = useMemo(() => ({
    refreshing: dashboardQuery.isFetching || inventoryQuery.isFetching || prescriptionsQuery.isFetching || reportsQuery.isFetching,
    lastUpdated: invoiceDate(),
  }), [dashboardQuery.isFetching, inventoryQuery.isFetching, prescriptionsQuery.isFetching, reportsQuery.isFetching])

  const findPrescriptionStockMatch = (line) => {
    const linked = stockItemsForDispense.find(item => item.id === line.pharmacy_item_id)
    if (linked) return linked
    const lineGeneric = normalizeName(line.generic_name || line.drug_name)
    const lineDrug = normalizeName(line.drug_name)
    const lineStrength = normalizeName(line.strength)
    const lineForm = normalizedForm(line.form)
    const scored = stockItemsForDispense.map(item => {
      const generic = normalizeName(item.generic_name)
      const brand = normalizeName(item.brand_name)
      const strength = normalizeName(item.strength)
      const form = normalizedForm(item.form)
      let score = 0
      if (generic && generic === lineGeneric) score += 120
      else if (generic && lineGeneric.includes(generic)) score += 45
      else if (generic && lineDrug.includes(generic)) score += 35
      if (brand && lineDrug.includes(brand)) score += 25
      if (lineStrength && strength && strength === lineStrength) score += 60
      else if (lineStrength && strength && (lineStrength.includes(strength) || strength.includes(lineStrength))) score += 25
      if (lineForm && form && form === lineForm) score += 80
      else if (lineForm && form) score -= 50
      return { item, score }
    }).filter(row => row.score > 0)
    scored.sort((a, b) => b.score - a.score)
    return scored[0]?.item || null
  }

  const prescriptionQtyText = (line) => {
    const qty = Number.parseInt(line.quantity || 0, 10)
    if (!qty) return ''
    const match = findPrescriptionStockMatch(line)
    if (line.quantity_unit !== 'PACK') return ` x${qty} ${match ? inferredLooseUnit(match) : inferredLooseUnit(line)}`
    const packUnit = match ? inferredPackUnit(match) : 'pack'
    const looseUnit = match ? inferredLooseUnit(match) : 'units'
    const unitsPerPack = packSize(match)
    return unitsPerPack > 1 ? ` x${qty} ${packUnit} (${qty * unitsPerPack} ${looseUnit})` : ` x${qty} ${packUnit}`
  }

  const buildDispenseRows = (rx) => (rx.items || []).map(line => {
    const match = findPrescriptionStockMatch(line)
    return {
      rx_item_id: line.id,
      drug_name: line.drug_name,
      strength: line.strength,
      dose: line.dose,
      frequency: line.frequency,
      duration: line.duration,
      route: line.route,
      instructions: line.instructions,
      item_id: match?.id || '',
      quantity: Number.parseInt(line.quantity || 1, 10),
      quantity_unit: line.quantity_unit === 'PACK' ? 'PACK' : 'LOOSE',
    }
  })

  const openDispenseReview = (rx) => {
    setSelectedPrescription(rx)
    setDispenseRows(buildDispenseRows(rx))
    setRxPayment({ payment_method: 'CASH', payment_reference: '' })
  }

  const updateDispenseRow = (index, updates) => setDispenseRows(prev => prev.map((row, i) => i === index ? { ...row, ...updates } : row))
  const closeDispenseReview = () => {
    setSelectedPrescription(null)
    setDispenseRows([])
    setRxPayment({ payment_method: 'CASH', payment_reference: '' })
  }

  const dispensePrescription = () => {
    if (!selectedPrescription) return
    const missing = []
    const lowStock = []
    const lines = dispenseRows.map(row => {
      const match = stockItemsForDispense.find(item => item.id === row.item_id)
      if (!match) {
        missing.push(row.drug_name)
        return null
      }
      const quantity = Number.parseInt(row.quantity || 1, 10)
      const quantityUnit = row.quantity_unit === 'PACK' ? 'PACK' : 'LOOSE'
      const baseQuantity = baseQty(quantity, quantityUnit, match)
      if (match.current_stock < baseQuantity) {
        lowStock.push(`${match.generic_name} needs ${stockText(baseQuantity, match)}, has ${stockText(match.current_stock, match)}`)
        return null
      }
      return {
        rx_item_id: row.rx_item_id,
        item_id: match.id,
        quantity,
        quantity_unit: quantityUnit,
        dose: row.dose,
        frequency: row.frequency,
        duration: row.duration,
        route: row.route,
        instructions: row.instructions,
      }
    }).filter(Boolean)
    if (missing.length) return toast.error(`No inventory match: ${missing.join(', ')}`)
    if (lowStock.length) return toast.error(`Insufficient stock: ${lowStock.join('; ')}`)
    if (!lines.length) return toast.error('No billable medicines found for this prescription')
    if (!rxPayment.payment_method) return toast.error('Select payment mode')
    dispenseMut.mutate({
      patient_id: selectedPrescription.patient?.id,
      prescription_id: selectedPrescription.id,
      items: lines,
      payment_method: rxPayment.payment_method,
      payment_reference: rxPayment.payment_reference,
      gst: { tax_mode: 'INCLUSIVE' },
    })
  }

  const rxBillPreview = useMemo(() => {
    const rows = dispenseRows.map(row => {
      const item = stockItemsForDispense.find(i => i.id === row.item_id)
      const batch = item?.batches?.[0]
      if (!item || !batch) return null
      const quantity = baseQty(row.quantity, row.quantity_unit, item)
      const rate = Number(batch.selling_price || batch.mrp || 0) / packSize(item)
      const gross = quantity * rate
      const gstPct = Number(batch.gst_pct || 0)
      const taxable = gross / (1 + gstPct / 100)
      return { gross, tax: gross - taxable }
    }).filter(Boolean)
    return {
      subtotal: rows.reduce((sum, row) => sum + row.gross, 0),
      tax: rows.reduce((sum, row) => sum + row.tax, 0),
    }
  }, [dispenseRows, stockItemsForDispense])

  const dispenseReady = dispenseRows.length > 0 && dispenseRows.every(row => {
    const item = stockItemsForDispense.find(i => i.id === row.item_id)
    return item && item.current_stock >= baseQty(row.quantity, row.quantity_unit, item)
  })

  const addToCart = (item) => {
    const batch = (item.batches || [])[0]
    if (!batch || item.current_stock <= 0) return toast.error('No usable batch stock available')
    if (new Date(batch.expiry_date) < new Date()) return toast.error('Expired batch cannot be billed')
    setPosCart(prev => {
      const existing = prev.find(row => row.item_id === item.id && row.batch_no === batch.batch_no)
      if (existing) return prev.map(row => row === existing ? { ...row, quantity: Math.min(row.quantity + 1, item.current_stock) } : row)
      return [...prev, {
        item_id: item.id,
        name: item.generic_name,
        brand: item.brand_name,
        unit: item.unit,
        pack_unit: item.pack_unit,
        units_per_pack: item.units_per_pack,
        batch_no: batch.batch_no,
        expiry_date: batch.expiry_date,
        quantity: 1,
        quantity_unit: 'LOOSE',
        max_qty: item.current_stock,
        mrp: Number(batch.mrp || 0),
        selling_price: Number(batch.selling_price || batch.mrp || 0),
        unit_price: Number(batch.selling_price || batch.mrp || 0) / packSize(item),
        gst_pct: Number(batch.gst_pct || 0),
      }]
    })
  }

  const updateCart = (index, updates) => setPosCart(prev => prev.map((row, i) => i === index ? { ...row, ...updates } : row))
  const removeCart = (index) => setPosCart(prev => prev.filter((_, i) => i !== index))
  const cartTotals = useMemo(() => {
    const inclusive = true
    const discountPct = Number(walkInCustomer.discount_pct || 0)
    const rows = posCart.map(row => {
      const gross = baseQty(row.quantity, row.quantity_unit, row) * Number(row.unit_price || 0)
      const rate = Number(row.gst_pct || 0)
      const taxable = inclusive ? gross / (1 + rate / 100) : gross
      const tax = inclusive ? gross - taxable : gross * rate / 100
      return { ...row, gross, taxable, tax, total: inclusive ? gross : gross + tax }
    })
    const subtotal = rows.reduce((sum, row) => sum + row.gross, 0)
    const tax = rows.reduce((sum, row) => sum + row.tax, 0)
    const totalBeforeDiscount = rows.reduce((sum, row) => sum + row.total, 0)
    const discount = totalBeforeDiscount * discountPct / 100
    const payable = Math.max(0, totalBeforeDiscount - discount)
    const received = numberValue(walkInCustomer.received_amt)
    const gst = gstSlabs.map(rate => ({
      rate,
      taxable: rows.filter(row => Number(row.gst_pct || 0) === rate).reduce((sum, row) => sum + row.taxable, 0),
      tax: rows.filter(row => Number(row.gst_pct || 0) === rate).reduce((sum, row) => sum + row.tax, 0),
    })).filter(row => row.taxable || row.tax)
    return { subtotal, tax, discount, payable, received, balance: Math.max(0, payable - received), change: Math.max(0, received - payable), gst }
  }, [posCart, walkInCustomer.discount_pct, walkInCustomer.received_amt])

  const completeWalkInSale = () => {
    if (!posCart.length) return toast.error('Add medicines to the bill')
    const over = posCart.find(row => baseQty(row.quantity, row.quantity_unit, row) > row.max_qty)
    if (over) return toast.error(`${over.name} exceeds available stock (${stockText(over.max_qty, over)})`)
    const aboveMrp = posCart.find(row => Number(row.unit_price || 0) > Number(row.mrp || 0) / packSize(row))
    if (aboveMrp) return toast.error(`${aboveMrp.name} rate cannot be above MRP`)
    if (walkInCustomer.payment_method === 'CASH' && numberValue(walkInCustomer.received_amt) > 0 && numberValue(walkInCustomer.received_amt) < cartTotals.payable) {
      return toast.error('Cash received is less than payable amount')
    }
    walkInSaleMut.mutate({
      sale_type: 'WALK_IN',
      customer: { name: walkInCustomer.name, phone: walkInCustomer.phone, gstin: walkInCustomer.gstin },
      payment_method: walkInCustomer.payment_method,
      payment_reference: walkInCustomer.payment_reference,
      items: posCart.map(row => ({
        item_id: row.item_id,
        quantity: row.quantity,
        quantity_unit: row.quantity_unit,
        batch_no: row.batch_no,
        unit_price: row.unit_price,
      })),
      gst: {
        tax_mode: 'INCLUSIVE',
        discount_pct: Number(walkInCustomer.discount_pct || 0),
      },
      notes: walkInCustomer.name ? `Walk-in customer: ${walkInCustomer.name}` : 'Walk-in customer',
    })
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <PharmacyCommandHeader
        stats={stats}
        stockHealth={stockHealth}
        liveStatus={liveStatus}
        pendingPrescriptions={pendingPrescriptions.length}
        onRefresh={() => { dashboardQuery.refetch(); inventoryQuery.refetch(); prescriptionsQuery.refetch(); reportsQuery.refetch() }}
        onReports={() => setTab('reports')}
        onSupplier={() => setShowSupplierModal(true)}
        onImport={() => setShowImportModal(true)}
        onMedicine={() => setShowAddModal(true)}
      />

      {(stats.out_of_stock > 0 || stats.expired_stock > 0) && (
        <div className="alert-red"><AlertTriangle size={18} /> <span><strong>{stats.out_of_stock || 0}</strong> out of stock items and <strong>{stats.expired_stock || 0}</strong> expired units need segregation.</span></div>
      )}

      <div className="tabs overflow-x-auto">
        {[
          ['dashboard', 'Dashboard'], ['inventory', 'Inventory'], ['pos', 'Walk-in POS'], ['dispense', 'Prescription Billing'], ['purchases', 'Purchase Import'], ['reports', 'Reports'], ['suppliers', 'Suppliers'], ['audit', 'Audit'],
        ].map(([key, label]) => <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>)}
      </div>

      {tab === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <StatCard icon={<Boxes size={22} />} value={stats.total_items || 0} label="Medicine masters" color="cyan" />
            <StatCard icon={<BadgeIndianRupee size={22} />} value={money(stats.inventory_value)} label="Stock valuation" color="green" />
            <StatCard icon={<AlertTriangle size={22} />} value={stats.low_stock || 0} label="Low stock alerts" color="amber" />
            <StatCard icon={<Pill size={22} />} value={stats.near_expiry || 0} label="Near-expiry SKUs" color="red" />
            <StatCard icon={<ReceiptIndianRupee size={22} />} value={money(stats.sales_today)} label="Sales today" color="blue" />
            <StatCard icon={<Percent size={22} />} value={money(stats.gst_today)} label="GST today" color="purple" />
          </div>
          <OperationsGrid stats={stats} statusCounts={statusCounts} pendingPrescriptions={pendingPrescriptions.length} setTab={setTab} />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <AlertPanel title="Low Stock" rows={dashboard.alerts?.low_stock} badge="badge-amber" />
            <AlertPanel title="Near Expiry" rows={dashboard.alerts?.near_expiry} badge="badge-red" expiry />
            <AlertPanel title="Dead Stock Watch" rows={dashboard.dead_stock} badge="badge-gray" />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SimpleList title="Fast Moving Medicines" rows={dashboard.fast_moving || []} render={(row) => <><span>{row.name}</span><span className="text-cyan">{row.quantity} units</span></>} />
            <RecentInvoiceList rows={recentInvoices} hospital={user?.hospital} onView={setReceipt} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <AuditList rows={dashboard.audit_logs || []} />
            <PurchaseImportPrompt onImport={() => setShowImportModal(true)} />
          </div>
        </>
      )}

      {tab === 'inventory' && (
        <div className="card">
          <div className="flex flex-col lg:flex-row gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
              <input className="input pl-9" placeholder="Search generic, brand, composition, HSN, batch..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="select lg:w-56" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All stock states</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
              <option value="expiry">Near/expired</option>
              <option value="over">Overstock</option>
            </select>
          </div>
          <div className="flex gap-2 mb-3 overflow-x-auto">
            {Object.entries({ low: 'Low', out: 'Out', expiry: 'Expiry', over: 'Overstock' }).map(([key, label]) => (
              <button key={key} className={`btn text-xs ${statusFilter === key ? 'border-cyan text-cyan' : ''}`} onClick={() => setStatusFilter(statusFilter === key ? '' : key)}><Filter size={14} /> {label}: {statusCounts[key]}</button>
            ))}
          </div>
          {inventoryQuery.isLoading ? <CenterSpinner /> : <InventoryTable items={items} onAdjust={(item) => { setSelectedItem(item); setShowAdjustModal(true) }} />}
        </div>
      )}

      {tab === 'dispense' && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div><h2 className="text-sm font-semibold text-white">Prescription Billing Queue</h2><p className="text-xs text-slate-400">FEFO batch allocation with GST-inclusive invoice preview.</p></div>
            <Badge status="PENDING" label={`${pendingPrescriptions.length} pending`} />
          </div>
          {prescriptionsQuery.isLoading ? <CenterSpinner /> : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Patient</th><th>Doctor</th><th>Medicines</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
                <tbody>
                  {prescriptions.map(rx => (
                    <tr key={rx.id}>
                      <td><div className="text-xs font-medium text-white">{rx.patient?.first_name} {rx.patient?.last_name}</div><div className="text-[10px] text-slate-400">{rx.patient?.uhid} | {rx.patient?.phone || '-'}</div></td>
                      <td className="text-xs">Dr. {rx.doctor?.first_name} {rx.doctor?.last_name}</td>
                      <td><div className="flex gap-1 flex-wrap max-w-md">{(rx.items || []).slice(0, 5).map(item => <span key={item.id} className="badge-cyan">{item.drug_name} {item.strength || ''}{prescriptionQtyText(item)}</span>)}</div></td>
                      <td><Badge status={rx.dispense_status} /></td>
                      <td className="text-xs text-slate-400">{fmt.ago(rx.prescribed_at)}</td>
                      <td><div className="flex gap-1"><Link to={`/patients/${rx.patient?.id}`} className="btn text-xs px-2 py-1">View</Link><button className="btn-primary text-xs px-2 py-1" disabled={rx.dispense_status === 'DISPENSED' || dispenseMut.isPending || dispenseInventoryQuery.isLoading} onClick={() => openDispenseReview(rx)}><ReceiptIndianRupee size={14} /> Review</button></div></td>
                    </tr>
                  ))}
                  {!prescriptions.length && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No prescriptions in queue.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'pos' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
          <div className="card">
            <div className="flex flex-col lg:flex-row gap-3 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                <input className="input pl-9" placeholder="Search and add medicines to walk-in bill..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <button className="btn" onClick={() => setStatusFilter(statusFilter === 'expiry' ? '' : 'expiry')}><Filter size={14} /> Expiry watch</button>
            </div>
            {inventoryQuery.isLoading ? <CenterSpinner /> : (
              <div className="overflow-x-auto max-h-[520px]">
                <table className="tbl">
                  <thead><tr><th>Medicine</th><th>Batch / Expiry</th><th>Stock</th><th>Retail / MRP</th><th></th></tr></thead>
                  <tbody>
                    {items.map(item => {
                      const batch = item.batches?.[0]
                      const expired = batch && new Date(batch.expiry_date) < new Date()
                      return (
                        <tr key={item.id}>
                          <td><div className="font-medium text-white text-xs">{item.generic_name}</div><div className="text-[10px] text-slate-400">{item.brand_name || '-'} | {item.form} {item.strength || ''}</div></td>
                          <td className="text-xs">{batch ? `${batch.batch_no} | ${fmt.date(batch.expiry_date)}` : '-'}</td>
                          <td className={`text-xs font-bold ${item.current_stock <= 0 ? 'text-brand-red' : 'text-brand-green'}`}>{stockText(item.current_stock, item)}</td>
                          <td className="text-xs">{money(batch?.selling_price || batch?.mrp)} <span className="text-[10px] text-slate-500">/ {money(batch?.mrp)}</span></td>
                          <td><button className="btn-primary text-xs px-2 py-1" disabled={!batch || expired || item.current_stock <= 0} onClick={() => addToCart(item)}><ShoppingCart size={14} /> Add</button></td>
                        </tr>
                      )
                    })}
                    {!items.length && <tr><td colSpan={5} className="text-center py-8 text-slate-400">No medicine stock found.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div><h2 className="text-sm font-semibold text-white">Walk-in Pharmacy Bill</h2><p className="text-xs text-slate-400">For non-visiting retail customers.</p></div>
              <Badge status="POS" label={`${posCart.length} items`} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
              <input className="input" placeholder="Customer name" value={walkInCustomer.name} onChange={e => setWalkInCustomer(v => ({ ...v, name: e.target.value }))} />
              <input className="input" placeholder="Phone" value={walkInCustomer.phone} onChange={e => setWalkInCustomer(v => ({ ...v, phone: e.target.value }))} />
              <input className="input" placeholder="GSTIN optional" value={walkInCustomer.gstin} onChange={e => setWalkInCustomer(v => ({ ...v, gstin: e.target.value }))} />
              <select className="select" value={walkInCustomer.payment_method} onChange={e => setWalkInCustomer(v => ({ ...v, payment_method: e.target.value }))}>
                {['CASH','UPI','CARD','ONLINE'].map(mode => <option key={mode}>{mode}</option>)}
              </select>
              <input className="input" placeholder="Payment reference" value={walkInCustomer.payment_reference} onChange={e => setWalkInCustomer(v => ({ ...v, payment_reference: e.target.value }))} />
              <input type="number" step="0.01" className="input" placeholder="Cash received" value={walkInCustomer.received_amt} onChange={e => setWalkInCustomer(v => ({ ...v, received_amt: e.target.value }))} />
              <input type="number" step="0.01" className="input" placeholder="Discount %" value={walkInCustomer.discount_pct} onChange={e => setWalkInCustomer(v => ({ ...v, discount_pct: e.target.value }))} />
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {posCart.map((row, index) => (
                <div key={`${row.item_id}-${row.batch_no}`} className="bg-navy-800 rounded-lg p-2">
                  <div className="flex justify-between gap-2">
                    <div><div className="text-xs font-semibold text-white">{row.name}</div><div className="text-[10px] text-slate-400">{row.batch_no} | Exp {fmt.date(row.expiry_date)}</div></div>
                    <button className="btn text-xs px-2 py-1 text-brand-red" onClick={() => removeCart(index)}><Trash2 size={14} /></button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <input type="number" min="1" className="input" value={row.quantity} onChange={e => updateCart(index, { quantity: Math.max(1, Number(e.target.value || 1)) })} />
                    <select className="select" value={row.quantity_unit || 'LOOSE'} onChange={e => updateCart(index, { quantity_unit: e.target.value })}><option value="LOOSE">{inferredLooseUnit(row)}</option><option value="PACK">{inferredPackUnit(row)}</option></select>
                    <input type="number" step="0.01" max={Number(row.mrp || 0) / packSize(row)} className="input" value={row.unit_price} onChange={e => updateCart(index, { unit_price: Number(e.target.value || 0) })} />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1"><span>Qty | Unit | Retail rate | GST {row.gst_pct || 0}% from batch | MRP/unit {money(Number(row.mrp || 0) / packSize(row))}</span><span>{stockText(baseQty(row.quantity, row.quantity_unit, row), row)}</span></div>
                </div>
              ))}
              {!posCart.length && <div className="text-center py-8 text-slate-400 text-xs">Add medicines from stock to start a walk-in sale.</div>}
            </div>

            <div className="divider" />
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span>{money(cartTotals.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Tax</span><span>{money(cartTotals.tax)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Discount</span><span>{money(cartTotals.discount)}</span></div>
              {cartTotals.gst.map(row => <div key={row.rate} className="flex justify-between text-[11px]"><span className="text-slate-500">GST {row.rate}%</span><span>{money(row.tax)}</span></div>)}
              <div className="flex justify-between text-base font-semibold text-white"><span>Payable</span><span>{money(cartTotals.payable)}</span></div>
              {numberValue(walkInCustomer.received_amt) > 0 && (
                <div className="flex justify-between text-xs"><span className="text-slate-400">{cartTotals.change > 0 ? 'Change due' : 'Balance'}</span><span className={cartTotals.change > 0 ? 'text-brand-green' : 'text-brand-amber'}>{money(cartTotals.change || cartTotals.balance)}</span></div>
              )}
            </div>
            <button className="btn-primary w-full mt-3" disabled={walkInSaleMut.isPending || !posCart.length} onClick={completeWalkInSale}><ReceiptIndianRupee size={16} /> {walkInSaleMut.isPending ? 'Billing...' : 'Complete Walk-in Sale'}</button>
          </div>
        </div>
      )}

      {tab === 'purchases' && <PurchaseImportPrompt onImport={() => setShowImportModal(true)} full />}
      {tab === 'reports' && <ReportsPanel type={reportType} setType={setReportType} rows={reportsQuery.data || []} loading={reportsQuery.isLoading} stats={stats} />}
      {tab === 'suppliers' && <Suppliers rows={suppliers} loading={supplierQuery.isLoading} />}
      {tab === 'audit' && <div className="card"><AuditList rows={dashboard.audit_logs || []} /></div>}

      <MedicineModal open={showAddModal} onClose={() => setShowAddModal(false)} form={itemForm} mutate={addMut} />
      <ImportModal
        open={showImportModal}
        onClose={() => { setShowImportModal(false); setImportRows([]); setImportErrors([]); setImportedColumns([]) }}
        rows={importRows}
        errors={importErrors}
        loading={importMut.isPending}
        columns={importedColumns}
        onRows={(parsed, cols) => { setImportRows(parsed); if (cols) setImportedColumns(cols) }}
        onErrors={setImportErrors}
        importMode={importMode}
        onModeChange={setImportMode}
        onImport={() => importMut.mutate({ rows: importRows, mode: importMode })}
      />
      <BatchModal open={showBatchModal} onClose={() => setShowBatchModal(false)} item={selectedItem} form={batchForm} mutate={batchMut} />
      <AdjustModal open={showAdjustModal} onClose={() => setShowAdjustModal(false)} item={selectedItem} form={adjustForm} mutate={adjustMut} />
      <SupplierModal open={showSupplierModal} onClose={() => setShowSupplierModal(false)} form={supplierForm} mutate={supplierMut} />
      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />

      <Modal open={!!selectedPrescription} onClose={closeDispenseReview} title="Review Prescription Billing" size="xl">
        <div className="space-y-3">
          <div className="rounded-lg border border-default bg-navy-800 p-3">
            <div className="text-sm font-semibold text-white">{selectedPrescription?.patient?.first_name} {selectedPrescription?.patient?.last_name}</div>
            <div className="text-xs text-slate-400">{selectedPrescription?.patient?.uhid} | Dr. {selectedPrescription?.doctor?.first_name} {selectedPrescription?.doctor?.last_name} | {selectedPrescription ? fmt.ago(selectedPrescription.prescribed_at) : ''}</div>
          </div>

          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {dispenseRows.map((row, index) => {
              const item = stockItemsForDispense.find(i => i.id === row.item_id)
              const baseQuantity = item ? baseQty(row.quantity, row.quantity_unit, item) : 0
              const hasStock = item && item.current_stock >= baseQuantity
              return (
                <div key={row.rx_item_id || index} className="rounded-lg border border-default bg-navy-800 p-3">
                  <div className="mb-2 flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">{row.drug_name} {row.strength || ''}</div>
                      <div className="text-[11px] text-slate-400">{row.dose || '-'} | {row.frequency || '-'} | {row.duration || '-'}{row.instructions ? ` | ${row.instructions}` : ''}</div>
                    </div>
                    <span className={hasStock ? 'badge-green' : 'badge-red'}>{item ? (hasStock ? 'Ready' : 'Low stock') : 'Match needed'}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    <div className="md:col-span-6">
                      <label className="label">Inventory Medicine</label>
                      <select className="select" value={row.item_id} onChange={e => updateDispenseRow(index, { item_id: e.target.value })}>
                        <option value="">Select stock item</option>
                        {stockItemsForDispense.map(stock => <option key={stock.id} value={stock.id}>{stock.generic_name}{stock.brand_name ? ` / ${stock.brand_name}` : ''} {stock.strength || ''} | {stockText(stock.current_stock, stock)}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Qty</label>
                      <input type="number" min="1" className="input" value={row.quantity} onChange={e => updateDispenseRow(index, { quantity: Math.max(1, Number(e.target.value || 1)) })} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Unit</label>
                      <select className="select" value={row.quantity_unit} onChange={e => updateDispenseRow(index, { quantity_unit: e.target.value })}>
                        <option value="LOOSE">{item ? inferredLooseUnit(item) : 'Loose'}</option>
                        <option value="PACK">{item ? inferredPackUnit(item) : 'Pack'}</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Stock Impact</label>
                      <div className={`rounded-lg border px-3 py-2 text-xs ${hasStock ? 'border-brand-green text-brand-green' : 'border-brand-red text-brand-red'}`}>
                        {item ? `${stockText(baseQuantity, item)} of ${stockText(item.current_stock, item)}` : 'No match'}
                      </div>
                    </div>
                  </div>
                  {item && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                      <span>Pack: 1 {inferredPackUnit(item)} = {packSize(item)} {inferredLooseUnit(item)}</span>
                      <span>Total loose issue: {baseQuantity} {inferredLooseUnit(item)}</span>
                      <span>GST will come from the allocated batch.</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="rounded-lg border border-default bg-navy-800 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-white">Pharmacy payment</div>
                <div className="text-[11px] text-slate-400">Medicine bill is collected at pharmacy. OPD consultation remains in OPD billing.</div>
              </div>
              <div className="text-right text-xs">
                <div className="text-slate-400">Estimated payable</div>
                <div className="text-sm font-semibold text-white">{money(rxBillPreview.subtotal)}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="label">Payment mode</label>
                <select className="select" value={rxPayment.payment_method} onChange={e => setRxPayment(v => ({ ...v, payment_method: e.target.value }))}>
                  {paymentModes.map(mode => <option key={mode} value={mode}>{mode.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">Reference / transaction no.</label>
                <input className="input" placeholder="Optional for cash" value={rxPayment.payment_reference} onChange={e => setRxPayment(v => ({ ...v, payment_reference: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={dispenseMut.isPending || !dispenseReady} onClick={dispensePrescription}><ReceiptIndianRupee size={16} /> {dispenseMut.isPending ? 'Billing...' : 'Confirm & Bill'}</button>
            <button className="btn flex-1" disabled={dispenseMut.isPending} onClick={closeDispenseReview}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function CenterSpinner() {
  return <div className="flex justify-center py-10"><Spinner /></div>
}

function PharmacyCommandHeader({ stats, stockHealth, liveStatus, pendingPrescriptions, onRefresh, onReports, onSupplier, onImport, onMedicine }) {
  return (
    <div className="rounded-xl border border-cyan/20 bg-navy-700 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title">Pharmacy Command Center</h1>
            <span className={liveStatus.refreshing ? 'badge-cyan' : 'badge-green'}><Activity size={12} /> {liveStatus.refreshing ? 'Syncing' : 'Live'}</span>
            <span className="badge-gray">{liveStatus.lastUpdated}</span>
          </div>
          <p className="page-sub">{stats.total_items || 0} SKUs, {pendingPrescriptions} prescriptions pending, {money(stats.inventory_value)} stock value</p>
        </div>
        <div className="grid grid-cols-2 md:flex gap-2">
          <button className="btn" onClick={onRefresh}><RefreshCw size={16} /> Refresh</button>
          <button className="btn" onClick={onReports}><FileText size={16} /> Reports</button>
          <button className="btn" onClick={onSupplier}><Truck size={16} /> Supplier</button>
          <button className="btn" onClick={onImport}><Upload size={16} /> Import</button>
          <button className="btn-primary" onClick={onMedicine}><PackagePlus size={16} /> Medicine</button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_0.7fr] gap-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs"><span className="text-slate-400">Operational health</span><span className="font-semibold text-white">{stockHealth}%</span></div>
          <div className="progress"><div className={`progress-bar ${stockHealth > 80 ? 'bg-brand-green' : stockHealth > 55 ? 'bg-brand-amber' : 'bg-brand-red'}`} style={{ width: `${stockHealth}%` }} /></div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <SignalPill label="Out" value={stats.out_of_stock || 0} tone="red" />
          <SignalPill label="Expiry" value={stats.near_expiry || 0} tone="amber" />
          <SignalPill label="GST" value={money(stats.gst_today)} tone="cyan" />
        </div>
      </div>
    </div>
  )
}

function SignalPill({ label, value, tone }) {
  const toneClass = tone === 'red' ? 'border-brand-red/30 text-brand-red' : tone === 'amber' ? 'border-brand-amber/30 text-brand-amber' : 'border-cyan/30 text-cyan'
  return <div className={`rounded-lg border bg-navy-800 px-3 py-2 ${toneClass}`}><div className="text-[10px] text-slate-400">{label}</div><div className="truncate font-semibold">{value}</div></div>
}

function PurchaseImportPrompt({ onImport, full = false }) {
  return (
    <div className={full ? 'card' : 'card'}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Supplier Purchase Stock Import</h2>
          <p className="text-xs text-slate-400">Use this for every supplier invoice: new medicines, existing medicines, batches, expiry, quantity, MRP, selling price, GST, purchase total, and supplier details.</p>
        </div>
        <button className="btn-primary" onClick={onImport}><Upload size={16} /> Import Purchase Stock</button>
      </div>
      <div className="divider" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg border border-default bg-navy-800 p-3"><div className="font-semibold text-white">1. Supplier invoice</div><div className="text-slate-400">Copy/upload the purchase bill rows from Excel or CSV.</div></div>
        <div className="rounded-lg border border-default bg-navy-800 p-3"><div className="font-semibold text-white">2. Validate tax and batch</div><div className="text-slate-400">GST %, MRP, selling price, expiry, and quantity are checked before stock is saved.</div></div>
        <div className="rounded-lg border border-default bg-navy-800 p-3"><div className="font-semibold text-white">3. Stock updates</div><div className="text-slate-400">The system creates/updates medicines and adds batches in one flow.</div></div>
      </div>
    </div>
  )
}

function OperationsGrid({ stats, statusCounts, pendingPrescriptions, setTab }) {
  const actions = [
    { label: 'Walk-in POS', value: money(stats.sales_today), icon: ShoppingCart, tab: 'pos', tone: 'text-brand-green' },
    { label: 'Rx Queue', value: pendingPrescriptions, icon: ReceiptIndianRupee, tab: 'dispense', tone: 'text-cyan' },
    { label: 'Stock Alerts', value: statusCounts.low + statusCounts.out, icon: AlertTriangle, tab: 'inventory', tone: 'text-brand-amber' },
    { label: 'Purchase Import', value: 'Stock in', icon: PackageCheck, tab: 'purchases', tone: 'text-brand-blue' },
  ]
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {actions.map(({ label, value, icon: Icon, tab, tone }) => (
        <button key={label} className="card text-left transition hover:border-cyan/40" onClick={() => setTab(tab)}>
          <div className="flex items-center justify-between"><Icon className={tone} size={20} /><Eye size={15} className="text-slate-500" /></div>
          <div className="mt-3 text-lg font-semibold text-white">{value}</div>
          <div className="text-xs text-slate-400">{label}</div>
        </button>
      ))}
    </div>
  )
}

function RecentInvoiceList({ rows, hospital, onView }) {
  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><ReceiptIndianRupee size={16} /> Recent Tax Invoices</h2>
      <div className="space-y-2">
        {rows.length ? rows.slice(0, 7).map(row => (
          <button key={row.id} className="w-full text-left flex items-center justify-between gap-3 border-b border-default pb-2 text-xs last:border-b-0" onClick={() => onView({ type: row.sale_type || row.action, hospital, customer: row.customer, invoice: row.invoice, payment_method: row.payment_method, payment_reference: row.payment_reference })}>
            <span><span className="font-medium text-white">{row.dispense_no}</span><span className="ml-2 text-slate-400">{row.customer?.name || row.sale_type || 'Patient sale'}</span></span>
            <span className="text-cyan">{money(row.invoice?.payable)}</span>
          </button>
        )) : <div className="text-xs text-slate-400 py-4">No completed pharmacy bills yet.</div>}
      </div>
    </div>
  )
}

function AlertPanel({ title, rows = [], badge, expiry }) {
  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-white mb-3">{title}</h2>
      <div className="space-y-2">
        {rows.slice(0, 6).map(row => <div key={row.id} className="flex items-center justify-between gap-3 text-xs border-b border-default pb-2 last:border-b-0"><span className="text-white">{row.generic_name}</span><span className={badge}>{expiry && row.nearest_expiry ? fmt.date(row.nearest_expiry) : `${row.current_stock} ${row.unit}`}</span></div>)}
        {!rows.length && <div className="text-xs text-slate-400 py-4">No alerts.</div>}
      </div>
    </div>
  )
}

function SimpleList({ title, rows, render }) {
  return <div className="card"><h2 className="text-sm font-semibold text-white mb-3">{title}</h2><div className="space-y-2">{rows.length ? rows.map((row, i) => <div key={row.item_id || i} className="flex items-center justify-between text-xs border-b border-default pb-2 last:border-b-0">{render(row)}</div>) : <div className="text-xs text-slate-400 py-4">No data.</div>}</div></div>
}

function InventoryTable({ items, onAdjust }) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead><tr><th>Medicine</th><th>Storage</th><th>Stock</th><th>Batches</th><th>Expiry</th><th>Valuation</th><th>Margin</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td><div className="font-medium text-white text-xs">{item.generic_name}</div><div className="text-[10px] text-slate-400">{item.brand_name || '-'} | {item.form} {item.strength || ''}</div></td>
              <td className="text-xs"><div className="flex items-center gap-1"><MapPin size={13} /> {item.rack_location || 'Unmapped'}</div>{item.is_cold_chain && <div className="text-cyan flex items-center gap-1 mt-1"><Snowflake size={13} /> Cold</div>}</td>
              <td className={`text-xs font-bold ${item.is_out_of_stock || item.is_low_stock ? 'text-brand-red' : 'text-brand-green'}`}><div>{stockText(item.current_stock, item)}</div><div className="text-[10px] text-slate-500">{item.current_stock} {inferredLooseUnit(item)} total</div></td>
              <td className="text-xs">{item.active_batches || 0}</td>
              <td className="text-xs">{item.nearest_expiry ? fmt.date(item.nearest_expiry) : '-'}</td>
              <td className="text-xs">{money(item.stock_value)}</td>
              <td className="text-xs">{Number(item.profit_margin_pct || 0).toFixed(1)}%</td>
              <td>{item.is_out_of_stock ? <span className="badge-red">Out</span> : item.is_low_stock ? <span className="badge-amber">Low</span> : item.expiring_soon ? <span className="badge-red">Expiry</span> : item.is_overstock ? <span className="badge-blue">Over</span> : <span className="badge-green">OK</span>}</td>
              <td><div className="flex gap-1"><button className="btn text-xs px-2 py-1" onClick={() => onAdjust(item)}><Undo2 size={14} /> Adjust</button></div></td>
            </tr>
          ))}
          {!items.length && <tr><td colSpan={9} className="text-center py-8 text-slate-400">No medicines found.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function PurchaseOrders({ rows, loading, onCreate, onReceive }) {
  if (loading) return <div className="card"><CenterSpinner /></div>
  return <div className="card"><div className="flex items-center justify-between mb-3"><div><h2 className="text-sm font-semibold text-white">Purchase Orders</h2><p className="text-xs text-slate-400">Supplier ordering with batch receiving into stock.</p></div><button className="btn-primary" onClick={onCreate}><PackagePlus size={16} /> New PO</button></div><div className="overflow-x-auto"><table className="tbl"><thead><tr><th>PO No</th><th>Supplier</th><th>Status</th><th>Items</th><th>Total</th><th>Created</th><th>Action</th></tr></thead><tbody>{rows.map(po => <tr key={po.id}><td className="text-white text-xs">{po.po_no}</td><td className="text-xs">{po.supplier?.name}</td><td><Badge status={po.status} /></td><td className="text-xs">{po.items?.map(i => `${i.item_name} x${i.quantity}`).join(', ') || 0}</td><td className="text-xs">{money(po.total_amount)}</td><td className="text-xs text-slate-400">{fmt.ago(po.created_at)}</td><td><button className="btn text-xs px-2 py-1" disabled={po.status === 'RECEIVED'} onClick={() => onReceive(po)}><Truck size={14} /> Receive</button></td></tr>)}{!rows.length && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No purchase orders.</td></tr>}</tbody></table></div></div>
}

function ReportsPanel({ type, setType, rows, loading, stats }) {
  const reportTabs = [
    ['gst', 'GST Register'],
    ['invoices', 'Invoices'],
    ['expiry', 'Expiry'],
    ['valuation', 'Valuation'],
    ['movement', 'Movement'],
  ]
  const dataRows = Array.isArray(rows) ? rows : rows?.rows || []
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<ReceiptIndianRupee size={22} />} value={money(stats.sales_today)} label="Sales today" color="green" />
        <StatCard icon={<BadgeIndianRupee size={22} />} value={money(stats.gst_today)} label="GST today" color="cyan" />
        <StatCard icon={<Pill size={22} />} value={stats.near_expiry || 0} label="Near expiry" color="red" />
        <StatCard icon={<Boxes size={22} />} value={money(stats.inventory_value)} label="Stock value" color="blue" />
      </div>
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
          <div><h2 className="text-sm font-semibold text-white">Pharmacy Reports</h2><p className="text-xs text-slate-400">Tax, sales, expiry, valuation, and stock movement views.</p></div>
          <div className="flex gap-2 overflow-x-auto">{reportTabs.map(([key, label]) => <button key={key} className={`btn text-xs ${type === key ? 'border-cyan text-cyan' : ''}`} onClick={() => setType(key)}><FileText size={14} /> {label}</button>)}</div>
        </div>
        {loading ? <CenterSpinner /> : <ReportTable type={type} rows={dataRows} />}
      </div>
    </div>
  )
}

function ReportTable({ type, rows }) {
  if (type === 'valuation' && !Array.isArray(rows)) rows = rows?.rows || []
  if (type === 'gst') return <CompactTable headers={['Invoice', 'GST', 'Taxable', 'Tax', 'Payable', 'When']} rows={rows.map(r => [r.invoice_no, `${r.gst_pct}%`, money(r.taxable_value), money(r.tax), money(r.payable), fmt.ago(r.created_at)])} empty="No GST sales captured yet." />
  if (type === 'invoices') return <CompactTable headers={['Invoice', 'Type', 'Customer', 'Tax', 'Payable', 'When']} rows={rows.map(r => [r.dispense_no, r.sale_type, r.customer?.name || r.patient_id || '-', money(r.invoice?.tax_total), money(r.invoice?.payable), fmt.ago(r.created_at)])} empty="No invoices captured yet." />
  if (type === 'expiry') return <CompactTable headers={['Medicine', 'Batch', 'Qty', 'Expiry', 'Days', 'Value']} rows={rows.map(r => [r.medicine, r.batch_no, r.quantity_rem, fmt.date(r.expiry_date), r.days_to_expiry, money(r.value)])} empty="No expiry rows." />
  if (type === 'movement') return <CompactTable headers={['Action', 'Record', 'When']} rows={rows.map(r => [r.action?.replace(/_/g, ' '), r.record_id || '-', fmt.ago(r.created_at)])} empty="No stock movement yet." />
  return <CompactTable headers={['Medicine', 'Value', 'Margin']} rows={rows.map(r => [r.medicine, money(r.value), `${Number(r.margin || 0).toFixed(1)}%`])} empty="No valuation rows." />
}

function CompactTable({ headers, rows, empty }) {
  return <div className="overflow-x-auto"><table className="tbl"><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="text-xs">{cell}</td>)}</tr>)}{!rows.length && <tr><td colSpan={headers.length} className="text-center py-8 text-slate-400">{empty}</td></tr>}</tbody></table></div>
}

function Suppliers({ rows, loading }) {
  if (loading) return <div className="card"><CenterSpinner /></div>
  return <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">{rows.map(s => <div key={s.id} className="card"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">{s.name}</h3><p className="text-xs text-slate-400">{s.phone || s.email || 'No contact'}</p></div><Badge status={s.is_active ? 'ACTIVE' : 'INACTIVE'} /></div><div className="divider" /><div className="grid grid-cols-2 gap-2 text-xs"><span className="text-slate-400">GSTIN</span><span>{s.gstin || '-'}</span><span className="text-slate-400">Drug license</span><span>{s.drug_license || '-'}</span></div></div>)}{!rows.length && <div className="card text-xs text-slate-400">No suppliers added.</div>}</div>
}

function AuditList({ rows }) {
  return <div><h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><ShieldCheck size={16} /> Audit Trail</h2><div className="space-y-2">{rows.length ? rows.map(log => <div key={log.id} className="flex items-start justify-between gap-3 text-xs border-b border-default pb-2 last:border-b-0"><div><div className="text-white">{log.action?.replace(/_/g, ' ')}</div><div className="text-slate-400">{log.user ? `${log.user.first_name} ${log.user.last_name}` : 'System'} | {log.record_id || '-'}</div></div><span className="text-slate-500 whitespace-nowrap">{fmt.ago(log.created_at)}</span></div>) : <div className="text-xs text-slate-400 py-4">No audit events.</div>}</div></div>
}

function MedicineModal({ open, onClose, form, mutate }) {
  const { register, handleSubmit } = form
  return <Modal open={open} onClose={onClose} title="Medicine Master" size="xl"><form onSubmit={handleSubmit(d => mutate.mutate(d))} className="space-y-3"><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><Field label="Medicine / item name" required><input className="input" {...register('generic_name', { required: true })} /></Field><Field label="Brand name"><input className="input" {...register('brand_name')} /></Field><Field label="Strength"><input className="input" placeholder="500mg / 100IU/ml / 0.9% 500ml" {...register('strength')} /></Field></div><div className="grid grid-cols-1 md:grid-cols-4 gap-3"><Field label="Form"><input className="input" list="drug-form-options" placeholder="Tablet / Syrup / any" {...register('form')} /><datalist id="drug-form-options">{forms.map(f => <option key={f} value={f} />)}</datalist></Field><Field label="Category"><select className="select" {...register('category')}>{categories.map(c => <option key={c}>{c}</option>)}</select></Field><Field label="Base unit" required><input className="input" placeholder="tablet / ml / vial / bottle / dose / pair" {...register('unit', { required: true })} /></Field><Field label="Pack / issue unit"><input className="input" placeholder="strip / bottle / vial / ampoule / box / case" {...register('pack_unit')} /></Field></div><div className="grid grid-cols-1 md:grid-cols-4 gap-3"><Field label="Units per pack"><input type="number" min="1" className="input" {...register('units_per_pack')} /></Field><Field label="Rack / shelf"><input className="input" placeholder="A-02 / Cold-1" {...register('rack_location')} /></Field><Field label="Min stock"><input type="number" className="input" {...register('min_stock_level')} /></Field><Field label="Max stock"><input type="number" className="input" {...register('max_stock_level')} /></Field></div><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><Field label="Reorder qty"><input type="number" className="input" {...register('reorder_quantity')} /></Field></div><div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" {...register('is_controlled')} /> Prescription controlled</label><label className="flex items-center gap-2"><input type="checkbox" {...register('is_cold_chain')} /> Cold storage</label></div><SubmitRow loading={mutate.isPending} label="Save medicine" onCancel={onClose} /></form></Modal>
}

function ImportModal({ open, onClose, rows, errors, loading, onRows, onErrors, onImport, columns = [], importMode = 'skip', onModeChange }) {
  const [pasteText, setPasteText] = useState('')
  const [defaults, setDefaults] = useState({ form: 'Other', pack_unit: 'pack', units_per_pack: 1, expiry_date: '', gst_pct: '' })
  const detectedCols = columns.length ? Array.from(new Set([...columns, ...reviewImportFields.filter(c => rows.some(r => r[c]))])) : reviewImportFields
  const missingRows = rows.filter(row => (!hasImportValue(row.generic_name) && !hasImportValue(row.brand_name)) || requiredImportFields.some(f => !hasImportValue(row[f])) || !hasImportQty(row))
  const priceRows = rows.filter(row => Number(row.selling_price || row.mrp || 0) > Number(row.mrp || 0))
  const fixDate = (val) => {
    if (!val) return val
    if (typeof val === 'number' && val > 20000) {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000))
      return date.toISOString().slice(0, 10)
    }
    const match = String(val).match(/^(\d{2})-(\d{2})-(\d{4})$/)
    if (match) return `${match[3]}-${match[2]}-${match[1]}`
    return val
  }
  const loadParsed = (parsed) => {
    const detected = Array.from(new Set(parsed.flatMap(row => Object.keys(row).filter(k => k !== '__row'))))
    if (!detected.length) return onErrors(['No valid columns found in the data'])
    onRows(parsed.map(row => inferImportRow({ ...row, expiry_date: fixDate(row.expiry_date), mfg_date: fixDate(row.mfg_date) })), detected)
  }
  const updateCell = (rowNo, key, value) => onRows(rows.map(row => row.__row === rowNo ? inferImportRow({ ...row, [key]: value }) : row), detectedCols)
  const applyDefaults = () => onRows(rows.map(row => inferImportRow({
    ...row,
    form: row.form || defaults.form,
    pack_unit: row.pack_unit || defaults.pack_unit,
    units_per_pack: row.units_per_pack || defaults.units_per_pack,
    expiry_date: row.expiry_date || defaults.expiry_date,
    gst_pct: hasImportValue(row.gst_pct) ? row.gst_pct : defaults.gst_pct,
  })), detectedCols)
  const handleFile = async (file) => {
    onErrors([])
    onRows([])
    if (!file) return
    if (!/\.(csv|txt|xls|xlsx)$/i.test(file.name)) return onErrors(['Upload a supplier purchase sheet as Excel or CSV.'])
    const parsed = /\.(xls|xlsx)$/i.test(file.name) ? await parseExcel(file) : parseCsv(await file.text())
    loadParsed(parsed)
  }
  /*
  const detected = Object.keys(parsed[0] || {}).filter(k => k !== '__row')
  if (!detected.length) return onErrors(['No valid columns found in the file'])

  // Convert DD-MM-YYYY → YYYY-MM-DD for date fields
  const fixDate = (val) => {
    if (!val) return val
    if (typeof val === 'number' && val > 20000) {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000))
      return date.toISOString().slice(0, 10)
    }
    const match = String(val).match(/^(\d{2})-(\d{2})-(\d{4})$/)
    if (match) return `${match[3]}-${match[2]}-${match[1]}`
    return val
  }
  const normalizedRows = parsed.map(row => ({
    ...row,
    expiry_date: fixDate(row.expiry_date),
    mfg_date: fixDate(row.mfg_date),
  }))

  onRows(normalizedRows, detected)
}
  */
  const handlePaste = () => {
    onErrors([])
    const text = pasteText.includes('\t') ? pasteText.replace(/\t/g, ',') : pasteText
    loadParsed(parseCsv(text))
  }
  return (
    <Modal open={open} onClose={onClose} title="Import Supplier Purchase Stock" size="xl">
      <div className="space-y-4">
        <div className="alert-amber text-xs">Enter GST % for every purchase batch from the supplier invoice. Use 0 only for GST-exempt products; sale invoices use this saved batch GST automatically.</div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <label className="rounded-lg border border-dashed border-default bg-white/70 p-4 text-center cursor-pointer">
            <Upload className="mx-auto mb-2 text-cyan" size={24} />
            <div className="text-sm font-semibold text-white">Choose supplier Excel / CSV file</div>
            <div className="text-xs text-slate-400">Product, Item, Batch, Qty, Exp, PTR, Rate, MRP, Vendor are accepted.</div>
            <input type="file" accept=".csv,.txt,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
          </label>
          <div className="grid gap-2">
            <a className="btn h-full" href="/templates/pharmacy_import_template.xlsx" download><Download size={16} /> Excel Template</a>
            <a className="btn h-full" href="/templates/pharmacy_import_template.csv" download><Download size={16} /> CSV Template</a>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <SignalPill label="Rows ready" value={rows.length} tone="cyan" />
          <SignalPill label="Detected cols" value={detectedCols.length} tone="cyan" />
          <SignalPill label="Need fix" value={missingRows.length} tone={missingRows.length ? 'red' : 'cyan'} />
          <SignalPill label="Mode" value={importMode === 'skip' ? 'Skip dupes' : importMode === 'replace-batch' ? 'Replace' : 'Strict'} tone={importMode === 'append' ? 'red' : 'cyan'} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-3">
          <div>
            <label className="label">Paste supplier table</label>
            <textarea className="textarea" rows={4} value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder="Paste copied Excel rows here for bulk stock without uploading a file" />
            <button className="btn mt-2" disabled={!pasteText.trim()} onClick={handlePaste}><ClipboardCheck size={16} /> Detect pasted stock</button>
          </div>
          <div className="rounded-lg border border-default p-3">
            <div className="text-xs font-semibold text-white mb-2">Fill missing defaults</div>
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Expiry YYYY-MM-DD" value={defaults.expiry_date} onChange={e => setDefaults({ ...defaults, expiry_date: e.target.value })} />
              <input className="input" placeholder="Pack unit" value={defaults.pack_unit} onChange={e => setDefaults({ ...defaults, pack_unit: e.target.value })} />
              <input className="input" placeholder="Form" value={defaults.form} onChange={e => setDefaults({ ...defaults, form: e.target.value })} />
              <input className="input" type="number" min="1" placeholder="Units/pack" value={defaults.units_per_pack} onChange={e => setDefaults({ ...defaults, units_per_pack: e.target.value })} />
              <select className="select" value={defaults.gst_pct} onChange={e => setDefaults({ ...defaults, gst_pct: e.target.value })}>
                <option value="">GST % default</option>
                {gstSlabs.map(rate => <option key={rate} value={rate}>{rate}% GST</option>)}
              </select>
            </div>
            <button className="btn mt-2 w-full" disabled={!rows.length} onClick={applyDefaults}><Zap size={16} /> Apply to blank cells</button>
          </div>
        </div>
        {!!errors.length && <div className="alert-red max-h-44 overflow-auto text-xs"><div>{errors.slice(0, 30).map((e, i) => <div key={i}>{e}</div>)}</div></div>}
        {!!missingRows.length && <div className="alert-red text-xs">Fix highlighted rows: Medicine or Brand, batch, expiry, MRP, selling price, GST %, and either Qty Bought (Packs) or Qty Bought (Loose) are required.</div>}
        {!!priceRows.length && <div className="alert-red text-xs">Selling price cannot be greater than MRP. Fix rows: {priceRows.slice(0, 8).map(r => r.__row).join(', ')}</div>}
        {!!rows.length && (
          <div className="overflow-x-auto max-h-96">
          <table className="tbl">
            <thead><tr><th>Row</th>{detectedCols.map(col => <th key={col}>{importColumnLabels[col] || col.replace(/_/g, ' ')}</th>)}</tr></thead>
            <tbody>{rows.slice(0, 50).map(row => <tr key={row.__row}><td>{row.__row}</td>{detectedCols.map(col => {
              const missingRequired = (requiredImportFields.includes(col) && !hasImportValue(row[col])) || (['generic_name', 'brand_name'].includes(col) && !hasImportValue(row.generic_name) && !hasImportValue(row.brand_name))
              const missingQty = ['pack_quantity', 'loose_quantity'].includes(col) && !hasImportQty(row)
              return <td key={col}><input className={`input min-w-28 text-xs ${(missingRequired || missingQty) ? 'border-brand-red/60' : ''}`} value={row[col] ?? ''} onChange={e => updateCell(row.__row, col, e.target.value)} /></td>
            })}</tr>)}</tbody>
          </table>
          </div>
        )}
        {false && (
          <div className="overflow-x-auto max-h-96">
          <table className="tbl">
            <thead>
              <tr>
                <th>Row</th>
                {detectedCols.map(col => (
                  <th key={col}>
                    {importColumnLabels[col] || col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
            {rows.slice(0, 20).map(row => (
              <tr key={row.__row}>
                <td>{row.__row}</td>
                {detectedCols.map(col => (
                  <td key={col} className="text-xs">{row[col] || '—'}</td>
                ))}
              </tr>
            ))}
            </tbody>
          </table> 
          </div>
        )}
        <div className="flex gap-2">
          <select className="select" value={importMode} onChange={e => onModeChange(e.target.value)}>
            <option value="skip">Skip duplicates — import new batches only</option>
            <option value="replace-batch">Replace — update existing batches with new qty/MRP</option>
            <option value="append">Strict — fail entire import if any batch exists</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={!rows.length || missingRows.length || priceRows.length || loading} onClick={onImport}><Upload size={16} /> {loading ? 'Importing...' : `Confirm Import ${rows.length || ''} Rows`}</button>
          <button className="btn flex-1" disabled={loading} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  )
}

function BatchModal({ open, onClose, item, form, mutate }) {
  const { register, handleSubmit } = form
  return <Modal open={open} onClose={onClose} title={`Receive Batch - ${item?.generic_name || ''}`} size="lg"><form onSubmit={handleSubmit(d => mutate.mutate({ id: item?.id, ...d }))} className="space-y-3"><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><Field label="Batch no" required><input className="input" {...register('batch_no', { required: true })} /></Field><Field label="Mfg date"><input type="date" className="input" {...register('mfg_date')} /></Field><Field label="Expiry date" required><input type="date" className="input" {...register('expiry_date', { required: true })} /></Field></div><div className="grid grid-cols-1 md:grid-cols-5 gap-3"><Field label={`${item?.pack_unit || 'Packs'} received`}><input type="number" min="0" className="input" {...register('pack_quantity')} /></Field><Field label={`${item?.unit || 'Base units'} received`}><input type="number" min="0" className="input" {...register('loose_quantity')} /></Field><Field label="Purchase rate/pack"><input type="number" step="0.01" className="input" {...register('cost_price')} /></Field><Field label="MRP" required><input type="number" step="0.01" className="input" {...register('mrp', { required: true })} /></Field><Field label="Selling price"><input type="number" step="0.01" className="input" {...register('selling_price')} /></Field></div><div className="grid grid-cols-1 md:grid-cols-6 gap-3"><Field label="Taxable amount"><input type="number" step="0.01" className="input" {...register('taxable_rate')} /></Field><Field label="GST %" required><select className="select" {...register('gst_pct', { required: true })}><option value="">Select GST</option>{gstSlabs.map(rate => <option key={rate} value={rate}>{rate}%</option>)}</select></Field><Field label="CGST"><input type="number" step="0.01" className="input" {...register('cgst_amt')} /></Field><Field label="SGST"><input type="number" step="0.01" className="input" {...register('sgst_amt')} /></Field><Field label="IGST"><input type="number" step="0.01" className="input" {...register('igst_amt')} /></Field><Field label="Purchase total"><input type="number" step="0.01" className="input" {...register('purchase_total')} /></Field></div><div className="text-xs text-slate-400">GST % is mandatory from the supplier invoice. Enter 0 only for GST-exempt products.</div><Field label="Supplier"><input className="input" {...register('supplier')} /></Field><SubmitRow loading={mutate.isPending} label="Receive stock" onCancel={onClose} /></form></Modal>
}

function AdjustModal({ open, onClose, item, form, mutate }) {
  const { register, handleSubmit } = form
  return <Modal open={open} onClose={onClose} title={`Stock Adjustment - ${item?.generic_name || ''}`}><form onSubmit={handleSubmit(d => mutate.mutate({ id: item?.id, ...d }))} className="space-y-3"><div className="grid grid-cols-2 gap-3"><Field label="Type"><select className="select" {...register('type')}><option>ADJUSTMENT</option><option>DAMAGE</option><option>EXPIRED</option><option>RETURN</option><option>RECEIPT</option><option>RECONCILIATION_PLUS</option></select></Field><Field label="Quantity"><input type="number" className="input" {...register('quantity', { required: true })} /></Field></div><Field label="Batch no"><input className="input" {...register('batch_no')} /></Field><Field label="Reason"><textarea className="textarea" rows={3} {...register('reason')} /></Field><SubmitRow loading={mutate.isPending} label="Apply adjustment" onCancel={onClose} /></form></Modal>
}

function SupplierModal({ open, onClose, form, mutate }) {
  const { register, handleSubmit } = form
  return <Modal open={open} onClose={onClose} title="Supplier Master" size="lg"><form onSubmit={handleSubmit(d => mutate.mutate(d))} className="space-y-3"><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Field label="Name"><input className="input" {...register('name', { required: true })} /></Field><Field label="Contact person"><input className="input" {...register('contact')} /></Field><Field label="Phone"><input className="input" {...register('phone')} /></Field><Field label="Email"><input className="input" {...register('email')} /></Field><Field label="GSTIN"><input className="input" {...register('gstin')} /></Field><Field label="Drug license"><input className="input" {...register('drug_license')} /></Field></div><Field label="Address"><textarea className="textarea" rows={3} {...register('address')} /></Field><SubmitRow loading={mutate.isPending} label="Save supplier" onCancel={onClose} /></form></Modal>
}

function PurchaseOrderModal({ open, onClose, form, mutate, suppliers, items }) {
  const { register, handleSubmit, setValue } = form
  return <Modal open={open} onClose={onClose} title="Create Purchase Order" size="lg"><form onSubmit={handleSubmit(d => mutate.mutate(d))} className="space-y-3"><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Field label="Supplier" required><select className="select" {...register('supplier_id', { required: true })}><option value="">Select supplier</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Status"><select className="select" {...register('status')}><option>ORDERED</option><option>DRAFT</option><option>APPROVED</option></select></Field></div><Field label="Medicine"><select className="select" onChange={e => setValue('item_name', e.target.value)}><option value="">Pick from inventory</option>{items.map(i => <option key={i.id} value={`${i.generic_name}${i.strength ? ` ${i.strength}` : ''}`}>{i.generic_name} {i.strength || ''}</option>)}</select></Field><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><Field label="Item name" required><input className="input" {...register('item_name', { required: true })} /></Field><Field label="Qty" required><input type="number" min="1" className="input" {...register('quantity', { required: true })} /></Field><Field label="Purchase rate"><input type="number" step="0.01" className="input" {...register('unit_price')} /></Field></div><Field label="Notes"><textarea className="textarea" rows={3} {...register('notes')} /></Field><SubmitRow loading={mutate.isPending} label="Create PO" onCancel={onClose} /></form></Modal>
}

function ReceivePOModal({ open, onClose, form, mutate, po, items }) {
  const { register, handleSubmit, watch } = form
  const item = items.find(i => i.id === watch('item_id'))
  return <Modal open={open} onClose={onClose} title={`Receive ${po?.po_no || 'PO'}`} size="lg"><form onSubmit={handleSubmit(d => mutate.mutate(d))} className="space-y-3"><Field label="Inventory medicine" required><select className="select" {...register('item_id', { required: true })}><option value="">Select stock item</option>{items.map(i => <option key={i.id} value={i.id}>{i.generic_name} {i.strength || ''} | {stockText(i.current_stock, i)}</option>)}</select></Field><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><Field label="Batch no" required><input className="input" {...register('batch_no', { required: true })} /></Field><Field label="Mfg date"><input type="date" className="input" {...register('mfg_date')} /></Field><Field label="Expiry date" required><input type="date" className="input" {...register('expiry_date', { required: true })} /></Field></div><div className="grid grid-cols-1 md:grid-cols-5 gap-3"><Field label={`${item?.pack_unit || 'Packs'} received`}><input type="number" min="0" className="input" {...register('pack_quantity')} /></Field><Field label={`${item?.unit || 'Base units'} received`}><input type="number" min="0" className="input" {...register('loose_quantity')} /></Field><Field label="Purchase rate/pack"><input type="number" step="0.01" className="input" {...register('cost_price')} /></Field><Field label="MRP" required><input type="number" step="0.01" className="input" {...register('mrp', { required: true })} /></Field><Field label="Selling price"><input type="number" step="0.01" className="input" {...register('selling_price')} /></Field></div><div className="grid grid-cols-1 md:grid-cols-6 gap-3"><Field label="Taxable amount"><input type="number" step="0.01" className="input" {...register('taxable_rate')} /></Field><Field label="GST %" required><select className="select" {...register('gst_pct', { required: true })}><option value="">Select GST</option>{gstSlabs.map(rate => <option key={rate} value={rate}>{rate}%</option>)}</select></Field><Field label="CGST"><input type="number" step="0.01" className="input" {...register('cgst_amt')} /></Field><Field label="SGST"><input type="number" step="0.01" className="input" {...register('sgst_amt')} /></Field><Field label="IGST"><input type="number" step="0.01" className="input" {...register('igst_amt')} /></Field><Field label="Purchase total"><input type="number" step="0.01" className="input" {...register('purchase_total')} /></Field></div><div className="text-xs text-slate-400">GST % is mandatory from the supplier invoice. Enter 0 only for GST-exempt products.</div><SubmitRow loading={mutate.isPending} label="Receive PO" onCancel={onClose} /></form></Modal>
}

const invoiceQty = (row) => Number(row.quantity || 0)
const invoiceLineTotal = (row) => Number(row.line_total ?? (invoiceQty(row) * Number(row.unit_price || 0)))
const invoiceMrpTotal = (row) => Number(row.mrp_total ?? (invoiceQty(row) * Number(row.mrp_per_unit ?? row.unit_price ?? 0)))
const invoiceDiscount = (row) => Number(row.discount ?? Math.max(0, invoiceMrpTotal(row) - invoiceLineTotal(row)))
const invoiceSalePrice = (row) => Number(row.sale_price ?? invoiceLineTotal(row))

function buildInvoiceHtml(receipt) {
  const invoice = receipt.invoice || {}
  const hospital = receipt.hospital || {}
  const customerName = receipt.patient ? `${receipt.patient.first_name} ${receipt.patient.last_name}` : receipt.customer?.name || 'Walk-in customer'
  const customerMeta = receipt.patient?.uhid || receipt.customer?.phone || '-'
  const rows = invoice.items || receipt.items || []
  const address = [hospital.address, hospital.city, hospital.state, hospital.pincode].filter(Boolean).join(', ')
  const itemRows = rows.map((i, index) => {
    const cgstRate = Number(i.gst_pct || 0) / 2
    const sgstRate = Number(i.gst_pct || 0) / 2
    return `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(i.item_name || i.name || i.item_id)}</strong><div class="muted">Batch: ${escapeHtml(i.batch_no || '-')} | Qty: ${escapeHtml(i.quantity || 0)}</div><div class="muted">${escapeHtml([i.dose, i.frequency, i.duration, i.route].filter(Boolean).join(' | ') || 'Directions: -')}${i.instructions ? `<br>${escapeHtml(i.instructions)}` : ''}</div><div class="muted">Exp: ${escapeHtml(i.expiry_date ? new Date(i.expiry_date).toLocaleDateString('en-IN') : '-')}</div></td>
        <td class="num">${escapeHtml(money(invoiceMrpTotal(i)))}</td>
        <td class="num">${escapeHtml(money(invoiceDiscount(i)))}</td>
        <td class="num">${escapeHtml(money(invoiceSalePrice(i)))}</td>
        <td class="num">${escapeHtml(money(i.taxable_value || 0))}</td>
        <td class="num">${escapeHtml(money(i.cgst || 0))}<div class="muted">${escapeHtml(cgstRate)}%</div></td>
        <td class="num">${escapeHtml(money(i.sgst || 0))}<div class="muted">${escapeHtml(sgstRate)}%</div></td>
        <td class="num">${escapeHtml(money(invoiceLineTotal(i)))}</td>
      </tr>
    `
  }).join('')
  const gstRows = (invoice.gst_summary || []).map(g => `
    <tr><td>${escapeHtml(g.gst_pct)}%</td><td class="num">${escapeHtml(money(g.taxable_value))}</td><td class="num">${escapeHtml(money(g.tax))}</td></tr>
  `).join('')
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice.invoice_no || 'Pharmacy Invoice')}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 12px; margin: 0; }
    .header { border-bottom: 2px solid #111827; display: flex; justify-content: space-between; gap: 24px; padding-bottom: 12px; }
    .brand { font-size: 20px; font-weight: 800; letter-spacing: 0; }
    .muted { color: #4b5563; font-size: 11px; line-height: 1.45; }
    .title { border: 1px solid #111827; font-size: 13px; font-weight: 800; margin: 14px 0; padding: 7px; text-align: center; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .box { border: 1px solid #d1d5db; min-height: 82px; padding: 8px; }
    .box h3 { font-size: 11px; margin: 0 0 6px; text-transform: uppercase; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d1d5db; padding: 6px; vertical-align: top; }
    th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; }
    .num { text-align: right; white-space: nowrap; }
    .totals { display: grid; grid-template-columns: 1fr 260px; gap: 16px; margin-top: 12px; }
    .summary td { border-color: #e5e7eb; }
    .payable { font-size: 16px; font-weight: 800; }
    .footer { border-top: 1px solid #d1d5db; display: flex; justify-content: space-between; margin-top: 18px; padding-top: 10px; }
    .sign { margin-top: 36px; text-align: right; }
    @media print { .no-print { display: none; } body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${escapeHtml(hospital.name || 'Hospital Pharmacy')}</div>
      <div class="muted">${escapeHtml(address || 'Pharmacy counter')}</div>
      <div class="muted">Phone: ${escapeHtml(hospital.phone || '-')} | GSTIN: ${escapeHtml(hospital.gstin || '-')}</div>
    </div>
    <div class="num">
      <div><strong>Invoice:</strong> ${escapeHtml(invoice.invoice_no || '-')}</div>
      <div><strong>Date:</strong> ${escapeHtml(invoiceDate())}</div>
      <div><strong>Payment:</strong> ${escapeHtml(receipt.payment_method || '-')}</div>
      <div><strong>Reference:</strong> ${escapeHtml(receipt.payment_reference || '-')}</div>
    </div>
  </div>
  <div class="title">Pharmacy Tax Invoice</div>
  <div class="grid">
    <div class="box"><h3>Bill To</h3><strong>${escapeHtml(customerName)}</strong><div class="muted">${escapeHtml(customerMeta)}</div><div class="muted">GSTIN: ${escapeHtml(receipt.customer?.gstin || '-')}</div></div>
    <div class="box"><h3>Sale Details</h3><div>Type: ${escapeHtml(receipt.type || 'Pharmacy Sale')}</div><div>Tax mode: ${escapeHtml(invoice.tax_mode || 'INCLUSIVE')}</div><div>Cashier: ${escapeHtml(receipt.cashier || '-')}</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Item Description</th><th>MRP</th><th>Disc.</th><th>Sale Price</th><th>Taxable Value</th><th>CGST</th><th>SGST</th><th>Total Amount</th></tr></thead>
    <tbody>${itemRows || '<tr><td colspan="9" class="muted">No items</td></tr>'}</tbody>
  </table>
  <div class="totals">
    <div>
      <strong>GST Summary</strong>
      <table class="summary"><thead><tr><th>Rate</th><th>Taxable</th><th>Tax</th></tr></thead><tbody>${gstRows || '<tr><td colspan="3" class="muted">No tax rows</td></tr>'}</tbody></table>
    </div>
    <table class="summary">
      <tbody>
        <tr><td>Subtotal</td><td class="num">${escapeHtml(money(invoice.subtotal))}</td></tr>
        <tr><td>Taxable value</td><td class="num">${escapeHtml(money(invoice.taxable_value))}</td></tr>
        <tr><td>CGST</td><td class="num">${escapeHtml(money(invoice.cgst_total))}</td></tr>
        <tr><td>SGST</td><td class="num">${escapeHtml(money(invoice.sgst_total))}</td></tr>
        <tr><td>IGST</td><td class="num">${escapeHtml(money(invoice.igst_total))}</td></tr>
        <tr><td>Discount</td><td class="num">${escapeHtml(money(invoice.discount))}</td></tr>
        <tr><td class="payable">Payable</td><td class="num payable">${escapeHtml(money(invoice.payable))}</td></tr>
      </tbody>
    </table>
  </div>
  <div class="footer"><div class="muted">Goods once sold are returnable only as per hospital pharmacy policy. Verify batch and expiry before use.</div><div class="sign">Authorized pharmacist</div></div>
</body>
</html>`
}

function ReceiptModal({ receipt, onClose }) {
  if (!receipt) return null
  const invoice = receipt.invoice || {}
  const print = () => {
    const win = window.open('', '_blank', 'width=900,height=1000')
    if (!win) return
    win.document.open()
    win.document.write(buildInvoiceHtml(receipt))
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 100)
  }
  const rows = invoice.items || receipt.items || []
  return (
    <Modal open={!!receipt} onClose={onClose} title="Pharmacy Tax Invoice" size="xl">
      <div className="rounded-lg bg-white p-5 text-slate-950">
        <div className="flex flex-col gap-3 border-b-2 border-slate-950 pb-3 md:flex-row md:items-start md:justify-between">
          <div><div className="text-lg font-bold">{receipt.hospital?.name || 'Hospital Pharmacy'}</div><div className="text-xs text-slate-600">{[receipt.hospital?.address, receipt.hospital?.city, receipt.hospital?.state, receipt.hospital?.pincode].filter(Boolean).join(', ') || 'Pharmacy counter'}</div><div className="text-xs text-slate-600">GSTIN: {receipt.hospital?.gstin || '-'}</div></div>
          <div className="text-xs md:text-right"><div className="font-bold">{invoice.invoice_no || '-'}</div><div>{invoiceDate()}</div><div>{receipt.payment_method || '-'}</div></div>
        </div>
        <div className="my-3 border border-slate-950 py-1 text-center text-xs font-bold uppercase">Pharmacy Tax Invoice</div>
        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-2">
          <div className="border border-slate-300 p-2"><div className="font-bold uppercase">Bill To</div><div>{receipt.patient ? `${receipt.patient.first_name} ${receipt.patient.last_name}` : receipt.customer?.name || 'Walk-in customer'}</div><div className="text-slate-600">{receipt.patient?.uhid || receipt.customer?.phone || '-'}</div></div>
          <div className="border border-slate-300 p-2"><div className="font-bold uppercase">Sale</div><div>{receipt.type || 'Pharmacy Sale'}</div><div>Tax mode: {invoice.tax_mode || 'INCLUSIVE'}</div><div>Reference: {receipt.payment_reference || '-'}</div></div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="border p-2 text-left">Item Description</th>
                <th className="border p-2 text-right">MRP</th>
                <th className="border p-2 text-right">Disc.</th>
                <th className="border p-2 text-right">Sale Price</th>
                <th className="border p-2 text-right">Taxable Value</th>
                <th className="border p-2 text-right">CGST</th>
                <th className="border p-2 text-right">SGST</th>
                <th className="border p-2 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i, idx) => (
                <tr key={idx}>
                  <td className="border p-2">
                    <div className="font-semibold">{i.item_name || i.name || i.item_id}</div>
                    <div className="text-[11px] text-slate-600">Batch: {i.batch_no || '-'} | Qty: {i.quantity || 0}</div>
                    <div className="text-[11px] text-slate-600">{[i.dose, i.frequency, i.duration, i.route].filter(Boolean).join(' | ') || 'Directions: -'}{i.instructions ? ` | ${i.instructions}` : ''}</div>
                  </td>
                  <td className="border p-2 text-right">{money(invoiceMrpTotal(i))}</td>
                  <td className="border p-2 text-right">{money(invoiceDiscount(i))}</td>
                  <td className="border p-2 text-right">{money(invoiceSalePrice(i))}</td>
                  <td className="border p-2 text-right">{money(i.taxable_value || 0)}</td>
                  <td className="border p-2 text-right">{money(i.cgst || 0)}<div className="text-[10px] text-slate-500">{Number(i.gst_pct || 0) / 2}%</div></td>
                  <td className="border p-2 text-right">{money(i.sgst || 0)}<div className="text-[10px] text-slate-500">{Number(i.gst_pct || 0) / 2}%</div></td>
                  <td className="border p-2 text-right">{money(invoiceLineTotal(i))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 text-xs md:grid-cols-[1fr_260px]">
          <div className="border border-slate-300 p-2"><div className="font-bold">GST Summary</div>{(invoice.gst_summary || []).map(g => <div key={g.gst_pct} className="flex justify-between"><span>{g.gst_pct}% taxable {money(g.taxable_value)}</span><span>{money(g.tax)}</span></div>)}</div>
          <div className="space-y-1 border border-slate-300 p-2"><div className="flex justify-between"><span>Taxable</span><span>{money(invoice.taxable_value)}</span></div><div className="flex justify-between"><span>CGST</span><span>{money(invoice.cgst_total)}</span></div><div className="flex justify-between"><span>SGST</span><span>{money(invoice.sgst_total)}</span></div><div className="flex justify-between"><span>IGST</span><span>{money(invoice.igst_total)}</span></div><div className="flex justify-between"><span>Discount</span><span>{money(invoice.discount)}</span></div><div className="flex justify-between border-t pt-1 text-base font-bold"><span>Payable</span><span>{money(invoice.payable)}</span></div></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 mt-12 mb-4 text-xs text-slate-600"><div className="border-t border-slate-500 pt-2 text-center">Customer signature</div><div className="border-t border-slate-500 pt-2 text-center">Authorized signatory and pharmacy stamp</div></div>
      <div className="flex gap-2 mt-4"><button className="btn-primary flex-1" onClick={print}><Printer size={16} /> Print Document</button><button className="btn flex-1" onClick={onClose}>Close</button></div>
    </Modal>
  )
}

function Field({ label, required, children }) {
  return <div><label className="label">{label}{required ? ' *' : ''}</label>{children}</div>
}

function SubmitRow({ loading, label, onCancel }) {
  return <div className="flex gap-2 pt-2"><button type="submit" disabled={loading} className="btn-primary flex-1"><ClipboardCheck size={16} /> {loading ? 'Saving...' : label}</button><button type="button" className="btn flex-1" onClick={onCancel}>Cancel</button></div>
}
