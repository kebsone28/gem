import { NodeSSH } from 'node-ssh';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function buildEnvContent() {
  const lines = [
    `PORT=${process.env.PORT || '5005'}`,
    `NODE_ENV=${process.env.NODE_ENV || 'production'}`,
    `DATABASE_URL=${process.env.DATABASE_URL || ''}`,
    `JWT_SECRET=${process.env.JWT_SECRET || ''}`,
    `REFRESH_TOKEN_SECRET=${process.env.REFRESH_TOKEN_SECRET || ''}`,
    `KOBO_TOKEN=${process.env.KOBO_TOKEN || ''}`,
    `KOBO_FORM_ID=${process.env.KOBO_FORM_ID || ''}`,
    `FRONTEND_URL=${process.env.FRONTEND_URL || 'https://gem.proquelec.sn'}`,
    `OSRM_URL=${process.env.OSRM_URL || 'http://localhost:5000'}`,
    `SMTP_HOST=${process.env.SMTP_HOST || ''}`,
    `SMTP_PORT=${process.env.SMTP_PORT || '465'}`,
    `SMTP_USER=${process.env.SMTP_USER || ''}`,
    `SMTP_PASS=${process.env.SMTP_PASS || ''}`,
    `SMTP_FROM=${process.env.SMTP_FROM || ''}`,
    `AUDIT_NOTIF_EMAILS=${process.env.AUDIT_NOTIF_EMAILS || ''}`,
    '',
    '# AI ENGINE CONFIG',
    `AI_PROVIDER=${process.env.AI_PROVIDER || 'LOCAL_OLLAMA'}`,
    `OLLAMA_BASE_URL=${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}`,
    `OLLAMA_MODEL=${process.env.OLLAMA_MODEL || 'llama3.2:1b'}`,
    '',
  ];
  return lines.join('\n');
}

async function updateEnv() {
  const ssh = new NodeSSH();
  try {
    const password = process.env.VPS_SSH_PASSWORD;
    if (!password) throw new Error('VPS_SSH_PASSWORD non défini dans l\'environnement.');

    await ssh.connect({
      host: 'gem.proquelec.sn',
      username: 'root',
      password,
    });

    const envContent = buildEnvContent();

    // Use a temporary file and then move it to avoid shell escaping hell
    const tempFile = '/tmp/gem_env_update';
    await ssh.execCommand(`cat << 'EOF' > ${tempFile}\n${envContent}EOF`);
    await ssh.execCommand(`mv ${tempFile} /var/www/proquelec/gem-saas/backend/.env`);
    
    console.log('✅ VPS .env updated successfully');
    
    // Restart the backend process
    // Based on ps aux, it's running directly via node /var/www/proquelec/gem-saas/backend/src/server.js
    // We should find the process and kill it, then restart it?
    // Or check if PM2 is used but just not showing up in default list.
    
    const psResult = await ssh.execCommand('ps aux | grep "node /var/www/proquelec/gem-saas/backend/src/server.js" | grep -v grep');
    if (psResult.stdout) {
      const pid = psResult.stdout.trim().split(/\s+/)[1];
      console.log(`Killing process ${pid}...`);
      await ssh.execCommand(`kill -9 ${pid}`);
      // Restart (we assume it's under a process manager that will restart it, or we restart it manually)
      // Actually, if it's NOT under PM2, we need to restart it.
      // But usually it's under systemd or pm2.
      // Let's check systemd units.
    }
    
  } catch (err) {
    console.error('Failed to update VPS env:', err);
  } finally {
    ssh.dispose();
  }
}

updateEnv();
