/**
 * Formation Controller - Gestion des formations d'électriciens
 * Modules multiples par session, CRUD complet, planification
 */
import prisma from '../../core/utils/prisma.js';
import logger from '../../utils/logger.js';

const isDev = process.env.NODE_ENV !== 'production';

// Les 14 régions du Sénégal
const SENEGAL_REGIONS = [
  'Dakar',
  'Diourbel',
  'Fatick',
  'Kaffrine',
  'Kaolack',
  'Kedougou',
  'Kolda',
  'Louga',
  'Matam',
  'Saint-Louis',
  'Sedhiou',
  'Tambacounda',
  'Thies',
  'Ziguinchor'
];

// Modules de formation par défaut
const DEFAULT_MODULES = [
  { name: 'Habilitation électrique', description: 'Formation à la sécurité électrique et habilitation', duration: 3, order: 1 },
  { name: 'Normalisation', description: 'Normes électriques SN-CEI et internationales', duration: 2, order: 2 },
  { name: 'Conformité électrique', description: 'Contrôle et mise en conformité des installations', duration: 2, order: 3 },
  { name: 'Imprégnation sur le projet', description: 'Présentation du projet GEM et objectifs', duration: 1, order: 4 },
  { name: 'Disposition de branchement Senelec', description: 'Raccordement au réseau Senelec', duration: 2, order: 5 },
  { name: 'Application GEM-KOBO', description: "Utilisation de l'application GEM-KOBO terrain", duration: 2, order: 6 }
];

/**
 * GET /api/formations/modules - Liste des modules
 */
export const getModules = async (req, res) => {
  try {
    const modules = await prisma.formationModule.findMany({ orderBy: { order: 'asc' } });
    if (modules.length === 0) {
      await prisma.formationModule.createMany({ data: DEFAULT_MODULES });
      const freshModules = await prisma.formationModule.findMany({ orderBy: { order: 'asc' } });
      return res.json(freshModules);
    }
    res.json(modules);
  } catch (error) {
    logger.error('[FORMATION_GET_MODULES_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des modules' });
  }
};

/**
 * POST /api/formations/modules - Créer un module
 */
export const createModule = async (req, res) => {
  try {
    const { name, description, duration, order, isActive } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom du module requis' });

    let finalOrder = order;
    if (finalOrder === undefined || finalOrder === null) {
      const maxOrder = await prisma.formationModule.aggregate({ _max: { order: true } });
      finalOrder = (maxOrder._max.order || 0) + 1;
    }

    const module = await prisma.formationModule.create({
      data: {
        name,
        description: description || null,
        duration: duration || 1,
        order: finalOrder,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.status(201).json(module);
  } catch (error) {
    logger.error('[FORMATION_CREATE_MODULE_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la création du module' });
  }
};

/**
 * PUT /api/formations/modules/:id - Modifier un module
 */
export const updateModule = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, duration, order, isActive } = req.body;
    const module = await prisma.formationModule.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(duration && { duration }),
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive })
      }
    });
    res.json(module);
  } catch (error) {
    logger.error('[FORMATION_UPDATE_MODULE_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du module' });
  }
};

/**
 * DELETE /api/formations/modules/:id - Supprimer un module
 */
export const deleteModule = async (req, res) => {
  try {
    const { id } = req.params;
    const usageCount = await prisma.formationSessionModule.count({ where: { moduleId: id } });
    if (usageCount > 0) {
      await prisma.formationModule.update({ where: { id }, data: { isActive: false } });
      return res.json({ success: true, message: 'Module désactivé (utilisé dans des sessions)', deactivated: true });
    }
    await prisma.formationModule.delete({ where: { id } });
    res.json({ success: true, message: 'Module supprimé' });
  } catch (error) {
    logger.error('[FORMATION_DELETE_MODULE_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du module' });
  }
};

/**
 * GET /api/formations/sessions - Liste des sessions
 */
