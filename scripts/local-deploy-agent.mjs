import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HOST = process.env.LOCAL_DEPLOY_AGENT_HOST || '127.0.0.1';
const PORT = Number(process.env.LOCAL_DEPLOY_AGENT_PORT || 48631);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const deployScript = path.join(repoRoot, 'deploy_vps.ps1');
const powershellBin = process.env.ComSpec ? 'powershell.exe' : 'powershell';

let busy = false;
let lastRun = null;

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
};

const readJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const runDeploy = (payload = {}) =>
  new Promise((resolve) => {
    const args = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      deployScript,
      '-Force',
      '-SshConfigHost',
      payload.sshConfigHost || 'gem-vps',
      '-AcceptHostKey',
    ];

    if (payload.commitMessage && String(payload.commitMessage).trim()) {
      args.push('-CommitMessage', String(payload.commitMessage).trim());
    }

    if (payload.skipTests === true) args.push('-SkipTests');
    if (payload.skipCommit === true) args.push('-SkipCommit');
    if (payload.skipPush === true) args.push('-SkipPush');
    if (payload.skipDeploy === true) args.push('-SkipDeploy');

    const child = spawn(powershellBin, args, {
      cwd: repoRoot,
      windowsHide: true,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        exitCode: code,
        stdout,
        stderr,
      });
    });
  });

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { ok: false, error: 'Missing URL' });
    return;
  }

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, {
      ok: true,
      busy,
      host: HOST,
      port: PORT,
      lastRun,
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/deploy') {
    if (busy) {
      sendJson(res, 409, { ok: false, error: 'Deploy already in progress', lastRun });
      return;
    }

    try {
      busy = true;
      const payload = await readJsonBody(req);
      const startedAt = new Date().toISOString();
      const result = await runDeploy(payload);
      lastRun = {
        startedAt,
        finishedAt: new Date().toISOString(),
        ok: result.ok,
        exitCode: result.exitCode,
      };
      sendJson(res, result.ok ? 200 : 500, {
        ...result,
        lastRun,
      });
    } catch (error) {
      lastRun = {
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        ok: false,
        exitCode: -1,
      };
      sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown local deploy error',
        lastRun,
      });
    } finally {
      busy = false;
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`[local-deploy-agent] listening on http://${HOST}:${PORT}`);
});
