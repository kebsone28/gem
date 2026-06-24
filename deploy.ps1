#!/usr/bin/env pwsh
# -------------------------------------------------
# push‑et‑déploie – Commit → push → deploy sur VPS (PowerShell version)
# -------------------------------------------------
# Usage :  .\deploy.ps1 -Message "Message du commit"
# -------------------------------------------------

param(
    [Parameter(Mandatory=$true,HelpMessage="Message du commit")]
    [string]$Message
)

# ==== CONFIGURATION =========================================================
$envVpsHost = $env:VPS_HOST
$envVpsUser = $env:VPS_USER
$envVpsPath = $env:VPS_PATH

$VpsHost = if ($envVpsHost) { $envVpsHost } else { "vps.mondomaine.com" }
$VpsUser = if ($envVpsUser) { $envVpsUser } else { "root" }
$VpsPath = if ($envVpsPath) { $envVpsPath } else { "/var/www/gedcollect" }

# ==== 1. GIT – commit & push ==================================================
Write-Host "→ Vérification des changements"
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "→ Ajout des changements"
    git add -A
    Write-Host "→ Création du commit"
    git commit -m $Message
} else {
    Write-Host "→ Aucun changement à committer"
}

Write-Host "→ Pousse sur origin/main"
git push origin main

# ==== 2. SSH – déploiement sur le VPS =========================================
Write-Host "=== Connexion au VPS ($VpsUser@$VpsHost) ==="
$sshCommands = @"
set -euo pipefail

# – 1. Se placer dans le répertoire du projet
cd \"$VpsPath\"

# – 2. Mettre à jour le dépôt
echo "→ Récupération du dernier code"
git fetch --all
git reset --hard origin/main

# – 3. Installer les dépendances backend
echo "→ Installation des dépendances backend"
npm ci --prefix backend --legacy-peer-deps

# – 4. Prisma generate + migrations
echo "→ Prisma generate + migrations"
npx prisma generate --schema=prisma/schema.prisma
npx prisma migrate deploy --schema=prisma/schema.prisma || echo "Migrations déjà à jour"

# – 5. Installer les dépendances front + build
echo "→ Installation des dépendances front"
npm ci --prefix frontend --legacy-peer-deps
echo "→ Build du front"
NODE_OPTIONS='--max-old-space-size=4096' npm run build --prefix frontend

# – 6. Redémarrer le service backend (pm2)
echo "→ Redémarrage du backend avec pm2"
npx pm2 restart all

# – 7. Health‑check
echo "→ Health‑check"
sleep 10
curl -fsS http://localhost:5005/health || echo "⚠️ Health‑check échoué – vérifier manuellement"
"@

ssh $VpsUser@$VpsHost $sshCommands

Write-Host "✅ Déploiement terminé sur $VpsHost"
