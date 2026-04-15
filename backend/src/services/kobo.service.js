/**
 * kobo.service.js
 *
 * Service de synchronisation avec l'API KoboToolbox.
 * Récupère les soumissions d'un formulaire Kobo et les applique à la DB.
 *
 * Variables d'environnement requises :
 *   KOBO_API_URL     — ex: https://kf.kobotoolbox.org (ou kobocat)
 *   KOBO_TOKEN       — token d'API KoboToolbox (Settings > Token)
 *   KOBO_FORM_ID     — l'identifiant uid du formulaire (ex: aXXXXXXXXX)
 */

import prisma from '../core/utils/prisma.js';
import { recalculateProjectGrappes } from './project_config.service.js';
import { transformRowToHousehold } from './kobo.mapping.js';
import { tracerAction } from './audit.service.js';

const KOBO_API_URL = process.env.KOBO_API_URL || 'https://kf.kobotoolbox.org';
const KOBO_TOKEN = process.env.KOBO_TOKEN || '';
const KOBO_FORM_ID = process.env.KOBO_FORM_ID || '';

// Region GPS bounds for validation (lat, lon in decimal degrees)
const REGION_GPS_BOUNDS = {
    'Dakar': { latMin: 14.5, latMax: 15.0, lonMin: -17.8, lonMax: -17.3 },
    'Thiès': { latMin: 14.0, latMax: 15.0, lonMin: -16.8, lonMax: -15.8 },
    'Tambacounda': { latMin: 13.7, latMax: 14.9, lonMin: -13.7, lonMax: -12.5 },
    'Matam': { latMin: 14.2, latMax: 15.9, lonMin: -12.8, lonMax: -11.5 },
    'Kolda': { latMin: 12.9, latMax: 13.9, lonMin: -15.3, lonMax: -14.0 },
    'Ziguinchor': { latMin: 13.0, latMax: 13.8, lonMin: -15.6, lonMax: -15.0 },
    'Kaffrine': { latMin: 13.1, latMax: 14.2, lonMin: -15.0, lonMax: -14.1 },
    'Louga': { latMin: 14.8, latMax: 15.9, lonMin: -15.4, lonMax: -14.2 }
};

function validateGPSRegion(latitude, longitude, region, submissionId = null) {
    if (!latitude || !longitude || !region) return true; // Skip if missing data

    const bounds = REGION_GPS_BOUNDS[region.trim()];
    if (!bounds) return true; // Unknown region, can't validate

    const isValid = (
        latitude >= bounds.latMin && latitude <= bounds.latMax &&
        longitude >= bounds.lonMin && longitude <= bounds.lonMax
    );

    if (!isValid) {
        console.warn(
            `[KOBO-SYNC] ⚠️ GPS-REGION MISMATCH - ID: ${submissionId}, ` +
            `Region: ${region}, GPS: [${latitude}, ${longitude}]`
        );
    }

    return isValid;
}

/**
 * Fetches submissions from KoboToolbox API since a given date.
 * @param {string} token - Project specific Kobo token
 * @param {string} assetUid - Project specific Asset UID
 * @param {string|null} since - ISO timestamp for incremental sync
 * @returns {Promise<any[]>} Array of raw Kobo submissions
 */
