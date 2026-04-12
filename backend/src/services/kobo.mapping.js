/**
 * kobo.mapping.js
 * 
 * Transformation de données Kobo/Locales vers le format Household unifié
 * CRITICAL: Mapper Kobo → Household + Local → Household
 * Clé de matching: NUMEROORDRE (jamais null, toujours unique)
 */

/**
 * Extract NUMEROORDRE from any source (Kobo or Local)
 * @param {object} row - Raw submission/import row
 * @returns {string|null} The numero ordre or null if not found
 */
export function extractNumeroOrdre(row) {
    // Debug: Voir la ligne brute pour identifier les nouveaux champs Kobo
    // console.log('[KOBO-MAPPING-DEBUG] Processing row ID:', row._id || 'unknown');
    
    // Try multiple field names (Kobo flexibility)
    let val =
        row['Numero_ordre'] ||       
        row['Numero ordre'] ||        
        row['numero_ordre'] ||        
        row['ID_MENAGE'] ||
        row['id_menage'] ||
        row['numero'] ||              
        row['_id'] ||                 
        null;

    if (val === null || val === undefined) return null;

    // Clean and validate
    let cleaned = String(val).trim();
    
    // On garde le numéro EXACT de Kobo (plus de tronquage à 4 chiffres)
    // Seul le ".0" technique d'Excel reste supprimé s'il existe.
    if (cleaned.endsWith('.0')) {
        cleaned = cleaned.substring(0, cleaned.length - 2);
    }
    
    return /^[A-Z0-9.-]+$/i.test(cleaned) ? cleaned : null;
}

/**
 * Extract geographic coordinates
 * @param {object} row - Raw submission/import row
 * @returns {object} { latitude: number, longitude: number }
 */
export function extractCoordinates(row) {
    let latitude = null;
    let longitude = null;

    // Helper to find a key by partial name (case insensitive)
    const findValue = (regex) => {
        const key = Object.keys(row).find(k => regex.test(k));
        return key ? row[key] : null;
    };

    // PRIORITY 1: Kobo surveyor GPS (Geopoint field identified: LOCALISATION_CLIENT)
    const geopointStr = row['LOCALISATION_CLIENT'] || row['TYPE_DE_VISITE/LOCALISATION_CLIENT'] || findValue(/gps.*menage/i);
    if (geopointStr && typeof geopointStr === 'string' && geopointStr.includes(' ')) {
        const parts = geopointStr.split(' ');
        if (parts.length >= 2) {
            latitude = parseFloat(parts[0]);
            longitude = parseFloat(parts[1]);
        }
    }

    // PRIORITY 2: surveyor "confirmed" columns (latitude_key/longitude_key or preciser_gps)
    if (!latitude || !longitude) {
        const preciseLat = row['latitude_key'] || row['preciser_gps/latitude'] || findValue(/preciser_gps.*latitude/i);
        const preciseLon = row['longitude_key'] || row['preciser_gps/longitude'] || findValue(/preciser_gps.*longitude/i);
        if (preciseLat && preciseLon) {
            latitude = parseFloat(preciseLat);
            longitude = parseFloat(preciseLon);
        }
    }

    // PRIORITY 3: Kobo native _geolocation
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        const koboGeo = row['_geolocation'];
        if (Array.isArray(koboGeo) && koboGeo.length >= 2 && koboGeo[0] !== null) {
            latitude = parseFloat(koboGeo[0]);
            longitude = parseFloat(koboGeo[1]);
        }
    }

    return {
        latitude: (Number.isFinite(latitude) && latitude !== 0) ? latitude : null,
        longitude: (Number.isFinite(longitude) && longitude !== 0) ? longitude : null
    };
}

/**
 * Extract household owner information
 * @param {object} row - Raw submission/import row
 * @returns {object} { name, phone }
 */
export function extractOwner(row) {
    // Helper to find a key by partial name (case insensitive)
    const findValue = (regex) => {
        const key = Object.keys(row).find(k => regex.test(k));
        return key ? row[key] : null;
    };

    const name =
        row['nom_key'] ||                   
        row['TYPE_DE_VISITE/nom_key'] ||    
        row['Prénom et Nom'] ||             
        row['nom_prenom'] ||
        findValue(/nom.*key/i) ||
        findValue(/prenom.*nom/i) ||
        row['name'] ||                      
        'Ménage Inconnu';

    const phone =
        row['telephone_key'] ||                 
        row['TYPE_DE_VISITE/telephone_key'] ||  
        row['Telephone'] ||                     
        row['telephone'] ||
        findValue(/tel.*key/i) ||
        findValue(/phone.*key/i) ||
        '';

    return {
        name: String(name).trim(),
        phone: String(phone).trim()
    };
}

