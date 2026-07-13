// src/routes/ambulance.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { resolvePatientId, sanitizeModelInput } = require('../utils/prismaInput');
router.use(auth);
router.get('/', async (req, res) => {
  const amb = await prisma.ambulance.findMany({ where: { hospital_id: req.hospitalId, is_active: true }, include: { trips: { where: { status: { in: ['DISPATCHED','EN_ROUTE','PICKED_UP'] } }, take: 1 } }, orderBy: { vehicle_no: 'asc' } });
  res.json({ success: true, data: amb });
});
router.post('/', async (req, res) => {
  const data = sanitizeModelInput('Ambulance', req.body, {
    exclude: ['id', 'hospital_id', 'created_at'],
  });
  const a = await prisma.ambulance.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, ...data } });
  res.status(201).json({ success: true, data: a });
});
router.patch('/:id/status', async (req, res) => {
  const a = await prisma.ambulance.update({ where: { id: req.params.id }, data: { status: req.body.status } });
  res.json({ success: true, data: a });
});
router.post('/:id/dispatch', async (req, res) => {
  const data = sanitizeModelInput('AmbulanceTrip', req.body, {
    exclude: ['id', 'ambulance_id', 'dispatch_time', 'created_at'],
  });
  if (req.body.patient_id) data.patient_id = await resolvePatientId(prisma, req.hospitalId, req.body.patient_id);
  const [trip] = await prisma.$transaction([
    prisma.ambulanceTrip.create({ data: { id: uuidv4(), ambulance_id: req.params.id, dispatch_time: new Date(), status: 'DISPATCHED', ...data } }),
    prisma.ambulance.update({ where: { id: req.params.id }, data: { status: 'ON_CALL' } }),
  ]);
  res.status(201).json({ success: true, data: trip });
});
router.patch('/trips/:id/status', async (req, res) => {
  const { status, paramedic_notes, km_covered } = req.body;
  const allowed = ['DISPATCHED', 'EN_ROUTE', 'PICKED_UP', 'ARRIVED', 'COMPLETED', 'CANCELLED'];
  if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid trip status' });

  const trip = await prisma.ambulanceTrip.findFirst({
    where: { id: req.params.id, ambulance: { hospital_id: req.hospitalId } },
    include: { ambulance: true },
  });
  if (!trip) return res.status(404).json({ success: false, message: 'Trip not found' });

  const updates = { status };
  if (status === 'EN_ROUTE' && !trip.dispatch_time) updates.dispatch_time = new Date();
  if (status === 'PICKED_UP' && !trip.pickup_time) updates.pickup_time = new Date();
  if (status === 'ARRIVED' && !trip.arrive_time) updates.arrive_time = new Date();
  if (paramedic_notes !== undefined) updates.paramedic_notes = paramedic_notes;
  if (km_covered !== undefined && km_covered !== '') updates.km_covered = parseFloat(km_covered);

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.ambulanceTrip.update({ where: { id: trip.id }, data: updates });
    if (['COMPLETED', 'CANCELLED'].includes(status)) {
      await tx.ambulance.update({ where: { id: trip.ambulance_id }, data: { status: status === 'COMPLETED' ? 'RETURNING' : 'AVAILABLE' } });
    }
    if (status === 'ARRIVED') {
      await tx.ambulance.update({ where: { id: trip.ambulance_id }, data: { status: 'RETURNING' } });
    }
    return updated;
  });

  res.json({ success: true, data: result });
});
router.get('/trips', async (req, res) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const trips = await prisma.ambulanceTrip.findMany({ where: { ambulance: { hospital_id: req.hospitalId }, call_time: { gte: today } }, include: { ambulance: { select: { vehicle_no: true, type: true } } }, orderBy: { call_time: 'desc' } });
  res.json({ success: true, data: trips });
});
module.exports = router;
