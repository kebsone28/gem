/**
 * sync.js — Bulk sync endpoint
 * POST /api/sync — push local IndexedDB data to PostgreSQL
 * GET  /api/sync/pull — pull all server data for local cache
 */
const express = require('express');
const { query, queryOne } = require('../db');

const router = express.Router();

/**
 * POST /api/sync
 * Body: { households: [...], projects: [...], teams: [...] }
 * Upserts all data from client to server
 */
router.post('/', async (req, res) => {
    try {
        const { households = [], projects = [], teams = [] } = req.body;
        const results = { households: { ok: 0, err: 0 }, projects: { ok: 0, err: 0 }, teams: { ok: 0, err: 0 } };

        // Sync projects first (FK dependency)
        for (const p of projects) {
            try {
                await query(
                    `INSERT INTO projects (id, name, status, start_date, end_date, config)
                     VALUES ($1,$2,$3,$4,$5,$6)
                     ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name, status = EXCLUDED.status,
                        start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
                        config = EXCLUDED.config`,
                    [p.id, p.name, p.status, p.start_date || p.startDate, p.end_date || p.endDate, JSON.stringify(p.config || {})]
                );
                results.projects.ok++;
            } catch (e) { results.projects.err++; }
        }

        // Sync teams
        for (const t of teams) {
            try {
                await query(
                    `INSERT INTO teams (id, project_id, name, type, zone_id, members_count, config)
                     VALUES ($1,$2,$3,$4,$5,$6,$7)
                     ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name, type = EXCLUDED.type,
                        zone_id = EXCLUDED.zone_id, members_count = EXCLUDED.members_count,
                        config = EXCLUDED.config`,
                    [t.id, t.project_id || t.projectId, t.name, t.type, t.zone_id || t.zoneId, t.members_count || t.membersCount || 0, JSON.stringify(t.config || {})]
                );
                results.teams.ok++;
            } catch (e) { results.teams.err++; }
        }

        // Sync households
        for (const h of households) {
            try {
                await query(
                    `INSERT INTO households (id, project_id, kobo_id, zone, commune, village,
                        latitude, longitude, location, owner, status, status_history,
                        assigned_teams, material, delivery, work_time, progression,
                        etapes_realisees, tech_info, notes, photos, synced_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21, NOW())
                     ON CONFLICT (id) DO UPDATE SET
                        zone = EXCLUDED.zone, commune = EXCLUDED.commune, village = EXCLUDED.village,
                        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
                        location = EXCLUDED.location, owner = EXCLUDED.owner,
                        status = EXCLUDED.status, status_history = EXCLUDED.status_history,
                        assigned_teams = EXCLUDED.assigned_teams, material = EXCLUDED.material,
                        delivery = EXCLUDED.delivery, work_time = EXCLUDED.work_time,
                        progression = EXCLUDED.progression, etapes_realisees = EXCLUDED.etapes_realisees,
                        tech_info = EXCLUDED.tech_info, notes = EXCLUDED.notes, photos = EXCLUDED.photos,
                        synced_at = NOW()`,
                    [
                        h.id, h.project_id || h.projectId || null, h.kobo_id || h.koboId || null,
                        h.zone || null, h.commune || null, h.village || null,
                        h.latitude || null, h.longitude || null,
                        JSON.stringify(h.location || {}), JSON.stringify(h.owner || {}),
                        h.status || 'Attente démarrage',
                        JSON.stringify(h.status_history || h.statusHistory || []),
                        JSON.stringify(h.assigned_teams || h.assignedTeams || []),
                        JSON.stringify(h.material || {}),
                        JSON.stringify(h.delivery || {}),
                        JSON.stringify(h.work_time || h.workTime || {}),
                        h.progression || 0,
                        JSON.stringify(h.etapes_realisees || h.etapesRealisees || []),
                        JSON.stringify(h.tech_info || h.techInfo || {}),
                        JSON.stringify(h.notes || []),
                        JSON.stringify(h.photos || [])
                    ]
                );
                results.households.ok++;
            } catch (e) {
                console.error(`Sync household ${h.id} error:`, e.message);
                results.households.err++;
            }
        }

        // Log sync
        await query(
            `INSERT INTO sync_logs (user_id, type, status, records_count, data)
             VALUES ($1, 'push', 'completed', $2, $3)`,
            [
                req.user?.id || null,
                households.length + projects.length + teams.length,
                JSON.stringify(results)
            ]
        );

        res.json({ success: true, results });
    } catch (err) {
        console.error('Sync error:', err);
        res.status(500).json({ error: 'Erreur synchronisation' });
    }
});

/**
 * GET /api/sync/pull
 * Returns all server data for client-side caching
 * Query params: since (ISO date) - only records updated after this date
 */
router.get('/pull', async (req, res) => {
    try {
        const { since } = req.query;

        let householdSql = 'SELECT * FROM households';
        let projectSql = 'SELECT * FROM projects';
        let teamSql = 'SELECT * FROM teams';
        const params = [];

        if (since) {
            householdSql += ' WHERE updated_at > $1';
            projectSql += ' WHERE updated_at > $1';
            teamSql += ' WHERE created_at > $1';
            params.push(since);
        }

        const [households, projects, teams] = await Promise.all([
            query(householdSql, params),
            query(projectSql, params),
            query(teamSql, params)
        ]);

        res.json({
            households: households.rows,
            projects: projects.rows,
            teams: teams.rows,
            syncedAt: new Date().toISOString()
        });
    } catch (err) {
        console.error('Pull error:', err);
        res.status(500).json({ error: 'Erreur récupération données' });
    }
});

module.exports = router;
