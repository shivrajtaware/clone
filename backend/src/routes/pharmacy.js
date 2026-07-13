// src/routes/pharmacy.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { HttpError, resolvePatientId, sanitizeModelInput, toDate, toFloat, toInt } = require('../utils/prismaInput');
const { DRUG_FORMS, DRUG_ROUTES, inferredLooseUnit, inferredPackUnit, packSize } = require('../utils/drugForms');
router.use(auth);
const { emitToPharmacy } = require('../config/socket');

const GST_SLABS = [0, 5, 12, 18, 28];
const DRUG_CATEGORIES = ['ANALGESIC', 'ANTIBIOTIC', 'ANTIHYPERTENSIVE', 'ANTIDIABETIC', 'DIURETIC', 'CARDIAC', 'NEUROLOGICAL', 'RESPIRATORY', 'ANTICOAGULANT', 'STEROID', 'ANTIEMETIC', 'ANTACID', 'VITAMIN', 'VACCINE', 'SURGICAL', 'CONSUMABLE', 'OTHER'];
const EXPIRY_WINDOW_DAYS = 90;
const PAYMENT_MODES = new Set(['CASH', 'CARD', 'UPI', 'NET_BANKING', 'INSURANCE_CASHLESS', 'CORPORATE_CREDIT', 'CHEQUE', 'ONLINE']);
const toMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const daysBetween = (from, to) => Math.ceil((new Date(to).setHours(0, 0, 0, 0) - new Date(from).setHours(0, 0, 0, 0)) / 86400000);
const stockLabel = (quantity, item) => {
  const size = packSize(item);
  const qty = Number(quantity || 0);
  if (size <= 1) return `${qty} ${item?.unit || 'unit'}${qty === 1 ? '' : 's'}`;
  const packs = Math.floor(qty / size);
  const loose = qty % size;
  return `${packs} ${item?.pack_unit || 'pack'}${packs === 1 ? '' : 's'}${loose ? ` + ${loose} ${item?.unit || 'unit'}${loose === 1 ? '' : 's'}` : ''}`;
};
const toBaseUnits = (quantity, unitType, item) => {
  const qty = toInt(quantity, 'quantity');
  if (qty <= 0) throw new HttpError(400, 'Quantity must be greater than zero');
  return unitType === 'PACK' ? qty * packSize(item) : qty;
};
const norm = value => String(value || '').trim();
const normKey = value => norm(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const toBool = value => ['true', 'yes', 'y', '1'].includes(norm(value).toLowerCase());
const rowNumber = row => Number(row.__row || row.row_no || 0) || '?';
const importHeaderAliases = {
  'medicine': 'generic_name', 'medicine name': 'generic_name', 'item': 'generic_name', 'item name': 'generic_name',
  'product': 'generic_name', 'product name': 'generic_name', 'drug': 'generic_name', 'drug name': 'generic_name',
  'generic': 'generic_name', 'generic name': 'generic_name', 'description': 'generic_name',
  'brand': 'brand_name', 'brand name': 'brand_name', 'trade name': 'brand_name',
  'type': 'category', 'group': 'category', 'category': 'category',
  'dosage form': 'form', 'form': 'form',
  'strength': 'strength', 'composition': 'strength',
  'unit': 'unit', 'base unit': 'unit', 'loose unit': 'unit', 'uom': 'unit',
  'pack': 'pack_unit', 'pack unit': 'pack_unit', 'packing': 'pack_unit', 'container': 'pack_unit',
  'units per pack': 'units_per_pack', 'pack size': 'units_per_pack', 'packing qty': 'units_per_pack', 'strip size': 'units_per_pack',
  'order quantity': 'reorder_quantity', 'order qty': 'reorder_quantity', 'default order qty': 'reorder_quantity', 'suggested order qty': 'reorder_quantity',
  'batch': 'batch_no', 'batch no': 'batch_no', 'batch number': 'batch_no', 'lot': 'batch_no', 'lot no': 'batch_no',
  'mfg': 'mfg_date', 'mfg date': 'mfg_date', 'manufacturing date': 'mfg_date',
  'expiry': 'expiry_date', 'exp': 'expiry_date', 'exp date': 'expiry_date', 'expiry date': 'expiry_date',
  'qty': 'loose_quantity', 'quantity': 'loose_quantity', 'total qty': 'loose_quantity', 'received qty': 'loose_quantity',
  'loose qty': 'loose_quantity', 'loose quantity': 'loose_quantity', 'qty bought loose': 'loose_quantity', 'qty bought loose units': 'loose_quantity',
  'pack qty': 'pack_quantity', 'pack quantity': 'pack_quantity', 'qty bought packs': 'pack_quantity', 'qty bought pack': 'pack_quantity', 'container quantity': 'pack_quantity', 'boxes': 'pack_quantity',
  'mrp': 'mrp',
  'sale rate': 'selling_price', 'selling rate': 'selling_price', 'selling price': 'selling_price', 'selling price required': 'selling_price', 'retail price': 'selling_price',
  'retail rate': 'selling_price', 'customer price': 'selling_price', 'customer selling price': 'selling_price', 'customer rate': 'selling_price',
  'rate': 'cost_price', 'purchase rate': 'cost_price', 'purchase rate per pack': 'cost_price', 'pack purchase rate': 'cost_price', 'cost': 'cost_price', 'cost price': 'cost_price', 'ptr': 'cost_price',
  'taxable rate': 'taxable_rate', 'taxable amount': 'taxable_rate', 'taxable value': 'taxable_rate', 'base rate': 'taxable_rate',
  'gst': 'gst_pct', 'gst %': 'gst_pct', 'gst required': 'gst_pct', 'gst rate': 'gst_pct', 'gst rate required': 'gst_pct', 'tax %': 'gst_pct',
  'cgst': 'cgst_amt', 'cgst amount': 'cgst_amt', 'sgst': 'sgst_amt', 'sgst amount': 'sgst_amt',
  'igst': 'igst_amt', 'igst amount': 'igst_amt', 'purchase total': 'purchase_total', 'invoice total': 'purchase_total',
  'supplier': 'supplier_name', 'supplier name': 'supplier_name', 'vendor': 'supplier_name', 'vendor name': 'supplier_name',
  'supplier phone': 'supplier_phone', 'phone': 'supplier_phone',
  'supplier gstin': 'supplier_gstin', 'gstin': 'supplier_gstin', 'gst no': 'supplier_gstin',
  'supplier drug license': 'supplier_drug_license', 'drug license': 'supplier_drug_license',
};
const normalizeImportHeader = key => importHeaderAliases[normKey(key)] || normKey(key).replace(/\s+/g, '_');
const normalizeImportRow = (row) => Object.entries(row || {}).reduce((acc, [key, value]) => {
  const normalized = key === '__row' ? '__row' : normalizeImportHeader(key);
  if (acc[normalized] === undefined || acc[normalized] === '') acc[normalized] = value;
  return acc;
}, {});
const requiredText = (row, key, errors) => {
  const value = norm(row[key]);
  if (!value) errors.push(`Row ${rowNumber(row)}: ${key} is required`);
  return value;
};
const positiveInt = (row, key, errors, required = true) => {
  const raw = row[key];
  if ((raw === undefined || raw === null || raw === '') && !required) return 0;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) errors.push(`Row ${rowNumber(row)}: ${key} must be a positive number`);
  return Number.isFinite(value) ? value : 0;
};
const positiveFloat = (row, key, errors, required = true) => {
  const raw = row[key];
  if ((raw === undefined || raw === null || raw === '') && !required) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) errors.push(`Row ${rowNumber(row)}: ${key} must be a valid amount`);
  return Number.isFinite(value) ? value : null;
};
const importDate = (row, key, errors, required = true) => {
  const raw = norm(row[key]);
  if (!raw && !required) return null;
  if (!raw) {
    errors.push(`Row ${rowNumber(row)}: ${key} is required`);
    return null;
  }
  try {
    return toDate(raw, key);
  } catch (e) {
    errors.push(`Row ${rowNumber(row)}: ${key} must be a valid date in YYYY-MM-DD format`);
    return null;
  }
};
const optionalImportDate = (row, key, errors, required = true) => {
  const raw = norm(row[key]);
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) row[key] = raw.replace(/^(\d{2})-(\d{2})-(\d{4})$/, '$3-$2-$1');
  return importDate(row, key, errors, required);
};
const parseGstPercent = (value) => {
  const pct = Number(String(value ?? '').replace('%', '').trim() || 0);
  return pct;
};
const gstPercent = (value) => {
  const pct = parseGstPercent(value);
  return Number.isFinite(pct) && GST_SLABS.includes(pct) ? pct : 0;
};
const requireGstPercent = (value, field = 'gst_pct') => {
  if (value === undefined || value === null || value === '') throw new HttpError(400, `${field} is required. Enter 0 for GST-exempt products.`);
  const pct = parseGstPercent(value);
  if (!Number.isFinite(pct) || !GST_SLABS.includes(pct)) throw new HttpError(400, `${field} must be one of ${GST_SLABS.join(', ')}`);
  return pct;
};
const purchaseTaxFields = ({ quantity, packQuantity = 0, looseQuantity = 0, unitsPerPack = 1, costPrice, taxableRate, gstPct, cgstAmt, sgstAmt, igstAmt, purchaseTotal }) => {
  const qty = Math.max(0, Number(quantity || 0));
  const packQty = Math.max(0, Number(packQuantity || 0));
  const looseQty = Math.max(0, Number(looseQuantity || 0));
  const packSizeValue = Math.max(1, Number(unitsPerPack || 1));
  const hasPurchaseData = [costPrice, taxableRate, cgstAmt, sgstAmt, igstAmt, purchaseTotal].some(value => value !== null && value !== undefined && value !== '');
  if (!hasPurchaseData) {
    return {
      taxable_rate: null,
      cost_price: null,
      gst_pct: gstPercent(gstPct),
      cgst_amt: 0,
      sgst_amt: 0,
      igst_amt: 0,
      purchase_total: null,
    };
  }
  const billedPacks = packQty + (looseQty / packSizeValue);
  const explicitTaxBase = taxableRate !== null && taxableRate !== undefined && taxableRate !== '';
  const taxBaseValue = explicitTaxBase ? Number(taxableRate || 0) : null;
  const packRate = Number(costPrice ?? (taxBaseValue !== null && billedPacks > 0 ? taxBaseValue / billedPacks : 0));
  const pct = gstPercent(gstPct);
  const explicitCgst = cgstAmt !== null && cgstAmt !== undefined;
  const explicitSgst = sgstAmt !== null && sgstAmt !== undefined;
  const explicitIgst = igstAmt !== null && igstAmt !== undefined;
  const taxBase = taxBaseValue !== null
    ? taxBaseValue
    : (billedPacks > 0 ? billedPacks * packRate : qty * (packRate / packSizeValue));
  const cgst = explicitCgst ? Number(cgstAmt || 0) : (explicitIgst ? 0 : taxBase * pct / 200);
  const sgst = explicitSgst ? Number(sgstAmt || 0) : (explicitIgst ? 0 : taxBase * pct / 200);
  const igst = explicitIgst ? Number(igstAmt || 0) : 0;
  const total = purchaseTotal !== null && purchaseTotal !== undefined
    ? Number(purchaseTotal || 0)
    : taxBase + cgst + sgst + igst;
  return {
    taxable_rate: toMoney(packRate),
    cost_price: toMoney(total > 0 && qty > 0 ? total / qty : packRate / packSizeValue),
    gst_pct: pct,
    cgst_amt: toMoney(cgst),
    sgst_amt: toMoney(sgst),
    igst_amt: toMoney(igst),
    purchase_total: toMoney(total),
  };
};
const resolveSellingPrice = (mrp, sellingPrice) => {
  const maxPrice = Number(mrp || 0);
  if (sellingPrice === null || sellingPrice === undefined || sellingPrice === '') {
    throw new HttpError(400, 'selling_price is required. It is the customer sale rate and must not be assumed from MRP.');
  }
  const retail = Number(sellingPrice);
  return toMoney(retail);
};

