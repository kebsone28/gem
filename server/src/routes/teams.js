/**
 * teams.js — CRUD routes for teams
 */
const express = require('express');
const { query, queryOne } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { project_id } = req.query;
        let sql = 'SELECT * FROM teams';
        const params = [];
        if (project_id) { sql += ' WHERE project_id = $1'; params.push(project_id); }
        sql += ' ORDER BY created_at DESC';
        const result = await query(sql, params);
        res.json({ data: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { id, project_id, zone_id, name, type, members_count, config: cfg } = req.body;
        const result = await queryOne(
            `INSERT INTO teams (id, project_id, zone_id, name, type, members_count, config)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [id, project_id || null, zone_id || null, name, type || null, members_count || 0, JSON.stringify(cfg || {})]
        );
        res.status(201).json(result);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Équipe avec cet ID existe déjà' });
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { name, type, zone_id, members_count, config: cfg } = req.body;
        const result = await queryOne(
            `UPDATE teams SET
                name = COALESCE($2, name), type = COALESCE($3, type),
                zone_id = COALESCE($4, zone_id), members_count = COALESCE($5, members_count),
                config = COALESCE($6, config)
             WHERE id = $1 RETURNING *`,
            [req.params.id, name, type, zone_id, members_count, cfg ? JSON.stringify(cfg) : null]
        );
        if (!result) return res.status(404).json({ error: 'Équipe introuvable' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const result = await query('DELETE FROM teams WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Équipe introuvable' });
        res.json({ deleted: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
