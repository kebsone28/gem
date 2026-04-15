/**
 * kobo.mapping.js
 * 
 * Transformation de données Kobo/Locales vers le format Household unifié
 * CRITICAL: Mapper Kobo → Household + Local → Household
 * Clé de matching: NUMEROORDRE (jamais null, toujours unique)
 */

/**
 * Helper to extract a value from a row using a mapping config
 * @param {object} row - Raw submission row
 * @param {string} targetKey - The GEM target field (ex: 'name')
 * @param {object} mappingConfig - The mapping dictionary (targetKey -> koboField)
 * @param {string[]} fallbacks - Hardcoded fallback keys if config is missing
 * @returns {any} The extracted value
 */
function getValue(row, targetKey, mappingConfig, fallbacks = []) {
    const koboField = mappingConfig?.[targetKey];
    if (koboField && row[koboField] !== undefined) {
        return row[koboField];
    }
    
    // Fallback to hardcoded defaults if no config matches
    for (const key of fallbacks) {
        if (row[key] !== undefined) return row[key];
    }
    
    return null;
}

/**
 * Extract NUMEROORDRE from any source
 */
export function extractNumeroOrdre(row, config = {}) {
    let val = getValue(row, 'numeroordre', config, [
        'Numero_ordre', 'Numero ordre', 'numero_ordre', 'ID_MENAGE', 'id_menage', 'numero', '_id'
    ]);

    if (!val) return null;

    let cleaned = String(val).trim();
    if (cleaned.endsWith('.0')) {
        cleaned = cleaned.substring(0, cleaned.length - 2);
    }
    
    return /^[A-Z0-9.-]+$/i.test(cleaned) ? cleaned : null;
}

/**
 * Extract geographic coordinates
 */
