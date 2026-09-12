// src/routes/billing.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { badRequest, resolvePatientId, sanitizeModelInput, toDate, toFloat, toInt } = require('../utils/prismaInput');
router.use(auth);

const FEE_TRIGGERS = [
  { code: 'MANUAL', label: 'Manual only', category: 'Other' },
  { code: 'CONSULTATION', label: 'Consultation / OPD visit', category: 'Consultation' },
  { code: 'REGISTRATION', label: 'Patient registration', category: 'Registration' },
  { code: 'ADMISSION_PER_NIGHT', label: 'Admit patient per night', category: 'Room Charge' },
  { code: 'NURSING_PER_DAY', label: 'Nursing charge per day', category: 'Nursing' },
  { code: 'ICU_PER_DAY', label: 'ICU / critical care per day', category: 'ICU' },
  { code: 'RADIOLOGY_STUDY', label: 'Per radiology study', category: 'Radiology' },
  { code: 'PHARMACY_DISPENSE', label: 'Per pharmacy dispense', category: 'Pharmacy' },
  { code: 'AMBULANCE_TRIP', label: 'Per ambulance trip', category: 'Ambulance' },
  { code: 'EMERGENCY_VISIT', label: 'Emergency visit', category: 'Emergency' },
  { code: 'OT_PROCEDURE', label: 'OT procedure', category: 'Surgery' },
  { code: 'ANESTHESIA', label: 'Anesthesia service', category: 'Anesthesia' },
  { code: 'PROCEDURE', label: 'Minor procedure / dressing', category: 'Procedure' },
  { code: 'CONSUMABLE', label: 'Consumables / disposables', category: 'Consumable' },
  { code: 'OXYGEN', label: 'Oxygen / respiratory support', category: 'Respiratory' },
  { code: 'MONITORING', label: 'Patient monitoring', category: 'Monitoring' },
  { code: 'DIET_ORDER', label: 'Dietary order', category: 'Dietary' },
  { code: 'DOCUMENTATION', label: 'Certificate / documentation', category: 'Documentation' },
];

const DEFAULT_SERVICE_FEES = [
  ['Registration Fee', 'Registration', 'REGISTRATION', 150],
  ['OPD Consultation', 'Consultation', 'CONSULTATION', 500],
  ['General Ward Bed', 'Room Charge', 'ADMISSION_PER_NIGHT', 1500],
  ['Nursing Care', 'Nursing', 'NURSING_PER_DAY', 600],
  ['ICU Bed Charge', 'ICU', 'ICU_PER_DAY', 5000],
  ['Emergency Visit', 'Emergency', 'EMERGENCY_VISIT', 1200],
  ['Radiology Study Charge', 'Radiology', 'RADIOLOGY_STUDY', 900],
  ['Pharmacy Dispense Service', 'Pharmacy', 'PHARMACY_DISPENSE', 50],
  ['Ambulance Trip', 'Ambulance', 'AMBULANCE_TRIP', 1500],
  ['OT Procedure Charge', 'Surgery', 'OT_PROCEDURE', 8000],
  ['Anesthesia Charge', 'Anesthesia', 'ANESTHESIA', 2500],
  ['Minor Procedure', 'Procedure', 'PROCEDURE', 800],
  ['Consumables Kit', 'Consumable', 'CONSUMABLE', 500],
  ['Oxygen Support', 'Respiratory', 'OXYGEN', 700],
  ['Patient Monitoring', 'Monitoring', 'MONITORING', 400],
  ['Diet Meal', 'Dietary', 'DIET_ORDER', 250],
  ['Medical Certificate', 'Documentation', 'DOCUMENTATION', 200],
].map(([name, category, trigger_code, amount]) => ({ name, category, trigger_code, amount, is_active: true }));

const VALID_TRIGGERS = new Set(FEE_TRIGGERS.map(t => t.code));
const PAYMENT_MODES = new Set(['CASH', 'CARD', 'UPI', 'NET_BANKING', 'INSURANCE_CASHLESS', 'CORPORATE_CREDIT', 'CHEQUE', 'ONLINE']);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const nextAutomaticBillNo = async (db, hospitalId) => {
  const bills = await db.bill.findMany({ where: { hospital_id: hospitalId }, select: { bill_no: true } });
  const maxNumber = bills.reduce((max, bill) => {
    if (!/^\d+$/.test(String(bill.bill_no || ''))) return max;
    return Math.max(max, Number(bill.bill_no));
  }, 0);
  let next = Math.max(1, maxNumber + 1);
  while (await db.bill.findUnique({ where: { bill_no: String(next) }, select: { id: true } })) next += 1;
  return String(next);
};

const manualMedicineName = (item) => String(item.medicine_name || item.item_name || item.description || '').trim();

