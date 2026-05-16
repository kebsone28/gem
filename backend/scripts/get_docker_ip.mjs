import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

async function getDockerIP() {
  await ssh.connect({
    host: 'gem.proquelec.sn',
    username: 'root',
    password: process.env.VPS_SSH_PASSWORD,
  });
  
  const result = await ssh.execCommand('ip addr show docker0');
  console.log(result.stdout);
  
  ssh.dispose();
}

getDockerIP();
