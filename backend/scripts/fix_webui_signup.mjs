import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

async function run() {
  try {
    console.log('🔗 Connexion SSH à gem.proquelec.sn...');
    
    // On tente les deux variantes de mot de passe signalées
    let connected = false;
    const passwords = [process.env.VPS_SSH_PASSWORD, 'Ur94w4NVdhcpJJUPCnj'];
    
    for (const pwd of passwords) {
      try {
        await ssh.connect({
          host: 'gem.proquelec.sn',
          username: 'root',
          password: pwd,
        });
        connected = true;
        console.log('✅ Connecté avec succès !');
        break;
      } catch (e) {
        console.log(`❌ Échec avec le mot de passe ${pwd.substring(0,5)}...`);
      }
    }

    if (!connected) throw new Error('Impossible de se connecter au VPS.');

    console.log('🚀 Reconfiguration de Open WebUI (Activation Inscription)...');
    
    const command = 'docker stop open-webui && docker rm open-webui && docker run -d -p 3000:8080 -e ENABLE_SIGNUP=True --add-host=host.docker.internal:host-gateway -v open-webui:/app/backend/data --name open-webui ghcr.io/open-webui/open-webui:main';
    
    const result = await ssh.execCommand(command);
    
    console.log('STDOUT: ' + result.stdout);
    console.log('STDERR: ' + result.stderr);
    
    if (result.code === 0) {
      console.log('🎉 Opération réussie ! Le bouton d\'inscription devrait être visible sous peu.');
    } else {
      console.log('⚠️ Une erreur est survenue lors de l\'exécution de la commande.');
    }

    ssh.dispose();
  } catch (err) {
    console.error('🔥 ERREUR FATALE:', err.message);
    process.exit(1);
  }
}

run();
