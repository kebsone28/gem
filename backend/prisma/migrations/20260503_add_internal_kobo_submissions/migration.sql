-- CreateTable
CREATE TABLE "InternalKoboSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "householdId" TEXT,
    "numeroOrdre" TEXT,
    "formKey" TEXT NOT NULL DEFAULT 'terrain_internal',
    "formVersion" TEXT NOT NULL,
    "clientSubmissionId" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "syncStatus" TEXT NOT NULL DEFAULT 'synced',
    "values" JSONB NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "requiredMissing" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalKoboSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InternalKoboSubmission_organizationId_clientSubmissionId_key"
ON "InternalKoboSubmission"("organizationId", "clientSubmissionId");

-- CreateIndex
CREATE INDEX "InternalKoboSubmission_organizationId_householdId_idx"
ON "InternalKoboSubmission"("organizationId", "householdId");

-- CreateIndex
CREATE INDEX "InternalKoboSubmission_organizationId_numeroOrdre_idx"
ON "InternalKoboSubmission"("organizationId", "numeroOrdre");

-- CreateIndex
CREATE INDEX "InternalKoboSubmission_organizationId_formKey_formVersion_idx"
ON "InternalKoboSubmission"("organizationId", "formKey", "formVersion");

-- CreateIndex
CREATE INDEX "InternalKoboSubmission_organizationId_status_syncStatus_idx"
ON "InternalKoboSubmission"("organizationId", "status", "syncStatus");

-- CreateIndex
CREATE INDEX "InternalKoboSubmission_savedAt_idx"
ON "InternalKoboSubmission"("savedAt");

-- AddForeignKey
ALTER TABLE "InternalKoboSubmission"
ADD CONSTRAINT "InternalKoboSubmission_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalKoboSubmission"
ADD CONSTRAINT "InternalKoboSubmission_householdId_fkey"
FOREIGN KEY ("householdId") REFERENCES "Household"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalKoboSubmission"
ADD CONSTRAINT "InternalKoboSubmission_submittedById_fkey"
FOREIGN KEY ("submittedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
