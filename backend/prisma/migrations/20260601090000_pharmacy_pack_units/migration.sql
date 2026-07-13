ALTER TABLE "pharmacy_items"
ADD COLUMN IF NOT EXISTS "pack_unit" TEXT NOT NULL DEFAULT 'strip',
ADD COLUMN IF NOT EXISTS "units_per_pack" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "prescription_items"
ADD COLUMN IF NOT EXISTS "quantity_unit" TEXT;

UPDATE "pharmacy_items"
SET "units_per_pack" = 1
WHERE "units_per_pack" IS NULL OR "units_per_pack" < 1;
