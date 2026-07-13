// src/routes/dashboard.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
router.use(auth);

router.get('/', async (req, res) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today.getTime() + 86400000);

  const [recentPatients, todayAppts, announcements, pendingLabOrders, lowStockItems] = await Promise.all([
    prisma.admission.findMany({ where: { hospital_id: req.hospitalId, admission_date: { gte: today } }, take: 5, orderBy: { admission_date: 'desc' }, include: { patient: { select: { first_name: true, last_name: true, uhid: true, gender: true } }, bed: { select: { ward: true, bed_no: true } } } }),
    prisma.appointment.findMany({ where: { hospital_id: req.hospitalId, appointment_date: { gte: today, lt: tomorrow }, status: { notIn: ['CANCELLED'] } }, take: 10, orderBy: { token_no: 'asc' }, include: { patient: { select: { first_name: true, last_name: true } }, doctor: { select: { first_name: true, last_name: true } } } }),
    prisma.announcement.findMany({ where: { OR: [{ hospital_id: req.hospitalId }, { hospital_id: null }], expires_at: { gte: new Date() } }, orderBy: { created_at: 'desc' }, take: 5 }),
    prisma.labOrder.count({ where: { hospital_id: req.hospitalId, is_stat: true, status: { notIn: ['VERIFIED', 'REPORTED'] } } }),
    prisma.pharmacyItem.findMany({ where: { hospital_id: req.hospitalId }, take: 5 }).then(items => items.filter(i => i.current_stock <= i.min_stock_level).slice(0, 5)),
  ]);

  res.json({ success: true, data: { recentPatients, todayAppts, announcements, pendingLabOrders, lowStockItems } });
});

module.exports = router;
