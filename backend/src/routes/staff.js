// src/routes/staff.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { cleanString, requireFields, sanitizeModelInput, toDate } = require('../utils/prismaInput');
const { ALL_MODULES, ROLE_DEFAULT_MODULES, normalizeModules } = require('../utils/modulePermissions');
const { emitToHospital } = require('../config/socket');
router.use(auth);

router.get('/', async (req, res) => {
  const { role, department_id, search } = req.query;
  const users = await prisma.user.findMany({
    where: {
      hospital_id: req.hospitalId,
      role: { not: 'SUPER_ADMIN' },
      ...(role && { role }),
      ...(department_id && { department_id }),
      ...(search && { OR: [{ first_name: { contains: search, mode: 'insensitive' } }, { last_name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] }),
    },
    include: { department: { select: { name: true } }, doctor_profile: true },
    orderBy: { first_name: 'asc' },
  });
  res.json({ success: true, data: users.map(u => { const { password, refresh_token, ...safe } = u; return safe; }) });
});

router.post('/', rbac('HOSPITAL_ADMIN', 'HR_MANAGER'), async (req, res) => {
  const { password, doctor_profile } = req.body;
  const data = sanitizeModelInput('User', req.body, {
    only: ['first_name', 'last_name', 'email', 'phone', 'role', 'department_id', 'designation', 'is_active'],
  });
  requireFields(data, ['first_name', 'last_name', 'email', 'role']);
  data.email = cleanString(data.email).toLowerCase();

  const doctorProfile = doctor_profile
    ? sanitizeModelInput('DoctorProfile', doctor_profile, { exclude: ['id', 'user_id', 'created_at'] })
    : null;
  const hashed = await bcrypt.hash(password || 'Welcome@123', 12);
  const user = await prisma.user.create({
    data: {
      id: uuidv4(), hospital_id: req.hospitalId, employee_id: `EMP-${Date.now().toString().slice(-6)}`,
      ...data, password: hashed, is_active: true,
      doctor_profile: data.role === 'DOCTOR' && doctorProfile ? { create: { id: uuidv4(), ...doctorProfile } } : undefined,
    },
    include: { doctor_profile: true, department: { select: { name: true } } },
  });
  const { password: _, refresh_token, ...safe } = user;
  emitToHospital(req.hospitalId, 'staff:refresh', { action: 'created', staff: safe });
  res.status(201).json({ success: true, data: safe });
});

router.get('/module-permissions', rbac('HOSPITAL_ADMIN', 'HR_MANAGER'), async (req, res) => {
  const saved = await prisma.$queryRaw`
    SELECT role::text AS role, modules
    FROM role_module_permissions
    WHERE hospital_id = ${req.hospitalId}
  `;
  const savedByRole = new Map(saved.map(item => [item.role, item.modules]));
  const data = Object.entries(ROLE_DEFAULT_MODULES)
    .filter(([role]) => !['SUPER_ADMIN', 'HOSPITAL_ADMIN'].includes(role))
    .map(([role, defaults]) => ({
      role,
      modules: savedByRole.has(role) ? normalizeModules(savedByRole.get(role)) : defaults,
      default_modules: defaults,
    }));

  res.json({ success: true, data: { modules: ALL_MODULES, roles: data } });
});

router.put('/module-permissions/:role', rbac('HOSPITAL_ADMIN', 'HR_MANAGER'), async (req, res) => {
  const role = String(req.params.role || '').toUpperCase();
  if (!ROLE_DEFAULT_MODULES[role] || ['SUPER_ADMIN', 'HOSPITAL_ADMIN'].includes(role)) {
    return res.status(400).json({ success: false, message: 'This role cannot be configured here.' });
  }

  const modules = normalizeModules(req.body.modules);
  if (!modules.length) return res.status(400).json({ success: false, message: 'Select at least one module.' });

  const [permission] = await prisma.$queryRaw`
    INSERT INTO role_module_permissions (id, hospital_id, role, modules, created_at, updated_at)
    VALUES (${uuidv4()}, ${req.hospitalId}, ${role}::"UserRole", ${modules}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (hospital_id, role)
    DO UPDATE SET modules = ${modules}, updated_at = CURRENT_TIMESTAMP
    RETURNING id, hospital_id, role::text AS role, modules, created_at, updated_at
  `;

  res.json({ success: true, data: permission });
});

router.put('/:id', async (req, res) => {
  const { password, ...data } = req.body;
  const updateData = sanitizeModelInput('User', data, {
    exclude: ['id', 'hospital_id', 'employee_id', 'password', 'refresh_token', 'created_at', 'updated_at', 'last_login'],
  });
  if (updateData.email) updateData.email = cleanString(updateData.email).toLowerCase();
  const user = await prisma.user.update({ where: { id: req.params.id }, data: updateData });
  const { password: _, refresh_token, ...safe } = user;
  res.json({ success: true, data: safe });
});

router.get('/roster', async (req, res) => {
  const { date, ward } = req.query;
  const start = new Date((date || new Date().toISOString().split('T')[0]) + 'T00:00:00');
  const end   = new Date((date || new Date().toISOString().split('T')[0]) + 'T23:59:59');
  const roster = await prisma.shiftRoster.findMany({ where: { hospital_id: req.hospitalId, date: { gte: start, lte: end }, ...(ward && { ward }) }, include: { } });
  res.json({ success: true, data: roster });
});

router.post('/roster', async (req, res) => {
  const data = sanitizeModelInput('ShiftRoster', req.body, {
    exclude: ['id', 'hospital_id', 'created_at'],
  });
  data.date = toDate(req.body.date, 'date');
  const entry = await prisma.shiftRoster.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, ...data } });
  res.status(201).json({ success: true, data: entry });
});

router.get('/leaves', async (req, res) => {
  const leaves = await prisma.leaveRequest.findMany({ where: { hospital_id: req.hospitalId }, orderBy: { created_at: 'desc' }, take: 50 });
  res.json({ success: true, data: leaves });
});

router.post('/leaves', async (req, res) => {
  const data = sanitizeModelInput('LeaveRequest', req.body, {
    exclude: ['id', 'hospital_id', 'user_id', 'status', 'approved_by', 'approved_at', 'created_at'],
  });
  data.from_date = toDate(req.body.from_date, 'from_date');
  data.to_date = toDate(req.body.to_date, 'to_date');
  const leave = await prisma.leaveRequest.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, user_id: req.user.id, ...data } });
  res.status(201).json({ success: true, data: leave });
});

router.patch('/leaves/:id', rbac('HOSPITAL_ADMIN', 'HR_MANAGER'), async (req, res) => {
  const data = sanitizeModelInput('LeaveRequest', req.body, {
    exclude: ['id', 'hospital_id', 'user_id', 'approved_by', 'approved_at', 'created_at'],
  });
  if (data.status === 'APPROVED') {
    data.approved_by = req.user.id;
    data.approved_at = new Date();
  }
  const leave = await prisma.leaveRequest.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: leave });
});

module.exports = router;
