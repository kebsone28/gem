-- Carto Grappes: 14 new tables
-- Run: psql -d electrification -f migration_carto_grappes.sql

CREATE TABLE IF NOT EXISTS "CartoHouseholdEntry" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "householdOrdre" INTEGER NOT NULL,
    "lotAStatus" TEXT NOT NULL DEFAULT 'non_fait',
    "lotAJustif" TEXT NOT NULL DEFAULT '',
    "lotAUpdatedAt" TIMESTAMP(3),
    "lotBStatus" TEXT NOT NULL DEFAULT 'non_fait',
    "lotBJustif" TEXT NOT NULL DEFAULT '',
    "lotBUpdatedAt" TIMESTAMP(3),
    "lotCStatus" TEXT NOT NULL DEFAULT 'non_fait',
    "lotCJustif" TEXT NOT NULL DEFAULT '',
    "lotCUpdatedAt" TIMESTAMP(3),
    "conforme" BOOLEAN NOT NULL DEFAULT false,
    "obs" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartoHouseholdEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CartoHouseholdEntry_organizationId_householdOrdre_key"
    ON "CartoHouseholdEntry"("organizationId", "householdOrdre");

CREATE TABLE IF NOT EXISTS "CartoEntrepreneur" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "lot" TEXT NOT NULL,
    "grappeKey" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'individuel',
    "groupId" TEXT,
    "entreprise" TEXT NOT NULL DEFAULT '',
    "societe" TEXT NOT NULL DEFAULT '',
    "telephone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartoEntrepreneur_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CartoEntrepreneur_organizationId_lot_grappeKey_key"
    ON "CartoEntrepreneur"("organizationId", "lot", "grappeKey");

CREATE TABLE IF NOT EXISTS "CartoVillageOverride" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "villageKey" TEXT NOT NULL,
    "grappeNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartoVillageOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CartoVillageOverride_organizationId_villageKey_key"
    ON "CartoVillageOverride"("organizationId", "villageKey");

CREATE TABLE IF NOT EXISTS "CartoHistory" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "householdOrdre" INTEGER NOT NULL,
    "nom" TEXT NOT NULL DEFAULT '',
    "village" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "lot" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL DEFAULT '',
    "toStatus" TEXT NOT NULL DEFAULT '',
    "justif" TEXT NOT NULL DEFAULT '',
    "userName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartoHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CartoFiche" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "ficheKey" TEXT NOT NULL,
    "entryIndex" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL DEFAULT '{}',
    "author" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartoFiche_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CartoGantt" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "grappeKey" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "startDate" TEXT,
    "endDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "data" JSONB DEFAULT '{}',

    CONSTRAINT "CartoGantt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CartoGantt_organizationId_grappeKey_phase_key"
    ON "CartoGantt"("organizationId", "grappeKey", "phase");

CREATE TABLE IF NOT EXISTS "CartoAlerts" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 7,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartoAlerts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CartoAlerts_organizationId_key"
    ON "CartoAlerts"("organizationId");

CREATE TABLE IF NOT EXISTS "CartoPhoto" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "householdOrdre" INTEGER NOT NULL,
    "lot" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '',
    "userName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartoPhoto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CartoPhoto_organizationId_householdOrdre_lot_key"
    ON "CartoPhoto"("organizationId", "householdOrdre", "lot");

CREATE TABLE IF NOT EXISTS "CartoSettings" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "bareme" JSONB DEFAULT '{}',
    "lotLabels" JSONB DEFAULT '{}',
    "featureToggles" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartoSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CartoSettings_organizationId_key"
    ON "CartoSettings"("organizationId");

CREATE TABLE IF NOT EXISTS "CartoWorkflow" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "householdOrdre" INTEGER NOT NULL,
    "nom" TEXT NOT NULL DEFAULT '',
    "village" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "grappe" TEXT NOT NULL DEFAULT '',
    "submittedBy" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "statuts" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartoWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CartoArchive" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "grappeKey" TEXT NOT NULL,
    "archivedBy" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "grappe" TEXT NOT NULL DEFAULT '',
    "totalMenages" INTEGER NOT NULL DEFAULT 0,
    "totalConformes" INTEGER NOT NULL DEFAULT 0,
    "snapshot" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartoArchive_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CartoPlanningParams" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartoPlanningParams_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CartoPlanningParams_organizationId_key"
    ON "CartoPlanningParams"("organizationId");

CREATE TABLE IF NOT EXISTS "CartoStatsSnapshot" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "snapshotDate" TEXT NOT NULL,
    "conforme" INTEGER NOT NULL DEFAULT 0,
    "lotA" INTEGER NOT NULL DEFAULT 0,
    "lotB" INTEGER NOT NULL DEFAULT 0,
    "lotC" INTEGER NOT NULL DEFAULT 0,
    "bloques" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartoStatsSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CartoStatsSnapshot_organizationId_snapshotDate_key"
    ON "CartoStatsSnapshot"("organizationId", "snapshotDate");

CREATE TABLE IF NOT EXISTS "CartoContractTemplate" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL,
    "lot" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartoContractTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CartoContractTemplate_organizationId_lot_key"
    ON "CartoContractTemplate"("organizationId", "lot");

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
