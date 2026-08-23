CREATE TYPE "TelemedicineMode" AS ENUM ('AUDIO', 'VIDEO');
CREATE TYPE "TelemedicineProvider" AS ENUM ('EXTERNAL_LINK', 'SELF_HOSTED', 'CUSTOM');
CREATE TYPE "TelemedicineStatus" AS ENUM ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED');

CREATE TABLE "telemedicine_sessions" (
  "id" TEXT NOT NULL,
  "appointment_id" TEXT NOT NULL,
  "mode" "TelemedicineMode" NOT NULL DEFAULT 'VIDEO',
  "provider" "TelemedicineProvider" NOT NULL DEFAULT 'EXTERNAL_LINK',
  "meeting_url" TEXT NOT NULL,
  "status" "TelemedicineStatus" NOT NULL DEFAULT 'SCHEDULED',
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "hospital_id" TEXT NOT NULL,
  CONSTRAINT "telemedicine_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "telemedicine_sessions_appointment_id_key" ON "telemedicine_sessions"("appointment_id");
CREATE INDEX "telemedicine_sessions_hospital_id_status_idx" ON "telemedicine_sessions"("hospital_id", "status");
ALTER TABLE "telemedicine_sessions" ADD CONSTRAINT "telemedicine_sessions_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telemedicine_sessions" ADD CONSTRAINT "telemedicine_sessions_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