const normalizeManualMedicineItems = async (tx, hospitalId, rawItems = []) => {
  const rows = [];
  const stockMovements = [];

  for (const raw of rawItems) {
    const medicineName = manualMedicineName(raw);
    if (!medicineName) continue;

    const quantity = toFloat(raw.quantity ?? raw.qty ?? 0, 'medicine quantity');
    if (quantity <= 0) badRequest(`Quantity must be greater than zero for ${medicineName}`);
    const itemId = String(raw.item_id || '').trim();
    const quantityUnit = String(raw.quantity_unit || 'LOOSE').toUpperCase() === 'PACK' ? 'PACK' : 'LOOSE';

    if (!itemId) {
      const saleRate = toFloat(raw.sale_rate ?? raw.unit_price ?? 0, `${medicineName} sale rate`);
      if (saleRate <= 0) badRequest(`Sale rate must be greater than zero for ${medicineName}`);
      const mrp = raw.mrp === '' || raw.mrp === undefined || raw.mrp === null ? null : toFloat(raw.mrp, `${medicineName} MRP`);
      if (mrp !== null && mrp < saleRate) badRequest(`${medicineName} sale rate cannot exceed MRP`);
      rows.push({
        category: 'Pharmacy', description: medicineName, quantity, unit_price: saleRate, total: quantity * saleRate,
        item_id: null, company_name: String(raw.company_name || '').trim() || null, quantity_unit: quantityUnit, pack: String(raw.pack || '').trim() || null, batch_no: String(raw.batch_no || raw.batch || '').trim() || null,
        expiry_date: raw.expiry_date || raw.exp ? toDate(raw.expiry_date || raw.exp, `${medicineName} expiry`) : null,
        mrp, sale_rate: saleRate,
      });
      continue;
    }

    const item = await tx.pharmacyItem.findFirst({
      where: { id: itemId, hospital_id: hospitalId },
      include: { batches: { where: { quantity_rem: { gt: 0 }, expiry_date: { gte: new Date() } }, orderBy: [{ expiry_date: 'asc' }, { created_at: 'asc' }] } },
    });
    if (!item) badRequest(`Medicine not found in this hospital inventory: ${medicineName}`);

    const unitsPerPack = Number(item.units_per_pack || 1);
    const baseQuantity = quantityUnit === 'PACK' ? quantity * unitsPerPack : quantity;
    const requestedBatch = String(raw.batch_no || raw.batch || '').trim();
    const batch = (requestedBatch ? item.batches.find(candidate => candidate.batch_no === requestedBatch) : item.batches[0]);
    if (!batch) badRequest(`${medicineName} has no usable batch available`);
    if (Number(batch.quantity_rem || 0) < baseQuantity) badRequest(`Insufficient stock for ${medicineName} in batch ${batch.batch_no}`);

    const defaultMrp = Number(batch.mrp || 0) / (quantityUnit === 'PACK' ? 1 : unitsPerPack);
    const defaultSaleRate = Number(batch.selling_price || batch.mrp || 0) / (quantityUnit === 'PACK' ? 1 : unitsPerPack);
    const mrp = raw.mrp === '' || raw.mrp === undefined || raw.mrp === null ? defaultMrp : toFloat(raw.mrp, `${medicineName} MRP`);
    const saleRate = raw.sale_rate === '' || raw.sale_rate === undefined || raw.sale_rate === null
      ? defaultSaleRate
      : toFloat(raw.sale_rate, `${medicineName} sale rate`);
    if (mrp <= 0 || saleRate <= 0) badRequest(`MRP and sale rate are required for ${medicineName}`);
    if (saleRate > mrp) badRequest(`${medicineName} sale rate cannot exceed MRP`);

    rows.push({
      category: 'Pharmacy', description: medicineName, quantity, unit_price: saleRate, total: quantity * saleRate,
      item_id: item.id, company_name: String(raw.company_name || '').trim() || null, quantity_unit: quantityUnit,
      pack: String(raw.pack || `${unitsPerPack} ${item.unit || 'units'} / ${item.pack_unit || 'pack'}`).trim(),
      batch_no: batch.batch_no, expiry_date: batch.expiry_date, mrp, sale_rate: saleRate,
    });
    stockMovements.push({ item_id: item.id, batch_no: batch.batch_no, quantity: baseQuantity, unit_price: saleRate });
  }

  return { rows, stockMovements };
};

const normalizeEditableBillItems = (rawItems = []) => rawItems.reduce((rows, raw) => {
  const description = manualMedicineName(raw);
  if (!description) return rows;

  const quantity = toFloat(raw.quantity ?? raw.qty ?? 1, 'quantity');
  if (quantity <= 0) badRequest('Quantity must be greater than zero');
  const unitPrice = toFloat(raw.sale_rate ?? raw.unit_price ?? 0, description + ' rate');
  if (unitPrice < 0) badRequest(description + ' rate cannot be negative');
  const mrp = raw.mrp === '' || raw.mrp === undefined || raw.mrp === null ? null : toFloat(raw.mrp, description + ' MRP');
  if (mrp !== null && mrp < unitPrice) badRequest(description + ' rate cannot exceed MRP');
  const expiryValue = raw.expiry_date || raw.exp;
  const quantityUnit = String(raw.quantity_unit || 'LOOSE').toUpperCase() === 'PACK' ? 'PACK' : 'LOOSE';

  rows.push({
    category: raw.category || 'Other',
    description,
    quantity,
    unit_price: unitPrice,
    total: quantity * unitPrice,
    item_id: String(raw.item_id || '').trim() || null,
    company_name: String(raw.company_name || '').trim() || null,
    quantity_unit: quantityUnit,
    pack: String(raw.pack || '').trim() || null,
    batch_no: String(raw.batch_no || raw.batch || '').trim() || null,
    expiry_date: expiryValue ? toDate(expiryValue, description + ' expiry') : null,
    mrp,
    sale_rate: raw.sale_rate === '' || raw.sale_rate === undefined || raw.sale_rate === null ? null : unitPrice,
  });
  return rows;
}, []);

