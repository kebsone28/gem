-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('draft', 'submitted', 'in_approval', 'approved', 'rejected', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ApprovalRole" AS ENUM ('CHEF_PROJET', 'ADMIN', 'DIRECTEUR');

-- CreateTable Mission
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budget" DECIMAL(65,30),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable MissionApprovalWorkflow
CREATE TABLE "MissionApprovalWorkflow" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "overallStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable MissionApprovalStep
CREATE TABLE "MissionApprovalStep" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mission_organizationId_idx" ON "Mission"("organizationId");

-- CreateIndex
CREATE INDEX "Mission_projectId_idx" ON "Mission"("projectId");

-- CreateIndex
CREATE INDEX "Mission_orderNumber_idx" ON "Mission"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_orderNumber_key" ON "Mission"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MissionApprovalWorkflow_missionId_key" ON "MissionApprovalWorkflow"("missionId");

-- CreateIndex
CREATE INDEX "MissionApprovalWorkflow_missionId_idx" ON "MissionApprovalWorkflow"("missionId");

-- CreateIndex
CREATE INDEX "MissionApprovalStep_workflowId_idx" ON "MissionApprovalStep"("workflowId");

-- CreateIndex
CREATE INDEX "MissionApprovalStep_role_idx" ON "MissionApprovalStep"("role");

-- CreateIndex
CREATE UNIQUE INDEX "MissionApprovalStep_workflowId_role_key" ON "MissionApprovalStep"("workflowId", "role");

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionApprovalWorkflow" ADD CONSTRAINT "MissionApprovalWorkflow_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionApprovalStep" ADD CONSTRAINT "MissionApprovalStep_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "MissionApprovalWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
