import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

async function wipeAndReinstall() {
  await ssh.connect({
    host: 'gem.proquelec.sn',
    username: 'root',
    password: 'Ur94w4NVdhcpJJUPCnFj',
  });
  
  console.log('🧹 Nettoyage complet de Open WebUI...');
  
  const commands = [
    'docker stop open-webui',
    'docker rm open-webui',
    'docker volume rm open-webui', // On efface les données corrompues
    'docker run -d -p 3000:8080 -e ENABLE_SIGNUP=True --add-host=host.docker.internal:host-gateway -v open-webui:/app/backend/data --name open-webui ghcr.io/open-webui/open-webui:main'
  ];

  for (const cmd of commands) {
    console.log(`Executing: ${cmd}`);
    const r = await ssh.execCommand(cmd);
    console.log(r.stdout || r.stderr);
  }
  
  console.log('✅ Réinstallation terminée avec succès !');
  ssh.dispose();
}

wipeAndReinstall();
