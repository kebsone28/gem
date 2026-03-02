/**
 * projects.js — CRUD routes for projects
 */
const express = require('express');
const { query, queryOne } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const result = await query('SELECT * FROM projects ORDER BY created_at DESC');
        res.json({ data: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const row = await queryOne('SELECT * FROM projects WHERE id = $1', [req.params.id]);
        if (!row) return res.status(404).json({ error: 'Projet introuvable' });
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { id, name, status, start_date, end_date, config: cfg } = req.body;
        const result = await queryOne(
            `INSERT INTO projects (id, name, status, start_date, end_date, config)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [id, name, status || 'active', start_date || null, end_date || null, JSON.stringify(cfg || {})]
        );
        res.status(201).json(result);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Projet avec cet ID existe déjà' });
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { name, status, start_date, end_date, config: cfg } = req.body;
        const result = await queryOne(
            `UPDATE projects SET
                name = COALESCE($2, name), status = COALESCE($3, status),
                start_date = COALESCE($4, start_date), end_date = COALESCE($5, end_date),
                config = COALESCE($6, config)
             WHERE id = $1 RETURNING *`,
            [req.params.id, name, status, start_date, end_date, cfg ? JSON.stringify(cfg) : null]
        );
        if (!result) return res.status(404).json({ error: 'Projet introuvable' });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const result = await query('DELETE FROM projects WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Projet introuvable' });
        res.json({ deleted: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
