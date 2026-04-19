import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

async function restart() {
  try {
    console.log('Connecting to VPS to restart...');
    await ssh.connect({
      host: '204.168.248.25',
      username: 'root',
      password: 'Ur94w4NVdhcpJJUPCnFj'
    });
    console.log('Connected! Restarting PM2...');

    const result = await ssh.execCommand('cd /var/www/proquelec/gem-saas/backend && npx pm2 restart all', {
      onStdout(chunk) { process.stdout.write(chunk.toString('utf8')); },
      onStderr(chunk) { process.stderr.write(chunk.toString('utf8')); }
    });

    console.log('Restart code:', result.code);
    ssh.dispose();
  } catch (error) {
    console.error('Error during restart:', error);
    ssh.dispose();
  }
}

restart();
