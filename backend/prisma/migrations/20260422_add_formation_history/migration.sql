-- CreateTable
CREATE TABLE "FormationPlanningHistory" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "action" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormationPlanningHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormationPlanningHistory_sessionId_idx" ON "FormationPlanningHistory"("sessionId");

-- CreateIndex
CREATE INDEX "FormationPlanningHistory_action_idx" ON "FormationPlanningHistory"("action");

-- CreateIndex
CREATE INDEX "FormationPlanningHistory_createdAt_idx" ON "FormationPlanningHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "FormationPlanningHistory"
ADD CONSTRAINT "FormationPlanningHistory_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "FormationSession"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
