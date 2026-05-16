-- CreateTable: SystemError (🛡️ SYSTEM DIAGNOSTICS & ERROR TRACKING)
CREATE TABLE "SystemError" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "projectId" TEXT,
    "userId" TEXT,
    "code" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "context" JSONB DEFAULT '{}',
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemError_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SystemConfig (⚙️ GLOBAL SYSTEM CONFIGURATION)
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemError_organizationId_idx" ON "SystemError"("organizationId");

-- CreateIndex
CREATE INDEX "SystemError_code_idx" ON "SystemError"("code");

-- CreateIndex
CREATE INDEX "SystemError_createdAt_idx" ON "SystemError"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");
