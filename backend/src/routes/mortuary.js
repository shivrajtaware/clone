// src/routes/mortuary.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { resolvePatientId, sanitizeModelInput } = require('../utils/prismaInput');
router.use(auth);
router.get('/', async (req, res) => {
  const records = await prisma.mortuaryRecord.findMany({ where: { hospital_id: req.hospitalId }, orderBy: { dod: 'desc' } });
  res.json({ success: true, data: records });
});
router.post('/', async (req, res) => {
  const count = await prisma.mortuaryRecord.count({ where: { hospital_id: req.hospitalId } });
  const body_tag = `BODY-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
  const data = sanitizeModelInput('MortuaryRecord', req.body, {
    exclude: ['id', 'hospital_id', 'body_tag', 'patient_id', 'created_at', 'released_at'],
  });
  if (req.body.patient_id) data.patient_id = await resolvePatientId(prisma, req.hospitalId, req.body.patient_id);
  const r = await prisma.mortuaryRecord.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, body_tag, ...data } });
  res.status(201).json({ success: true, data: r });
});
router.patch('/:id/release', async (req, res) => {
  const r = await prisma.mortuaryRecord.update({ where: { id: req.params.id }, data: { is_released: true, released_to: req.body.released_to, released_at: new Date() } });
  res.json({ success: true, data: r });
});
module.exports = router;
