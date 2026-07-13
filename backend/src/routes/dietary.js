// src/routes/dietary.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { resolvePatientId, sanitizeModelInput } = require('../utils/prismaInput');
router.use(auth);
router.get('/orders', async (req, res) => {
  const orders = await prisma.dietOrder.findMany({ where: { is_active: true, patient: { hospital_id: req.hospitalId } }, include: { patient: { select: { first_name: true, last_name: true, uhid: true } } }, orderBy: { created_at: 'desc' } });
  res.json({ success: true, data: orders });
});
router.post('/orders', async (req, res) => {
  const data = sanitizeModelInput('DietOrder', req.body, {
    exclude: ['id', 'patient_id', 'ordered_by', 'created_at'],
  });
  data.patient_id = await resolvePatientId(prisma, req.hospitalId, req.body.patient_id);
  data.restrictions = data.restrictions || [];
  data.allergies = data.allergies || [];
  const o = await prisma.dietOrder.create({ data: { id: uuidv4(), ordered_by: req.user.id, ...data } });
  res.status(201).json({ success: true, data: o });
});
router.patch('/orders/:id', async (req, res) => {
  const data = sanitizeModelInput('DietOrder', req.body, {
    exclude: ['id', 'patient_id', 'ordered_by', 'created_at'],
  });
  if (req.body.patient_id) data.patient_id = await resolvePatientId(prisma, req.hospitalId, req.body.patient_id);
  const o = await prisma.dietOrder.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: o });
});
module.exports = router;
