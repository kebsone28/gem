import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

async function check() {
  await ssh.connect({
    host: 'gem.proquelec.sn',
    username: 'root',
    password: process.env.VPS_SSH_PASSWORD,
  });
  
  console.log('🔍 Vérification de la page Open WebUI sur le port 3000...');
  // On récupère le HTML de la page de login
  const result = await ssh.execCommand('curl -s http://localhost:8080'); // Attends, WebUI est sur 8080 INTERNE du conteneur, mais mappé sur 3000 externe.
  // Mais si je curl depuis le VPS, je dois curl le port mappé 3000.
  const result2 = await ssh.execCommand('curl -s http://localhost:3000');
  
  if (result2.stdout.includes('Sign up') || result2.stdout.includes('register') || result2.stdout.includes('S\'inscrire')) {
    console.log('✅ Le lien d\'inscription a été détecté dans le code source !');
  } else {
    console.log('❌ Le lien d\'inscription n\'est pas visible dans le code source.');
    // Affichons un peu de HTML pour voir
    console.log('Aperçu du HTML:', result2.stdout.substring(0, 500));
  }
  
  ssh.dispose();
}

check();
