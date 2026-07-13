// src/routes/appointments.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { badRequest, isBlank, requireFields, resolvePatientId, sanitizeModelInput, toDate, toFloat, toInt } = require('../utils/prismaInput');
const { emitToHospital } = require('../config/socket');
const logger = require('../utils/logger');

router.use(auth);

const cleanText = (value) => (typeof value === 'string' ? value.trim() : value);

const optionalText = (value) => {
  const cleaned = cleanText(value);
  return isBlank(cleaned) ? null : cleaned;
};

const normalizeMedicineItems = (items = []) => (
  (Array.isArray(items) ? items : [])
    .map((rawItem) => {
      const item = rawItem || {};
      return {
        drug_name: optionalText(item.drug_name),
        generic_name: optionalText(item.generic_name),
        strength: optionalText(item.strength),
        form: optionalText(item.form),
        dose: optionalText(item.dose),
        frequency: optionalText(item.frequency),
        duration: optionalText(item.duration),
        route: optionalText(item.route) || 'Oral',
        instructions: optionalText(item.instructions),
        quantity: isBlank(item.quantity) ? null : toInt(item.quantity, 'quantity'),
        quantity_unit: String(item.quantity_unit || '').toUpperCase() === 'PACK' ? 'PACK' : 'LOOSE',
        pharmacy_item_id: optionalText(item.item_id || item.pharmacy_item_id),
        collect_bill_here: item.collect_bill_here === true || item.collect_bill_here === 'true',
        charge_amount: isBlank(item.charge_amount) ? null : toFloat(item.charge_amount, 'charge_amount'),
      };
    })
    .filter(item => item.drug_name && item.dose && item.frequency && item.duration)
);

const normalizeLabTests = (tests = []) => (
  (Array.isArray(tests) ? tests : [])
    .map((rawTest) => {
      const test = rawTest || {};
      return {
        test_name: optionalText(test.test_name || test.name),
        test_code: optionalText(test.test_code || test.code),
        category: optionalText(test.category),
      };
    })
    .filter(test => test.test_name)
);

const PAYMENT_MODES = new Set(['CASH', 'CARD', 'UPI', 'NET_BANKING', 'INSURANCE_CASHLESS', 'CORPORATE_CREDIT', 'CHEQUE', 'ONLINE']);
const money = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const consultationFeeFor = async (tx, hospitalId, appointment) => {
  const profile = appointment.doctor?.doctor_profile;
  const doctorFee =
    appointment.type === 'FOLLOW_UP' ? profile?.follow_up_fee :
    appointment.type === 'TELECONSULT' ? profile?.teleconsult_fee :
    profile?.consultation_fee;
  const amount = Number(appointment.fee ?? doctorFee ?? 0);
  return {
    amount,
    category: 'Consultation',
    description: `${String(appointment.type || 'REGULAR').replace(/_/g, ' ')} consultation`,
  };
};

router.get('/', async (req, res) => {
  const { date, doctor_id, status, type, page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const statusList = status ? String(status).split(',').map(s => s.trim()).filter(Boolean) : [];
  const effectiveDoctorId = req.user.role === 'DOCTOR' ? req.user.id : doctor_id;
  const where = {
    hospital_id: req.hospitalId,
    ...(date && { appointment_date: { gte: new Date(date + 'T00:00:00'), lte: new Date(date + 'T23:59:59') } }),
    ...(effectiveDoctorId && { doctor_id: effectiveDoctorId }),
    ...(type && { type }),
    ...(statusList.length === 1 && { status: statusList[0] }),
    ...(statusList.length > 1 && { status: { in: statusList } }),
  };
  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where, skip, take: parseInt(limit),
      orderBy: [{ appointment_date: 'asc' }, { slot_time: 'asc' }],
      include: {
        patient: { select: { id: true, uhid: true, first_name: true, last_name: true, phone: true, gender: true, dob: true } },
        doctor: { select: { id: true, first_name: true, last_name: true, designation: true } },
        department: { select: { id: true, name: true } },
        medicine_stack: { select: { id: true, name: true, condition: true, items: { orderBy: { sort_order: 'asc' } } } },
      },
    }),
    prisma.appointment.count({ where }),
  ]);
  res.json({ success: true, data: appointments, meta: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
});

