-- Create SystemError table (missing from production DB)
CREATE TABLE IF NOT EXISTS public."SystemError" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT,
  "projectId" TEXT,
  "userId" TEXT,
  code TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB DEFAULT '{}',
  "isResolved" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "SystemError_organizationId_idx" ON public."SystemError" ("organizationId");
CREATE INDEX IF NOT EXISTS "SystemError_code_idx" ON public."SystemError" (code);
CREATE INDEX IF NOT EXISTS "SystemError_createdAt_idx" ON public."SystemError" ("createdAt");

-- Set ownership to the app user
ALTER TABLE public."SystemError" OWNER TO proquelec_user;
GRANT ALL PRIVILEGES ON TABLE public."SystemError" TO proquelec_user;

-- Verify both tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('SystemError', 'SystemConfig')
ORDER BY tablename;
