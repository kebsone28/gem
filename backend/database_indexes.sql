-- 🔧 PERFORMANCE INDEXES FOR GEM SAAS PRODUCTION
-- Execute these on your PostgreSQL database after deploying
-- These indexes will dramatically improve query performance for 50k-200k households

-- 1. SPATIAL INDEX for BBox queries (CRITICAL for viewport loading)
-- This enables ultra-fast spatial queries using ST_DWithin + ST_MakeEnvelope
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_household_location_gis
  ON "Household" USING GIST (location_gis);

-- 2. BUSINESS INDEXES for common lookups
-- Kobo submission tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_household_kobo_sync
  ON "Household" USING BTREE (("koboSync"->>'_id'))
  WHERE "koboSync" IS NOT NULL;

-- Status filtering (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_household_status_org
  ON "Household" USING BTREE (status, "organizationId");

-- Project-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_household_project_status
  ON "Household" USING BTREE ("projectId", status);

-- Team assignment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_household_assigned_teams
  ON "Household" USING GIN ("assignedTeams")
  WHERE "assignedTeams" IS NOT NULL;

-- Timestamp indexes for sorting and time-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_household_updated_at
  ON "Household" USING BTREE ("updatedAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_household_created_at
  ON "Household" USING BTREE ("createdAt" DESC);

-- Zone-based clustering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_household_zone_status
  ON "Household" USING BTREE ("zoneId", status);

-- 3. COMPOSITE INDEXES for complex queries
-- Supervisor queries (teams + timestamps)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_household_team_updated
  ON "Household" USING BTREE ("assignedTeams", "updatedAt")
  WHERE "assignedTeams" IS NOT NULL;

-- Audit trail queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_household_audit
  ON "Household" USING BTREE ("organizationId", "updatedAt", status);

-- 4. PARTIAL INDEXES for active data only
-- Only index non-deleted households
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_household_active
  ON "Household" USING BTREE ("projectId", status, "updatedAt")
  WHERE "deletedAt" IS NULL;

-- 5. VERIFICATION QUERIES
-- Run these after creating indexes to verify they're being used:

-- Check if spatial index is used for bbox queries:
-- EXPLAIN ANALYZE SELECT * FROM "Household" WHERE ST_DWithin(location_gis, ST_MakeEnvelope(-17.5, 14.5, -17.0, 15.0, 4326)::geography, 0);

-- Check index usage:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE tablename = 'Household'
-- ORDER BY idx_scan DESC;

-- 6. MAINTENANCE
-- Reindex periodically (monthly) to maintain performance:
-- REINDEX INDEX CONCURRENTLY idx_household_location_gis;
-- ANALYZE "Household";