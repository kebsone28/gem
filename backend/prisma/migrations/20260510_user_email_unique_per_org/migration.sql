-- ============================================================
-- Migration: user_email_unique_per_org
-- Replace global email unique constraint with per-organization unique
-- Allows different organizations to have users with the same email (SaaS multi-tenant)
-- ============================================================

-- Step 1: Drop the old global unique index on email
-- NOTE: The constraint name may vary. Try both common names.
DO $$
BEGIN
  -- Drop constraint if it exists (Prisma default naming)
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'User_email_key'
    AND conrelid = '"User"'::regclass
  ) THEN
    ALTER TABLE "User" DROP CONSTRAINT "User_email_key";
  END IF;

  -- Also try without quotes (some Prisma versions)
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'User'
    AND indexname = 'User_email_key'
  ) THEN
    DROP INDEX IF EXISTS "User_email_key";
  END IF;
END $$;

-- Step 2: Create the new composite unique index (email + organizationId)
-- This allows: alice@example.com in Org A AND alice@example.com in Org B
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_organizationId_key"
ON "User"("email", "organizationId");
