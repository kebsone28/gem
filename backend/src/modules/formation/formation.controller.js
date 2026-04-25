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
const FORMATION_PLANNER_STATE_ID = 'default';

function isHistoryFeatureUnavailable(error) {
  return (
    !prisma.formationPlanningHistory ||
    error?.name === 'TypeError' ||
    error?.code === 'P2021' ||
    error?.code === 'P2022'
  );
}

function isPlannerStateFeatureUnavailable(error) {
  return (
    !prisma.formationPlannerState ||
    error?.name === 'TypeError' ||
    error?.code === 'P2021' ||
    error?.code === 'P2022'
  );
}

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
 * GET /api/formations/planner-state
 */
export const getPlannerState = async (req, res) => {
  try {
    if (!prisma.formationPlannerState) {
      return res.json(null);
    }

    const state = await prisma.formationPlannerState.findUnique({
      where: { id: FORMATION_PLANNER_STATE_ID }
    });

    return res.json(state?.payload ?? null);
  } catch (error) {
    if (isPlannerStateFeatureUnavailable(error)) {
      logger.warn('[FORMATION_GET_PLANNER_STATE_UNAVAILABLE]', {
        reason: error?.message || 'planner_state_delegate_missing'
      });
      return res.json(null);
    }

    logger.error('[FORMATION_GET_PLANNER_STATE_ERROR]', error);
    return res.status(500).json({ error: 'Erreur lors de la récupération du brouillon de planification' });
  }
};

/**
 * PUT /api/formations/planner-state
 */
export const savePlannerState = async (req, res) => {
  try {
    if (!prisma.formationPlannerState) {
      return res.json({ success: false, unsupported: true });
    }

    const payload = req.body;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return res.status(400).json({ error: 'Payload de planification invalide' });
    }

    const state = await prisma.formationPlannerState.upsert({
      where: { id: FORMATION_PLANNER_STATE_ID },
      create: { id: FORMATION_PLANNER_STATE_ID, payload },
      update: { payload }
    });

    return res.json({ success: true, updatedAt: state.updatedAt });
  } catch (error) {
    if (isPlannerStateFeatureUnavailable(error)) {
      logger.warn('[FORMATION_SAVE_PLANNER_STATE_UNAVAILABLE]', {
        reason: error?.message || 'planner_state_delegate_missing'
      });
      return res.json({ success: false, unsupported: true });
    }

    logger.error('[FORMATION_SAVE_PLANNER_STATE_ERROR]', error);
    return res.status(500).json({ error: 'Erreur lors de la sauvegarde du brouillon de planification' });
  }
};

/**
 * GET /api/formations/history
 */
export const getHistory = async (req, res) => {
  try {
    if (!prisma.formationPlanningHistory) {
      return res.json([]);
    }

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
    if (isHistoryFeatureUnavailable(error)) {
      logger.warn('[FORMATION_GET_HISTORY_UNAVAILABLE]', {
        reason: error?.message || 'history_delegate_missing'
      });
      return res.json([]);
    }

    logger.error('[FORMATION_GET_HISTORY_ERROR]', error);
    res.status(500).json({ error: "Erreur lors de la récupération de l'historique" });
  }
};

/**
 * DELETE /api/formations/history
 */
