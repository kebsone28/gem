/**
 * Service de sanitization des données utilisateur
 * Protection contre les attaques XSS
 * Utilise DOMPurify pour nettoyer les inputs
 */

/**
 * Sanitize du texte brut (pas de HTML autorisé)
 * @param {string} text - Texte à sanitizer
 * @returns {string} Texte nettoyé
 */
function sanitize(text) {
    if (!text) return '';

    // Si DOMPurify est chargé, l'utiliser
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(text, {
            ALLOWED_TAGS: [], // Aucune balise HTML autorisée
            ALLOWED_ATTR: []  // Aucun attribut autorisé
        });
    }

    // Fallback : échappement manuel basique
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Sanitize du HTML (autorise certaines balises sécurisées)
 * @param {string} html - HTML à sanitizer
 * @returns {string} HTML nettoyé
 */
function sanitizeHTML(html) {
    if (!html) return '';

    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'span'],
            ALLOWED_ATTR: ['class']
        });
    }

    // Fallback : retirer toutes les balises HTML
    return sanitize(html);
}

/**
 * Sanitize un objet entier (tous ses champs de type string)
 * @param {Object} obj - Objet à sanitizer
 * @param {Array<string>} fields - Champs à sanitizer (optionnel, sinon tous)
 * @returns {Object} Objet avec champs nettoyés
 */
function sanitizeObject(obj, fields = null) {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized = { ...obj };
    const fieldsToSanitize = fields || Object.keys(sanitized);

    fieldsToSanitize.forEach(field => {
        if (typeof sanitized[field] === 'string') {
            sanitized[field] = sanitize(sanitized[field]);
        }
    });

    return sanitized;
}

/**
 * Sanitize les données d'un ménage importé
 * @param {Object} household - Données du ménage
 * @returns {Object} Données nettoyées
 */
function sanitizeHouseholdData(household) {
    return {
        ...household,
        nom_prenom_chef: sanitize(household.nom_prenom_chef),
        quartier_village: sanitize(household.quartier_village),
        commune: sanitize(household.commune),
        telephone: sanitize(household.telephone),
        remarques: sanitize(household.remarques),
        adresse: sanitize(household.adresse)
    };
}

// Export pour utilisation dans le code
if (typeof window !== 'undefined') {
    window.sanitize = sanitize;
    window.sanitizeHTML = sanitizeHTML;
    window.sanitizeObject = sanitizeObject;
    window.sanitizeHouseholdData = sanitizeHouseholdData;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sanitize,
        sanitizeHTML,
        sanitizeObject,
        sanitizeHouseholdData
    };
}
