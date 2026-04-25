import { NodeSSH } from 'node-ssh';
import {
  buildWanekooRestartCommand,
  validateWanekooSshConfig,
} from './src/core/config/serverDeploy.config.js';

const ssh = new NodeSSH();

async function restart() {
  try {
    const { host, username, password, privateKey, deployPath } = validateWanekooSshConfig();
    console.log('Connecting to VPS to restart...');
    await ssh.connect({
      host,
      username,
      ...(privateKey ? { privateKey } : { password }),
    });
    console.log('Connected! Restarting PM2...');

    const result = await ssh.execCommand(buildWanekooRestartCommand(deployPath), {
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
