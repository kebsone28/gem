/**
 * Formation Controller - Gestion des formations d'électriciens
 * Modules, sessions, participants, planification
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
  { name: 'Habilitation électrique', description: 'Formation à la sécurité électrique et habilitation', duration: 3 },
  { name: 'Normalisation', description: 'Normes électriques SN-CEI et internationales', duration: 2 },
  { name: 'Conformité électrique', description: 'Contrôle et mise en conformité des installations', duration: 2 },
  { name: 'Imprégnation sur le projet', description: 'Présentation du projet GEM et objectifs', duration: 1 },
  { name: 'Disposition de branchement Senelec', description: 'Raccordement au réseau Senelec', duration: 2 },
  { name: 'Application GEM-KOBO', description: 'Utilisation de l\'application GEM-KOBO terrain', duration: 2 }
];

/**
 * GET /api/formations/modules - Liste des modules
 */
export const getModules = async (req, res) => {
  try {
    const modules = await prisma.formationModule.findMany({
      orderBy: { order: 'asc' }
    });
    
    // Si aucun module, créer les默认值
    if (modules.length === 0) {
      const created = await prisma.formationModule.createMany({
        data: DEFAULT_MODULES.map((m, i) => ({ ...m, order: i + 1 }))
      });
      
      const freshModules = await prisma.formationModule.findMany({
        orderBy: { order: 'asc' }
      });
      
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
    const { name, description, duration, order } = req.body;
    
    if (!name || !duration) {
      return res.status(400).json({ error: 'Nom et durée requis' });
    }
    
    const module = await prisma.formationModule.create({
      data: { name, description, duration, order: order || 0 }
    });
    
    res.status(201).json(module);
  } catch (error) {
    logger.error('[FORMATION_CREATE_MODULE_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la création du module' });
  }
};

/**
 * GET /api/formations/sessions - Liste des sessions avec filtres
 */
export const getSessions = async (req, res) => {
  try {
    const { region, status, moduleId, startDate, endDate } = req.query;
    
    const where = {};
    
    if (region && region !== 'ALL') where.region = region;
    if (status && status !== 'ALL') where.status = status;
    if (moduleId) where.moduleId = moduleId;
    
    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) where.startDate.gte = new Date(startDate);
      if (endDate) where.startDate.lte = new Date(endDate);
    }
    
    const sessions = await prisma.formationSession.findMany({
      where,
      include: {
        module: true,
        participants: true
      },
      orderBy: { startDate: 'asc' }
    });
    
    res.json(sessions);
  } catch (error) {
    logger.error('[FORMATION_GET_SESSIONS_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des sessions' });
  }
};

/**
 * POST /api/formations/sessions - Créer une session
 */
export const createSession = async (req, res) => {
  try {
    const { 
      moduleId, 
      region, 
      salle, 
      maxParticipants, 
      startDate, 
      durationDays,
      workSaturday,
      workSunday
    } = req.body;
    
    // Validation
    if (!moduleId || !region || !salle || !startDate || !durationDays) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }
    
    if (!SENEGAL_REGIONS.includes(region)) {
      return res.status(400).json({ 
        error: 'Région invalide',
        validRegions: SENEGAL_REGIONS
      });
    }
    
    const session = await prisma.formationSession.create({
      data: {
        moduleId,
        region,
        salle,
        maxParticipants: maxParticipants || 20,
        startDate: new Date(startDate),
        durationDays: parseInt(durationDays),
        workSaturday: workSaturday || false,
        workSunday: workSunday || false,
        status: 'PLANIFIEE'
      },
      include: {
        module: true
      }
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
    const { 
      region, 
      salle, 
      maxParticipants, 
      startDate, 
      durationDays,
      workSaturday,
      workSunday,
      status 
    } = req.body;
    
    const session = await prisma.formationSession.update({
      where: { id },
      data: {
        ...(region && { region }),
        ...(salle && { salle }),
        ...(maxParticipants && { maxParticipants }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(durationDays && { durationDays: parseInt(durationDays) }),
        ...(typeof workSaturday === 'boolean' && { workSaturday }),
        ...(typeof workSunday === 'boolean' && { workSunday }),
        ...(status && { status })
      },
      include: {
        module: true,
        participants: true
      }
    });
    
    res.json(session);
  } catch (error) {
    logger.error('[FORMATION_UPDATE_SESSION_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la session' });
  }
};

/**
 * DELETE /api/formations/sessions/:id - Supprimer une session
 */
export const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.formationSession.delete({
      where: { id }
    });
    
    res.json({ success: true, message: 'Session supprimée' });
  } catch (error) {
    logger.error('[FORMATION_DELETE_SESSION_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de la session' });
  }
};

/**
 * POST /api/formations/sessions/:id/participants - Ajouter un participant
 */
export const addParticipant = async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const { name, email, phone, role } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Nom du participant requis' });
    }
    
    // Vérifier le nombre max de participants
    const session = await prisma.formationSession.findUnique({
      where: { id: sessionId },
      include: { participants: true }
    });
    
    if (session.participants.length >= session.maxParticipants) {
      return res.status(400).json({ error: 'Nombre maximum de participants atteint' });
    }
    
    const participant = await prisma.formationParticipant.create({
      data: { sessionId, name, email, phone, role }
    });
    
    res.status(201).json(participant);
  } catch (error) {
    logger.error('[FORMATION_ADD_PARTICIPANT_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de l\'ajout du participant' });
  }
};

