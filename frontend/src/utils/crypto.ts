 
/**
 * SERVICE : Cryptography & Integrity
 * Fournit des outils pour garantir que les données n'ont pas été altérées après signature.
 */

/**
 * Génère un hash simple (SHA-256 via Web Crypto API) pour un objet de données.
 */
export async function generateIntegrityHash(data: unknown): Promise<string> {
  const cleanData = JSON.parse(JSON.stringify(data || {}));
  const msgUint8 = new TextEncoder().encode(JSON.stringify(cleanData));
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Vérifie si le hash fourni correspond aux données actuelles.
 */
export async function verifyIntegrity(data: unknown, originalHash: string): Promise<boolean> {
  if (!originalHash) return false;
  const currentHash = await generateIntegrityHash(data);
  return currentHash === originalHash;
}
