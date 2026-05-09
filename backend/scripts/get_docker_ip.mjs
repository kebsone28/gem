import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

async function getDockerIP() {
  await ssh.connect({
    host: 'gem.proquelec.sn',
    username: 'root',
    password: 'Ur94w4NVdhcpJJUPCnFj',
  });
  
  const result = await ssh.execCommand('ip addr show docker0');
  console.log(result.stdout);
  
  ssh.dispose();
}

getDockerIP();
