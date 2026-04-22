/**
 * kobo.mapping.js
 * 
 * Transformation de données Kobo/Locales vers le format Household unifié
 * CRITICAL: Mapper Kobo → Household + Local → Household
 * Clé de matching: NUMEROORDRE (jamais null, toujours unique)
 * 
 * Intégration Kobo Engine Master v2.0:
 * - Mapping dynamique depuis la DB ou auto-détection
 * - Alias multiples pour chaque concept métier
 * - Migration automatique lors de changement de formulaire
 */

import { koboEngine } from '../modules/kobo/koboEngineMaster.js';

/**
 * Helper to extract a value from a row using dynamic mapping (Kobo Engine Master)
 * @param {object} row - Raw submission row
 * @param {string} targetKey - The GEM target field (ex: 'name', 'phone', 'status')
 * @param {object} mapping - The dynamic mapping from Kobo Engine Master
 * @param {string[]} fallbacks - Hardcoded fallback keys if mapping is missing
 * @returns {any} The extracted value
 */
function getValue(row, targetKey, mapping, fallbacks = []) {
    // 1. Try dynamic mapping from Kobo Engine Master
    if (mapping?.fields?.[targetKey]?.koboField) {
        const koboField = mapping.fields[targetKey].koboField;
        const value = koboEngine.getNestedValue(row, koboField);
        if (value !== null && value !== undefined) {
            return value;
        }
    }

    // 2. Fallback to hardcoded defaults if no dynamic mapping matches
    for (const key of fallbacks) {
        if (row[key] !== undefined) return row[key];
    }

    return null;
}

/**
 * Get or generate the dynamic mapping for a Kobo form
 * @param {string} organizationId 
 * @param {string} koboAssetId 
 * @param {string} koboServerUrl 
 * @returns {Promise<object>} The mapping object
 */
export async function getDynamicMapping(organizationId, koboAssetId, koboServerUrl) {
    try {
        // Try to get existing mapping from DB
        const mapping = await koboEngine.getMapping(organizationId, koboAssetId, koboServerUrl);
        
        // Check if form has changed and needs migration
        const changes = await koboEngine.detectFormChanges(organizationId, koboAssetId, koboServerUrl);
        if (changes.changed) {
            console.log(`[KOBO-MAPPING] Form changed: ${changes.reason}`);
            await koboEngine.migrateMapping(organizationId, koboAssetId, koboServerUrl);
            // Reload the new mapping
            return await koboEngine.getMapping(organizationId, koboAssetId, koboServerUrl);
        }
        
        return mapping;
    } catch (error) {
        console.warn('[KOBO-MAPPING] Dynamic mapping unavailable, using fallbacks:', error.message);
        return null; // Will use hardcoded fallbacks
    }
}

/**
 * Extract NUMEROORDRE from any source
 * Uses dynamic mapping from Kobo Engine Master v2.0
 */
