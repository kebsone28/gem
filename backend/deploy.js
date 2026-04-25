import { NodeSSH } from 'node-ssh';
import {
  buildWanekooDeployCommand,
  validateWanekooSshConfig,
} from './src/core/config/serverDeploy.config.js';

const ssh = new NodeSSH();

async function deploy() {
  try {
    const { host, username, password, privateKey, deployPath } = validateWanekooSshConfig();
    console.log('Connecting to VPS...');
    await ssh.connect({
      host,
      username,
      ...(privateKey ? { privateKey } : { password }),
    });
    console.log('Connected!');

    const command = buildWanekooDeployCommand(deployPath);
    
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
