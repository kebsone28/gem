#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/proquelec/gem-saas}"
BRANCH="${BRANCH:-main}"

install_dependencies() {
  if [ -f package-lock.json ]; then
    npm ci --legacy-peer-deps
  else
    npm install --legacy-peer-deps
  fi
}

restart_backend() {
  if command -v pm2 >/dev/null 2>&1; then
    pm2 restart gem-backend --update-env || pm2 restart all --update-env
    pm2 save || true
    return 0
  fi

  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q 'gem.*backend'; then
    systemctl restart gem-backend
    return 0
  fi

  echo "[DEPLOY] Backend restart not detected automatically. Restart the Node service manually." >&2
  return 1
}

echo "[DEPLOY] GEM Kobo production deploy"
echo "[DEPLOY] Directory: ${APP_DIR}"
echo "[DEPLOY] Branch: ${BRANCH}"

cd "${APP_DIR}"
git fetch origin "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

cd backend
install_dependencies
npm run prisma:generate
npm run migrate
restart_backend

cd ../frontend
install_dependencies
NODE_OPTIONS='--max-old-space-size=4096' npm run build

curl -fsS http://localhost:5005/health >/dev/null

KOBO_ROUTE_STATUS="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5005/api/internal-kobo/form-definition || true)"
if [ "${KOBO_ROUTE_STATUS}" = "404" ] || [ "${KOBO_ROUTE_STATUS}" = "000" ]; then
  echo "[DEPLOY] Internal Kobo backend route is not active: HTTP ${KOBO_ROUTE_STATUS}" >&2
  exit 1
fi
echo "[DEPLOY] Internal Kobo backend route detected: HTTP ${KOBO_ROUTE_STATUS}"

if [ -n "${GEM_SMOKE_TOKEN:-}" ]; then
  cd "${APP_DIR}"
  GEM_API_URL='http://localhost:5005/api' GEM_AUTH_TOKEN="${GEM_SMOKE_TOKEN}" node scripts/internal-kobo-smoke.mjs
else
  echo "[DEPLOY] Internal Kobo smoke skipped. Set GEM_SMOKE_TOKEN to run the authenticated check."
fi

echo "[DEPLOY] Done."
