ALTER TABLE "refresh_sessions"
  ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "replaced_by" TEXT,
  ADD COLUMN IF NOT EXISTS "user_agent" TEXT,
  ADD COLUMN IF NOT EXISTS "ip_address" TEXT,
  ADD COLUMN IF NOT EXISTS "device_name" TEXT,
  ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "refresh_sessions_revoked_at_idx" ON "refresh_sessions"("revoked_at");