const normalizeFee = (body) => {
  const name = String(body.name || '').trim();
  const category = String(body.category || 'Other').trim() || 'Other';
  const trigger_code = String(body.trigger_code || 'MANUAL').trim().toUpperCase();
  if (!name) badRequest('Fee name is required');
  if (!VALID_TRIGGERS.has(trigger_code)) badRequest('Invalid fee trigger');
  const amount = toFloat(body.amount, 'amount');
  if (amount < 0) badRequest('Amount cannot be negative');
  return {
    name,
    category,
    trigger_code,
    amount,
    is_active: body.is_active === undefined ? true : body.is_active === true || body.is_active === 'true',
  };
};

const latestBillCutoff = async (tx, hospitalId, patientId) => {
  const latest = await tx.bill.findFirst({
    where: { hospital_id: hospitalId, patient_id: patientId, status: { notIn: ['CANCELLED'] } },
    orderBy: { created_at: 'desc' },
    select: { created_at: true },
  });
  return latest?.created_at || new Date(0);
};

const admissionNightsSince = (admissions, since, now) => admissions.reduce((sum, admission) => {
  const rawStart = new Date(admission.admission_date);
  const rawEnd = admission.discharge_date ? new Date(admission.discharge_date) : now;
  if (rawEnd <= since && admission.status !== 'ADMITTED') return sum;
  const start = rawStart > since ? rawStart : since;
  const end = rawEnd > now ? now : rawEnd;
  if (end <= start) return sum + 1;
  return sum + Math.max(1, Math.ceil((end - start) / MS_PER_DAY));
}, 0);

const countUsedServices = async (tx, hospitalId, patient, since) => {
  const now = new Date();
  const patientRefs = [patient.id, patient.uhid].filter(Boolean);
  const [
    consultation,
    admissions,
    labTests,
    radiology,
    pharmacy,
    ambulance,
    emergency,
    ot,
    dietary,
  ] = await Promise.all([
    tx.appointment.count({
      where: {
        hospital_id: hospitalId,
        patient_id: patient.id,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        OR: [{ created_at: { gt: since } }, { checked_in_at: { gt: since } }, { completed_at: { gt: since } }],
      },
    }),
    tx.admission.findMany({
      where: {
        hospital_id: hospitalId,
        patient_id: patient.id,
        OR: [{ admission_date: { gt: since } }, { discharge_date: { gt: since } }, { status: 'ADMITTED' }],
      },
      select: { admission_date: true, discharge_date: true, status: true },
    }),
    tx.labOrderItem.count({
      where: { order: { hospital_id: hospitalId, patient_id: patient.id, created_at: { gt: since } } },
    }),
    tx.radiologyOrder.count({
      where: { hospital_id: hospitalId, patient_id: patient.id, created_at: { gt: since } },
    }),
    tx.dispense.count({
      where: { hospital_id: hospitalId, patient_id: patient.id, dispensed_at: { gt: since } },
    }),
    tx.ambulanceTrip.count({
      where: { patient_id: { in: patientRefs }, call_time: { gt: since }, ambulance: { hospital_id: hospitalId } },
    }),
    tx.emergencyCase.count({
      where: { hospital_id: hospitalId, patient_id: { in: patientRefs }, created_at: { gt: since } },
    }),
    tx.oTRecord.count({
      where: { hospital_id: hospitalId, created_at: { gt: since }, admission: { patient_id: patient.id } },
    }),
    tx.dietOrder.count({
      where: { patient_id: patient.id, created_at: { gt: since }, patient: { hospital_id: hospitalId } },
    }),
  ]);

  return {
    CONSULTATION: consultation,
    REGISTRATION: consultation,
    ADMISSION_PER_NIGHT: admissionNightsSince(admissions, since, now),
    NURSING_PER_DAY: admissionNightsSince(admissions, since, now),
    ICU_PER_DAY: admissionNightsSince(admissions, since, now),
    LAB_TEST: 0,
    RADIOLOGY_STUDY: radiology,
    PHARMACY_DISPENSE: pharmacy,
    AMBULANCE_TRIP: ambulance,
    EMERGENCY_VISIT: emergency,
    OT_PROCEDURE: ot,
    ANESTHESIA: ot,
    PROCEDURE: emergency + ot,
    CONSUMABLE: labTests + radiology + ot,
    OXYGEN: emergency,
    MONITORING: admissionNightsSince(admissions, since, now) + emergency,
    DIET_ORDER: dietary,
    DOCUMENTATION: 0,
  };
};

