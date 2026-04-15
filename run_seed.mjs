import { execSync } from 'child_process';

try {
  console.log('🚀 Exécution du seed admin...');
  const result = execSync('cd backend && node seed_admin.js', {
    encoding: 'utf8',
    cwd: process.cwd()
  });
  console.log('✅ Seed terminé:', result);
} catch (error) {
  console.error('❌ Erreur seed:', error.message);
}