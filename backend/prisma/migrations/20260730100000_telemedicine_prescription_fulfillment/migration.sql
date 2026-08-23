CREATE TYPE "PrescriptionFulfillment" AS ENUM ('HOSPITAL_PHARMACY', 'PRESCRIPTION_ONLY');
ALTER TABLE "prescriptions" ADD COLUMN "fulfillment_mode" "PrescriptionFulfillment" NOT NULL DEFAULT 'HOSPITAL_PHARMACY';