router.post('/', async (req, res) => {
  const apptDate = toDate(req.body.appointment_date, 'appointment_date');
  const data = sanitizeModelInput('Appointment', req.body, {
    exclude: ['id', 'hospital_id', 'patient_id', 'token_no', 'booked_by', 'checked_in_at', 'completed_at', 'fee'],
  });
  data.patient_id = await resolvePatientId(prisma, req.hospitalId, req.body.patient_id);
  data.appointment_date = apptDate;
  data.type = data.type || 'REGULAR';
  data.priority = data.priority || 'NORMAL';
  data.status = 'BOOKED';
  data.booked_by = req.user.id;
  requireFields(data, ['patient_id', 'doctor_id', 'appointment_date', 'slot_time']);

  // ✓ Check double-booking BEFORE creation
  const slotExists = await prisma.appointment.findFirst({
    where: {
      hospital_id: req.hospitalId,
      doctor_id: data.doctor_id,
      appointment_date: data.appointment_date,
      slot_time: data.slot_time,
      status: { in: ['BOOKED', 'CONFIRMED', 'CHECKED_IN'] }
    }
  });
  if (slotExists) return res.status(400).json({ success: false, message: 'This slot is already booked. Please select another time.' });

  // Get token number for today
  const todayStart = new Date(apptDate);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(apptDate);
  todayEnd.setHours(23, 59, 59, 999);
  const count = await prisma.appointment.count({ where: { hospital_id: req.hospitalId, doctor_id: data.doctor_id, appointment_date: { gte: todayStart, lte: todayEnd } } });
  const token_no = `T-${String(count + 1).padStart(3, '0')}`;
  const doctor = await prisma.user.findFirst({
    where: { id: data.doctor_id, hospital_id: req.hospitalId, role: 'DOCTOR' },
    include: { doctor_profile: true },
  });
  if (!doctor) badRequest('Selected doctor is not available');
  const slotDuration = doctor.doctor_profile?.slot_duration_mins || 15;
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(data.slot_time || '');
  const slotMinutes = timeMatch ? Number(timeMatch[1]) * 60 + Number(timeMatch[2]) : NaN;
  const isClinicSlot = Number.isInteger(slotMinutes)
    && slotMinutes >= 9 * 60
    && slotMinutes < 18 * 60
    && !(slotMinutes >= 13 * 60 && slotMinutes < 14 * 60)
    && (slotMinutes - 9 * 60) % slotDuration === 0;
  if (!isClinicSlot) badRequest(`Choose an available ${slotDuration}-minute clinic time slot.`);
  const configuredConsultation = await prisma.serviceFee.findFirst({
    where: { hospital_id: req.hospitalId, trigger_code: 'CONSULTATION', is_active: true },
    orderBy: { updated_at: 'desc' },
  });
  const profileFee = data.type === 'FOLLOW_UP'
    ? doctor.doctor_profile?.follow_up_fee
    : data.type === 'TELECONSULT'
      ? doctor.doctor_profile?.teleconsult_fee
      : doctor.doctor_profile?.consultation_fee;
  data.fee = Number(configuredConsultation?.amount ?? profileFee ?? 0);

  const appt = await prisma.appointment.create({
    data: {
      id: uuidv4(), hospital_id: req.hospitalId,
      ...data,
      token_no,
    },
    include: {
      patient: { select: { first_name: true, last_name: true, phone: true } },
      doctor: { select: { first_name: true, last_name: true } },
    },
  });
  
  // Audit log - non-critical
  try {
    await prisma.auditLog.create({
      data: {
        id: uuidv4(),
        hospital_id: req.hospitalId,
        user_id: req.user.id,
        module: 'APPOINTMENTS',
        action: 'CREATE',
        record_id: appt.id,
        ip_address: req.ip,
      }
    });
  } catch (e) {
    logger.warn('Audit log failed', { error: e.message });
  }

  emitToHospital(req.hospitalId, 'appointments:refresh', { action: 'created', appointment: appt });

  res.status(201).json({ success: true, message: 'Appointment booked', data: appt });
});

