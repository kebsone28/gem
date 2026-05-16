import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const prismaClientDir = join(process.cwd(), 'node_modules', '.prisma', 'client');
const prismaClientEntrypoint = join(prismaClientDir, 'index.js');

function cleanupTempEngines() {
  if (!existsSync(prismaClientDir)) return;

  for (const entry of readdirSync(prismaClientDir)) {
    if (entry.startsWith('query-engine-windows.exe.tmp')) {
      try {
        rmSync(join(prismaClientDir, entry), { force: true });
      } catch {
      }
    }
  }
}

function canFallbackToExistingClient() {
  return existsSync(prismaClientEntrypoint);
}

cleanupTempEngines();

const prismaGenerateCommand =
  process.platform === 'win32'
    ? 'npx prisma generate'
    : 'npx prisma generate';

const result = spawnSync(prismaGenerateCommand, {
  encoding: 'utf8',
  shell: true,
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.status === 0) {
  process.exit(0);
}

const output = `${result.stdout || ''}\n${result.stderr || ''}`;
const isWindowsEngineLock =
  process.platform === 'win32' &&
  output.includes('EPERM: operation not permitted, rename') &&
  output.includes('query-engine-windows.exe');

if (isWindowsEngineLock && canFallbackToExistingClient()) {
  console.warn(
    "[prisma-generate-safe] Prisma generate a echoue a cause d'un verrou Windows sur query-engine-windows.exe."
  );
  console.warn(
    '[prisma-generate-safe] Demarrage du backend avec le client Prisma deja present. Redemarre les processus Node pour regenerer proprement ensuite.'
  );
  process.exit(0);
}

process.exit(result.status || 1);