export const clearHistory = async (req, res) => {
  try {
    if (!prisma.formationPlanningHistory) {
      return res.json({ success: true, count: 0 });
    }

    const deleted = await prisma.formationPlanningHistory.deleteMany({});
    return res.json({ success: true, count: deleted.count });
  } catch (error) {
    if (isHistoryFeatureUnavailable(error)) {
      logger.warn('[FORMATION_CLEAR_HISTORY_UNAVAILABLE]', {
        reason: error?.message || 'history_delegate_missing'
      });
      return res.json({ success: true, count: 0 });
    }

    logger.error('[FORMATION_CLEAR_HISTORY_ERROR]', error);
    return res.status(500).json({ error: "Erreur lors de la suppression de l'historique" });
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
  while (daysAdded < Math.max(1, durationDays)) {
    const dayOfWeek = date.getDay();
    const isSunday = dayOfWeek === 0;
    if (!isSunday || (isSunday && workSunday)) {
      if (dayOfWeek !== 6 || (dayOfWeek === 6 && workSaturday)) {
        daysAdded++;
      }
    }
    if (daysAdded < Math.max(1, durationDays)) {
      date.setDate(date.getDate() + 1);
    }
  }
  return date;
}

function formatIsoDate(date) {
  return new Date(date).toISOString().split('T')[0];
}

function parsePlannerDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function parseDateList(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/[,\n;]/)
    .map(value => value.trim())
    .filter(Boolean)
    .filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isWorkingDay(date, includeSaturday, blockedDates, includeSunday = false) {
  const day = date.getDay();
  const iso = formatIsoDate(date);
  if (blockedDates.has(iso)) return false;
  if (day === 0 && !includeSunday) return false;
  if (day === 6 && !includeSaturday) return false;
  return true;
}

function computeSessionEndDate(startDate, workUnits, includeSaturday, blockedDates, includeSunday = false) {
  const start = parsePlannerDate(startDate);
  if (!start) return startDate;

  let consumed = 0;
  let cursor = new Date(start);
  while (consumed < Math.max(1, workUnits)) {
    if (isWorkingDay(cursor, includeSaturday, blockedDates, includeSunday)) {
      consumed += 1;
    }
    if (consumed < Math.max(1, workUnits)) {
      cursor = addDays(cursor, 1);
    }
  }

  return formatIsoDate(cursor);
}

function buildDateRange(startDate, endDate) {
  const start = parsePlannerDate(startDate);
  const end = parsePlannerDate(endDate);
  const result = [];
  if (!start || !end) return result;

  let cursor = new Date(start);
  while (cursor <= end) {
    result.push(formatIsoDate(cursor));
    cursor = addDays(cursor, 1);
  }
  return result;
}

function diffDaysInclusive(startDate, endDate) {
  const start = parsePlannerDate(startDate);
  const end = parsePlannerDate(endDate);
  if (!start || !end) return 0;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

async function resolvePlannerModules(modules) {
  if (!Array.isArray(modules) || modules.length === 0) {
    throw new Error('Au moins un module actif est requis pour générer le planning');
  }

  const ids = modules.map(module => module?.moduleId).filter(Boolean);
  if (ids.length === 0) {
    throw new Error('Identifiants de modules invalides');
  }

  const dbModules = await prisma.formationModule.findMany({ where: { id: { in: ids } } });
  const moduleDefs = ids.map(id => {
    const dbModule = dbModules.find(module => module.id === id);
    const supplied = modules.find(module => module.moduleId === id);
    if (!dbModule && !supplied) {
      throw new Error(`Module introuvable: ${id}`);
    }

    return {
      moduleId: id,
      moduleName: supplied?.moduleName || supplied?.name || dbModule?.name || 'Module',
      duration: Math.max(1, Number(supplied?.duration || dbModule?.duration || 1)),
    };
  });

  if (moduleDefs.length === 0) {
    throw new Error('Aucun module exploitable pour générer le planning');
  }

  return moduleDefs;
}

function normalizePlannerResources(items, type) {
  if (!Array.isArray(items)) return [];

  if (type === 'trainers') {
    return items.map(item => ({
      id: String(item.id || ''),
      name: String(item.name || 'Formateur'),
      active: item.active !== false,
      unavailableDates: Array.isArray(item.unavailableDates)
        ? item.unavailableDates.filter(value => /^\d{4}-\d{2}-\d{2}$/.test(String(value)))
        : [],
    }));
  }

  return items.map(item => ({
    id: String(item.id || ''),
    name: String(item.name || 'Salle'),
    capacity: Math.max(1, Number(item.capacity || 1)),
    active: item.active !== false,
    unavailableDates: Array.isArray(item.unavailableDates)
      ? item.unavailableDates.filter(value => /^\d{4}-\d{2}-\d{2}$/.test(String(value)))
      : [],
  }));
}

function normalizePlannerRegions(regions) {
  if (!Array.isArray(regions)) return [];

  return regions
    .filter(region => region?.region && Number(region?.participants || region?.count || 0) > 0)
    .map(region => ({
      region: String(region.region),
      participants: Math.max(0, Number(region.participants || region.count || 0)),
      priority: Number(region.priority || 1),
      preferredRoomId: String(region.preferredRoomId || ''),
    }))
    .filter(region => SENEGAL_REGIONS.includes(region.region));
}

function validatePlanSessionShape(session) {
  if (!session?.region || !SENEGAL_REGIONS.includes(session.region)) {
    return 'Région de session invalide';
  }
  if (!session?.startDate || !session?.endDate) {
    return 'Dates de session manquantes';
  }
  if (!parsePlannerDate(session.startDate) || !parsePlannerDate(session.endDate)) {
    return 'Dates de session invalides';
  }
  if (!Array.isArray(session.modules) || session.modules.length === 0) {
    return 'Modules de session manquants';
  }
  if (Number(session.participants || session.maxParticipants || 0) <= 0) {
    return 'Nombre de participants invalide';
  }
  if (!session?.roomName && !session?.salle) {
    return 'Salle de session manquante';
  }
  return null;
}

function getPlannerCoveredDates(startDate, endDate, includeSaturday, blockedDates, includeSunday = false) {
  return buildDateRange(startDate, endDate).filter(dateValue => {
    const parsed = parsePlannerDate(dateValue);
    return parsed ? isWorkingDay(parsed, includeSaturday, blockedDates, includeSunday) : false;
  });
}

function buildValidatedPreviewSession({
  sourceSession,
  updates,
  plannerConfig,
  trainers,
  rooms,
  planSessions,
}) {
  if (!sourceSession) {
    throw new Error('Session prévisionnelle introuvable');
  }

  const includeSaturday = plannerConfig?.includeSaturday === true;
  const equipmentPerParticipant = Math.max(1, Number(plannerConfig?.equipmentPerParticipant || 1));
  const equipmentPool = Math.max(0, Number(plannerConfig?.equipmentPool || 0));
  const maxParticipantsPerSession = Math.max(
    1,
    Number(plannerConfig?.maxParticipantsPerSession || sourceSession.participants || 1)
  );
  const blockedDates = new Set([
    ...parseDateList(plannerConfig?.blockedDatesText),
    ...parseDateList(plannerConfig?.holidaysText),
  ]);

  const activeTrainers = normalizePlannerResources(trainers, 'trainers').filter(item => item.active);
  const activeRooms = normalizePlannerResources(rooms, 'rooms').filter(item => item.active);

  const nextRegion = String(updates?.region || sourceSession.region || '');
  if (!SENEGAL_REGIONS.includes(nextRegion)) {
    throw new Error('Région invalide');
  }

  const nextParticipants = Math.max(
    1,
    Number(updates?.participants ?? sourceSession.participants ?? sourceSession.maxParticipants ?? 1)
  );
  const nextStartDate = String(updates?.startDate || sourceSession.startDate || '');
  if (!parsePlannerDate(nextStartDate)) {
    throw new Error('Date de démarrage invalide');
  }

  const room = activeRooms.find(item => item.id === String(updates?.roomId || sourceSession.roomId || ''));
  if (!room) {
    throw new Error('Salle invalide ou inactive');
  }

  const trainer = activeTrainers.find(item => item.id === String(updates?.trainerId || sourceSession.trainerId || ''));
  if (!trainer) {
    throw new Error('Formateur invalide ou inactif');
  }

  if (room.capacity < nextParticipants) {
    throw new Error(`Capacité de salle insuffisante (${room.capacity})`);
  }

  const equipmentNeeded = nextParticipants * equipmentPerParticipant;
  if (equipmentNeeded > equipmentPool) {
    throw new Error("Stock d'équipements insuffisant pour cette session");
  }

  const normalizedModules = Array.isArray(sourceSession.modules)
    ? sourceSession.modules.map((module, index) => ({
        moduleId: String(module.moduleId || `module-${index}`),
        name: module.name || module.moduleName || 'Module',
        duration: Math.max(1, Number(module.duration || 1)),
      }))
    : [];

  if (normalizedModules.length === 0) {
    throw new Error('Modules de session manquants');
  }

  const totalModuleDays = normalizedModules.reduce((sum, module) => sum + module.duration, 0);
  const endDate = computeSessionEndDate(nextStartDate, totalModuleDays, includeSaturday, blockedDates);
  const coveredDates = getPlannerCoveredDates(nextStartDate, endDate, includeSaturday, blockedDates);
  const trainerUnavailable = new Set(trainer.unavailableDates);
  const roomUnavailable = new Set(room.unavailableDates);

  if (coveredDates.some(dateValue => trainerUnavailable.has(dateValue))) {
    throw new Error('Le formateur est indisponible sur la période choisie');
  }
  if (coveredDates.some(dateValue => roomUnavailable.has(dateValue))) {
    throw new Error('La salle est indisponible sur la période choisie');
  }

  const conflictingSession = (planSessions || []).find(session => {
    if (!session || session.id === sourceSession.id) return false;

    const otherModules = Array.isArray(session.modules)
      ? session.modules.map(module => ({
          duration: Math.max(1, Number(module?.duration || 1)),
        }))
      : [];
    const otherEndDate =
      session.endDate ||
      computeSessionEndDate(
        String(session.startDate || ''),
        otherModules.reduce((sum, module) => sum + module.duration, 0),
        includeSaturday,
        blockedDates
      );
    const otherCoveredDates = getPlannerCoveredDates(
      String(session.startDate || ''),
      otherEndDate,
      includeSaturday,
      blockedDates
    );
    const overlap = coveredDates.some(dateValue => otherCoveredDates.includes(dateValue));
    if (!overlap) return false;

    const roomConflict =
      String(session.roomId || '') === room.id ||
      String(session.roomName || session.salle || '').trim().toLowerCase() === room.name.trim().toLowerCase();
    const trainerConflict =
      String(session.trainerId || '') === trainer.id ||
      String(session.trainerName || '').trim().toLowerCase() === trainer.name.trim().toLowerCase();

    return roomConflict || trainerConflict;
  });

  if (conflictingSession) {
    throw new Error(
      `Conflit avec ${conflictingSession.region || 'une autre région'} session ${conflictingSession.indexInRegion || '?'}`
    );
  }

  return {
    ...sourceSession,
    region: nextRegion,
    participants: nextParticipants,
    startDate: nextStartDate,
    endDate,
    durationDays: diffDaysInclusive(nextStartDate, endDate),
    trainerId: trainer.id,
    trainerName: trainer.name,
    roomId: room.id,
    roomName: room.name,
    fillRate: Math.round((nextParticipants / maxParticipantsPerSession) * 100),
    equipmentNeeded,
    modules: normalizedModules,
  };
}

function validateCommittedPlanSessions(planSessions, workSaturday, workSunday) {
  const blockedDates = new Set();
  const roomOccupation = new Map();
  const trainerOccupation = new Map();

  for (const session of [...planSessions].sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))) {
    const validationError = validatePlanSessionShape(session);
    if (validationError) return validationError;

    const normalizedDuration = getSessionTotalDays(session);
    const computedEndDate = formatIsoDate(
      calculateEndDate(new Date(session.startDate), normalizedDuration, workSaturday, workSunday)
    );
    const coveredDates = getPlannerCoveredDates(
      String(session.startDate),
      computedEndDate,
      workSaturday,
      blockedDates,
      workSunday
    );

    const roomKey = String(session.roomName || session.salle || '').trim().toLowerCase();
    if (roomKey) {
      const occupied = roomOccupation.get(roomKey) || new Set();
      if (coveredDates.some(dateValue => occupied.has(dateValue))) {
        return `Conflit de salle détecté pour ${session.roomName || session.salle}`;
      }
      coveredDates.forEach(dateValue => occupied.add(dateValue));
      roomOccupation.set(roomKey, occupied);
    }

    const trainerKey = String(session.trainerName || '').trim().toLowerCase();
    if (trainerKey) {
      const occupied = trainerOccupation.get(trainerKey) || new Set();
      if (coveredDates.some(dateValue => occupied.has(dateValue))) {
        return `Conflit de formateur détecté pour ${session.trainerName}`;
      }
      coveredDates.forEach(dateValue => occupied.add(dateValue));
      trainerOccupation.set(trainerKey, occupied);
    }
  }

  return null;
}

