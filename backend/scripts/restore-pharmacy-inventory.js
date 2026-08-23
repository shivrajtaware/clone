/*
 * Restores pharmacy items and batches from backups/pharmacy/*.json.
 * Usage from backend:
 *   node scripts/restore-pharmacy-inventory.js
 *   node scripts/restore-pharmacy-inventory.js ../../backups/pharmacy/file.json
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const backupArg = process.argv[2];
const backupDir = path.resolve(__dirname, '../../backups/pharmacy');

function latestBackup() {
  const files = fs.readdirSync(backupDir)
    .filter((name) => /^pharmacy-inventory-.*\.json$/.test(name))
    .sort();
  if (!files.length) throw new Error(`No pharmacy backup JSON found in ${backupDir}`);
  return path.join(backupDir, files[files.length - 1]);
}

function dateOrNull(value) {
  return value ? new Date(value) : null;
}

function pickItem(item, hospitalId) {
  return {
    hospital_id: hospitalId,
    generic_name: item.generic_name,
    brand_name: item.brand_name,
    category: item.category,
    form: item.form,
    strength: item.strength,
    unit: item.unit,
    pack_unit: item.pack_unit || 'strip',
    units_per_pack: item.units_per_pack || 1,
    current_stock: item.current_stock || 0,
    min_stock_level: item.min_stock_level || 10,
    max_stock_level: item.max_stock_level || 1000,
    reorder_quantity: item.reorder_quantity || 100,
    is_controlled: !!item.is_controlled,
    is_cold_chain: !!item.is_cold_chain,
    rack_location: item.rack_location,
    created_at: dateOrNull(item.created_at) || new Date(),
  };
}

function pickBatch(batch, itemId) {
  return {
    item_id: itemId,
    batch_no: batch.batch_no,
    mfg_date: dateOrNull(batch.mfg_date),
    expiry_date: dateOrNull(batch.expiry_date),
    quantity_in: batch.quantity_in || 0,
    quantity_rem: batch.quantity_rem || 0,
    mrp: batch.mrp,
    selling_price: batch.selling_price,
    cost_price: batch.cost_price,
    gst_pct: batch.gst_pct,
    taxable_rate: batch.taxable_rate,
    cgst_amt: batch.cgst_amt,
    sgst_amt: batch.sgst_amt,
    igst_amt: batch.igst_amt,
    purchase_total: batch.purchase_total,
    supplier: batch.supplier,
    created_at: dateOrNull(batch.created_at) || new Date(),
  };
}

async function main() {
  const backupPath = path.resolve(process.cwd(), backupArg || latestBackup());
  const payload = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  if (payload.backup_type !== 'pharmacy-inventory') throw new Error('Not a pharmacy inventory backup');

  const targetHospitalId = process.env.RESTORE_TO_HOSPITAL_ID
    || (await prisma.hospital.findFirst({ select: { id: true }, orderBy: { created_at: 'asc' } }))?.id
    || payload.pharmacy_items[0]?.hospital_id;
  if (!targetHospitalId) throw new Error('No hospital found for restore');

  const result = await prisma.$transaction(async (tx) => {
    let items = 0;
    let batches = 0;

    for (const item of payload.pharmacy_items) {
      const data = pickItem(item, targetHospitalId);
      await tx.pharmacyItem.upsert({
        where: { id: item.id },
        create: { id: item.id, ...data },
        update: data,
      });
      items += 1;

      for (const batch of item.batches || []) {
        await tx.drugBatch.upsert({
          where: { id: batch.id },
          create: { id: batch.id, ...pickBatch(batch, item.id) },
          update: pickBatch(batch, item.id),
        });
        batches += 1;
      }
    }

    return { items, batches };
  }, { timeout: 60000 });

  console.log(JSON.stringify({ backup: backupPath, hospital_id: targetHospitalId, ...result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
