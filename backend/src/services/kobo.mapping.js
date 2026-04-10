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
    // Try multiple field names (Kobo flexibility)
    const numeroOrdre =
        row['Numero_ordre'] ||       // Kobo actual form field
        row['Numero ordre'] ||        // Alternative spelling
        row['numero_ordre'] ||        // Local CSV format
        row['numero'] ||              // Short form
        row['id_menage'] ||           // Internal ID
        row['_id'] ||                 // Fallback to Kobo submission ID
        null;

    if (!numeroOrdre) {
        return null;
    }

    // Clean and validate: must be numeric or alphanumeric string
    const cleaned = String(numeroOrdre).trim();
    return /^[A-Z0-9-]+$/i.test(cleaned) ? cleaned : null;
}

/**
 * Extract geographic coordinates
 * @param {object} row - Raw submission/import row
 * @returns {object} { latitude: number, longitude: number }
 */
export function extractCoordinates(row) {
    let latitude = null;
    let longitude = null;

    // PRIORITY 1: Kobo actual submitted form structure
    // TYPE_DE_VISITE/latitude_key and TYPE_DE_VISITE/longitude_key
    const koboLat = row['TYPE_DE_VISITE/latitude_key'] || row['latitude_key'] || row['TYPE_DE_VISITE/latitude'];
    const koboLon = row['TYPE_DE_VISITE/longitude_key'] || row['longitude_key'] || row['TYPE_DE_VISITE/longitude'];

    if (koboLat != null && koboLon != null) {
        latitude = parseFloat(koboLat);
        longitude = parseFloat(koboLon);
    }

    // PRIORITY 2: Alternative Kobo field names (for legacy or different forms)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        const alt_lat = row['_GPS du Ménage_latitude'] || row['Latitude'] || row['latitude'] || row['latitude_key'];
        const alt_lon = row['_GPS du Ménage_longitude'] || row['Longitude'] || row['longitude'] || row['longitude_key'];

        if (alt_lat && alt_lon) {
            latitude = parseFloat(alt_lat);
            longitude = parseFloat(alt_lon);
        }
    }

    // PRIORITY 3: Kobo native Geopoint field (often a space-separated string like 'lat lon alt acc')
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        const geopointStr = row['LOCALISATION_CLIENT'] || row['TYPE_DE_VISITE/LOCALISATION_CLIENT'] || row['gps'];
        if (geopointStr && typeof geopointStr === 'string') {
            const parts = geopointStr.split(' ');
            if (parts.length >= 2) {
                latitude = parseFloat(parts[0]);
                longitude = parseFloat(parts[1]);
            }
        }
    }

    // PRIORITY 4: Kobo _geolocation array [lat, lon]
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        const koboGeo = row['_geolocation'];
        // Note: Kobo _geolocation is usually [latitude, longitude]
        if (Array.isArray(koboGeo) && koboGeo.length >= 2 && koboGeo[0] !== null) {
            latitude = parseFloat(koboGeo[0]);
            longitude = parseFloat(koboGeo[1]);
        }
    }

    // PRIORITY 4: Local CSV format: latitude / longitude (comma as decimal separator)
    if (!latitude || !longitude) {
        const localLat = row['latitude'];
        const localLon = row['longitude'];

        if (localLat && localLon) {
            // Handle both . and , as decimal separator
            latitude = parseFloat(String(localLat).replace(',', '.'));
            longitude = parseFloat(String(localLon).replace(',', '.'));
        }
    }

    return {
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null
    };
}

/**
 * Extract household owner information
 * @param {object} row - Raw submission/import row
 * @returns {object} { name, phone }
 */
export function extractOwner(row) {
    const name =
        row['TYPE_DE_VISITE/nom_key'] ||    // Kobo actual form field
        row['Prénom et Nom'] ||             // Alternative Kobo field
        row['nom_prenom'] ||                // Local CSV alternative
        row['chef_menage'] ||               // Local CSV alternative
        row['name'] ||                      // Generic fallback
        'Unknown';

    const phone =
        row['TYPE_DE_VISITE/telephone_key'] ||  // Kobo actual form field
        row['Telephone'] ||                     // Alternative Kobo field
        row['telephone'] ||                     // Local CSV
        row['phonenumber'] ||                   // Alternative
        row['phone'] ||                         // Generic
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
    return {
        region: String(row['TYPE_DE_VISITE/region_key'] || row['Region'] || row['region'] || '').trim(),
        departement: String(row['departement'] || row['dept'] || '').trim(),
        commune: String(row['commune'] || '').trim(),
        village: String(row['village'] || row['localite'] || '').trim()
    };
}

/**
 * Extract installation status
 * @param {object} row - Raw submission/import row
 * @returns {string} Installation status
 */
export function extractStatus(row) {
    // PRIORITY 1: Check for "Situation du Ménage" field first (eligibility status)
    // This field is often nested in a Kobo group like "group_wu8kv54/Situation_du_M_nage"
    let situationDuMenage = null;

    // Try exact Kobo field name first
    situationDuMenage = row['group_wu8kv54/Situation_du_M_nage'];

    // Alternative field names
    if (!situationDuMenage) {
        situationDuMenage =
            row['Situation du Ménage'] ||
            row['Situation_du_Menage'] ||
            row['situation_menage'] ||
            row['Eligibilité'] ||
            row['eligibilite'] ||
            null;
    }

    // If household is explicitly marked as ineligible, return that status
    if (situationDuMenage) {
        const situationStr = String(situationDuMenage).toLowerCase().trim();
        if (situationStr.includes('non_eligible') ||
            situationStr.includes('noneeligible') ||
            situationStr.includes('non éligible') ||
            situationStr.includes('ineligible')) {
            return 'Ménage non éligible';
        }
        // If there's an explicit eligibility status, use it
        if (situationStr !== '' && situationStr !== 'null') {
            return String(situationDuMenage).trim();
        }
    }

    // PRIORITY 2: Check for "justificatif" field (like "desistement_du_menage")
    const justificatif = row['group_wu8kv54/justificatif'];
    if (justificatif) {
        const justStr = String(justificatif).toLowerCase().trim();
        if (justStr === 'desistement_du_menage' || justStr.includes('desistement')) {
            return 'Ménage désisté';
        }
        // Other justificatif values could map to different statuses
        if (justStr !== '' && justStr !== 'null') {
            return `Justificatif: ${String(justificatif).trim()}`;
        }
    }

    // PRIORITY 3: Fall back to form validation checkpoints
    // Kobo form validation fields (check for confirmed steps)
    const isConfirmedLivreur = row['Je confirme la remise du materiel au ménage'] === 'true';
    const isConfirmedMur = row['✅ Je valide que le mur est terminé et conforme'] === 'true';
    const isConfirmedBranchement = row['✅ Je valide que le branchement est terminé et conforme'] === 'true';
    const isConfirmedInterieur = row['✅ Je valide que l\'installation intérieure est terminée et conforme'] === 'true';
    const isConfirmedControl = row['✅ Je valide le contrôle et l\'installation est conforme'] === 'true';

    // Determine status based on progression
    if (isConfirmedControl) {
        return 'Contrôle conforme';
    } else if (isConfirmedInterieur) {
        return 'Intérieur terminé';
    } else if (isConfirmedBranchement) {
        return 'Réseau terminé';
    } else if (isConfirmedMur) {
        return 'Murs terminés';
    } else if (isConfirmedLivreur) {
        return 'Livraison effectuée';
    }

    // PRIORITY 4: Local CSV: statut field
    const localStatus = row['statut'] || row['status'];
    if (localStatus) {
        return String(localStatus).trim();
    }

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
