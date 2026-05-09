/**
 * ✅ AI Validators - Fonctions de validation standardisées
 * Centralise toutes les fonctions de validation utilisées dans le système AI
 */

/**
 * Valide qu'une question n'est pas vide
 */
export function isValidQuestion(question?: string): boolean {
  return Boolean(question && question.trim().length > 3);
}

/**
 * Valide qu'une réponse n'est pas vide
 */
export function isValidAnswer(answer?: string): boolean {
  return Boolean(answer && answer.trim().length > 10);
}

/**
 * Valide un email
 */
export function isValidEmail(email?: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valide qu'un mode IA est supporté
 */
export type AIEngineMode = 'RULES_ONLY' | 'CLAUDE_ONLY' | 'HYBRID_RULES_FIRST' | 'HYBRID_AI_FIRST';

export function isValidAIMode(mode: string): mode is AIEngineMode {
  return ['RULES_ONLY', 'CLAUDE_ONLY', 'HYBRID_RULES_FIRST', 'HYBRID_AI_FIRST'].includes(mode);
}

/**
 * Valide qu'une URL d'image est en base64 valide
 */
export function isValidBase64Image(data?: string): boolean {
  if (!data) return false;
  const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/i;
  return base64Regex.test(data);
}

/**
 * Valide qu'un texte est safe pour la synthèse vocale
 */
export function isSafeForSpeech(text?: string): boolean {
  if (!text) return false;
  // Vérifie que le texte ne contient pas trop de caractères spéciaux
  const specialCharCount = (text.match(/[^\w\sàâäéèêëïîôùûüÿç]/gi) || []).length;
  return specialCharCount < text.length * 0.3;
}

/**
 * Valide qu'un verdict est supporté
 */
export type VerdictType = 'Conforme' | 'Conforme sous réserve' | 'Non conforme' | 'A verifier';

export function isValidVerdict(verdict?: string): verdict is VerdictType {
  return ['Conforme', 'Conforme sous réserve', 'Non conforme', 'A verifier'].includes(verdict || '');
}

/**
 * Valide qu'une sévérité est supportée
 */
export type SeverityType = 'critique' | 'majeure' | 'mineure' | 'information';

export function isValidSeverity(severity?: string): severity is SeverityType {
  return ['critique', 'majeure', 'mineure', 'information'].includes(severity || '');
}

/**
 * Valide qu'un ID de projet est valide
 */
export function isValidProjectId(projectId?: string): boolean {
  if (!projectId) return false;
  // Format attendu: UUID ou ID alphanumérique de 8+ caractères
  return projectId.trim().length >= 8;
}

/**
 * Valide qu'un lifecycle status est supporté
 */
export type LifecycleStatus = 'active' | 'closed' | 'accepted';

export function isValidLifecycleStatus(status?: string): status is LifecycleStatus {
  return ['active', 'closed', 'accepted'].includes(status || '');
}