const buildAutoBillItems = async (tx, hospitalId, patientId) => {
  const [fees, patient] = await Promise.all([
    tx.serviceFee.findMany({
      where: { hospital_id: hospitalId, is_active: true, trigger_code: { notIn: ['MANUAL', 'LAB_TEST'] } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    tx.patient.findFirst({
      where: { id: patientId, hospital_id: hospitalId },
      select: { id: true, uhid: true },
    }),
  ]);
  if (!patient || !fees.length) return { items: [], since: null };

  const since = await latestBillCutoff(tx, hospitalId, patientId);
  const usage = await countUsedServices(tx, hospitalId, patient, since);
  const items = fees
    .map(fee => {
      const quantity = usage[fee.trigger_code] || 0;
      const unit_price = Number(fee.amount || 0);
      return {
        category: fee.category || 'Other',
        description: fee.name,
        quantity,
        unit_price,
        total: quantity * unit_price,
      };
    })
    .filter(item => item.quantity > 0 && item.unit_price > 0);

  return { items, since };
};

router.get('/fee-triggers', (req, res) => {
  res.json({ success: true, data: FEE_TRIGGERS });
});

router.get('/fees', async (req, res) => {
  const fees = await prisma.serviceFee.findMany({
    where: { hospital_id: req.hospitalId, trigger_code: { not: 'LAB_TEST' } },
    orderBy: [{ is_active: 'desc' }, { category: 'asc' }, { name: 'asc' }],
  });
  res.json({ success: true, data: fees });
});

router.post('/fees', async (req, res) => {
  const fee = await prisma.serviceFee.create({
    data: { id: uuidv4(), hospital_id: req.hospitalId, ...normalizeFee(req.body) },
  });
  res.status(201).json({ success: true, data: fee });
});

router.post('/fees/defaults', async (req, res) => {
  let created = 0;
  for (const fee of DEFAULT_SERVICE_FEES) {
    const exists = await prisma.serviceFee.findFirst({
      where: { hospital_id: req.hospitalId, trigger_code: fee.trigger_code, name: fee.name },
      select: { id: true },
    });
    if (!exists) {
      await prisma.serviceFee.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, ...fee } });
      created += 1;
    }
  }
  res.status(201).json({ success: true, data: { created } });
});

router.put('/fees/:id', async (req, res) => {
  const existing = await prisma.serviceFee.findFirst({ where: { id: req.params.id, hospital_id: req.hospitalId } });
  if (!existing) return res.status(404).json({ success: false, message: 'Fee not found' });
  const fee = await prisma.serviceFee.update({
    where: { id: req.params.id },
    data: normalizeFee(req.body),
  });
  res.json({ success: true, data: fee });
});

router.patch('/fees/:id/status', async (req, res) => {
  const existing = await prisma.serviceFee.findFirst({ where: { id: req.params.id, hospital_id: req.hospitalId } });
  if (!existing) return res.status(404).json({ success: false, message: 'Fee not found' });
  const fee = await prisma.serviceFee.update({
    where: { id: req.params.id },
    data: { is_active: req.body.is_active === true || req.body.is_active === 'true' },
  });
  res.json({ success: true, data: fee });
});


const ROOM_TYPE_DEFAULT_RATES = {
  GENERAL: 1500,
  SEMI_PRIVATE: 2500,
  PRIVATE: 4000,
  DELUXE: 6000,
  ICU: 8000,
  HDU: 5500,
  NICU: 7000,
  PICU: 7000,
  LABOUR: 4500,
};

router.get('/room-rates', async (req, res) => {
  const beds = await prisma.bed.findMany({
    where: { hospital_id: req.hospitalId },
    orderBy: [{ ward: 'asc' }, { bed_type: 'asc' }, { bed_no: 'asc' }],
    select: { id: true, ward: true, room_no: true, bed_no: true, floor: true, bed_type: true, status: true, rate_per_day: true },
  });
  res.json({
    success: true,
    data: beds.map(b => ({
      ...b,
      room_type: b.bed_type,
      daily_rate: Number(b.rate_per_day || 0),
      rate_per_day: Number(b.rate_per_day || 0),
    })),
  });
});

router.post('/room-rates/seed', async (req, res) => {
  const beds = await prisma.bed.findMany({ where: { hospital_id: req.hospitalId }, select: { id: true, bed_type: true, rate_per_day: true } });
  let updated = 0;
  for (const bed of beds) {
    const current = Number(bed.rate_per_day || 0);
    const next = ROOM_TYPE_DEFAULT_RATES[bed.bed_type] || 1500;
    if (current <= 0) {
      await prisma.bed.update({ where: { id: bed.id }, data: { rate_per_day: next } });
      updated += 1;
    }
  }
  res.status(201).json({ success: true, data: { created: updated, updated } });
});

router.patch('/room-rates/:id', async (req, res) => {
  const bed = await prisma.bed.findFirst({ where: { id: req.params.id, hospital_id: req.hospitalId } });
  if (!bed) return res.status(404).json({ success: false, message: 'Bed rate not found' });
  const rate = toFloat(req.body.rate_per_day ?? req.body.daily_rate, 'daily_rate');
  if (rate < 0) badRequest('Daily rate cannot be negative');
  const updated = await prisma.bed.update({ where: { id: bed.id }, data: { rate_per_day: rate } });
  res.json({ success: true, data: { ...updated, room_type: updated.bed_type, daily_rate: Number(updated.rate_per_day || 0) } });
});
router.get('/auto-items', async (req, res) => {
  const patientId = await resolvePatientId(prisma, req.hospitalId, req.query.patient_id);
  const result = await buildAutoBillItems(prisma, req.hospitalId, patientId);
  res.json({ success: true, data: result.items, meta: { since: result.since } });
});

