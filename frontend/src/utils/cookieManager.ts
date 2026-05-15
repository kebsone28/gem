/**
 * 🔒 Cookie Manager - Gestion sécurisée des cookies pour les tokens d'authentification
 * 
 * NOTE IMPORTANTE: Les cookies HttpOnly ne peuvent être définis que par le serveur.
 * Ce service fournit une interface pour gérer les cookies côté client et documente
 * l'implémentation nécessaire côté serveur.
 * 
 * Pour une implémentation complète avec cookies HttpOnly:
 * 1. Le serveur doit définir les cookies avec les flags HttpOnly, Secure, SameSite
 * 2. Le client doit utiliser les cookies automatiquement via les requêtes HTTP
 * 3. Ce service peut être utilisé pour les cookies non-sensibles ou comme fallback
 */

import logger from './logger';

interface CookieOptions {
  maxAge?: number; // Durée en secondes
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean; // Note: httpOnly ne peut être défini que par le serveur
  sameSite?: 'strict' | 'lax' | 'none';
}

/**
 * Définit un cookie
 * NOTE: Le flag httpOnly sera ignoré si défini côté client
 */
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  try {
    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

    if (options.maxAge) {
      cookieString += `; Max-Age=${options.maxAge}`;
    }

    if (options.expires) {
      cookieString += `; Expires=${options.expires.toUTCString()}`;
    }

    if (options.path) {
      cookieString += `; Path=${options.path}`;
    }

    if (options.domain) {
      cookieString += `; Domain=${options.domain}`;
    }

    if (options.secure) {
      cookieString += '; Secure';
    }

    if (options.httpOnly) {
      // NOTE: httpOnly sera ignoré côté client
      logger.warn('[CookieManager] httpOnly flag can only be set by server, will be ignored');
      // cookieString += '; HttpOnly'; // Commenté car ignoré par document.cookie
    }

    if (options.sameSite) {
      cookieString += `; SameSite=${options.sameSite}`;
    }

    document.cookie = cookieString;
    logger.info(`[CookieManager] Cookie "${name}" set`);
  } catch (error) {
    logger.error('[CookieManager] Error setting cookie:', error);
  }
}

/**
 * Récupère un cookie
 */
export function getCookie(name: string): string | null {
  try {
    const nameEQ = `${encodeURIComponent(name)}=`;
    const cookies = document.cookie.split(';');

    for (let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i].trim();
      if (cookie.startsWith(nameEQ)) {
        return decodeURIComponent(cookie.substring(nameEQ.length));
      }
    }

    return null;
  } catch (error) {
    logger.error('[CookieManager] Error getting cookie:', error);
    return null;
  }
}

/**
 * Supprime un cookie
 */
export function deleteCookie(name: string, options: Pick<CookieOptions, 'path' | 'domain'> = {}): void {
  try {
    setCookie(name, '', { ...options, maxAge: -1 });
    logger.info(`[CookieManager] Cookie "${name}" deleted`);
  } catch (error) {
    logger.error('[CookieManager] Error deleting cookie:', error);
  }
}

/**
 * Vérifie si un cookie existe
 */
export function hasCookie(name: string): boolean {
  return getCookie(name) !== null;
}

/**
 * Service de gestion des tokens d'authentification avec cookies
 */
export const tokenCookieService = {
  /**
   * Stocke le token d'accès dans un cookie sécurisé
   * NOTE: Pour une vraie sécurité, utilisez des cookies HttpOnly définis par le serveur
   */
  setAccessToken(token: string): void {
    setCookie('access_token', token, {
      maxAge: 60 * 60 * 24 * 7, // 7 jours
      path: '/',
      secure: window.location.protocol === 'https:',
      sameSite: 'strict',
    });
  },

  /**
   * Récupère le token d'accès
   */
  getAccessToken(): string | null {
    return getCookie('access_token');
  },

  /**
   * Stocke le token de rafraîchissement
   */
  setRefreshToken(token: string): void {
    setCookie('refresh_token', token, {
      maxAge: 60 * 60 * 24 * 30, // 30 jours
      path: '/',
      secure: window.location.protocol === 'https:',
      sameSite: 'strict',
    });
  },

  /**
   * Récupère le token de rafraîchissement
   */
  getRefreshToken(): string | null {
    return getCookie('refresh_token');
  },

  /**
   * Supprime tous les tokens
   */
  clearTokens(): void {
    deleteCookie('access_token', { path: '/' });
    deleteCookie('refresh_token', { path: '/' });
    logger.info('[CookieManager] All tokens cleared');
  },
};

/**
 * Documentation pour l'implémentation côté serveur des cookies HttpOnly
 * 
 * Pour une implémentation complète avec cookies HttpOnly:
 * 
 * 1. Configuration côté serveur (Node.js/Express exemple):
 * ```javascript
 * res.cookie('access_token', token, {
 *   httpOnly: true,      // Non accessible via JavaScript
 *   secure: true,        // Uniquement en HTTPS
 *   sameSite: 'strict',  // Protection CSRF
 *   maxAge: 60 * 60 * 24 * 7, // 7 jours
 *   path: '/'
 * });
 * ```
 * 
 * 2. Configuration côté serveur (Django exemple):
 * ```python
 * response.set_cookie(
 *     'access_token',
 *     token,
 *     httponly=True,
 *     secure=True,
 *     samesite='Strict',
 *     max_age=60 * 60 * 24 * 7,
 *     path='/'
 * )
 * ```
 * 
 * 3. Avantages des cookies HttpOnly:
 * - Protection contre XSS (Cross-Site Scripting)
 * - Les cookies sont automatiquement envoyés avec chaque requête
 * - Pas besoin de gérer manuellement l'en-tête Authorization
 * 
 * 4. Migration depuis localStorage:
 * - Le serveur doit être mis à jour pour définir les cookies
 * - Le client doit être mis à jour pour utiliser les cookies automatiquement
 * - Utiliser ce service comme fallback pendant la transition
 */
