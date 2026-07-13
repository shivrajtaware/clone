const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { badRequest, cleanString, isBlank, toInt } = require('../utils/prismaInput');
const { emitToHospital } = require('../config/socket');

router.use(auth);

const requireHospital = (req) => {
  if (!req.hospitalId) badRequest('Hospital context is required');
  return req.hospitalId;
};

const normalizeOptionalText = (value) => {
  const cleaned = cleanString(value);
  return isBlank(cleaned) ? null : cleaned;
};

const normalizeItems = (items = []) => {
  if (!Array.isArray(items)) badRequest('Medicine stack items must be an array');

  const normalized = items
    .map((rawItem, index) => {
      const item = rawItem || {};
      return {
        drug_name: normalizeOptionalText(item.drug_name),
        generic_name: normalizeOptionalText(item.generic_name),
        strength: normalizeOptionalText(item.strength),
        form: normalizeOptionalText(item.form),
        dose: normalizeOptionalText(item.dose),
        frequency: normalizeOptionalText(item.frequency),
        duration: normalizeOptionalText(item.duration),
        route: normalizeOptionalText(item.route) || 'Oral',
        instructions: normalizeOptionalText(item.instructions),
        quantity: isBlank(item.quantity) ? null : toInt(item.quantity, 'quantity'),
        sort_order: isBlank(item.sort_order) ? index : toInt(item.sort_order, 'sort_order'),
      };
    })
    .filter(item => item.drug_name);

  const invalid = normalized.find(item => !item.dose || !item.frequency || !item.duration);
  if (invalid) badRequest('Each medicine needs dose, frequency, and duration');
  if (!normalized.length) badRequest('Add at least one medicine to the stack');

  return normalized;
};

const stackInclude = {
  items: { orderBy: [{ sort_order: 'asc' }, { drug_name: 'asc' }] },
};

router.get('/', async (req, res) => {
  const hospitalId = requireHospital(req);
  const stacks = await prisma.medicineStack.findMany({
    where: { hospital_id: hospitalId },
    include: stackInclude,
    orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
  });

  res.json({ success: true, data: stacks });
});

router.post('/', async (req, res) => {
  const hospitalId = requireHospital(req);
  const name = normalizeOptionalText(req.body.name);
  if (!name) badRequest('Stack name is required');

  const items = normalizeItems(req.body.items);
  const stack = await prisma.medicineStack.create({
    data: {
      id: uuidv4(),
      hospital_id: hospitalId,
      name,
      condition: normalizeOptionalText(req.body.condition),
      description: normalizeOptionalText(req.body.description),
      is_active: req.body.is_active !== false,
      items: { create: items.map(item => ({ id: uuidv4(), ...item })) },
    },
    include: stackInclude,
  });
  emitToHospital(hospitalId, 'medicineStacks:updated', { type:'CREATED'});
  res.status(201).json({ success: true, message: 'Medicine stack created', data: stack });
});

router.put('/:id', async (req, res) => {
  const hospitalId = requireHospital(req);
  const existing = await prisma.medicineStack.findFirst({
    where: { id: req.params.id, hospital_id: hospitalId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ success: false, message: 'Medicine stack not found' });

  const name = normalizeOptionalText(req.body.name);
  if (!name) badRequest('Stack name is required');

  const items = normalizeItems(req.body.items);
  const stack = await prisma.medicineStack.update({
    where: { id: req.params.id },
    data: {
      name,
      condition: normalizeOptionalText(req.body.condition),
      description: normalizeOptionalText(req.body.description),
      is_active: req.body.is_active !== false,
      items: {
        deleteMany: {},
        create: items.map(item => ({ id: uuidv4(), ...item })),
      },
    },
    include: stackInclude,
  });
  emitToHospital(hospitalId,'medicineStacks:updated',{type:'UPDATED'});
  res.json({ success: true, message: 'Medicine stack updated', data: stack });
});

router.delete('/:id', async (req, res) => {
  const hospitalId = requireHospital(req);
  const existing = await prisma.medicineStack.findFirst({
    where: { id: req.params.id, hospital_id: hospitalId },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ success: false, message: 'Medicine stack not found' });

  await prisma.medicineStack.delete({ where: { id: req.params.id } });
  emitToHospital(hospitalId,'medicineStacks:updated',{type:'DELETED'});
  res.json({ success: true, message: 'Medicine stack deleted' });
});

module.exports = router;
