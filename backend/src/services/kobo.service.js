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

const KOBO_API_URL = process.env.KOBO_API_URL || 'https://kf.kobotoolbox.org';
const KOBO_TOKEN   = process.env.KOBO_TOKEN || '';
const KOBO_FORM_ID = process.env.KOBO_FORM_ID || '';

/**
 * Fetches submissions from KoboToolbox API since a given date.
 * @param {string|null} since - ISO timestamp for incremental sync
 * @returns {Promise<any[]>} Array of raw Kobo submissions
 */
export async function fetchKoboSubmissions(since = null) {
    if (!KOBO_TOKEN || !KOBO_FORM_ID) {
        throw new Error('KOBO_TOKEN ou KOBO_FORM_ID non configurés dans les variables d\'environnement.');
    }

    // Build query — Kobo supports ?query= with MongoDB-style JSON filter
    let url = `${KOBO_API_URL}/api/v2/assets/${KOBO_FORM_ID}/data/?format=json&limit=5000`;
    if (since) {
        const sinceDate = new Date(since).toISOString();
        // Kobo filter on submission time
        url += `&query={"_submission_time":{"$gte":"${sinceDate}"}}`;
    }

    const response = await fetch(url, {
        headers: {
            Authorization: `Token ${KOBO_TOKEN}`,
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
 * Customize the field mapping to match your Kobo form.
 *
 * @param {object} submission - Raw Kobo submission
 * @param {string} organizationId
 * @param {string} defaultZoneId
 */
function mapSubmissionToHousehold(submission, organizationId, defaultZoneId) {
    const data = submission; // Kobo directly provides fields at root in kobo-v2 results
    
    const id = submission['_id']
            || submission['numeroordre']
            || submission['id_menage']
            || String(submission['_id']);

    const lat = parseFloat(submission['_geolocation']?.[0] || submission['latitude'] || submission['TYPE_DE_VISITE/latitude_key'] || 0);
    const lon = parseFloat(submission['_geolocation']?.[1] || submission['longitude'] || submission['TYPE_DE_VISITE/longitude_key'] || 0);

    const region = submission['region'] || 
                   submission['region_administrative'] || 
                   submission['region_key'] || 
                   submission['TYPE_DE_VISITE/region_key'] || 
                   '';

    return {
        id: String(id),
        organizationId,
        zoneId: submission['zone_id'] || defaultZoneId,
        status: submission['statut'] || submission['status'] || 'Non débuté',
        
        name: submission['nom_prenom'] || submission['chef_menage'] || submission['nom_chef_menage'] || submission['TYPE_DE_VISITE/nom_key'] || '',
        phone: submission['telephone'] || submission['phone'] || submission['numero'] || submission['TYPE_DE_VISITE/telephone_key'] || '',
        region: region.trim(),
        departement: submission['departement'] || submission['dept'] || '',
        village: submission['village'] || submission['localite'] || '',
        
        latitude: lat || null,
        longitude: lon || null,
        source: 'Kobo',

        owner: {
            nom: submission['nom_prenom'] || submission['chef_menage'] || submission['TYPE_DE_VISITE/nom_key'] || '',
            telephone: submission['telephone'] || submission['TYPE_DE_VISITE/telephone_key'] || ''
        },
        koboData: submission,
        location: (lat && lon) ? {
            type: 'Point',
            coordinates: [lon, lat]
        } : null,
        version: 1,
        updatedAt: new Date(submission['_submission_time'] || Date.now())
    };
}

/**
 * Main sync function: pull from Kobo, apply to DB.
 * Now dynamically generates zones based on the "region" field.
 * 
 * @param {string} organizationId
 * @param {string} fallbackZoneId - zone used if no region is found
 * @param {string|null} since - ISO timestamp for incremental sync
 * @returns {Promise<{applied: number, skipped: number, errors: number}>}
 */
export async function syncKoboToDatabase(organizationId, fallbackZoneId, since = null) {
    const submissions = await fetchKoboSubmissions(since);

    let applied = 0;
    let skipped = 0;
    let errors  = 0;

    // Local cache for zones to avoid hitting DB for every household
    const zoneCache = {};

    // Get the projectId of the fallback zone to know where to create new zones
    let targetProjectId = null;
    try {
        const fallbackZone = await prisma.zone.findUnique({ where: { id: fallbackZoneId } });
        targetProjectId = fallbackZone?.projectId;
    } catch (e) {
        console.warn('[KOBO-SYNC] Could not resolve target project for dynamic zones:', e.message);
    }

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

            const household = mapSubmissionToHousehold(submission, organizationId, zoneId);

            if (!household.id || household.id === 'undefined') {
                skipped++;
                continue;
            }

            // Upsert into database
            await prisma.household.upsert({
                where: { id: household.id },
                update: {
                    status: household.status,
                    koboData: household.koboData,
                    zoneId: household.zoneId,
                    region: household.region,
                    name: household.name,
                    phone: household.phone,
                    departement: household.departement,
                    village: household.village,
                    latitude: household.latitude,
                    longitude: household.longitude,
                    source: household.source,
                    updatedAt: new Date()
                },
                create: {
                    id: household.id,
                    organizationId: household.organizationId,
                    zoneId: household.zoneId,
                    status: household.status,
                    region: household.region,
                    owner: household.owner,
                    koboData: household.koboData,
                    location: household.location || {},
                    source: household.source,
                    version: 1
                }
            });

            // Sync PostGIS point
            if (household.location && Array.isArray(household.location.coordinates) && household.location.coordinates.length === 2) {
                await prisma.$executeRaw`
                    UPDATE "Household"
                    SET location_gis = ST_SetSRID(ST_MakePoint(${household.location.coordinates[0]}, ${household.location.coordinates[1]}), 4326)
                    WHERE id = ${household.id}
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
    return { applied, skipped, errors, total: submissions.length };
}
