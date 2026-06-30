/**
 * Report Scheduler Service
 * Envoie des rapports programmés par email (CSV/PDF) sans dépendance externe
 * Utilise un setInterval simple pour vérifier les rapports à exécuter
 */
import prisma from '../core/utils/prisma.js';
import logger from '../utils/logger.js';

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
let schedulerTimer = null;

export function startReportScheduler() {
  if (schedulerTimer) return;
  logger.info('[ReportScheduler] Démarrage du planificateur de rapports');
  tick(); // First run immediately
  schedulerTimer = setInterval(tick, CHECK_INTERVAL);
}

export function stopReportScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info('[ReportScheduler] Planificateur arrêté');
  }
}

async function tick() {
  try {
    const now = new Date();
    const due = await prisma.scheduledReport.findMany({
      where: {
        active: true,
        nextRunAt: { lte: now },
      },
      include: { user: { select: { email: true, name: true } } },
    });

    for (const report of due) {
      try {
        await executeReport(report);
        // Calculate next run
        const nextRun = calculateNextRun(report.schedule, now);
        await prisma.scheduledReport.update({
          where: { id: report.id },
          data: {
            lastRunAt: now,
            nextRunAt: nextRun,
            lastError: null,
          },
        });
        logger.info(
          `[ReportScheduler] Rapport "${report.name}" exécuté, prochaine exécution: ${nextRun?.toISOString()}`
        );
      } catch (err) {
        logger.error(`[ReportScheduler] Erreur rapport "${report.name}":`, err.message);
        await prisma.scheduledReport.update({
          where: { id: report.id },
          data: { lastError: err.message },
        });
      }
    }
  } catch (err) {
    logger.error('[ReportScheduler] Erreur tick:', err.message);
  }
}

export function calculateNextRun(schedule, from = new Date()) {
  // Format: "daily:08:00" or "weekly:1:08:00" (1=Monday) or "monthly:1:08:00"
  const parts = schedule.split(':');
  const next = new Date(from);

  let targetDay, currentDay, diff;
  switch (parts[0]) {
    case 'daily':
      next.setHours(parseInt(parts[1] || '8'), parseInt(parts[2] || '0'), 0, 0);
      if (next <= from) next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setHours(parseInt(parts[2] || '8'), parseInt(parts[3] || '0'), 0, 0);
      targetDay = parseInt(parts[1] || '1');
      currentDay = next.getDay(); // 0=Sun, 1=Mon...
      diff = targetDay - currentDay;
      if (diff <= 0 || (diff === 0 && next <= from)) diff += 7;
      next.setDate(next.getDate() + diff);
      break;
    case 'monthly':
      next.setHours(parseInt(parts[2] || '8'), parseInt(parts[3] || '0'), 0, 0);
      next.setDate(parseInt(parts[1] || '1'));
      if (next <= from) next.setMonth(next.getMonth() + 1);
      break;
    default:
      next.setDate(next.getDate() + 1); // Default: daily
  }
  return next;
}

async function executeReport(report) {
  const { organizationId, formKey, format, userId, name } = report;

  // Build query filters
  const where = { organizationId };
  if (formKey) where.formKey = formKey;
  if (report.filters) {
    try {
      const parsed =
        typeof report.filters === 'string' ? JSON.parse(report.filters) : report.filters;
      if (parsed.startDate)
        where.submittedAt = { ...(where.submittedAt || {}), gte: new Date(parsed.startDate) };
      if (parsed.endDate)
        where.submittedAt = { ...(where.submittedAt || {}), lte: new Date(parsed.endDate) };
      if (parsed.status) where.status = parsed.status;
    } catch {
      // Ignore filter parse errors
    }
  }

  const submissions = await prisma.toolboxSubmission.findMany({
    where,
    take: 5000,
    orderBy: { savedAt: 'desc' },
  });

  if (submissions.length === 0) {
    logger.info(`[ReportScheduler] Rapport "${name}": 0 soumissions, rien à envoyer`);
    return;
  }

  // Generate file based on format
  let fileBuffer, filename, mimeType;

  if (format === 'xlsx') {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Soumissions');

    // Get all unique value keys from submissions
    const valueKeys = [...new Set(submissions.flatMap((s) => Object.keys(s.values || {})))].slice(
      0,
      20
    );
    const headers = [
      'ID',
      'Formulaire',
      'Statut',
      'Soumis le',
      ...valueKeys.map((k) => `Champ ${k}`),
    ];

    worksheet.addRow(headers);
    for (const s of submissions) {
      const values = s.values || {};
      worksheet.addRow([
        s.id,
        s.formKey,
        s.status,
        s.submittedAt?.toISOString() || '',
        ...valueKeys.map((k) => values[k] || ''),
      ]);
    }

    fileBuffer = await workbook.xlsx.writeBuffer();
    filename = `rapport-${name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else if (format === 'csv') {
    const headers = ['id', 'formKey', 'status', 'submittedAt'];
    const rows = submissions.map((s) => {
      const values = s.values || {};
      return [
        s.id,
        s.formKey,
        s.status,
        s.submittedAt?.toISOString() || '',
        ...Object.values(values).slice(0, 20),
      ];
    });
    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    fileBuffer = Buffer.from(csv, 'utf-8');
    filename = `rapport-${name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
    mimeType = 'text/csv';
  } else {
    // Default: JSON
    const json = JSON.stringify(
      { generatedAt: new Date().toISOString(), count: submissions.length, submissions },
      null,
      2
    );
    fileBuffer = Buffer.from(json, 'utf-8');
    filename = `rapport-${name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
    mimeType = 'application/json';
  }

  // Store the generated report
  await prisma.generatedReport.create({
    data: {
      organizationId,
      scheduledReportId: report.id,
      userId,
      name,
      format,
      fileBuffer,
      filename,
      mimeType,
      recordCount: submissions.length,
      generatedAt: new Date(),
    },
  });

  // TODO: Send email notification if user has email configured
  // For now, the report is available for download in the UI
}

// ─── CRUD Helpers ────────────────────────────────────────────────────────

export async function createScheduledReport(data) {
  const nextRun = calculateNextRun(data.schedule);
  return prisma.scheduledReport.create({
    data: { ...data, nextRunAt: nextRun },
  });
}

export async function updateScheduledReport(id, data) {
  const update = { ...data };
  if (data.schedule) {
    update.nextRunAt = calculateNextRun(data.schedule);
  }
  return prisma.scheduledReport.update({
    where: { id },
    data: update,
  });
}

export async function deleteScheduledReport(id) {
  return prisma.scheduledReport.delete({ where: { id } });
}

export async function listScheduledReports(organizationId) {
  return prisma.scheduledReport.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listGeneratedReports(organizationId, limit = 20) {
  return prisma.generatedReport.findMany({
    where: { organizationId },
    orderBy: { generatedAt: 'desc' },
    take: limit,
  });
}
