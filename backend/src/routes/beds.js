// src/routes/beds.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { requireFields, resolvePatientId, sanitizeModelInput, toDate, badRequest, toFloat, toInt } = require('../utils/prismaInput');
const { emitToBeds } = require('../config/socket');
router.use(auth);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Helper function to get latest bill cutoff date
const latestBillCutoff = async (tx, hospitalId, patientId) => {
  const latest = await tx.bill.findFirst({
    where: { hospital_id: hospitalId, patient_id: patientId, status: { notIn: ['CANCELLED'] } },
    orderBy: { created_at: 'desc' },
    select: { created_at: true },
  });
  return latest?.created_at || new Date(0);
};

// Helper to count admission nights
const admissionNightsSince = (admissions, since, now) => admissions.reduce((sum, admission) => {
  const rawStart = new Date(admission.admission_date);
  const rawEnd = admission.discharge_date ? new Date(admission.discharge_date) : now;
  if (rawEnd <= since && admission.status !== 'ADMITTED') return sum;
  const start = rawStart > since ? rawStart : since;
  const end = rawEnd > now ? now : rawEnd;
  if (end <= start) return sum + 1;
  return sum + Math.max(1, Math.ceil((end - start) / MS_PER_DAY));
}, 0);

// Helper to count used services since last bill
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
      where: { hospital_id: hospitalId, created_at: { gt: since }, OR: [{ patient_id: patient.id }, { admission: { patient_id: patient.id } }] },
    }),
    tx.dietOrder.count({
      where: { patient_id: patient.id, created_at: { gt: since }, patient: { hospital_id: hospitalId } },
    }),
  ]);

  return {
    CONSULTATION: consultation,
    ADMISSION_PER_NIGHT: admissionNightsSince(admissions, since, now),
    LAB_TEST: labTests,
    RADIOLOGY_STUDY: radiology,
    PHARMACY_DISPENSE: pharmacy,
    AMBULANCE_TRIP: ambulance,
    EMERGENCY_VISIT: emergency,
    OT_PROCEDURE: ot,
    DIET_ORDER: dietary,
  };
};

