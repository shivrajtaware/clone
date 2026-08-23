// src/routes/lab.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { badRequest, resolvePatientId, sanitizeModelInput, toFloat } = require('../utils/prismaInput');
const { emitToLab } = require('../config/socket');
router.use(auth);

const LAB_STATUSES = ['ORDERED', 'COLLECTED', 'IN_TRANSIT', 'RECEIVED', 'PROCESSING', 'RESULTED', 'VERIFIED', 'REPORTED', 'REJECTED'];
const PAYMENT_MODES = new Set(['CASH', 'CARD', 'UPI', 'NET_BANKING', 'INSURANCE_CASHLESS', 'CORPORATE_CREDIT', 'CHEQUE', 'ONLINE']);

// 👉 UPGRADE: Added the missing OPD tests to the default price book
const defaultLabTests = [
  ['Complete Blood Count', 'CBC', 'Hematology', 'Blood', '', '', 300],
  ['Liver Function Test', 'LFT', 'Biochemistry', 'Blood', '', '', 700],
  ['Renal Function Test', 'RFT', 'Biochemistry', 'Blood', '', '', 650],
  ['Electrolytes', 'ELEC', 'Biochemistry', 'Blood', 'mmol/L', '', 450],
  ['Troponin I', 'TROPI', 'Cardiac Markers', 'Blood', 'ng/L', '< 14', 1200],
  ['HbA1c', 'HBA1C', 'Biochemistry', 'Blood', '%', '4.0 - 5.6', 500],
  ['Blood Glucose - Fasting', 'FBS', 'Biochemistry', 'Blood', 'mg/dL', '70 - 100', 120],
  ['Blood Glucose - Random', 'RBS', 'Biochemistry', 'Blood', 'mg/dL', '70 - 140', 120],
  ['Lipid Profile', 'LIPID', 'Biochemistry', 'Blood', '', '', 800],
  ['PT/INR', 'PTINR', 'Coagulation', 'Blood', 'INR', '0.8 - 1.2', 500],
  ['Urine Routine', 'URINE', 'Urinalysis', 'Urine', '', '', 150],
  ['Dengue NS1 / IgM', 'DENGUE', 'Serology', 'Blood', '', '', 800],
  ['CRP', 'CRP', 'Biochemistry', 'Blood', 'mg/L', '< 10', 400],
  ['Malaria Parasite', 'MP', 'Hematology', 'Blood', '', 'Negative', 250],
].map(([name, code, category, sample_type, unit, ref_range, price]) => ({ name, code, category, sample_type, unit, ref_range, price }));

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const clean = value => String(value || '').trim();
const nextBillNo = async (tx, hospitalId) => {
  return `BILL-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`;
};
const normalizeLabTest = (body) => {
  const name = clean(body.name || body.test_name);
  if (!name) badRequest('Lab test name is required');
  const price = toFloat(body.price || 0, 'price');
  if (price < 0) badRequest('Price cannot be negative');
  return {
    name,
    code: clean(body.code || body.test_code) || null,
    category: clean(body.category) || null,
    sample_type: clean(body.sample_type) || null,
    unit: clean(body.unit) || null,
    ref_range: clean(body.ref_range) || null,
    price,
    is_active: body.is_active === undefined ? true : body.is_active === true || body.is_active === 'true',
  };
};

router.get('/tests', async (req, res) => {
  const tests = await prisma.labTest.findMany({
    where: { hospital_id: req.hospitalId, ...(req.query.active_only === 'true' && { is_active: true }) },
    orderBy: [{ is_active: 'desc' }, { category: 'asc' }, { name: 'asc' }],
  });
  res.json({ success: true, data: tests });
});

router.post('/tests/defaults', async (req, res) => {
  let created = 0;
  for (const test of defaultLabTests) {
    const existing = await prisma.labTest.findFirst({ where: { hospital_id: req.hospitalId, name: test.name }, select: { id: true } });
    if (!existing) {
      await prisma.labTest.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, ...test } });
      created += 1;
    }
  }
  res.status(201).json({ success: true, data: { created } });
});

router.post('/tests', async (req, res) => {
  const test = await prisma.labTest.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, ...normalizeLabTest(req.body) } });
  res.status(201).json({ success: true, data: test });
});

