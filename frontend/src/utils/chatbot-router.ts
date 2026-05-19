/**
 * Chatbot Router - Intelligent keyword-based routing logic
 * Detects if a user message contains private data keywords
 * Routes to Ollama (secure backend) or Puter.js (public cloud)
 */

// Liste des mots-clés déclencheurs pour données sensibles/privées
const OLLAMA_KEYWORDS = [
  // Données métiers
  'foyer',
  'household',
  'consommation',
  'consumption',
  'facture',
  'bill',
  'solde',
  'balance',

  // Système & Technique
  'projet',
  'project',
  'mission',
  'prisma',
  'database',
  'schema',

  // Configuration & Droits
  'paramètre',
  'parameter',
  'configuration',
  'setting',
  'utilisateur',
  'user',
  'permission',
  'rôle',
  'role',
];

/**
 * Analyse le message de l'utilisateur pour déterminer le routage.
 * @param message Chaîne saisie par l'utilisateur
 * @returns true si la requête contient un mot-clé privé (Ollama), false sinon (Puter)
 */
export const shouldRouteToOllama = (message: string): boolean => {
  if (!message) return false;

  // Normalisation : retrait de la ponctuation et passage en minuscules
  const normalizedMessage = message
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ')
    .trim();

  // Découpage par mots pour éviter les faux positifs (ex: "solide" ne doit pas matcher "solde")
  const words = normalizedMessage.split(/\s+/);

  // Vérification de présence
  return words.some((word) => OLLAMA_KEYWORDS.includes(word));
};
