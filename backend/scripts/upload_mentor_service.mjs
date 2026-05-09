import { NodeSSH } from 'node-ssh';
import fs from 'fs';
import path from 'path';

async function uploadFile() {
  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host: 'gem.proquelec.sn',
      username: 'root',
      password: 'Ur94w4NVdhcpJJUPCnFj'
    });

    const localPath = 'c:\\Mes-Sites-Web\\GEM_SAAS\\backend\\src\\modules\\assistant\\mentor.service.js';
    const remotePath = '/var/www/proquelec/gem-saas/backend/src/modules/assistant/mentor.service.js';

    console.log(`📤 Uploading ${localPath} to VPS...`);
    await ssh.putFile(localPath, remotePath);
    console.log('✅ File uploaded successfully');

    // Restart the process
    const psResult = await ssh.execCommand('ps aux | grep "node /var/www/proquelec/gem-saas/backend/src/server.js" | grep -v grep');
    if (psResult.stdout) {
      const pid = psResult.stdout.trim().split(/\s+/)[1];
      console.log(`🔄 Restarting backend (PID ${pid})...`);
      await ssh.execCommand(`kill -9 ${pid}`);
      console.log('✅ Backend restarted');
    }

  } catch (err) {
    console.error('❌ Upload failed:', err);
  } finally {
    ssh.dispose();
  }
}

uploadFile();