router.put('/tests/:id', async (req, res) => {
  const existing = await prisma.labTest.findFirst({ where: { id: req.params.id, hospital_id: req.hospitalId } });
  if (!existing) return res.status(404).json({ success: false, message: 'Lab test not found' });
  const test = await prisma.labTest.update({ where: { id: req.params.id }, data: normalizeLabTest(req.body) });
  res.json({ success: true, data: test });
});

router.patch('/tests/:id/status', async (req, res) => {
  const existing = await prisma.labTest.findFirst({ where: { id: req.params.id, hospital_id: req.hospitalId } });
  if (!existing) return res.status(404).json({ success: false, message: 'Lab test not found' });
  const test = await prisma.labTest.update({ where: { id: req.params.id }, data: { is_active: req.body.is_active === true || req.body.is_active === 'true' } });
  res.json({ success: true, data: test });
});

router.get('/orders', async (req, res) => {
  const { status, is_stat, page = 1, limit = 30 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = { hospital_id: req.hospitalId, ...(status && { status }), ...(is_stat === 'true' && { is_stat: true }) };
  const [orders, total] = await Promise.all([
    prisma.labOrder.findMany({
      where, skip, take: parseInt(limit), orderBy: [{ is_stat: 'desc' }, { created_at: 'desc' }],
      include: { 
        patient: { select: { first_name: true, last_name: true, uhid: true, phone: true, gender: true, dob: true } }, 
        items: true, 
        bill: { include: { items: true, payments: true } }, 
        ordered_by_user: { select: { first_name: true, last_name: true } } 
      },
    }),
    prisma.labOrder.count({ where }),
  ]);
  res.json({ success: true, data: orders, meta: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
});

router.post('/orders', async (req, res) => {
  const tests = Array.isArray(req.body.tests) ? req.body.tests : Array.isArray(req.body.items) ? req.body.items : [];
  if (!tests.length) badRequest('Select at least one lab test');

  const data = sanitizeModelInput('LabOrder', req.body, {
    exclude: ['id', 'hospital_id', 'order_no', 'patient_id', 'ordered_by', 'status', 'collected_at', 'received_at', 'reported_at', 'verified_by'],
  });
  data.patient_id = await resolvePatientId(prisma, req.hospitalId, req.body.patient_id);
  data.ordered_by = req.user.id;

  const count = await prisma.labOrder.count({ where: { hospital_id: req.hospitalId } });
  const order_no = `LAB-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
  
  // Look up by codes for robustness
  const testCodes = tests.map(t => clean(t.test_code || t.code)).filter(Boolean);
  const priced = testCodes.length ? await prisma.labTest.findMany({
    where: { hospital_id: req.hospitalId, code: { in: testCodes } },
  }) : [];
  const byCode = new Map(priced.map(t => [String(t.code).toUpperCase(), t]));

  const order = await prisma.labOrder.create({
    data: {
      id: uuidv4(), hospital_id: req.hospitalId, order_no, ...data,
      items: {
        create: tests.map(t => {
          const catalogue = byCode.get(String(clean(t.test_code || t.code)).toUpperCase());
          return {
          id: uuidv4(),
          test_name: t.test_name || t.name,
          test_code: t.test_code || t.code || catalogue?.code,
          category: t.category || catalogue?.category,
          unit: t.unit || catalogue?.unit,
          ref_range: t.ref_range || catalogue?.ref_range,
        };
        }),
      },
    },
    include: { 
      patient: { select: { first_name: true, last_name: true, uhid: true, phone: true, gender: true, dob: true } }, 
      items: true, 
      bill: { include: { items: true, payments: true } } 
    },
  });
  emitToLab(req.hospitalId,'lab:updated', { type: 'ORDER_CREATED'});
  res.status(201).json({ success: true, data: order });
});

router.post('/orders/:id/bill', async (req, res) => {
  const paymentMode = clean(req.body.payment_mode);
  if (paymentMode && !PAYMENT_MODES.has(paymentMode)) badRequest('Invalid payment mode');
  const collectNow = req.body.collect_payment === true || req.body.collect_payment === 'true';

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.labOrder.findFirst({
      where: { id: req.params.id, hospital_id: req.hospitalId },
      include: {
        patient: { select: { first_name: true, last_name: true, uhid: true, phone: true, gender: true, dob: true } },
        items: true,
        bill: { include: { items: true, payments: true } },
      },
    });
    if (!order) badRequest('Lab order not found');
    if (order.bill) return { order, bill: order.bill };

    // 👉 UPGRADE: Match by shortcode (e.g. "CBC") instead of the full exact string name
    const codes = order.items.map(i => i.test_code).filter(Boolean);
    const names = order.items.map(i => i.test_name).filter(Boolean);
    
    const tests = await tx.labTest.findMany({ 
      where: { 
        hospital_id: req.hospitalId, 
        OR: [{ code: { in: codes } }, { name: { in: names } }] 
      } 
    });
    
    const byCode = new Map(tests.filter(t => t.code).map(t => [t.code.toUpperCase(), t]));
    const byName = new Map(tests.filter(t => t.name).map(t => [t.name.toLowerCase(), t]));

    const items = order.items.map(item => {
      // Find by code first, fallback to name
      const test = (item.test_code ? byCode.get(String(item.test_code).toUpperCase()) : null) 
                || (item.test_name ? byName.get(String(item.test_name).toLowerCase()) : null);
      
      if (!test) {
        console.warn(`[LAB BILL WARNING] Test not found in catalogue: code=${item.test_code}, name=${item.test_name}. Using default price 0.`);
      }
      const unit_price = money(test?.price || 0);
      return {
        id: uuidv4(),
        category: item.category || test?.category || 'Lab',
        description: item.test_name,
        quantity: 1,
        unit_price,
        total: unit_price,
      };
    });
    
    const subtotal = money(items.reduce((sum, item) => sum + item.total, 0));
    if (subtotal < 0) badRequest('Amount cannot be negative'); 
    
    const tax_amt = 0;
    const total_amt = money(subtotal + tax_amt);
    const paid_amt = collectNow && paymentMode ? total_amt : 0;
    const bill = await tx.bill.create({
      data: {
        id: uuidv4(),
        hospital_id: req.hospitalId,
        bill_no: await nextBillNo(tx, req.hospitalId),
        patient_id: order.patient_id,
        type: 'LAB',
        status: paid_amt >= total_amt ? 'PAID' : 'GENERATED',
        subtotal,
        tax_amt,
        total_amt,
        paid_amt,
        due_amt: money(total_amt - paid_amt),
        payment_mode: paymentMode || null,
        notes: `Lab bill for ${order.order_no}`,
        items: { create: items },
        payments: paid_amt > 0 ? { create: [{ id: uuidv4(), amount: paid_amt, mode: paymentMode, reference_no: clean(req.body.payment_reference) || null, received_by: req.user.id }] } : undefined,
      },
      include: { items: true, payments: true, patient: { select: { first_name: true, last_name: true, uhid: true, phone: true } } },
    });
    const updatedOrder = await tx.labOrder.update({
      where: { id: order.id },
      data: { bill_id: bill.id },
      include: { patient: { select: { first_name: true, last_name: true, uhid: true, phone: true, gender: true, dob: true } }, items: true, bill: { include: { items: true, payments: true } } },
    });
    return { order: updatedOrder, bill };
  });

  emitToLab(req.hospitalId, 'lab:updated', { type: 'BILL_CREATED' });
  res.status(201).json({ success: true, data: result });
});

router.get('/orders/:id/bill', async (req, res) => {
  const order = await prisma.labOrder.findFirst({
    where: { id: req.params.id, hospital_id: req.hospitalId },
    include: { patient: { select: { first_name: true, last_name: true, uhid: true, phone: true } }, items: true, bill: { include: { items: true, payments: true, patient: { select: { first_name: true, last_name: true, uhid: true, phone: true } } } } },
  });
  if (!order) return res.status(404).json({ success: false, message: 'Lab order not found' });
  if (!order.bill) return res.status(404).json({ success: false, message: 'Lab bill not generated yet' });
  res.json({ success: true, data: { order, bill: order.bill } });
});

router.patch('/orders/:id/collect', async (req, res) => {
  const order = await prisma.labOrder.update({ where: { id: req.params.id }, data: { status: 'COLLECTED', collected_at: new Date() } });
  emitToLab(req.hospitalId,'lab:updated', { type: 'COLLECTED'});
  res.json({ success: true, data: order });
});

router.patch('/orders/:id/status', async (req, res) => {
  const status = String(req.body.status || '').trim().toUpperCase();
  if (!LAB_STATUSES.includes(status)) badRequest(`Invalid lab status. Expected one of: ${LAB_STATUSES.join(', ')}`);

  const data = { status };
  if (status === 'COLLECTED') data.collected_at = new Date();
  if (['RECEIVED', 'PROCESSING'].includes(status)) data.received_at = new Date();
  if (['RESULTED', 'VERIFIED', 'REPORTED'].includes(status)) data.reported_at = new Date();
  if (status === 'VERIFIED') data.verified_by = req.user.id;

  const order = await prisma.labOrder.update({
    where: { id: req.params.id },
    data,
    include: { items: true, patient: { select: { first_name: true, last_name: true, uhid: true, phone: true, gender: true, dob: true } } },
  });
  emitToLab(req.hospitalId,'lab:updated', { type: 'STATUS_UPDATED'});
  res.json({ success: true, data: order });
});

router.patch('/orders/:id/results', async (req, res) => {
  const { results } = req.body; 
  if (!Array.isArray(results) || !results.length) badRequest('Add at least one result before saving');
  const order = await prisma.labOrder.findFirst({ where: { id: req.params.id, hospital_id: req.hospitalId }, select: { id: true } });
  if (!order) return res.status(404).json({ success: false, message: 'Lab order not found' });
  const itemIds = results.map(result => result.item_id).filter(Boolean);
  const items = await prisma.labOrderItem.findMany({ where: { id: { in: itemIds }, order_id: order.id }, select: { id: true } });
  if (items.length !== itemIds.length) return res.status(404).json({ success: false, message: 'One or more lab result items do not belong to this order' });
  const updates = results.map(r => prisma.labOrderItem.update({
    where: { id: r.item_id },
    data: sanitizeModelInput('LabOrderItem', r, { only: ['result', 'unit', 'ref_range', 'is_abnormal', 'is_critical', 'method', 'notes'] }),
  }));
  await prisma.$transaction([...updates, prisma.labOrder.update({ where: { id: order.id }, data: { status: 'RESULTED', reported_at: new Date() } })]);

  const hasCritical = results.some(r => r.is_critical);
  emitToLab(req.hospitalId,'lab:updated', { type: hasCritical ? 'CRITICAL_RESULTS' : 'RESULTS_SAVED' });
  res.json({ success: true, message: hasCritical ? 'Results saved — CRITICAL VALUES detected' : 'Results saved', has_critical: hasCritical });
});

router.patch('/orders/:id/verify', async (req, res) => {
  const order = await prisma.labOrder.update({ where: { id: req.params.id }, data: { status: 'VERIFIED', verified_by: req.user.id } });
  res.json({ success: true, data: order });
});

router.get('/stats', async (req, res) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const [pending, stat, critical, completed, processing, collected, rejected] = await Promise.all([
    prisma.labOrder.count({ where: { hospital_id: req.hospitalId, status: { in: ['ORDERED','COLLECTED','IN_TRANSIT','RECEIVED','PROCESSING'] } } }),
    prisma.labOrder.count({ where: { hospital_id: req.hospitalId, is_stat: true, status: { notIn: ['VERIFIED','REPORTED'] } } }),
    prisma.labOrderItem.count({ where: { order: { hospital_id: req.hospitalId, created_at: { gte: today } }, is_critical: true } }),
    prisma.labOrder.count({ where: { hospital_id: req.hospitalId, created_at: { gte: today }, status: { in: ['VERIFIED','REPORTED'] } } }),
    prisma.labOrder.count({ where: { hospital_id: req.hospitalId, status: 'PROCESSING' } }),
    prisma.labOrder.count({ where: { hospital_id: req.hospitalId, status: 'COLLECTED' } }),
    prisma.labOrder.count({ where: { hospital_id: req.hospitalId, status: 'REJECTED', created_at: { gte: today } } }),
  ]);
  res.json({ success: true, data: { pending, stat, critical, completed, processing, collected, rejected } });
});

module.exports = router;
