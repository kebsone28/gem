/**
 * kobo.controller.js
 *
 * Handles HTTP endpoints for KoboToolbox synchronisation.
 *
 * Routes:
 *   POST /api/kobo/sync   — Trigger a Kobo sync
 *   GET  /api//status — Return latest Kobo sync metadata
 */

import { syncKoboToDatabase, fetchKoboSubmissions } from '../../services/kobo.service.js';
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
 * POST /api/kobo/sync
 * Triggers a Kobo sync for the authenticated user's organization.
 */
export const triggerKoboSync = async (req, res) => {
    const { organizationId } = req.user;

    try {
        // 1. Prefer provided zoneId or projectId
        let defaultZoneId = req.body.zoneId || null;
        const targetProjectId = req.body.projectId;

        if (!defaultZoneId) {
            // Find a suitable project: provided one, or the first existing one
            let project = null;
            if (targetProjectId) {
                project = await prisma.project.findUnique({ where: { id: targetProjectId } });
            if (!project) {
                const msg = `Project ${targetProjectId} not found for organization ${organizationId}. Please refresh your project selection and retry.`;
                console.error(`[KOBO] ${msg}`);
                return res.status(400).json({ success: false, error: msg });
            }
        }


            if (!project) {
                console.log(`[KOBO] 💡 Auto-creating default project for org ${organizationId}`);
                project = await prisma.project.create({
                    data: {
                        name: 'Projet Kobo Global',
                        organizationId,
                        status: 'active',
                        budget: '0',
                        duration: 0,
                        totalHouses: 0,
                        config: {}
                    }
                });
            }

            // Find a zone for THIS project
            const existingZone = await prisma.zone.findFirst({ 
                where: { projectId: project.id, organizationId } 
            });

            if (existingZone) {
                defaultZoneId = existingZone.id;
            } else {
                console.log(`[KOBO] 💡 Auto-creating default zone for project ${project.id}`);
                const newZone = await prisma.zone.create({
                    data: {
                        name: 'Zone Kobo A',
                        projectId: project.id,
                        organizationId
                    }
                });
                defaultZoneId = newZone.id;
            }
        }

        if (!defaultZoneId) {
            return res.status(500).json({ error: 'Failed to find or create a default sync zone.' });
        }

        const since = lastKoboSyncMap[organizationId] || req.body.since || null;

        console.log(`[KOBO] 🔄 Starting sync for org ${organizationId}, project ${targetProject?.id || 'default'}, since: ${since || 'beginning'}`);
        
        const result = await syncKoboToDatabase(organizationId, defaultZoneId, since, targetProject?.id);

        // Update last sync timestamp
        lastKoboSyncMap[organizationId] = new Date().toISOString();

        // Log to sync_logs table (non-blocking)
        try {
            await prisma.syncLog.create({
                data: {
                    organizationId,
                    source: 'kobo',
                    applied: result.applied,
                    skipped: result.skipped,
                    errors: result.errors,
                    total: result.total,
                    syncedAt: new Date()
                }
            });
        } catch (_) { /* Table may not exist yet — non-blocking */ }

        return res.json({
            success: true,
            message: 'Synchronisation Kobo terminée',
            lastSyncAt: lastKoboSyncMap[organizationId],
            result
        });

    } catch (error) {
        console.error('[KOBO] Error during sync:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

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
