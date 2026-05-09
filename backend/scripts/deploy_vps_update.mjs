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
    console.log('📥 Récupération du code depuis GitHub...');
    const pullResult = await ssh.execCommand('git pull origin main', { cwd: projectDir });
    console.log(pullResult.stdout || pullResult.stderr);
    
    // 2. npm install backend
    console.log('📦 Mise à jour des dépendances backend...');
    const backendInstall = await ssh.execCommand('npm install', { cwd: `${projectDir}/backend` });
    if (backendInstall.stderr) console.warn('Backend install:', backendInstall.stderr.slice(0, 300));

    // 3. Build frontend
    console.log('🏗️ Compilation du frontend (React/Vite)...');
    const buildResult = await ssh.execCommand('npm install && npm run build', { 
      cwd: `${projectDir}/frontend`,
      options: { env: { NODE_ENV: 'production' } }
    });
    if (buildResult.stderr && !buildResult.stderr.includes('warn')) {
      console.warn('Frontend build warnings:', buildResult.stderr.slice(0, 500));
    }
    console.log(buildResult.stdout?.slice(-300) || 'Build terminé.');
    
    // 4. Restart PM2
    console.log('🔄 Redémarrage des services PM2...');
    const pm2Result = await ssh.execCommand('pm2 restart all');
    console.log(pm2Result.stdout);
    
    console.log('🎉 Déploiement terminé avec succès !');
    ssh.dispose();
  } catch (err) {
    console.error('🔥 Erreur lors du déploiement:', err.message);
    process.exit(1);
  }
}

deploy();