export function extractCoordinates(row, config = {}) {
    let latitude = null;
    let longitude = null;

    // 1. Try Configured GPS field
    const geopointStr = getValue(row, 'gps_geopoint', config, [
        'LOCALISATION_CLIENT', 'TYPE_DE_VISITE/LOCALISATION_CLIENT'
    ]);

    if (geopointStr && typeof geopointStr === 'string' && geopointStr.includes(' ')) {
        const parts = geopointStr.split(' ');
        if (parts.length >= 2) {
            latitude = parseFloat(parts[0]);
            longitude = parseFloat(parts[1]);
        }
    }

    // 2. Try Split Lat/Lon from config
    if (!latitude || !longitude) {
        const preciseLat = getValue(row, 'gps_latitude', config, ['latitude_key', 'preciser_gps/latitude']);
        const preciseLon = getValue(row, 'gps_longitude', config, ['longitude_key', 'preciser_gps/longitude']);
        if (preciseLat && preciseLon) {
            latitude = parseFloat(preciseLat);
            longitude = parseFloat(preciseLon);
        }
    }

    // 3. Native Kobo Fallback
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
 */
export function extractOwner(row, config = {}) {
    const name = getValue(row, 'name', config, [
        'nom_key', 'TYPE_DE_VISITE/nom_key', 'Prénom et Nom', 'nom_prenom', 'name'
    ]) || 'Ménage Inconnu';

    const phone = getValue(row, 'phone', config, [
        'telephone_key', 'TYPE_DE_VISITE/telephone_key', 'Telephone', 'telephone', 'phone'
    ]) || '';

    return {
        name: String(name).trim(),
        phone: String(phone).trim()
    };
}

/**
 * Extract regional information
 */
export function extractRegionalInfo(row, config = {}) {
    const region = getValue(row, 'region', config, [
        'region_key', 'TYPE_DE_VISITE/region_key', 'Region'
    ]) || '';
    
    const departement = getValue(row, 'departement', config, ['departement', 'dept']) || '';
    const village = getValue(row, 'village', config, ['village']) || '';
    
    return {
        region: String(region).trim(),
        departement: String(departement).trim(),
        commune: String(row['commune'] || '').trim(),
        village: String(village).trim()
    };
}

/**
 * Extract installation status
 */
export function extractStatus(row, config = {}) {
    // 1. Eligibility Check
    const sit = getValue(row, 'situation_menage', config, [
        'group_wu8kv54/Situation_du_M_nage', 'Situation_du_M_nage', 'Situation du Ménage'
    ]);
    if (sit) {
        const str = String(sit).toLowerCase();
        if (str.includes('non_eligible') || str.includes('non éligible')) return 'Ménage non éligible';
    }

    // 2. Desistement Check
    const just = getValue(row, 'justificatif', config, ['group_wu8kv54/justificatif', 'justificatif']);
    if (just && String(just).toLowerCase().includes('desistement')) return 'Ménage désisté';

    // 3. Progression Checkpoints from Config (New: Allow projects to define their ok/fail fields)
    const isControlOk = getValue(row, 'status_control_ok', config, ['validation_controleur_final']) === 'true' || row['✅ Je valide le contrôle et l\'installation est conforme'] === 'true';
    const isInterieurOk = getValue(row, 'status_interieur_ok', config, ['validation_interieur_final']) === 'true' || row['✅ Je valide que l\'installation intérieure est terminée et conforme'] === 'true';
    const isReseauOk = getValue(row, 'status_reseau_ok', config, ['validation_reseau_final']) === 'true' || row['✅ Je valide que le branchement est terminé et conforme'] === 'true';
    const isMaconOk = getValue(row, 'status_macon_ok', config, ['validation_macon_final']) === 'true' || row['✅ Je valide que le mur est terminé et conforme'] === 'true';
    const isLivreurOk = getValue(row, 'status_livraison_ok', config, ['Je_confirme_la_remis_u_materiel_au_m_nage', 'Je confirme la remise du materiel au ménage']) === 'true';

    if (isControlOk) return 'Contrôle conforme';
    if (isInterieurOk) return 'Intérieur terminé';
    if (isReseauOk) return 'Réseau terminé';
    if (isMaconOk) return 'Murs terminés';
    if (isLivreurOk) return 'Livraison effectuée';

    return 'Non débuté';
}

/**
 * Master transformation function
 */
export function transformRowToHousehold(row, organizationId, defaultZoneId, projectId, config = {}) {
    const numeroOrdre = extractNumeroOrdre(row, config);

    if (!numeroOrdre) {
        return null;
    }

    const { latitude, longitude } = extractCoordinates(row, config);
    const { name, phone } = extractOwner(row, config);
    const { region, departement, village } = extractRegionalInfo(row, config);
    const status = extractStatus(row, config);

    return {
        numeroOrdre: numeroOrdre,
        name: name,
        phone: phone,
        owner: { nom: name, telephone: phone },
        region: region,
        departement: departement,
        village: village,
        latitude: latitude,
        longitude: longitude,
        location: {
            type: 'Point',
            coordinates: longitude !== null && latitude !== null ? [longitude, latitude] : null
        },
        status: status,
        organizationId: organizationId,
        projectId: projectId,
        zoneId: defaultZoneId,
        source: 'Kobo',
        koboData: row,
        version: 1,
        // Carry the mapping result for koboSync metadata
        _meta: {
            maconOk: getValue(row, 'status_macon_ok', config) === 'true' || row['✅ Je valide que le mur est terminé et conforme'] === 'true',
            reseauOk: getValue(row, 'status_reseau_ok', config) === 'true' || row['✅ Je valide que le branchement est terminé et conforme'] === 'true',
            interieurOk: getValue(row, 'status_interieur_ok', config) === 'true' || row['✅ Je valide que l\'installation intérieure est terminée et conforme'] === 'true',
            controleOk: getValue(row, 'status_control_ok', config) === 'true' || row['✅ Je valide le contrôle et l\'installation est conforme'] === 'true'
        }
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
