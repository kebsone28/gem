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
    // Common Kobo field name patterns — adjust to your form
    const id = submission['_id']
            || submission['numeroordre']
            || submission['id_menage']
            || String(submission['_id']);

    const lat = parseFloat(submission['_geolocation']?.[0] || submission['latitude'] || 0);
    const lon = parseFloat(submission['_geolocation']?.[1] || submission['longitude'] || 0);

    return {
        id: String(id),
        organizationId,
        zoneId: submission['zone_id'] || defaultZoneId,
        status: submission['statut'] || submission['status'] || 'Non débuté',
        owner: {
            nom: submission['nom_prenom'] || submission['chef_menage'] || '',
            telephone: submission['telephone'] || ''
        },
        koboData: submission,  // store raw submission for auditing
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
 * @param {string} organizationId
 * @param {string} defaultZoneId - fallback zone ID for new submissions
 * @param {string|null} since - ISO timestamp for incremental sync
 * @returns {Promise<{applied: number, skipped: number, errors: number}>}
 */
export async function syncKoboToDatabase(organizationId, defaultZoneId, since = null) {
    const submissions = await fetchKoboSubmissions(since);

    let applied = 0;
    let skipped = 0;
    let errors  = 0;

    for (const submission of submissions) {
        try {
            const household = mapSubmissionToHousehold(submission, organizationId, defaultZoneId);

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
                    ...(household.location ? { location: household.location } : {}),
                    updatedAt: new Date()
                },
                create: {
                    id: household.id,
                    organizationId: household.organizationId,
                    zoneId: household.zoneId,
                    status: household.status,
                    owner: household.owner,
                    koboData: household.koboData,
                    location: household.location || {},
                    version: 1
                }
            });

            applied++;
        } catch (err) {
            console.error(`[KOBO-SYNC] Error applying submission ${submission['_id']}:`, err.message);
            errors++;
        }
    }

    console.log(`[KOBO-SYNC] ✅ Done — Applied: ${applied}, Skipped: ${skipped}, Errors: ${errors}`);
    return { applied, skipped, errors, total: submissions.length };
}
