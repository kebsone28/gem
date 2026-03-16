/**
 * kobo.controller.js
 *
 * Handles HTTP endpoints for KoboToolbox synchronisation.
 *
 * Routes:
 *   POST /api/kobo/sync   — Trigger a Kobo sync
 *   GET  /api/kobo/status — Return latest Kobo sync metadata
 */

import { syncKoboToDatabase } from '../../services/kobo.service.js';
import prisma from '../../core/utils/prisma.js';

// In-memory cache of last sync time per organization (reset on server restart)
const lastKoboSyncMap = {};

/**
 * POST /api/kobo/sync
 * Triggers a Kobo sync for the authenticated user's organization.
 */
export const triggerKoboSync = async (req, res) => {
    const { organizationId } = req.user;

    try {
        // Find default zone for this organization
        let defaultZoneId = req.body.zoneId || null;

        if (!defaultZoneId) {
            const firstZone = await prisma.zone.findFirst({
                where: { organizationId },
                select: { id: true }
            });
            defaultZoneId = firstZone?.id || null;
        }

        if (!defaultZoneId) {
            return res.status(400).json({
                error: 'Aucune zone trouvée. Créez un projet et une zone avant de synchroniser.'
            });
        }

        const since = lastKoboSyncMap[organizationId] || req.body.since || null;

        console.log(`[KOBO] 🔄 Starting sync for org ${organizationId}, since: ${since || 'beginning'}`);

        const result = await syncKoboToDatabase(organizationId, defaultZoneId, since);

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