export const getSessions = async (req, res) => {
  try {
    const { region, status, startDate, endDate } = req.query;
    const where = {};
    if (region && region !== 'ALL') where.region = region;
    if (status && status !== 'ALL') where.status = status;
    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) where.startDate.gte = new Date(startDate);
      if (endDate) where.startDate.lte = new Date(endDate);
    }

    const sessions = await prisma.formationSession.findMany({
      where,
      include: { sessionModules: { include: { module: true }, orderBy: { orderIndex: 'asc' } }, participants: true },
      orderBy: { startDate: 'asc' }
    });

    const sessionsWithCalculated = sessions.map(session => {
      const totalDays = session.sessionModules.reduce((sum, sm) => sum + (sm.duration || sm.module.duration), 0);
      const endDate = session.endDate || calculateEndDate(new Date(session.startDate), totalDays, session.workSaturday, session.workSunday);
      return {
        ...session,
        totalDays,
        endDate,
        moduleCount: session.sessionModules.length,
        participantCount: session.participants.length,
        availableSlots: session.maxParticipants - session.participants.length
      };
    });

    res.json(sessionsWithCalculated);
  } catch (error) {
    logger.error('[FORMATION_GET_SESSIONS_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des sessions' });
  }
};

/**
 * POST /api/formations/sessions - Créer une session avec plusieurs modules
 */
export const createSession = async (req, res) => {
  try {
    const { region, salle, maxParticipants, startDate, workSaturday, workSunday, notes, modules } = req.body;
    if (!region || !salle || !startDate) return res.status(400).json({ error: 'Champs obligatoires manquants: région, salle, date de début' });
    if (!SENEGAL_REGIONS.includes(region)) return res.status(400).json({ error: 'Région invalide', validRegions: SENEGAL_REGIONS });
    if (!modules || !Array.isArray(modules) || modules.length === 0) return res.status(400).json({ error: 'Au moins un module est requis' });

    const totalDays = modules.reduce((sum, m) => sum + (m.duration || 1), 0);
    const endDate = calculateEndDate(new Date(startDate), totalDays, workSaturday, workSunday);

    const session = await prisma.formationSession.create({
      data: {
        region,
        salle,
        maxParticipants: maxParticipants || 20,
        startDate: new Date(startDate),
        endDate,
        workSaturday: workSaturday || false,
        workSunday: workSunday || false,
        notes: notes || null,
        status: 'PLANIFIEE',
        sessionModules: { create: modules.map((m, index) => ({ moduleId: m.moduleId, duration: m.duration || null, orderIndex: m.orderIndex ?? index, notes: m.notes || null })) }
      },
      include: { sessionModules: { include: { module: true }, orderBy: { orderIndex: 'asc' } } }
    });

    await createPlanningHistory('session_created', 'Session créée', `Création de session ${region} - ${salle}`, {
      sessionId: session.id,
      metadata: { region, salle, startDate, maxParticipants: maxParticipants || 20 }
    });

    res.status(201).json(session);
  } catch (error) {
    logger.error('[FORMATION_CREATE_SESSION_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la création de la session' });
  }
};

/**
 * PUT /api/formations/sessions/:id - Modifier une session
 */
export const updateSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { region, salle, maxParticipants, startDate, workSaturday, workSunday, notes, status, modules } = req.body;
    const existingSession = await prisma.formationSession.findUnique({ where: { id }, include: { sessionModules: true } });
    if (!existingSession) return res.status(404).json({ error: 'Session introuvable' });

    let newStartDate = startDate ? new Date(startDate) : existingSession.startDate;
    let newEndDate = existingSession.endDate;

    if (modules && Array.isArray(modules)) {
      await prisma.formationSessionModule.deleteMany({ where: { sessionId: id } });
      const totalDays = modules.reduce((sum, m) => sum + (m.duration || 1), 0);
      newEndDate = calculateEndDate(newStartDate, totalDays, workSaturday ?? existingSession.workSaturday, workSunday ?? existingSession.workSunday);
      await prisma.formationSessionModule.createMany({ data: modules.map((m, index) => ({ sessionId: id, moduleId: m.moduleId, duration: m.duration || null, orderIndex: m.orderIndex ?? index, notes: m.notes || null })) });
    } else if (startDate) {
      const totalDays = existingSession.sessionModules.reduce((sum, sm) => sum + (sm.duration || sm.module?.duration || 1), 0);
      newEndDate = calculateEndDate(newStartDate, totalDays, workSaturday ?? existingSession.workSaturday, workSunday ?? existingSession.workSunday);
    }

    const session = await prisma.formationSession.update({
      where: { id },
      data: {
        ...(region && { region }),
        ...(salle && { salle }),
        ...(maxParticipants && { maxParticipants }),
        ...(startDate && { startDate: newStartDate }),
        ...(newEndDate && { endDate: newEndDate }),
        ...(typeof workSaturday === 'boolean' && { workSaturday }),
        ...(typeof workSunday === 'boolean' && { workSunday }),
        ...(notes !== undefined && { notes }),
        ...(status && { status })
      },
      include: { sessionModules: { include: { module: true }, orderBy: { orderIndex: 'asc' } }, participants: true }
    });

    await createPlanningHistory('session_updated', 'Session mise à jour', `Mise à jour de la session ${session.region} - ${session.salle}`, {
      sessionId: session.id,
      metadata: {
        region: session.region,
        salle: session.salle,
        startDate: session.startDate,
        status: session.status
      }
    });

    res.json(session);
  } catch (error) {
    logger.error('[FORMATION_UPDATE_SESSION_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la session' });
  }
};