export async function fetchKoboSubmissions(token, assetUid, since = null) {
    const finalToken = token || KOBO_TOKEN;
    const finalAssetUid = assetUid || KOBO_FORM_ID;

    if (!finalToken || !finalAssetUid) {
        throw new Error('KOBO_TOKEN ou KOBO_FORM_ID non configurés (ni en variable d\'env, ni dans le projet).');
    }

    // Build query — Kobo supports ?query= with MongoDB-style JSON filter
    let url = `${KOBO_API_URL}/api/v2/assets/${finalAssetUid}/data/?format=json&limit=5000`;
    if (since) {
        const sinceDate = new Date(since).toISOString();
        // Kobo filter on submission time
        url += `&query={"_submission_time":{"$gte":"${sinceDate}"}}`;
    }

    const response = await fetch(url, {
        headers: {
            Authorization: `Token ${finalToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`KoboToolbox API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    return data.results || [];
}

/**
 * Maps a Kobo submission object to a household update object.
 * Uses kobo.mapping.js for standard field extraction + Kobo-specific enrichment
 *
 * @param {object} submission - Raw Kobo submission
 * @param {string} organizationId
 * @param {string} defaultZoneId
 * @param {string} projectId
 * @param {object} config - The mapping configuration
 */
function mapSubmissionToHousehold(submission, organizationId, defaultZoneId, projectId, config = {}) {
    // Use professional mapping function with dynamic config
    const household = transformRowToHousehold(submission, organizationId, defaultZoneId, projectId, config);

    if (!household) {
        return null; // Skip if mapping failed (missing numeroOrdre)
    }

    // Add Kobo-specific enrichment
    household.assignedTeams = submission['TYPE_DE_VISITE/role'] ? [
        {
            'macon': 'Maçon',
            'livreur': 'Livreur',
            'reseau': 'Réseau',
            'interieur': 'Intérieur',
            'controleur': 'Contrôleur'
        }[String(submission['TYPE_DE_VISITE/role']).toLowerCase()] || submission['TYPE_DE_VISITE/role']
    ] : (submission['Votre Role'] ? [
        {
            'macon': 'Maçon',
            'livreur': 'Livreur',
            'reseau': 'Réseau',
            'interieur': 'Intérieur',
            'controleur': 'Contrôleur'
        }[String(submission['Votre Role']).toLowerCase()] || submission['Votre Role']
    ] : []);

    // Track installation progression via form validation checkpoints (dynamic via _meta)
    household.koboSync = {
        maconOk: household._meta?.maconOk || false,
        reseauOk: household._meta?.reseauOk || false,
        interieurOk: household._meta?.interieurOk || false,
        controleOk: household._meta?.controleOk || false,
        livreurDate: submission['_submission_time'] || null
    };

    // Remove temp meta
    delete household._meta;

    // Store complete submission for audit trail
    household.koboData = submission;
    household.source = 'KOBO';
    household.updatedAt = new Date(submission['_submission_time'] || Date.now());

    // Validate GPS coordinates match region
    if (household.latitude && household.longitude && household.region) {
        validateGPSRegion(household.latitude, household.longitude, household.region, submission['_id']);
    }

    return household;
}

/**
 * Main sync function: pull from Kobo, apply to DB.
 * Now dynamically generates zones based on the "region" field.
 * 
 * @param {string} organizationId
 * @param {string} fallbackZoneId - zone used if no region is found
 * @param {string|null} since - ISO timestamp for incremental sync
 * @param {string|null} projectId - specific project to sync
 * @returns {Promise<{applied: number, skipped: number, errors: number}>}
 */
export async function syncKoboToDatabase(organizationId, fallbackZoneId, since = null, projectId = null) {
    // 1. Resolve Project and its Kobo Config
    let targetProjectId = projectId;
    let koboToken = null;
    let koboAssetUid = null;
    let mappingConfig = {};

    if (!targetProjectId) {
        const fallbackZone = await prisma.zone.findUnique({ where: { id: fallbackZoneId } });
        targetProjectId = fallbackZone?.projectId;
    }

    if (targetProjectId) {
        const project = await prisma.project.findUnique({ where: { id: targetProjectId } });
        if (project?.config) {
            koboToken = project.config.kobo?.token;
            koboAssetUid = project.config.kobo?.assetUid;
            // Mapping can be at project level
            mappingConfig = project.config.kobo_field_mapping;
            console.log(`[KOBO-SYNC] Using project-specific config for project: ${project.name}`);
        }
    }

    // Fallback to Org config if project mapping is empty
    if (!mappingConfig || Object.keys(mappingConfig).length === 0) {
        const org = await prisma.organization.findUnique({ where: { id: organizationId } });
        mappingConfig = org?.config?.kobo_field_mapping || {};
        console.log(`[KOBO-SYNC] Using organization-level mapping config fallback`);
    }

    const submissions = await fetchKoboSubmissions(koboToken, koboAssetUid, since);

    let applied = 0;
    let skipped = 0;
    let errors = 0;

    // Local cache for zones to avoid hitting DB for every household
    const zoneCache = {};

    for (const submission of submissions) {
        try {
            // Extract region to use as zone name
            // Common keys: 'TYPE_DE_VISITE/region_key', 'region_key', 'region', 'region_administrative'
            const regionName = (
                submission['TYPE_DE_VISITE/region_key'] ||
                submission['region_key'] ||
                submission['region'] ||
                submission['region_administrative'] ||
                ''
            ).trim();

            let zoneId = fallbackZoneId;

            if (regionName && targetProjectId) {
                if (zoneCache[regionName]) {
                    zoneId = zoneCache[regionName];
                } else {
                    // Find or create zone by name for this project
                    let zone = await prisma.zone.findFirst({
                        where: {
                            name: regionName,
                            projectId: targetProjectId,
                            organizationId
                        }
                    });

                    if (!zone) {
                        console.log(`[KOBO-SYNC] 🏗️ Creating new zone for region: ${regionName}`);
                        zone = await prisma.zone.create({
                            data: {
                                name: regionName,
                                projectId: targetProjectId,
                                organizationId
                            }
                        });
                    }

                    zoneCache[regionName] = zone.id;
                    zoneId = zone.id;
                }
            }

            // Map Kobo submission to unified Household format
            const household = mapSubmissionToHousehold(submission, organizationId, zoneId, targetProjectId, mappingConfig);

            // Skip if mapping failed (happens when numeroOrdre is missing)
            if (!household) {
                skipped++;
                continue;
            }

            // 🔑 RECHERCHE PRÉALABLE: Chercher le ménage existant par numeroordre (clé métier unique)
            // numeroOrdre comes from the mapping module and is guaranteed to exist if household is not null
            // NORMALISATION: On s'assure que la recherche est insensible aux espaces et à la casse
            const numeroDemande = household.numeroOrdre ? String(household.numeroOrdre).trim().toUpperCase() : null;
            let existingHousehold = null;

            if (numeroDemande) {
                try {
                    // 1. First attempt: Exact match
                    existingHousehold = await prisma.household.findFirst({
                        where: {
                            organizationId: organizationId,
                            OR: [
                                { numeroordre: { equals: numeroDemande, mode: 'insensitive' } },
                                { id: { equals: numeroDemande, mode: 'insensitive' } }
                            ],
                            deletedAt: null
                        }
                    });

                    // 2. Fallback: If no match and it ends with a '0', it's likely a Kobo artifact
                    // Example: Kobo sends '45260' but DB has '4526'
                    if (!existingHousehold && numeroDemande.endsWith('0')) {
                        const fallbackNumero = numeroDemande.substring(0, numeroDemande.length - 1);
                        existingHousehold = await prisma.household.findFirst({
                            where: {
                                organizationId: organizationId,
                                numeroordre: fallbackNumero,
                                deletedAt: null
                            }
                        });
                        
                        if (existingHousehold) {
                            console.log(`[KOBO-SYNC] 💡 Fuzzy match successful: ${numeroDemande} -> ${fallbackNumero}`);
                        }
                    }
                } catch (e) {
                     console.warn(`[KOBO-SYNC] Could not search for existing household by numeroordre [${numeroDemande}]:`, e.message);
                }
            }

            // 🔑 UPSERT STRATEGY: Match by koboSubmissionId OR by existing N° Demande
            const koboSubmissionId = BigInt(submission['_id']);
            const { v4: uuidv4 } = await import('uuid');
            const newHouseholdId = uuidv4();

            // Préparation des données de mise à jour (évite d'écraser des données locales par du vide Kobo)
            const updateData = {
                status: household.status,
                koboData: household.koboData,
                zoneId: household.zoneId,
                region: household.region || undefined,
                name: household.name || undefined,
                phone: household.phone || undefined,
                departement: household.departement || undefined,
                // CRITICAL: On ne remplace pas le village s'il est vide dans Kobo (car Kobo n'a pas la colonne village dans les données préchargées)
                ...(household.village ? { village: household.village } : {}),
                // GPS: On ne met à jour que si Kobo a fourni des coordonnées
                ...(household.latitude ? { latitude: household.latitude } : {}),
                ...(household.longitude ? { longitude: household.longitude } : {}),
                source: 'KOBO',
                assignedTeams: {
                    set: household.assignedTeams
                },
                koboSync: household.koboSync,
                constructionData: household.constructionData,
                koboSubmissionId: koboSubmissionId,
                numeroordre: numeroDemande,
                updatedAt: new Date()
            };

            if (existingHousehold) {
                // ✅ MISE À JOUR: Ménage existant trouvé par N° Demande
                console.log(`[KOBO-SYNC] 🔄 UPDATE existing household: ${existingHousehold.id} with N° ${numeroDemande}`);
                await prisma.household.update({
                    where: { id: existingHousehold.id },
                    data: updateData
                });
            } else {
                // 🆕 CRÉATION ou UPSERT par ID Kobo (si n° demande n'a pas matché)
                await prisma.household.upsert({
                    where: { koboSubmissionId: koboSubmissionId },
                    update: updateData,
                    create: {
                        id: newHouseholdId,
                        organizationId: household.organizationId,
                        zoneId: household.zoneId,
                        status: household.status,
                        region: household.region,
                        name: household.name,
                        phone: household.phone,
                        departement: household.departement,
                        village: household.village,
                        latitude: household.latitude,
                        longitude: household.longitude,
                        owner: household.owner,
                        koboData: household.koboData,
                        location: household.location || {},
                        assignedTeams: household.assignedTeams,
                        koboSync: household.koboSync,
                        constructionData: household.constructionData,
                        koboSubmissionId: koboSubmissionId,
                        numeroordre: numeroDemande,
                        source: 'KOBO',
                        version: 1
                    }
                });
            }

            // Sync PostGIS point
            if (household.location && Array.isArray(household.location.coordinates) && household.location.coordinates.length === 2) {
                await prisma.$executeRaw`
                    UPDATE "Household"
                    SET location_gis = ST_SetSRID(ST_MakePoint(${household.location.coordinates[0]}, ${household.location.coordinates[1]}), 4326)
                    WHERE "koboSubmissionId" = ${koboSubmissionId}
                `;
            }

            applied++;
        } catch (err) {
            console.error(`[KOBO-SYNC] Error applying submission ${submission['_id']}:`, err.message);
            errors++;
        }
    }

    // --- AUTOMATED GRAPPE GENERATION ---
    if (targetProjectId) {
        try {
            await recalculateProjectGrappes(targetProjectId, organizationId);
        } catch (e) {
            console.error('[KOBO-SYNC] ❌ Error during grappe automation:', e.message);
        }
    }

    console.log(`[KOBO-SYNC] ✅ Done — Applied: ${applied}, Skipped: ${skipped}, Errors: ${errors}`);

    // 🔥 AUDIT LOG: Tracer le résultat global de la synchronisation
    await tracerAction({
        organizationId,
        action: 'SYNCHRONISATION_KOBO',
        resource: 'Bordereau Terrain',
        details: { 
            applied, 
            skipped, 
            errors, 
            totalSubmissions: submissions.length,
            since: since || 'FULL_SYNC'
        }
    });

    return { applied, skipped, errors, total: submissions.length };
}