const audit = (tx, req, action, recordId, newValues, oldValues = null) => tx.auditLog.create({
  data: {
    id: uuidv4(),
    hospital_id: req.hospitalId,
    user_id: req.user?.id,
    module: 'PHARMACY',
    action,
    record_id: recordId,
    old_values: oldValues,
    new_values: newValues,
    ip_address: req.ip,
    user_agent: req.get('user-agent'),
  },
});

const enrichItem = (item) => {
  const now = new Date();
  const expiryLimit = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 86400000);
  const batches = item.batches || [];
  const activeBatches = batches.filter(b => b.quantity_rem > 0);
  const expiredBatches = activeBatches.filter(b => new Date(b.expiry_date) < now);
  const nearExpiryBatches = activeBatches.filter(b => new Date(b.expiry_date) >= now && new Date(b.expiry_date) <= expiryLimit);
  const stockValue = activeBatches.reduce((sum, b) => sum + Number(b.quantity_rem || 0) * Number(b.cost_price || b.mrp || 0), 0);
  const retailValue = activeBatches.reduce((sum, b) => sum + Number(b.quantity_rem || 0) * Number(b.selling_price || b.mrp || 0), 0);
  const mrpValue = activeBatches.reduce((sum, b) => sum + Number(b.quantity_rem || 0) * Number(b.mrp || 0), 0);
  const avgMargin = stockValue > 0 ? ((retailValue - stockValue) / stockValue) * 100 : 0;

  return {
    ...item,
    is_low_stock: item.current_stock <= item.min_stock_level && item.current_stock > 0,
    is_out_of_stock: item.current_stock <= 0,
    is_overstock: item.current_stock >= item.max_stock_level,
    expiring_soon: nearExpiryBatches.length > 0,
    expired_stock: expiredBatches.reduce((sum, b) => sum + b.quantity_rem, 0),
    nearest_expiry: activeBatches[0]?.expiry_date || null,
    stock_display: stockLabel(item.current_stock, item),
    pack_size_label: `${packSize(item)} ${item.unit}/${item.pack_unit || 'pack'}`,
    stock_value: toMoney(stockValue),
    retail_value: toMoney(retailValue),
    mrp_value: toMoney(mrpValue),
    profit_margin_pct: toMoney(avgMargin),
    active_batches: activeBatches.length,
    storage_zone: item.is_cold_chain ? 'COLD_STORAGE' : 'ROOM_TEMPERATURE',
  };
};