/**
 * DELETE /api/formations/participants/:id - Supprimer un participant
 */
export const removeParticipant = async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.formationParticipant.delete({
      where: { id }
    });
    
    res.json({ success: true, message: 'Participant supprimé' });
  } catch (error) {
    logger.error('[FORMATION_REMOVE_PARTICIPANT_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du participant' });
  }
};

/**
 * PUT /api/formations/participants/:id/attendance - Marquer présence
 */
export const toggleAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { attendance } = req.body;
    
    const participant = await prisma.formationParticipant.update({
      where: { id },
      data: { attendance: attendance !== undefined ? attendance : undefined }
    });
    
    res.json(participant);
  } catch (error) {
    logger.error('[FORMATION_TOGGLE_ATTENDANCE_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la présence' });
  }
};

/**
 * GET /api/formations/regions - Liste des régions du Sénégal
 */
export const getRegions = async (req, res) => {
  res.json(SENEGAL_REGIONS);
};

/**
 * GET /api/formations/planning - Planning complet avec dates calculées
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
    
    const sessions = await prisma.formationSession.findMany({
      where,
      include: {
        module: true,
        participants: true
      },
      orderBy: { startDate: 'asc' }
    });
    
    // Calculer les dates de fin pour chaque session
    const planning = sessions.map(session => {
      const start = new Date(session.startDate);
      const end = calculateEndDate(start, session.durationDays, session.workSaturday, session.workSunday);
      
      return {
        ...session,
        startDate: start,
        endDate: end,
        participantCount: session.participants.length,
        availableSlots: session.maxParticipants - session.participants.length
      };
    });
    
    res.json(planning);
  } catch (error) {
    logger.error('[FORMATION_GET_PLANNING_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du planning' });
  }
};

/**
 * POST /api/formations/bulk - Créer plusieurs sessions en masse
 */
export const bulkCreateSessions = async (req, res) => {
  try {
    const { sessions } = req.body;
    
    if (!Array.isArray(sessions) || sessions.length === 0) {
      return res.status(400).json({ error: 'Tableau de sessions requis' });
    }
    
    const created = await prisma.formationSession.createMany({
      data: sessions.map(s => ({
        moduleId: s.moduleId,
        region: s.region,
        salle: s.salle,
        maxParticipants: s.maxParticipants || 20,
        startDate: new Date(s.startDate),
        durationDays: parseInt(s.durationDays),
        workSaturday: s.workSaturday || false,
        workSunday: s.workSunday || false,
        status: 'PLANIFIEE'
      }))
    });
    
    res.status(201).json({ 
      success: true, 
      count: created.count,
      message: `${created.count} sessions créées` 
    });
  } catch (error) {
    logger.error('[FORMATION_BULK_CREATE_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la création en masse' });
  }
};

/**
 * GET /api/formations/stats - Statistiques des formations
 */
export const getStats = async (req, res) => {
  try {
    const [totalSessions, totalParticipants, byRegion, byModule, byStatus] = await Promise.all([
      prisma.formationSession.count(),
      prisma.formationParticipant.count(),
      prisma.formationSession.groupBy({
        by: ['region'],
        _count: { id: true }
      }),
      prisma.formationSession.groupBy({
        by: ['moduleId'],
        _count: { id: true }
      }),
      prisma.formationSession.groupBy({
        by: ['status'],
        _count: { id: true }
      })
    ]);
    
    // Enrichir les stats par module avec les noms
    const modules = await prisma.formationModule.findMany();
    const byModuleWithNames = byModule.map(m => ({
      moduleId: m.moduleId,
      moduleName: modules.find(mod => mod.id === m.moduleId)?.name || 'Inconnu',
      count: m._count.id
    }));
    
    res.json({
      totalSessions,
      totalParticipants,
      byRegion: byRegion.map(r => ({ region: r.region, count: r._count.id })),
      byModule: byModuleWithNames,
      byStatus: byStatus.map(s => ({ status: s.status, count: s._count.id }))
    });
  } catch (error) {
    logger.error('[FORMATION_GET_STATS_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
};

/**
 * Fonction utilitaire pour calculer la date de fin en tenant compte des jours travaillés
 */
function calculateEndDate(startDate, durationDays, workSaturday, workSunday) {
  const date = new Date(startDate);
  let daysAdded = 0;
  
  while (daysAdded < durationDays) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    
    // 0 = dimanche, 6 = samedi
    const isWorkingDay = (dayOfWeek !== 0) && (dayOfWeek !== 6 || (dayOfWeek === 6 && workSaturday));
    const isSunday = dayOfWeek === 0;
    
    if (!isSunday || (isSunday && workSunday)) {
      daysAdded++;
    }
  }
  
  return date;
}

export default {
  getModules,
  createModule,
  getSessions,
  createSession,
  updateSession,
  deleteSession,
  addParticipant,
  removeParticipant,
  toggleAttendance,
  getRegions,
  getPlanning,
  bulkCreateSessions,
  getStats
};