async function generatePlannerPreview(body) {
  const plannerConfig = body?.plannerConfig || {};
  const selectedRegions = normalizePlannerRegions(body?.regions);
  if (selectedRegions.length === 0) {
    throw new Error('Sélectionnez au moins une région avec des stagiaires');
  }

  if (!plannerConfig.startDate) {
    throw new Error('La date de démarrage est requise');
  }

  const baseDate = parsePlannerDate(plannerConfig.startDate);
  if (!baseDate) {
    throw new Error('Date de démarrage invalide');
  }

  const selectedModules = await resolvePlannerModules(body?.modules);
  const totalModuleDays = selectedModules.reduce((sum, module) => sum + module.duration, 0);
  const blockedDates = new Set([
    ...parseDateList(plannerConfig.blockedDatesText),
    ...parseDateList(plannerConfig.holidaysText),
  ]);
  const includeSaturday = plannerConfig.includeSaturday === true;
  const deliveryMode = body?.plannerDeliveryMode === 'single' ? 'single' : 'multiple';
  const maxParticipantsPerSession = Math.max(1, Number(plannerConfig.maxParticipantsPerSession || 20));
  const equipmentPerParticipant = Math.max(1, Number(plannerConfig.equipmentPerParticipant || 1));
  const equipmentPool = Math.max(0, Number(plannerConfig.equipmentPool || 0));
  const daysBetweenSessions = Math.max(1, Number(plannerConfig.daysBetweenSessions || 1));

  const normalizedTrainers = normalizePlannerResources(body?.trainers, 'trainers').filter(item => item.active);
  const normalizedRooms = normalizePlannerResources(body?.rooms, 'rooms').filter(item => item.active);

  const activeTrainers =
    deliveryMode === 'single' ? normalizedTrainers.slice(0, 1) : normalizedTrainers;
  const activeRooms =
    deliveryMode === 'single' ? normalizedRooms : normalizedRooms;

  if (activeTrainers.length === 0 || activeRooms.length === 0) {
    throw new Error('Ajoutez au moins un formateur actif et une salle active');
  }

  const trainerOccupation = new Map();
  const roomOccupation = new Map();
  activeTrainers.forEach(trainer => {
    trainerOccupation.set(trainer.id, new Set(trainer.unavailableDates));
  });
  activeRooms.forEach(room => {
    roomOccupation.set(room.id, new Set(room.unavailableDates));
  });

  const alerts = [];
  const impossibleRegions = [];
  const generatedSessions = [];
  const orderedRegions = [...selectedRegions].sort(
    (a, b) => b.priority - a.priority || b.participants - a.participants
  );

  for (const region of orderedRegions) {
    const sessionCount = Math.ceil(region.participants / maxParticipantsPerSession);
    let regionScheduled = 0;

    for (let index = 0; index < sessionCount; index += 1) {
      const participants = Math.min(
        maxParticipantsPerSession,
        region.participants - index * maxParticipantsPerSession
      );
      const equipmentNeeded = participants * equipmentPerParticipant;

      if (equipmentNeeded > equipmentPool) {
        alerts.push(
          `${region.region} session ${index + 1}: ${equipmentNeeded} équipements requis pour un stock de ${equipmentPool}.`
        );
        impossibleRegions.push(region.region);
        continue;
      }

      let cursor = addDays(baseDate, regionScheduled * daysBetweenSessions);
      let booked = false;
      let tries = 0;

      while (!booked && tries < 365) {
        tries += 1;
        const startDate = formatIsoDate(cursor);
        const endDate = computeSessionEndDate(startDate, totalModuleDays, includeSaturday, blockedDates);
        const coveredDates = buildDateRange(startDate, endDate).filter(dateValue =>
          isWorkingDay(parsePlannerDate(dateValue) || new Date(), includeSaturday, blockedDates)
        );

        const preferredRoom =
          activeRooms.find(room => room.id === region.preferredRoomId && room.capacity >= participants) || null;

        const candidateRooms = preferredRoom
          ? [preferredRoom, ...activeRooms.filter(room => room.id !== preferredRoom.id && room.capacity >= participants)]
          : activeRooms.filter(room => room.capacity >= participants);

        const room = candidateRooms.find(candidateRoom =>
          coveredDates.every(dateValue => !roomOccupation.get(candidateRoom.id)?.has(dateValue))
        );

        const trainer = activeTrainers.find(candidateTrainer =>
          coveredDates.every(dateValue => !trainerOccupation.get(candidateTrainer.id)?.has(dateValue))
        );

        if (room && trainer) {
          coveredDates.forEach(dateValue => {
            trainerOccupation.get(trainer.id)?.add(dateValue);
            roomOccupation.get(room.id)?.add(dateValue);
          });

          generatedSessions.push({
            id: `preview-${region.region}-${index + 1}`,
            region: region.region,
            priority: region.priority,
            indexInRegion: index + 1,
            participants,
            trainerId: trainer.id,
            trainerName: trainer.name,
            roomId: room.id,
            roomName: room.name,
            startDate,
            endDate,
            durationDays: diffDaysInclusive(startDate, endDate),
            fillRate: Math.round((participants / maxParticipantsPerSession) * 100),
            equipmentNeeded,
            modules: selectedModules.map(module => ({
              moduleId: module.moduleId,
              name: module.moduleName,
              duration: module.duration,
            })),
          });

          regionScheduled += 1;
          booked = true;
        } else {
          cursor = addDays(cursor, 1);
        }
      }

      if (!booked) {
        alerts.push(`${region.region} session ${index + 1}: aucune combinaison salle/formateur disponible.`);
        impossibleRegions.push(region.region);
      }
    }
  }

  return {
    sessions: generatedSessions.sort((a, b) => a.startDate.localeCompare(b.startDate)),
    alerts,
    impossibleRegions: Array.from(new Set(impossibleRegions)),
  };
}

