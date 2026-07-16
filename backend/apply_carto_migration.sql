-- Application manuelle de la migration carto_grappes
-- Exécuter ceci dans psql ou pgAdmin

-- Tables pour stocker les régions, grappes et lots
CREATE TABLE IF NOT EXISTS "CartoRegion" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartoRegion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CartoRegion_organizationId_code_key"
    ON "CartoRegion"("organizationId", "code");

CREATE TABLE IF NOT EXISTS "CartoGrappe" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "grappeNumber" INTEGER NOT NULL,
    "grappeKey" TEXT NOT NULL,
    "menageCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartoGrappe_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CartoGrappe_organizationId_grappeKey_key"
    ON "CartoGrappe"("organizationId", "grappeKey");

CREATE INDEX IF NOT EXISTS "CartoGrappe_organizationId_regionId_key"
    ON "CartoGrappe"("organizationId", "regionId");

CREATE TABLE IF NOT EXISTS "CartoLot" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "lotKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartoLot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CartoLot_organizationId_lotKey_key"
    ON "CartoLot"("organizationId", "lotKey");

-- Vérification de la création des tables
SELECT 
    'CartoRegion' as table_name, COUNT(*) as row_count FROM "CartoRegion"
UNION ALL
SELECT 
    'CartoGrappe' as table_name, COUNT(*) as row_count FROM "CartoGrappe"
UNION ALL
SELECT 
    'CartoLot' as table_name, COUNT(*) as row_count FROM "CartoLot";