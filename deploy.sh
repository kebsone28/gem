#!/usr/bin/env bash
# -------------------------------------------------
# push‑et‑déploie –  Commit → push → deploy sur VPS
# -------------------------------------------------
# Usage :  ./deploy.sh "Message du commit"
# -------------------------------------------------

set -euo pipefail   # Arrêt sur la première erreur

# ==== CONFIGURATION =========================================================
# Adresse du serveur VPS
export VPS_HOST="${VPS_HOST:-vps.mondomaine.com}"
# Utilisateur SSH (défaut root)
export VPS_USER="${VPS_USER:-root}"
# Chemin du dépôt sur le serveur
export VPS_PATH="${VPS_PATH:-/var/www/gedcollect}"
# Clé SSH déjà chargée dans ssh‑agent ou référencée ici
#   export SSH_KEY="${HOME}/.ssh/id_rsa"
# Si vous ne voulez pas passer par ssh‑agent, décommentez la ligne suivante
# SSH_OPTIONS="-i ${SSH_KEY}"
# ===========================================================================

# ==== 1. GIT – commit & push ==================================================
if [[ $# -eq 0 ]]; then
  echo "Erreur : aucun message de commit fourni."
  echo "Usage : $0 \"Message du commit\""
  exit 1
fi

COMMIT_MSG="$*"

# Ajoute tout, crée le commit s’il y a des changements
if [[ -n "$(git status --porcelain)" ]]; then
  echo "→ Ajout des changements"
  git add -A
  echo "→ Création du commit"
  git commit -m "${COMMIT_MSG}"
else
  echo "→ Aucun changement à committer"
fi

echo "→ Pousse sur origin/main"
git push origin main

# ==== 2. SSH – déploiement sur le VPS =========================================
echo "=== Connexion au VPS ($VPS_USER@$VPS_HOST) ==="
ssh ${SSH_OPTIONS:-} -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" bash -s <<'EOF'
set -euo pipefail

# – 1. Se placer dans le répertoire du projet
cd "${VPS_PATH}"

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
EOF

echo "✅ Déploiement terminé sur $VPS_HOST"
