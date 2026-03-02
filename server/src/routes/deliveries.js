/**
 * deliveries.js — CRUD routes for deliveries
 */
const express = require('express');
const { query, queryOne } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { household_id, agent, from, to, limit = 200, offset = 0 } = req.query;
        let sql = 'SELECT d.*, h.zone, h.commune, h.status as household_status FROM deliveries d LEFT JOIN households h ON d.household_id = h.id WHERE 1=1';
        const params = [];
        let idx = 1;

        if (household_id) { sql += ` AND d.household_id = $${idx++}`; params.push(household_id); }
        if (agent) { sql += ` AND d.agent = $${idx++}`; params.push(agent); }
        if (from) { sql += ` AND d.date >= $${idx++}`; params.push(from); }
        if (to) { sql += ` AND d.date <= $${idx++}`; params.push(to); }

        sql += ` ORDER BY d.date DESC LIMIT $${idx++} OFFSET $${idx++}`;
        params.push(parseInt(limit), parseInt(offset));

        const result = await query(sql, params);
        res.json({ data: result.rows });
    } catch (err) {
        console.error('GET /deliveries error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.post('/', async (req, res) => {
    try {
        const d = req.body;
        const result = await queryOne(
            `INSERT INTO deliveries (household_id, agent, date, type, device_id, signature, validation_status, duration_minutes, notes, data)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [d.household_id, d.agent, d.date || new Date(), d.type, d.device_id, d.signature, d.validation_status, d.duration_minutes, d.notes, JSON.stringify(d.data || {})]
        );
        res.status(201).json(result);
    } catch (err) {
        console.error('POST /deliveries error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const result = await query('DELETE FROM deliveries WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Livraison introuvable' });
        res.json({ deleted: true });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
