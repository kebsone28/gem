 
import { db } from '../store/db';

// Valeurs par défaut (actives lors de la première utilisation, avant toute configuration)
const DEFAULTS: Record<string, string> = {
  projectDeletePassword: 'admin2026',
  adminPassword: 'admin2026',
  securityQuestion: 'Quelle est la ville de naissance du fondateur de PROQUELEC ?',
  securityAnswer: 'dakar',
  recoveryCode: '', // généré à la demande
};

async function getSecurity(key: string): Promise<string> {
  const row = await db.app_security.get(key);
  return row?.value ?? DEFAULTS[key] ?? '';
}

async function setSecurity(key: string, value: string): Promise<void> {
  await db.app_security.put({ key, value, updatedAt: new Date().toISOString() });
}

/** Vérifie un mot de passe ou une réponse de sécurité (insensible à la casse pour les réponses) */
async function checkSecurity(
  key: string,
  input: string,
  caseInsensitive = false
): Promise<boolean> {
  const stored = await getSecurity(key);
  return caseInsensitive
    ? stored.trim().toLowerCase() === input.trim().toLowerCase()
    : stored === input.trim();
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

export const appSecurity = {
  get: getSecurity,
  set: setSecurity,
  check: checkSecurity,
  generateRecoveryCode,
  DEFAULTS,
};
