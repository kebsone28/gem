/**
 * households.js — CRUD routes for households
 * GET    /api/households
 * GET    /api/households/:id
 * POST   /api/households
 * PUT    /api/households/:id
 * DELETE /api/households/:id
 * POST   /api/households/bulk
 */
const express = require('express');
const { query, queryOne } = require('../db');

const router = express.Router();

/**
 * GET /api/households
 * Query params: zone, status, commune, limit, offset
 */
router.get('/', async (req, res) => {
    try {
        const { zone, status, commune, limit = 500, offset = 0 } = req.query;
        let sql = 'SELECT * FROM households WHERE 1=1';
        const params = [];
        let idx = 1;

        if (zone) { sql += ` AND zone = $${idx++}`; params.push(zone); }
        if (status) { sql += ` AND status = $${idx++}`; params.push(status); }
        if (commune) { sql += ` AND commune = $${idx++}`; params.push(commune); }

        sql += ` ORDER BY updated_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await query(sql, params);

        // Also get total count for pagination
        let countSql = 'SELECT COUNT(*) FROM households WHERE 1=1';
        const countParams = [];
        let ci = 1;
        if (zone) { countSql += ` AND zone = $${ci++}`; countParams.push(zone); }
        if (status) { countSql += ` AND status = $${ci++}`; countParams.push(status); }
        if (commune) { countSql += ` AND commune = $${ci++}`; countParams.push(commune); }

        const countResult = await query(countSql, countParams);

        res.json({
            data: result.rows,
            total: parseInt(countResult.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (err) {
        console.error('GET /households error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/households/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const row = await queryOne('SELECT * FROM households WHERE id = $1', [req.params.id]);
        if (!row) return res.status(404).json({ error: 'Ménage introuvable' });
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/households
 * Body: household object
 */
router.post('/', async (req, res) => {
    try {
        const h = req.body;
        const result = await queryOne(
            `INSERT INTO households (id, project_id, kobo_id, zone, commune, village,
                latitude, longitude, location, owner, status, status_history,
                assigned_teams, material, delivery, work_time, progression,
                etapes_realisees, tech_info, notes, photos)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
             RETURNING *`,
            [
                h.id, h.project_id || null, h.kobo_id || null,
                h.zone || null, h.commune || null, h.village || null,
                h.latitude || null, h.longitude || null,
                JSON.stringify(h.location || {}),
                JSON.stringify(h.owner || {}),
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
        res.status(201).json(result);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Ménage avec cet ID existe déjà' });
        }
        console.error('POST /households error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * PUT /api/households/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const h = req.body;
        const result = await queryOne(
            `UPDATE households SET
                zone = COALESCE($2, zone),
                commune = COALESCE($3, commune),
                village = COALESCE($4, village),
                latitude = COALESCE($5, latitude),
                longitude = COALESCE($6, longitude),
                location = COALESCE($7, location),
                owner = COALESCE($8, owner),
                status = COALESCE($9, status),
                status_history = COALESCE($10, status_history),
                assigned_teams = COALESCE($11, assigned_teams),
                material = COALESCE($12, material),
                delivery = COALESCE($13, delivery),
                work_time = COALESCE($14, work_time),
                progression = COALESCE($15, progression),
                etapes_realisees = COALESCE($16, etapes_realisees),
                tech_info = COALESCE($17, tech_info),
                notes = COALESCE($18, notes),
                photos = COALESCE($19, photos),
                synced_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [
                req.params.id,
                h.zone || null, h.commune || null, h.village || null,
                h.latitude || null, h.longitude || null,
                h.location ? JSON.stringify(h.location) : null,
                h.owner ? JSON.stringify(h.owner) : null,
                h.status || null,
                h.status_history || h.statusHistory ? JSON.stringify(h.status_history || h.statusHistory) : null,
                h.assigned_teams || h.assignedTeams ? JSON.stringify(h.assigned_teams || h.assignedTeams) : null,
                h.material ? JSON.stringify(h.material) : null,
                h.delivery ? JSON.stringify(h.delivery) : null,
                h.work_time || h.workTime ? JSON.stringify(h.work_time || h.workTime) : null,
                h.progression != null ? h.progression : null,
                h.etapes_realisees || h.etapesRealisees ? JSON.stringify(h.etapes_realisees || h.etapesRealisees) : null,
                h.tech_info || h.techInfo ? JSON.stringify(h.tech_info || h.techInfo) : null,
                h.notes ? JSON.stringify(h.notes) : null,
                h.photos ? JSON.stringify(h.photos) : null
            ]
        );
        if (!result) return res.status(404).json({ error: 'Ménage introuvable' });
        res.json(result);
    } catch (err) {
        console.error('PUT /households error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * DELETE /api/households/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const result = await query('DELETE FROM households WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Ménage introuvable' });
        res.json({ deleted: true, id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/households/bulk
 * Body: { households: [...] }
 * Upsert: insert or update based on id
 */
router.post('/bulk', async (req, res) => {
    try {
        const { households } = req.body;
        if (!Array.isArray(households) || households.length === 0) {
            return res.status(400).json({ error: 'Tableau households requis' });
        }

        let inserted = 0, updated = 0, errors = 0;

        for (const h of households) {
            try {
                const existing = await queryOne('SELECT id FROM households WHERE id = $1', [h.id]);
                if (existing) {
                    await query(
                        `UPDATE households SET
                            zone = $2, commune = $3, status = $4,
                            owner = $5, material = $6, delivery = $7,
                            work_time = $8, location = $9, assigned_teams = $10,
                            status_history = $11, notes = $12, photos = $13,
                            tech_info = $14, progression = $15, synced_at = NOW()
                         WHERE id = $1`,
                        [
                            h.id, h.zone || null, h.commune || null, h.status || null,
                            JSON.stringify(h.owner || {}),
                            JSON.stringify(h.material || {}),
                            JSON.stringify(h.delivery || {}),
                            JSON.stringify(h.work_time || h.workTime || {}),
                            JSON.stringify(h.location || {}),
                            JSON.stringify(h.assigned_teams || h.assignedTeams || []),
                            JSON.stringify(h.status_history || h.statusHistory || []),
                            JSON.stringify(h.notes || []),
                            JSON.stringify(h.photos || []),
                            JSON.stringify(h.tech_info || h.techInfo || {}),
                            h.progression || 0
                        ]
                    );
                    updated++;
                } else {
                    await query(
                        `INSERT INTO households (id, zone, commune, status, owner, material,
                            delivery, work_time, location, assigned_teams, status_history,
                            notes, photos, tech_info, progression)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
                        [
                            h.id, h.zone || null, h.commune || null,
                            h.status || 'Attente démarrage',
                            JSON.stringify(h.owner || {}),
                            JSON.stringify(h.material || {}),
                            JSON.stringify(h.delivery || {}),
                            JSON.stringify(h.work_time || h.workTime || {}),
                            JSON.stringify(h.location || {}),
                            JSON.stringify(h.assigned_teams || h.assignedTeams || []),
                            JSON.stringify(h.status_history || h.statusHistory || []),
                            JSON.stringify(h.notes || []),
                            JSON.stringify(h.photos || []),
                            JSON.stringify(h.tech_info || h.techInfo || {}),
                            h.progression || 0
                        ]
                    );
                    inserted++;
                }
            } catch (rowErr) {
                console.error(`Bulk error for ${h.id}:`, rowErr.message);
                errors++;
            }
        }

        res.json({ inserted, updated, errors, total: households.length });
    } catch (err) {
        console.error('POST /households/bulk error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
