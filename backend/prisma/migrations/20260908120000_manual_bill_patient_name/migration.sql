ALTER TABLE "bills" ALTER COLUMN "patient_id" DROP NOT NULL;

ALTER TABLE "bills" ADD COLUMN "patient_name" TEXT;
