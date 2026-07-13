// src/routes/inventory.js
const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { HttpError, sanitizeModelInput, toFloat } = require('../utils/prismaInput');
router.use(auth);

const STOCK_INCREASE_TYPES = new Set(['RECEIPT', 'RETURN']);
const STOCK_DECREASE_TYPES = new Set(['ISSUE', 'TRANSFER']);

const stockDeltaFor = (type, quantity) => {
  if (STOCK_INCREASE_TYPES.has(type)) return quantity;
  if (STOCK_DECREASE_TYPES.has(type)) return -quantity;
  if (type === 'ADJUSTMENT') return quantity;
  throw new HttpError(400, 'Invalid transaction type');
};

router.get('/', async (req, res) => {
  const items = await prisma.inventoryItem.findMany({
    where: { hospital_id: req.hospitalId },
    include: { transactions: { take: 5, orderBy: { created_at: 'desc' } } },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: items });
});

router.get('/transactions', async (req, res) => {
  const transactions = await prisma.inventoryTransaction.findMany({
    where: { item: { hospital_id: req.hospitalId } },
    include: { item: { select: { name: true, code: true, unit: true, category: true } } },
    orderBy: { created_at: 'desc' },
    take: 100,
  });
  res.json({ success: true, data: transactions });
});
router.post('/', async (req, res) => {
  const data = sanitizeModelInput('InventoryItem', req.body, {
    exclude: ['id', 'hospital_id', 'created_at'],
  });
  if (!data.name || !data.category || !data.unit) throw new HttpError(400, 'Name, category and unit are required');
  const item = await prisma.inventoryItem.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, ...data } });
  res.status(201).json({ success: true, data: item });
});
router.post('/:id/transaction', async (req, res) => {
  const { type, quantity, from_dept, to_dept, reference } = req.body;
  const qty = Math.abs(toFloat(quantity, 'quantity'));
  if (qty <= 0) throw new HttpError(400, 'Quantity must be greater than zero');
  const txn = await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findFirst({ where: { id: req.params.id, hospital_id: req.hospitalId } });
    if (!item) throw new HttpError(404, 'Inventory item not found');
    const delta = stockDeltaFor(type, qty);
    const nextStock = Number(item.current_stock) + delta;
    if (nextStock < 0) throw new HttpError(409, 'Transaction exceeds available stock');
    const created = await tx.inventoryTransaction.create({
      data: { id: uuidv4(), item_id: item.id, type, quantity: qty, from_dept, to_dept, reference, done_by: req.user.id },
    });
    await tx.inventoryItem.update({ where: { id: item.id }, data: { current_stock: nextStock } });
    return created;
  });
  res.status(201).json({ success: true, data: txn });
});
router.get('/assets', async (req, res) => {
  const assets = await prisma.asset.findMany({ where: { hospital_id: req.hospitalId }, include: { maintenance_records: { take: 1, orderBy: { done_at: 'desc' } } }, orderBy: { name: 'asc' } });
  res.json({ success: true, data: assets });
});
router.post('/assets', async (req, res) => {
  const data = sanitizeModelInput('Asset', req.body, {
    exclude: ['id', 'hospital_id', 'created_at', 'last_service'],
  });
  if (!data.asset_tag || !data.name || !data.category) throw new HttpError(400, 'Asset tag, name and category are required');
  const asset = await prisma.asset.create({ data: { id: uuidv4(), hospital_id: req.hospitalId, ...data } });
  res.status(201).json({ success: true, data: asset });
});
router.post('/assets/:id/maintenance', async (req, res) => {
  const data = sanitizeModelInput('AssetMaintenance', req.body, {
    exclude: ['id', 'asset_id', 'done_at'],
  });
  if (!data.type) throw new HttpError(400, 'Maintenance type is required');
  const record = await prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findFirst({ where: { id: req.params.id, hospital_id: req.hospitalId } });
    if (!asset) throw new HttpError(404, 'Asset not found');
    const created = await tx.assetMaintenance.create({ data: { id: uuidv4(), asset_id: asset.id, ...data, done_at: new Date() } });
    await tx.asset.update({ where: { id: asset.id }, data: { last_service: new Date(), next_service: data.next_due || null, status: 'ACTIVE' } });
    return created;
  });
  res.status(201).json({ success: true, data: record });
});
module.exports = router;
