import prisma from '../../core/utils/prisma.js';
import logger from '../../utils/logger.js';

const TRAINING_CONFIG_KEY = 'ai_training_overrides';
const ACTIVE_STATUS = 'active';
const CLOSED_STATUS = 'closed';
const ACCEPTED_STATUS = 'accepted';

function normalizeQuestion(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function getConfigObject(config) {
  return config && typeof config === 'object' && !Array.isArray(config) ? { ...config } : {};
}

function hydrateEntry(entry = {}) {
  const active = entry.active !== false;
  const accepted = entry.lifecycleStatus === ACCEPTED_STATUS;
  return {
    active,
    lifecycleStatus: entry.lifecycleStatus || (active ? ACTIVE_STATUS : CLOSED_STATUS),
    closedAt: entry.closedAt || null,
    closedBy: entry.closedBy || null,
    acceptedAt: entry.acceptedAt || null,
    acceptedBy: entry.acceptedBy || null,
    accepted,
    ...entry,
  };
}

async function readOrganizationConfig(organizationId) {
  if (!organizationId) {
    throw new Error('organizationId is required.');
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, config: true },
  });

  if (!organization) {
    throw new Error('Organisation introuvable.');
  }

  const config = getConfigObject(organization.config);
  const entries = ensureArray(config[TRAINING_CONFIG_KEY]).map((entry) => hydrateEntry(entry));

  return { organizationId: organization.id, config, entries };
}

async function writeOrganizationEntries(organizationId, config, entries) {
  const nextConfig = {
    ...getConfigObject(config),
    [TRAINING_CONFIG_KEY]: entries,
  };

  await prisma.organization.update({
    where: { id: organizationId },
    data: { config: nextConfig },
  });

  return entries;
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    if (a.active !== b.active) {
      return a.active ? -1 : 1;
    }
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

export const mentorTrainingService = {
  normalizeQuestion,

  async listEntries(organizationId) {
    const { entries } = await readOrganizationConfig(organizationId);
    return sortEntries(entries);
  },

  async saveEntry({ organizationId, question, answer, createdBy }) {
    const normalizedQuestion = normalizeQuestion(question);
    if (!normalizedQuestion) {
      throw new Error('Question vide.');
    }
    if (!String(answer || '').trim()) {
      throw new Error('Réponse de référence vide.');
    }

    const now = new Date().toISOString();
    const { config, entries } = await readOrganizationConfig(organizationId);
    const nextEntries = [...entries];
    const existingIndex = nextEntries.findIndex(
      (entry) => entry.normalizedQuestion === normalizedQuestion
    );

    const nextEntry =
      existingIndex >= 0
        ? {
            ...hydrateEntry(nextEntries[existingIndex]),
            question,
            answer,
            normalizedQuestion,
            active: true,
            lifecycleStatus: ACTIVE_STATUS,
            closedAt: null,
            closedBy: null,
            acceptedAt: null,
            acceptedBy: null,
            updatedAt: now,
            updatedBy: createdBy || nextEntries[existingIndex].updatedBy || null,
          }
        : {
            id: crypto.randomUUID(),
            question,
            answer,
            normalizedQuestion,
            active: true,
            lifecycleStatus: ACTIVE_STATUS,
            createdAt: now,
            updatedAt: now,
            createdBy: createdBy || null,
            updatedBy: createdBy || null,
            closedAt: null,
            closedBy: null,
            acceptedAt: null,
            acceptedBy: null,
          };

    if (existingIndex >= 0) {
      nextEntries[existingIndex] = nextEntry;
    } else {
      nextEntries.push(nextEntry);
    }

    await writeOrganizationEntries(organizationId, config, nextEntries);
    return nextEntry;
  },

  async closeEntry({ organizationId, entryId, closedBy }) {
    const { config, entries } = await readOrganizationConfig(organizationId);
    const now = new Date().toISOString();
    const nextEntries = [...entries];
    const existingIndex = nextEntries.findIndex((entry) => entry.id === entryId);

    if (existingIndex < 0) {
      throw new Error('Entrée d’entraînement introuvable.');
    }

    nextEntries[existingIndex] = {
      ...hydrateEntry(nextEntries[existingIndex]),
      active: false,
      lifecycleStatus: CLOSED_STATUS,
      closedAt: now,
      closedBy: closedBy || nextEntries[existingIndex].closedBy || null,
      acceptedAt: null,
      acceptedBy: null,
      updatedAt: now,
      updatedBy: closedBy || nextEntries[existingIndex].updatedBy || null,
    };

    await writeOrganizationEntries(organizationId, config, nextEntries);
    return nextEntries[existingIndex];
  },

  async acceptEntry({ organizationId, entryId, acceptedBy }) {
    const { config, entries } = await readOrganizationConfig(organizationId);
    const now = new Date().toISOString();
    const nextEntries = [...entries];
    const existingIndex = nextEntries.findIndex((entry) => entry.id === entryId);

    if (existingIndex < 0) {
      throw new Error('Entrée d’entraînement introuvable.');
    }

    nextEntries[existingIndex] = {
      ...hydrateEntry(nextEntries[existingIndex]),
      active: true,
      lifecycleStatus: ACCEPTED_STATUS,
      closedAt: null,
      closedBy: null,
      acceptedAt: now,
      acceptedBy: acceptedBy || nextEntries[existingIndex].acceptedBy || null,
      updatedAt: now,
      updatedBy: acceptedBy || nextEntries[existingIndex].updatedBy || null,
    };

    await writeOrganizationEntries(organizationId, config, nextEntries);
    return nextEntries[existingIndex];
  },

  async findMatch({ organizationId, question }) {
    const normalizedQuestion = normalizeQuestion(question);
    if (!normalizedQuestion) return null;

    const entries = await this.listEntries(organizationId);
    const directMatch = entries.find(
      (entry) =>
        entry.active !== false &&
        entry.lifecycleStatus !== CLOSED_STATUS &&
        entry.normalizedQuestion === normalizedQuestion
    );

    if (directMatch) return directMatch;

    return null;
  },
};

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admingem';

export function isMentorTrainingAdmin(user = {}) {
  const role = String(user.role || user.roleLegacy || '').toUpperCase();
  return role === 'ADMIN_PROQUELEC' || role === 'ADMIN' || user.email === SUPER_ADMIN_EMAIL;
}

export function safeMentorTrainingError(error) {
  logger.error('Mentor training service failed', {
    error: error?.message,
    stack: error?.stack,
  });
  return error?.message || 'Erreur service entraînement IA.';
}
