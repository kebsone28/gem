/**
 * 🧩 AI Normalizers - Fonctions de normalisation standardisées
 * Centralise toutes les fonctions de normalisation de texte utilisées dans le système AI
 */

/**
 * Normalise le texte pour comparaison (insensible aux accents, casse, espaces)
 */
export function normalizeComparableText(value = ''): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalise une question pour matching (insensible aux accents, casse, caractères spéciaux)
 */
export function normalizeQuestion(value = ''): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalise le texte pour affichage (préserve la casse mais retire les accents)
 */
export function normalizeForDisplay(value = ''): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Convertit un texte en lignes comparables (vide et null-safe)
 */
export function toComparableLines(value = ''): string[] {
  return String(value || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Normalise un token premium (pour parsing AIPremiumMessage)
 */
export function normalizePremiumToken(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Nettoie le texte pour la synthèse vocale (retire emojis et caractères spéciaux)
 */
export function normalizeForSpeech(value = ''): string {
  return String(value || '')
    .replace(/[\u{1F600}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|\*/gu, '')
    .trim();
}

/**
 * Normalise un identifiant (minuscules, tirets, sans caractères spéciaux)
 */
export function normalizeId(value = ''): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Tronque un texte avec ellipsis si nécessaire
 */
export function truncateText(value = '', maxLength = 100): string {
  const text = String(value || '');
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}
