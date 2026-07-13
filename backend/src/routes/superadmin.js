// src/routes/superadmin.js — SaaS multi-tenant management (your company panel)
const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { cleanString, requireFields, sanitizeModelInput, toDate, toInt } = require('../utils/prismaInput');

router.use(auth, rbac('SUPER_ADMIN'));

// ── Hospitals ──────────────────────────────────────────────────
router.get('/hospitals', async (req, res) => {
  const { search, license_type, is_active } = req.query;
  const hospitals = await prisma.hospital.findMany({
    where: {
      ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }, { city: { contains: search, mode: 'insensitive' } }] }),
      ...(license_type && { license_type }),
      ...(is_active !== undefined && { is_active: is_active === 'true' }),
    },
    include: {
      _count: { select: { users: true, patients: true, beds: true } },
      invoices: { where: { status: 'PENDING' }, select: { amount: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  const enriched = hospitals.map(h => ({
    ...h,
    user_count: h._count.users,
    patient_count: h._count.patients,
    bed_count: h._count.beds,
    pending_invoice_amount: h.invoices.reduce((sum, i) => sum + parseFloat(i.amount.toString()), 0),
    license_status: new Date(h.license_end) < new Date() ? 'EXPIRED' : new Date(h.license_end) < new Date(Date.now() + 30 * 86400000) ? 'EXPIRING_SOON' : 'ACTIVE',
    days_remaining: Math.ceil((new Date(h.license_end) - new Date()) / 86400000),
  }));

  res.json({ success: true, data: enriched });
});

router.get('/hospitals/:id', async (req, res) => {
  const hospital = await prisma.hospital.findUnique({
    where: { id: req.params.id },
    include: {
      users: { select: { id: true, first_name: true, last_name: true, email: true, role: true, is_active: true, last_login: true } },
      _count: { select: { users: true, patients: true, beds: true, bills: true } },
      invoices: { orderBy: { created_at: 'desc' }, take: 10 },
    },
  });
  if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });
  res.json({ success: true, data: hospital });
});

router.post('/hospitals', async (req, res) => {
  const { admin_email, admin_name, admin_password } = req.body;
  const data = sanitizeModelInput('Hospital', req.body, {
    exclude: ['id', 'license_start', 'license_end', 'is_active', 'created_at', 'updated_at'],
  });
  requireFields(data, ['name', 'code']);
  const licenseDays = req.body.license_days ? toInt(req.body.license_days, 'license_days') : 365;
  const licenseType = data.license_type || 'BASIC';

  const hospital = await prisma.hospital.create({
    data: {
      id: uuidv4(),
      ...data,
      code: cleanString(data.code).toUpperCase(),
      bed_capacity: data.bed_capacity || 100,
      license_type: licenseType,
      license_start: new Date(),
      license_end: new Date(Date.now() + licenseDays * 86400000),
      is_active: true,
      modules_enabled: data.modules_enabled?.length ? data.modules_enabled : ['PATIENTS','APPOINTMENTS','EMR','BILLING','PHARMACY','LAB'],
    },
  });

  // Create admin user for this hospital
  if (admin_email && admin_name) {
    const [firstName, ...rest] = (admin_name || 'Hospital Admin').split(' ');
    await prisma.user.create({
      data: {
        id: uuidv4(), hospital_id: hospital.id,
        first_name: firstName, last_name: rest.join(' ') || 'Admin',
        email: admin_email.toLowerCase(), role: 'HOSPITAL_ADMIN',
        password: await bcrypt.hash(admin_password || 'Admin@123', 12), is_active: true,
      },
    });
  }

  // Create initial invoice
  const licensePrice = { BASIC: 9999, PROFESSIONAL: 24999, ENTERPRISE: 49999 };
  await prisma.hospitalInvoice.create({
    data: {
      id: uuidv4(), hospital_id: hospital.id,
      amount: licensePrice[licenseType] || 9999,
      period_from: new Date(), period_to: new Date(Date.now() + licenseDays * 86400000),
      status: 'PENDING',
    },
  });

  res.status(201).json({ success: true, message: 'Hospital registered successfully', data: hospital });
});

