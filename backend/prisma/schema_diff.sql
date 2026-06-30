-- DropIndex
DROP INDEX "Household_numeroordre_key";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "module" TEXT,
ADD COLUMN     "severity" TEXT NOT NULL DEFAULT 'info',
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "resource" DROP NOT NULL;

-- AlterTable
ALTER TABLE "GedcollectAssignment" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GeneratedReport" ALTER COLUMN "generatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Household" ADD COLUMN     "alerts" JSONB DEFAULT '[]',
ADD COLUMN     "assignedTeams" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "constructionData" JSONB DEFAULT '{}',
ADD COLUMN     "grappeId" TEXT,
ADD COLUMN     "koboSync" JSONB DEFAULT '{}',
ADD COLUMN     "manualOverrides" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "projectId" TEXT,
ALTER COLUMN "zoneId" DROP NOT NULL,
ALTER COLUMN "location_gis" SET DATA TYPE JSONB;

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "data" JSONB DEFAULT '{}',
ADD COLUMN     "excludeFromFinance" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "projectId" DROP NOT NULL,
ALTER COLUMN "orderNumber" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MissionApprovalStep" DROP COLUMN "approvedAt",
DROP COLUMN "approvedBy",
DROP COLUMN "comments",
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedBy" TEXT,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "signature" TEXT,
ALTER COLUMN "status" SET DEFAULT 'EN_ATTENTE';

-- AlterTable
ALTER TABLE "MissionApprovalWorkflow" ADD COLUMN     "currentStep" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "integrityHash" TEXT,
ADD COLUMN     "orderNumber" TEXT,
ADD COLUMN     "orderNumberGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "orderNumberGeneratedBy" TEXT,
ADD COLUMN     "orderNumberOverridenAt" TIMESTAMP(3),
ADD COLUMN     "orderNumberOverridenBy" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "templateKey" TEXT,
ADD COLUMN     "templateVersion" INTEGER;

-- AlterTable
ALTER TABLE "ScheduledReport" ALTER COLUMN "userId" SET NOT NULL,
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "organizationId" SET NOT NULL,
ALTER COLUMN "lastRunAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "nextRunAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SyncLog" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Team" DROP COLUMN "type",
ADD COLUMN     "capacity" INTEGER DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "grappeId" TEXT,
ADD COLUMN     "legacyId" TEXT,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "offlineId" TEXT,
ADD COLUMN     "parentTeamId" TEXT,
ADD COLUMN     "path" TEXT,
ADD COLUMN     "regionId" TEXT,
ADD COLUMN     "role" "TeamRole" NOT NULL DEFAULT 'INSTALLATION',
ADD COLUMN     "syncStatus" "SyncStatus" NOT NULL DEFAULT 'SYNCED',
ADD COLUMN     "tradeKey" TEXT,
ADD COLUMN     "updatedBy" TEXT,
ADD COLUMN     "warehouseId" TEXT,
ALTER COLUMN "projectId" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'active';

-- AlterTable
ALTER TABLE "ToolboxFormHook" ALTER COLUMN "lastTriggeredAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ToolboxWebhookExecution" ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "permissions" JSONB DEFAULT '[]',
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "roleId" TEXT,
ADD COLUMN     "roleLegacy" TEXT NOT NULL DEFAULT 'user';

-- DropEnum
DROP TYPE "ApprovalRole";

-- DropEnum
DROP TYPE "ApprovalStatus";

-- DropEnum
DROP TYPE "MissionStatus";

