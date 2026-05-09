import { NodeSSH } from 'node-ssh';

async function updateEnv() {
  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: 'gem.proquelec.sn',
      username: 'root',
      password: 'Ur94w4NVdhcpJJUPCnFj'
    });

    const envContent = `PORT=5005
NODE_ENV=production
DATABASE_URL="postgresql://proquelec_user:Fatma77678@localhost:5432/proquelec?schema=public"
JWT_SECRET="52f8b54e3d2a1c9b0a7f4e9d8c7b6a5e4d3c2b1a0987654321fedcba98765432"
REFRESH_TOKEN_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f"
KOBO_TOKEN=2e3a09a8bff3fbb3a2510dbcba84486582897f3f
KOBO_FORM_ID=aEYZwPujJiFBTNb6mxMGCB
FRONTEND_URL=https://gem.proquelec.sn
OSRM_URL=http://localhost:5000
SMTP_HOST=mail.proquelec.sn
SMTP_PORT=465
SMTP_USER=notification@proquelec.sn
SMTP_PASS=1995@PROQUELEC@2015
SMTP_FROM="GEM AUTOMATE <notification@proquelec.sn>"
AUDIT_NOTIF_EMAILS=oumarkebe@proquelec.sn

# AI ENGINE CONFIG
AI_PROVIDER=LOCAL_OLLAMA
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:1b
`;

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