/**
 * DELETE /api/formations/sessions/:id
 */
export const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.formationSession.findUnique({ where: { id } });
    await prisma.formationSession.delete({ where: { id } });
    await createPlanningHistory('session_deleted', 'Session supprimée', `Suppression de la session ${existing?.region || id}`, {
      metadata: { sessionId: id, region: existing?.region || null, salle: existing?.salle || null }
    });
    res.json({ success: true, message: 'Session supprimée' });
  } catch (error) {
    logger.error('[FORMATION_DELETE_SESSION_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
};

/**
 * POST /api/formations/sessions/:id/modules - Ajouter un module à une session
 */
export const addModuleToSession = async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const { moduleId, duration, notes } = req.body;
    if (!moduleId) return res.status(400).json({ error: 'ID du module requis' });
    const module = await prisma.formationModule.findUnique({ where: { id: moduleId } });
    if (!module) return res.status(404).json({ error: 'Module introuvable' });
    const existing = await prisma.formationSessionModule.findFirst({ where: { sessionId, moduleId } });
    if (existing) return res.status(400).json({ error: 'Ce module est déjà dans la session' });

    const maxOrder = await prisma.formationSessionModule.aggregate({ where: { sessionId }, _max: { orderIndex: true } });
    const sessionModule = await prisma.formationSessionModule.create({
      data: { sessionId, moduleId, duration: duration || module.duration, orderIndex: (maxOrder._max.orderIndex || 0) + 1, notes: notes || null },
      include: { module: true }
    });

    await recalculateSessionEndDate(sessionId);
    res.status(201).json(sessionModule);
  } catch (error) {
    logger.error('[FORMATION_ADD_MODULE_SESSION_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout du module' });
  }
};

/**
 * DELETE /api/formations/sessions/:sessionId/modules/:moduleId
 */
export const removeModuleFromSession = async (req, res) => {
  try {
    const { sessionId, moduleId } = req.params;
    await prisma.formationSessionModule.deleteMany({ where: { sessionId, moduleId } });
    await recalculateSessionEndDate(sessionId);
    res.json({ success: true, message: 'Module retiré de la session' });
  } catch (error) {
    logger.error('[FORMATION_REMOVE_MODULE_SESSION_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors du retrait du module' });
  }
};

/**
 * POST /api/formations/sessions/:id/participants - Ajouter un participant
 */
export const addParticipant = async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const { name, email, phone, role } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom du participant requis' });

    const session = await prisma.formationSession.findUnique({ where: { id: sessionId }, include: { participants: true } });
    if (session.participants.length >= session.maxParticipants) return res.status(400).json({ error: 'Nombre maximum de participants atteint' });

    const participant = await prisma.formationParticipant.create({ data: { sessionId, name, email, phone, role } });
    res.status(201).json(participant);
  } catch (error) {
    logger.error('[FORMATION_ADD_PARTICIPANT_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout du participant' });
  }
};

/**
 * DELETE /api/formations/participants/:id
 */
