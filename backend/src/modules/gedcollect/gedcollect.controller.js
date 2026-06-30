import prisma from '../../core/utils/prisma.js';
import { generateTokens } from '../../core/utils/jwt.js';
import logger from '../../utils/logger.js';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { submissionSchema } from '../../validation/submission.schemas.js';
import { uploadFile, getFileUrl } from '../../services/storage.service.js';

const SALT_ROUNDS = 10;

export const registerPin = async (req, res) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || phone.length < 8) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }
    if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
      return res.status(400).json({ error: 'Le PIN doit contenir 4 à 6 chiffres' });
    }

    const user = await prisma.user.findFirst({ where: { phone } });
    if (!user) {
      return res.status(404).json({ error: "Ce numéro n'est pas enregistré. Contactez l'administrateur." });
    }
    if (!user.phoneActivated) {
      return res.status(403).json({ error: "Ce numéro n'est pas activé. Contactez l'administrateur." });
    }
    if (!user.active) {
      return res.status(403).json({ error: 'Ce compte est désactivé.' });
    }
    if (user.pinHash) {
      return res.status(409).json({ error: 'Un PIN est déjà défini. Utilisez la connexion.' });
    }

    const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
    await prisma.user.update({ where: { id: user.id }, data: { pinHash } });

    res.json({ message: 'PIN enregistré avec succès' });
  } catch (err) {
    logger.error('[GEDCOLLECT] registerPin error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const loginWithPin = async (req, res) => {
  try {
    const { phone, pin } = req.body;
    if (!phone || !pin) {
      return res.status(400).json({ error: 'Numéro et PIN requis' });
    }

    const user = await prisma.user.findFirst({
      where: { phone },
      include: { organization: true },
    });
    if (!user) {
      return res.status(404).json({ error: "Ce numéro n'est pas enregistré." });
    }
    if (!user.active) {
      return res.status(403).json({ error: 'Ce compte est désactivé.' });
    }
    if (!user.pinHash) {
      return res.status(400).json({ error: 'Aucun PIN configuré. Contactez l\'administrateur.' });
    }

    const match = await bcrypt.compare(pin, user.pinHash);
    if (!match) {
      return res.status(401).json({ error: 'PIN incorrect' });
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
    logger.error('[GEDCOLLECT] loginWithPin error:', err);
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
        title: m?.settings?.[0]?.form_title || m?.title || a.formKey,
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

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:(image\/\w+|application\/octet-stream);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

function extensionFromMime(mimeType = '') {
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'application/pdf': 'pdf' };
  return map[mimeType] || 'bin';
}

async function processPhotoAttachments(attachments, organizationId) {
  if (!Array.isArray(attachments) || attachments.length === 0) return { processed: [], valuePatch: {} };
  const processed = [];
  const valuePatch = {};
  const seenHashes = new Set();
  for (const a of attachments) {
    const fieldName = a.fieldName;
    const parsed = parseDataUrl(a.dataUrl);
    if (!parsed) {
      processed.push({ fieldName, fileName: a.fileName || fieldName, storage: 'client-reference', status: 'unresolved' });
      continue;
    }
    const sha256 = crypto.createHash('sha256').update(parsed.buffer).digest('hex');
    const duplicate = seenHashes.has(sha256);
    seenHashes.add(sha256);
    const ext = extensionFromMime(parsed.mimeType || a.mimeType);
    const key = `${organizationId}/terrain/mobile/${sha256}.${ext}`;
    await uploadFile(key, parsed.buffer, parsed.mimeType || 'application/octet-stream');
    const url = await getFileUrl(key);
    processed.push({ fieldName, fileName: a.fileName || fieldName, sha256, key, url, storage: 'server', status: 'stored', duplicate });
    if (fieldName) valuePatch[fieldName] = url;
  }
  return { processed, valuePatch };
}

export const submitForm = async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;

    // Validate request body with Joi schema
    const { error, value } = submissionSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const details = error.details.map((d) => d.message).join('; ');
      return res.status(400).json({ error: 'Données invalides', details });
    }

    const { formKey, formVersion, values, clientSubmissionId, status, metadata, attachments } = value;

    // Process photo attachments
    let finalValues = values || {};
    let attachmentMeta = [];
    if (attachments && attachments.length > 0) {
      const result = await processPhotoAttachments(attachments, organizationId);
      attachmentMeta = result.processed;
      finalValues = { ...finalValues, ...result.valuePatch };
    }

    const assignment = await prisma.gedcollectAssignment.findFirst({
      where: { organizationId, userId, formKey },
    });
    if (!assignment) {
      return res.status(403).json({ error: 'Ce formulaire ne vous est pas assigné' });
    }

    const baseMetadata = { ...(metadata || {}), source: 'gedcollect-mobile' };
    if (attachmentMeta.length > 0) {
      baseMetadata.media = { attachments: attachmentMeta };
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
        values: finalValues,
        metadata: baseMetadata,
        submittedById: userId,
        submittedAt: new Date(),
        savedAt: new Date(),
      },
      update: {
        formVersion: formVersion || '1.0',
        status: status || 'submitted',
        syncStatus: 'synced',
        values: finalValues,
        metadata: baseMetadata,
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

export const submitBatch = async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;
    const { submissions, compressed } = req.body;

    if (!Array.isArray(submissions) || submissions.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucune soumission fournie' });
    }

    if (submissions.length > 50) {
      return res.status(400).json({ success: false, error: 'Maximum 50 soumissions par lot' });
    }

    const results = [];
    const errors = [];

    for (const s of submissions) {
      try {
        let attachmentMeta = [];
        let finalValues = s.values || {};

        if (s.attachments && s.attachments.length > 0) {
          const result = await processPhotoAttachments(s.attachments, organizationId);
          attachmentMeta = result.processed;
          finalValues = { ...finalValues, ...result.valuePatch };
        }

        const baseMetadata = { ...(s.metadata || {}), source: 'gedcollect-mobile' };
        if (attachmentMeta.length > 0) {
          baseMetadata.media = { attachments: attachmentMeta };
        }

        const submission = await prisma.toolboxSubmission.upsert({
          where: {
            organizationId_clientSubmissionId: {
              organizationId,
              clientSubmissionId: s.clientSubmissionId,
            },
          },
          create: {
            organizationId,
            formKey: s.formKey,
            formVersion: s.formVersion || '1.0',
            clientSubmissionId: s.clientSubmissionId,
            status: s.status || 'submitted',
            syncStatus: 'synced',
            values: finalValues,
            metadata: baseMetadata,
            submittedById: userId,
            submittedAt: new Date(),
            savedAt: new Date(),
          },
          update: {
            formVersion: s.formVersion || '1.0',
            status: s.status || 'submitted',
            syncStatus: 'synced',
            values: finalValues,
            metadata: baseMetadata,
            submittedById: userId,
            submittedAt: new Date(),
            savedAt: new Date(),
          },
        });

        results.push({ id: submission.id, clientSubmissionId: s.clientSubmissionId, status: 'created' });
      } catch (err) {
        errors.push({ clientSubmissionId: s.clientSubmissionId, error: err.message });
      }
    }

    await prisma.syncLog.create({
      data: {
        userId,
        organizationId,
        deviceId: 'gedcollect-mobile',
        action: 'GEDCOLLECT_BATCH_SUBMIT',
        details: { total: submissions.length, success: results.length, errors: errors.length },
      },
    });

    res.status(201).json({ success: true, count: results.length, results, errors });
  } catch (err) {
    logger.error('[GEDCOLLECT] submitBatch error:', err);
    res.status(500).json({ success: false, error: 'Erreur soumission batch' });
  }
};

export const getSubmissionByClientId = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({ error: 'clientId requis' });
    }

    const submission = await prisma.toolboxSubmission.findFirst({
      where: { organizationId, clientSubmissionId: clientId },
      select: { id: true, updatedAt: true, savedAt: true, values: true, status: true },
    });

    if (!submission) {
      return res.status(404).json({ error: 'Soumission non trouvee' });
    }

    res.json({ submission: { ...submission, updatedAt: submission.updatedAt?.toISOString() || null } });
  } catch (err) {
    logger.error('[GEDCOLLECT] getSubmissionByClientId error:', err);
    res.status(500).json({ error: 'Erreur recuperation soumission' });
  }
};
