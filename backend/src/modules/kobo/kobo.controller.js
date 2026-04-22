/**
 * kobo.controller.js
 *
 * Handles HTTP endpoints for KoboToolbox synchronisation.
 *
 * Routes:
 *   GET  /api/kobo/status — Return latest Kobo sync metadata
 *   POST /api/kobo/auto-detect — Auto-detect and generate field mapping
 *   GET /api/kobo/mapping — Get current field mapping
 *   POST /api/kobo/migrate — Migrate mapping when form changes
 */

import { syncKoboToDatabase, fetchKoboSubmissions } from '../../services/kobo.service.js';
import { koboEngine } from './koboEngineMaster.js';
import prisma from '../../core/utils/prisma.js';

/**
 * POST /api/kobo/test-connection
 * Tests if the provided Kobo credentials are valid.
 */
export const testKoboConnection = async (req, res) => {
    const { token, assetUid } = req.body;
    try {
        // Try fetching with a limit of 1 to minimize data transfer
        // We use fetchKoboSubmissions which now takes token and assetUid
        await fetchKoboSubmissions(token, assetUid, null);
        res.json({ success: true, message: 'Connexion KoBo établie avec succès !' });
    } catch (e) {
        console.error('[KOBO-TEST] Connection failed:', e.message);
        res.status(400).json({ success: false, error: e.message });
    }
};

// In-memory cache of last sync time per organization (reset on server restart)
const lastKoboSyncMap = {};

/**
 * GET /api/kobo/status
 * Returns metadata about the last Kobo sync and configuration status.
 */
export const getKoboStatus = async (req, res) => {
    const { organizationId } = req.user;
    const configured = !!(process.env.KOBO_TOKEN && process.env.KOBO_FORM_ID);

    let lastSync = null;
    try {
        lastSync = await prisma.syncLog.findFirst({
            where: { organizationId, source: 'kobo' },
            orderBy: { syncedAt: 'desc' }
        });
    } catch (_) { /* Table may not exist */ }

    return res.json({
        configured,
        koboApiUrl: process.env.KOBO_API_URL || 'https://kf.kobotoolbox.org',
        formId: process.env.KOBO_FORM_ID || null,
        lastSyncAt: lastKoboSyncMap[organizationId] || lastSync?.syncedAt || null,
        lastResult: lastSync ? {
            applied: lastSync.applied,
            skipped: lastSync.skipped,
            errors: lastSync.errors,
            total: lastSync.total
        } : null
    });
};

/**
 * POST /api/kobo/webhook
 * Receives automated push notifications from KoboToolbox.
 */
export const handleKoboWebhook = async (req, res) => {
    try {
        console.log('[WEBHOOK] Kobo data push received.');
        
        // As webhooks aren't authenticated via JWT, we must rely on a system/service account
        // or a default fallback organization since Kobo doesn't know about `req.user.organizationId`
        const sysOrg = await prisma.organization.findFirst();
        if (!sysOrg) {
            console.error('[WEBHOOK] System has no organizations to sync to.');
            return res.status(500).json({ error: 'System unconfigured' });
        }

        const project = await prisma.project.findFirst({ where: { organizationId: sysOrg.id } });
        const objZone = await prisma.zone.findFirst({ where: { projectId: project?.id } });

        if (!project || !objZone) {
            return res.status(500).json({ error: 'No default target found for auto-sync' });
        }

        // Delegate cleanly to existing manual sync mechanism!
        // We will pass the exact object Kobo sent to avoid re-fetching!
        const result = await syncKoboToDatabase(sysOrg.id, objZone.id, null, [req.body]);

        return res.json({ success: true, message: 'Webhook processed', result });
    } catch (e) {
        console.error('[WEBHOOK-ERROR] Error handling webhook:', e.message);
        return res.status(500).json({ error: 'Processing error' });
    }
};

/**
 * POST /api/kobo/auto-detect
 * Auto-détecte les champs du formulaire Kobo et génère le mapping
 */
export const autoDetectMapping = async (req, res) => {
    const { organizationId } = req.user;
    const { koboAssetId, koboServerUrl } = req.body;

    if (!koboAssetId) {
        return res.status(400).json({ error: 'koboAssetId requis' });
    }

    const serverUrl = koboServerUrl || process.env.KOBO_API_URL || 'https://kf.kobotoolbox.org';

    try {
        const mapping = await koboEngine.generateMapping(koboAssetId, serverUrl);
        await koboEngine.saveMapping(organizationId, koboAssetId, mapping);

        // Calculer le score de confiance global
        const confidences = Object.values(mapping.fields).map(f => f.confidence);
        const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

        res.json({
            success: true,
            mapping,
            confidence: Math.round(avgConfidence),
            message: `Mapping généré avec ${Math.round(avgConfidence)}% de confiance`
        });
    } catch (error) {
        console.error('[KOBO_AUTO_DETECT] Error:', error.message);
        res.status(500).json({ error: 'Échec de la détection automatique', details: error.message });
    }
};

/**
 * GET /api/kobo/mapping
 * Retourne le mapping actuel pour un formulaire Kobo
 */
export const getMapping = async (req, res) => {
    const { organizationId } = req.user;
    const { koboAssetId } = req.query;

    if (!koboAssetId) {
        return res.status(400).json({ error: 'koboAssetId requis' });
    }

    try {
        const mapping = await koboEngine.getMapping(organizationId, koboAssetId, 
            process.env.KOBO_API_URL || 'https://kf.kobotoolbox.org');
        
        res.json({ success: true, mapping });
    } catch (error) {
        console.error('[KOBO_GET_MAPPING] Error:', error.message);
        res.status(500).json({ error: 'Erreur lors de la récupération du mapping' });
    }
};

/**
 * POST /api/kobo/migrate
 * Détecte les changements dans le formulaire et migre le mapping
 */
export const migrateMapping = async (req, res) => {
    const { organizationId } = req.user;
    const { koboAssetId, koboServerUrl } = req.body;

    if (!koboAssetId) {
        return res.status(400).json({ error: 'koboAssetId requis' });
    }

    const serverUrl = koboServerUrl || process.env.KOBO_API_URL || 'https://kf.kobotoolbox.org';

    try {
        const result = await koboEngine.migrateMapping(organizationId, koboAssetId, serverUrl);
        
        res.json({
            success: true,
            ...result,
            message: result.migrated 
                ? `Migration effectuée: ${result.changes.reason}`
                : 'Aucun changement détecté'
        });
    } catch (error) {
        console.error('[KOBO_MIGRATE] Error:', error.message);
        res.status(500).json({ error: 'Échec de la migration', details: error.message });
    }
};

/**
 * POST /api/kobo/transform
 * Transforme des données Kobo en format GEM usando le mapping
 */
export const transformData = async (req, res) => {
    const { organizationId } = req.user;
    const { koboAssetId, koboData, koboServerUrl } = req.body;

    if (!koboAssetId || !koboData) {
        return res.status(400).json({ error: 'koboAssetId et koboData requis' });
    }

    const serverUrl = koboServerUrl || process.env.KOBO_API_URL || 'https://kf.kobotoolbox.org';

    try {
        const mapping = await koboEngine.getMapping(organizationId, koboAssetId, serverUrl);
        const transformed = koboEngine.transformData(koboData, mapping);
        
        res.json({ success: true, transformed, mapping });
    } catch (error) {
        console.error('[KOBO_TRANSFORM] Error:', error.message);
        res.status(500).json({ error: 'Échec de la transformation', details: error.message });
    }
};
