-- =============================================================
-- PATCH CORRECTIF : tables et colonnes manquantes
-- Applique IF NOT EXISTS partout pour être idempotent
-- =============================================================

-- 1. Table ToolboxFormHook (manquante)
CREATE TABLE IF NOT EXISTS "ToolboxFormHook" (
  "id"              TEXT PRIMARY KEY,
  "organizationId"  TEXT NOT NULL REFERENCES "Organization"("id"),
  "formKey"         TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "url"             TEXT NOT NULL,
  "method"          TEXT NOT NULL DEFAULT 'POST',
  "headers"         JSONB NOT NULL DEFAULT '{}',
  "active"          BOOLEAN NOT NULL DEFAULT true,
  "lastTriggeredAt" TIMESTAMP,
  "lastStatus"      INTEGER,
  "createdAt"       TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "ToolboxFormHook_organizationId_formKey_url_key"
  ON "ToolboxFormHook"("organizationId", "formKey", "url");
CREATE INDEX IF NOT EXISTS "ToolboxFormHook_organizationId_formKey_idx"
  ON "ToolboxFormHook"("organizationId", "formKey");
CREATE INDEX IF NOT EXISTS "ToolboxFormHook_organizationId_idx"
  ON "ToolboxFormHook"("organizationId");

-- 2. Table ToolboxWebhookExecution (manquante)
CREATE TABLE IF NOT EXISTS "ToolboxWebhookExecution" (
  "id"               TEXT PRIMARY KEY,
  "hookId"           TEXT NOT NULL REFERENCES "ToolboxFormHook"("id") ON DELETE CASCADE,
  "organizationId"   TEXT NOT NULL REFERENCES "Organization"("id"),
  "event"            TEXT NOT NULL,
  "submissionId"     TEXT,
  "clientSubmissionId" TEXT,
  "formKey"          TEXT,
  "payload"          JSONB,
  "responseStatus"   INTEGER,
  "responseBody"     TEXT,
  "success"          BOOLEAN NOT NULL DEFAULT false,
  "error"            TEXT,
  "timestamp"        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "ToolboxWebhookExecution_hookId_idx"
  ON "ToolboxWebhookExecution"("hookId");
CREATE INDEX IF NOT EXISTS "ToolboxWebhookExecution_organizationId_idx"
  ON "ToolboxWebhookExecution"("organizationId");
CREATE INDEX IF NOT EXISTS "ToolboxWebhookExecution_timestamp_idx"
  ON "ToolboxWebhookExecution"("timestamp");
CREATE INDEX IF NOT EXISTS "ToolboxWebhookExecution_success_idx"
  ON "ToolboxWebhookExecution"("success");

-- 3. Colonnes manquantes dans ScheduledReport (toutes idempotentes)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ScheduledReport' AND column_name='organizationId') THEN
    ALTER TABLE "ScheduledReport" ADD COLUMN "organizationId" TEXT REFERENCES "Organization"("id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ScheduledReport' AND column_name='schedule') THEN
    -- Renommer frequency si elle existe, sinon créer schedule
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ScheduledReport' AND column_name='frequency') THEN
      ALTER TABLE "ScheduledReport" RENAME COLUMN "frequency" TO "schedule";
    ELSE
      ALTER TABLE "ScheduledReport" ADD COLUMN "schedule" TEXT;
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ScheduledReport' AND column_name='format') THEN
    ALTER TABLE "ScheduledReport" ADD COLUMN "format" TEXT NOT NULL DEFAULT 'csv';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ScheduledReport' AND column_name='formKey') THEN
    ALTER TABLE "ScheduledReport" ADD COLUMN "formKey" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ScheduledReport' AND column_name='filters') THEN
    ALTER TABLE "ScheduledReport" ADD COLUMN "filters" JSONB DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ScheduledReport' AND column_name='active') THEN
    ALTER TABLE "ScheduledReport" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ScheduledReport' AND column_name='lastRunAt') THEN
    ALTER TABLE "ScheduledReport" ADD COLUMN "lastRunAt" TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ScheduledReport' AND column_name='nextRunAt') THEN
    ALTER TABLE "ScheduledReport" ADD COLUMN "nextRunAt" TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ScheduledReport' AND column_name='lastError') THEN
    ALTER TABLE "ScheduledReport" ADD COLUMN "lastError" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ScheduledReport' AND column_name='updatedAt') THEN
    ALTER TABLE "ScheduledReport" ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Index ScheduledReport
CREATE INDEX IF NOT EXISTS "ScheduledReport_organizationId_idx" ON "ScheduledReport"("organizationId");
CREATE INDEX IF NOT EXISTS "ScheduledReport_nextRunAt_idx" ON "ScheduledReport"("nextRunAt");

-- 4. Table GeneratedReport (manquante)
CREATE TABLE IF NOT EXISTS "GeneratedReport" (
  "id"               TEXT PRIMARY KEY,
  "organizationId"   TEXT NOT NULL REFERENCES "Organization"("id"),
  "scheduledReportId" TEXT REFERENCES "ScheduledReport"("id"),
  "userId"           TEXT REFERENCES "User"("id"),
  "name"             TEXT NOT NULL,
  "format"           TEXT NOT NULL DEFAULT 'csv',
  "fileBuffer"       BYTEA NOT NULL,
  "filename"         TEXT NOT NULL,
  "mimeType"         TEXT NOT NULL DEFAULT 'text/csv',
  "recordCount"      INTEGER NOT NULL DEFAULT 0,
  "generatedAt"      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "GeneratedReport_organizationId_idx" ON "GeneratedReport"("organizationId");
CREATE INDEX IF NOT EXISTS "GeneratedReport_generatedAt_idx" ON "GeneratedReport"("generatedAt");

-- 5. GedcollectAssignment (manquante si absente)
CREATE TABLE IF NOT EXISTS "GedcollectAssignment" (
  "id"             TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id"),
  "userId"         TEXT NOT NULL REFERENCES "User"("id"),
  "formKey"        TEXT NOT NULL,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "GedcollectAssignment_organizationId_userId_formKey_key"
  ON "GedcollectAssignment"("organizationId", "userId", "formKey");
CREATE INDEX IF NOT EXISTS "GedcollectAssignment_organizationId_idx" ON "GedcollectAssignment"("organizationId");
CREATE INDEX IF NOT EXISTS "GedcollectAssignment_userId_idx" ON "GedcollectAssignment"("userId");
CREATE INDEX IF NOT EXISTS "GedcollectAssignment_formKey_idx" ON "GedcollectAssignment"("formKey");
