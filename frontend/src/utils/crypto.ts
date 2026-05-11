 
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

// --- AES-GCM Encryption for sensitive local data ---

const ENCRYPTION_ALGO = 'AES-GCM';
const KEY_USAGES: KeyUsage[] = ['encrypt', 'decrypt'];

/**
 * Dérive une clé de chiffrement à partir d'une chaîne (ex: userId ou secret partagé)
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('gem-saas-salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ENCRYPTION_ALGO, length: 256 },
    false,
    KEY_USAGES
  );
}

/**
 * Chiffre une chaîne de caractères
 */
export async function encryptData(data: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(data);
  const encrypted = await crypto.subtle.encrypt(
    { name: ENCRYPTION_ALGO, iv },
    key,
    encodedData
  );

  // Combine IV + Encrypted Data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // Return as Base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Déchiffre une chaîne de caractères
 */
export async function decryptData(encryptedBase64: string, secret: string): Promise<string | null> {
  try {
    const key = await deriveKey(secret);
    const combined = new Uint8Array(
      atob(encryptedBase64).split('').map(c => c.charCodeAt(0))
    );
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: ENCRYPTION_ALGO, iv },
      key,
      data
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('[CRYPTO] Decryption failed:', err);
    return null;
  }
}
