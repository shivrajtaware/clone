// src/routes/ot.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { HttpError, sanitizeModelInput, toDate } = require('../utils/prismaInput');
const { emitToOT } = require('../config/socket');
router.use(auth);

router.get('/rooms', async (req, res) => {
  const rooms = await prisma.oTRoom.findMany({ where: { hospital_id: req.hospitalId }, include: { records: { where: { status: { in: ['SCHEDULED','PREP','IN_PROGRESS'] } }, include: { patient: { select: { first_name: true, last_name: true, uhid: true } }, admission: { include: { bed: true } } } } } });
  res.json({ success: true, data: rooms });
});

router.get('/schedule', async (req, res) => {
  const { date, view } = req.query;
  const day = date || new Date().toISOString().split('T')[0];
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(`${day}T23:59:59`);
  const where = view === 'action'
    ? { hospital_id: req.hospitalId, OR: [{ status: { in: ['SCHEDULED', 'PREP', 'IN_PROGRESS'] } }, { scheduled_start: { gte: start, lte: end } }] }
    : { hospital_id: req.hospitalId, scheduled_start: { gte: start, lte: end } };
  const records = await prisma.oTRecord.findMany({
    where,
    orderBy: { scheduled_start: 'asc' },
    include: { ot_room: true, checklist: true, team: true, patient: { select: { id: true, first_name: true, last_name: true, uhid: true, gender: true, phone: true, blood_group: true } }, admission: { include: { bed: true } } },
  });
  res.json({ success: true, data: records });
});

router.post('/schedule', async (req, res) => {
  const patient = await prisma.patient.findFirst({ where: { id: req.body.patient_id, hospital_id: req.hospitalId, is_active: true } });
  if (!patient) throw new HttpError(400, 'Select a registered patient before booking OT.');
  const admission = await prisma.admission.findFirst({
    where: { patient_id: patient.id, hospital_id: req.hospitalId, status: 'ADMITTED' },
    orderBy: { admission_date: 'desc' },
  });
  const room = await prisma.oTRoom.findFirst({ where: { id: req.body.ot_room_id, hospital_id: req.hospitalId } });
  if (!room) throw new HttpError(400, 'Select a valid OT room.');
  const data = sanitizeModelInput('OTRecord', req.body, {
    exclude: ['id', 'hospital_id', 'admission_id', 'scheduled_start', 'scheduled_end', 'actual_start', 'actual_end', 'created_at', 'expected_minutes'],
  });
  data.patient_id = patient.id;
  data.admission_id = admission?.id || null;
  data.scheduled_start = toDate(req.body.scheduled_start, 'scheduled_start');
  data.scheduled_end = toDate(req.body.scheduled_end, 'scheduled_end');
  const record = await prisma.oTRecord.create({
    data: {
      id: uuidv4(), hospital_id: req.hospitalId, ...data,
      checklist: { create: { id: uuidv4() } },
    },
    include: { ot_room: true, checklist: true, patient: true, admission: true },
  });
  emitToOT(req.hospitalId, 'ot.new', record);
  res.status(201).json({ success: true, data: record });
});

router.patch('/checklist/:id', async (req, res) => {
  const existing = await prisma.oTChecklist.findFirst({ where: { id: req.params.id, ot_record: { hospital_id: req.hospitalId } } });
  if (!existing) throw new HttpError(404, 'OT checklist not found');
  const data = sanitizeModelInput('OTChecklist', req.body, {
    exclude: ['id', 'ot_record_id', 'created_at'],
  });
  const checklist = await prisma.oTChecklist.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: checklist });
});

router.patch('/:id/clinical-notes', async (req, res) => {
  const record = await prisma.oTRecord.findFirst({ where: { id: req.params.id, hospital_id: req.hospitalId } });
  if (!record) throw new HttpError(404, 'OT case not found');
  const data = sanitizeModelInput('OTRecord', req.body, { exclude: ['id', 'hospital_id', 'ot_room_id', 'admission_id', 'scheduled_start', 'scheduled_end', 'actual_start', 'actual_end', 'created_at', 'status'] });
  const updated = await prisma.oTRecord.update({ where: { id: record.id }, data });
  res.json({ success: true, data: updated });
});

router.post('/:id/admit-after-surgery', async (req, res) => {
  const record = await prisma.oTRecord.findFirst({ where: { id: req.params.id, hospital_id: req.hospitalId }, include: { patient: true } });
  if (!record) throw new HttpError(404, 'OT case not found');
  if (record.admission_id) throw new HttpError(400, 'This OT case is already linked to an admission.');
  const bed = req.body.bed_id
    ? await prisma.bed.findFirst({ where: { id: req.body.bed_id, hospital_id: req.hospitalId } })
    : await prisma.bed.findFirst({ where: { hospital_id: req.hospitalId, status: 'AVAILABLE' }, orderBy: [{ ward: 'asc' }, { bed_no: 'asc' }] });
  if (!bed) throw new HttpError(404, 'No available bed found for post-op admission.');
  if (!['AVAILABLE', 'RESERVED'].includes(bed.status)) throw new HttpError(400, `Bed is ${bed.status.toLowerCase()}. Cannot admit.`);
  if (!req.body.admitting_doctor_id) throw new HttpError(400, 'Select admitting doctor for post-op admission.');
  const [admission, updated] = await prisma.$transaction([
    prisma.admission.create({
      data: {
        id: uuidv4(),
        hospital_id: req.hospitalId,
        patient_id: record.patient_id,
        bed_id: bed.id,
        admitting_doctor_id: req.body.admitting_doctor_id,
        admission_type: record.surgery_type === 'EMERGENCY' ? 'EMERGENCY' : 'ELECTIVE',
        provisional_diagnosis: req.body.provisional_diagnosis || record.diagnosis || record.procedure,
        notes: req.body.notes || `Post-op admission from OT: ${record.procedure}`,
        status: 'ADMITTED',
      },
      include: { bed: true, patient: true },
    }),
    prisma.bed.update({ where: { id: bed.id }, data: { status: 'OCCUPIED' } }),
  ]);
  await prisma.oTRecord.update({ where: { id: record.id }, data: { admission_id: admission.id, admit_after_surgery: true } });
  res.status(201).json({ success: true, data: { admission, bed: updated } });
});

router.patch('/:id/status', async (req, res) => {
  const existing = await prisma.oTRecord.findFirst({ where: { id: req.params.id, hospital_id: req.hospitalId } });
  if (!existing) throw new HttpError(404, 'OT case not found');
  const updates = { status: req.body.status };
  if (req.body.status === 'IN_PROGRESS') updates.actual_start = new Date();
  if (req.body.status === 'COMPLETED') {
    updates.actual_end = new Date();
    const notes = sanitizeModelInput('OTRecord', req.body, {
      exclude: ['id', 'hospital_id', 'ot_room_id', 'admission_id', 'scheduled_start', 'scheduled_end', 'actual_start', 'actual_end', 'created_at', 'status'],
    });
    Object.assign(updates, notes);
  }
  const record = await prisma.oTRecord.update({ where: { id: req.params.id }, data: updates });
  if (req.body.status === 'IN_PROGRESS') {
    await prisma.oTRoom.update({ where: { id: existing.ot_room_id }, data: { status: 'IN_USE' } });
  }
  if (req.body.status === 'COMPLETED') {
    await prisma.oTRoom.update({ where: { id: existing.ot_room_id }, data: { status: 'CLEANING' } });
  }
  emitToOT(req.hospitalId, 'ot:status', record );
  res.json({ success: true, data: record });
});

module.exports = router;
