CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "request_id" TEXT,
  ADD COLUMN IF NOT EXISTS "previous_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "entry_hash" TEXT;

UPDATE "audit_logs"
SET "entry_hash" = encode(digest('legacy:' || "id", 'sha256'), 'hex')
WHERE "entry_hash" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "audit_logs_entry_hash_key" ON "audit_logs"("entry_hash") WHERE "entry_hash" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "audit_logs_hospital_created_at_idx" ON "audit_logs"("hospital_id", "created_at");

CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_immutable_trigger ON "audit_logs";
CREATE TRIGGER audit_logs_immutable_trigger
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

CREATE OR REPLACE FUNCTION audit_log_chain() RETURNS trigger AS $$
DECLARE previous TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(COALESCE(NEW."hospital_id", 'global')));
  SELECT "entry_hash" INTO previous
  FROM "audit_logs"
  WHERE "hospital_id" IS NOT DISTINCT FROM NEW."hospital_id"
  ORDER BY "created_at" DESC, "id" DESC
  LIMIT 1;
  NEW."previous_hash" := previous;
  NEW."entry_hash" := encode(digest(
    COALESCE(NEW."previous_hash", '') || '|' || NEW."id" || '|' ||
    COALESCE(NEW."hospital_id", '') || '|' || COALESCE(NEW."user_id", '') || '|' ||
    COALESCE(NEW."action", '') || '|' || COALESCE(NEW."module", '') || '|' ||
    COALESCE(NEW."record_id", '') || '|' || COALESCE(NEW."old_values"::text, '') || '|' ||
    COALESCE(NEW."new_values"::text, '') || '|' || NEW."created_at"::text,
    'sha256'), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_chain_trigger ON "audit_logs";
CREATE TRIGGER audit_logs_chain_trigger
BEFORE INSERT ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION audit_log_chain();
