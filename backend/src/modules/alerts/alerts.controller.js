/**
 * Contrôleur Alertes - Flux d'Alertes Finalisé
 * Gère création, récupération, mise à jour du statut, et escalade
 */

import prisma from '../../core/utils/prisma.js';
import { alertsService } from './alerts.service.js';

// @desc    Get all alerts for a project
// @route   GET /api/alerts/:projectId
// @access  Private
export const getProjectAlerts = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { organizationId } = req.user;
    const { status, severity, type, limit = 50 } = req.query;

    const alerts = await prisma.alert.findMany({
      where: {
        organizationId,
        projectId,
        ...(status && { status }),
        ...(severity && { severity }),
        ...(type && { type }),
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    });

    res.json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (err) {
    console.error('[ALERTS] getProjectAlerts error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Create new alert (manual or automatic)
// @route   POST /api/alerts
// @access  Private
export const createAlert = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const {
      projectId,
      householdId,
      pvId,
      type,
      severity,
      title,
      description,
      recommendedAction,
      metadata,
    } = req.body;

    if (!projectId || !type || !severity || !title) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: projectId, type, severity, title',
      });
    }

    const alert = await prisma.alert.create({
      data: {
        organizationId,
        projectId,
        householdId: householdId || null,
        pvId: pvId || null,
        type,
        severity,
        title,
        description: description || '',
        recommendedAction: recommendedAction || '',
        status: 'OPEN',
        metadata: metadata || {},
      },
    });

    // Déclencher les notifications automatiques
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      await alertsService.triggerNotifications(alert);
    }

    res.status(201).json({
      success: true,
      message: 'Alert created successfully',
      data: alert,
    });
  } catch (err) {
    console.error('[ALERTS] createAlert error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Acknowledge an alert (mark as seen)
// @route   PATCH /api/alerts/:alertId/acknowledge
// @access  Private
export const acknowledgeAlert = async (req, res) => {
  try {
    const { alertId } = req.params;
    const { organizationId, id: userId } = req.user;

    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
    });

    if (!alert || alert.organizationId !== organizationId) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    const updated = await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: alert.status === 'OPEN' ? 'ACKNOWLEDGED' : alert.status,
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      },
    });

    res.json({
      success: true,
      message: 'Alert acknowledged',
      data: updated,
    });
  } catch (err) {
    console.error('[ALERTS] acknowledgeAlert error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Resolve an alert
// @route   PATCH /api/alerts/:alertId/resolve
// @access  Private
export const resolveAlert = async (req, res) => {
  try {
    const { alertId } = req.params;
    const { organizationId, id: userId } = req.user;
    const { comment } = req.body;

    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
    });

    if (!alert || alert.organizationId !== organizationId) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    const updated = await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: userId,
        metadata: {
          ...(alert.metadata || {}),
          resolutionComment: comment || '',
        },
      },
    });

    res.json({
      success: true,
      message: 'Alert resolved',
      data: updated,
    });
  } catch (err) {
    console.error('[ALERTS] resolveAlert error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get alert statistics
// @route   GET /api/alerts/:projectId/stats
// @access  Private
export const getAlertStats = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { organizationId } = req.user;

    const stats = await prisma.alert.groupBy({
      by: ['status', 'severity', 'type'],
      where: {
        organizationId,
        projectId,
      },
      _count: true,
    });

    const byStatus = await prisma.alert.groupBy({
      by: ['status'],
      where: { organizationId, projectId },
      _count: true,
    });

    const totalCritical = await prisma.alert.count({
      where: {
        organizationId,
        projectId,
        severity: 'CRITICAL',
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
      },
    });

    res.json({
      success: true,
      data: {
        byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
        totalCritical,
        breakdown: stats,
      },
    });
  } catch (err) {
    console.error('[ALERTS] getAlertStats error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get alert configuration
// @route   GET /api/alerts/config/organization
// @access  Private
export const getAlertConfig = async (req, res) => {
  try {
    const { organizationId } = req.user;

    let config = await prisma.alertConfiguration.findUnique({
      where: { organizationId },
    });

    // Créer une config par défaut si elle n'existe pas
    if (!config) {
      config = await prisma.alertConfiguration.create({
        data: {
          organizationId,
        },
      });
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (err) {
    console.error('[ALERTS] getAlertConfig error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update alert configuration
// @route   PATCH /api/alerts/config/organization
// @access  Private
export const updateAlertConfig = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const updates = req.body;

    let config = await prisma.alertConfiguration.findUnique({
      where: { organizationId },
    });

    if (!config) {
      config = await prisma.alertConfiguration.create({
        data: {
          organizationId,
          ...updates,
        },
      });
    } else {
      config = await prisma.alertConfiguration.update({
        where: { organizationId },
        data: updates,
      });
    }

    res.json({
      success: true,
      message: 'Alert configuration updated',
      data: config,
    });
  } catch (err) {
    console.error('[ALERTS] updateAlertConfig error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
