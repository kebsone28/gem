-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable VectorMemory
CREATE TABLE "VectorMemory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userMemoryId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" vector(1536),
  "intent" TEXT,
  "emotion" TEXT,
  "source" TEXT NOT NULL DEFAULT 'conversation',
  "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "accessCount" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "VectorMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable AIMetrics
CREATE TABLE "AIMetrics" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT,
  "requestType" TEXT NOT NULL,
  "routeSelected" TEXT NOT NULL,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "costUSD" DECIMAL(65,30),
  "latencyMs" INTEGER,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "errorMessage" TEXT,
  "intentDetected" TEXT,
  "emotionDetected" TEXT,
  "cacheHitRate" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable PromptVersion
CREATE TABLE "PromptVersion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "prompt" TEXT NOT NULL,
  "model" TEXT,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "testResults" JSONB,
  "metrics" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "deactivatedAt" TIMESTAMP(3),
  CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- Add relation constraint to VectorMemory
ALTER TABLE "VectorMemory" ADD CONSTRAINT "VectorMemory_userMemoryId_fkey" FOREIGN KEY ("userMemoryId") REFERENCES "UserMemory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex on VectorMemory
CREATE INDEX "VectorMemory_userId_idx" ON "VectorMemory"("userId");
CREATE INDEX "VectorMemory_userMemoryId_idx" ON "VectorMemory"("userMemoryId");
CREATE INDEX "VectorMemory_createdAt_idx" ON "VectorMemory"("createdAt");
CREATE INDEX "VectorMemory_expiresAt_idx" ON "VectorMemory"("expiresAt");

-- CreateIndex on AIMetrics
CREATE INDEX "AIMetrics_userId_idx" ON "AIMetrics"("userId");
CREATE INDEX "AIMetrics_organizationId_idx" ON "AIMetrics"("organizationId");
CREATE INDEX "AIMetrics_createdAt_idx" ON "AIMetrics"("createdAt");
CREATE INDEX "AIMetrics_routeSelected_idx" ON "AIMetrics"("routeSelected");

-- CreateIndex on PromptVersion
CREATE UNIQUE INDEX "PromptVersion_name_version_key" ON "PromptVersion"("name", "version");
CREATE INDEX "PromptVersion_organizationId_idx" ON "PromptVersion"("organizationId");
CREATE INDEX "PromptVersion_isActive_idx" ON "PromptVersion"("isActive");
CREATE INDEX "PromptVersion_createdAt_idx" ON "PromptVersion"("createdAt");
