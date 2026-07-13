// src/routes/billing.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { badRequest, resolvePatientId, sanitizeModelInput, toFloat, toInt } = require('../utils/prismaInput');
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

router.post('/bills', async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];

  const billData = sanitizeModelInput('Bill', req.body, {
    exclude: ['id', 'hospital_id', 'bill_no', 'patient_id', 'status', 'subtotal', 'discount_amt', 'tax_amt', 'total_amt', 'paid_amt', 'due_amt', 'created_at', 'updated_at'],
  });
  billData.patient_id = await resolvePatientId(prisma, req.hospitalId, req.body.patient_id);
  if (!billData.type) badRequest('Bill type is required');
  if (['IPD_INTERIM', 'IPD_FINAL', 'PACKAGE'].includes(billData.type)) {
    const admission = await prisma.admission.findFirst({
      where: { hospital_id: req.hospitalId, patient_id: billData.patient_id, ...(req.body.admission_id ? { id: req.body.admission_id } : { status: 'ADMITTED' }) },
      orderBy: { admission_date: 'desc' }, select: { id: true },
    });
    if (!admission) badRequest('No matching IPD admission found for this patient');
    billData.admission_id = admission.id;
  }

  const bill_no = `BILL-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`;

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
    ? (await buildAutoBillItems(prisma, req.hospitalId, billData.patient_id)).items
    : [];
  const billItems = [...autoItems, ...manualItems];

  if (!billItems.length) badRequest('Add at least one bill item description');

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
    const existingIpdBill = billData.admission_id
      ? await tx.bill.findFirst({ where: { hospital_id: req.hospitalId, admission_id: billData.admission_id }, include: { items: true, payments: true, patient: { select: { first_name: true, last_name: true, uhid: true } } } })
      : null;
    if (existingIpdBill) {
      const previousSubtotal = Number(existingIpdBill.subtotal || 0);
      const addedSubtotal = billItems.reduce((sum, item) => sum + item.total, 0);
      const mergedSubtotal = previousSubtotal + addedSubtotal;
      const mergedDiscount = Number(existingIpdBill.discount_amt || 0) + discount_amt;
      const mergedTotal = mergedSubtotal - mergedDiscount;
      const addedPayment = collectNow && billData.payment_mode ? Math.max(0, mergedTotal - Number(existingIpdBill.paid_amt || 0)) : 0;
      if (addedPayment > 0) await tx.payment.create({ data: { id: uuidv4(), bill_id: existingIpdBill.id, amount: addedPayment, mode: billData.payment_mode, reference_no: req.body.payment_reference || null, received_by: req.user.id } });
      return tx.bill.update({ where: { id: existingIpdBill.id }, data: {
        type: billData.type, subtotal: mergedSubtotal, discount_amt: mergedDiscount, tax_amt: 0, total_amt: mergedTotal,
        paid_amt: Number(existingIpdBill.paid_amt || 0) + addedPayment, due_amt: Math.max(0, mergedTotal - Number(existingIpdBill.paid_amt || 0) - addedPayment),
        status: addedPayment >= mergedTotal - Number(existingIpdBill.paid_amt || 0) ? 'PAID' : 'GENERATED',
        items: { create: billItems.map(item => ({ id: uuidv4(), ...item })) },
      }, include: { patient: { select: { first_name: true, last_name: true, uhid: true } }, items: true, payments: true } });
    }
    const created = await tx.bill.create({
      data: {
        id: uuidv4(), hospital_id: req.hospitalId, bill_no, ...billData,
        subtotal, discount_pct, discount_amt, tax_amt, total_amt, paid_amt, due_amt,
        status: paid_amt >= total_amt ? 'PAID' : 'GENERATED',
        items: { create: billItems.map(item => ({ id: uuidv4(), ...item })) },
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