router.post('/:id/complete-opd', async (req, res) => {
  const appointment = await prisma.appointment.findFirst({
    where: { id: req.params.id, hospital_id: req.hospitalId },
    include: {
      patient: { select: { id: true, first_name: true, last_name: true, uhid: true } },
      doctor: { include: { doctor_profile: true } },
    },
  });
  if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
  if (req.user.role === 'DOCTOR' && appointment.doctor_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'This OPD patient is assigned to another doctor' });
  }
  if (['CANCELLED', 'NO_SHOW'].includes(appointment.status)) badRequest('Cannot complete a cancelled or no-show appointment');
  if (appointment.status === 'COMPLETED') badRequest('This OPD is already completed');
  const paymentMode = optionalText(req.body.payment_mode);
  if (paymentMode && !PAYMENT_MODES.has(paymentMode)) badRequest('Invalid payment mode');
  const collectNow = req.body.collect_payment === undefined ? true : req.body.collect_payment === true || req.body.collect_payment === 'true';
  const manualConsultationFee = req.body.consultation_fee === undefined || req.body.consultation_fee === ''
    ? 0
    : toFloat(req.body.consultation_fee, 'consultation_fee');
  if (manualConsultationFee < 0) badRequest('Consultation fee cannot be negative');

  let medicineStack = null;
  let prescriptionItems = [];
  if (req.body.medicine_stack_id) {
    medicineStack = await prisma.medicineStack.findFirst({
      where: { id: req.body.medicine_stack_id, hospital_id: req.hospitalId, is_active: true },
      include: { items: { orderBy: { sort_order: 'asc' } } },
    });
    if (!medicineStack) badRequest('Selected medicine stack is not available');
    prescriptionItems = normalizeMedicineItems(medicineStack.items);
  } else {
    prescriptionItems = normalizeMedicineItems(req.body.medicines);
  }
  if (prescriptionItems.some(item => item.collect_bill_here && !item.pharmacy_item_id)) {
    badRequest('Select every Collect bill here item from pharmacy inventory');
  }

  const labTests = [];
  const noteText = optionalText(req.body.notes);
  const labNotes = optionalText(req.body.lab_notes) || noteText;
  const sampleType = optionalText(req.body.sample_type);

  const result = await prisma.$transaction(async (tx) => {
    let prescription = null;
    let labOrder = null;
    let bill = null;
    let payment = null;

    const roomItems = prescriptionItems.filter(item => item.collect_bill_here);
    const pharmacyItems = prescriptionItems.filter(item => !item.collect_bill_here);
    if (prescriptionItems.length) {
      prescription = await tx.prescription.create({
        data: {
          id: uuidv4(),
          patient_id: appointment.patient_id,
          doctor_id: req.user.id,
          appointment_id: appointment.id,
          encounter_type: 'OPD',
          notes: medicineStack ? `Medicine stack: ${medicineStack.name}${noteText ? ` | ${noteText}` : ''}` : noteText,
          items: { create: prescriptionItems.map(item => ({ id: uuidv4(), ...item })) },
        },
        include: { items: true, doctor: { select: { first_name: true, last_name: true } } },
      });
    }

    const roomChargeItems = [];
    const roomDispenseItems = [];
    let roomTax = 0;
    for (const item of roomItems) {
      const stockItem = await tx.pharmacyItem.findFirst({ where: { id: item.pharmacy_item_id, hospital_id: req.hospitalId } });
      if (!stockItem) badRequest(`Inventory item not found: ${item.drug_name}`);
      const packSize = Math.max(1, Number(stockItem.units_per_pack || 1));
      const requested = Math.max(1, Number(item.quantity || 1)) * (item.quantity_unit === 'PACK' ? packSize : 1);
      if (stockItem.current_stock < requested) badRequest(`Insufficient stock for ${stockItem.generic_name}`);
      const batches = await tx.drugBatch.findMany({
        where: { item_id: stockItem.id, quantity_rem: { gt: 0 }, expiry_date: { gte: new Date() } },
        orderBy: [{ expiry_date: 'asc' }, { created_at: 'asc' }],
      });
      let remaining = requested;
      for (const batch of batches) {
        if (!remaining) break;
        const quantity = Math.min(remaining, batch.quantity_rem);
        const unitPrice = money(Number(batch.selling_price || batch.mrp || 0) / packSize);
        const gstPct = Number(batch.gst_pct || 0);
        const gross = money(quantity * unitPrice);
        const tax = money(gross - gross / (1 + gstPct / 100));
        roomTax += tax;
        roomChargeItems.push({ category: 'OPD Medicine / Injection', description: `${stockItem.generic_name}${stockItem.strength ? ` ${stockItem.strength}` : ''} (${batch.batch_no})`, quantity, unit_price: unitPrice, total: gross });
        roomDispenseItems.push({ id: uuidv4(), item_id: stockItem.id, quantity, batch_no: batch.batch_no, unit_price: unitPrice });
        await tx.drugBatch.update({ where: { id: batch.id }, data: { quantity_rem: { decrement: quantity } } });
        remaining -= quantity;
      }
      if (remaining > 0) badRequest(`Insufficient usable non-expired stock for ${stockItem.generic_name}`);
      await tx.pharmacyItem.update({ where: { id: stockItem.id }, data: { current_stock: { decrement: requested } } });
    }
    if (roomDispenseItems.length) {
      await tx.dispense.create({ data: {
        id: uuidv4(), hospital_id: req.hospitalId,
        dispense_no: `OPD-${new Date().getFullYear()}-${String(Date.now()).slice(-7)}`,
        patient_id: appointment.patient_id, prescription_id: null, dispensed_by: req.user.id,
        notes: `Issued and collected in OPD room for token ${appointment.token_no || appointment.id}`,
        items: { create: roomDispenseItems },
      } });
    }

    if (labTests.length) {
      const count = await tx.labOrder.count({ where: { hospital_id: req.hospitalId } });
      const order_no = `LAB-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
      labOrder = await tx.labOrder.create({
        data: {
          id: uuidv4(),
          hospital_id: req.hospitalId,
          order_no,
          patient_id: appointment.patient_id,
          ordered_by: req.user.id,
          is_stat: req.body.lab_is_stat === true,
          sample_type: sampleType,
          notes: labNotes,
          items: {
            create: labTests.map(test => ({ id: uuidv4(), ...test })),
          },
        },
        include: { items: true },
      });
    }

    const updatedAppointment = await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: 'COMPLETED',
        completed_at: new Date(),
        ...(medicineStack && { medicine_stack_id: medicineStack.id }),
        fee: manualConsultationFee,
        ...(noteText && { notes: noteText }),
      },
      include: {
        patient: { select: { id: true, uhid: true, first_name: true, last_name: true, phone: true, gender: true, dob: true } },
        doctor: { select: { id: true, first_name: true, last_name: true, designation: true } },
        department: { select: { id: true, name: true } },
        medicine_stack: { select: { id: true, name: true, condition: true, items: { orderBy: { sort_order: 'asc' } } } },
      },
    });

    const fee = { amount: manualConsultationFee, category: 'Consultation', description: `${String(appointment.type || 'REGULAR').replace(/_/g, ' ')} consultation` };
    const chargeItems = [
      ...(fee.amount > 0 ? [{ category: fee.category, description: fee.description, quantity: 1, unit_price: fee.amount, total: fee.amount }] : []),
      ...roomChargeItems,
    ];
    if (chargeItems.length) {
      const bill_no = `BILL-${new Date().getFullYear()}-${uuidv4().slice(0, 8).toUpperCase()}`;
      const subtotal = chargeItems.reduce((sum, item) => sum + item.total, 0);
      const tax_amt = money(roomTax);
      const total_amt = subtotal;
      const paid_amt = collectNow && paymentMode ? total_amt : 0;
      bill = await tx.bill.create({
        data: {
          id: uuidv4(),
          hospital_id: req.hospitalId,
          bill_no,
          patient_id: appointment.patient_id,
          appointment_id: appointment.id,
          type: 'OPD',
          status: paid_amt >= total_amt ? 'PAID' : 'GENERATED',
          subtotal,
          tax_amt,
          total_amt,
          paid_amt,
          due_amt: Math.max(0, total_amt - paid_amt),
          payment_mode: paymentMode || null,
          notes: `Auto-generated from OPD token ${appointment.token_no || appointment.id}`,
          items: {
            create: chargeItems.map(item => ({ id: uuidv4(), ...item })),
          },
        },
        include: { items: true },
      });
      if (paid_amt > 0) {
        payment = await tx.payment.create({
          data: {
            id: uuidv4(),
            bill_id: bill.id,
            amount: paid_amt,
            mode: paymentMode,
            reference_no: optionalText(req.body.payment_reference),
            received_by: req.user.id,
          },
        });
      }
    }

    return { appointment: updatedAppointment, prescription, labOrder, bill, payment, pharmacy_queue: pharmacyItems.length > 0 };
  });

  emitToHospital(req.hospitalId, 'appointments:refresh', { action: 'completed', appointment: result.appointment });

  res.json({
    success: true,
    message: 'OPD completed',
    data: {
      ...result,
      pharmacy_queue: result.pharmacy_queue,
      lab_queue: false,
      bill_created: !!result.bill,
      bill: result.bill,
      payment: result.payment,
    },
  });
});

router.patch('/:id/status', async (req, res) => {
  const { status } = sanitizeModelInput('Appointment', req.body, { only: ['status'] });
  const updates = { status };
  if (status === 'CHECKED_IN') {
    updates.checked_in_at = new Date();
    if (req.body.medicine_stack_id) {
      const stack = await prisma.medicineStack.findFirst({
        where: { id: req.body.medicine_stack_id, hospital_id: req.hospitalId, is_active: true },
        select: { id: true },
      });
      if (!stack) badRequest('Selected medicine stack is not available');
      updates.medicine_stack_id = stack.id;
    }
  }
  if (status === 'COMPLETED') updates.completed_at = new Date();
  const appt = await prisma.appointment.update({
    where: { id: req.params.id },
    data: updates,
    include: { medicine_stack: { select: { id: true, name: true, condition: true } } },
  });

  emitToHospital(req.hospitalId, 'appointments:refresh', { action: 'status_updated', appointment: appt });

  res.json({ success: true, data: appt });
});

router.get('/slots', async (req, res) => {
  const { doctor_id, date } = req.query;
  const doctor = await prisma.user.findUnique({ where: { id: doctor_id }, include: { doctor_profile: true } });
  if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

  const slotDuration = doctor.doctor_profile?.slot_duration_mins || 15;
  const slots = [];
  const workStart = 9 * 60; // 9 AM
  const workEnd   = 18 * 60; // 6 PM
  const lunchStart = 13 * 60;
  const lunchEnd   = 14 * 60;

  // Get booked slots
  const booked = await prisma.appointment.findMany({
    where: {
      doctor_id,
      appointment_date: { gte: new Date(date + 'T00:00:00'), lte: new Date(date + 'T23:59:59') },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    },
    select: { slot_time: true },
  });
  const bookedTimes = new Set(booked.map(b => b.slot_time));

  for (let min = workStart; min < workEnd; min += slotDuration) {
    if (min >= lunchStart && min < lunchEnd) continue;
    const h = Math.floor(min / 60), m = min % 60;
    const time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    slots.push({ time, available: !bookedTimes.has(time) });
  }
  res.json({ success: true, data: slots });
});

router.get('/stats', async (req, res) => {
  const { date, doctor_id, type } = req.query;
  const todayStart = new Date((date || new Date().toISOString().split('T')[0]) + 'T00:00:00');
  const todayEnd   = new Date((date || new Date().toISOString().split('T')[0]) + 'T23:59:59');
  const effectiveDoctorId = req.user.role === 'DOCTOR' ? req.user.id : doctor_id;
  const baseWhere = {
    hospital_id: req.hospitalId,
    appointment_date: { gte: todayStart, lte: todayEnd },
    ...(effectiveDoctorId && { doctor_id: effectiveDoctorId }),
    ...(type && { type }),
  };
  const [total, completed, no_show, cancelled, pending] = await Promise.all([
    prisma.appointment.count({ where: baseWhere }),
    prisma.appointment.count({ where: { ...baseWhere, status: 'COMPLETED' } }),
    prisma.appointment.count({ where: { ...baseWhere, status: 'NO_SHOW' } }),
    prisma.appointment.count({ where: { ...baseWhere, status: 'CANCELLED' } }),
    prisma.appointment.count({ where: { ...baseWhere, status: { in: ['BOOKED','CONFIRMED','CHECKED_IN','IN_CONSULTATION'] } } }),
  ]);
  res.json({ success: true, data: { total, completed, no_show, cancelled, pending } });
});

module.exports = router;
