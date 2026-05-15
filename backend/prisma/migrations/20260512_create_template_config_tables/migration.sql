-- ============================================================
-- Migration: create_template_and_config_tables
-- Create ProjectTemplate, ProjectPage, ProjectModule tables for project configuration
-- ============================================================

-- ProjectTemplate table - system-wide templates
CREATE TABLE IF NOT EXISTS "ProjectTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "config" JSONB NOT NULL DEFAULT '{}',
  "modules" JSONB DEFAULT '[]',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ProjectPage table - per-project page configuration
CREATE TABLE IF NOT EXISTS "ProjectPage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "icon" TEXT,
  "route" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "config" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE,
  CONSTRAINT "ProjectPage_projectId_key_unique" UNIQUE ("projectId", "key")
);

CREATE INDEX "ProjectPage_projectId_idx" ON "ProjectPage"("projectId");

-- ProjectModule table - per-project module configuration
CREATE TABLE IF NOT EXISTS "ProjectModule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB DEFAULT '{}',
  "fields" JSONB DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE,
  CONSTRAINT "ProjectModule_projectId_key_unique" UNIQUE ("projectId", "key")
);

CREATE INDEX "ProjectModule_projectId_idx" ON "ProjectModule"("projectId");
CREATE INDEX "ProjectTemplate_key_idx" ON "ProjectTemplate"("key");
