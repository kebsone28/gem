import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

async function configureWithStaticIP() {
  await ssh.connect({
    host: 'gem.proquelec.sn',
    username: 'root',
    password: 'Ur94w4NVdhcpJJUPCnFj',
  });
  
  console.log('🔌 Configuration de la connexion Ollama avec IP statique 172.17.0.1...');
  
  const commands = [
    'docker stop open-webui',
    'docker rm open-webui',
    // On utilise l'IP directe du pont Docker
    'docker run -d -p 3000:8080 -e ENABLE_SIGNUP=True -e OLLAMA_BASE_URL=http://172.17.0.1:11434 -v open-webui:/app/backend/data --name open-webui ghcr.io/open-webui/open-webui:main'
  ];

  for (const cmd of commands) {
    console.log(`Executing: ${cmd}`);
    const r = await ssh.execCommand(cmd);
    console.log(r.stdout || r.stderr);
  }
  
  console.log('✅ Reconfiguration terminée avec IP statique !');
  ssh.dispose();
}

configureWithStaticIP();
