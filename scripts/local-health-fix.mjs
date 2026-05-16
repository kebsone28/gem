import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('🚀 DÉMARRAGE DU DIAGNOSTIC GLOBAL GEM_SAAS (LOCAL)...\n');

try {
    // 1. Nettoyage Node (Désactivé à l'intérieur pour éviter l'auto-kill)
    console.log('🧹 Passage au diagnostic base de données...');
    
    // 2. Vérification DB et Prisma
    console.log('📦 Vérification de la base de données et de Prisma...');
    process.chdir(path.join(ROOT_DIR, 'backend'));
    
    console.log('  - Génération du client Prisma...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    console.log('  - Vérification/Application des colonnes manquantes...');
    const sqlFix = `
        -- Création des tables si manquantes
        CREATE TABLE IF NOT EXISTS "SystemConfig" (
            "id" TEXT PRIMARY KEY,
            "key" TEXT UNIQUE NOT NULL,
            "value" JSONB NOT NULL,
            "description" TEXT,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS "ModuleConfig" (
            "id" TEXT PRIMARY KEY,
            "moduleKey" TEXT NOT NULL,
            "organizationId" TEXT NOT NULL,
            "isEnabled" BOOLEAN NOT NULL DEFAULT true,
            "settings" JSONB NOT NULL DEFAULT '{}',
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "ModuleConfig_unique_module_org" UNIQUE ("moduleKey", "organizationId")
        );

        -- Correction Organization
        ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "defaultProjectId" TEXT;
        ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "slug" TEXT;
        
        -- Correction User
        ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "chatStatus" TEXT NOT NULL DEFAULT 'ONLINE';
        ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "chatStatusText" TEXT;
        
        -- Correction Household
        ALTER TABLE "Household" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
        
        -- 1. Donner les super-pouvoirs à l'utilisateur Admin (si existant)
        UPDATE "User" SET "role" = 'ADMIN_PROQUELEC' WHERE "email" ILIKE '%admin%';

        -- 2. Activer tous les modules core pour PROQUELEC
        INSERT INTO "ModuleConfig" ("id", "moduleKey", "organizationId", "isEnabled", "settings", "updatedAt")
        SELECT gen_random_uuid()::text, k.key, o.id, true, '{}'::jsonb, NOW()
        FROM (VALUES ('ai_engine'), ('logistique'), ('planning'), ('terrain')) AS k(key)
        CROSS JOIN "Organization" o
        WHERE o.name ILIKE '%PROQUELEC%'
        ON CONFLICT ("moduleKey", "organizationId") DO UPDATE SET "isEnabled" = true;

        -- 3. Configuration système globale
        INSERT INTO "SystemConfig" ("id", "key", "value", "updatedAt")
        VALUES (gen_random_uuid()::text, 'ai_enabled', 'true'::jsonb, NOW())
        ON CONFLICT ("key") DO UPDATE SET "value" = 'true'::jsonb;
    `;
    
    fs.writeFileSync('temp_fix.sql', sqlFix);
    try {
        execSync('npx prisma db execute --file temp_fix.sql', { stdio: 'inherit' });
        console.log('  ✅ Base de données locale mise à jour.');
    } catch (e) {
        console.error('  ⚠️ Erreur lors de l\'exécution du SQL. Vérifiez que PostgreSQL est lancé localement.');
    }
    fs.unlinkSync('temp_fix.sql');

    // 3. Correction des ports
    console.log('\n🔧 Correction des ports GEM...');
    process.chdir(ROOT_DIR);
    execSync('npm run validate-ports:fix', { stdio: 'inherit' });

    console.log('\n✨ RÉPARATION TERMINÉE !');
    console.log('👉 Vous pouvez maintenant lancer : npm run dev:saas');
} catch (error) {
    console.error('\n❌ ÉCHEC DU DIAGNOSTIC :', error.message);
}
