import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

async function configureWithOllama() {
  await ssh.connect({
    host: 'gem.proquelec.sn',
    username: 'root',
    password: process.env.VPS_SSH_PASSWORD,
  });
  
  console.log('🔌 Configuration automatique de la connexion Ollama...');
  
  const commands = [
    'docker stop open-webui',
    'docker rm open-webui',
    // On ajoute OLLAMA_BASE_URL pour que la connexion soit pré-configurée
    'docker run -d -p 3000:8080 -e ENABLE_SIGNUP=True -e OLLAMA_BASE_URL=http://host.docker.internal:11434 --add-host=host.docker.internal:host-gateway -v open-webui:/app/backend/data --name open-webui ghcr.io/open-webui/open-webui:main'
  ];

  for (const cmd of commands) {
    console.log(`Executing: ${cmd}`);
    const r = await ssh.execCommand(cmd);
    console.log(r.stdout || r.stderr);
  }
  
  console.log('✅ Configuration terminée ! Les modèles devraient être détectés automatiquement.');
  ssh.dispose();
}

configureWithOllama();