router.get('/bills', async (req, res) => {
  const { status, type, type_group, patient_id, page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  if (type_group === 'PHARMACY') {
    const [realBills, logs] = await Promise.all([
      prisma.bill.findMany({
        where: { hospital_id: req.hospitalId, type: 'PHARMACY', ...(status && { status }) },
        orderBy: { created_at: 'desc' },
        include: { patient: { select: { first_name: true, last_name: true, uhid: true } }, items: true, payments: true },
      }),
      prisma.auditLog.findMany({
        where: { hospital_id: req.hospitalId, module: 'PHARMACY', action: { in: ['DISPENSE_FEFO', 'WALK_IN_SALE'] } },
        orderBy: { created_at: 'desc' },
      }),
    ]);
    const patientIds = [...new Set(logs.map(l => l.new_values?.patient_id).filter(Boolean))];
    const patients = patientIds.length ? await prisma.patient.findMany({ where: { id: { in: patientIds }, hospital_id: req.hospitalId }, select: { id: true, first_name: true, last_name: true, uhid: true } }) : [];
    const patientMap = new Map(patients.map(p => [p.id, p]));
    const auditBills = logs.filter(l => l.new_values?.invoice && !l.new_values?.bill_id).map(l => {
      const v = l.new_values; const invoice = v.invoice;
      return { id: l.id, bill_no: v.dispense_no || invoice.invoice_no, type: 'PHARMACY', status: 'PAID', created_at: l.created_at,
        patient: patientMap.get(v.patient_id) || (v.customer?.name ? { first_name: v.customer.name, last_name: '', uhid: 'Walk-in' } : null),
        subtotal: invoice.subtotal, tax_amt: invoice.tax_total, total_amt: invoice.payable, paid_amt: invoice.payable, due_amt: 0,
        payment_mode: v.payment_method || 'NOT_RECORDED', items: (invoice.items || []).map(i => ({ category: 'Pharmacy', description: i.item_name, quantity: i.quantity, unit_price: i.unit_price, total: i.line_total })) };
    });
    const bills = [...realBills, ...auditBills].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const paged = bills.slice(skip, skip + parseInt(limit));
    return res.json({ success: true, data: paged, meta: { total: bills.length, page: parseInt(page), pages: Math.ceil(bills.length / parseInt(limit)) || 1 } });
  }
  const typeFilter = type_group === 'OPD'
    ? { type: 'OPD' }
    : type_group === 'IPD'
      ? { type: { in: ['IPD_INTERIM', 'IPD_FINAL', 'PACKAGE'] } }
      : type
        ? { type }
        : {};
  const where = {
    hospital_id: req.hospitalId,
    ...(status && { status }),
    ...typeFilter,
    ...(patient_id && { patient_id: await resolvePatientId(prisma, req.hospitalId, patient_id) }),
  };
  const [bills, total] = await Promise.all([
    prisma.bill.findMany({ where, skip, take: parseInt(limit), orderBy: { created_at: 'desc' }, include: { patient: { select: { first_name: true, last_name: true, uhid: true } }, items: true, payments: true } }),
    prisma.bill.count({ where }),
  ]);
  res.json({ success: true, data: bills, meta: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
});

router.get('/bills/:id', async (req, res) => {
  const bill = await prisma.bill.findFirst({ where: { id: req.params.id, hospital_id: req.hospitalId }, include: { patient: true, items: true, payments: true } });
  if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });
  res.json({ success: true, data: bill });
});

router.put('/bills/:id', async (req, res) => {
  const existing = await prisma.bill.findFirst({
    where: { id: req.params.id, hospital_id: req.hospitalId },
    include: { items: true, payments: true },
  });
  if (!existing) return res.status(404).json({ success: false, message: 'Bill not found' });
  if (existing.status === 'CANCELLED' || existing.status === 'REFUNDED') badRequest('Cancelled or refunded bills cannot be edited');

  const requestedBillNo = String(req.body.bill_no || existing.bill_no).trim();
  if (!requestedBillNo) badRequest('Bill number is required');
  if (requestedBillNo.length > 100) badRequest('Bill number cannot exceed 100 characters');
  if (requestedBillNo !== existing.bill_no) {
    const duplicateBill = await prisma.bill.findUnique({ where: { bill_no: requestedBillNo }, select: { id: true } });
    if (duplicateBill) badRequest('Bill number already exists: ' + requestedBillNo);
  }

  const patientName = String(req.body.patient_name || existing.patient_name || '').trim();
  if (!patientName) badRequest('Patient name is required');
  const rawItems = [
    ...(Array.isArray(req.body.items) ? req.body.items : []),
    ...(Array.isArray(req.body.medicine_items) ? req.body.medicine_items.map(item => ({ ...item, category: 'Pharmacy', description: manualMedicineName(item) })) : []),
  ];
  const items = normalizeEditableBillItems(rawItems);
  if (!items.length) badRequest('Add at least one bill item description');

  const billData = sanitizeModelInput('Bill', req.body, {
    exclude: ['id', 'hospital_id', 'bill_no', 'patient_id', 'admission_id', 'status', 'subtotal', 'discount_amt', 'tax_amt', 'total_amt', 'paid_amt', 'due_amt', 'created_at', 'updated_at'],
  });
  const billDate = req.body.bill_date ? toDate(req.body.bill_date, 'invoice date') : existing.bill_date;
  if (!billDate) badRequest('Invoice date and time are required');
  const discountPct = req.body.discount_pct === undefined ? Number(existing.discount_pct || 0) : toFloat(req.body.discount_pct, 'discount percentage');
  if (discountPct < 0 || discountPct > 100) badRequest('Discount percentage must be between 0 and 100');
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discountAmt = subtotal * (discountPct / 100);
  const totalAmt = subtotal - discountAmt;
  const paidAmt = Number(existing.paid_amt || 0);
  if (totalAmt < paidAmt) badRequest('Bill total cannot be less than the amount already paid');
  const dueAmt = Math.max(0, totalAmt - paidAmt);
  const status = paidAmt >= totalAmt ? 'PAID' : paidAmt > 0 ? 'PARTIAL_PAID' : 'GENERATED';

  const updated = await prisma.$transaction(async (tx) => tx.bill.update({
    where: { id: existing.id },
    data: {
      ...billData,
      bill_no: requestedBillNo,
      patient_name: patientName,
      bill_date: billDate,
      discount_pct: discountPct,
      subtotal,
      discount_amt: discountAmt,
      tax_amt: 0,
      total_amt: totalAmt,
      paid_amt: paidAmt,
      due_amt: dueAmt,
      status,
      items: {
        deleteMany: {},
        create: items.map(item => ({ id: uuidv4(), ...item })),
      },
    },
    include: { patient: { select: { first_name: true, last_name: true, uhid: true } }, items: true, payments: true },
  }));

  res.json({ success: true, data: updated, message: 'Bill updated successfully' });
});

router.post('/bills', async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const medicineItems = Array.isArray(req.body.medicine_items) ? req.body.medicine_items : [];

  const billData = sanitizeModelInput('Bill', req.body, {
    exclude: ['id', 'hospital_id', 'bill_no', 'patient_id', 'status', 'subtotal', 'discount_amt', 'tax_amt', 'total_amt', 'paid_amt', 'due_amt', 'created_at', 'updated_at'],
  });
  const patientReference = String(req.body.patient_id || '').trim();
  const typedPatientName = String(req.body.patient_name || '').trim();
  let resolvedPatientId = null;
  if (patientReference) {
    try {
      resolvedPatientId = await resolvePatientId(prisma, req.hospitalId, patientReference);
    } catch (error) {
      // A manual bill may be issued against a typed patient name even when
      // that person has not been registered yet. Preserve the typed name;
      // registered patients still resolve and remain linked normally.
      if (!typedPatientName || patientReference !== typedPatientName) throw error;
    }
  }
  if (!resolvedPatientId && !typedPatientName) badRequest('Patient name is required');
  if (!billData.bill_date) badRequest('Invoice date and time are required');
  billData.patient_id = resolvedPatientId;
  billData.patient_name = typedPatientName || null;
  if (!billData.type) badRequest('Bill type is required');
  if (['IPD_INTERIM', 'IPD_FINAL', 'PACKAGE'].includes(billData.type) && billData.patient_id) {
    const admission = await prisma.admission.findFirst({
      where: { hospital_id: req.hospitalId, patient_id: billData.patient_id, ...(req.body.admission_id ? { id: req.body.admission_id } : { status: 'ADMITTED' }) },
      orderBy: { admission_date: 'desc' }, select: { id: true },
    });
    if (!admission) badRequest('No matching IPD admission found for this patient');
    billData.admission_id = admission.id;
  }

  const bill_no = await nextAutomaticBillNo(prisma, req.hospitalId);

  const manualItems = items.filter(item => item.description).map(item => {
    const quantity = item.quantity ? toInt(item.quantity, 'quantity') : 1;
    const unit_price = toFloat(item.unit_price, 'unit_price');
    return {
      category: item.category || 'Other',
      description: item.description,
      quantity,
      unit_price,
      total: quantity * unit_price,
    };
  });

  const autoItems = req.body.auto_apply === true || req.body.auto_apply === 'true'
    ? (billData.patient_id ? (await buildAutoBillItems(prisma, req.hospitalId, billData.patient_id)).items : [])
    : [];
  const billItems = [...autoItems, ...manualItems];

  if (!billItems.length && !medicineItems.some(item => manualMedicineName(item))) badRequest('Add at least one bill item description');

  const subtotal = billItems.reduce((sum, item) => sum + item.total, 0);
  const discount_pct = billData.discount_pct || 0;
  const discount_amt = subtotal * (discount_pct / 100);
  const tax_amt = 0;
  const total_amt = subtotal - discount_amt + tax_amt;
  const collectNow = req.body.collect_payment === true || req.body.collect_payment === 'true';
  if (billData.payment_mode && !PAYMENT_MODES.has(billData.payment_mode)) badRequest('Invalid payment mode');
  const paid_amt = collectNow && billData.payment_mode ? total_amt : 0;
  const due_amt = Math.max(0, total_amt - paid_amt);

  const bill = await prisma.$transaction(async (tx) => {
    const normalizedMedicine = await normalizeManualMedicineItems(tx, req.hospitalId, medicineItems);
    const allBillItems = [...billItems, ...normalizedMedicine.rows];
    if (!allBillItems.length) badRequest('Add at least one bill item description');
    const subtotal = allBillItems.reduce((sum, item) => sum + item.total, 0);
    const discount_pct = Number(billData.discount_pct || 0);
    const discount_amt = subtotal * (discount_pct / 100);
    const tax_amt = 0;
    const total_amt = subtotal - discount_amt + tax_amt;
    const paid_amt = collectNow && billData.payment_mode ? total_amt : 0;
    const due_amt = Math.max(0, total_amt - paid_amt);

    if (normalizedMedicine.stockMovements.length) {
      const dispense = await tx.dispense.create({
        data: {
          id: uuidv4(),
          hospital_id: req.hospitalId,
          dispense_no: `IPD-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`,
          patient_id: billData.patient_id,
          dispensed_by: req.user.id,
          notes: `Manual IPD medicine billing${billData.patient_name ? ` · Patient: ${billData.patient_name}` : ''}${billData.doctor_name ? ` · Doctor: ${billData.doctor_name}` : ''}`,
          items: { create: normalizedMedicine.stockMovements.map(movement => ({ id: uuidv4(), ...movement })) },
        },
      });
      for (const movement of normalizedMedicine.stockMovements) {
        await tx.pharmacyItem.update({ where: { id: movement.item_id }, data: { current_stock: { decrement: movement.quantity } } });
        await tx.drugBatch.updateMany({ where: { item_id: movement.item_id, batch_no: movement.batch_no }, data: { quantity_rem: { decrement: movement.quantity } } });
      }
      // Keep the stock movement linked to this bill in the audit trail without
      // introducing a second bill or charging the patient twice.
      await tx.auditLog.create({
        data: {
          id: uuidv4(), hospital_id: req.hospitalId, user_id: req.user.id, module: 'PHARMACY', action: 'MANUAL_IPD_BILL', record_id: dispense.id,
          new_values: { patient_id: billData.patient_id, doctor_name: billData.doctor_name || null, medicine_items: normalizedMedicine.rows },
        },
      });
    }

    const existingIpdBill = billData.admission_id
      ? await tx.bill.findFirst({ where: { hospital_id: req.hospitalId, admission_id: billData.admission_id }, include: { items: true, payments: true, patient: { select: { first_name: true, last_name: true, uhid: true } } } })
      : null;
    if (existingIpdBill) {
      const previousSubtotal = Number(existingIpdBill.subtotal || 0);
      const addedSubtotal = allBillItems.reduce((sum, item) => sum + item.total, 0);
      const mergedSubtotal = previousSubtotal + addedSubtotal;
      const mergedDiscount = Number(existingIpdBill.discount_amt || 0) + discount_amt;
      const mergedTotal = mergedSubtotal - mergedDiscount;
      const addedPayment = collectNow && billData.payment_mode ? Math.max(0, mergedTotal - Number(existingIpdBill.paid_amt || 0)) : 0;
      if (addedPayment > 0) await tx.payment.create({ data: { id: uuidv4(), bill_id: existingIpdBill.id, amount: addedPayment, mode: billData.payment_mode, reference_no: req.body.payment_reference || null, received_by: req.user.id } });
      return tx.bill.update({ where: { id: existingIpdBill.id }, data: {
        type: billData.type,
        doctor_name: billData.doctor_name || existingIpdBill.doctor_name,
        patient_name: billData.patient_name || existingIpdBill.patient_name,
        patient_address: billData.patient_address || existingIpdBill.patient_address,
        patient_mobile: billData.patient_mobile || existingIpdBill.patient_mobile,
        bill_date: existingIpdBill.bill_date,
        admission_date: billData.admission_date || existingIpdBill.admission_date,
        subtotal: mergedSubtotal, discount_amt: mergedDiscount, tax_amt: 0, total_amt: mergedTotal,
        paid_amt: Number(existingIpdBill.paid_amt || 0) + addedPayment, due_amt: Math.max(0, mergedTotal - Number(existingIpdBill.paid_amt || 0) - addedPayment),
        status: addedPayment >= mergedTotal - Number(existingIpdBill.paid_amt || 0) ? 'PAID' : 'GENERATED',
        items: { create: allBillItems.map(item => ({ id: uuidv4(), ...item })) },
      }, include: { patient: { select: { first_name: true, last_name: true, uhid: true } }, items: true, payments: true } });
    }
    const created = await tx.bill.create({
      data: {
        id: uuidv4(), hospital_id: req.hospitalId, bill_no, ...billData,
        subtotal, discount_pct, discount_amt, tax_amt, total_amt, paid_amt, due_amt,
        status: paid_amt >= total_amt ? 'PAID' : 'GENERATED',
        items: { create: allBillItems.map(item => ({ id: uuidv4(), ...item })) },
      },
      include: { patient: { select: { first_name: true, last_name: true, uhid: true } }, items: true, payments: true },
    });
    if (paid_amt > 0) {
      await tx.payment.create({
        data: {
          id: uuidv4(),
          bill_id: created.id,
          amount: paid_amt,
          mode: billData.payment_mode,
          reference_no: req.body.payment_reference || null,
          received_by: req.user.id,
        },
      });
    }
    return tx.bill.findUnique({ where: { id: created.id }, include: { patient: { select: { first_name: true, last_name: true, uhid: true } }, items: true, payments: true } });
  });
  res.status(201).json({ success: true, data: bill });
});