async function recalculateSessionEndDate(sessionId) {
  const session = await prisma.formationSession.findUnique({ where: { id: sessionId }, include: { sessionModules: { include: { module: true } } } });
  if (!session) return;
  const totalDays = session.sessionModules.reduce((sum, sm) => sum + (sm.duration || sm.module?.duration || 1), 0);
  const endDate = calculateEndDate(new Date(session.startDate), totalDays, session.workSaturday, session.workSunday);
  await prisma.formationSession.update({ where: { id: sessionId }, data: { endDate } });
}

async function createPlanningHistory(action, title, details, { sessionId = null, metadata = null } = {}) {
  if (!prisma.formationPlanningHistory) {
    return null;
  }

  try {
    return await prisma.formationPlanningHistory.create({
      data: {
        action,
        title,
        details,
        metadata,
        ...(sessionId ? { sessionId } : {})
      }
    });
  } catch (error) {
    if (isHistoryFeatureUnavailable(error)) {
      logger.warn('[FORMATION_CREATE_HISTORY_UNAVAILABLE]', {
        action,
        title,
        reason: error?.message || 'history_delegate_missing'
      });
      return null;
    }

    throw error;
  }
}

/**
 * POST /api/formations/planify - Génère un planning de sessions par région
 * Corps attendu : { startDate?, regions: [{ region, count, preferredSize? }], modules: [{ moduleId, duration? }], options: { preferredSize, maxPerGroup, includeWeekends } }
 */
