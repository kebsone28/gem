-- Ensure PostGIS is active
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add GIST index for fast spatial queries
CREATE INDEX IF NOT EXISTS "Household_location_gis_idx" ON "Household" USING GIST (location_gis);

-- Analyze to update statistics
ANALYZE "Household";

-- Optional: If we have complex polygons, subdivide them (not applicâble for points)
-- But we can cluster the table by the spatial index for faster disk reads
CLUSTER "Household" USING "Household_location_gis_idx";
