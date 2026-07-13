// src/routes/communication.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { sanitizeModelInput, toDate } = require('../utils/prismaInput');
router.use(auth);
router.get('/messages', async (req, res) => {
  const { to_user_id } = req.query;
  const messages = await prisma.message.findMany({
    where: { hospital_id: req.hospitalId, OR: [{ from_user_id: req.user.id, to_user_id }, { from_user_id: to_user_id, to_user_id: req.user.id }] },
    orderBy: { created_at: 'asc' }, take: 100,
  });
  res.json({ success: true, data: messages });
});
router.post('/messages', async (req, res) => {
  const data = sanitizeModelInput('Message', req.body, {
    exclude: ['id', 'hospital_id', 'from_user_id', 'created_at'],
  });
  const msg = await prisma.message.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, from_user_id: req.user.id, ...data } });
  res.status(201).json({ success: true, data: msg });
});
router.get('/announcements', async (req, res) => {
  const ann = await prisma.announcement.findMany({ where: { OR: [{ hospital_id: req.hospitalId }, { hospital_id: null }], expires_at: { gte: new Date() } }, orderBy: { created_at: 'desc' }, take: 20 });
  res.json({ success: true, data: ann });
});
router.post('/announcements', async (req, res) => {
  const data = sanitizeModelInput('Announcement', req.body, {
    exclude: ['id', 'hospital_id', 'created_by', 'created_at'],
  });
  data.expires_at = req.body.expires_at ? toDate(req.body.expires_at, 'expires_at') : null;
  const ann = await prisma.announcement.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, created_by: req.user.id, ...data } });
  res.status(201).json({ success: true, data: ann });
});
module.exports = router;