export function extractNumeroOrdre(row, config = {}) {
    // Get dynamic mapping if available
    const mapping = config._dynamicMapping || null;
    
    let val = getValue(row, 'numeroOrdre', mapping, [
        'Numero_ordre', 'Numero ordre', 'numero_ordre', 'numeroOrdre', 'ID_MENAGE', 'id_menage', 'numero', '_id', 'numeroordre'
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
 * Uses dynamic mapping from Kobo Engine Master v2.0
 */
export function extractCoordinates(row, config = {}) {
    const mapping = config._dynamicMapping || null;
    let latitude = null;
    let longitude = null;

    // 1. Try Configured GPS field (Standard Kobo Geopoint)
    const geopointStr = getValue(row, 'gps_geopoint', mapping, [
        'LOCALISATION_CLIENT', 'TYPE_DE_VISITE/LOCALISATION_CLIENT', 'Lieu_du_M_nage'
    ]);

    if (geopointStr && typeof geopointStr === 'string' && geopointStr.includes(' ')) {
        const parts = geopointStr.split(' ');
        if (parts.length >= 2) {
            latitude = parseFloat(parts[0]);
            longitude = parseFloat(parts[1]);
        }
    }

    // 2. Try Manual Split Lat/Lon fields (Often more precise in the field)
    const hasValidManual = (lat, lon) => {
        const la = parseFloat(lat);
        const lo = parseFloat(lon);
        return Number.isFinite(la) && Number.isFinite(lo) && (la !== 0 || lo !== 0);
    };

    // Check various common manual field names (C2/C4 are high-priority manual overrides)
    const manualLat = getValue(row, 'gps_latitude', config, ['latitude_key', 'preciser_gps/latitude', 'C2', 'lat', 'LATITUDE']);
    const manualLon = getValue(row, 'gps_longitude', config, ['longitude_key', 'preciser_gps/longitude', 'C4', 'lon', 'LONGITUDE', 'lng']);

    if (hasValidManual(manualLat, manualLon)) {
        latitude = parseFloat(manualLat);
        longitude = parseFloat(manualLon);
    }

    // 3. Native Kobo Metadata Fallback (Last resort)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) {
        const koboGeo = row['_geolocation'];
        if (Array.isArray(koboGeo) && koboGeo.length >= 2 && koboGeo[0] !== null) {
            const kl = parseFloat(koboGeo[0]);
            const klo = parseFloat(koboGeo[1]);
            if (kl !== 0 || klo !== 0) {
                latitude = kl;
                longitude = klo;
            }
        }
    }

    return {
        latitude: (Number.isFinite(latitude) && latitude !== 0) ? latitude : null,
        longitude: (Number.isFinite(longitude) && longitude !== 0) ? longitude : null
    };
}

/**
 * Extract household owner information
 * Uses dynamic mapping from Kobo Engine Master v2.0
 */
export function extractOwner(row, config = {}) {
    const mapping = config._dynamicMapping || null;
    
    const name = getValue(row, 'name', mapping, [
        'nom_key', 'TYPE_DE_VISITE/nom_key', 'Prénom et Nom', 'nom_prenom', 'name', 'nom', 'owner.nom', 'nom_du_menage'
    ]) || 'Ménage Inconnu';

    const phone = getValue(row, 'phone', mapping, [
        'telephone_key', 'TYPE_DE_VISITE/telephone_key', 'Telephone', 'telephone', 'phone', 'owner.phone', 'tel', 'contact_phone'
    ]) || '';

    return {
        name: String(name).trim(),
        phone: String(phone).trim()
    };
}

/**
 * Extract regional information
 * Uses dynamic mapping from Kobo Engine Master v2.0
 */
export function extractRegionalInfo(row, config = {}) {
    const mapping = config._dynamicMapping || null;
    
    const region = getValue(row, 'region', mapping, [
        'region_key', 'TYPE_DE_VISITE/region_key', 'Region', 'REGION', 'C5', 'nom_region'
    ]) || '';

    const departement = getValue(row, 'departement', mapping, [
        'departement', 'dept', 'DEPARTEMENT', 'departement_key', 'TYPE_DE_VISITE/departement_key'
    ]) || '';

    const village = getValue(row, 'village', mapping, [
        'village', 'VILLAGE', 'village_key', 'TYPE_DE_VISITE/village_key', 'localite', 'Localite', 'commune', 'nom_village'
    ]) || '';

    return {
        region: String(region).trim(),
        departement: String(departement).trim(),
        commune: String(row['commune'] || row['COMMUNE'] || '').trim(),
        village: String(village).trim()
    };
}

/**
 * Extract installation status
 * Uses dynamic mapping from Kobo Engine Master v2.0
 */
export function extractStatus(row, config = {}) {
    const mapping = config._dynamicMapping || null;
    
    // 1. Eligibility Check
    const sit = getValue(row, 'status', mapping, [
        'group_wu8kv54/Situation_du_M_nage', 'Situation_du_M_nage', 'Situation du Ménage', 'statut', 'etat'
    ]);
    if (sit) {
        const str = String(sit).toLowerCase();
        if (str.includes('non_eligible') || str.includes('non éligible')) return 'Non éligible';
        if (str.includes('injoignable')) return 'En attente';
    }

    // 2. Desistement Check
    const just = getValue(row, 'justificatif', mapping, ['group_wu8kv54/justificatif', 'justificatif']);
    if (just && String(just).toLowerCase().includes('desistement')) return 'Désistement';

    // 3. Progression Checkpoints from Config (New: Allow projects to define their ok/fail fields)
    const isControlOk = getValue(row, 'status_control_ok', mapping, ['validation_controleur_final']) === 'true' || row['✅ Je valide le contrôle et l\'installation est conforme'] === 'true';
    const isInterieurOk = getValue(row, 'status_interieur_ok', mapping, ['validation_interieur_final']) === 'true' || row['✅ Je valide que l\'installation intérieure est terminée et conforme'] === 'true';
    const isReseauOk = getValue(row, 'status_reseau_ok', mapping, ['validation_reseau_final']) === 'true' || row['✅ Je valide que le branchement est terminé et conforme'] === 'true';
    const isMaconOk = getValue(row, 'status_macon_ok', mapping, ['validation_macon_final']) === 'true' || row['✅ Je valide que le mur est terminé et conforme'] === 'true';
    const isLivreurOk = getValue(row, 'status_livraison_ok', mapping, ['Je_confirme_la_remis_u_materiel_au_m_nage', 'Je confirme la remise du materiel au ménage']) === 'true';

    if (isControlOk) return 'Contrôle conforme';
    if (isInterieurOk) return 'Intérieur terminé';
    if (isReseauOk) return 'Réseau terminé';
    if (isMaconOk) return 'Murs terminés';
    if (isLivreurOk) return 'Livraison effectuée';
    return 'Non encore installée';
}

/**
 * Extract technical construction data (Excel Form mapping)
 * Exhaustive mapping following aEYZwPujJiFBTNb6mxMGCB XLSForm definition
 */
export function extractConstructionData(row) {
    return {
        preparateur: {
            kits_prepares: row['group_ed3yt17/Nombre_de_KIT_pr_par'] || row['Nombre_de_KIT_pr_par'],
            kits_charges: row['group_ed3yt17/Nombre_de_KIT_Charg_pour_livraison'] || row['Nombre_de_KIT_Charg_pour_livraison']
        },
        livreur: {
            situation: row['group_wu8kv54/Situation_du_M_nage'] || row['Situation_du_M_nage'],
            justificatif: row['group_wu8kv54/justificatif'] || row['justificatif'],
            menage_status: row['group_wu8kv54/Presence_de_Mur'] || row['Presence_de_Mur'],
            kit_problems: row['group_wu8kv54/POURQUOI'] || row['POURQUOI'] || '',
            câble_2_5: row['group_sy9vj14/Longueur_Cable_2_5mm_Int_rieure'] || row['Longueur_Cable_2_5mm_Int_rieure'],
            câble_1_5: row['group_sy9vj14/Longueur_Cable_1_5mm_Int_rieure'] || row['Longueur_Cable_1_5mm_Int_rieure'],
            tranchee_4: row['group_sy9vj14/Longueur_Tranch_e_Cable_arm_4mm'] || row['Longueur_Tranch_e_Cable_arm_4mm'],
            tranchee_1_5: row['group_sy9vj14/Longueur_Tranch_e_C_ble_arm_1_5mm'] || row['Longueur_Tranch_e_C_ble_arm_1_5mm'],
            materiel_remis: row['group_sy9vj14/Je_confirme_la_remis_u_materiel_au_m_nage'] === 'true' || row['Je_confirme_la_remis_u_materiel_au_m_nage'] === 'true',
            marquage_mur_coffret: row['group_sy9vj14/Je_confirme_le_marqu_osition_des_coffrets'] === 'true' || row['Je_confirme_le_marqu_osition_des_coffrets'] === 'true',
            marquage_emplacement: row['group_sy9vj14/Je_confirme_le_marqu_coffrets_lectriques'] === 'true' || row['Je_confirme_le_marqu_coffrets_lectriques'] === 'true'
        },
        macon: {
            kit_disponible: row['etape_macon/kit_disponible_macon'] || row['kit_disponible_macon'],
            problemes_kit: row['etape_macon/problemes_kit_macon'] || row['problemes_kit_macon'],
            type_mur: row['etape_macon/type_mur_realise_macon'] || row['type_mur_realise_macon'],
            termine: row['etape_macon/validation_macon_final'] === 'true' || row['validation_macon_final'] === 'true',
            problemes: row['etape_macon/problemes_travail_macon'] || row['problemes_travail_macon'] || row['PROBLEME'] || ''
        },
        reseau: {
            verif_mur: row['etape_reseau/verification_mur_reseau'] || row['verification_mur_reseau'],
            problemes_mur: row['etape_reseau/problemes_mur_reseau'] || row['problemes_mur_reseau'],
            etat: row['etape_reseau/etat_branchement_reseau'] || row['etat_branchement_reseau'],
            problemes_branchement: row['etape_reseau/problemes_branchement_reseau'] || row['problemes_branchement_reseau'],
            termine: row['etape_reseau/validation_reseau_final'] === 'true' || row['validation_reseau_final'] === 'true'
        },
        interieur: {
            verif_branchement: row['etape_interieur/verification_branchement_interieur'] || row['verification_branchement_interieur'],
            problemes_branchement: row['etape_interieur/problemes_branchement_interieur'] || row['problemes_branchement_interieur'],
            etat: row['etape_interieur/etat_installation_interieur'] || row['etat_installation_interieur'],
            problemes_installation: row['etape_interieur/problemes_installation_interieur'] || row['problemes_installation_interieur'],
            termine: row['etape_interieur/validation_interieur_final'] === 'true' || row['validation_interieur_final'] === 'true'
        },
        audit: {
            etat_global: row['etape_controleur/ETAT_DE_L_INSTALLATION'] || row['ETAT_DE_L_INSTALLATION'],
            problemes_controleur: row['etape_controleur/controleurPROB'] || row['controleurPROB'],
            phase: row['etape_controleur/Phase_de_controle'] || row['Phase_de_controle'],
            // Branchement Details
            etat_branchement: row['etape_controleur/group_zw7xz94/ETAT_BRANCHEMENT'] || row['ETAT_BRANCHEMENT'],
            obs_branchement: row['etape_controleur/group_zw7xz94/OBSERVATION'] || row['OBSERVATION'],
            pos_branchement: row['etape_controleur/group_wr05k35/Position_du_branchement'] || row['Position_du_branchement'],
            obs_pos_branchement: row['etape_controleur/group_wr05k35/Observations_sur_la_ition_du_branchement'] || row['Observations_sur_la_ition_du_branchement'],
            hauteur_branchement: row['etape_controleur/group_wr05k35/Hauteur_branchement'] || row['Hauteur_branchement'],
            obs_generales: row['etape_controleur/group_wr05k35/Observations'] || row['Observations'],
            hauteur_coffret: row['etape_controleur/group_wr05k35/Hauteur_coffret'] || row['Hauteur_coffret'],
            obs_hauteur_coffret: row['etape_controleur/group_wr05k35/Observations_001'] || row['Observations_001'],
            etat_coupe_circuit: row['etape_controleur/group_wr05k35/Etat_du_coupe_circuit'] || row['Etat_du_coupe_circuit'],
            obs_coupe_circuit: row['etape_controleur/group_wr05k35/OBSERVATION_001'] || row['OBSERVATION_001'],
            pvc_isolation: row['etape_controleur/group_wr05k35/Continuit_PVC'] || row['Continuit_PVC'],
            obs_pvc: row['etape_controleur/group_wr05k35/OBSERVATION_002'] || row['OBSERVATION_002'],
            mise_en_oeuvre_branchement: row['etape_controleur/group_wr05k35/Mise_en_oeuvre'] || row['Mise_en_oeuvre'],
            obs_mise_en_oeuvre: row['etape_controleur/group_wr05k35/OBSERVATION_003'] || row['OBSERVATION_003'],
            // Installation Intérieure Details
            disjoncteur_tete: row['etape_controleur/group_hx7ae46/DISJONCTEUR_GENERAL_EN_TETE_D_'] || row['DISJONCTEUR_GENERAL_EN_TETE_D_'],
            obs_disjoncteur: row['etape_controleur/group_hx7ae46/OBSERVATIONS_'] || row['OBSERVATIONS_'],
            type_disjoncteur: row['etape_controleur/group_hx7ae46/TYPE_DE_DISJONCTEUR_GENERAL'] || row['TYPE_DE_DISJONCTEUR_GENERAL'],
            protection_ddr_30ma: row['etape_controleur/group_hx7ae46/ENSEMBLE_DE_L_INSTALLATION_PRO'] || row['ENSEMBLE_DE_L_INSTALLATION_PRO'],
            obs_ddr: row['etape_controleur/group_hx7ae46/OBSERVATIONS__001'] || row['OBSERVATIONS__001'],
            protection_origine: row['etape_controleur/group_hx7ae46/PROTECTION_L_ORIGINE_DE_CHAQ'] || row['PROTECTION_L_ORIGINE_DE_CHAQ'],
            obs_protection_origine: row['etape_controleur/group_hx7ae46/OBSERVATIONS_002'] || row['OBSERVATIONS_002'],
            separation_circuits: row['etape_controleur/group_hx7ae46/S_PARATION_DES_CIRCUITS_Lumi_'] || row['S_PARATION_DES_CIRCUITS_Lumi_'],
            obs_separation: row['etape_controleur/group_hx7ae46/OBSERVATIONS__002'] || row['OBSERVATIONS__002'],
            contact_direct: row['etape_controleur/group_hx7ae46/PROTECTION_CONTRE_LES_CONTACTS'] || row['PROTECTION_CONTRE_LES_CONTACTS'],
            obs_contact_direct: row['etape_controleur/group_hx7ae46/OBSERVATIONS__003'] || row['OBSERVATIONS__003'],
            mise_en_oeuvre_mat: row['etape_controleur/group_hx7ae46/MISE_EN_OEUVRE_MAT_RIEL_ET_APP'] || row['MISE_EN_OEUVRE_MAT_RIEL_ET_APP'],
            obs_mat: row['etape_controleur/group_hx7ae46/OBSERVATIONS__004'] || row['OBSERVATIONS__004'],
            continuite_protection: row['etape_controleur/group_hx7ae46/CONTINUITE_DE_LA_PROTECTION_ME'] || row['CONTINUITE_DE_LA_PROTECTION_ME'],
            obs_continuite: row['etape_controleur/group_hx7ae46/OBSERVATIONS__005'] || row['OBSERVATIONS__005'],
            // Terre
            audit_terre: row['etape_controleur/group_hx7ae46/MISE_EN_UVRE_DU_R_SEAU_DE_TER'] || row['MISE_EN_UVRE_DU_R_SEAU_DE_TER'],
            obs_terre: row['etape_controleur/group_hx7ae46/OBSERVATIONS__006'] || row['OBSERVATIONS__006'],
            barrette_terre: row['etape_controleur/group_hx7ae46/ETAT_DE_LA_BARRETTE_DE_TERRE'] || row['ETAT_DE_LA_BARRETTE_DE_TERRE'],
            resistance_terre: row['etape_controleur/group_hx7ae46/VALEUR_DE_LA_RESISTANCE_DE_TER'] || row['VALEUR_DE_LA_RESISTANCE_DE_TER'],
            obs_resistance: row['etape_controleur/group_hx7ae46/OBSERVATIONS__007'] || row['OBSERVATIONS__007'],
            
            conforme: row['etape_controleur/validation_controleur_final'] === 'true' || row['validation_controleur_final'] === 'true',
            notes_generales: row['etape_controleur/notes_generales'] || row['notes_generales']
        },
        media: {
            photo_livraison: row['TYPE_DE_VISITE/Photo'] || row['Photo'],
            photo_macon: row['etape_macon/photo_mur'] || row['photo_mur'],
            photo_reseau: row['etape_reseau/photo_branchement'] || row['photo_branchement'],
            photo_interieur: row['etape_interieur/photo_installation'] || row['photo_installation'],
            photo_compteur: row['etape_controleur/photo_compteur'] || row['photo_compteur'],
            photo_anomalie: row['etape_controleur/group_hx7ae46/_1_photo_anomalie_si_possible'] || row['_1_photo_anomalie_si_possible'],
            signature_client: row['etape_controleur/signature_client'] || row['Signature_du_Chef_de_M_nage'],
            signature_controleur: row['etape_controleur/signature_controleur'] || row['Signature_du_Contr_leur']
        }
    };
}

/**
 * Extract automated alerts based on technical anomalies
 */
export function extractAlerts(row) {
    const alerts = [];

    // 1. Logistique / Livraison
    const sit = row['group_wu8kv54/Situation_du_M_nage'] || row['Situation_du_M_nage'];
    if (sit && String(sit).toLowerCase().includes('non_eligible')) {
        alerts.push({ type: 'ANOMALIE_TERRAIN', message: 'Ménage non éligible déclaré par le livreur', severity: 'HIGH' });
    }

    const kitProb = row['group_wu8kv54/POURQUOI'] || row['POURQUOI'];
    if (kitProb && String(kitProb).trim()) {
        alerts.push({ type: 'ANOMALIE_TERRAIN', message: `Problème livraison : ${kitProb}`, severity: 'MEDIUM' });
    }

    // 2. Maçonnerie
    const maconProb = row['etape_macon/problemes_travail_macon'] || row['problemes_travail_macon'] || row['PROBLEME'];
    if (maconProb && String(maconProb).trim()) {
        alerts.push({ type: 'ANOMALIE_TERRAIN', message: `Maçon : ${maconProb}`, severity: 'MEDIUM' });
    }

    // 3. Réseau
    const reseauProb = row['etape_reseau/problemes_branchement_reseau'] || row['problemes_branchement_reseau'];
    if (reseauProb && String(reseauProb).trim()) {
        alerts.push({ type: 'ANOMALIE_TERRAIN', message: `Réseau : ${reseauProb}`, severity: 'MEDIUM' });
    }

    // 4. Intérieur
    const interieurProb = row['etape_interieur/problemes_installation_interieur'] || row['problemes_installation_interieur'];
    if (interieurProb && String(interieurProb).trim()) {
        alerts.push({ type: 'ANOMALIE_TERRAIN', message: `Intérieur : ${interieurProb}`, severity: 'MEDIUM' });
    }

    // 5. Audit
    const auditProb = row['etape_controleur/controleurPROB'] || row['controleurPROB'];
    if (auditProb && String(auditProb).trim()) {
        alerts.push({ type: 'ANOMALIE_TERRAIN', message: `Audit : ${auditProb}`, severity: 'HIGH' });
    }

    // 6. Détection de Stagnation (Nouveau)
    const submissionTime = row['_submission_time'] || row['today'] || row['start'];
    if (submissionTime) {
        const subDate = new Date(submissionTime);
        const now = new Date();
        const diffDays = (now.getTime() - subDate.getTime()) / (1000 * 3600 * 24);
        
        // Si le ménage n'a pas bougé depuis 7 jours et n'est toujours pas commencé
        const currentStatus = extractStatus(row);
        if (currentStatus === 'Non encore installée' && diffDays > 7) {
            alerts.push({ 
                type: 'STAGNATION_DETECTED', 
                message: `Ménage stagnant : aucune progression depuis ${Math.round(diffDays)} jours.`, 
                severity: 'MEDIUM' 
            });
        }
    }

    return alerts;
}

/**
 * Master transformation function
 */
export async function transformRowToHousehold(row, organizationId, defaultZoneId, projectId, config = {}, existingHousehold = null) {
    // 🎯 Kobo Engine Master v2.0: Get dynamic mapping
    const koboAssetId = config.koboAssetId || null;
    const koboServerUrl = config.koboServerUrl || 'https://kf.kobotoolbox.org';
    
    let dynamicMapping = null;
    if (koboAssetId) {
        try {
            dynamicMapping = await getDynamicMapping(organizationId, koboAssetId, koboServerUrl);
        } catch (e) {
            console.warn('[KOBO-MAPPING] Could not load dynamic mapping:', e.message);
        }
    }

    // Merge dynamic mapping into config for extraction functions
    const effectiveConfig = {
        ...config,
        _dynamicMapping: dynamicMapping
    };

    const numeroOrdre = extractNumeroOrdre(row, effectiveConfig);

    if (!numeroOrdre) {
        return null;
    }

    const { latitude, longitude } = extractCoordinates(row, effectiveConfig);
    const { name, phone } = extractOwner(row, effectiveConfig);
    const regional = extractRegionalInfo(row, effectiveConfig);

    // 🧠 INTELLIGENCE: Priority to existing DB info if Kobo is empty
    const finalRegion = regional.region || existingHousehold?.region || null;
    const finalDepartement = regional.departement || existingHousehold?.departement || null;
    const finalVillage = regional.village || existingHousehold?.village || null;

    const status = extractStatus(row, effectiveConfig);
    const constructionData = extractConstructionData(row);
    const alerts = extractAlerts(row);

    return {
        numeroOrdre: numeroOrdre,
        name: name,
        phone: phone,
        owner: { name: name, nom: name, phone: phone, telephone: phone },
        region: finalRegion,
        departement: finalDepartement,
        village: finalVillage,
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
        constructionData: constructionData,
        alerts: alerts,
        version: 1,
        // Carry the mapping result for koboSync metadata
        _meta: {
            maconOk: getValue(row, 'status_macon_ok', dynamicMapping) === 'true' || row['✅ Je valide que le mur est terminé et conforme'] === 'true',
            reseauOk: getValue(row, 'status_reseau_ok', dynamicMapping) === 'true' || row['✅ Je valide que le branchement est terminé et conforme'] === 'true',
            interieurOk: getValue(row, 'status_interieur_ok', dynamicMapping) === 'true' || row['✅ Je valide que l\'installation intérieure est terminée et conforme'] === 'true',
            controleOk: getValue(row, 'status_control_ok', dynamicMapping) === 'true' || row['✅ Je valide le contrôle et l\'installation est conforme'] === 'true'
        },
        // Store mapping info for debugging
        _mappingInfo: dynamicMapping ? {
            version: dynamicMapping.version,
            confidence: Math.round(
                Object.values(dynamicMapping.fields || {}).reduce((sum, f) => sum + (f.confidence || 0), 0) / 
                Object.values(dynamicMapping.fields || {}).length
            )
        } : null
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
