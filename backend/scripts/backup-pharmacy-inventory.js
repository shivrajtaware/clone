/*
 * Creates a portable, read-only backup of all pharmacy items and their batches.
 * Run from backend with: node scripts/backup-pharmacy-inventory.js
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const backupDir = path.resolve(__dirname, '../../backups/pharmacy');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `pharmacy-inventory-${stamp}.json`);

const jsonSafe = (value) => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object' && typeof value.toJSON === 'function') return value.toJSON();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  return value;
};

async function main() {
  const items = await prisma.pharmacyItem.findMany({
    include: { batches: { orderBy: [{ expiry_date: 'asc' }, { created_at: 'asc' }] } },
    orderBy: [{ hospital_id: 'asc' }, { generic_name: 'asc' }],
  });

  const payload = {
    backup_type: 'pharmacy-inventory',
    backup_version: 1,
    created_at: new Date().toISOString(),
    source: 'MediCore HMS Prisma database',
    counts: {
      pharmacy_items: items.length,
      drug_batches: items.reduce((count, item) => count + item.batches.length, 0),
    },
    // Each item retains its original id and each batch retains item_id,
    // so this file can be used for a precise restore if needed.
    pharmacy_items: jsonSafe(items),
  };

  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(backupPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ backup_path: backupPath, ...payload.counts }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
