export const ERROR_MESSAGES = {
  credit_balance: "Le service IA n'a plus de crédits disponibles. Contactez l'administrateur.",
  api_key: 'La clé API est invalide. Vérifiez la configuration dans le panneau Admin.',
  network: 'Impossible de joindre le service IA. Vérifiez la connexion réseau.',
  timeout: 'Le service IA a mis trop longtemps à répondre. Réessayez dans quelques secondes.',
  default: "Le service IA n'est pas disponible pour le moment. Le mode local prend le relais.",
} as const;

export type MissionSageErrorKind = keyof typeof ERROR_MESSAGES;

export function classifyError(err: unknown): MissionSageErrorKind {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('credit balance') || msg.includes('insufficient_quota')) return 'credit_balance';
  if (msg.includes('API key') || msg.includes('401') || msg.includes('Unauthorized')) return 'api_key';
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('AbortError')) return 'timeout';
  if (msg.includes('ENOTFOUND') || msg.includes('network') || msg.includes('fetch')) return 'network';
  return 'default';
}
