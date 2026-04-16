-- CreateTable "Alert"
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "householdId" TEXT,
    "pvId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "recommendedAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "escalationNotificationSent" BOOLEAN NOT NULL DEFAULT false,
    "notified" BOOLEAN NOT NULL DEFAULT false,
    "smsNotified" BOOLEAN NOT NULL DEFAULT false,
    "emailNotified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable "AlertConfiguration"
CREATE TABLE "AlertConfiguration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stockCritical" INTEGER NOT NULL DEFAULT 5,
    "budgetThreshold" DOUBLE PRECISION NOT NULL DEFAULT 90,
    "teamCapacity" DOUBLE PRECISION NOT NULL DEFAULT 85,
    "electricityMin" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "delayThreshold" INTEGER NOT NULL DEFAULT 5,
    "escalationDelay" INTEGER NOT NULL DEFAULT 3600,
    "escalationLoop" BOOLEAN NOT NULL DEFAULT true,
    "enableSMS" BOOLEAN NOT NULL DEFAULT true,
    "enableEmail" BOOLEAN NOT NULL DEFAULT true,
    "enablePush" BOOLEAN NOT NULL DEFAULT false,
    "enableWhatsApp" BOOLEAN NOT NULL DEFAULT false,
    "quietHourStart" INTEGER,
    "quietHourEnd" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alert_organizationId_idx" ON "Alert"("organizationId");

-- CreateIndex
CREATE INDEX "Alert_projectId_idx" ON "Alert"("projectId");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "Alert_severity_idx" ON "Alert"("severity");

-- CreateIndex
CREATE INDEX "Alert_type_idx" ON "Alert"("type");

-- CreateIndex
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- CreateIndex
CREATE INDEX "Alert_householdId_idx" ON "Alert"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertConfiguration_organizationId_key" ON "AlertConfiguration"("organizationId");

-- CreateIndex
CREATE INDEX "AlertConfiguration_organizationId_idx" ON "AlertConfiguration"("organizationId");
