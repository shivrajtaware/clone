ALTER TABLE "bills"
  ADD COLUMN "patient_address" TEXT,
  ADD COLUMN "patient_mobile" TEXT,
  ADD COLUMN "admission_date" TIMESTAMP(3),
  ADD COLUMN "bill_date" TIMESTAMP(3);
