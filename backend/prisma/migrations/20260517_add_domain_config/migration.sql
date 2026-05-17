-- CreateTable DomainConfig
CREATE TABLE "DomainConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "domainType" TEXT NOT NULL,
    "entityFields" JSONB NOT NULL DEFAULT '{}',
    "statusEnum" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priorityRules" JSONB NOT NULL DEFAULT '{}',
    "validationSchemas" JSONB NOT NULL DEFAULT '{}',
    "projectTemplates" JSONB NOT NULL DEFAULT '[]',
    "missionTemplates" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DomainConfig_organizationId_domainType_key" ON "DomainConfig"("organizationId", "domainType");

-- CreateIndex
CREATE INDEX "DomainConfig_organizationId_idx" ON "DomainConfig"("organizationId");

-- CreateIndex
CREATE INDEX "DomainConfig_domainType_idx" ON "DomainConfig"("domainType");

-- AddForeignKey
ALTER TABLE "DomainConfig" ADD CONSTRAINT "DomainConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