const calculateInvoice = (lines = [], options = {}) => {
  const taxMode = options.tax_mode === 'EXCLUSIVE' ? 'EXCLUSIVE' : 'INCLUSIVE';
  const discountPct = Number(options.discount_pct || 0);
  const discountAmt = Number(options.discount_amt || 0);
  const patientState = options.patient_state || options.place_of_supply || '';
  const hospitalState = options.hospital_state || patientState;
  let subtotal = 0;
  let taxable = 0;
  let taxTotal = 0;

  const items = lines.map((line) => {
    const qty = Number(line.quantity || 0);
    const rate = Number(line.unit_price || line.mrp || 0);
    const mrpPerUnit = Number(line.mrp_per_unit ?? line.mrp_unit ?? rate);
    const lineMrpTotal = qty * mrpPerUnit;
    const rawGst = Number(line.gst_pct ?? options.default_gst_pct ?? 0);
    const gstPct = Number.isFinite(rawGst) && rawGst >= 0 && rawGst <= 100 ? rawGst : 0;
    const gross = qty * rate;
    const base = taxMode === 'INCLUSIVE' ? gross / (1 + gstPct / 100) : gross;
    const tax = taxMode === 'INCLUSIVE' ? gross - base : base * gstPct / 100;
    subtotal += gross;
    taxable += base;
    taxTotal += tax;
    const intraState = !patientState || !hospitalState || patientState.toLowerCase() === hospitalState.toLowerCase();
    return {
      ...line,
      quantity: qty,
      mrp_per_unit: toMoney(mrpPerUnit),
      mrp_total: toMoney(lineMrpTotal),
      discount: toMoney(Math.max(0, lineMrpTotal - gross)),
      sale_price: toMoney(gross),
      unit_price: toMoney(rate),
      taxable_value: toMoney(base),
      gst_pct: gstPct,
      cgst: toMoney(intraState ? tax / 2 : 0),
      sgst: toMoney(intraState ? tax / 2 : 0),
      igst: toMoney(intraState ? 0 : tax),
      line_total: toMoney(taxMode === 'INCLUSIVE' ? gross : gross + tax),
    };
  });
  const discount = discountAmt || (subtotal * discountPct / 100);
  const payable = (taxMode === 'INCLUSIVE' ? subtotal : taxable + taxTotal) - discount;
  return {
    invoice_no: options.invoice_no || `PH-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    tax_mode: taxMode,
    items,
    subtotal: toMoney(subtotal),
    taxable_value: toMoney(taxable),
    discount: toMoney(discount),
    tax_total: toMoney(taxTotal),
    cgst_total: toMoney(items.reduce((sum, i) => sum + i.cgst, 0)),
    sgst_total: toMoney(items.reduce((sum, i) => sum + i.sgst, 0)),
    igst_total: toMoney(items.reduce((sum, i) => sum + i.igst, 0)),
    payable: toMoney(payable),
    gst_summary: [...new Set(items.map(i => i.gst_pct))].sort((a, b) => a - b).map(rate => ({
      gst_pct: rate,
      taxable_value: toMoney(items.filter(i => i.gst_pct === rate).reduce((sum, i) => sum + i.taxable_value, 0)),
      tax: toMoney(items.filter(i => i.gst_pct === rate).reduce((sum, i) => sum + i.cgst + i.sgst + i.igst, 0)),
    })).filter(row => row.taxable_value > 0 || row.tax > 0),
  };
};

const invoiceFromAudit = (log) => {
  const data = log?.new_values || {};
  if (!data.invoice) return null;
  return {
    id: log.id,
    action: log.action,
    created_at: log.created_at,
    dispense_id: log.record_id,
    dispense_no: data.dispense_no || data.invoice.invoice_no,
    sale_type: data.sale_type,
    patient_id: data.patient_id || null,
    customer: data.customer || null,
    payment_method: data.payment_method || null,
    payment_reference: data.payment_reference || null,
    invoice: data.invoice,
  };
};

const allocateFefo = async (tx, item, requestedQty, preferredBatchNo) => {
  const batches = await tx.drugBatch.findMany({
    where: {
      item_id: item.item_id,
      quantity_rem: { gt: 0 },
      expiry_date: { gte: new Date() },
      ...(preferredBatchNo && { batch_no: preferredBatchNo }),
    },
    orderBy: [{ expiry_date: 'asc' }, { created_at: 'asc' }],
  });
  let remaining = requestedQty;
  const allocations = [];

  for (const batch of batches) {
    if (remaining <= 0) break;
    const quantity = Math.min(remaining, batch.quantity_rem);
    allocations.push({ batch, quantity });
    remaining -= quantity;
  }

  if (remaining > 0) {
    throw new HttpError(409, `Insufficient usable stock for ${item.item_name || item.item_id}. Short by ${remaining}.`);
  }
  return allocations;
};

router.get('/prescriptions', async (req, res) => {
  const prescriptions = await prisma.prescription.findMany({
    where: { patient: { hospital_id: req.hospitalId } },
    include: {
      patient: { select: { id: true, first_name: true, last_name: true, uhid: true, phone: true } },
      doctor: { select: { first_name: true, last_name: true } },
      items: true,
    },
    orderBy: { prescribed_at: 'desc' },
    take: 100,
  });

  const prescriptionIds = prescriptions.map(p => p.id);
  const dispenses = prescriptionIds.length
    ? await prisma.dispense.findMany({
      where: { hospital_id: req.hospitalId, prescription_id: { in: prescriptionIds } },
      select: { prescription_id: true, dispense_no: true, dispensed_at: true },
    })
    : [];
  const dispenseMap = new Map(dispenses.map(d => [d.prescription_id, d]));

  const pharmacyPrescriptions = prescriptions.map(p => ({ ...p, items: p.items.filter(item => !item.collect_bill_here) })).filter(p => p.items.length);
  res.json({
    success: true,
    data: pharmacyPrescriptions.map(p => ({
      ...p,
      dispense_status: dispenseMap.has(p.id) ? 'DISPENSED' : 'PENDING',
      dispense: dispenseMap.get(p.id) || null,
    })),
  });
});

router.get('/dashboard', async (req, res) => {
  const [items, recentDispenses, purchaseOrders, suppliers, auditLogs] = await Promise.all([
    prisma.pharmacyItem.findMany({
      where: { hospital_id: req.hospitalId },
      include: { batches: { orderBy: { expiry_date: 'asc' } } },
      orderBy: { generic_name: 'asc' },
    }),
    prisma.dispense.findMany({
      where: { hospital_id: req.hospitalId },
      include: { items: { include: { item: true } } },
      orderBy: { dispensed_at: 'desc' },
      take: 25,
    }),
    prisma.purchaseOrder.findMany({
      where: { supplier: { hospital_id: req.hospitalId } },
      include: { supplier: true, items: true },
      orderBy: { created_at: 'desc' },
      take: 10,
    }),
    prisma.supplier.count({ where: { hospital_id: req.hospitalId, is_active: true } }),
    prisma.auditLog.findMany({
      where: { hospital_id: req.hospitalId, module: 'PHARMACY' },
      orderBy: { created_at: 'desc' },
      take: 20,
      include: { user: { select: { first_name: true, last_name: true, role: true } } },
    }),
  ]);
  const enriched = items.map(enrichItem);
  const salesToday = recentDispenses
    .filter(d => daysBetween(d.dispensed_at, new Date()) === 0)
    .reduce((sum, d) => sum + d.items.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0), 0);
  const recentInvoices = auditLogs.map(invoiceFromAudit).filter(Boolean);
  const todayInvoices = recentInvoices.filter(row => daysBetween(row.created_at, new Date()) === 0);

  res.json({
    success: true,
    data: {
      stats: {
        total_items: enriched.length,
        total_stock_units: enriched.reduce((sum, i) => sum + i.current_stock, 0),
        inventory_value: toMoney(enriched.reduce((sum, i) => sum + i.stock_value, 0)),
        low_stock: enriched.filter(i => i.is_low_stock).length,
        out_of_stock: enriched.filter(i => i.is_out_of_stock).length,
        overstock: enriched.filter(i => i.is_overstock).length,
        near_expiry: enriched.filter(i => i.expiring_soon).length,
        expired_stock: enriched.reduce((sum, i) => sum + i.expired_stock, 0),
        suppliers,
        sales_today: toMoney(salesToday),
        gst_today: toMoney(todayInvoices.reduce((sum, row) => sum + Number(row.invoice?.tax_total || 0), 0)),
      },
      alerts: {
        low_stock: enriched.filter(i => i.is_low_stock).slice(0, 8),
        out_of_stock: enriched.filter(i => i.is_out_of_stock).slice(0, 8),
        overstock: enriched.filter(i => i.is_overstock).slice(0, 8),
        near_expiry: enriched.filter(i => i.expiring_soon).slice(0, 8),
      },
      fast_moving: recentDispenses.flatMap(d => d.items).reduce((rows, item) => {
        const existing = rows.find(row => row.item_id === item.item_id);
        if (existing) existing.quantity += item.quantity;
        else rows.push({ item_id: item.item_id, name: item.item.generic_name, brand: item.item.brand_name, quantity: item.quantity });
        return rows;
      }, []).sort((a, b) => b.quantity - a.quantity).slice(0, 8),
      dead_stock: enriched.filter(i => i.current_stock > 0 && !recentDispenses.some(d => d.items.some(di => di.item_id === i.id))).slice(0, 8),
      purchase_orders: purchaseOrders,
      recent_invoices: recentInvoices.slice(0, 10),
      audit_logs: auditLogs,
    },
  });
});

router.get('/gst-slabs', async (req, res) => {
  res.json({
    success: true,
    data: GST_SLABS.map(rate => ({ rate, label: `${rate}% GST`, active: true })),
    meta: { custom_rates_allowed: true, min_rate: 0, max_rate: 100 },
  });
});

router.get('/drug-metadata', async (req, res) => {
  res.json({
    success: true,
    data: {
      forms: DRUG_FORMS,
      routes: DRUG_ROUTES,
      issue_units: ['LOOSE', 'PACK'],
      defaults: { form: 'Other', unit: 'unit', pack_unit: 'pack', units_per_pack: 1 },
      examples: [
        { form: 'Syrup', base_unit: 'ml', container: 'bottle' },
        { form: 'Injection', base_unit: 'vial', container: 'box' },
        { form: 'IV Fluid', base_unit: 'bottle', container: 'case' },
        { form: 'Inhaler', base_unit: 'dose', container: 'inhaler' },
      ],
    },
  });
});

router.post('/invoice/preview', async (req, res) => {
  const invoice = calculateInvoice(req.body.items || [], req.body);
  res.json({ success: true, data: invoice });
});

router.get('/reports', async (req, res) => {
  const { type = 'stock' } = req.query;
  const [items, dispenses, purchaseOrders, auditLogs] = await Promise.all([
    prisma.pharmacyItem.findMany({ where: { hospital_id: req.hospitalId }, include: { batches: { orderBy: { expiry_date: 'asc' } } } }),
    prisma.dispense.findMany({ where: { hospital_id: req.hospitalId }, include: { items: { include: { item: true } } }, orderBy: { dispensed_at: 'desc' }, take: 500 }),
    prisma.purchaseOrder.findMany({ where: { supplier: { hospital_id: req.hospitalId } }, include: { supplier: true, items: true }, orderBy: { created_at: 'desc' }, take: 250 }),
    prisma.auditLog.findMany({ where: { hospital_id: req.hospitalId, module: 'PHARMACY' }, orderBy: { created_at: 'desc' }, take: 250 }),
  ]);
  const enriched = items.map(enrichItem);
  const invoices = auditLogs.map(invoiceFromAudit).filter(Boolean);
  const salesRows = dispenses.flatMap(d => d.items.map(i => ({
    dispense_no: d.dispense_no,
    dispensed_at: d.dispensed_at,
    medicine: i.item.generic_name,
    brand: i.item.brand_name,
    batch_no: i.batch_no,
    quantity: i.quantity,
    amount: toMoney(Number(i.quantity || 0) * Number(i.unit_price || 0)),
  })));
  const gstRows = invoices.flatMap(row => (row.invoice?.gst_summary || []).map(g => ({
    invoice_no: row.dispense_no,
    created_at: row.created_at,
    sale_type: row.sale_type,
    payment_method: row.payment_method,
    gst_pct: g.gst_pct,
    taxable_value: g.taxable_value,
    tax: g.tax,
    payable: row.invoice?.payable || 0,
  })));
  const reports = {
    stock: enriched,
    expiry: enriched.flatMap(i => (i.batches || []).map(b => ({
      item_id: i.id,
      medicine: i.generic_name,
      brand: i.brand_name,
      batch_no: b.batch_no,
      quantity_rem: b.quantity_rem,
      expiry_date: b.expiry_date,
      days_to_expiry: daysBetween(new Date(), b.expiry_date),
      value: toMoney(Number(b.quantity_rem || 0) * Number(b.cost_price || b.mrp || 0)),
    }))).sort((a, b) => a.days_to_expiry - b.days_to_expiry),
    sales: salesRows,
    purchases: purchaseOrders,
    invoices,
    gst: gstRows,
    valuation: { total_value: toMoney(enriched.reduce((sum, i) => sum + i.stock_value, 0)), rows: enriched.map(i => ({ id: i.id, medicine: i.generic_name, value: i.stock_value, margin: i.profit_margin_pct })) },
    audit: auditLogs,
    movement: auditLogs.filter(log => ['DISPENSE_FEFO', 'STOCK_ADJUSTMENT', 'BATCH_RECEIVED', 'PO_RECEIVED'].includes(log.action)),
  };
  res.json({ success: true, data: reports[type] || reports.stock });
});

router.get('/inventory', async (req, res) => {
  const { search, category, low_stock, out_stock, overstock, expiring } = req.query;
  const items = await prisma.pharmacyItem.findMany({
    where: {
      hospital_id: req.hospitalId,
      ...(search && { OR: [{ generic_name: { contains: search, mode: 'insensitive' } }, { brand_name: { contains: search, mode: 'insensitive' } }] }),
      ...(category && { category }),
    },
    include: {
      batches: {
        orderBy: { expiry_date: 'asc' },
        where: { quantity_rem: { gt: 0 } },
      },
    },
    orderBy: { generic_name: 'asc' },
  });

  const now = new Date();
  const ninetyDays = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  let enriched = items.map(enrichItem);

  if (low_stock === 'true') enriched = enriched.filter(i => i.is_low_stock);
  if (out_stock === 'true') enriched = enriched.filter(i => i.is_out_of_stock);
  if (overstock === 'true') enriched = enriched.filter(i => i.is_overstock);
  if (expiring === 'true') enriched = enriched.filter(i => i.expiring_soon || i.expired_stock > 0);
  res.json({ success: true, data: enriched });
});

router.get('/medicine-suggestions', async (req, res) => {
  const search = String(req.query.search || '').trim();
  if (search.length < 2) return res.json({ success: true, data: [] });

  const items = await prisma.pharmacyItem.findMany({
    where: {
      hospital_id: req.hospitalId,
      OR: [
        { generic_name: { contains: search, mode: 'insensitive' } },
        { brand_name: { contains: search, mode: 'insensitive' } },
        { strength: { contains: search, mode: 'insensitive' } },
        { form: { contains: search, mode: 'insensitive' } },
      ],
    },
    include: {
      batches: {
        where: { quantity_rem: { gt: 0 }, expiry_date: { gte: new Date() } },
        orderBy: [{ expiry_date: 'asc' }, { created_at: 'asc' }],
        take: 3,
      },
    },
    orderBy: [{ generic_name: 'asc' }, { brand_name: 'asc' }],
    take: 12,
  });

  res.json({ success: true, data: items.map(enrichItem) });
});

router.get('/inventory/:id', async (req, res) => {
  const item = await prisma.pharmacyItem.findFirst({ where: { id: req.params.id, hospital_id: req.hospitalId }, include: { batches: true, dispense_items: { take: 20, orderBy: { id: 'desc' }, include: { dispense: true } } } });
  res.json({ success: true, data: item });
});

router.post('/inventory', async (req, res) => {
  const data = sanitizeModelInput('PharmacyItem', req.body, {
    exclude: ['id', 'hospital_id', 'created_at', 'current_stock'],
  });
  const item = await prisma.pharmacyItem.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, ...data } });
  res.status(201).json({ success: true, data: item });
});

router.post('/inventory/import', async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  const mode = ['replace-batch', 'skip', 'append'].includes(req.body.mode) ? req.body.mode : 'append';
  if (!rows.length) throw new HttpError(400, 'Import file has no rows');
  if (rows.length > 5000) throw new HttpError(400, 'Import limit is 5000 rows at a time');

  const errors = [];
  const prepared = rows.map((row, index) => {
    const r = normalizeImportRow({ ...row, __row: row.__row || index + 2 });
    const category = norm(r.category || 'OTHER').toUpperCase();
    if (!DRUG_CATEGORIES.includes(category)) errors.push(`Row ${rowNumber(r)}: category must be one of ${DRUG_CATEGORIES.join(', ')}`);
    const unitsPerPack = positiveInt({ ...r, units_per_pack: r.units_per_pack || 1 }, 'units_per_pack', errors);
    const packQuantity = positiveInt(r, 'pack_quantity', errors, false);
    const looseQuantity = positiveInt(r, 'loose_quantity', errors, false);
    const quantity = packQuantity * Math.max(1, unitsPerPack || 1) + looseQuantity;
    if (quantity <= 0) errors.push(`Row ${rowNumber(r)}: stock quantity is required. Add pack_quantity or loose_quantity/qty`);
    const expiry = optionalImportDate(r, 'expiry_date', errors);
    if (expiry && expiry < new Date().setHours(0, 0, 0, 0)) errors.push(`Row ${rowNumber(r)}: expiry_date is already expired`);
    const mrp = positiveFloat(r, 'mrp', errors);
    const costPrice = positiveFloat(r, 'cost_price', errors, false);
    const taxableRate = positiveFloat(r, 'taxable_rate', errors, false);
    const cgstAmt = positiveFloat(r, 'cgst_amt', errors, false);
    const sgstAmt = positiveFloat(r, 'sgst_amt', errors, false);
    const igstAmt = positiveFloat(r, 'igst_amt', errors, false);
    const purchaseTotal = positiveFloat(r, 'purchase_total', errors, false);
    let gstPct = 0;
    try {
      gstPct = requireGstPercent(r.gst_pct, 'GST %');
    } catch (e) {
      errors.push(`Row ${rowNumber(r)}: ${e.message}`);
    }
    const purchaseTax = purchaseTaxFields({
      quantity,
      packQuantity,
      looseQuantity,
      unitsPerPack,
      costPrice,
      taxableRate,
      gstPct,
      cgstAmt,
      sgstAmt,
      igstAmt,
      purchaseTotal,
    });
    if (purchaseTax.cost_price !== null && mrp !== null && purchaseTax.cost_price > mrp) errors.push(`Row ${rowNumber(r)}: landed cost cannot be greater than mrp`);
    const sellingPrice = positiveFloat(r, 'selling_price', errors);
    let retailPrice = null;
    try {
      retailPrice = resolveSellingPrice(mrp, sellingPrice);
      if (mrp !== null && retailPrice > mrp) errors.push(`Row ${rowNumber(r)}: selling_price cannot be greater than mrp`);
    } catch (e) {
      errors.push(`Row ${rowNumber(r)}: ${e.message}`);
    }

    const itemName = norm(r.generic_name) || norm(r.brand_name);
    if (!itemName) errors.push(`Row ${rowNumber(r)}: medicine name or brand name is required`);
    const item = {
      generic_name: itemName,
      brand_name: norm(r.brand_name),
      category,
      form: norm(r.form || 'Other'),
      strength: norm(r.strength),
      unit: norm(r.unit || 'unit'),
      pack_unit: norm(r.pack_unit || 'pack'),
      units_per_pack: Math.max(1, unitsPerPack || 1),
      min_stock_level: positiveInt(r, 'min_stock_level', errors, false) || 10,
      max_stock_level: positiveInt(r, 'max_stock_level', errors, false) || 1000,
      reorder_quantity: positiveInt(r, 'reorder_quantity', errors, false) || 100,
      is_controlled: toBool(r.is_controlled),
      is_cold_chain: toBool(r.is_cold_chain),
      rack_location: norm(r.rack_location) || null,
    };
    return {
      item,
      key: [item.generic_name, item.brand_name, item.strength, item.form].map(normKey).join('|'),
      batch: {
        batch_no: requiredText(r, 'batch_no', errors),
        mfg_date: optionalImportDate(r, 'mfg_date', errors, false),
        expiry_date: expiry,
        quantity_in: quantity,
        quantity_rem: quantity,
        mrp,
        selling_price: retailPrice,
        ...purchaseTax,
        supplier: norm(r.supplier_name) || null,
      },
      supplier: {
        name: norm(r.supplier_name),
        phone: norm(r.supplier_phone),
        gstin: norm(r.supplier_gstin),
        drug_license: norm(r.supplier_drug_license),
      },
      row_no: rowNumber(r),
    };
  });

  const duplicateBatch = new Set();
  for (const row of prepared) {
    const batchKey = `${row.key}|${normKey(row.batch.batch_no)}`;
    if (duplicateBatch.has(batchKey)) errors.push(`Row ${row.row_no}: duplicate batch_no for same medicine in this import`);
    duplicateBatch.add(batchKey);
  }
  if (errors.length) return res.status(400).json({ success: false, message: 'Import validation failed', errors });

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.pharmacyItem.findMany({ where: { hospital_id: req.hospitalId }, include: { batches: true } });
    const itemMap = new Map(existing.map(item => [[item.generic_name, item.brand_name, item.strength, item.form].map(normKey).join('|'), item]));
    const summary = { rows: prepared.length, created_items: 0, updated_items: 0, created_batches: 0, skipped_batches: 0, created_suppliers: 0 };

    for (const row of prepared) {
      let item = itemMap.get(row.key);
      if (!item) {
        item = await tx.pharmacyItem.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, ...row.item } });
        itemMap.set(row.key, { ...item, batches: [] });
        summary.created_items += 1;
      } else {
        item = await tx.pharmacyItem.update({ where: { id: item.id }, data: row.item });
        summary.updated_items += 1;
      }

      if (row.supplier.name) {
        const supplier = await tx.supplier.findFirst({ where: { hospital_id: req.hospitalId, name: row.supplier.name } });
        if (!supplier) {
          await tx.supplier.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, name: row.supplier.name, phone: row.supplier.phone || null, gstin: row.supplier.gstin || null, drug_license: row.supplier.drug_license || null } });
          summary.created_suppliers += 1;
        }
      }

      const existingBatch = await tx.drugBatch.findFirst({ where: { item_id: item.id, batch_no: row.batch.batch_no } });
      if (existingBatch && mode === 'append') {
        throw new HttpError(409, `Batch ${row.batch.batch_no} already exists for ${item.generic_name}`);
      } else if (existingBatch && mode === 'skip') {
        summary.skipped_batches += 1;
        continue; // skip this row, import remaining rows
      } else if (existingBatch && mode === 'replace-batch') {
        const delta = row.batch.quantity_rem - existingBatch.quantity_rem;
        await tx.drugBatch.update({ where: { id: existingBatch.id }, data: row.batch });
        await tx.pharmacyItem.update({ where: { id: item.id }, data: { current_stock: { increment: delta } } });
      } else {
        await tx.drugBatch.create({ data: { id: uuidv4(), item_id: item.id, ...row.batch } });
        await tx.pharmacyItem.update({ where: { id: item.id }, data: { current_stock: { increment: row.batch.quantity_rem } } });
        summary.created_batches += 1;
      }
    }

    await audit(tx, req, 'INVENTORY_IMPORT', uuidv4(), { mode, summary });
    return summary;
  });

  res.status(201).json({ success: true, message: 'Pharmacy import completed', data: result });
});

router.put('/inventory/:id', async (req, res) => {
  const data = sanitizeModelInput('PharmacyItem', req.body, {
    exclude: ['id', 'hospital_id', 'created_at'],
  });
  const item = await prisma.pharmacyItem.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: item });
});

router.post('/inventory/:id/batch', async (req, res) => {
  const { batch_no, mfg_date, expiry_date, quantity_in, pack_quantity, loose_quantity, mrp, selling_price, cost_price, taxable_rate, gst_pct, cgst_amt, sgst_amt, igst_amt, purchase_total, supplier } = req.body;
  const batch = await prisma.$transaction(async (tx) => {
    const item = await tx.pharmacyItem.findFirst({ where: { id: req.params.id, hospital_id: req.hospitalId } });
    if (!item) throw new HttpError(404, 'Medicine not found');
    const quantity = pack_quantity !== undefined || loose_quantity !== undefined
      ? (toInt(pack_quantity || 0, 'pack_quantity') * packSize(item)) + toInt(loose_quantity || 0, 'loose_quantity')
      : toInt(quantity_in, 'quantity_in');
    if (quantity <= 0) throw new HttpError(400, 'Received quantity must be greater than zero');
    const mrpValue = toFloat(mrp, 'mrp');
    const gstPct = requireGstPercent(gst_pct, 'GST %');
    const retailPrice = resolveSellingPrice(mrpValue, selling_price);
    if (retailPrice > mrpValue) throw new HttpError(400, 'Selling price cannot be greater than MRP');
    const purchaseTax = purchaseTaxFields({
      quantity,
      packQuantity: pack_quantity || 0,
      looseQuantity: loose_quantity || 0,
      unitsPerPack: packSize(item),
      costPrice: cost_price ? toFloat(cost_price, 'cost_price') : null,
      taxableRate: taxable_rate ? toFloat(taxable_rate, 'taxable_rate') : null,
      gstPct,
      cgstAmt: cgst_amt ? toFloat(cgst_amt, 'cgst_amt') : null,
      sgstAmt: sgst_amt ? toFloat(sgst_amt, 'sgst_amt') : null,
      igstAmt: igst_amt ? toFloat(igst_amt, 'igst_amt') : null,
      purchaseTotal: purchase_total ? toFloat(purchase_total, 'purchase_total') : null,
    });
    const created = await tx.drugBatch.create({
      data: {
        id: uuidv4(),
        item_id: req.params.id,
        batch_no,
        mfg_date: mfg_date ? toDate(mfg_date, 'mfg_date') : null,
        expiry_date: toDate(expiry_date, 'expiry_date'),
        quantity_in: quantity,
        quantity_rem: quantity,
        mrp: mrpValue,
        selling_price: retailPrice,
        ...purchaseTax,
        supplier,
      },
    });
    await tx.pharmacyItem.update({ where: { id: req.params.id }, data: { current_stock: { increment: quantity } } });
    await audit(tx, req, 'BATCH_RECEIVED', created.id, { item_id: req.params.id, batch_no, quantity, stock_display: stockLabel(quantity, item), supplier, purchase: purchaseTax });
    return created;
  });
  res.status(201).json({ success: true, data: batch });
});

router.post('/inventory/:id/adjust', async (req, res) => {
  const { type = 'ADJUSTMENT', quantity, reason, batch_no } = req.body;
  const qty = Math.abs(toInt(quantity, 'quantity'));
  const direction = ['RECEIPT', 'RETURN', 'RECONCILIATION_PLUS'].includes(type) ? 1 : -1;
  const item = await prisma.$transaction(async (tx) => {
    const before = await tx.pharmacyItem.findFirst({ where: { id: req.params.id, hospital_id: req.hospitalId } });
    if (!before) throw new HttpError(404, 'Medicine not found');
    if (direction < 0 && before.current_stock < qty) throw new HttpError(409, 'Adjustment exceeds available stock');
    if (batch_no) {
      const batch = await tx.drugBatch.findFirst({ where: { item_id: req.params.id, batch_no } });
      if (!batch) throw new HttpError(404, 'Batch not found');
      if (direction < 0 && batch.quantity_rem < qty) throw new HttpError(409, 'Adjustment exceeds batch stock');
      await tx.drugBatch.update({ where: { id: batch.id }, data: { quantity_rem: { [direction > 0 ? 'increment' : 'decrement']: qty } } });
    }
    const updated = await tx.pharmacyItem.update({ where: { id: req.params.id }, data: { current_stock: { [direction > 0 ? 'increment' : 'decrement']: qty } } });
    await audit(tx, req, 'STOCK_ADJUSTMENT', req.params.id, { type, quantity: qty, direction, reason, batch_no, after_stock: updated.current_stock }, { current_stock: before.current_stock });
    return updated;
  });
  res.json({ success: true, data: item });
});

router.post('/dispense', async (req, res) => {
  const { patient_id, prescription_id, items, gst = {}, payment_method, payment_reference, sale_type, customer = {} } = req.body;
  const paymentMethod = norm(payment_method).toUpperCase();
  if (paymentMethod && !PAYMENT_MODES.has(paymentMethod)) throw new HttpError(400, 'Invalid payment mode');
  const dispenseItems = (Array.isArray(items) ? items : []).map(i => ({
    rx_item_id: norm(i.rx_item_id),
    item_id: i.item_id,
    item_name: i.item_name,
    quantity: i.quantity,
    quantity_unit: String(i.quantity_unit || i.unit_type || 'LOOSE').toUpperCase() === 'PACK' ? 'PACK' : 'LOOSE',
    batch_no: i.batch_no || null,
    unit_price: i.unit_price ? toFloat(i.unit_price, 'unit_price') : null,
    dose: norm(i.dose),
    frequency: norm(i.frequency),
    duration: norm(i.duration),
    route: norm(i.route),
    instructions: norm(i.instructions),
  }));
  if (!dispenseItems.length) throw new HttpError(400, 'At least one medicine is required');
  const count = await prisma.dispense.count({ where: { hospital_id: req.hospitalId } });
  const dispense_no = `DISP-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
  const resolvedPatientId = patient_id ? await resolvePatientId(prisma, req.hospitalId, patient_id) : null;
  if (resolvedPatientId && !paymentMethod) throw new HttpError(400, 'Payment mode is required for patient pharmacy billing');
  const walkInCustomer = {
    name: String(customer.name || req.body.customer_name || '').trim(),
    phone: String(customer.phone || req.body.customer_phone || '').trim(),
    gstin: String(customer.gstin || '').trim(),
  };

  const dispense = await prisma.$transaction(async (tx) => {
    if (prescription_id) {
      const existingDispense = await tx.dispense.findFirst({
        where: { hospital_id: req.hospitalId, prescription_id },
        select: { dispense_no: true },
      });
      if (existingDispense) throw new HttpError(409, `Prescription already dispensed as ${existingDispense.dispense_no}`);
    }
    const expandedItems = [];
    const prescriptionItems = prescription_id
      ? await tx.prescriptionItem.findMany({
        where: { prescription_id },
        select: { id: true, drug_name: true, generic_name: true, strength: true, form: true, dose: true, frequency: true, duration: true, route: true, instructions: true },
      })
      : [];
    const prescriptionItemMap = new Map(prescriptionItems.map(item => [item.id, item]));
    for (const i of dispenseItems) {
      const pharmacyItem = await tx.pharmacyItem.findFirst({ where: { id: i.item_id, hospital_id: req.hospitalId } });
      if (!pharmacyItem) throw new HttpError(404, `Medicine not found: ${i.item_id}`);
      const prescriptionItem = i.rx_item_id ? prescriptionItemMap.get(i.rx_item_id) : null;
      const baseQuantity = toBaseUnits(i.quantity, i.quantity_unit, pharmacyItem);
      if (pharmacyItem.current_stock < baseQuantity) throw new HttpError(409, `Insufficient stock for ${pharmacyItem.generic_name}`);
      const allocations = await allocateFefo(tx, { ...i, item_name: pharmacyItem.generic_name }, baseQuantity, i.batch_no);
      for (const allocation of allocations) {
        const size = packSize(pharmacyItem);
        const mrpPerUnit = toMoney(Number(allocation.batch.mrp || 0) / size);
        const retailPerUnit = toMoney(Number(allocation.batch.selling_price || allocation.batch.mrp || 0) / size);
        const unitPrice = i.unit_price !== null && i.unit_price !== undefined ? toMoney(i.unit_price) : retailPerUnit;
        if (unitPrice > mrpPerUnit) throw new HttpError(400, `${pharmacyItem.generic_name} selling rate cannot exceed MRP`);
        expandedItems.push({
          id: uuidv4(),
          item_id: i.item_id,
          quantity: allocation.quantity,
          batch_no: allocation.batch.batch_no,
          mrp_per_unit: mrpPerUnit,
          unit_price: unitPrice,
          gst_pct: Number(allocation.batch.gst_pct || 0),
          item_name: pharmacyItem.generic_name,
          expiry_date: allocation.batch.expiry_date,
          mrp: Number(allocation.batch.mrp || 0),
          selling_price: Number(allocation.batch.selling_price || allocation.batch.mrp || 0),
          rx_item_id: i.rx_item_id || null,
          prescribed_drug_name: prescriptionItem?.drug_name || null,
          prescribed_generic_name: prescriptionItem?.generic_name || null,
          prescribed_strength: prescriptionItem?.strength || null,
          prescribed_form: prescriptionItem?.form || null,
          dose: prescriptionItem?.dose || i.dose || null,
          frequency: prescriptionItem?.frequency || i.frequency || null,
          duration: prescriptionItem?.duration || i.duration || null,
          route: prescriptionItem?.route || i.route || null,
          instructions: prescriptionItem?.instructions || i.instructions || null,
        });
      }
    }
    const d = await tx.dispense.create({
      data: {
        id: uuidv4(), hospital_id: req.hospitalId, dispense_no, patient_id: resolvedPatientId, prescription_id, dispensed_by: req.user.id,
        notes: req.body.notes || (resolvedPatientId ? null : `Walk-in sale${walkInCustomer.name ? `: ${walkInCustomer.name}` : ''}`),
        items: { create: expandedItems.map(({ gst_pct, item_name, expiry_date, mrp, mrp_per_unit, selling_price, rx_item_id, prescribed_drug_name, prescribed_generic_name, prescribed_strength, prescribed_form, dose, frequency, duration, route, instructions, ...i }) => i) },
      },
    });
    for (const i of expandedItems) {
      await tx.pharmacyItem.update({ where: { id: i.item_id }, data: { current_stock: { decrement: i.quantity } } });
      await tx.drugBatch.updateMany({ where: { item_id: i.item_id, batch_no: i.batch_no }, data: { quantity_rem: { decrement: i.quantity } } });
    }
    const invoice = calculateInvoice(expandedItems, { ...gst, invoice_no: dispense_no, payment_method: paymentMethod });
    let bill = null;
    let payment = null;
    if (resolvedPatientId) {
      const bill_no = `BILL-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`;
      const subtotal = Number(invoice.subtotal || 0);
      const discount_amt = Number(invoice.discount || 0);
      const tax_amt = Number(invoice.tax_total || 0);
      const total_amt = Number(invoice.payable || 0);
      bill = await tx.bill.create({
        data: {
          id: uuidv4(),
          hospital_id: req.hospitalId,
          bill_no,
          patient_id: resolvedPatientId,
          type: 'PHARMACY',
          status: 'PAID',
          subtotal,
          discount_amt,
          tax_amt,
          total_amt,
          paid_amt: total_amt,
          due_amt: 0,
          payment_mode: paymentMethod,
          notes: `Auto-generated from pharmacy dispense ${dispense_no}`,
          items: {
            create: invoice.items.map(item => ({
              id: uuidv4(),
              category: 'Pharmacy',
              description: `${item.item_name}${item.batch_no ? ` (${item.batch_no})` : ''}`,
              quantity: Math.max(1, Math.round(Number(item.quantity || 1))),
              unit_price: Number(item.unit_price || 0),
              total: Number(item.line_total || 0),
            })),
          },
        },
        include: { items: true, payments: true },
      });
      payment = await tx.payment.create({
        data: {
          id: uuidv4(),
          bill_id: bill.id,
          amount: total_amt,
          mode: paymentMethod,
          reference_no: payment_reference || null,
          received_by: req.user.id,
        },
      });
    }
    await audit(tx, req, resolvedPatientId ? 'DISPENSE_FEFO' : 'WALK_IN_SALE', d.id, {
      dispense_no,
      bill_id: bill?.id || null,
      bill_no: bill?.bill_no || null,
      sale_type: sale_type || (resolvedPatientId ? 'PATIENT' : 'WALK_IN'),
      patient_id: resolvedPatientId,
      prescription_id,
      customer: resolvedPatientId ? null : walkInCustomer,
      payment_method: paymentMethod,
      payment_reference: payment_reference || null,
      items: expandedItems,
      invoice,
    });
    return { ...d, invoice, allocated_items: expandedItems, bill, payment };
  });

  emitToPharmacy(req.hospitalId, 'pharmacy:updated', { type: 'DISPENSE' });
  res.status(201).json({ success: true, message: 'Dispensed successfully', data: dispense });
});

