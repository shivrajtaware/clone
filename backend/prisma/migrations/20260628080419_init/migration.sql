ALTER TABLE "ot_records" DROP CONSTRAINT IF EXISTS "ot_records_admission_id_fkey";
DROP INDEX IF EXISTS "prescription_items_pharmacy_item_id_idx";
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "barcode_data" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "barcode_image" TEXT;
ALTER TABLE "ot_records" ADD CONSTRAINT "ot_records_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
