require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const file = path.resolve(__dirname, '../../backups/pharmacy/pharmacy-inventory-2026-07-20T09-45-21-910Z.json');
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  const hospital = await prisma.hospital.findUnique({ where: { code: 'CCH-DEMO' } });
  if (!hospital) throw new Error('CCH-DEMO hospital not found');
  const alreadyCloned = await prisma.auditLog.findFirst({ where: { hospital_id: hospital.id, module: 'PHARMACY', action: 'DEMO_BACKUP_CLONED' } });
  if (alreadyCloned) { console.log('Demo pharmacy backup already cloned.'); return; }

  let items = 0; let batches = 0;
  await prisma.$transaction(async tx => {
    for (const source of payload.pharmacy_items) {
      const itemId = uuid();
      await tx.pharmacyItem.create({ data: { id: itemId, hospital_id: hospital.id, generic_name: source.generic_name, brand_name: source.brand_name, category: source.category, form: source.form, strength: source.strength, unit: source.unit, pack_unit: source.pack_unit || 'strip', units_per_pack: source.units_per_pack || 1, current_stock: source.current_stock || 0, min_stock_level: source.min_stock_level || 10, max_stock_level: source.max_stock_level || 1000, reorder_quantity: source.reorder_quantity || 100, is_controlled: !!source.is_controlled, is_cold_chain: !!source.is_cold_chain, rack_location: source.rack_location, created_at: source.created_at ? new Date(source.created_at) : new Date() } });
      items += 1;
      for (const sourceBatch of source.batches || []) { await tx.drugBatch.create({ data: { id: uuid(), item_id: itemId, batch_no: sourceBatch.batch_no, mfg_date: sourceBatch.mfg_date ? new Date(sourceBatch.mfg_date) : null, expiry_date: new Date(sourceBatch.expiry_date), quantity_in: sourceBatch.quantity_in || 0, quantity_rem: sourceBatch.quantity_rem || 0, mrp: sourceBatch.mrp, selling_price: sourceBatch.selling_price, cost_price: sourceBatch.cost_price, gst_pct: sourceBatch.gst_pct, taxable_rate: sourceBatch.taxable_rate, cgst_amt: sourceBatch.cgst_amt, sgst_amt: sourceBatch.sgst_amt, igst_amt: sourceBatch.igst_amt, purchase_total: sourceBatch.purchase_total, supplier: sourceBatch.supplier, created_at: sourceBatch.created_at ? new Date(sourceBatch.created_at) : new Date() } }); batches += 1; }
    }
    await tx.auditLog.create({ data: { id: uuid(), hospital_id: hospital.id, module: 'PHARMACY', action: 'DEMO_BACKUP_CLONED', new_values: { source: file, items, batches } } });
  }, { timeout: 120000 });
  console.log(JSON.stringify({ hospital: hospital.name, items, batches }, null, 2));
}
main().catch(error => { console.error('Pharmacy clone failed:', error.message || error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
