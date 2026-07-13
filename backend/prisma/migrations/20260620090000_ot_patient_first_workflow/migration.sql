ALTER TABLE "ot_records"
ADD COLUMN IF NOT EXISTS "patient_id" TEXT,
ADD COLUMN IF NOT EXISTS "diagnosis" TEXT,
ADD COLUMN IF NOT EXISTS "indication" TEXT,
ADD COLUMN IF NOT EXISTS "postop_plan" TEXT,
ADD COLUMN IF NOT EXISTS "recovery_status" TEXT,
ADD COLUMN IF NOT EXISTS "note_attachments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "admit_after_surgery" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ot_records" ot
SET "patient_id" = a."patient_id"
FROM "admissions" a
WHERE ot."admission_id" = a."id"
  AND ot."patient_id" IS NULL;

ALTER TABLE "ot_records"
ALTER COLUMN "patient_id" SET NOT NULL,
ALTER COLUMN "admission_id" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ot_records_patient_id_fkey'
  ) THEN
    ALTER TABLE "ot_records"
    ADD CONSTRAINT "ot_records_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
