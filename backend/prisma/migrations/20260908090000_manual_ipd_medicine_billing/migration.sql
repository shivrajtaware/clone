ALTER TABLE "bills" ADD COLUMN "doctor_name" TEXT;

ALTER TABLE "bill_items"
  ADD COLUMN "item_id" TEXT,
  ADD COLUMN "pack" TEXT,
  ADD COLUMN "batch_no" TEXT,
  ADD COLUMN "expiry_date" TIMESTAMP(3),
  ADD COLUMN "mrp" DECIMAL(65,30),
  ADD COLUMN "sale_rate" DECIMAL(65,30);