router.post('/bills/:id/payment', async (req, res) => {
  const paymentData = sanitizeModelInput('Payment', req.body, {
    exclude: ['id', 'bill_id', 'paid_at', 'received_by'],
  });
  if (!paymentData.amount || !paymentData.mode) badRequest('Payment amount and mode are required');

  const bill = await prisma.bill.findUnique({ where: { id: req.params.id } });
  if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

  const newPaid = parseFloat(bill.paid_amt.toString()) + parseFloat(paymentData.amount);
  const newDue  = parseFloat(bill.total_amt.toString()) - newPaid;
  const newStatus = newDue <= 0 ? 'PAID' : 'PARTIAL_PAID';

  const [payment] = await prisma.$transaction([
    prisma.payment.create({ data: { id: uuidv4(), bill_id: req.params.id, ...paymentData, received_by: req.user.id } }),
    prisma.bill.update({ where: { id: req.params.id }, data: { paid_amt: newPaid, due_amt: Math.max(0, newDue), status: newStatus } }),
  ]);

  res.json({ success: true, message: 'Payment recorded', data: { payment, status: newStatus } });
});

router.get('/summary', async (req, res) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const opdWhere = { hospital_id: req.hospitalId, type: 'OPD' };
  const ipdWhere = { hospital_id: req.hospitalId, type: { in: ['IPD_INTERIM', 'IPD_FINAL', 'PACKAGE'] } };
  const pharmacyWhere = { hospital_id: req.hospitalId, type: 'PHARMACY' };
  const [collected, outstanding, bills_today, opd_total, ipd_total, pharmacy_total, opd_outstanding, ipd_outstanding, pharmacy_outstanding, pharmacyLogs] = await Promise.all([
    prisma.payment.aggregate({ where: { bill: { hospital_id: req.hospitalId }, paid_at: { gte: today } }, _sum: { amount: true } }),
    prisma.bill.aggregate({ where: { hospital_id: req.hospitalId, due_amt: { gt: 0 }, status: { notIn: ['CANCELLED'] } }, _sum: { due_amt: true } }),
    prisma.bill.count({ where: { hospital_id: req.hospitalId, created_at: { gte: today } } }),
    prisma.bill.aggregate({ where: opdWhere, _sum: { total_amt: true }, _count: { _all: true } }),
    prisma.bill.aggregate({ where: ipdWhere, _sum: { total_amt: true }, _count: { _all: true } }),
    prisma.bill.aggregate({ where: pharmacyWhere, _sum: { total_amt: true }, _count: { _all: true } }),
    prisma.bill.aggregate({ where: { ...opdWhere, due_amt: { gt: 0 }, status: { notIn: ['CANCELLED'] } }, _sum: { due_amt: true } }),
    prisma.bill.aggregate({ where: { ...ipdWhere, due_amt: { gt: 0 }, status: { notIn: ['CANCELLED'] } }, _sum: { due_amt: true } }),
    prisma.bill.aggregate({ where: { ...pharmacyWhere, due_amt: { gt: 0 }, status: { notIn: ['CANCELLED'] } }, _sum: { due_amt: true } }),
    prisma.auditLog.findMany({ where: { hospital_id: req.hospitalId, module: 'PHARMACY', action: { in: ['DISPENSE_FEFO', 'WALK_IN_SALE'] } }, select: { new_values: true, created_at: true } }),
  ]);
  const pharmacyInvoices = pharmacyLogs.filter(l => !l.new_values?.bill_id).map(l => l.new_values?.invoice).filter(Boolean);
  const pharmacyToday = pharmacyLogs.filter(l => l.created_at >= today && l.new_values?.invoice && !l.new_values?.bill_id);
  const pharmacyCollectedToday = pharmacyToday.reduce((sum, l) => sum + Number(l.new_values.invoice.payable || 0), 0);
  const pharmacyWalkInRevenue = pharmacyInvoices.reduce((sum, invoice) => sum + Number(invoice.payable || 0), 0);
  res.json({
    success: true,
    data: {
      collected_today: Number(collected._sum.amount || 0) + pharmacyCollectedToday,
      total_outstanding: outstanding._sum.due_amt || 0,
      bills_today: bills_today + pharmacyToday.length,
      opd: { count: opd_total._count._all || 0, revenue: opd_total._sum.total_amt || 0, outstanding: opd_outstanding._sum.due_amt || 0 },
      ipd: { count: ipd_total._count._all || 0, revenue: ipd_total._sum.total_amt || 0, outstanding: ipd_outstanding._sum.due_amt || 0 },
      pharmacy: {
        count: (pharmacy_total._count._all || 0) + pharmacyInvoices.length,
        revenue: Number(pharmacy_total._sum.total_amt || 0) + pharmacyWalkInRevenue,
        outstanding: pharmacy_outstanding._sum.due_amt || 0,
      },
    },
  });
});

module.exports = router;