router.get('/low-stock', async (req, res) => {
  const items = await prisma.pharmacyItem.findMany({ where: { hospital_id: req.hospitalId } });
  const low = items.filter(i => i.current_stock <= i.min_stock_level);
  res.json({ success: true, data: low, count: low.length });
});

router.get('/suppliers', async (req, res) => {
  const suppliers = await prisma.supplier.findMany({
    where: { hospital_id: req.hospitalId },
    include: { purchase_orders: { orderBy: { created_at: 'desc' }, take: 5 } },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: suppliers });
});

router.post('/suppliers', async (req, res) => {
  const data = sanitizeModelInput('Supplier', req.body, { exclude: ['id', 'hospital_id', 'created_at'] });
  const supplier = await prisma.$transaction(async (tx) => {
    const created = await tx.supplier.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, ...data } });
    await audit(tx, req, 'SUPPLIER_CREATED', created.id, created);
    return created;
  });
  res.status(201).json({ success: true, data: supplier });
});

router.get('/purchase-orders', async (req, res) => {
  const orders = await prisma.purchaseOrder.findMany({ where: { supplier: { hospital_id: req.hospitalId } }, include: { supplier: true, items: true }, orderBy: { created_at: 'desc' }, take: 50 });
  res.json({ success: true, data: orders });
});

