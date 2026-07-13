// src/routes/radiology.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { badRequest, resolvePatientId, sanitizeModelInput } = require('../utils/prismaInput');
router.use(auth);

const RADIOLOGY_STATUSES = ['ORDERED', 'SCHEDULED', 'IN_PROGRESS', 'PERFORMED', 'REPORTED', 'REVIEWED'];

router.get('/stats', async (req, res) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [active, stat, scheduled, performed, reportedToday, contrast] = await Promise.all([
    prisma.radiologyOrder.count({ where: { hospital_id: req.hospitalId, status: { notIn: ['REPORTED', 'REVIEWED'] } } }),
    prisma.radiologyOrder.count({ where: { hospital_id: req.hospitalId, is_stat: true, status: { notIn: ['REPORTED', 'REVIEWED'] } } }),
    prisma.radiologyOrder.count({ where: { hospital_id: req.hospitalId, status: 'SCHEDULED' } }),
    prisma.radiologyOrder.count({ where: { hospital_id: req.hospitalId, status: 'PERFORMED' } }),
    prisma.radiologyOrder.count({ where: { hospital_id: req.hospitalId, status: { in: ['REPORTED', 'REVIEWED'] }, performed_at: { gte: today } } }),
    prisma.radiologyOrder.count({ where: { hospital_id: req.hospitalId, contrast_required: true, status: { notIn: ['REPORTED', 'REVIEWED'] } } }),
  ]);
  res.json({ success: true, data: { active, stat, scheduled, performed, reportedToday, contrast } });
});

router.get('/orders', async (req, res) => {
  const { status, modality } = req.query;
  const orders = await prisma.radiologyOrder.findMany({ where: { hospital_id: req.hospitalId, ...(status && { status }), ...(modality && { modality }) }, include: { patient: { select: { first_name: true, last_name: true, uhid: true } } }, orderBy: [{ is_stat: 'desc' }, { created_at: 'desc' }] });
  res.json({ success: true, data: orders });
});
router.post('/orders', async (req, res) => {
  const count = await prisma.radiologyOrder.count({ where: { hospital_id: req.hospitalId } });
  const study_no = `RAD-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
  const data = sanitizeModelInput('RadiologyOrder', req.body, {
    exclude: ['id', 'hospital_id', 'study_no', 'patient_id', 'ordered_by', 'status', 'performed_at', 'reported_by', 'report', 'impression', 'created_at'],
  });
  data.patient_id = await resolvePatientId(prisma, req.hospitalId, req.body.patient_id);
  const o = await prisma.radiologyOrder.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, study_no, ordered_by: req.user.id, ...data } });
  res.status(201).json({ success: true, data: o });
});

router.patch('/orders/:id/status', async (req, res) => {
  const status = String(req.body.status || '').trim().toUpperCase();
  if (!RADIOLOGY_STATUSES.includes(status)) badRequest(`Invalid radiology status. Expected one of: ${RADIOLOGY_STATUSES.join(', ')}`);

  const data = { status };
  if (['PERFORMED', 'REPORTED', 'REVIEWED'].includes(status)) data.performed_at = new Date();
  const o = await prisma.radiologyOrder.update({
    where: { id: req.params.id },
    data,
    include: { patient: { select: { first_name: true, last_name: true, uhid: true } } },
  });
  res.json({ success: true, data: o });
});

router.patch('/orders/:id/report', async (req, res) => {
  const images_path = Array.isArray(req.body.images_path) ? req.body.images_path.filter(Boolean) : undefined;
  const o = await prisma.radiologyOrder.update({
    where: { id: req.params.id },
    data: {
      report: req.body.report,
      impression: req.body.impression,
      ...(images_path && { images_path }),
      status: 'REPORTED',
      reported_by: req.user.id,
      performed_at: new Date(),
    },
  });
  res.json({ success: true, data: o });
});
module.exports = router;

// ─────────────────────────────────────────────────
// src/routes/mortuary.js
