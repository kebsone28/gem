# 🚀 GEM SAAS - Automated Deployment Script
# Usage: Run this from your local project root

Write-Host "--- 📦 1. PREPARATION DES FICHIERS ---" -ForegroundColor Cyan
git add .
$msg = Read-Host "Message de mise à jour (ex: Correction bug carte)"
if ($msg -eq "") { $msg = "Mise à jour automatique - $(Get-Date -Format 'dd/MM/yyyy HH:mm')" }
git commit -m $msg

Write-Host "`n--- 📤 2. ENVOI VERS GITHUB ---" -ForegroundColor Cyan
git push origin main

Write-Host "`n--- 🌐 3. CONNEXION ET MISE À JOUR DU VPS ---" -ForegroundColor Cyan
Write-Host "Le terminal va vous demander le mot de passe ROOT du serveur." -ForegroundColor Yellow

# On se connecte et on enchaîne les commandes sur le serveur
ssh root@gem.proquelec.sn "cd /var/www/proquelec/gem-saas && git fetch --all && git reset --hard origin/main && npm install --no-scripts --legacy-peer-deps && cd frontend && npm install --no-scripts --legacy-peer-deps && npm run build && pm2 restart all"

Write-Host "`n✅ MISE À JOUR TERMINÉE SUR https://gem.proquelec.sn" -ForegroundColor Green
Pause
