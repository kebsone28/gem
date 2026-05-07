-- ============================================================
-- Migration: formation_multitenant
-- Add organizationId to all Formation tables for proper tenant isolation.
-- Data strategy: existing rows are assigned to the first organization.
-- ============================================================

-- ── STEP 1: Add organizationId columns with temporary DEFAULT ───────────────

ALTER TABLE "FormationModule"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT '';

ALTER TABLE "FormationSession"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT '';

ALTER TABLE "FormationPlanningHistory"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT '';

-- FormationPlannerState: change from fixed-id to uuid + unique organizationId
-- Safe to do because the table is small (one row max per usage)
ALTER TABLE "FormationPlannerState"
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- ── STEP 2: Populate with first org for existing data ──────────────────────

DO $$
DECLARE
  first_org_id TEXT;
BEGIN
  SELECT id INTO first_org_id
  FROM "Organization"
  ORDER BY "createdAt" ASC
  LIMIT 1;

  IF first_org_id IS NOT NULL THEN
    UPDATE "FormationModule"
    SET "organizationId" = first_org_id
    WHERE "organizationId" = '';

    UPDATE "FormationSession"
    SET "organizationId" = first_org_id
    WHERE "organizationId" = '';

    UPDATE "FormationPlanningHistory"
    SET "organizationId" = first_org_id
    WHERE "organizationId" = '';

    UPDATE "FormationPlannerState"
    SET "organizationId" = first_org_id
    WHERE "organizationId" IS NULL;
  END IF;
END $$;

-- ── STEP 3: Make organizationId NOT NULL on PlannerState ──────────────────

ALTER TABLE "FormationPlannerState"
  ALTER COLUMN "organizationId" SET NOT NULL;

-- ── STEP 4: Remove the old DEFAULT (no longer needed) ─────────────────────

ALTER TABLE "FormationModule"
  ALTER COLUMN "organizationId" DROP DEFAULT;

ALTER TABLE "FormationSession"
  ALTER COLUMN "organizationId" DROP DEFAULT;

ALTER TABLE "FormationPlanningHistory"
  ALTER COLUMN "organizationId" DROP DEFAULT;

-- ── STEP 5: Add foreign key constraints ───────────────────────────────────

ALTER TABLE "FormationModule"
  ADD CONSTRAINT "FormationModule_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FormationSession"
  ADD CONSTRAINT "FormationSession_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FormationPlanningHistory"
  ADD CONSTRAINT "FormationPlanningHistory_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FormationPlannerState"
  ADD CONSTRAINT "FormationPlannerState_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── STEP 6: Add unique constraint on PlannerState (one per org) ───────────

ALTER TABLE "FormationPlannerState"
  ADD CONSTRAINT "FormationPlannerState_organizationId_key"
  UNIQUE ("organizationId");

-- ── STEP 7: Create indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "FormationModule_organizationId_idx"
  ON "FormationModule"("organizationId");

CREATE INDEX IF NOT EXISTS "FormationSession_organizationId_idx"
  ON "FormationSession"("organizationId");

CREATE INDEX IF NOT EXISTS "FormationPlanningHistory_organizationId_idx"
  ON "FormationPlanningHistory"("organizationId");

CREATE INDEX IF NOT EXISTS "FormationPlannerState_organizationId_idx"
  ON "FormationPlannerState"("organizationId");
