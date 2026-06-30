/**
 * Controller pour les rapports programmés
 */
import prisma from '../../core/utils/prisma.js';
import logger from '../../utils/logger.js';
import {
  createScheduledReport as createReport,
  updateScheduledReport as updateReport,
  deleteScheduledReport as deleteReport,
  listScheduledReports as listReports,
  listGeneratedReports,
  calculateNextRun,
} from '../../services/reportScheduler.service.js';

// ─── Scheduled Reports CRUD ──────────────────────────────────────────────

export const listScheduledReports = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const reports = await listReports(organizationId);
    res.json({ reports });
  } catch (err) {
    logger.error('[Reports] list error:', err);
    res.status(500).json({ error: 'Erreur liste rapports' });
  }
};

export const createScheduledReport = async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;
    const { name, schedule, format, formKey, filters } = req.body;

    if (!name || !schedule) {
      return res.status(400).json({ error: 'Nom et planification requis' });
    }

    const validFormats = ['csv', 'json', 'xlsx'];
    if (format && !validFormats.includes(format)) {
      return res.status(400).json({ error: 'Format invalide. Utilisez csv ou json' });
    }

    // Validate schedule format
    try {
      const nextRun = calculateNextRun(schedule);
      if (!nextRun || isNaN(nextRun.getTime())) {
        throw new Error('Invalid schedule');
      }
    } catch {
      return res.status(400).json({
        error:
          'Format de planification invalide. Utilisez daily:HH:MM, weekly:DAY:HH:MM, ou monthly:DAY:HH:MM',
      });
    }

    const report = await createReport({
      organizationId,
      userId,
      name,
      schedule,
      format: format || 'csv',
      formKey: formKey || null,
      filters: filters || {},
    });

    res.status(201).json({ success: true, report });
  } catch (err) {
    logger.error('[Reports] create error:', err);
    res.status(500).json({ error: 'Erreur creation rapport' });
  }
};

export const updateScheduledReport = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { id } = req.params;

    const existing = await prisma.scheduledReport.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Rapport non trouve' });
    }

    const { name, schedule, format, formKey, filters, active } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (schedule !== undefined) updateData.schedule = schedule;
    if (format !== undefined) updateData.format = format;
    if (formKey !== undefined) updateData.formKey = formKey;
    if (filters !== undefined) updateData.filters = filters;
    if (active !== undefined) updateData.active = active;

    const report = await updateReport(id, updateData);
    res.json({ success: true, report });
  } catch (err) {
    logger.error('[Reports] update error:', err);
    res.status(500).json({ error: 'Erreur mise a jour rapport' });
  }
};

export const deleteScheduledReport = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { id } = req.params;

    const existing = await prisma.scheduledReport.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Rapport non trouve' });
    }

    await deleteReport(id);
    res.json({ success: true });
  } catch (err) {
    logger.error('[Reports] delete error:', err);
    res.status(500).json({ error: 'Erreur suppression rapport' });
  }
};

// ─── Generated Reports ───────────────────────────────────────────────────

export const getGeneratedReports = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const reports = await prisma.generatedReport.findMany({
      where: { organizationId },
      orderBy: { generatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        format: true,
        filename: true,
        recordCount: true,
        generatedAt: true,
      },
    });

    res.json({ reports });
  } catch (err) {
    logger.error('[Reports] list generated error:', err);
    res.status(500).json({ error: 'Erreur liste rapports generes' });
  }
};

export const downloadGeneratedReport = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { id } = req.params;

    const report = await prisma.generatedReport.findFirst({
      where: { id, organizationId },
    });

    if (!report) {
      return res.status(404).json({ error: 'Rapport non trouve' });
    }

    res.setHeader('Content-Type', report.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    res.send(report.fileBuffer);
  } catch (err) {
    logger.error('[Reports] download error:', err);
    res.status(500).json({ error: 'Erreur telechargement rapport' });
  }
};
