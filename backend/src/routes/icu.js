// src/routes/icu.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { resolvePatientId, sanitizeModelInput } = require('../utils/prismaInput');
router.use(auth);

router.get('/patients', async (req, res) => {
  const icuBeds = await prisma.bed.findMany({
    where: { hospital_id: req.hospitalId, bed_type: { in: ['ICU', 'HDU'] } },
    include: { admissions: { where: { status: 'ADMITTED' }, take: 1, include: { patient: { select: { id: true, first_name: true, last_name: true, uhid: true, dob: true, gender: true, blood_group: true, allergies: true } }, icu_records: { orderBy: { recorded_at: 'desc' }, take: 1 } } } },
    orderBy: [{ bed_type: 'asc' }, { bed_no: 'asc' }],
  });
  res.json({ success: true, data: icuBeds });
});

router.get('/flowsheets/:patientId', async (req, res) => {
  const patientId = await resolvePatientId(prisma, req.hospitalId, req.params.patientId);
  const sheets = await prisma.iCUFlowsheet.findMany({ where: { patient_id: patientId }, orderBy: { time_slot: 'desc' }, take: 24 });
  res.json({ success: true, data: sheets });
});

router.post('/flowsheets', async (req, res) => {
  const data = sanitizeModelInput('ICUFlowsheet', req.body, {
    exclude: ['id', 'patient_id', 'time_slot', 'nurse_id', 'created_at'],
  });
  data.patient_id = await resolvePatientId(prisma, req.hospitalId, req.body.patient_id);
  const sheet = await prisma.iCUFlowsheet.create({ data: { id: uuidv4(), nurse_id: req.user.id, ...data, time_slot: new Date() } });
  res.status(201).json({ success: true, data: sheet });
});

router.post('/scores', async (req, res) => {
  const data = sanitizeModelInput('ICURecord', req.body, {
    exclude: ['id', 'recorded_by', 'recorded_at'],
  });
  const admission = await prisma.admission.findFirst({ where: { id: data.admission_id, hospital_id: req.hospitalId }, select: { id: true } });
  if (!admission) throw new Error('Admission not found');
  const record = await prisma.iCURecord.create({ data: { id: uuidv4(), recorded_by: req.user.id, ...data } });
  res.status(201).json({ success: true, data: record });
});

module.exports = router;
