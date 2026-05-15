-- ============================================================
-- Migration: add_template_tracking
-- Add template tracking to Project model and make Organization.slug required
-- ============================================================

-- ── STEP 1: Add templateKey and templateVersion to Project ────────────────

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "templateKey" TEXT,
  ADD COLUMN IF NOT EXISTS "templateVersion" INTEGER;

-- ── STEP 2: Make Organization.slug required ──────────────────────────────

-- First: Generate slugs for any existing organizations that don't have one
UPDATE "Organization"
SET slug = LOWER(REPLACE(REPLACE(name, ' ', '-'), '''', '')) || '-' || SUBSTR(id, 1, 8)
WHERE slug IS NULL;

-- Second: Add NOT NULL constraint
ALTER TABLE "Organization"
  ALTER COLUMN "slug" SET NOT NULL;

-- Index for template lookups
CREATE INDEX IF NOT EXISTS "Project_templateKey_idx" ON "Project"("templateKey");