export const removeParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.formationParticipant.delete({ where: { id } });
    res.json({ success: true, message: 'Participant supprimé' });
  } catch (error) {
    logger.error('[FORMATION_REMOVE_PARTICIPANT_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
};

/**
 * PUT /api/formations/participants/:id/attendance
 */
export const toggleAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { attendance } = req.body;
    const participant = await prisma.formationParticipant.update({ where: { id }, data: { attendance: attendance !== undefined ? attendance : undefined } });
    res.json(participant);
  } catch (error) {
    logger.error('[FORMATION_TOGGLE_ATTENDANCE_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
};

/**
 * GET /api/formations/regions
 */
export const getRegions = async (req, res) => { res.json(SENEGAL_REGIONS); };

/**
 * GET /api/formations/planning
 */
export const getPlanning = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {};
    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) where.startDate.gte = new Date(startDate);
      if (endDate) where.startDate.lte = new Date(endDate);
    }
    const sessions = await prisma.formationSession.findMany({ where, include: { sessionModules: { include: { module: true }, orderBy: { orderIndex: 'asc' } }, participants: true }, orderBy: { startDate: 'asc' } });
    const planning = sessions.map(session => {
      const totalDays = session.sessionModules.reduce((sum, sm) => sum + (sm.duration || sm.module.duration), 0);
      const endDate = session.endDate || calculateEndDate(new Date(session.startDate), totalDays, session.workSaturday, session.workSunday);
      return { ...session, totalDays, endDate, moduleCount: session.sessionModules.length, participantCount: session.participants.length, availableSlots: session.maxParticipants - session.participants.length };
    });
    res.json(planning);
  } catch (error) {
    logger.error('[FORMATION_GET_PLANNING_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du planning' });
  }
};

/**
 * GET /api/formations/stats
 */
export const getStats = async (req, res) => {
  try {
    const [totalSessions, totalParticipants, byRegion, byModule, byStatus, activeModules] = await Promise.all([
      prisma.formationSession.count(),
      prisma.formationParticipant.count(),
      prisma.formationSession.groupBy({ by: ['region'], _count: { id: true } }),
      prisma.formationSessionModule.groupBy({ by: ['moduleId'], _count: { id: true } }),
      prisma.formationSession.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.formationModule.count({ where: { isActive: true } })
    ]);

    const modules = await prisma.formationModule.findMany();
    const byModuleWithNames = byModule.map(m => ({ moduleId: m.moduleId, moduleName: modules.find(mod => mod.id === m.moduleId)?.name || 'Inconnu', count: m._count.id }));

    res.json({
      totalSessions,
      totalParticipants,
      activeModules,
      byRegion: byRegion.map(r => ({ region: r.region, count: r._count.id })),
      byModule: byModuleWithNames,
      byStatus: byStatus.map(s => ({ status: s.status, count: s._count.id }))
    });
  } catch (error) {
    logger.error('[FORMATION_GET_STATS_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors des statistiques' });
  }
};

/**
 * GET /api/formations/history
 */
export const getHistory = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 100);
    const history = await prisma.formationPlanningHistory.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        session: {
          select: { id: true, region: true, salle: true, startDate: true, endDate: true, status: true }
        }
      }
    });
    res.json(history);
  } catch (error) {
    logger.error('[FORMATION_GET_HISTORY_ERROR]', error);
    res.status(500).json({ error: "Erreur lors de la récupération de l'historique" });
  }
};

/**
 * POST /api/formations/history
 */
export const createHistoryEntry = async (req, res) => {
  try {
    const { action, title, details, sessionId, metadata } = req.body;
    if (!action || !title) {
      return res.status(400).json({ error: 'action et title sont requis' });
    }
    const entry = await createPlanningHistory(action, title, details || null, {
      sessionId: sessionId || null,
      metadata: metadata || null
    });
    res.status(201).json(entry);
  } catch (error) {
    logger.error('[FORMATION_CREATE_HISTORY_ERROR]', error);
    res.status(500).json({ error: "Erreur lors de la création de l'historique" });
  }
};

/**
 * POST /api/formations/sessions/:id/recalculate-cascade
 */
