import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

async function deploy() {
  try {
    await ssh.connect({
      host: 'gem.proquelec.sn',
      username: 'root',
      password: 'Ur94w4NVdhcpJJUPCnFj',
    });
    
    console.log('🔗 Connecté au VPS. Début du déploiement...');
    
    const projectDir = '/var/www/proquelec/gem-saas';
    
    // 1. Git Pull
    console.log('📥 Récupération du code corrigé depuis GitHub...');
    const pullResult = await ssh.execCommand('git pull', { cwd: projectDir });
    console.log(pullResult.stdout || pullResult.stderr);
    
    // 2. npm install backend
    console.log('📦 Mise à jour des dépendances backend...');
    await ssh.execCommand('npm install', { cwd: `${projectDir}/backend` });
    
    // 3. Restart PM2
    console.log('🔄 Redémarrage des services PM2...');
    const pm2Result = await ssh.execCommand('pm2 restart all');
    console.log(pm2Result.stdout);
    
    console.log('🎉 Déploiement terminé avec succès !');
    ssh.dispose();
  } catch (err) {
    console.error('🔥 Erreur lors du déploiement:', err.message);
  }
}

deploy();
