// src/routes/compliance.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { sanitizeModelInput } = require('../utils/prismaInput');
router.use(auth);
router.get('/incidents', async (req, res) => {
  const { status } = req.query;
  const inc = await prisma.incident.findMany({ where: { hospital_id: req.hospitalId, ...(status && { status }) }, orderBy: { reported_at: 'desc' } });
  res.json({ success: true, data: inc });
});
router.post('/incidents', async (req, res) => {
  const count = await prisma.incident.count({ where: { hospital_id: req.hospitalId } });
  const incident_no = `INC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
  const data = sanitizeModelInput('Incident', req.body, {
    exclude: ['id', 'hospital_id', 'incident_no', 'reported_by', 'reported_at'],
  });
  const inc = await prisma.incident.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, incident_no, reported_by: req.user.id, ...data } });
  res.status(201).json({ success: true, data: inc });
});
router.patch('/incidents/:id', async (req, res) => {
  const data = sanitizeModelInput('Incident', req.body, {
    exclude: ['id', 'hospital_id', 'incident_no', 'reported_by', 'reported_at'],
  });
  const inc = await prisma.incident.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: inc });
});
router.get('/audit-logs', async (req, res) => {
  const { module, user_id, page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const logs = await prisma.auditLog.findMany({
    where: { hospital_id: req.hospitalId, ...(module && { module }), ...(user_id && { user_id }) },
    skip, take: parseInt(limit), orderBy: { created_at: 'desc' },
    include: { user: { select: { first_name: true, last_name: true, role: true } } },
  });
  res.json({ success: true, data: logs });
});
module.exports = router;
