-- CreateTable
-- KoboFormMapping: stores dynamic XLSForm definitions for the universal GEM Collect engine
CREATE TABLE "KoboFormMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "koboAssetId" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "version" TEXT NOT NULL,
    "lastValidated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KoboFormMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KoboFormMapping_organizationId_koboAssetId_key"
ON "KoboFormMapping"("organizationId", "koboAssetId");

-- CreateIndex
CREATE INDEX "KoboFormMapping_organizationId_idx"
ON "KoboFormMapping"("organizationId");

-- CreateIndex
CREATE INDEX "KoboFormMapping_koboAssetId_idx"
ON "KoboFormMapping"("koboAssetId");

-- AddForeignKey
ALTER TABLE "KoboFormMapping"
ADD CONSTRAINT "KoboFormMapping_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
