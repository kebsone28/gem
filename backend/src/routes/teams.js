import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/teams
 * Récupérer les équipes
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { projectId } = req.query;

    let sql = `SELECT t.*, u.first_name, u.last_name
               FROM teams t
               LEFT JOIN users u ON t.supervisor_id = u.id`;

    let params = [];

    if (projectId) {
      sql += ` WHERE t.project_id = $1`;
      params = [projectId];
    }

    const result = await query(sql, params);
    res.json({ teams: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/teams
 * Créer une équipe
 */
router.post('/', authenticate, authorize(['ADMIN', 'SUPERVISEUR']), async (req, res, next) => {
  try {
    const { projectId, name, teamType, supervisorId, capacityPerDay } = req.body;

    const result = await query(
      `INSERT INTO teams (project_id, name, team_type, supervisor_id, capacity_per_day)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [projectId, name, teamType, supervisorId, capacityPerDay]
    );

    logger.success(`✅ Équipe créée: ${name}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
