// src/routes/emergency.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { resolvePatientId, sanitizeModelInput } = require('../utils/prismaInput');
const { emitToEmergency } = require('../config/socket');
router.use(auth);

router.get('/', async (req, res) => {
  const cases = await prisma.emergencyCase.findMany({ where: { hospital_id: req.hospitalId, status: 'ACTIVE' }, orderBy: [{ triage_level: 'asc' }, { arrival_time: 'asc' }] });
  res.json({ success: true, data: cases });
});

router.post('/', async (req, res) => {
  const count = await prisma.emergencyCase.count({ where: { hospital_id: req.hospitalId } });
  const case_no = `ER-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
  const data = sanitizeModelInput('EmergencyCase', req.body, {
    exclude: ['id', 'hospital_id', 'case_no', 'patient_id', 'arrival_time', 'triage_time', 'doctor_time', 'created_at'],
  });
  if (req.body.patient_id) data.patient_id = await resolvePatientId(prisma, req.hospitalId, req.body.patient_id);
  const ec = await prisma.emergencyCase.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, case_no, triage_time: new Date(), ...data } });
  emitToEmergency(req.hospitalId, 'emergency:updated', { type: 'CASE_CREATED'});
  res.status(201).json({ success: true, data: ec });
});

router.patch('/:id', async (req, res) => {
  const updates = sanitizeModelInput('EmergencyCase', req.body, {
    exclude: ['id', 'hospital_id', 'case_no', 'arrival_time', 'triage_time', 'created_at'],
  });
  if (req.body.patient_id) updates.patient_id = await resolvePatientId(prisma, req.hospitalId, req.body.patient_id);
  if (req.body.doctor_id && !req.body.doctor_time) updates.doctor_time = new Date();
  const ec = await prisma.emergencyCase.update({ where: { id: req.params.id }, data: updates });
  emitToEmergency(req.hospitalId, 'emergency:updated', {type: 'CASE_UPDATED'});
  res.json({ success: true, data: ec });
});

router.patch('/:id/seen', async (req, res) => {
  const ec = await prisma.emergencyCase.update({
    where: { id: req.params.id },
    data: { doctor_id: req.user.id, doctor_time: new Date() },
  });
  emitToEmergency(req.hospitalId, 'emergency:updated', {type: 'CASE_UPDATED'});
  res.json({ success: true, data: ec });
});

router.get('/stats', async (req, res) => {
  const [red, orange, yellow, green, blue, mlc, total] = await Promise.all([
    prisma.emergencyCase.count({ where: { hospital_id: req.hospitalId, status: 'ACTIVE', triage_level: 'RED' } }),
    prisma.emergencyCase.count({ where: { hospital_id: req.hospitalId, status: 'ACTIVE', triage_level: 'ORANGE' } }),
    prisma.emergencyCase.count({ where: { hospital_id: req.hospitalId, status: 'ACTIVE', triage_level: 'YELLOW' } }),
    prisma.emergencyCase.count({ where: { hospital_id: req.hospitalId, status: 'ACTIVE', triage_level: 'GREEN' } }),
    prisma.emergencyCase.count({ where: { hospital_id: req.hospitalId, status: 'ACTIVE', triage_level: 'BLUE' } }),
    prisma.emergencyCase.count({ where: { hospital_id: req.hospitalId, status: 'ACTIVE', is_mlc: true } }),
    prisma.emergencyCase.count({ where: { hospital_id: req.hospitalId, status: 'ACTIVE' } }),
  ]);

  const activeCases = await prisma.emergencyCase.findMany({
    where: { hospital_id: req.hospitalId, status: 'ACTIVE' },
    select: { arrival_time: true, triage_level: true, doctor_time: true },
  });
  const now = Date.now();
  const responseBreaches = activeCases.filter(c => {
    if (c.doctor_time) return false;
    const mins = (now - new Date(c.arrival_time).getTime()) / 60000;
    const target = c.triage_level === 'RED' ? 0 : c.triage_level === 'ORANGE' ? 10 : c.triage_level === 'YELLOW' ? 30 : 60;
    return mins > target;
  }).length;
  const avgDoorMinutes = activeCases.length
    ? Math.round(activeCases.reduce((sum, c) => sum + ((now - new Date(c.arrival_time).getTime()) / 60000), 0) / activeCases.length)
    : 0;

  res.json({ success: true, data: { red, orange, yellow, green, blue, mlc, total, responseBreaches, avgDoorMinutes } });
});

module.exports = router;
