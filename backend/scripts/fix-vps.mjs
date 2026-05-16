import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

async function fixVps() {
  console.log('Connexion au VPS...');
  await ssh.connect({
    host: 'ged.proquelec.sn',
    username: 'root',
    password: process.env.VPS_SSH_PASSWORD,
  });
  
  console.log('✅ Connecté. Exécution des correctifs...');
  
  const commands = [
    // 1. Remplacer les certificats temporairement pour démarrer Nginx
    "sed -i 's/live\\/ged\\.proquelec\\.sn/live\\/gem.proquelec.sn/g' /etc/nginx/sites-available/ged.proquelec.sn",
    "nginx -t",
    "systemctl restart nginx",
    
    // 2. Lancer certbot pour récupérer le nouveau certificat
    // --non-interactive évite qu'il pose des questions
    // --redirect force HTTPS (facultatif mais recommandé)
    "certbot --nginx -d ged.proquelec.sn --non-interactive --agree-tos -m contact@proquelec.sn --redirect",
    
    // 3. Relancer PM2
    "pm2 delete gem-backend || true",
    "cd /var/www/proquelec/ged.proquelec.sn/backend && npm install --omit=dev && pm2 start npm --name 'gem-backend' -- run start",
    "pm2 save"
  ];

  for (const cmd of commands) {
    console.log(`\n> ${cmd}`);
    const r = await ssh.execCommand(cmd);
    if (r.stdout) console.log(r.stdout);
    if (r.stderr) console.error('Erreur/Info: ', r.stderr);
  }
  
  console.log('\n🎉 Tout est réparé et relancé avec succès sur ged.proquelec.sn !');
  ssh.dispose();
}

fixVps().catch(console.error);