// Helper to build auto bill items for discharge
const buildAutoBillItemsForDischarge = async (tx, hospitalId, patientId) => {
  const [fees, patient] = await Promise.all([
    tx.serviceFee.findMany({
      where: { hospital_id: hospitalId, is_active: true, trigger_code: { not: 'MANUAL' } },
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

router.get('/', async (req, res) => {
  try {
    const { ward, status, type, hospital_id: requestedHospitalId } = req.query;
    const hospitalId = (req.user?.role === 'SUPER_ADMIN' && requestedHospitalId) ? requestedHospitalId : req.hospitalId;

    if (!hospitalId) {
      return res.status(400).json({ success: false, message: 'Hospital context is required' });
    }

    const beds = await prisma.bed.findMany({
      where: { hospital_id: hospitalId, ...(ward && { ward }), ...(status && { status }), ...(type && { bed_type: type }) },
      orderBy: [{ ward: 'asc' }, { bed_no: 'asc' }],
      include: { admissions: { where: { status: 'ADMITTED' }, take: 1, include: { patient: { select: { first_name: true, last_name: true, uhid: true } } } } },
    });

    const stats = beds.reduce((acc, b) => { acc[b.status] = (acc[b.status] || 0) + 1; return acc; }, {});
    res.json({ success: true, data: beds, stats });
  } catch (error) {
    console.error('List beds error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to load beds' });
  }
});

router.post('/', async (req, res) => {
  try {
    const requestedHospitalId = req.body?.hospital_id || req.query?.hospital_id;
    const hospitalId = (req.user?.role === 'SUPER_ADMIN' && requestedHospitalId) ? requestedHospitalId : req.hospitalId;
    if (!hospitalId) return res.status(400).json({ success: false, message: 'Hospital context is required' });

    const data = sanitizeModelInput('Bed', { ...req.body, hospital_id: hospitalId }, {
      exclude: ['id', 'hospital_id', 'created_at', 'updated_at'],
    });
    requireFields(data, ['ward', 'bed_no']);

    const bed = await prisma.bed.create({
      data: { id: uuidv4(), hospital_id: hospitalId, ...data },
      include: { admissions: { where: { status: 'ADMITTED' }, take: 1 } },
    });

    emitToBeds(hospitalId, 'beds:updated', { type: 'CREATED' });
    res.status(201).json({ success: true, data: bed });
  } catch (error) {
    console.error('Create bed error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to create bed' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.bed.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Bed not found' });

    if (req.user?.role !== 'SUPER_ADMIN' && existing.hospital_id !== req.hospitalId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const data = sanitizeModelInput('Bed', req.body, { exclude: ['id', 'hospital_id', 'created_at', 'updated_at'] });
    const bed = await prisma.bed.update({ where: { id: req.params.id }, data });

    emitToBeds(existing.hospital_id, 'beds:updated', { type: 'UPDATED' });
    res.json({ success: true, data: bed });
  } catch (error) {
    console.error('Update bed error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to update bed' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.bed.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Bed not found' });

    if (req.user?.role !== 'SUPER_ADMIN' && existing.hospital_id !== req.hospitalId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await prisma.bed.delete({ where: { id: req.params.id } });

    emitToBeds(existing.hospital_id, 'beds:updated', { type: 'DELETED' });
    res.json({ success: true, message: 'Bed deleted' });
  } catch (error) {
    console.error('Delete bed error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to delete bed' });
  }
});

router.get('/wards', async (req, res) => {
  try {
    const { hospital_id: requestedHospitalId } = req.query;
    const hospitalId = (req.user?.role === 'SUPER_ADMIN' && requestedHospitalId) ? requestedHospitalId : req.hospitalId;
    if (!hospitalId) return res.status(400).json({ success: false, message: 'Hospital context is required' });

    const wards = await prisma.bed.groupBy({ by: ['ward'], where: { hospital_id: hospitalId }, _count: { id: true } });
    res.json({ success: true, data: wards });
  } catch (error) {
    console.error('List bed wards error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to load wards' });
  }
});

router.post('/admit', async (req, res) => {
  try {
    const data = sanitizeModelInput('Admission', req.body, {
      exclude: ['id', 'hospital_id', 'patient_id', 'bed_id', 'status', 'discharge_date', 'final_diagnosis'],
    });
    data.patient_id = await resolvePatientId(prisma, req.hospitalId, req.body.patient_id);
    data.admission_type = data.admission_type || 'ELECTIVE';
    data.status = 'ADMITTED';
    requireFields(data, ['patient_id', 'admitting_doctor_id']);

    // Check bed is available
    const bed = req.body.bed_id
      ? await prisma.bed.findFirst({ where: { id: req.body.bed_id, hospital_id: req.hospitalId } })
      : await prisma.bed.findFirst({
        where: { hospital_id: req.hospitalId, status: 'AVAILABLE' },
        orderBy: [{ ward: 'asc' }, { bed_no: 'asc' }],
      });
    if (!bed) return res.status(404).json({ success: false, message: 'Bed not found' });
    if (bed.status !== 'AVAILABLE' && bed.status !== 'RESERVED') return res.status(400).json({ success: false, message: `Bed is ${bed.status.toLowerCase()}. Cannot admit.` });

    const [admission] = await prisma.$transaction([
      prisma.admission.create({
        data: { id: uuidv4(), hospital_id: req.hospitalId, ...data, bed_id: bed.id },
        include: { patient: true, bed: true },
      }),
      prisma.bed.update({ where: { id: bed.id }, data: { status: 'OCCUPIED' } }),
    ]);
    
    emitToBeds(req.hospitalId, 'beds:updated', { type: 'ADMITTED' });
    res.status(201).json({ success: true, message: 'Patient admitted', data: admission });
  } catch (error) {
    console.error('Admission error:', error);
    res.status(400).json({ success: false, message: error.message || 'Admission failed' });
  }
});

router.post('/discharge', async (req, res) => {
  try {
    const { admission_id, final_diagnosis, condition_at_discharge, follow_up_date, follow_up_instructions, diet_advice, activity_advice, auto_bill = true } = req.body;
    const admission = await prisma.admission.findFirst({
      where: { id: admission_id, hospital_id: req.hospitalId },
      include: { bed: true, patient: true } 
    });
    if (!admission) return res.status(404).json({ success: false, message: 'Admission not found' });

    // Prepare discharge update
    const dischargeUpdate = {
      status: 'DISCHARGED',
      discharge_date: new Date(),
      final_diagnosis,
    };

    // Auto-generate bill if enabled
    if (auto_bill === true || auto_bill === 'true') {
      const result = await prisma.$transaction(async (tx) => {
        // Discharge the patient
        const discharged = await tx.admission.update({
          where: { id: admission_id },
          data: dischargeUpdate,
          include: { patient: true, bed: true }
        });

        await tx.dischargeSummary.create({
          data: {
            id: uuidv4(),
            admission_id,
            final_diagnosis,
            condition_at_discharge,
            follow_up_date: follow_up_date ? toDate(follow_up_date, 'follow_up_date') : null,
            follow_up_instructions,
            diet_advice,
            activity_advice,
            created_by: req.user.id,
          }
        });

        // Get auto bill items
        const { items: autoBillItems } = await buildAutoBillItemsForDischarge(tx, req.hospitalId, admission.patient_id);

        let createdBill = null;
        // Create bill if there are items
        if (autoBillItems.length > 0) {
          const bill_no = `BILL-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`;

          const existingBill = await tx.bill.findFirst({ where: { admission_id, hospital_id: req.hospitalId }, include: { items: true } });
          const subtotal = autoBillItems.reduce((sum, item) => sum + item.total, 0) + (existingBill?.items || []).reduce((sum, item) => sum + Number(item.total), 0);
          const discount_pct = 0;
          const discount_amt = 0;
          const tax_amt = 0;
          const total_amt = subtotal - discount_amt + tax_amt;

          createdBill = existingBill ? await tx.bill.update({
            where: { id: existingBill.id },
            data: {
              type: 'IPD_FINAL', subtotal, discount_pct, discount_amt, tax_amt, total_amt,
              due_amt: Math.max(0, total_amt - Number(existingBill.paid_amt || 0)), status: 'GENERATED',
              items: { create: autoBillItems.map(item => ({ id: uuidv4(), ...item })) },
            },
            include: { items: true },
          }) : await tx.bill.create({
            data: {
              id: uuidv4(),
              hospital_id: req.hospitalId,
              bill_no,
              patient_id: admission.patient_id,
              admission_id,
              type: 'IPD_FINAL',
              payment_mode: 'PENDING',
              subtotal,
              discount_pct,
              discount_amt,
              tax_amt,
              total_amt,
              due_amt: total_amt,
              status: 'GENERATED',
              items: { create: autoBillItems.map(item => ({ id: uuidv4(), ...item })) }
            },
            include: { items: true }
          });
        }

        // Release bed
        await tx.bed.update({ where: { id: admission.bed_id }, data: { status: 'CLEANING' } });

        return { discharged, createdBill };
      });

      const { discharged, createdBill } = result;
      emitToBeds(req.hospitalId, 'beds:updated', { type: 'DISCHARGED' });
      res.json({
        success: true,
        message: createdBill ? `Patient discharged. Bill ${createdBill.bill_no} generated with ₹${(createdBill.total_amt || 0).toFixed(2)} charges` : 'Patient discharged',
        data: { admission: discharged, bill: createdBill }
      });
    } else {
      // Discharge without auto-billing
      const [updated] = await prisma.$transaction([
        prisma.admission.update({ where: { id: admission_id }, data: dischargeUpdate }),
        prisma.dischargeSummary.create({
          data: {
            id: uuidv4(),
            admission_id,
            final_diagnosis,
            condition_at_discharge,
            follow_up_date: follow_up_date ? toDate(follow_up_date, 'follow_up_date') : null,
            follow_up_instructions,
            diet_advice,
            activity_advice,
            created_by: req.user.id,
          }
        }),
        prisma.bed.update({ where: { id: admission.bed_id }, data: { status: 'CLEANING' } }),
      ]);
      emitToBeds(req.hospitalId, 'beds:updated', { type: 'DISCHARGED' });
      res.json({ success: true, message: 'Patient discharged', data: { admission: updated, bill: null } });
    }
  } catch (error) {
    console.error('Discharge error:', error);
    res.status(400).json({ success: false, message: error.message || 'Discharge failed' });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const data = sanitizeModelInput('Bed', req.body, { only: ['status'] });
    const bed = await prisma.bed.update({ where: { id: req.params.id }, data });
    emitToBeds(req.hospitalId, 'beds:updated', { type: 'STATUS_CHANGED' });
    res.json({ success: true, data: bed });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(400).json({ success: false, message: error.message || 'Status update failed' });
  }
});

module.exports = router;
