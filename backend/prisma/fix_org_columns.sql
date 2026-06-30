-- Patch Organization : colonnes manquantes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Organization' AND column_name='config') THEN
    ALTER TABLE "Organization" ADD COLUMN "config" JSONB NOT NULL DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Organization' AND column_name='defaultProjectId') THEN
    ALTER TABLE "Organization" ADD COLUMN "defaultProjectId" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Organization' AND column_name='slug') THEN
    ALTER TABLE "Organization" ADD COLUMN "slug" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Organization' AND column_name='createdAt') THEN
    ALTER TABLE "Organization" ADD COLUMN "createdAt" TIMESTAMP NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Index unique sur slug si absent
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug") WHERE "slug" IS NOT NULL;

-- Patch User : colonnes manquantes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='User' AND column_name='pinHash') THEN
    ALTER TABLE "User" ADD COLUMN "pinHash" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='User' AND column_name='phoneActivated') THEN
    ALTER TABLE "User" ADD COLUMN "phoneActivated" BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='User' AND column_name='chatStatus') THEN
    ALTER TABLE "User" ADD COLUMN "chatStatus" TEXT NOT NULL DEFAULT 'ONLINE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='User' AND column_name='chatStatusText') THEN
    ALTER TABLE "User" ADD COLUMN "chatStatusText" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='User' AND column_name='notificationEmail') THEN
    ALTER TABLE "User" ADD COLUMN "notificationEmail" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='User' AND column_name='recoveryCodeHash') THEN
    ALTER TABLE "User" ADD COLUMN "recoveryCodeHash" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='User' AND column_name='securityQuestion') THEN
    ALTER TABLE "User" ADD COLUMN "securityQuestion" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='User' AND column_name='securityAnswerHash') THEN
    ALTER TABLE "User" ADD COLUMN "securityAnswerHash" TEXT;
  END IF;
END $$;