/**
 * Extract regional information
 * @param {object} row - Raw submission/import row
 * @returns {object} { region, departement, commune, village }
 */
export function extractRegionalInfo(row) {
    // Note: Village column is verified missing in XLS, so we return empty/undefined
    const region = row['region_key'] || row['TYPE_DE_VISITE/region_key'] || row['Region'] || '';
    
    return {
        region: String(region).trim(),
        departement: String(row['departement'] || row['dept'] || '').trim(),
        commune: String(row['commune'] || '').trim(),
        village: '' // Missing in Kobo
    };
}

/**
 * Extract installation status
 * @param {object} row - Raw submission/import row
 * @returns {string} Installation status
 */
export function extractStatus(row) {
    // Check for "Situation du Ménage" first (eligibility)
    const sit = row['group_wu8kv54/Situation_du_M_nage'] || row['Situation_du_M_nage'] || row['Situation du Ménage'];
    if (sit) {
        const str = String(sit).toLowerCase();
        if (str.includes('non_eligible') || str.includes('non éligible')) return 'Ménage non éligible';
    }

    // Check for "justificatif" (desistement)
    const just = row['group_wu8kv54/justificatif'] || row['justificatif'];
    if (just && String(just).toLowerCase().includes('desistement')) return 'Ménage désisté';

    // Progressive workflow based on exact XLS field names
    const isControlOk = row['validation_controleur_final'] === 'true';
    const isInterieurOk = row['validation_interieur_final'] === 'true';
    const isReseauOk = row['validation_reseau_final'] === 'true';
    const isMaconOk = row['validation_macon_final'] === 'true';
    const isLivreurOk = row['Je_confirme_la_remis_u_materiel_au_m_nage'] === 'true' || row['Je confirme la remise du materiel au ménage'] === 'true';

    if (isControlOk) return 'Contrôle conforme';
    if (isInterieurOk) return 'Intérieur terminé';
    if (isReseauOk) return 'Réseau terminé';
    if (isMaconOk) return 'Murs terminés';
    if (isLivreurOk) return 'Livraison effectuée';

    return 'Non débuté';
}

/**
 * Extract photo/attachment
 * @param {object} row - Raw submission/import row
 * @returns {string|null} Photo URL or null
 */
export function extractPhoto(row) {
    const photo =
        row['Photo'] ||
        row['photo'] ||
        row['1 photo anomalie si existant'] ||
        null;

    return photo ? String(photo).trim() : null;
}

/**
 * Master transformation function: Kobo/Local → Household
 * @param {object} row - Raw submission/import row
 * @param {string} organizationId
 * @param {string} defaultZoneId
 * @param {string} projectId
 * @returns {object} Normalized household object
 */
export function transformRowToHousehold(row, organizationId, defaultZoneId, projectId) {
    const numeroOrdre = extractNumeroOrdre(row);

    if (!numeroOrdre) {
        return null; // Skip rows without numeroOrdre
    }

    const { latitude, longitude } = extractCoordinates(row);
    const { name, phone } = extractOwner(row);
    const { region, departement, commune, village } = extractRegionalInfo(row);
    const status = extractStatus(row);
    const photo = extractPhoto(row);

    return {
        // Business identifier (CRITICAL KEY)
        numeroOrdre: numeroOrdre,

        // Owner information
        name: name,
        phone: phone,
        owner: {
            nom: name,
            telephone: phone
        },

        // Geographic information
        region: region,
        departement: departement,
        commune: commune,
        village: village,
        latitude: latitude,
        longitude: longitude,
        location: {
            type: 'Point',
            coordinates: longitude !== null && latitude !== null
                ? [longitude, latitude]
                : null
        },

        // Installation status
        status: status,

        // Organization & Zone
        organizationId: organizationId,
        projectId: projectId,
        zoneId: defaultZoneId,

        // Metadata
        source: 'Kobo', // Will be overridden for local imports
        koboData: row, // Store entire raw row for reference
        version: 1
    };
}

/**
 * Batch transformation with error handling
 * @param {string} organizationId
 * @param {string} defaultZoneId
 * @param {string} projectId
 * @returns {object} { valid: [], invalid: [] }
 */
export function transformRows(rows, organizationId, defaultZoneId, projectId) {
    const valid = [];
    const invalid = [];
    
    for (const row of rows) {
        try {
            const household = transformRowToHousehold(row, organizationId, defaultZoneId, projectId);

            if (household) {
                valid.push(household);
            } else {
                invalid.push({
                    row: row,
                    reason: 'Missing numeroOrdre or invalid data'
                });
            }
        } catch (error) {
            invalid.push({
                row: row,
                reason: error.message
            });
        }
    }

    return { valid, invalid };
}
