 
import { db } from '../store/db';

// ⚠️ IMPORTANT: Les mots de passe par défaut ne sont plus codés en dur pour des raisons de sécurité
// Les valeurs doivent être configurées via l'interface d'administration ou les variables d'environnement
const DEFAULTS: Record<string, string> = {
  projectDeletePassword: '', // Doit être configuré via l'admin
  adminPassword: '', // Doit être configuré via l'admin
  securityQuestion: '', // Doit être configuré via l'admin
  securityAnswer: '', // Doit être configuré via l'admin
  recoveryCode: '', // généré à la demande
};

async function getSecurity(key: string): Promise<string> {
  const row = await db.app_security.get(key);
  return row?.value ?? DEFAULTS[key] ?? '';
}

async function setSecurity(key: string, value: string): Promise<void> {
  await db.app_security.put({ key, value, updatedAt: new Date().toISOString() });
}

/** Vérifie un mot de passe ou une réponse de sécurité */
async function checkSecurity(
  key: string,
  input: string,
  caseInsensitive = false
): Promise<boolean> {
  const stored = await getSecurity(key);
  const trimmedInput = input.trim();
  const trimmedStored = stored.trim();

  // Pour les mots de passe, toujours sensible à la casse
  if (key.includes('Password') || key.includes('password')) {
    return trimmedStored === trimmedInput && trimmedStored.length > 0;
  }

  // Pour les réponses de sécurité, insensible à la casse (optionnel)
  if (caseInsensitive) {
    return trimmedStored.toLowerCase() === trimmedInput.toLowerCase() && trimmedStored.length > 0;
  }

  return trimmedStored === trimmedInput && trimmedStored.length > 0;
}

/** Génère un code de récupération unique et l'enregistre */
async function generateRecoveryCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = Array.from(
    { length: 16 },
    (_, i) => (i > 0 && i % 4 === 0 ? '-' : '') + chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  await setSecurity('recoveryCode', code);
  return code;
}

/** Vérifie si la sécurité est configurée (mots de passe définis) */
async function isSecurityConfigured(): Promise<boolean> {
  const adminPassword = await getSecurity('adminPassword');
  const projectDeletePassword = await getSecurity('projectDeletePassword');
  const securityQuestion = await getSecurity('securityQuestion');
  const securityAnswer = await getSecurity('securityAnswer');

  return (
    adminPassword.length > 0 &&
    projectDeletePassword.length > 0 &&
    securityQuestion.length > 0 &&
    securityAnswer.length > 0
  );
}

/** Force la configuration initiale de la sécurité */
async function requireInitialSetup(): Promise<boolean> {
  return !(await isSecurityConfigured());
}

export const appSecurity = {
  get: getSecurity,
  set: setSecurity,
  check: checkSecurity,
  generateRecoveryCode,
  isConfigured: isSecurityConfigured,
  requireInitialSetup,
  DEFAULTS,
};
