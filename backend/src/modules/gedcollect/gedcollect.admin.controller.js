import bcrypt from 'bcryptjs';
import prisma from '../../core/utils/prisma.js';
import logger from '../../utils/logger.js';

export const listUsers = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId, phone: { not: null } },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          phoneActivated: true,
          active: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.user.count({ where: { organizationId, phone: { not: null } } }),
    ]);
    res.json({ users, total, offset, limit });
  } catch (err) {
    logger.error('[GEDCOLLECT-ADMIN] listUsers error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const setPhone = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { userId, phone } = req.body;
    if (!userId || !phone) {
      return res.status(400).json({ error: 'userId et phone requis' });
    }
    const user = await prisma.user.findFirst({ where: { id: userId, organizationId } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const existing = await prisma.user.findFirst({
      where: { phone, organizationId, id: { not: userId } },
    });
    if (existing) return res.status(409).json({ error: 'Ce numéro est déjà utilisé' });

    await prisma.user.update({ where: { id: userId }, data: { phone } });
    res.json({ success: true });
  } catch (err) {
    logger.error('[GEDCOLLECT-ADMIN] setPhone error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const toggleActivation = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { userId, activated } = req.body;
    const user = await prisma.user.findFirst({ where: { id: userId, organizationId } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    await prisma.user.update({ where: { id: userId }, data: { phoneActivated: !!activated } });
    res.json({ success: true, phoneActivated: !!activated });
  } catch (err) {
    logger.error('[GEDCOLLECT-ADMIN] toggleActivation error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const listAssignments = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);

    const [assignments, total] = await Promise.all([
      prisma.gedcollectAssignment.findMany({
        where: { organizationId },
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.gedcollectAssignment.count({ where: { organizationId } }),
    ]);
    res.json({ assignments, total, offset, limit });
  } catch (err) {
    logger.error('[GEDCOLLECT-ADMIN] listAssignments error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const createAssignment = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { userId, formKey } = req.body;
    if (!userId || !formKey) {
      return res.status(400).json({ error: 'userId et formKey requis' });
    }

    const user = await prisma.user.findFirst({ where: { id: userId, organizationId } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const mapping = await prisma.koboFormMapping.findFirst({
      where: { organizationId, koboAssetId: formKey },
    });
    if (!mapping) return res.status(404).json({ error: 'Formulaire introuvable' });

    const existing = await prisma.gedcollectAssignment.findFirst({
      where: { organizationId, userId, formKey },
    });
    if (existing) return res.status(409).json({ error: 'Déjà assigné' });

    const assignment = await prisma.gedcollectAssignment.create({
      data: { organizationId, userId, formKey },
    });
    res.status(201).json({ success: true, assignment });
  } catch (err) {
    logger.error('[GEDCOLLECT-ADMIN] createAssignment error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const deleteAssignment = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { id } = req.params;
    await prisma.gedcollectAssignment.deleteMany({
      where: { id, organizationId },
    });
    res.json({ success: true });
  } catch (err) {
    logger.error('[GEDCOLLECT-ADMIN] deleteAssignment error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const createGedcollectUser = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { name, phone } = req.body;
    if (!phone || phone.length < 8) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }

    const existing = await prisma.user.findFirst({
      where: { phone, organizationId },
    });
    if (existing) {
      return res.status(409).json({ error: 'Ce numéro existe déjà' });
    }

    const role = await prisma.role.findFirst({
      where: { name: 'USER' },
    });

    const passwordHash = await bcrypt.hash(phone, 10);

    const user = await prisma.user.create({
      data: {
        name: name || `Mobile ${phone}`,
        email: `${phone}@gedcollect.local`,
        passwordHash,
        phone,
        phoneActivated: true,
        active: true,
        organizationId,
        roleId: role?.id || undefined,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        phoneActivated: true,
        active: true,
        createdAt: true,
      },
    });

    res.status(201).json({ success: true, user });
  } catch (err) {
    logger.error('[GEDCOLLECT-ADMIN] createUser error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const deleteGedcollectUser = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { id } = req.params;

    const user = await prisma.user.findFirst({ where: { id, organizationId } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    await prisma.gedcollectAssignment.deleteMany({ where: { userId: id, organizationId } });

    await prisma.user.update({
      where: { id },
      data: { active: false, phoneActivated: false, phone: null },
    });

    res.json({ success: true });
  } catch (err) {
    logger.error('[GEDCOLLECT-ADMIN] deleteUser error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const getGedcollectStats = async (req, res) => {
  try {
    const { organizationId } = req.user;

    const totalUsers = await prisma.user.count({
      where: { organizationId, phone: { not: null } },
    });
    const activeUsers = await prisma.user.count({
      where: { organizationId, phone: { not: null }, phoneActivated: true },
    });
    const assignedForms = await prisma.gedcollectAssignment.count({
      where: { organizationId },
    });
    const totalSubmissions = await prisma.toolboxSubmission.count({
      where: {
        organizationId,
        submittedBy: { phone: { not: null } },
      },
    });
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySubmissions = await prisma.toolboxSubmission.count({
      where: {
        organizationId,
        submittedBy: { phone: { not: null } },
        submittedAt: { gte: todayStart },
      },
    });

    res.json({
      totalUsers,
      activeUsers,
      assignedForms,
      totalSubmissions,
      todaySubmissions,
    });
  } catch (err) {
    logger.error('[GEDCOLLECT-ADMIN] stats error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const listGedcollectSubmissions = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { offset = 0, limit = 50, format } = req.query;

    const where = {
      organizationId,
      submittedBy: { phone: { not: null } },
    };

    if (format === 'csv') {
      const submissions = await prisma.toolboxSubmission.findMany({
        where,
        include: {
          submittedBy: { select: { name: true, phone: true } },
        },
        orderBy: { submittedAt: 'desc' },
      });

      const header = 'Date,FormKey,Version,Statut,Valeurs,SoumisPar,Téléphone\n';
      const rows = submissions
        .map((s) => {
          const values = JSON.stringify(s.values || {}).replace(/"/g, '""');
          return `${s.submittedAt?.toISOString() || ''},${s.formKey},${s.formVersion},${s.status},"${values}",${s.submittedBy?.name || ''},${s.submittedBy?.phone || ''}`;
        })
        .join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=gedcollect-submissions.csv');
      return res.send(header + rows);
    }

    const [submissions, count] = await Promise.all([
      prisma.toolboxSubmission.findMany({
        where,
        include: {
          submittedBy: { select: { name: true, phone: true } },
        },
        orderBy: { submittedAt: 'desc' },
        skip: Number(offset),
        take: Number(limit),
      }),
      prisma.toolboxSubmission.count({ where }),
    ]);

    res.json({ submissions, count, offset: Number(offset), limit: Number(limit) });
  } catch (err) {
    logger.error('[GEDCOLLECT-ADMIN] submissions error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const listForms = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);

    const [forms, total] = await Promise.all([
      prisma.koboFormMapping.findMany({
        where: { organizationId },
        select: { koboAssetId: true, version: true, mapping: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.koboFormMapping.count({ where: { organizationId } }),
    ]);
    const result = forms.map((f) => ({
      formKey: f.koboAssetId,
      version: f.version,
      title: f.mapping?.settings?.[0]?.form_title || f.koboAssetId,
      updatedAt: f.updatedAt,
    }));
    res.json({ forms: result, total, offset, limit });
  } catch (err) {
    logger.error('[GEDCOLLECT-ADMIN] listForms error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const exportGedcollectSubmissions = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { format = 'csv', formKey, status } = req.query;

    const where = {
      organizationId,
      submittedBy: { phone: { not: null } },
    };
    if (formKey) where.formKey = String(formKey);
    if (status) where.status = String(status);

    const submissions = await prisma.toolboxSubmission.findMany({
      where,
      include: {
        submittedBy: { select: { name: true, phone: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 5000,
    });

    if (format === 'xlsx') {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Soumissions');

      const valueKeys = [...new Set(submissions.flatMap((s) => Object.keys(s.values || {})))].slice(
        0,
        20
      );
      const headers = [
        'Date',
        'FormKey',
        'Version',
        'Statut',
        'SoumisPar',
        'Téléphone',
        ...valueKeys.map((k) => `Champ ${k}`),
      ];

      worksheet.addRow(headers);
      for (const s of submissions) {
        const values = s.values || {};
        worksheet.addRow([
          s.submittedAt?.toISOString() || '',
          s.formKey,
          s.formVersion,
          s.status,
          s.submittedBy?.name || '',
          s.submittedBy?.phone || '',
          ...valueKeys.map((k) => values[k] || ''),
        ]);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `gedcollect-submissions-${new Date().toISOString().slice(0, 10)}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    }

    // Default: CSV
    const header = 'Date,FormKey,Version,Statut,SoumisPar,Téléphone,Valeurs\n';
    const rows = submissions
      .map((s) => {
        const values = JSON.stringify(s.values || {}).replace(/"/g, '""');
        return `${s.submittedAt?.toISOString() || ''},${s.formKey},${s.formVersion},${s.status},${s.submittedBy?.name || ''},${s.submittedBy?.phone || ''},"${values}"`;
      })
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=gedcollect-submissions.csv');
    return res.send(header + rows);
  } catch (err) {
    logger.error('[GEDCOLLECT-ADMIN] export error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