export const planify = async (req, res) => {
  try {
    const plan = await generatePlannerPreview(req.body);
    res.json(plan);
  } catch (error) {
    logger.error('[FORMATION_PLANIFY_ERROR]', error);
    res.status(400).json({ error: error?.message || 'Erreur lors de la génération du planning' });
  }
};

/**
 * POST /api/formations/planify/validate-preview-session
 * Revalide une édition locale de session preview avec les mêmes règles que le moteur backend.
 */
export const validatePreviewSessionEdit = async (req, res) => {
  try {
    const { sessionId, updates, plan, plannerConfig, trainers, rooms } = req.body || {};
    if (!sessionId || !plan || !Array.isArray(plan.sessions)) {
      return res.status(400).json({ error: 'Session preview et plan courant requis' });
    }

    const sourceSession = plan.sessions.find(session => session.id === sessionId);
    const session = buildValidatedPreviewSession({
      sourceSession,
      updates: updates || {},
      plannerConfig: plannerConfig || {},
      trainers,
      rooms,
      planSessions: plan.sessions,
    });

    return res.json({ session });
  } catch (error) {
    logger.error('[FORMATION_VALIDATE_PREVIEW_SESSION_ERROR]', error);
    return res.status(400).json({ error: error?.message || 'Validation de session impossible' });
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
        return {
          moduleId: id,
          moduleName: supplied?.moduleName || supplied?.name || m?.name || 'Module',
          duration: supplied?.duration || m?.duration || 1
        };
      });
    } else {
      moduleDefs = modules.map(m => ({
        moduleId: m.moduleId,
        moduleName: m.moduleName || m.name || 'Module',
        duration: m.duration || 1
      }));
    }
  } else {
    const dbModules = await prisma.formationModule.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } });
    moduleDefs = dbModules.map(m => ({ moduleId: m.id, moduleName: m.name, duration: m.duration || 1 }));
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
      const { default: PDFDocument } = await import('pdfkit');
      const totalParticipants = usedPlan.sessions.reduce((sum, session) => sum + Number(session.maxParticipants || 0), 0);
      const pdfDoc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: { Title: 'Plan de formation' }
      });
      const chunks = [];
      pdfDoc.on('data', chunk => chunks.push(chunk));
      pdfDoc.on('end', () => {
        const result = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="plan_formation.pdf"');
        res.send(result);
      });

      pdfDoc.fontSize(22).fillColor('#16324f').text('Planning de formation', { align: 'center' });
      pdfDoc.moveDown(0.4);
      pdfDoc.fontSize(10).fillColor('#4b5d73').text('Synthèse détaillée des sessions, durées et modules.', { align: 'center' });
      pdfDoc.moveDown(1.2);

      pdfDoc.fontSize(11).fillColor('#16324f');
      pdfDoc.text(`Démarrage: ${usedPlan.sessions[0] ? formatPlanDate(usedPlan.sessions[0].startDate) : '-'}`);
      pdfDoc.text(`Sessions: ${usedPlan.sessions.length}`);
      pdfDoc.text(`Participants: ${totalParticipants}`);
      pdfDoc.text(`Fin estimée: ${usedPlan.overallEndDate ? formatPlanDate(usedPlan.overallEndDate) : '-'}`);
      pdfDoc.moveDown(1);

      for (const [index, session] of usedPlan.sessions.entries()) {
        const sessionDuration = getSessionTotalDays(session);

        if (index > 0 && pdfDoc.y > 680) {
          pdfDoc.addPage();
        }

        pdfDoc
          .roundedRect(40, pdfDoc.y, 515, 22, 6)
          .fill('#eef5ff')
          .fillColor('#16324f')
          .fontSize(13)
          .text(`${session.region} • Session ${session.groupIndex}`, 52, pdfDoc.y - 16);

        pdfDoc.moveDown(1.4);
        pdfDoc.fontSize(10).fillColor('#1f2d3d');
        pdfDoc.text(`Participants: ${session.maxParticipants}`);
        pdfDoc.text(`Durée session: ${sessionDuration} jour(s)`);
        pdfDoc.text(`Période: ${formatPlanDate(session.startDate)} au ${formatPlanDate(session.endDate)}`);
        pdfDoc.text(`Salle: ${session.salle || 'Salle à définir'}`);
        pdfDoc.text(`Formateur: ${session.trainerName || 'À affecter'}`);
        pdfDoc.moveDown(0.5);
        pdfDoc.fontSize(11).fillColor('#16324f').text('Modules prévus');
        pdfDoc.moveDown(0.2);

        for (const module of session.modules || []) {
          pdfDoc
            .fontSize(10)
            .fillColor('#1f2d3d')
            .text(`• ${module.moduleName || module.name || 'Module'}: ${module.duration || 1} jour(s)`, {
              indent: 10
            });
        }

        pdfDoc.moveDown(1);
      }

      pdfDoc.end();
      return;
    }

    if (fmt === 'docx') {
      try {
        const {
          AlignmentType,
          BorderStyle,
          Document,
          HeadingLevel,
          Packer,
          Paragraph,
          Table,
          TableCell,
          TableLayoutType,
          TableRow,
          TextRun,
          WidthType
        } = await import('docx');

        const totalParticipants = usedPlan.sessions.reduce((sum, session) => sum + Number(session.maxParticipants || 0), 0);
        const tableBorders = {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'D9E2F1' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D9E2F1' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'D9E2F1' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'D9E2F1' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E8EEF7' },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E8EEF7' },
        };
        const headerFill = 'E7EDF5';
        const labelCell = (text) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
          });
        const valueCell = (text) =>
          new TableCell({
            children: [new Paragraph(String(text ?? '-'))],
          });
        const headerCell = (text, width) =>
          new TableCell({
            width,
            shading: { fill: headerFill },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text, bold: true })],
              }),
            ],
          });
        const bodyCell = (text, width, align = AlignmentType.LEFT) =>
          new TableCell({
            width,
            children: [
              new Paragraph({
                alignment: align,
                children: [new TextRun(String(text ?? '-'))],
              }),
            ],
          });

        const summaryRows = [
          new TableRow({
            children: [
              labelCell('Démarrage'),
              valueCell(usedPlan.sessions[0] ? formatPlanDate(usedPlan.sessions[0].startDate) : '-'),
              labelCell('Sessions'),
              valueCell(usedPlan.sessions.length),
            ],
          }),
          new TableRow({
            children: [
              labelCell('Participants'),
              valueCell(totalParticipants),
              labelCell('Fin estimée'),
              valueCell(usedPlan.overallEndDate ? formatPlanDate(usedPlan.overallEndDate) : '-'),
            ],
          }),
        ];

        const sessionsSummaryRows = [
          new TableRow({
            children: [
              headerCell('Région', { size: 1400, type: WidthType.DXA }),
              headerCell('Session', { size: 1100, type: WidthType.DXA }),
              headerCell('Participants', { size: 1200, type: WidthType.DXA }),
              headerCell('Jours totaux', { size: 1200, type: WidthType.DXA }),
              headerCell('Début', { size: 1200, type: WidthType.DXA }),
              headerCell('Fin', { size: 1200, type: WidthType.DXA }),
              headerCell('Salle', { size: 1500, type: WidthType.DXA }),
              headerCell('Formateur', { size: 1600, type: WidthType.DXA }),
            ],
          }),
          ...usedPlan.sessions.map((session) =>
            new TableRow({
              children: [
                bodyCell(session.region, { size: 1400, type: WidthType.DXA }),
                bodyCell(`Session ${session.groupIndex}`, { size: 1100, type: WidthType.DXA }, AlignmentType.CENTER),
                bodyCell(session.maxParticipants || 0, { size: 1200, type: WidthType.DXA }, AlignmentType.CENTER),
                bodyCell(`${getSessionTotalDays(session)} j`, { size: 1200, type: WidthType.DXA }, AlignmentType.CENTER),
                bodyCell(formatPlanDate(session.startDate), { size: 1200, type: WidthType.DXA }, AlignmentType.CENTER),
                bodyCell(formatPlanDate(session.endDate), { size: 1200, type: WidthType.DXA }, AlignmentType.CENTER),
                bodyCell(session.salle || 'Salle à définir', { size: 1500, type: WidthType.DXA }),
                bodyCell(session.trainerName || 'À affecter', { size: 1600, type: WidthType.DXA }),
              ],
            })
          ),
        ];

        const sessionBlocks = usedPlan.sessions.flatMap((session, index) => {
          const sessionDuration = getSessionTotalDays(session);
          const modulesTableRows = [
            new TableRow({
              children: [
                headerCell('Module', { size: 6600, type: WidthType.DXA }),
                headerCell('Durée', { size: 2600, type: WidthType.DXA }),
              ],
            }),
            ...(session.modules || []).map((module) =>
              new TableRow({
                children: [
                  bodyCell(module.moduleName || module.name || 'Module', { size: 6600, type: WidthType.DXA }),
                  bodyCell(`${module.duration || 1} jour(s)`, { size: 2600, type: WidthType.DXA }, AlignmentType.CENTER),
                ],
              })
            ),
          ];

          return [
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { before: index === 0 ? 180 : 240, after: 80 },
              children: [
                new TextRun({
                  text: `${session.region} • Session ${session.groupIndex}`,
                  bold: true,
                }),
              ],
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              layout: TableLayoutType.FIXED,
              borders: tableBorders,
              rows: [
                new TableRow({
                  children: [
                    labelCell('Participants'),
                    valueCell(session.maxParticipants || 0),
                    labelCell('Jours totaux'),
                    valueCell(`${sessionDuration} jour(s)`),
                  ],
                }),
                new TableRow({
                  children: [
                    labelCell('Début'),
                    valueCell(formatPlanDate(session.startDate)),
                    labelCell('Fin'),
                    valueCell(formatPlanDate(session.endDate)),
                  ],
                }),
                new TableRow({
                  children: [
                    labelCell('Salle'),
                    valueCell(session.salle || 'Salle à définir'),
                    labelCell('Formateur'),
                    valueCell(session.trainerName || 'À affecter'),
                  ],
                }),
              ],
            }),
            new Paragraph({
              spacing: { before: 90, after: 60 },
              children: [new TextRun({ text: 'Tableau des modules', bold: true, color: '1F3A5F' })],
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              layout: TableLayoutType.FIXED,
              borders: tableBorders,
              rows: modulesTableRows,
            }),
          ];
        });

        const doc = new Document({
          sections: [
            {
              properties: {},
              children: [
                new Paragraph({
                  heading: HeadingLevel.TITLE,
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'Planning de formation', bold: true, size: 34 })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 180 },
                  children: [
                    new TextRun({
                      text: 'Synthèse tabulaire des sessions et des modules.',
                      color: '44546A',
                    }),
                  ],
                }),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  layout: TableLayoutType.FIXED,
                  borders: tableBorders,
                  rows: summaryRows,
                }),
                new Paragraph({
                  spacing: { before: 160, after: 80 },
                  children: [new TextRun({ text: 'Tableau général des sessions', bold: true, color: '1F3A5F' })],
                }),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  layout: TableLayoutType.FIXED,
                  borders: tableBorders,
                  rows: sessionsSummaryRows,
                }),
                new Paragraph({
                  pageBreakBefore: true,
                  heading: HeadingLevel.HEADING_1,
                  spacing: { after: 100 },
                  children: [new TextRun({ text: 'Détail des modules par session', bold: true })],
                }),
                ...sessionBlocks,
              ],
            },
          ],
        });
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
    const totalParticipants = usedPlan.sessions.reduce((sum, session) => sum + Number(session.maxParticipants || 0), 0);
    let html = `
      <html>
        <head>
          <meta charset="utf-8">
          <title>Plan de formation</title>
          <style>
            body { font-family: Calibri, Arial, sans-serif; color: #16324f; margin: 28px; }
            h1 { font-size: 28px; margin: 0 0 6px; }
            h2 { font-size: 18px; margin: 24px 0 10px; color: #1f3a5f; }
            p { margin: 0 0 10px; }
            .summary { border: 1px solid #d9e2f1; border-radius: 12px; padding: 16px; background: #f8fbff; margin-bottom: 20px; }
            .summary-grid { width: 100%; border-collapse: collapse; }
            .summary-grid td { border: 1px solid #d9e2f1; padding: 10px 12px; }
            .summary-grid tr:first-child td,
            .session-table tr:first-child td { background: #e7edf5; }
            .label { font-weight: 700; width: 22%; }
            .session { border: 1px solid #d9e2f1; border-radius: 12px; padding: 16px; margin-bottom: 18px; }
            .session-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .session-table td { border: 1px solid #e8eef7; padding: 10px 12px; vertical-align: top; }
            .page-break { page-break-before: always; }
          </style>
        </head>
        <body>
          <h1>Planning de formation</h1>
          <p>Document de synthèse avec le détail des sessions et des modules.</p>
          <div class="summary">
            <table class="summary-grid">
              <tr>
                <td class="label">Démarrage</td>
                <td>${usedPlan.sessions[0] ? formatPlanDate(usedPlan.sessions[0].startDate) : '-'}</td>
                <td class="label">Sessions</td>
                <td>${usedPlan.sessions.length}</td>
              </tr>
              <tr>
                <td class="label">Participants</td>
                <td>${totalParticipants}</td>
                <td class="label">Fin estimée</td>
                <td>${usedPlan.overallEndDate ? formatPlanDate(usedPlan.overallEndDate) : '-'}</td>
              </tr>
            </table>
          </div>
          <h2>Tableau général des sessions</h2>
          <table class="session-table">
            <tr>
              <td class="label">Région</td>
              <td class="label">Session</td>
              <td class="label">Participants</td>
              <td class="label">Jours totaux</td>
              <td class="label">Début</td>
              <td class="label">Fin</td>
              <td class="label">Salle</td>
              <td class="label">Formateur</td>
            </tr>
            ${usedPlan.sessions
              .map(
                (s) => `
                  <tr>
                    <td>${escapeHtml(s.region)}</td>
                    <td>Session ${escapeHtml(s.groupIndex)}</td>
                    <td>${escapeHtml(s.maxParticipants)}</td>
                    <td>${getSessionTotalDays(s)} jour(s)</td>
                    <td>${formatPlanDate(s.startDate)}</td>
                    <td>${formatPlanDate(s.endDate)}</td>
                    <td>${escapeHtml(s.salle || 'Salle à définir')}</td>
                    <td>${escapeHtml(s.trainerName || 'À affecter')}</td>
                  </tr>
                `
              )
              .join('')}
          </table>
          <div class="page-break"></div>
          <h2>Détail des modules par session</h2>
    `;
    for (const s of usedPlan.sessions) {
      const sessionDuration = getSessionTotalDays(s);
      html += `
        <div class="session">
          <h2>${escapeHtml(s.region)} • Session ${escapeHtml(s.groupIndex)}</h2>
          <table class="session-table">
            <tr>
              <td class="label">Participants</td>
              <td>${escapeHtml(s.maxParticipants)}</td>
              <td class="label">Jours totaux</td>
              <td>${sessionDuration} jour(s)</td>
            </tr>
            <tr>
              <td class="label">Début</td>
              <td>${formatPlanDate(s.startDate)}</td>
              <td class="label">Fin</td>
              <td>${formatPlanDate(s.endDate)}</td>
            </tr>
            <tr>
              <td class="label">Salle</td>
              <td>${escapeHtml(s.salle || 'Salle à définir')}</td>
              <td class="label">Formateur</td>
              <td>${escapeHtml(s.trainerName || 'À affecter')}</td>
            </tr>
          </table>
          <h2>Tableau des modules</h2>
          <table class="session-table">
            <tr>
              <td class="label">Module</td>
              <td class="label">Durée</td>
            </tr>
            ${(s.modules || [])
              .map(
                (module) => `
                  <tr>
                    <td>${escapeHtml(module.moduleName || module.name || 'Module')}</td>
                    <td>${escapeHtml(module.duration || 1)} jour(s)</td>
                  </tr>
                `
              )
              .join('')}
          </table>
        </div>
      `;
    }
    html += `</body></html>`;
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

function formatPlanDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('fr-FR');
}

function getSessionTotalDays(session) {
  return (session.modules || []).reduce((sum, module) => sum + Number(module.duration || 1), 0);
}

function resolvePdfPrinter(mod) {
  if (typeof mod === 'function') return mod;
  if (typeof mod?.default === 'function') return mod.default;
  if (typeof mod?.default?.default === 'function') return mod.default.default;
  return null;
}

/**
 * POST /api/formations/planify/commit
 * Persists un plan (sessions + modules) en base
 * body: { plan: { sessions: [...] } }
 */
export const commitPlanify = async (req, res) => {
  try {
    const { plan, options } = req.body || {};
    if (!plan || !Array.isArray(plan.sessions) || plan.sessions.length === 0) {
      return res.status(400).json({ error: 'Plan sessions requis' });
    }

    const validationError = plan.sessions.map(validatePlanSessionShape).find(Boolean);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const workSaturday = options?.workSaturday === true;
    const workSunday = options?.workSunday === true;
    const planConflictError = validateCommittedPlanSessions(plan.sessions, workSaturday, workSunday);
    if (planConflictError) {
      return res.status(400).json({ error: planConflictError });
    }

    const created = await prisma.$transaction(async tx => {
      const createdSessions = [];

      for (const session of plan.sessions) {
        const normalizedModules = (session.modules || []).map((module, index) => ({
          moduleId: module.moduleId,
          duration: Math.max(1, Number(module.duration || 1)),
          orderIndex: index,
        }));
        const endDate = calculateEndDate(
          new Date(session.startDate),
          getSessionTotalDays({ modules: normalizedModules }),
          workSaturday,
          workSunday
        );

        const createdSession = await tx.formationSession.create({
          data: {
            region: session.region,
            salle: session.roomName || session.salle || 'Salle à définir',
            maxParticipants: Number(session.participants || session.maxParticipants || 20),
            startDate: new Date(session.startDate),
            endDate,
            workSaturday,
            workSunday,
            status: 'PLANIFIEE',
            notes: [
              session.trainerName ? `Formateur: ${session.trainerName}` : null,
              session.priority ? `Priorité région: ${session.priority}` : null,
            ]
              .filter(Boolean)
              .join(' • ') || null,
            sessionModules: {
              create: normalizedModules.map(module => ({
                moduleId: module.moduleId,
                duration: module.duration,
                orderIndex: module.orderIndex,
              })),
            },
          },
          include: {
            sessionModules: { include: { module: true }, orderBy: { orderIndex: 'asc' } },
          },
        });

        createdSessions.push(createdSession);
      }

      return createdSessions;
    });

    await createPlanningHistory(
      'preview_persisted',
      'Planning enregistré',
      `${created.length} session(s) enregistrée(s) en base.`,
      {
        metadata: {
          count: created.length,
          regions: Array.from(new Set(created.map(session => session.region))),
        },
      }
    );

    res.status(201).json({
      success: true,
      count: created.length,
      sessions: created.map(session => ({ id: session.id, region: session.region })),
    });
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
  getRegions, planify, validatePreviewSessionEdit, exportPlanify, commitPlanify, getPlanning, getStats, getPlannerState, savePlannerState, bulkCreateSessions,
  getHistory, createHistoryEntry, clearHistory, cascadeRescheduleSession
};
