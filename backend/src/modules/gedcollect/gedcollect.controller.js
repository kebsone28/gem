import prisma from '../../core/utils/prisma.js';
import { generateTokens } from '../../core/utils/jwt.js';
import logger from '../../utils/logger.js';

const otpStore = new Map();

function generateOtp() {
  if (process.env.NODE_ENV === 'production') {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
  return '1234';
}

export const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length < 8) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }

    const user = await prisma.user.findFirst({ where: { phone } });
    if (!user) {
      return res.status(404).json({ error: 'Ce numéro n\'est pas enregistré. Contactez l\'administrateur.' });
    }
    if (!user.phoneActivated) {
      return res.status(403).json({ error: 'Ce numéro n\'est pas activé. Contactez l\'administrateur.' });
    }
    if (!user.active) {
      return res.status(403).json({ error: 'Ce compte est désactivé.' });
    }

    const code = generateOtp();
    otpStore.set(phone, { code, expiresAt: Date.now() + 300000 });

    if (process.env.NODE_ENV !== 'production') {
      return res.json({ message: 'Code envoyé', code, devMode: true });
    }

    // TODO: Intégrer une passerelle SMS ici
    logger.info(`[GEDCOLLECT] OTP envoyé au ${phone}: ${code}`);
    res.json({ message: 'Code de vérification envoyé' });
  } catch (err) {
    logger.error('[GEDCOLLECT] sendOtp error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ error: 'Numéro et code requis' });
    }

    const stored = otpStore.get(phone);
    if (!stored) {
      return res.status(400).json({ error: 'Aucun code demandé. Veuillez réessayer.' });
    }
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ error: 'Code expiré. Veuillez renvoyer un nouveau code.' });
    }
    if (stored.code !== code) {
      return res.status(400).json({ error: 'Code incorrect' });
    }

    otpStore.delete(phone);

    const user = await prisma.user.findFirst({
      where: { phone },
      include: { organization: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const { accessToken } = generateTokens({
      id: user.id,
      email: user.email || user.phone,
      organizationId: user.organizationId,
      role: 'gedcollect_mobile',
      permissions: [],
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    res.json({
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        organizationId: user.organizationId,
        organization: user.organization?.name,
      },
    });
  } catch (err) {
    logger.error('[GEDCOLLECT] verifyOtp error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const getAssignedForms = async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;

    const assignments = await prisma.gedcollectAssignment.findMany({
      where: { userId, organizationId },
    });

    const formMappings = await prisma.koboFormMapping.findMany({
      where: {
        organizationId,
        koboAssetId: { in: assignments.map((a) => a.formKey) },
      },
    });

    const mappingByKey = {};
    for (const fm of formMappings) {
      mappingByKey[fm.koboAssetId] = fm;
    }

    const forms = assignments.map((a) => {
      const fm = mappingByKey[a.formKey];
      const m = fm?.mapping || {};
      return {
        formKey: a.formKey,
        version: fm?.version || '1.0',
        title:
          m?.settings?.[0]?.form_title ||
          m?.title ||
          a.formKey,
        description: m?.settings?.[0]?.form_id || '',
        survey: m?.survey || [],
        choices: m?.choices || [],
        updatedAt: fm?.updatedAt || a.createdAt,
      };
    });

    res.json({ forms, count: forms.length });
  } catch (err) {
    logger.error('[GEDCOLLECT] getAssignedForms error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const submitForm = async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;
    const { formKey, formVersion, values, clientSubmissionId, status, metadata } = req.body;

    if (!formKey || !clientSubmissionId) {
      return res.status(400).json({ error: 'formKey et clientSubmissionId requis' });
    }

    const assignment = await prisma.gedcollectAssignment.findFirst({
      where: { organizationId, userId, formKey },
    });
    if (!assignment) {
      return res.status(403).json({ error: 'Ce formulaire ne vous est pas assigné' });
    }

    const submission = await prisma.toolboxSubmission.upsert({
      where: {
        organizationId_clientSubmissionId: {
          organizationId,
          clientSubmissionId,
        },
      },
      create: {
        organizationId,
        formKey,
        formVersion: formVersion || '1.0',
        clientSubmissionId,
        status: status || 'submitted',
        syncStatus: 'synced',
        values: values || {},
        metadata: { ...(metadata || {}), source: 'gedcollect-mobile' },
        submittedById: userId,
        submittedAt: new Date(),
        savedAt: new Date(),
      },
      update: {
        formVersion: formVersion || '1.0',
        status: status || 'submitted',
        syncStatus: 'synced',
        values: values || {},
        metadata: { ...(metadata || {}), source: 'gedcollect-mobile' },
        submittedById: userId,
        submittedAt: new Date(),
        savedAt: new Date(),
      },
    });

    await prisma.syncLog.create({
      data: {
        userId,
        organizationId,
        deviceId: 'gedcollect-mobile',
        action: 'GEDCOLLECT_SUBMISSION',
        details: {
          submissionId: submission.id,
          clientSubmissionId,
          formKey,
          status: submission.status,
        },
      },
    });

    res.status(201).json({
      success: true,
      submission: { id: submission.id, status: submission.status },
    });
  } catch (err) {
    logger.error('[GEDCOLLECT] submitForm error:', err);
    res.status(500).json({ error: 'Erreur soumission' });
  }
};
