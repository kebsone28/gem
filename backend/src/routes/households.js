import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/households
 * Récupérer les ménages
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { projectId, status } = req.query;
    let sql = `SELECT * FROM households WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    if (projectId) {
      sql += ` AND project_id = $${paramCount}`;
      params.push(projectId);
      paramCount++;
    }

    if (status) {
      sql += ` AND status = $${paramCount}`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await query(sql, params);
    res.json({ households: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/households
 * Créer un ménage
 */
router.post('/', authenticate, authorize(['ADMIN', 'SUPERVISEUR', 'TECHNICIEN']), async (req, res, next) => {
  try {
    const { projectId, code, village, numPersons, estimatedCost } = req.body;

    const result = await query(
      `INSERT INTO households (project_id, code, village, num_persons, estimated_cost, status)
       VALUES ($1, $2, $3, $4, $5, 'planned')
       RETURNING *`,
      [projectId, code, village, numPersons, estimatedCost]
    );

    logger.success(`✅ Ménage créé: ${code}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/households/:id
 * Mettre à jour le statut d'un ménage
 */
router.patch('/:id', authenticate, authorize(['ADMIN', 'SUPERVISEUR', 'TECHNICIEN']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, actualCost, installationDate } = req.body;

    const result = await query(
      `UPDATE households 
       SET status = COALESCE($1, status),
           actual_cost = COALESCE($2, actual_cost),
           installation_date = COALESCE($3, installation_date),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, actualCost, installationDate, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ménage non trouvé' });
    }

    logger.success(`✅ Ménage ${id} mis à jour par ${req.user.email}`);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
