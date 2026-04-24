-- CreateTable
CREATE TABLE "FormationPlannerState" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormationPlannerState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormationPlannerState_updatedAt_idx" ON "FormationPlannerState"("updatedAt");
