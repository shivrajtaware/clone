// src/routes/emr.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { HttpError, resolvePatientId, sanitizeModelInput, splitCsv, toDate, toInt } = require('../utils/prismaInput');

router.use(auth);

const normalizeIssueQuantity = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string' && value.includes('-')) {
    const parts = value.split('-').map(part => Number.parseInt(part.trim(), 10)).filter(Number.isFinite);
    if (parts.length) {
      const qty = Math.max(...parts);
      if (qty <= 0) throw new HttpError(400, 'Prescription quantity must be greater than zero');
      return qty;
    }
  }
  const qty = toInt(value, 'quantity');
  if (qty <= 0) throw new HttpError(400, 'Prescription quantity must be greater than zero');
  return qty;
};
const frequencyPerDay = (frequency = '') => ({
  OD: 1, BD: 2, TDS: 3, QID: 4, NOCTE: 1, STAT: 1, SOS: 1,
}[String(frequency).trim().toUpperCase()] || 1);

const parseDoseUnits = (dose = '') => {
  const raw = String(dose).trim().toLowerCase();
  const fraction = raw.match(/(\d+)\s*\/\s*(\d+)/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const range = raw.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (range) return Math.max(Number(range[1]), Number(range[2]));
  const number = raw.match(/\d+(?:\.\d+)?/);
  return number ? Number(number[0]) : 1;
};

const parseDurationDays = (duration = '') => {
  const raw = String(duration).trim().toLowerCase();
  const number = raw.match(/\d+(?:\.\d+)?/);
  const amount = number ? Number(number[0]) : 1;
  if (raw.includes('week')) return amount * 7;
  if (raw.includes('month')) return amount * 30;
  return amount;
};

const calculatePrescriptionQuantity = (row) => Math.max(1, Math.ceil(
  parseDoseUnits(row.dose) * frequencyPerDay(row.frequency) * parseDurationDays(row.duration)
));

const resolveEncounter = async (patientId, hospitalId, requestedType) => {
  const encounter_type = String(requestedType || 'OPD').toUpperCase() === 'IPD' ? 'IPD' : 'OPD';
  if (encounter_type === 'IPD') {
    const admission = await prisma.admission.findFirst({ where: { patient_id: patientId, hospital_id: hospitalId, status: 'ADMITTED' }, orderBy: { admission_date: 'desc' }, select: { id: true } });
    if (!admission) throw new HttpError(400, 'No active IPD admission for this patient');
    return { encounter_type, admission_id: admission.id, appointment_id: null };
  }
  const appointment = await prisma.appointment.findFirst({ where: { patient_id: patientId, hospital_id: hospitalId, status: { notIn: ['CANCELLED', 'NO_SHOW'] } }, orderBy: { appointment_date: 'desc' }, select: { id: true } });
  return { encounter_type, appointment_id: appointment?.id || null, admission_id: null };
};

// Get full EMR for a patient
router.get('/:patientId', async (req, res) => {
  const patientId = await resolvePatientId(prisma, req.hospitalId, req.params.patientId);
  const [notes, vitals, prescriptions, allergies, labOrders, radiologyOrders, admissions] = await Promise.all([
    prisma.eMRNote.findMany({ where: { patient_id: patientId }, orderBy: { visit_date: 'desc' }, include: { doctor: { select: { first_name: true, last_name: true, designation: true, role: true } } } }),
    prisma.vitals.findMany({ where: { patient_id: patientId }, orderBy: { recorded_at: 'desc' }, take: 20, include: { recorded_by_user: { select: { first_name: true, last_name: true, role: true } } } }),
    prisma.prescription.findMany({ where: { patient_id: patientId }, include: { items: true, doctor: { select: { first_name: true, last_name: true, role: true } } }, orderBy: { prescribed_at: 'desc' }, take: 10 }),
    prisma.patientAllergy.findMany({ where: { patient_id: patientId } }),
    prisma.labOrder.findMany({ where: { patient_id: patientId }, include: { items: true }, orderBy: { created_at: 'desc' }, take: 10 }),
    prisma.radiologyOrder.findMany({ where: { patient_id: patientId }, orderBy: { created_at: 'desc' }, take: 10 }),
    prisma.admission.findMany({ where: { patient_id: patientId }, orderBy: { admission_date: 'desc' }, take: 5, include: { bed: true } }),
  ]);
  res.json({ success: true, data: { notes, vitals, prescriptions, allergies, labOrders, radiologyOrders, admissions } });
});

// Add SOAP note
router.post('/:patientId/notes', async (req, res) => {
  const patientId = await resolvePatientId(prisma, req.hospitalId, req.params.patientId);
  const encounter = await resolveEncounter(patientId, req.hospitalId, req.body.encounter_type);
  const data = sanitizeModelInput('EMRNote', req.body, {
    exclude: ['id', 'patient_id', 'doctor_id', 'visit_date', 'created_at'],
    transforms: {
      icd10_codes: (value) => splitCsv(value),
    },
  });
  const note = await prisma.eMRNote.create({
    data: {
      id: uuidv4(), patient_id: patientId, doctor_id: req.user.id,
      ...encounter,
      ...data,
      icd10_codes: data.icd10_codes || [],
    },
    include: { doctor: { select: { first_name: true, last_name: true, designation: true, role: true } } },
  });
  res.status(201).json({ success: true, message: 'Note added', data: note });
});

router.post('/:patientId/external-lab-tests', async (req, res) => {
  const patientId = await resolvePatientId(prisma, req.hospitalId, req.params.patientId);
  const tests = Array.isArray(req.body.tests) ? req.body.tests.map(String).map(v => v.trim()).filter(Boolean) : [];
  if (!tests.length) throw new HttpError(400, 'Add at least one lab test');
  const count = await prisma.labOrder.count({ where: { hospital_id: req.hospitalId } });
  const order = await prisma.labOrder.create({ data: {
    id: uuidv4(), hospital_id: req.hospitalId, patient_id: patientId, ordered_by: req.user.id,
    order_no: `EXT-LAB-${String(count + 1).padStart(5, '0')}`, priority: req.body.is_stat ? 'STAT' : 'ROUTINE', status: 'ORDERED',
    clinical_indication: req.body.clinical_indication || null, notes: 'External laboratory: no hospital billing or sample processing',
    items: { create: tests.map(test_name => ({ id: uuidv4(), test_name, status: 'ORDERED' })) },
  }, include: { items: true } });
  res.status(201).json({ success: true, message: 'External lab tests added to EMR', data: order });
});

// Record vitals
router.post('/:patientId/vitals', async (req, res) => {
  const patientId = await resolvePatientId(prisma, req.hospitalId, req.params.patientId);
  const encounter = await resolveEncounter(patientId, req.hospitalId, req.body.encounter_type);
  const { temperature, pulse, bp_systolic, bp_diastolic, spo2, respiratory_rate, weight, height, blood_glucose, pain_score, gcs, notes } = req.body;

  // ✓ SERVER-SIDE VALIDATION (CRITICAL)
  const parsedPulse = pulse ? parseInt(pulse) : null;
  const parsedBpSys = bp_systolic ? parseInt(bp_systolic) : null;
  const parsedSpo2 = spo2 ? parseInt(spo2) : null;
  const parsedTemp = temperature ? parseFloat(temperature) : null;
  
  if (parsedPulse && (parsedPulse < 20 || parsedPulse > 200)) throw new Error('Invalid heart rate: must be between 20-200 bpm');
  if (parsedBpSys && (parsedBpSys < 50 || parsedBpSys > 250)) throw new Error('Invalid BP systolic: must be between 50-250');
  if (parsedSpo2 && (parsedSpo2 < 70 || parsedSpo2 > 100)) throw new Error('Invalid SpO2: must be between 70-100%');
  if (parsedTemp && (parsedTemp < 35 || parsedTemp > 43)) throw new Error('Invalid temperature: must be between 35-43°C');
  if (gcs && (parseInt(gcs) < 3 || parseInt(gcs) > 15)) throw new Error('Invalid GCS: must be between 3-15');
  if (pain_score && (parseInt(pain_score) < 0 || parseInt(pain_score) > 10)) throw new Error('Invalid pain score: must be between 0-10');

  // Calculate BMI
  let bmi = null;
  if (weight && height) bmi = parseFloat((weight / ((height / 100) ** 2)).toFixed(1));

  const vital = await prisma.vitals.create({
    data: {
      id: uuidv4(), patient_id: patientId, recorded_by: req.user.id,
      ...encounter,
      temperature: parsedTemp,
      pulse: parsedPulse,
      bp_systolic: parsedBpSys,
      bp_diastolic: bp_diastolic ? parseInt(bp_diastolic) : null,
      spo2: parsedSpo2,
      respiratory_rate: respiratory_rate ? parseInt(respiratory_rate) : null,
      weight: weight ? parseFloat(weight) : null,
      height: height ? parseFloat(height) : null,
      bmi,
      blood_glucose: blood_glucose ? parseFloat(blood_glucose) : null,
      pain_score: pain_score ? parseInt(pain_score) : null,
      gcs: gcs ? parseInt(gcs) : null,
      notes,
    },
  });

  // Auto-alert for critical values (SERVER-SIDE CHECK)
  const alerts = [];
  if (parsedSpo2 && parsedSpo2 < 90) alerts.push({ type: 'CRITICAL', message: `SpO2 critically low: ${parsedSpo2}%` });
  if (parsedBpSys && parsedBpSys > 180) alerts.push({ type: 'CRITICAL', message: `BP dangerously high: ${parsedBpSys}/${bp_diastolic}` });
  if (parsedPulse && (parsedPulse > 130 || parsedPulse < 40)) alerts.push({ type: 'CRITICAL', message: `Heart rate critical: ${parsedPulse} bpm` });

  res.status(201).json({ success: true, data: vital, alerts });
});

// Add prescription
router.post('/:patientId/prescriptions', async (req, res) => {
  const patientId = await resolvePatientId(prisma, req.hospitalId, req.params.patientId);
  const encounter = await resolveEncounter(patientId, req.hospitalId, req.body.encounter_type);
  const { items, notes, valid_till } = req.body;
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) throw new HttpError(400, 'At least one medicine is required');

  const prescription = await prisma.$transaction(async (tx) => {
    const preparedItems = [];
    for (const row of rows) {
      const item = sanitizeModelInput('PrescriptionItem', row, { exclude: ['id', 'prescription_id'] });
      if (!item.drug_name || !item.dose || !item.frequency || !item.duration) {
        throw new HttpError(400, 'Drug name, dose, frequency and duration are required for every prescription item');
      }
      item.quantity = normalizeIssueQuantity(row.quantity) || item.quantity || calculatePrescriptionQuantity(item);
      item.quantity_unit = String(row.quantity_unit || '').toUpperCase() === 'PACK' ? 'PACK' : 'LOOSE';

      if (row.item_id || row.pharmacy_item_id) {
        const pharmacyItem = await tx.pharmacyItem.findFirst({
          where: { id: row.item_id || row.pharmacy_item_id, hospital_id: req.hospitalId },
        });
        if (!pharmacyItem) throw new HttpError(404, `Medicine not found in pharmacy stock: ${item.drug_name}`);
        item.drug_name = item.drug_name || pharmacyItem.brand_name || pharmacyItem.generic_name;
        item.generic_name = item.generic_name || pharmacyItem.generic_name;
        item.strength = item.strength || pharmacyItem.strength;
        item.form = item.form || pharmacyItem.form;
        item.pharmacy_item_id = pharmacyItem.id;
      }

      preparedItems.push(item);
    }

    const createdPrescription = await tx.prescription.create({
      data: {
        id: uuidv4(), patient_id: patientId, doctor_id: req.user.id,
        ...encounter,
        notes, valid_till: valid_till ? toDate(valid_till, 'valid_till') : null,
        items: { create: preparedItems.map(item => ({ id: uuidv4(), ...item })) },
      },
      include: { items: true, doctor: { select: { first_name: true, last_name: true } } },
    });
    return createdPrescription;
  });
  res.status(201).json({ success: true, data: prescription });
});

// Add allergy
router.post('/:patientId/allergies', async (req, res) => {
  const patientId = await resolvePatientId(prisma, req.hospitalId, req.params.patientId);
  const data = sanitizeModelInput('PatientAllergy', req.body, {
    exclude: ['id', 'patient_id', 'noted_at'],
  });
  const allergy = await prisma.patientAllergy.create({ data: { id: uuidv4(), patient_id: patientId, ...data } });
  res.status(201).json({ success: true, data: allergy });
});

module.exports = router;
