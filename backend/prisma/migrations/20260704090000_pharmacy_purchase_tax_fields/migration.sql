ALTER TABLE "drug_batches"
  ADD COLUMN "selling_price" DECIMAL(65,30),
  ADD COLUMN "gst_pct" DECIMAL(65,30) DEFAULT 0,
  ADD COLUMN "taxable_rate" DECIMAL(65,30),
  ADD COLUMN "cgst_amt" DECIMAL(65,30) DEFAULT 0,
  ADD COLUMN "sgst_amt" DECIMAL(65,30) DEFAULT 0,
  ADD COLUMN "igst_amt" DECIMAL(65,30) DEFAULT 0,
  ADD COLUMN "purchase_total" DECIMAL(65,30);

UPDATE "drug_batches"
SET
  "selling_price" = "mrp",
  "taxable_rate" = COALESCE("cost_price", 0),
  "purchase_total" = COALESCE("cost_price", 0) * "quantity_in"
WHERE "purchase_total" IS NULL;
