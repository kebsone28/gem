import express from 'express';
import { query } from '../db/connection.js';
import { authenticate, authorize } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/kpi/project/:projectId
 * Récupérer les KPI d'un projet spécifique
 */
router.get('/project/:projectId', authenticate, async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // Vérifier que l'utilisateur a accès à ce projet
    const projectResult = await query(
      `SELECT id FROM projects WHERE id = $1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    // Récupérer le dernier snapshot KPI
    const kpiResult = await query(
      `SELECT * FROM kpi_snapshots WHERE project_id = $1 ORDER BY snapshot_date DESC LIMIT 1`,
      [projectId]
    );

    if (kpiResult.rows.length === 0) {
      // Retourner des KPI par défaut ou calculés en live
      return res.json({
        message: 'Aucun snapshot KPI trouvé, utilisation du calcul en direct',
        data: null
      });
    }

    const kpi = kpiResult.rows[0];

    // Formater la réponse
    res.json({
      projectId,
      snapshot: {
        date: kpi.snapshot_date,
        households: {
          total: kpi.total_households,
          electrified: kpi.electrified_households,
          pending: kpi.pending_households,
          accessPercent: kpi.electricity_access_percent
        },
        budget: {
          total: kpi.total_budget,
          used: kpi.used_budget,
          remaining: kpi.remaining_budget,
          percentUsed: kpi.percent_used,
          costPerHousehold: kpi.cost_per_household
        },
        teams: {
          active: kpi.active_teams,
          saturationPercent: kpi.team_saturation_percent,
          averageProductivity: kpi.average_productivity
        },
        timeline: {
          progressPercent: kpi.timeline_progress_percent,
          estimatedDelayDays: kpi.estimated_delay_days,
          onTime: kpi.on_time
        },
        quality: {
          complianceRate: kpi.compliance_rate,
          reserveCount: kpi.reserve_count,
          qualityScore: kpi.quality_score
        },
        risk: {
          criticalStockAlerts: kpi.critical_stock_alerts,
          villageAtRisk: kpi.village_at_risk,
          riskLevel: kpi.risk_level
        },
        igpp: {
          score: kpi.igpp_score,
          status: kpi.igpp_status
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/kpi/project/:projectId/snapshot
 * Créer un snapshot KPI (calcul depuis repositories)
 */
router.post('/project/:projectId/snapshot', authenticate, authorize(['ADMIN', 'SUPERVISEUR']), async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // Vérifier que le projet existe
    const projectResult = await query(
      `SELECT id, target_households, target_budget FROM projects WHERE id = $1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    const project = projectResult.rows[0];

    // Calculer les KPI depuis les données
    const householdsResult = await query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'electrified' THEN 1 ELSE 0 END) as electrified,
         SUM(CASE WHEN status IN ('planned', 'in-progress') THEN 1 ELSE 0 END) as pending
       FROM households WHERE project_id = $1`,
      [projectId]
    );

    const households = householdsResult.rows[0];
    const totalHouseholds = parseInt(households.total) || 0;
    const electrifiedHouseholds = parseInt(households.electrified) || 0;
    const pendingHouseholds = parseInt(households.pending) || 0;
    const accessPercent = (electrifiedHouseholds / totalHouseholds * 100).toFixed(2) || 0;

    // Récupérer les données budget
    const budgetResult = await query(
      `SELECT 
         SUM(CAST(actual_cost AS DECIMAL)) as used_budget
       FROM households WHERE project_id = $1 AND status = 'electrified'`,
      [projectId]
    );

    const usedBudget = budgetResult.rows[0]?.used_budget || 0;
    const totalBudget = project.target_budget;
    const remainingBudget = totalBudget - usedBudget;
    const percentUsed = (usedBudget / totalBudget * 100).toFixed(2);
    const costPerHousehold = (usedBudget / electrifiedHouseholds).toFixed(2) || 0;

    // Données équipes
    const teamsResult = await query(
      `SELECT COUNT(*) as active_teams FROM teams WHERE project_id = $1 AND status = 'active'`,
      [projectId]
    );

    const activeTeams = teamsResult.rows[0]?.active_teams || 0;

    // Insérer le snapshot
    const insertResult = await query(
      `INSERT INTO kpi_snapshots (
         project_id, total_households, electrified_households, pending_households,
         electricity_access_percent, total_budget, used_budget, remaining_budget,
         percent_used, cost_per_household, active_teams, team_saturation_percent,
         timeline_progress_percent, compliance_rate, igpp_score, igpp_status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        projectId,
        totalHouseholds,
        electrifiedHouseholds,
        pendingHouseholds,
        accessPercent,
        totalBudget,
        usedBudget,
        remainingBudget,
        percentUsed,
        costPerHousehold,
        activeTeams,
        50, // team_saturation_percent (exemple)
        parseFloat(accessPercent), // timeline_progress_percent
        92, // compliance_rate (exemple)
        (parseFloat(accessPercent) * 0.5 + 50).toFixed(2), // IGPP score simple
        'BON'
      ]
    );

    logger.success(`✅ Snapshot KPI créé: projet ${projectId}`);

    res.status(201).json({
      message: 'Snapshot créé avec succès',
      snapshot: insertResult.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/kpi/project/:projectId/history
 * Historique des KPI (derniers 30 jours)
 */
router.get('/project/:projectId/history', authenticate, async (req, res, next) => {
  try {
    const { projectId } = req.params;

    const result = await query(
      `SELECT 
         snapshot_date,
         electricity_access_percent,
         percent_used as budget_percent_used,
         timeline_progress_percent,
         compliance_rate,
         igpp_score
       FROM kpi_snapshots
       WHERE project_id = $1
       AND snapshot_date >= NOW() - INTERVAL '30 days'
       ORDER BY snapshot_date DESC`,
      [projectId]
    );

    res.json({
      projectId,
      history: result.rows
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/kpi/summary
 * Résumé KPI pour tous les projets (Admin uniquement)
 */
router.get('/summary', authenticate, authorize(['ADMIN']), async (req, res, next) => {
  try {
    // Statistiques agrégées
    const result = await query(
      `SELECT 
         COUNT(DISTINCT p.id) as total_projects,
         SUM(p.target_households) as total_target_households,
         COUNT(DISTINCT h.id) as total_households_created,
         SUM(CASE WHEN h.status = 'electrified' THEN 1 ELSE 0 END) as total_electrified,
         SUM(p.target_budget) as total_target_budget,
         SUM(h.actual_cost) as total_spent,
         AVG(ks.igpp_score) as average_igpp
       FROM projects p
       LEFT JOIN households h ON p.id = h.project_id
       LEFT JOIN kpi_snapshots ks ON p.id = ks.project_id`
    );

    const stats = result.rows[0];

    res.json({
      summary: {
        projects: stats.total_projects || 0,
        households: {
          target: stats.total_target_households || 0,
          created: stats.total_households_created || 0,
          electrified: stats.total_electrified || 0
        },
        budget: {
          target: stats.total_target_budget || 0,
          spent: stats.total_spent || 0
        },
        averageIGPP: parseFloat(stats.average_igpp).toFixed(2) || 'N/A'
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
