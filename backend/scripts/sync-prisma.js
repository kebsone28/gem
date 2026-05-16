/**
 * Script de synchronisation automatique du schéma Prisma
 * 
 * Ce script automatise:
 * 1. La validation du schéma (via validate-prisma-schema.js)
 * 2. La génération du client Prisma
 * 3. La synchronisation de la base de données
 * 4. Le redémarrage du serveur (optionnel)
 * 
 * Usage: 
 *   node scripts/sync-prisma.js           # Mode interactif
 *   node scripts/sync-prisma.js --check   # Vérification seule
 *   node scripts/sync-prisma.js --push    # Push seul
 *   node scripts/sync-prisma.js --full    # Validation + generate + push
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');

const args = process.argv.slice(2);
const mode = args[0] || '--interactive';

/**
 * Affiche un message formaté
 */
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warning: '\x1b[33m',
    error: '\x1b[31m',
    step: '\x1b[35m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}[${type.toUpperCase()}]${colors.reset} ${message}`);
}

/**
 * Exécute une commande et affiche le résultat
 */
function runCommand(command, options = {}) {
  const { cwd = ROOT_DIR, showOutput = true, failOnError = true } = options;
  
  log(`Exécution: ${command}`, 'step');
  
  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: showOutput ? 'inherit' : 'pipe',
      timeout: 120000
    });
    
    if (showOutput) {
      log('Succès', 'success');
    }
    return { success: true, output };
  } catch (error) {
    if (failOnError) {
      log(`Erreur: ${error.message}`, 'error');
      process.exit(1);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Vérifie que le schéma Prisma existe
 */
function checkSchema() {
  const schemaPath = join(ROOT_DIR, 'prisma', 'schema.prisma');
  if (!existsSync(schemaPath)) {
    log('Schema Prisma non trouvé!', 'error');
    process.exit(1);
  }
  log('Schema Prisma trouvé', 'success');
}

/**
 * Étape 1: Validation du schéma
 */
async function validateSchema() {
  console.log('\n' + '='.repeat(50));
  log('ÉTAPE 1: Validation du schéma Prisma', 'step');
  console.log('='.repeat(50));
  
  const validateScript = join(ROOT_DIR, 'scripts', 'validate-prisma-schema.js');
  
  if (existsSync(validateScript)) {
    runCommand(`node "${validateScript}"`, { showOutput: true });
  } else {
    log('Script de validation non trouvé, passage à la suite', 'warning');
  }
}

/**
 * Étape 2: Génération du client Prisma
 */
function generateClient() {
  console.log('\n' + '='.repeat(50));
  log('ÉTAPE 2: Génération du client Prisma', 'step');
  console.log('='.repeat(50));
  
  runCommand('npx prisma generate --schema=prisma/schema.prisma');
}

/**
 * Étape 3: Synchronisation de la base de données
 */
function pushSchema() {
  console.log('\n' + '='.repeat(50));
  log('ÉTAPE 3: Synchronisation de la base de données', 'step');
  console.log('='.repeat(50));
  
  // Mode non-interactif pour éviter les demandes de confirmation
  runCommand('npx prisma db push --schema=prisma/schema.prisma --skip-generate');
}

/**
 * Mode interactif: demande confirmation pour chaque étape
 */
async function interactiveMode() {
  log('Mode interactif', 'info');
  
  // Validation
  const validate = await askQuestion('Voulez-vous valider le schéma? (O/n): ');
  if (validate.toLowerCase() !== 'n') {
    await validateSchema();
  }
  
  // Generate
  const generate = await askQuestion('Voulez-vous générer le client Prisma? (O/n): ');
  if (generate.toLowerCase() !== 'n') {
    generateClient();
  }
  
  // Push
  const push = await askQuestion('Voulez-vous synchroniser la base de données? (O/n): ');
  if (push.toLowerCase() !== 'n') {
    pushSchema();
  }
  
  log('Synchronisation terminée!', 'success');
}

/**
 * Demande une question à l'utilisateur
 */
function askQuestion(question) {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question(question, (answer) => {
      readline.close();
      resolve(answer || 'O');
    });
  });
}

/**
 * Point d'entrée principal
 */
async function main() {
  console.log('\n🔄 Script de synchronisation Prisma');
  console.log('=====================================\n');
  
  checkSchema();
  
  switch (mode) {
    case '--check':
      // Vérification seule
      await validateSchema();
      break;
      
    case '--generate':
      // Génération seule
      generateClient();
      break;
      
    case '--push':
      // Push seul
      pushSchema();
      break;
      
    case '--full':
      // Validation + generate + push
      await validateSchema();
      generateClient();
      pushSchema();
      log('Synchronisation complète terminée!', 'success');
      break;
      
    case '--interactive':
    default:
      // Mode interactif
      await interactiveMode();
      break;
  }
  
  console.log('\n📋 Résumé des commandes utiles:');
  console.log('  npm run prisma:validate   # Valider le schéma');
  console.log('  npm run prisma:generate   # Générer le client');
  console.log('  npm run prisma:push       # Synchroniser la DB');
  console.log('  npm run prisma:sync       # Synchronisation complète\n');
}

main().catch(err => {
  log(`Erreur: ${err.message}`, 'error');
  process.exit(1);
});