router.post('/purchase-orders', async (req, res) => {
  const count = await prisma.purchaseOrder.count({ where: { hospital_id: req.hospitalId } });
  const po_no = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
  const data = sanitizeModelInput('PurchaseOrder', req.body, {
    exclude: ['id', 'po_no', 'hospital_id', 'created_at', 'received_at'],
  });
  const items = (Array.isArray(req.body.items) ? req.body.items : []).map(i => sanitizeModelInput('POItem', i, {
    exclude: ['id', 'po_id'],
  }));
  const total_amount = items.reduce((sum, i) => sum + (Number(i.quantity || 0) * Number(i.unit_price || 0)), 0);
  const po = await prisma.purchaseOrder.create({
    data: {
      id: uuidv4(),
      hospital_id: req.hospitalId,
      po_no,
      ...data,
      total_amount: data.total_amount ?? toMoney(total_amount),
      items: { create: items.map(i => ({ id: uuidv4(), ...i })) },
    },
    include: { supplier: true, items: true },
  });
  res.status(201).json({ success: true, data: po });
});

router.post('/purchase-orders/:id/receive', async (req, res) => {
  const rows = Array.isArray(req.body.received_items) ? req.body.received_items : [];
  if (!rows.length) throw new HttpError(400, 'received_items is required');
  const result = await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id: req.params.id, supplier: { hospital_id: req.hospitalId } },
      include: { supplier: true },
    });
    if (!po) throw new HttpError(404, 'Purchase order not found');
    const batches = [];
    for (const row of rows) {
      const item = await tx.pharmacyItem.findFirst({ where: { id: row.item_id, hospital_id: req.hospitalId } });
      if (!item) throw new HttpError(404, `Medicine not found: ${row.item_id}`);
      const quantity = row.pack_quantity !== undefined || row.loose_quantity !== undefined
        ? (toInt(row.pack_quantity || 0, 'pack_quantity') * packSize(item)) + toInt(row.loose_quantity || 0, 'loose_quantity')
        : toInt(row.quantity || row.quantity_in, 'quantity');
      if (quantity <= 0) throw new HttpError(400, 'Received quantity must be greater than zero');
      const mrpValue = toFloat(row.mrp, 'mrp');
      const gstPct = requireGstPercent(row.gst_pct, 'GST %');
      const retailPrice = resolveSellingPrice(mrpValue, row.selling_price);
      if (retailPrice > mrpValue) throw new HttpError(400, 'Selling price cannot be greater than MRP');
      const purchaseTax = purchaseTaxFields({
        quantity,
        packQuantity: row.pack_quantity || 0,
        looseQuantity: row.loose_quantity || 0,
        unitsPerPack: packSize(item),
        costPrice: row.cost_price ? toFloat(row.cost_price, 'cost_price') : null,
        taxableRate: row.taxable_rate ? toFloat(row.taxable_rate, 'taxable_rate') : null,
        gstPct,
        cgstAmt: row.cgst_amt ? toFloat(row.cgst_amt, 'cgst_amt') : null,
        sgstAmt: row.sgst_amt ? toFloat(row.sgst_amt, 'sgst_amt') : null,
        igstAmt: row.igst_amt ? toFloat(row.igst_amt, 'igst_amt') : null,
        purchaseTotal: row.purchase_total ? toFloat(row.purchase_total, 'purchase_total') : null,
      });
      const batch = await tx.drugBatch.create({
        data: {
          id: uuidv4(),
          item_id: row.item_id,
          batch_no: row.batch_no,
          mfg_date: row.mfg_date ? toDate(row.mfg_date, 'mfg_date') : null,
          expiry_date: toDate(row.expiry_date, 'expiry_date'),
          quantity_in: quantity,
          quantity_rem: quantity,
          mrp: mrpValue,
          selling_price: retailPrice,
          ...purchaseTax,
          supplier: po.supplier.name,
        },
      });
      await tx.pharmacyItem.update({ where: { id: row.item_id }, data: { current_stock: { increment: quantity } } });
      batches.push(batch);
    }
    const updatedPo = await tx.purchaseOrder.update({
      where: { id: req.params.id },
      data: { status: 'RECEIVED', received_at: new Date() },
      include: { supplier: true, items: true },
    });
    await audit(tx, req, 'PO_RECEIVED', req.params.id, { po_no: po.po_no, batches });
    return { purchase_order: updatedPo, batches };
  });
  emitToPharmacy( req.hospitalId, 'pharmacy:updated', {type: 'STOCK_IN'});
  res.json({ success: true, data: result }); 
});

module.exports = router;