export const cascadeRescheduleSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, workSaturday, workSunday, region } = req.body;

    const target = await prisma.formationSession.findUnique({
      where: { id },
      include: { sessionModules: { include: { module: true }, orderBy: { orderIndex: 'asc' } } }
    });
    if (!target) return res.status(404).json({ error: 'Session introuvable' });
    if (!startDate) return res.status(400).json({ error: 'startDate requis' });

    const targetRegion = region || target.region;
    const allRegionalSessions = await prisma.formationSession.findMany({
      where: { region: targetRegion },
      include: { sessionModules: { include: { module: true }, orderBy: { orderIndex: 'asc' } } },
      orderBy: { startDate: 'asc' }
    });

    const targetIndex = allRegionalSessions.findIndex((session) => session.id === id);
    if (targetIndex === -1) return res.status(404).json({ error: 'Session cible absente de la région' });

    const updatedSessions = [];
    let nextStartDate = new Date(startDate);

    for (let index = targetIndex; index < allRegionalSessions.length; index += 1) {
      const session = allRegionalSessions[index];
      const totalDays = session.sessionModules.reduce((sum, sm) => sum + (sm.duration || sm.module?.duration || 1), 0);
      const nextEndDate = calculateEndDate(
        new Date(nextStartDate),
        totalDays,
        index === targetIndex ? (workSaturday ?? session.workSaturday) : session.workSaturday,
        index === targetIndex ? (workSunday ?? session.workSunday) : session.workSunday
      );

      const updated = await prisma.formationSession.update({
        where: { id: session.id },
        data: {
          ...(index === targetIndex && region ? { region } : {}),
          startDate: new Date(nextStartDate),
          endDate: nextEndDate,
          ...(index === targetIndex && typeof workSaturday === 'boolean' ? { workSaturday } : {}),
          ...(index === targetIndex && typeof workSunday === 'boolean' ? { workSunday } : {})
        },
        include: { sessionModules: { include: { module: true }, orderBy: { orderIndex: 'asc' } }, participants: true }
      });

      updatedSessions.push(updated);
      nextStartDate = new Date(nextEndDate);
      nextStartDate.setDate(nextStartDate.getDate() + 1);
    }

    await createPlanningHistory(
      'session_cascade_replanned',
      'Recalcul en cascade',
      `Décalage de ${updatedSessions.length} session(s) dans la région ${targetRegion}`,
      {
        sessionId: target.id,
        metadata: {
          region: targetRegion,
          updatedSessionIds: updatedSessions.map((session) => session.id),
          startDate
        }
      }
    );

    res.json({ success: true, count: updatedSessions.length, sessions: updatedSessions });
  } catch (error) {
    logger.error('[FORMATION_CASCADE_RESCHEDULE_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors du recalcul en cascade' });
  }
};

/**
 * POST /api/formations/bulk
 */
export const bulkCreateSessions = async (req, res) => {
  try {
    const { sessions } = req.body;
    if (!Array.isArray(sessions) || sessions.length === 0) return res.status(400).json({ error: 'Tableau de sessions requis' });
    const created = await prisma.formationSession.createMany({ data: sessions.map(s => ({ region: s.region, salle: s.salle, maxParticipants: s.maxParticipants || 20, startDate: new Date(s.startDate), workSaturday: s.workSaturday || false, workSunday: s.workSunday || false, status: 'PLANIFIEE' })) });
    res.status(201).json({ success: true, count: created.count, message: `${created.count} sessions créées` });
  } catch (error) {
    logger.error('[FORMATION_BULK_CREATE_ERROR]', error);
    res.status(500).json({ error: 'Erreur création en masse' });
  }
};

function calculateEndDate(startDate, durationDays, workSaturday, workSunday) {
  const date = new Date(startDate);
  let daysAdded = 0;
  while (daysAdded < durationDays) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    const isSunday = dayOfWeek === 0;
    if (!isSunday || (isSunday && workSunday)) {
      if (dayOfWeek !== 6 || (dayOfWeek === 6 && workSaturday)) {
        daysAdded++;
      }
    }
  }
  return date;
}

async function recalculateSessionEndDate(sessionId) {
  const session = await prisma.formationSession.findUnique({ where: { id: sessionId }, include: { sessionModules: { include: { module: true } } } });
  if (!session) return;
  const totalDays = session.sessionModules.reduce((sum, sm) => sum + (sm.duration || sm.module?.duration || 1), 0);
  const endDate = calculateEndDate(new Date(session.startDate), totalDays, session.workSaturday, session.workSunday);
  await prisma.formationSession.update({ where: { id: sessionId }, data: { endDate } });
}

async function createPlanningHistory(action, title, details, { sessionId = null, metadata = null } = {}) {
  return prisma.formationPlanningHistory.create({
    data: {
      action,
      title,
      details,
      metadata,
      ...(sessionId ? { sessionId } : {})
    }
  });
}

/**
 * POST /api/formations/planify - Génère un planning de sessions par région
 * Corps attendu : { startDate?, regions: [{ region, count, preferredSize? }], modules: [{ moduleId, duration? }], options: { preferredSize, maxPerGroup, includeWeekends } }
 */
export const planify = async (req, res) => {
  try {
    const plan = await generatePlan(req.body);
    res.json(plan);
  } catch (error) {
    logger.error('[FORMATION_PLANIFY_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la génération du planning' });
  }
};

