import { spawnSync } from 'node:child_process';
import { config } from '../src/core/config/config.js';

const port = config.port || 5008;

function run(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
  });
}

function waitForPortToCloseWindows() {
  for (let i = 0; i < 10; i += 1) {
    const check = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`,
      ],
      { encoding: 'utf8', shell: false }
    );

    const remaining = (check.stdout || '').trim();
    if (!remaining) {
      return true;
    }

    spawnSync('powershell.exe', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 300'], {
      encoding: 'utf8',
      shell: false,
    });
  }

  return false;
}

function tryKillWindowsBackend() {
  const pidResult = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`,
    ],
    { encoding: 'utf8', shell: false }
  );

  const pid = (pidResult.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0];

  if (!pid) {
    return;
  }

  const processInfo = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}" | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress`,
    ],
    { encoding: 'utf8', shell: false }
  );

  const raw = (processInfo.stdout || '').trim();
  if (!raw) {
    return;
  }

  let info;
  try {
    info = JSON.parse(raw);
  } catch {
    return;
  }

  const commandLine = String(info.CommandLine || '');
  const processName = String(info.Name || '');
  const looksLikeOurBackend =
    processName.toLowerCase() === 'node.exe' &&
    (commandLine.includes('src/server.js') || commandLine.includes('backend'));

  if (!looksLikeOurBackend) {
    console.warn(
      `[ensure-backend-port-free] Port ${port} est occupe par PID ${pid}, mais le process ne ressemble pas au backend local. Aucun kill automatique.`
    );
    return;
  }

  console.warn(
    `[ensure-backend-port-free] Ancien backend detecte sur le port ${port} (PID ${pid}). Arret avant redemarrage...`
  );
  const stopResult = spawnSync('taskkill', ['/F', '/PID', String(pid)], {
    encoding: 'utf8',
    shell: false,
  });

  if (stopResult.stdout) process.stdout.write(stopResult.stdout);
  if (stopResult.stderr) process.stderr.write(stopResult.stderr);

  if (!waitForPortToCloseWindows()) {
    console.warn(
      `[ensure-backend-port-free] Le port ${port} semble encore occupe apres la tentative d'arret.`
    );
  }
}

function tryKillUnixBackend() {
  const lsof = run('sh', ['-lc', `lsof -ti tcp:${port}`]);
  const pid = (lsof.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0];

  if (!pid) {
    return;
  }

  const ps = run('sh', ['-lc', `ps -p ${pid} -o command=`]);
  const commandLine = (ps.stdout || '').trim();
  if (!commandLine.includes('src/server.js')) {
    console.warn(
      `[ensure-backend-port-free] Port ${port} est occupe par PID ${pid}, mais le process ne ressemble pas au backend local. Aucun kill automatique.`
    );
    return;
  }

  console.warn(
    `[ensure-backend-port-free] Ancien backend detecte sur le port ${port} (PID ${pid}). Arret avant redemarrage...`
  );
  run('sh', ['-lc', `kill -9 ${pid}`]);
}

if (process.platform === 'win32') {
  tryKillWindowsBackend();
} else {
  tryKillUnixBackend();
}