-- CreateTable
CREATE TABLE "ProjectTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "modules" JSONB DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "route" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB DEFAULT '{}',

    CONSTRAINT "ProjectPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectModule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB DEFAULT '{}',
    "fields" JSONB DEFAULT '[]',

    CONSTRAINT "ProjectModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grappe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "Grappe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "clientVersion" INTEGER,
    "serverVersion" INTEGER,
    "localData" JSONB,
    "serverData" JSONB,
    "resolvedData" JSONB,
    "strategy" TEXT NOT NULL DEFAULT 'last-write-wins',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ConflictLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "ToolboxSubmission" (
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
    "requiredMissing" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolboxSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "teamId" TEXT,
    "userId" TEXT,
    "householdId" TEXT,
    "action" TEXT NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT,
    "tradeKey" TEXT,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "UserMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastMessage" TEXT,
    "lastIntent" TEXT,
    "preferences" JSONB,
    "history" JSONB,
    "emotions" JSONB,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VectorMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userMemoryId" TEXT NOT NULL,
    "organizationId" TEXT,
    "content" TEXT NOT NULL,
    "embedding" JSONB,
    "metadata" JSONB,
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "ActionApproval" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "agentName" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AUTO_EXECUTED',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "rejectedBy" TEXT,
    "rejectionComment" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PVRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "householdId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "createdBy" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PVRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormationModule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "FormationModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormationSession" (
    "id" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "salle" TEXT NOT NULL,
    "maxParticipants" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "workSaturday" BOOLEAN NOT NULL DEFAULT false,
    "workSunday" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PLANIFIEE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "FormationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormationSessionModule" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormationSessionModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormationParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT,
    "attendance" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormationPlanningHistory" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "action" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "FormationPlanningHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormationPlannerState" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "FormationPlannerState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "scopeKey" TEXT,
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "retentionDays" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatParticipant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),
    "lastClearedAt" TIMESTAMP(3),

    CONSTRAINT "ChatParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "deletedFor" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatUserBlock" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blockedById" TEXT NOT NULL,
    "reason" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unblockedAt" TIMESTAMP(3),

    CONSTRAINT "ChatUserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "folderId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "accessLevel" TEXT NOT NULL DEFAULT 'ORG',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeLog" TEXT,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectModuleId" TEXT,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "entityType" TEXT NOT NULL,
    "config" JSONB DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowState" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT DEFAULT '#cbd5e1',
    "isInitial" BOOLEAN NOT NULL DEFAULT false,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "permissions" JSONB DEFAULT '[]',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTransition" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "fromStateId" TEXT NOT NULL,
    "toStateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "requiredRole" TEXT,
    "conditions" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "data" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomatedAction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "validatedById" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomatedAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "effect" TEXT NOT NULL DEFAULT 'ALLOW',
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "conditions" JSONB DEFAULT '{}',
    "scope" TEXT NOT NULL DEFAULT 'ORGANIZATION',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialCharge" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30),
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resourceType" TEXT,
    "resourceId" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Field" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'prepared',
    "location" JSONB,
    "location_gis" JSONB,
    "domainData" JSONB DEFAULT '{}',
    "alerts" JSONB DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Livestock" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'healthy',
    "location" JSONB,
    "location_gis" JSONB,
    "domainData" JSONB DEFAULT '{}',
    "alerts" JSONB DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Livestock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCenter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'operational',
    "location" JSONB,
    "location_gis" JSONB,
    "domainData" JSONB DEFAULT '{}',
    "alerts" JSONB DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "HealthCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "domainData" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'operational',
    "location" JSONB,
    "location_gis" JSONB,
    "domainData" JSONB DEFAULT '{}',
    "alerts" JSONB DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "domainData" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HighVoltageNetwork" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'operational',
    "location" JSONB,
    "location_gis" JSONB,
    "domainData" JSONB DEFAULT '{}',
    "alerts" JSONB DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "HighVoltageNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolarInstallation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'operational',
    "location" JSONB,
    "location_gis" JSONB,
    "domainData" JSONB DEFAULT '{}',
    "alerts" JSONB DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SolarInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetingCampaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "domainData" JSONB DEFAULT '{}',
    "alerts" JSONB DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TargetingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataCollectionSurvey" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "domainData" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DataCollectionSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MESRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "avisNumber" TEXT NOT NULL,
    "meterNumber" TEXT NOT NULL,
    "poste" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "cable" TEXT,
    "ct70" BOOLEAN NOT NULL DEFAULT false,
    "pa" BOOLEAN NOT NULL DEFAULT false,
    "agent" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "observations" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECU',
    "prestataire" TEXT NOT NULL,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "photos" JSONB DEFAULT '[]',
    "clientSignature" TEXT,
    "controlled" BOOLEAN NOT NULL DEFAULT false,
    "controllerId" TEXT,
    "controlDate" TIMESTAMP(3),
    "checklist" JSONB DEFAULT '{}',
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "validatorId" TEXT,
    "validationDate" TIMESTAMP(3),
    "factured" BOOLEAN NOT NULL DEFAULT false,
    "factureNumber" TEXT,
    "factureDate" TIMESTAMP(3),
    "amount" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "MESRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MESControl" (
    "id" TEXT NOT NULL,
    "mesRecordId" TEXT NOT NULL,
    "controllerId" TEXT NOT NULL,
    "compteurFixe" BOOLEAN NOT NULL DEFAULT false,
    "coupeCircuit" BOOLEAN NOT NULL DEFAULT false,
    "raccordement" BOOLEAN NOT NULL DEFAULT false,
    "conformiteZone" BOOLEAN NOT NULL DEFAULT false,
    "photosValides" BOOLEAN NOT NULL DEFAULT false,
    "conforme" BOOLEAN NOT NULL DEFAULT false,
    "observations" TEXT,
    "score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MESControl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTemplate_key_key" ON "ProjectTemplate"("key");

-- CreateIndex
CREATE INDEX "ProjectPage_projectId_idx" ON "ProjectPage"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPage_projectId_key_key" ON "ProjectPage"("projectId", "key");

-- CreateIndex
CREATE INDEX "ProjectModule_projectId_idx" ON "ProjectModule"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectModule_projectId_key_key" ON "ProjectModule"("projectId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Region_name_key" ON "Region"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Grappe_name_regionId_key" ON "Grappe"("name", "regionId");

-- CreateIndex
CREATE INDEX "ConflictLog_organizationId_idx" ON "ConflictLog"("organizationId");

-- CreateIndex
CREATE INDEX "ConflictLog_entityType_entityId_idx" ON "ConflictLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ConflictLog_timestamp_idx" ON "ConflictLog"("timestamp");

-- CreateIndex
CREATE INDEX "KoboFormMapping_organizationId_idx" ON "KoboFormMapping"("organizationId");

-- CreateIndex
CREATE INDEX "KoboFormMapping_koboAssetId_idx" ON "KoboFormMapping"("koboAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "KoboFormMapping_organizationId_koboAssetId_key" ON "KoboFormMapping"("organizationId", "koboAssetId");

-- CreateIndex
CREATE INDEX "ToolboxSubmission_organizationId_householdId_idx" ON "ToolboxSubmission"("organizationId", "householdId");

-- CreateIndex
CREATE INDEX "ToolboxSubmission_organizationId_numeroOrdre_idx" ON "ToolboxSubmission"("organizationId", "numeroOrdre");

-- CreateIndex
CREATE INDEX "ToolboxSubmission_organizationId_formKey_formVersion_idx" ON "ToolboxSubmission"("organizationId", "formKey", "formVersion");

-- CreateIndex
CREATE INDEX "ToolboxSubmission_organizationId_status_syncStatus_idx" ON "ToolboxSubmission"("organizationId", "status", "syncStatus");

-- CreateIndex
CREATE INDEX "ToolboxSubmission_savedAt_idx" ON "ToolboxSubmission"("savedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ToolboxSubmission_organizationId_clientSubmissionId_key" ON "ToolboxSubmission"("organizationId", "clientSubmissionId");

-- CreateIndex
CREATE INDEX "PerformanceLog_organizationId_idx" ON "PerformanceLog"("organizationId");

-- CreateIndex
CREATE INDEX "PerformanceLog_projectId_timestamp_idx" ON "PerformanceLog"("projectId", "timestamp");

-- CreateIndex
CREATE INDEX "PerformanceLog_teamId_timestamp_idx" ON "PerformanceLog"("teamId", "timestamp");

-- CreateIndex
CREATE INDEX "PerformanceLog_userId_timestamp_idx" ON "PerformanceLog"("userId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UserMemory_userId_key" ON "UserMemory"("userId");

-- CreateIndex
CREATE INDEX "UserMemory_userId_idx" ON "UserMemory"("userId");

-- CreateIndex
CREATE INDEX "VectorMemory_userId_idx" ON "VectorMemory"("userId");

-- CreateIndex
CREATE INDEX "VectorMemory_userMemoryId_idx" ON "VectorMemory"("userMemoryId");

-- CreateIndex
CREATE INDEX "VectorMemory_createdAt_idx" ON "VectorMemory"("createdAt");

-- CreateIndex
CREATE INDEX "VectorMemory_expiresAt_idx" ON "VectorMemory"("expiresAt");

-- CreateIndex
CREATE INDEX "AIMetrics_userId_idx" ON "AIMetrics"("userId");

-- CreateIndex
CREATE INDEX "AIMetrics_organizationId_idx" ON "AIMetrics"("organizationId");

-- CreateIndex
CREATE INDEX "AIMetrics_createdAt_idx" ON "AIMetrics"("createdAt");

-- CreateIndex
CREATE INDEX "AIMetrics_routeSelected_idx" ON "AIMetrics"("routeSelected");

-- CreateIndex
CREATE INDEX "PromptVersion_organizationId_idx" ON "PromptVersion"("organizationId");

-- CreateIndex
CREATE INDEX "PromptVersion_isActive_idx" ON "PromptVersion"("isActive");

-- CreateIndex
CREATE INDEX "PromptVersion_createdAt_idx" ON "PromptVersion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_name_version_key" ON "PromptVersion"("name", "version");

-- CreateIndex
CREATE INDEX "ActionApproval_organizationId_idx" ON "ActionApproval"("organizationId");

-- CreateIndex
CREATE INDEX "ActionApproval_status_idx" ON "ActionApproval"("status");

-- CreateIndex
CREATE INDEX "ActionApproval_userId_idx" ON "ActionApproval"("userId");

-- CreateIndex
CREATE INDEX "ActionApproval_agentName_idx" ON "ActionApproval"("agentName");

-- CreateIndex
CREATE INDEX "ActionApproval_requestedAt_idx" ON "ActionApproval"("requestedAt");

-- CreateIndex
CREATE INDEX "ActionApproval_riskLevel_idx" ON "ActionApproval"("riskLevel");

-- CreateIndex
CREATE INDEX "PVRecord_organizationId_idx" ON "PVRecord"("organizationId");

-- CreateIndex
CREATE INDEX "PVRecord_projectId_idx" ON "PVRecord"("projectId");

-- CreateIndex
CREATE INDEX "PVRecord_householdId_idx" ON "PVRecord"("householdId");

-- CreateIndex
CREATE INDEX "PVRecord_type_idx" ON "PVRecord"("type");

-- CreateIndex
CREATE INDEX "PVRecord_createdAt_idx" ON "PVRecord"("createdAt");

-- CreateIndex
CREATE INDEX "PVRecord_organizationId_deletedAt_idx" ON "PVRecord"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "FormationModule_organizationId_idx" ON "FormationModule"("organizationId");

-- CreateIndex
CREATE INDEX "FormationSession_organizationId_idx" ON "FormationSession"("organizationId");

-- CreateIndex
CREATE INDEX "FormationSession_region_idx" ON "FormationSession"("region");

-- CreateIndex
CREATE INDEX "FormationSession_startDate_idx" ON "FormationSession"("startDate");

-- CreateIndex
CREATE INDEX "FormationSession_status_idx" ON "FormationSession"("status");

-- CreateIndex
CREATE INDEX "FormationSessionModule_sessionId_idx" ON "FormationSessionModule"("sessionId");

-- CreateIndex
CREATE INDEX "FormationSessionModule_moduleId_idx" ON "FormationSessionModule"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "FormationSessionModule_sessionId_moduleId_key" ON "FormationSessionModule"("sessionId", "moduleId");

-- CreateIndex
CREATE INDEX "FormationParticipant_sessionId_idx" ON "FormationParticipant"("sessionId");

-- CreateIndex
CREATE INDEX "FormationPlanningHistory_organizationId_idx" ON "FormationPlanningHistory"("organizationId");

-- CreateIndex
CREATE INDEX "FormationPlanningHistory_sessionId_idx" ON "FormationPlanningHistory"("sessionId");

-- CreateIndex
CREATE INDEX "FormationPlanningHistory_action_idx" ON "FormationPlanningHistory"("action");

-- CreateIndex
CREATE INDEX "FormationPlanningHistory_createdAt_idx" ON "FormationPlanningHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FormationPlannerState_organizationId_key" ON "FormationPlannerState"("organizationId");

-- CreateIndex
CREATE INDEX "FormationPlannerState_organizationId_idx" ON "FormationPlannerState"("organizationId");

-- CreateIndex
CREATE INDEX "FormationPlannerState_updatedAt_idx" ON "FormationPlannerState"("updatedAt");

-- CreateIndex
CREATE INDEX "ChatConversation_organizationId_idx" ON "ChatConversation"("organizationId");

-- CreateIndex
CREATE INDEX "ChatConversation_type_idx" ON "ChatConversation"("type");

-- CreateIndex
CREATE INDEX "ChatConversation_updatedAt_idx" ON "ChatConversation"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatConversation_organizationId_scopeKey_key" ON "ChatConversation"("organizationId", "scopeKey");

-- CreateIndex
CREATE INDEX "ChatParticipant_organizationId_idx" ON "ChatParticipant"("organizationId");

-- CreateIndex
CREATE INDEX "ChatParticipant_userId_idx" ON "ChatParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatParticipant_conversationId_userId_key" ON "ChatParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "ChatMessage_organizationId_createdAt_idx" ON "ChatMessage"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- CreateIndex
CREATE INDEX "ChatUserBlock_organizationId_active_idx" ON "ChatUserBlock"("organizationId", "active");

-- CreateIndex
CREATE INDEX "ChatUserBlock_blockedById_idx" ON "ChatUserBlock"("blockedById");

-- CreateIndex
CREATE UNIQUE INDEX "ChatUserBlock_organizationId_userId_key" ON "ChatUserBlock"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Document_organizationId_idx" ON "Document"("organizationId");

-- CreateIndex
CREATE INDEX "Document_projectId_idx" ON "Document"("projectId");

-- CreateIndex
CREATE INDEX "Document_folderId_idx" ON "Document"("folderId");

-- CreateIndex
CREATE INDEX "Document_uploadedById_idx" ON "Document"("uploadedById");

-- CreateIndex
CREATE INDEX "Document_accessLevel_idx" ON "Document"("accessLevel");

-- CreateIndex
CREATE INDEX "Document_organizationId_deletedAt_idx" ON "Document"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");

-- CreateIndex
CREATE INDEX "DocumentVersion_uploadedById_idx" ON "DocumentVersion"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_key_key" ON "Workflow"("key");

-- CreateIndex
CREATE INDEX "Workflow_organizationId_idx" ON "Workflow"("organizationId");

-- CreateIndex
CREATE INDEX "Workflow_projectId_idx" ON "Workflow"("projectId");

-- CreateIndex
CREATE INDEX "Workflow_projectModuleId_idx" ON "Workflow"("projectModuleId");

-- CreateIndex
CREATE INDEX "WorkflowState_workflowId_idx" ON "WorkflowState"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowState_workflowId_key_key" ON "WorkflowState"("workflowId", "key");

-- CreateIndex
CREATE INDEX "WorkflowTransition_workflowId_idx" ON "WorkflowTransition"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowTransition_fromStateId_idx" ON "WorkflowTransition"("fromStateId");

-- CreateIndex
CREATE INDEX "WorkflowTransition_toStateId_idx" ON "WorkflowTransition"("toStateId");

-- CreateIndex
CREATE INDEX "EventLog_projectId_idx" ON "EventLog"("projectId");

-- CreateIndex
CREATE INDEX "EventLog_organizationId_idx" ON "EventLog"("organizationId");

-- CreateIndex
CREATE INDEX "EventLog_type_idx" ON "EventLog"("type");

-- CreateIndex
CREATE INDEX "EventLog_createdAt_idx" ON "EventLog"("createdAt");

-- CreateIndex
CREATE INDEX "AutomatedAction_organizationId_idx" ON "AutomatedAction"("organizationId");

-- CreateIndex
CREATE INDEX "AutomatedAction_status_idx" ON "AutomatedAction"("status");

-- CreateIndex
CREATE INDEX "Policy_organizationId_idx" ON "Policy"("organizationId");

-- CreateIndex
CREATE INDEX "Policy_action_idx" ON "Policy"("action");

-- CreateIndex
CREATE INDEX "Policy_resource_idx" ON "Policy"("resource");

-- CreateIndex
CREATE INDEX "FinancialCharge_organizationId_idx" ON "FinancialCharge"("organizationId");

-- CreateIndex
CREATE INDEX "FinancialCharge_projectId_idx" ON "FinancialCharge"("projectId");

-- CreateIndex
CREATE INDEX "FinancialCharge_category_idx" ON "FinancialCharge"("category");

-- CreateIndex
CREATE INDEX "FinancialCharge_status_idx" ON "FinancialCharge"("status");

-- CreateIndex
CREATE INDEX "FinancialCharge_date_idx" ON "FinancialCharge"("date");

-- CreateIndex
CREATE INDEX "FinancialCharge_organizationId_deletedAt_idx" ON "FinancialCharge"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "SystemError_organizationId_idx" ON "SystemError"("organizationId");

-- CreateIndex
CREATE INDEX "SystemError_code_idx" ON "SystemError"("code");

-- CreateIndex
CREATE INDEX "SystemError_createdAt_idx" ON "SystemError"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "Field_organizationId_idx" ON "Field"("organizationId");

-- CreateIndex
CREATE INDEX "Field_projectId_idx" ON "Field"("projectId");

-- CreateIndex
CREATE INDEX "Field_status_idx" ON "Field"("status");

-- CreateIndex
CREATE INDEX "Livestock_organizationId_idx" ON "Livestock"("organizationId");

-- CreateIndex
CREATE INDEX "Livestock_projectId_idx" ON "Livestock"("projectId");

-- CreateIndex
CREATE INDEX "Livestock_status_idx" ON "Livestock"("status");

-- CreateIndex
CREATE INDEX "HealthCenter_organizationId_idx" ON "HealthCenter"("organizationId");

-- CreateIndex
CREATE INDEX "HealthCenter_projectId_idx" ON "HealthCenter"("projectId");

-- CreateIndex
CREATE INDEX "HealthCenter_status_idx" ON "HealthCenter"("status");

-- CreateIndex
CREATE INDEX "Campaign_organizationId_idx" ON "Campaign"("organizationId");

-- CreateIndex
CREATE INDEX "Campaign_projectId_idx" ON "Campaign"("projectId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Warehouse_organizationId_idx" ON "Warehouse"("organizationId");

-- CreateIndex
CREATE INDEX "Warehouse_projectId_idx" ON "Warehouse"("projectId");

-- CreateIndex
CREATE INDEX "Warehouse_status_idx" ON "Warehouse"("status");

-- CreateIndex
CREATE INDEX "Shipment_organizationId_idx" ON "Shipment"("organizationId");

-- CreateIndex
CREATE INDEX "Shipment_projectId_idx" ON "Shipment"("projectId");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "HighVoltageNetwork_organizationId_idx" ON "HighVoltageNetwork"("organizationId");

-- CreateIndex
CREATE INDEX "HighVoltageNetwork_projectId_idx" ON "HighVoltageNetwork"("projectId");

-- CreateIndex
CREATE INDEX "HighVoltageNetwork_status_idx" ON "HighVoltageNetwork"("status");

-- CreateIndex
CREATE INDEX "SolarInstallation_organizationId_idx" ON "SolarInstallation"("organizationId");

-- CreateIndex
CREATE INDEX "SolarInstallation_projectId_idx" ON "SolarInstallation"("projectId");

-- CreateIndex
CREATE INDEX "SolarInstallation_status_idx" ON "SolarInstallation"("status");

-- CreateIndex
CREATE INDEX "TargetingCampaign_organizationId_idx" ON "TargetingCampaign"("organizationId");

-- CreateIndex
CREATE INDEX "TargetingCampaign_projectId_idx" ON "TargetingCampaign"("projectId");

-- CreateIndex
CREATE INDEX "TargetingCampaign_status_idx" ON "TargetingCampaign"("status");

-- CreateIndex
CREATE INDEX "DataCollectionSurvey_organizationId_idx" ON "DataCollectionSurvey"("organizationId");

-- CreateIndex
CREATE INDEX "DataCollectionSurvey_projectId_idx" ON "DataCollectionSurvey"("projectId");

-- CreateIndex
CREATE INDEX "DataCollectionSurvey_status_idx" ON "DataCollectionSurvey"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MESRecord_avisNumber_key" ON "MESRecord"("avisNumber");

-- CreateIndex
CREATE INDEX "MESRecord_organizationId_idx" ON "MESRecord"("organizationId");

-- CreateIndex
CREATE INDEX "MESRecord_projectId_idx" ON "MESRecord"("projectId");

-- CreateIndex
CREATE INDEX "MESRecord_status_idx" ON "MESRecord"("status");

-- CreateIndex
CREATE INDEX "MESRecord_prestataire_idx" ON "MESRecord"("prestataire");

-- CreateIndex
CREATE INDEX "MESRecord_date_idx" ON "MESRecord"("date");

-- CreateIndex
CREATE INDEX "MESRecord_avisNumber_idx" ON "MESRecord"("avisNumber");

-- CreateIndex
CREATE INDEX "MESRecord_meterNumber_idx" ON "MESRecord"("meterNumber");

-- CreateIndex
CREATE INDEX "MESControl_mesRecordId_idx" ON "MESControl"("mesRecordId");

-- CreateIndex
CREATE INDEX "MESControl_controllerId_idx" ON "MESControl"("controllerId");

-- CreateIndex
CREATE INDEX "MESControl_conforme_idx" ON "MESControl"("conforme");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "Household_organizationId_deletedAt_idx" ON "Household"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "Household_assignedTeams_idx" ON "Household"("assignedTeams");

-- CreateIndex
CREATE INDEX "Household_grappeId_idx" ON "Household"("grappeId");

-- CreateIndex
CREATE INDEX "Household_zoneId_organizationId_idx" ON "Household"("zoneId", "organizationId");

-- CreateIndex
CREATE INDEX "Household_status_idx" ON "Household"("status");

-- CreateIndex
CREATE INDEX "Household_organizationId_status_idx" ON "Household"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Household_projectId_idx" ON "Household"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Household_numeroordre_organizationId_key" ON "Household"("numeroordre", "organizationId");

-- CreateIndex
CREATE INDEX "Mission_createdBy_idx" ON "Mission"("createdBy");

-- CreateIndex
CREATE INDEX "Mission_status_deletedAt_idx" ON "Mission"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "Mission_organizationId_createdBy_idx" ON "Mission"("organizationId", "createdBy");

-- CreateIndex
CREATE INDEX "Mission_organizationId_status_createdAt_idx" ON "Mission"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Mission_projectId_createdBy_idx" ON "Mission"("projectId", "createdBy");

-- CreateIndex
CREATE INDEX "MissionApprovalWorkflow_orderNumber_idx" ON "MissionApprovalWorkflow"("orderNumber");

-- CreateIndex
CREATE INDEX "Project_organizationId_deletedAt_idx" ON "Project"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "Project_templateKey_idx" ON "Project"("templateKey");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Team_offlineId_key" ON "Team"("offlineId");

-- CreateIndex
CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");

-- CreateIndex
CREATE INDEX "Team_projectId_deletedAt_idx" ON "Team"("projectId", "deletedAt");

-- CreateIndex
CREATE INDEX "Team_parentTeamId_idx" ON "Team"("parentTeamId");

-- CreateIndex
CREATE INDEX "Team_regionId_idx" ON "Team"("regionId");

-- CreateIndex
CREATE INDEX "Team_path_idx" ON "Team"("path");

-- CreateIndex
CREATE INDEX "Team_role_idx" ON "Team"("role");

-- CreateIndex
CREATE INDEX "Team_status_idx" ON "Team"("status");

-- CreateIndex
CREATE INDEX "Team_tradeKey_idx" ON "Team"("tradeKey");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_organizationId_key" ON "User"("email", "organizationId");

-- CreateIndex
CREATE INDEX "Zone_organizationId_deletedAt_idx" ON "Zone"("organizationId", "deletedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPage" ADD CONSTRAINT "ProjectPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectModule" ADD CONSTRAINT "ProjectModule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_grappeId_fkey" FOREIGN KEY ("grappeId") REFERENCES "Grappe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grappe" ADD CONSTRAINT "Grappe_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grappe" ADD CONSTRAINT "Grappe_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_grappeId_fkey" FOREIGN KEY ("grappeId") REFERENCES "Grappe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_parentTeamId_fkey" FOREIGN KEY ("parentTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictLog" ADD CONSTRAINT "ConflictLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KoboFormMapping" ADD CONSTRAINT "KoboFormMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolboxFormHook" ADD CONSTRAINT "ToolboxFormHook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolboxWebhookExecution" ADD CONSTRAINT "ToolboxWebhookExecution_hookId_fkey" FOREIGN KEY ("hookId") REFERENCES "ToolboxFormHook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolboxWebhookExecution" ADD CONSTRAINT "ToolboxWebhookExecution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GedcollectAssignment" ADD CONSTRAINT "GedcollectAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GedcollectAssignment" ADD CONSTRAINT "GedcollectAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledReport" ADD CONSTRAINT "ScheduledReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledReport" ADD CONSTRAINT "ScheduledReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReport" ADD CONSTRAINT "GeneratedReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReport" ADD CONSTRAINT "GeneratedReport_scheduledReportId_fkey" FOREIGN KEY ("scheduledReportId") REFERENCES "ScheduledReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReport" ADD CONSTRAINT "GeneratedReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolboxSubmission" ADD CONSTRAINT "ToolboxSubmission_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolboxSubmission" ADD CONSTRAINT "ToolboxSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolboxSubmission" ADD CONSTRAINT "ToolboxSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceLog" ADD CONSTRAINT "PerformanceLog_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceLog" ADD CONSTRAINT "PerformanceLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceLog" ADD CONSTRAINT "PerformanceLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceLog" ADD CONSTRAINT "PerformanceLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceLog" ADD CONSTRAINT "PerformanceLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMemory" ADD CONSTRAINT "UserMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VectorMemory" ADD CONSTRAINT "VectorMemory_userMemoryId_fkey" FOREIGN KEY ("userMemoryId") REFERENCES "UserMemory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionApproval" ADD CONSTRAINT "ActionApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationModule" ADD CONSTRAINT "FormationModule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationSession" ADD CONSTRAINT "FormationSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationSessionModule" ADD CONSTRAINT "FormationSessionModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "FormationModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationSessionModule" ADD CONSTRAINT "FormationSessionModule_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FormationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationParticipant" ADD CONSTRAINT "FormationParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FormationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationPlanningHistory" ADD CONSTRAINT "FormationPlanningHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationPlanningHistory" ADD CONSTRAINT "FormationPlanningHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FormationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormationPlannerState" ADD CONSTRAINT "FormationPlannerState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConversation" ADD CONSTRAINT "ChatConversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatParticipant" ADD CONSTRAINT "ChatParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatUserBlock" ADD CONSTRAINT "ChatUserBlock_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatUserBlock" ADD CONSTRAINT "ChatUserBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_projectModuleId_fkey" FOREIGN KEY ("projectModuleId") REFERENCES "ProjectModule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowState" ADD CONSTRAINT "WorkflowState_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_fromStateId_fkey" FOREIGN KEY ("fromStateId") REFERENCES "WorkflowState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_toStateId_fkey" FOREIGN KEY ("toStateId") REFERENCES "WorkflowState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomatedAction" ADD CONSTRAINT "AutomatedAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomatedAction" ADD CONSTRAINT "AutomatedAction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomatedAction" ADD CONSTRAINT "AutomatedAction_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialCharge" ADD CONSTRAINT "FinancialCharge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialCharge" ADD CONSTRAINT "FinancialCharge_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Field" ADD CONSTRAINT "Field_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Field" ADD CONSTRAINT "Field_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Livestock" ADD CONSTRAINT "Livestock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Livestock" ADD CONSTRAINT "Livestock_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCenter" ADD CONSTRAINT "HealthCenter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCenter" ADD CONSTRAINT "HealthCenter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HighVoltageNetwork" ADD CONSTRAINT "HighVoltageNetwork_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HighVoltageNetwork" ADD CONSTRAINT "HighVoltageNetwork_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarInstallation" ADD CONSTRAINT "SolarInstallation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolarInstallation" ADD CONSTRAINT "SolarInstallation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetingCampaign" ADD CONSTRAINT "TargetingCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetingCampaign" ADD CONSTRAINT "TargetingCampaign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataCollectionSurvey" ADD CONSTRAINT "DataCollectionSurvey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataCollectionSurvey" ADD CONSTRAINT "DataCollectionSurvey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MESRecord" ADD CONSTRAINT "MESRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MESRecord" ADD CONSTRAINT "MESRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MESRecord" ADD CONSTRAINT "MESRecord_controllerId_fkey" FOREIGN KEY ("controllerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MESRecord" ADD CONSTRAINT "MESRecord_validatorId_fkey" FOREIGN KEY ("validatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MESControl" ADD CONSTRAINT "MESControl_mesRecordId_fkey" FOREIGN KEY ("mesRecordId") REFERENCES "MESRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MESControl" ADD CONSTRAINT "MESControl_controllerId_fkey" FOREIGN KEY ("controllerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