async function generatePlan(body) {
  const { startDate, regions, modules, options } = body || {};
  if (!Array.isArray(regions) || regions.length === 0) {
    throw new Error('Tableau regions requis');
  }

  let moduleDefs = [];
  if (Array.isArray(modules) && modules.length > 0) {
    const ids = modules.map(m => m.moduleId).filter(Boolean);
    if (ids.length > 0) {
      const dbModules = await prisma.formationModule.findMany({ where: { id: { in: ids } } });
      moduleDefs = ids.map(id => {
        const m = dbModules.find(x => x.id === id);
        const supplied = modules.find(x => x.moduleId === id);
        return { moduleId: id, duration: supplied?.duration || m?.duration || 1 };
      });
    } else {
      moduleDefs = modules.map(m => ({ moduleId: m.moduleId, duration: m.duration || 1 }));
    }
  } else {
    const dbModules = await prisma.formationModule.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } });
    moduleDefs = dbModules.map(m => ({ moduleId: m.id, duration: m.duration || 1 }));
  }

  const totalModuleDays = moduleDefs.reduce((s, m) => s + (m.duration || 1), 0);
  const preferredDefault = options?.preferredSize || 20;
  const maxPerGroup = options?.maxPerGroup && Number(options.maxPerGroup) > 0 ? Number(options.maxPerGroup) : 25;
  const includeWeekends = options?.includeWeekends === true;

  const plan = { generatedAt: new Date(), sessions: [] };
  let cursorDate = startDate ? new Date(startDate) : new Date();

  for (const r of regions) {
    const regionName = r.region;
    const total = Number(r.count || 0);
    if (!regionName || total <= 0) continue;

    let preferredSize = r.preferredSize ? Number(r.preferredSize) : preferredDefault;
    if (preferredSize <= 0) preferredSize = preferredDefault;
    if (preferredSize > maxPerGroup) preferredSize = maxPerGroup;

    let groups = Math.ceil(total / preferredSize) || 1;
    if (Math.ceil(total / groups) > maxPerGroup) groups = Math.ceil(total / maxPerGroup);

    const baseSize = Math.floor(total / groups);
    let remainder = total % groups;
    const groupSizes = [];
    for (let i = 0; i < groups; i++) {
      const size = baseSize + (remainder > 0 ? 1 : 0);
      groupSizes.push(size);
      if (remainder > 0) remainder--;
    }

    for (let i = 0; i < groupSizes.length; i++) {
      const maxParticipants = groupSizes[i];
      const sStart = new Date(cursorDate);
      const sEnd = calculateEndDate(sStart, totalModuleDays, includeWeekends, includeWeekends);

      const sessionObj = { region: regionName, groupIndex: i + 1, maxParticipants, startDate: sStart, endDate: sEnd, modules: moduleDefs, workSaturday: includeWeekends, workSunday: includeWeekends };
      plan.sessions.push(sessionObj);

      cursorDate = new Date(sEnd);
      cursorDate.setDate(cursorDate.getDate() + 1);
    }
  }

  const overallEnd = plan.sessions.reduce((max, s) => (s.endDate > max ? s.endDate : max), new Date(0));
  plan.overallEndDate = overallEnd;
  return plan;
}

/**
 * POST /api/formations/planify/export
 * body: { plan? , format: 'pdf'|'doc' }
 */
