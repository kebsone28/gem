import dotenv from 'dotenv';

dotenv.config();

export const DEFAULT_WANEKOO_DEPLOY_PATH =
  process.env.WANEKOO_DEPLOY_PATH || '/var/www/proquelec/gem-saas';

const firstNonEmpty = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
};

export const getWanekooSshConfig = () => {
  const host = firstNonEmpty(process.env.WANEKOO_HOST, process.env.DEPLOY_HOST);
  const username = firstNonEmpty(process.env.WANEKOO_USER, process.env.DEPLOY_USER);
  const password = firstNonEmpty(process.env.WANEKOO_PASSWORD, process.env.DEPLOY_PASSWORD);
  const privateKey = firstNonEmpty(process.env.WANEKOO_SSH_KEY, process.env.DEPLOY_SSH_KEY);
  const deployPath = firstNonEmpty(
    process.env.WANEKOO_DEPLOY_PATH,
    process.env.DEPLOY_PATH,
    DEFAULT_WANEKOO_DEPLOY_PATH
  );

  return {
    host,
    username,
    password,
    privateKey,
    deployPath,
  };
};

export const validateWanekooSshConfig = () => {
  const config = getWanekooSshConfig();
  const missing = [];

  if (!config.host) missing.push('WANEKOO_HOST');
  if (!config.username) missing.push('WANEKOO_USER');
  if (!config.password && !config.privateKey) {
    missing.push('WANEKOO_PASSWORD or WANEKOO_SSH_KEY');
  }

  if (missing.length > 0) {
    throw new Error(`Missing Wanekoo SSH config: ${missing.join(', ')}`);
  }

  return config;
};

const escapeShellSingleQuotes = value => String(value).replace(/'/g, "'\"'\"'");

const prismaBaselineAwareDeployCommand = [
  'set +e',
  'PRISMA_MIGRATE_OUTPUT=$(npx prisma migrate deploy --schema=prisma/schema.prisma 2>&1)',
  'PRISMA_MIGRATE_EXIT=$?',
  'set -e',
  'printf "%s\\n" "$PRISMA_MIGRATE_OUTPUT"',
  'if [ $PRISMA_MIGRATE_EXIT -ne 0 ]; then ' +
    'if printf "%s" "$PRISMA_MIGRATE_OUTPUT" | grep -q P3005; then ' +
      'echo "[DEPLOY] Prisma P3005 detected: baselining existing production database."; ' +
      'for migration_dir in prisma/migrations/[0-9]*; do ' +
        'if [ -d "$migration_dir" ]; then ' +
          'migration_name=$(basename "$migration_dir"); ' +
          'echo "[DEPLOY] Baseline migration: $migration_name"; ' +
          'npx prisma migrate resolve --applied "$migration_name" --schema=prisma/schema.prisma; ' +
        'fi; ' +
      'done; ' +
      'npx prisma migrate deploy --schema=prisma/schema.prisma; ' +
    'else ' +
      'exit $PRISMA_MIGRATE_EXIT; ' +
    'fi; ' +
  'fi',
].join('; ');

export const buildWanekooDeployCommand = (deployPath = DEFAULT_WANEKOO_DEPLOY_PATH) =>
  [
    `cd ${deployPath}`,
    'git fetch --all',
    'git reset --hard origin/main',
    'npm install --omit=dev --no-scripts --legacy-peer-deps',
    'cd frontend',
    'npm install --no-scripts --legacy-peer-deps',
    'NODE_OPTIONS="--max-old-space-size=4096" npx vite build',
    'cd ../backend',
    'npm install --no-scripts --legacy-peer-deps',
    'npx prisma generate --schema=prisma/schema.prisma',
    `bash -lc '${escapeShellSingleQuotes(prismaBaselineAwareDeployCommand)}'`,
    'npx pm2 restart all',
  ].join(' && ');

export const buildWanekooRestartCommand = (deployPath = DEFAULT_WANEKOO_DEPLOY_PATH) =>
  `cd ${deployPath}/backend && npx pm2 restart all`;
