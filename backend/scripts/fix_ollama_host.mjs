import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

async function fixOllamaHost() {
  await ssh.connect({
    host: 'gem.proquelec.sn',
    username: 'root',
    password: 'Ur94w4NVdhcpJJUPCnFj',
  });
  
  console.log('🔧 Configuration de Ollama pour acceptation des connexions distantes...');
  
  // On crée un fichier d'override pour le service systemd d'Ollama
  const commands = [
    'mkdir -p /etc/systemd/system/ollama.service.d',
    'echo "[Service]\nEnvironment=\"OLLAMA_HOST=0.0.0.0\"" > /etc/systemd/system/ollama.service.d/override.conf',
    'systemctl daemon-reload',
    'systemctl restart ollama'
  ];

  for (const cmd of commands) {
    console.log(`Executing: ${cmd}`);
    const r = await ssh.execCommand(cmd);
    console.log(r.stdout || r.stderr);
  }
  
  // Vérification finale
  const check = await ssh.execCommand('netstat -tuln | grep 11434');
  console.log('Nouveau statut netstat:', check.stdout);
  
  ssh.dispose();
}

fixOllamaHost();