export const exportPlanify = async (req, res) => {
  try {
    const { plan, format } = req.body;
    const usedPlan = plan || await generatePlan(req.body);
    const fmt = (format || 'pdf').toLowerCase();

    if (fmt === 'pdf') {
      // pdfmake ESM import differs; try to import the printer class directly
      let PdfPrinter;
      try {
        PdfPrinter = (await import('pdfmake/src/printer.js')).default;
      } catch (e) {
        const mod = await import('pdfmake');
        PdfPrinter = mod.default || mod;
      }
      const fonts = { Roboto: { normal: 'Helvetica' } };
      const printer = new PdfPrinter(fonts);
      const body = [ [{ text: 'Plan de formation', style: 'header', colSpan: 4 }, {}, {}, {}] ];
      for (const s of usedPlan.sessions) {
        body.push([s.region, `Groupe ${s.groupIndex}`, `${s.maxParticipants} pers.`, `${new Date(s.startDate).toLocaleDateString()} → ${new Date(s.endDate).toLocaleDateString()}` ]);
      }
      const docDefinition = { content: [ { text: 'Plan de formation', style: 'header' }, { table: { headerRows: 1, widths: ['*','auto','auto','auto'], body } } ], styles: { header: { fontSize: 16, bold: true } } };
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];
      pdfDoc.on('data', chunk => chunks.push(chunk));
      pdfDoc.on('end', () => {
        const result = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="plan_formation.pdf"');
        res.send(result);
      });
      pdfDoc.end();
      return;
    }

    if (fmt === 'docx') {
      try {
        const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun } = await import('docx');
        const rows = [];
        // header
        rows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph('Région')] }), new TableCell({ children: [new Paragraph('Groupe')] }), new TableCell({ children: [new Paragraph('Places')] }), new TableCell({ children: [new Paragraph('Période')] })] }));
        for (const s of usedPlan.sessions) {
          rows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph(String(s.region))] }), new TableCell({ children: [new Paragraph(`Groupe ${s.groupIndex}`)] }), new TableCell({ children: [new Paragraph(String(s.maxParticipants))] }), new TableCell({ children: [new Paragraph(`${new Date(s.startDate).toLocaleDateString()} → ${new Date(s.endDate).toLocaleDateString()}`)] })] }));
        }

        const table = new Table({ rows });
        const doc = new Document({ sections: [{ properties: {}, children: [new Paragraph({ text: 'Plan de formation', heading: 'Heading1' }), table] }] });
        const buffer = await Packer.toBuffer(doc);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', 'attachment; filename="plan_formation.docx"');
        return res.send(Buffer.from(buffer));
      } catch (e) {
        logger.error('[FORMATION_EXPORT_DOCX_ERROR]', e);
        // fallthrough to HTML fallback
      }
    }

    // fallback Word-compatible (HTML) export as .doc
    let html = `<html><head><meta charset="utf-8"><title>Plan de formation</title></head><body><h1>Plan de formation</h1><table border="1" cellpadding="6" cellspacing="0"><tr><th>Région</th><th>Groupe</th><th>Places</th><th>Période</th></tr>`;
    for (const s of usedPlan.sessions) {
      html += `<tr><td>${escapeHtml(s.region)}</td><td>Groupe ${s.groupIndex}</td><td>${s.maxParticipants}</td><td>${new Date(s.startDate).toLocaleDateString()} → ${new Date(s.endDate).toLocaleDateString()}</td></tr>`;
    }
    html += `</table></body></html>`;
    res.setHeader('Content-Type', 'application/msword');
    res.setHeader('Content-Disposition', 'attachment; filename="plan_formation.doc"');
    res.send(html);
  } catch (error) {
    logger.error('[FORMATION_EXPORT_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de l\'export' });
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * POST /api/formations/planify/commit
 * Persists un plan (sessions + modules) en base
 * body: { plan: { sessions: [...] } }
 */
export const commitPlanify = async (req, res) => {
  try {
    const { plan } = req.body;
    if (!plan || !Array.isArray(plan.sessions)) return res.status(400).json({ error: 'Plan sessions requis' });
    const created = [];
    for (const s of plan.sessions) {
      const session = await prisma.formationSession.create({ data: {
        region: s.region,
        salle: s.salle ?? 'Salle à définir',
        maxParticipants: s.maxParticipants || 20,
        startDate: new Date(s.startDate),
        endDate: new Date(s.endDate),
        workSaturday: !!s.workSaturday,
        workSunday: !!s.workSunday,
        status: 'PLANIFIEE',
        sessionModules: { create: (s.modules || []).map((m, idx) => ({ moduleId: m.moduleId, duration: m.duration || null, orderIndex: idx })) }
      }, include: { sessionModules: { include: { module: true } } } });
      created.push(session);
    }
    res.status(201).json({ success: true, count: created.length, sessions: created.map(s => ({ id: s.id, region: s.region })) });
  } catch (error) {
    logger.error('[FORMATION_COMMIT_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde du plan' });
  }
};

export default {
  getModules, createModule, updateModule, deleteModule,
  getSessions, createSession, updateSession, deleteSession,
  addModuleToSession, removeModuleFromSession,
  addParticipant, removeParticipant, toggleAttendance,
  getRegions, planify, exportPlanify, commitPlanify, getPlanning, getStats, bulkCreateSessions,
  getHistory, createHistoryEntry, cascadeRescheduleSession
};
