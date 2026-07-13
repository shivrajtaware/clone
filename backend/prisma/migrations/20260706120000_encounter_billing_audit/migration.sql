ALTER TABLE "emr_notes" ADD COLUMN "appointment_id" TEXT;
ALTER TABLE "emr_notes" ADD COLUMN "encounter_type" TEXT NOT NULL DEFAULT 'OPD';

ALTER TABLE "vitals" ADD COLUMN "appointment_id" TEXT;
ALTER TABLE "vitals" ADD COLUMN "admission_id" TEXT;
ALTER TABLE "vitals" ADD COLUMN "encounter_type" TEXT NOT NULL DEFAULT 'OPD';

ALTER TABLE "prescriptions" ADD COLUMN "appointment_id" TEXT;
ALTER TABLE "prescriptions" ADD COLUMN "admission_id" TEXT;
ALTER TABLE "prescriptions" ADD COLUMN "encounter_type" TEXT NOT NULL DEFAULT 'OPD';

ALTER TABLE "prescription_items" ADD COLUMN "collect_bill_here" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "prescription_items" ADD COLUMN "charge_amount" DECIMAL(65,30);

ALTER TABLE "bills" ADD COLUMN "appointment_id" TEXT;
CREATE UNIQUE INDEX "bills_appointment_id_key" ON "bills"("appointment_id");
CREATE UNIQUE INDEX "bills_admission_id_key" ON "bills"("admission_id");
ALTER TABLE "bills" ADD CONSTRAINT "bills_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bills" ADD CONSTRAINT "bills_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
