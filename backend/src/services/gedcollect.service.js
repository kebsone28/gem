/**
 * gedcollect.service.js
 *
 * Service de synchronisation avec l'API GedCollect (GEDToolbox).
 * Fonctionne de facon analogue a kobo.service.js mais utilise les
 * variables d'environnement GED_API_URL, GED_TOKEN et GED_FORM_ID.
 *
 * Le service expose deux fonctions principales :
 *   - fetchGedCollectSubmissions(token, assetUid, since?) -> recupere les
 *     soumissions depuis le serveur GedCollect.
 *   - syncGedCollectToDatabase(organizationId, defaultZoneId, since, projectId,
 *     userId) -> transforme chaque soumission en menage et l'upsert dans la DB.
 */

import { v4 as uuidv4 } from 'uuid';
import prisma from '../core/utils/prisma.js';
import { transformRowToHousehold, extractNumeroOrdre } from './kobo.mapping.js';
import logger from '../utils/logger.js';

const GED_API_URL = process.env.GED_API_URL || 'https://gedcollect.example.com';
const GED_TOKEN = process.env.GED_TOKEN || '';
const GED_FORM_ID = process.env.GED_FORM_ID || '';

/** Simple helper to delay between retries */
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Fetch submissions from GedCollect.
 * The GedCollect API mirrors Kobo's v2 endpoint, so we can reuse the same query
 * parameters (limit, start, optional _submission_time filter).
 */
export async function fetchGedCollectSubmissions(token, assetUid, since = null) {
  const finalToken = token || GED_TOKEN;
  const finalAssetUid = assetUid || GED_FORM_ID;

  if (!finalToken || !finalAssetUid) {
    const err = new Error('Configuration GedCollect manquante (Token ou ID de formulaire).');
    err.statusCode = 400;
    throw err;
  }

  let all = [];
  let start = 0;
  const limit = 5000;
  let hasMore = true;

  while (hasMore) {
    let url = `${GED_API_URL}/api/v2/assets/${finalAssetUid}/data/?format=json&limit=${limit}&start=${start}`;
    if (since) {
      const sinceDate = new Date(since).toISOString();
      url += `&query={"_submission_time":{"$gte":"${sinceDate}"}}`;
    }

    let retries = 3;
    let success = false;
    let response, data;
    while (retries > 0 && !success) {
      try {
        response = await fetch(url, {
          headers: {
            Authorization: `Token ${finalToken}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) {
          const err = new Error(`GedCollect API error ${response.status}`);
          err.statusCode = response.status;
          throw err;
        }
        data = await response.json();
        success = true;
      } catch (e) {
        retries--;
        logger.warn(`[GEDCOLLECT] Echec du fetch (retries left ${retries}) - ${e.message}`);
        if (retries === 0) {
          const finalErr = new Error(`GedCollect API unreachable after retries: ${e.message}`);
          finalErr.statusCode = e.statusCode || 500;
          throw finalErr;
        }
        await delay((3 - retries) * 2000);
      }
    }

    const results = data.results || [];
    all = all.concat(results);
    if (results.length < limit) {
      hasMore = false;
    } else {
      start += limit;
    }
  }

  return all;
}

/**
 * Synchronise les soumissions GedCollect vers la base Prisma.
 * Logique de matching identique a syncKoboToDatabase :
 *   1. Chercher par numeroordre (business key)
 *   2. Si trouve -> UPDATE (pas de doublon)
 *   3. Si pas trouve -> CREATE avec UUID genere
 */
export async function syncGedCollectToDatabase(
  organizationId,
  defaultZoneId,
  since = null,
  projectId,
  userId
) {
  logger.info('[GEDCOLLECT] Demarrage de la synchronisation', {
    organizationId,
    defaultZoneId,
    since,
    projectId,
  });

  const submissions = await fetchGedCollectSubmissions();
  logger.info(`[GEDCOLLECT] ${submissions.length} soumissions recuperees`);

  let applied = 0,
    skipped = 0,
    errors = 0;

  for (const sub of submissions) {
    try {
      const household = await transformRowToHousehold(
        sub,
        organizationId,
        defaultZoneId,
        projectId,
        {},
        null
      );
      if (!household) {
        skipped++;
        continue;
      }

      // Extract numeroordre from submission (business key for matching)
      const numeroordreRaw = extractNumeroOrdre(sub, {});
      const numeroordre = numeroordreRaw ? String(numeroordreRaw).trim().toUpperCase() : null;

      let existingHousehold = null;

      // 1. Try to match by numeroordre (business key)
      if (numeroordre) {
        existingHousehold = await prisma.household.findFirst({
          where: {
            organizationId,
            OR: [
              { numeroordre: { equals: numeroordre, mode: 'insensitive' } },
              { id: { equals: numeroordre, mode: 'insensitive' } },
            ],
            deletedAt: null,
          },
          select: { id: true, version: true, manualOverrides: true },
        });
      }

      if (existingHousehold) {
        // UPDATE existing household
        logger.info(
          `[GEDCOLLECT] UPDATE existing household: ${existingHousehold.id} (N: ${numeroordre})`
        );
        await prisma.household.update({
          where: { id: existingHousehold.id },
          data: {
            status: household.status,
            zoneId: household.zoneId || defaultZoneId,
            projectId: household.projectId || projectId || undefined,
            region: household.region || undefined,
            name: household.name || undefined,
            phone: household.phone || undefined,
            numeroordre: numeroordre || undefined,
            departement: household.departement || undefined,
            village: household.village || undefined,
            latitude: household.latitude || undefined,
            longitude: household.longitude || undefined,
            location: household.location || {},
            owner: household.owner || {},
            koboData: household.koboData || {},
            source: 'GEDTOOLBOX',
            version: { increment: 1 },
            updatedAt: new Date(),
          },
          select: { id: true },
        });
      } else {
        // CREATE new household
        const newId = uuidv4();
        logger.info(`[GEDCOLLECT] CREATE new household: ${newId} (N: ${numeroordre})`);
        await prisma.household.create({
          data: {
            id: newId,
            organizationId,
            zoneId: household.zoneId || defaultZoneId,
            projectId: household.projectId || projectId || undefined,
            status: household.status || 'planned',
            region: household.region || null,
            name: household.name || null,
            phone: household.phone || null,
            numeroordre: numeroordre || null,
            departement: household.departement || null,
            village: household.village || null,
            latitude: household.latitude || null,
            longitude: household.longitude || null,
            location: household.location || {},
            owner: household.owner || {},
            koboData: household.koboData || {},
            source: 'GEDTOOLBOX',
            version: 1,
          },
          select: { id: true },
        });
      }

      applied++;
    } catch (e) {
      errors++;
      logger.error("[GEDCOLLECT] Erreur lors du upsert d'une soumission:", e.message);
    }
  }

  logger.info(`[GEDCOLLECT] Termine: ${applied} appliques, ${skipped} sautes, ${errors} erreurs`);
  return { applied, skipped, errors, total: submissions.length };
}
