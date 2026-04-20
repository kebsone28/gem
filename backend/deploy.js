import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

async function deploy() {
  try {
    console.log('Connecting to VPS...');
    await ssh.connect({
      host: '204.168.248.25',
      username: 'root',
      password: 'Ur94w4NVdhcpJJUPCnFj'
    });
    console.log('Connected!');

    const command = 'cd /var/www/proquelec/gem-saas && git fetch --all && git reset --hard origin/main && npm install --no-scripts --legacy-peer-deps && cd frontend && npm install --no-scripts --legacy-peer-deps && npx vite build && cd ../backend && npm install --no-scripts --legacy-peer-deps && npx pm2 restart all';
    
    console.log('Executing deployment commands...');
    const result = await ssh.execCommand(command, {
      onStdout(chunk) {
        process.stdout.write(chunk.toString('utf8'));
      },
      onStderr(chunk) {
        process.stderr.write(chunk.toString('utf8'));
      }
    });

    console.log('Command finished with code', result.code);
    ssh.dispose();
  } catch (error) {
    console.error('Error during deployment:', error);
    ssh.dispose();
  }
}

deploy();
