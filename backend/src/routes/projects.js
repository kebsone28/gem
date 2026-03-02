import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/projects
 * Récupérer la liste des projets
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT p.id, p.code, p.name, p.zone, p.status, p.progress_percent,
              p.start_date, p.end_date, p.target_households, p.target_budget,
              u.first_name, u.last_name
       FROM projects p
       LEFT JOIN users u ON p.manager_id = u.id
       ORDER BY p.created_at DESC`,
      []
    );

    res.json({
      projects: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:id
 * Récupérer un projet spécifique
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT p.*, u.first_name, u.last_name
       FROM projects p
       LEFT JOIN users u ON p.manager_id = u.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects
 * Créer un nouveau projet (Admin/Superviseur)
 */
router.post('/', authenticate, authorize(['ADMIN', 'SUPERVISEUR']), async (req, res, next) => {
  try {
    const { code, name, zone, startDate, endDate, targetHouseholds, targetBudget } = req.body;

    // Validation
    if (!code || !name) {
      return res.status(400).json({ error: 'Code et nom requis' });
    }

    const result = await query(
      `INSERT INTO projects (code, name, zone, start_date, end_date, target_households, target_budget, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [code, name, zone, startDate, endDate, targetHouseholds, targetBudget, req.user.id]
    );

    logger.success(`✅ Projet créé: ${code} par ${req.user.email}`);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/projects/:id
 * Mettre à jour un projet
 */
router.patch('/:id', authenticate, authorize(['ADMIN', 'SUPERVISEUR']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, status, progressPercent, managerId } = req.body;

    const result = await query(
      `UPDATE projects 
       SET name = COALESCE($1, name),
           status = COALESCE($2, status),
           progress_percent = COALESCE($3, progress_percent),
           manager_id = COALESCE($4, manager_id),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [name, status, progressPercent, managerId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    logger.success(`✅ Projet ${id} mis à jour par ${req.user.email}`);

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
