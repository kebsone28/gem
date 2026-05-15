import { reportingService } from '../../core/services/reporting.service.js';
import logger from '../../utils/logger.js';

/**
 * @desc    Get real-time analytics for a project
 * @route   GET /api/projects/:id/analytics
 */
export const getProjectAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    // 1. Calculer les KPIs de santé (Real data)
    const stats = await reportingService.getProjectHealth(id);

    // 2. Récupérer la timeline d'activité (Real events)
    const timeline = await reportingService.getActivityTimeline(id);

    // 3. Récupérer la répartition par région (Optionnel, basé sur l'organisation)
    // TODO: Ajouter stats par zone si nécessaire

    res.json({
      success: true,
      data: {
        stats,
        timeline,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('[AnalyticsController] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la génération des statistiques réelles' 
    });
  }
};
