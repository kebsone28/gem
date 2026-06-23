/**
 * gedcollect.service.js
 *
 * Service de synchronisation avec l'API GedCollect (GEDToolbox).
 * Fonctionne de façon analogue à kobo.service.js mais utilise les
 * variables d'environnement GED_API_URL, GED_TOKEN et GED_FORM_ID.
 *
 * Le service expose deux fonctions principales :
 *   - fetchGedCollectSubmissions(token, assetUid, since?) → récupère les
 *     soumissions depuis le serveur GedCollect.
 *   - syncGedCollectToDatabase(organizationId, defaultZoneId, since, projectId,
 *     userId) → transforme chaque soumission en ménage et l'upsert dans la DB.
 */

import prisma from '../core/utils/prisma.js';
import { transformRowToHousehold } from './kobo.mapping.js'; // reuse existing mapping logic – field names are compatible
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
        logger.warn(`[GEDCOLLECT] Échec du fetch (retries left ${retries}) – ${e.message}`);
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
 * Le processus est très similaire à syncKoboToDatabase : on récupère les
 * soumissions, on les transforme en objet ménage via `transformRowToHousehold`
 * (les champs Kobo et GedCollect sont compatibles) et on effectue un upsert.
 */
export async function syncGedCollectToDatabase(
  organizationId,
  defaultZoneId,
  since = null,
  projectId,
  userId
) {
  logger.info('[GEDCOLLECT] Démarrage de la synchronisation', {
    organizationId,
    defaultZoneId,
    since,
    projectId,
  });

  const submissions = await fetchGedCollectSubmissions();
  logger.info(`[GEDCOLLECT] ${submissions.length} soumissions récupérées`);

  let applied = 0,
    skipped = 0,
    errors = 0;

  for (const sub of submissions) {
    try {
      const household = await transformRowToHousehold(sub, organizationId, defaultZoneId, projectId, {}, null);
      if (!household) {
        skipped++;
        continue;
      }

      await prisma.household.upsert({
        where: { id: household.id },
        update: household,
        create: household,
      });
      applied++;
    } catch (e) {
      errors++;
      logger.error('[GEDCOLLECT] Erreur lors du upsert d\'une soumission', e);
    }
  }

  logger.info('[GEDCOLLECT] Synchronisation terminée', { applied, skipped, errors });
  return { applied, skipped, errors, total: submissions.length };
}