router.put('/hospitals/:id', async (req, res) => {
  const data = sanitizeModelInput('Hospital', req.body, {
    exclude: ['id', 'created_at', 'updated_at'],
  });
  if (data.code) data.code = cleanString(data.code).toUpperCase();
  const hospital = await prisma.hospital.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: hospital });
});

router.patch('/hospitals/:id/toggle', async (req, res) => {
  const h = await prisma.hospital.findUnique({ where: { id: req.params.id } });
  const hospital = await prisma.hospital.update({ where: { id: req.params.id }, data: { is_active: !h.is_active } });
  res.json({ success: true, message: `Hospital ${hospital.is_active ? 'activated' : 'suspended'}`, data: { is_active: hospital.is_active } });
});

router.post('/hospitals/:id/extend-license', async (req, res) => {
  const { days, license_type } = req.body;
  const h = await prisma.hospital.findUnique({ where: { id: req.params.id } });
  const currentEnd = new Date(h.license_end) > new Date() ? new Date(h.license_end) : new Date();
  const hospital = await prisma.hospital.update({
    where: { id: req.params.id },
    data: { license_end: new Date(currentEnd.getTime() + parseInt(days) * 86400000), ...(license_type && { license_type }) },
  });
  res.json({ success: true, message: 'License extended', data: hospital });
});

router.patch('/hospitals/:id/modules', async (req, res) => {
  const hospital = await prisma.hospital.update({ where: { id: req.params.id }, data: { modules_enabled: req.body.modules_enabled } });
  res.json({ success: true, data: hospital });
});

// ── Global Stats ──────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  const [total_hospitals, active_hospitals, total_patients, total_users, revenue, expiring_soon, expired] = await Promise.all([
    prisma.hospital.count(),
    prisma.hospital.count({ where: { is_active: true } }),
    prisma.patient.count(),
    prisma.user.count({ where: { role: { not: 'SUPER_ADMIN' } } }),
    prisma.hospitalInvoice.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    prisma.hospital.count({ where: { is_active: true, license_end: { lte: new Date(Date.now() + 30 * 86400000), gte: new Date() } } }),
    prisma.hospital.count({ where: { license_end: { lt: new Date() } } }),
  ]);
  res.json({ success: true, data: { total_hospitals, active_hospitals, total_patients, total_users, total_revenue: revenue._sum.amount || 0, expiring_soon, expired } });
});

// ── Invoices ──────────────────────────────────────────────────
router.get('/invoices', async (req, res) => {
  const invoices = await prisma.hospitalInvoice.findMany({ include: { hospital: { select: { name: true, code: true } } }, orderBy: { created_at: 'desc' } });
  res.json({ success: true, data: invoices });
});

router.patch('/invoices/:id/mark-paid', async (req, res) => {
  const inv = await prisma.hospitalInvoice.update({ where: { id: req.params.id }, data: { status: 'PAID', paid_at: new Date() } });
  res.json({ success: true, data: inv });
});

// ── Staff User Control (super admin override) ──────────────────
router.patch('/users/:id/reset-password', async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed, refresh_token: null } });
  res.json({ success: true, message: `Password reset for ${user.first_name} ${user.last_name}` });
});

router.patch('/users/:id/toggle', async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!u) return res.status(404).json({ success: false, message: 'User not found' });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { is_active: !u.is_active } });
  res.json({ success: true, message: `User ${user.is_active ? 'activated' : 'deactivated'}`, data: { is_active: user.is_active } });
});

// ── Announcements ─────────────────────────────────────────────

router.post('/announcements', async (req, res) => {
  const data = sanitizeModelInput('Announcement', req.body, {
    exclude: ['id', 'created_by', 'created_at'],
  });
  data.expires_at = req.body.expires_at ? toDate(req.body.expires_at, 'expires_at') : null;
  const ann = await prisma.announcement.create({ data: { id: uuidv4(), created_by: req.user.id, ...data } });
  res.status(201).json({ success: true, data: ann });
});

module.exports = router;
