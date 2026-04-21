import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';
import logger from '../../utils/logger.js';
import { missionNotificationService } from '../../services/notification.service.js';
import { sendMail } from '../../services/mail.service.js';
import { missionMentorService } from '../assistant/missionMentorService.js';
import crypto from 'crypto';
import { normalizeRole } from '../../core/utils/roles.js';

// ===============================================
// PUBLIC VERIFICATION (No Auth Required)
// ===============================================

/**
 * Publicly verify a mission by its order number or ID
 */
export const verifyMissionPublic = async (req, res) => {
    try {
        const { identifier } = req.params;

        const mission = await prisma.mission.findFirst({
            where: {
                OR: [
                    { orderNumber: identifier },
                    { id: identifier }
                ],
                deletedAt: null
            },
            include: {
                organization: {
                    select: { name: true, config: true }
                }
            }
        });

        if (!mission) {
            return res.status(404).json({ valid: false, message: 'Ordre de Mission introuvable.' });
        }

        const missionData = typeof mission.data === 'object' ? mission.data : {};

        // Prepare safe public response
        return res.json({
            valid: true,
            status: mission.status,
            orderNumber: mission.orderNumber,
            organization: mission.organization.name,
            title: mission.title,
            startDate: mission.startDate,
            endDate: mission.endDate,
            purpose: missionData.purpose,
            region: missionData.region,
            members: (missionData.members || []).map(m => ({
                name: m.name,
                role: m.role
            })),
            isCertified: mission.status === 'approuvee',
            verifiedAt: new Date()
        });
    } catch (error) {
        logger.error('Public verification error:', error);
        res.status(500).json({ error: 'Internal server error during verification' });
    }
};

/**
 * Endpoint to send a generated document via email
 * POST /api/missions/:missionId/email-document
 */
export const sendMissionDocumentEmail = async (req, res) => {
    try {
        const { missionId } = req.params;
        const { recipientEmail, subject, body } = req.body;
        const file = req.file; // Provided by multer middleware

        if (!file) {
            return res.status(400).json({ error: 'Fichier manquant' });
        }

        const mission = await prisma.mission.findUnique({
            where: { id: missionId },
            select: { orderNumber: true, title: true }
        });

        await sendMail({
            to: recipientEmail,
            subject: subject || `Ordre de Mission - ${mission?.orderNumber || mission?.title}`,
            title: 'Votre Ordre de Mission Officiel',
            body: body || `Veuillez trouver ci-joint votre ordre de mission officiel n° ${mission?.orderNumber}. <br/><br/>Ce document est certifié numériquement.`,
            attachments: [{
                filename: file.originalname || `Ordre_Mission_${mission?.orderNumber}.pdf`,
                content: file.buffer
            }]
        });

        res.json({ success: true, message: 'Email envoyé avec succès' });
    } catch (error) {
        logger.error('Send mission document error:', error);
        res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email' });
    }
};

/**
 * AI Analysis of a mission
 * POST /api/missions/:missionId/analyze-ia
 */
export const analyzeMissionIA = async (req, res) => {
    try {
        const { missionId } = req.params;
        const { organizationId } = req.user;

        const mission = await prisma.mission.findFirst({
            where: { id: missionId, organizationId }
        });

        if (!mission) {
            return res.status(404).json({ error: 'Mission introuvable' });
        }

        const result = await missionMentorService.analyzeMission(mission, req.user);
        res.json(result);
    } catch (error) {
        logger.error('Mission AI analysis endpoint error:', error);
        res.status(500).json({ error: "Erreur lors de l'analyse IA" });
    }
};

// ===============================================
// CORE CRUD
// ===============================================

/**
 * Get all missions for a project
 */
export const getMissions = async (req, res) => {
    try {
        const { projectId, search, status, limit = 50, offset = 0 } = req.query;
        const { organizationId, id: userId, role: rawUserRole } = req.user;

        const userRole = normalizeRole(rawUserRole);

        let whereClause = {
            organizationId,
            projectId: projectId || undefined,
            deletedAt: null
        };

        // FILTRE: Recherche par titre ou description
        if (search) {
            whereClause = {
                ...whereClause,
                OR: [
                    { title: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { orderNumber: { contains: search, mode: 'insensitive' } }
                ]
            };
        }

        // FILTRE: Statut
        if (status) {
            whereClause = { ...whereClause, status };
        }

        if (userRole === 'CHEF_PROJET') {
            // Chef de Projet : voit UNIQUEMENT ses propres missions
            whereClause = { ...whereClause, createdBy: userId };
        } else if (userRole === 'ADMIN_PROQUELEC') {
            // Admin : voit TOUT sans restriction
            // (pas de filtre supplémentaire)
        } else if (userRole === 'DIRECTEUR') {
            // Directeur : voit toutes les missions soumises + ses propres drafts
            whereClause = {
                ...whereClause,
                OR: [
                    { createdBy: userId },           // Ses propres missions (meme drafts)
                    { status: { not: 'draft' } }     // Toutes les missions soumises des autres
                ]
            };
        } else {
            // Autres rôles (COMPTABLE, SUPERVISEUR...) : les leurs + publiées
            whereClause = {
                ...whereClause,
                OR: [
                    { createdBy: userId },
                    { status: { not: 'draft' } }
                ]
            };
        }

        // PAGINATION + COMPTE TOTAL
        const [missions, total] = await Promise.all([
            prisma.mission.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                take: Math.min(parseInt(limit) || 50, 100),
                skip: parseInt(offset) || 0
            }),
            prisma.mission.count({ where: whereClause })
        ]);

        res.json({ 
            missions,
            pagination: {
                total,
                limit: Math.min(parseInt(limit) || 50, 100),
                offset: parseInt(offset) || 0,
                hasMore: (parseInt(offset) || 0) + missions.length < total
            }
        });
    } catch (error) {
        logger.error('Get missions error:', error);
        res.status(500).json({ error: 'Server error while fetching missions' });
    }
};

/**
 * Get mission statistics (KPI)
 * GET /api/missions/stats
 */
export const getMissionStats = async (req, res) => {
    try {
        const { organizationId } = req.user;
        const { projectId } = req.query;

        const whereClause = {
            organizationId,
            deletedAt: null,
            ...(projectId && { projectId })
        };

        // Compter par statut
        const statusCounts = await prisma.mission.groupBy({
            by: ['status'],
            where: whereClause,
            _count: true
        });

        // Calculer le budget total
        const budgetAggregation = await prisma.mission.aggregate({
            where: { ...whereClause, budget: { not: null } },
            _sum: { budget: true },
            _avg: { budget: true }
        });

        // Missions par mois (derniers 12 mois)
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const monthlyMissions = await prisma.mission.findMany({
            where: {
                ...whereClause,
                createdAt: { gte: twelveMonthsAgo }
            },
            select: {
                createdAt: true,
                status: true
            }
        });

        // Grouper par mois
        const monthlyStats = {};
        monthlyMissions.forEach(m => {
            const monthKey = m.createdAt.toISOString().slice(0, 7); // YYYY-MM
            if (!monthlyStats[monthKey]) {
                monthlyStats[monthKey] = { total: 0, approved: 0, draft: 0 };
            }
            monthlyStats[monthKey].total++;
            if (m.status === 'approuvee') monthlyStats[monthKey].approved++;
            if (m.status === 'draft') monthlyStats[monthKey].draft++;
        });

        // Transformer en tableau trié
        const monthlyTrend = Object.entries(monthlyStats)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, data]) => ({ month, ...data }));

        // Construire la réponse
        const stats = {
            total: statusCounts.reduce((sum, s) => sum + s._count, 0),
            byStatus: statusCounts.reduce((acc, s) => {
                acc[s.status] = s._count;
                return acc;
            }, {}),
            budget: {
                total: budgetAggregation._sum.budget || 0,
                average: budgetAggregation._avg.budget || 0
            },
            monthlyTrend
        };

        res.json(stats);
    } catch (error) {
        logger.error('Get mission stats error:', error);
        res.status(500).json({ error: 'Server error while fetching mission statistics' });
    }
};

const safeDate = (d) => {
    if (!d) return null;
    const date = new Date(d);
    return isNaN(date.getTime()) ? null : date;
};

/**
 * Validate mission dates
 */
const validateMissionDates = (startDate, endDate) => {
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) {
            return 'La date de début doit être antérieure à la date de fin';
        }
    }
    return null;
};

/**
 * Validate mission budget
 */
const validateMissionBudget = (budget) => {
    if (budget !== undefined && budget !== null) {
        const numBudget = parseFloat(budget);
        if (isNaN(numBudget)) {
            return 'Le budget doit être un nombre valide';
        }
        if (numBudget < 0) {
            return 'Le budget ne peut pas être négatif';
        }
    }
    return null;
};

/**
 * Create a new mission
 */
export const createMission = async (req, res) => {
    try {
        let { projectId, title, description, startDate, endDate, budget, data } = req.body;
        const { organizationId, id: userId } = req.user;

        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID is missing from user context' });
        }

        // VALIDATION: Dates
        const dateError = validateMissionDates(startDate, endDate);
        if (dateError) {
            return res.status(400).json({ error: dateError });
        }

        // VALIDATION: Budget
        const budgetError = validateMissionBudget(budget);
        if (budgetError) {
            return res.status(400).json({ error: budgetError });
        }

        // VALIDATION GÉOMÉTRIQUE & TENANTE DU PROJET
        let safeProjectId = null;
        if (projectId && typeof projectId === 'string' && projectId.length > 10) {
            try {
                // On cherche le projet dans la même org
                const project = await prisma.project.findFirst({
                    where: {
                        id: projectId,
                        organizationId
                    }
                });

                if (project) {
                    safeProjectId = project.id;
                } else {
                    console.warn(`⚠️ [MISSION] Project ID ${projectId} not found or belongs to another org. Setting to NULL.`);
                }
            } catch (pErr) {
                console.error(`❌ [MISSION] Error validating Project ID:`, pErr);
            }
        }

        const mission = await prisma.mission.create({
            data: {
                projectId: safeProjectId,
                organizationId,
                title: title || 'Nouvelle Mission',
                description: description || '',
                startDate: safeDate(startDate),
                endDate: safeDate(endDate),
                budget: budget ? parseFloat(budget) : 0,
                data: data || {},
                createdBy: userId,
                status: 'draft'
            }
        });

        res.json(mission);
    } catch (error) {
        logger.error('Create mission error:', error);
        res.status(500).json({
            error: 'Server error while creating mission',
            message: error.message,
            code: error.code
        });
    }
};

/**
 * Update an existing mission
 */
export const updateMission = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, startDate, endDate, budget, status, data } = req.body;
        const { organizationId, id: userId, role: rawUserRole } = req.user;
        const userRole = rawUserRole?.toUpperCase();

        // Find mission first to verify ownership
        const missionBefore = await prisma.mission.findFirst({
            where: { id, organizationId, deletedAt: null }
        });
        if (!missionBefore) return res.status(404).json({ error: 'Mission not found' });

        // --- PROTECTION: Double Certification ---
        if (missionBefore.status === 'approuvee') {
            return res.status(400).json({ error: 'La mission est déjà certifiée et verrouillée.' });
        }

        // --- PROTECTION: Role DG check ---
        if (status === 'approuvee' && !['DG_PROQUELEC', 'DIRECTEUR', 'ADMIN', 'ADMIN_PROQUELEC'].includes(userRole)) {
            return res.status(403).json({ error: 'Seule la Direction Générale peut certifier une mission.' });
        }

        // VALIDATION: Dates
        const dateError = validateMissionDates(startDate, endDate);
        if (dateError) {
            return res.status(400).json({ error: dateError });
        }

        // VALIDATION: Budget
        const budgetError = validateMissionBudget(budget);
        if (budgetError) {
            return res.status(400).json({ error: budgetError });
        }

        const missionResult = await prisma.$transaction(async (tx) => {
            let finalOrderNumber = missionBefore.orderNumber;

            // --- NUMÉRO UNIQUE (ATOMIQUE): Generation inside transaction ---
            if (status === 'approuvee' && missionBefore.status !== 'approuvee') {
                if (!finalOrderNumber) {
                    const year = new Date().getFullYear();
                    const lastMission = await tx.mission.findFirst({
                        where: {
                            organizationId,
                            orderNumber: { startsWith: `MISSION-${year}-` }
                        },
                        orderBy: { orderNumber: 'desc' }
                    });

                    let sequence = 1;
                    if (lastMission?.orderNumber) {
                        const match = lastMission.orderNumber.match(/MISSION-\d+-(\d+)/);
                        if (match) {
                            sequence = parseInt(match[1]) + 1;
                        }
                    }

                    finalOrderNumber = `MISSION-${year}-${String(sequence).padStart(5, '0')}`;
                }
                logger.info(`✨ Mission ${id} certifiée par le DG. Numéro généré: ${finalOrderNumber}`);
            }

            const updatedMission = await tx.mission.update({
                where: { id },
                data: {
                    ...(title !== undefined && { title }),
                    ...(description !== undefined && { description }),
                    ...(startDate !== undefined && { startDate: safeDate(startDate) }),
                    ...(endDate !== undefined && { endDate: safeDate(endDate) }),
                    ...(budget !== undefined && { budget }),
                    ...(status !== undefined && { status }),
                    ...(data !== undefined && { data }),
                    ...(finalOrderNumber && { orderNumber: finalOrderNumber })
                }
            });

            return { updatedMission, finalOrderNumber };
        });

        const mission = missionResult.updatedMission;
        const finalOrderNumber = missionResult.finalOrderNumber;

        // WORKFLOW AUTO-GENERATION: Simplified DG logic
        if (status === 'soumise' || status === 'en_attente_validation') {
            const existingWF = await prisma.missionApprovalWorkflow.findUnique({
                where: { missionId: id }
            });
            if (!existingWF) {
                logger.info(`✨ [WORKFLOW] Auto-creating workflow for submitted mission: ${id}`);
                await createDefaultWorkflow(id, organizationId);
            }
            await tracerAction(organizationId, userId, 'MISSION_SUBMITTED', 'Mission', id, { title, status });

            // EMAIL NOTIFICATION: Alert full chain when a mission is submitted
            try {
                const stakeholders = await prisma.user.findMany({
                    where: { organizationId, role: { in: ['DG_PROQUELEC', 'DIRECTEUR', 'ADMIN_PROQUELEC', 'COMPTABLE'] } },
                    select: { email: true }
                });
                const emails = [...new Set(stakeholders.map(u => u.email).filter(Boolean))];
                for (const email of emails) {
                    missionNotificationService.notifySubmission(mission, email)
                        .catch(err => logger.error('[NOTIF] Stakeholder notification failed:', err));
                }
            } catch (notifErr) {
                logger.error('[NOTIF] Stakeholder lookup failed (non-blocking):', notifErr);
            }
        } else if (status === 'approuvee' && missionBefore.status !== 'approuvee') {
            // THE CERTIFIABLE AUDIT LOG (PROQUELEC)
            await tracerAction(organizationId, userId, 'MISSION_CERTIFIED_DG', 'Mission', id, {
                title,
                status,
                orderNumber: finalOrderNumber,
                certifierId: userId,
                timestamp: new Date().toISOString()
            });

            // Also update the workflow if it exists
            await prisma.missionApprovalWorkflow.updateMany({
                where: { missionId: id },
                data: { overallStatus: 'approved', currentStep: 99, orderNumber: finalOrderNumber, orderNumberGeneratedAt: new Date() }
            });

            // EMAIL: Notify initiator their mission is certified
            if (missionBefore.createdBy) {
                prisma.user.findUnique({ where: { id: missionBefore.createdBy }, select: { email: true } })
                    .then(initiator => {
                        if (initiator?.email) {
                            missionNotificationService.notifyDGCertified(missionBefore, finalOrderNumber, initiator.email)
                                .catch(err => logger.error('[NOTIF] Certified notification failed:', err));
                        }
                    })
                    .catch(err => logger.error('[NOTIF] Initiator lookup failed:', err));
            }
        } else {
            await tracerAction(organizationId, userId, 'MISSION_UPDATE', 'Mission', id, { title, status });
        }

        res.json(mission);
    } catch (error) {
        logger.error('Update mission error:', error);
        res.status(500).json({ error: 'Server error while updating mission' });
    }
};


export const deleteMission = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId, id: userId } = req.user;

        await prisma.mission.updateMany({
            where: { id, organizationId },
            data: { deletedAt: new Date() }
        });

        await tracerAction(organizationId, userId, 'MISSION_DELETE', 'Mission', id);
        res.json({ message: 'Mission deleted successfully' });
    } catch (error) {
        logger.error('Delete mission error:', error);
        res.status(500).json({ error: 'Server error while deleting mission' });
    }
};

/**
 * Duplicate an existing mission
 */
export const duplicateMission = async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId, id: userId } = req.user;

        const original = await prisma.mission.findFirst({
            where: { id, organizationId }
        });

        if (!original) return res.status(404).json({ error: 'Mission original not found' });

        const copy = await prisma.mission.create({
            data: {
                projectId: original.projectId,
                organizationId,
                title: `${original.title} (Copie)`,
                description: original.description,
                startDate: original.startDate,
                endDate: original.endDate,
                budget: original.budget,
                data: original.data,
                status: 'draft',
                createdBy: userId
            }
        });

        await tracerAction(organizationId, userId, 'MISSION_DUPLICATE', 'Mission', id, { newId: copy.id });
        res.json(copy);
    } catch (error) {
        logger.error('Duplicate mission error:', error);
        res.status(500).json({ error: 'Server error while duplicating mission' });
    }
};

// ===============================================
// WORKFLOW ROLES & SEQUENCE
// ===============================================
const WORKFLOW_ROLES = {
    DIRECTEUR: { sequence: 1, label: 'Direction Générale' },
    ADMIN: { sequence: 99, label: 'Administrateur' },
    ADMIN_PROQUELEC: { sequence: 99, label: 'Administrateur (Super-Pouvoir)' }
};

/**
 * Generate unique order number after DG approval
 * Format: MISSION-YYYY-XXXXX
 */
async function generateOrderNumber(organizationId) {
    const year = new Date().getFullYear();
    const lastMission = await prisma.mission.findFirst({
        where: {
            organizationId,
            orderNumber: {
                startsWith: `MISSION-${year}-`
            }
        },
        orderBy: { orderNumber: 'desc' }
    });

    let sequence = 1;
    if (lastMission?.orderNumber) {
        const match = lastMission.orderNumber.match(/MISSION-\d+-(\d+)/);
        if (match) {
            sequence = parseInt(match[1]) + 1;
        }
    }

    return `MISSION-${year}-${String(sequence).padStart(5, '0')}`;
}

/**
 * Récupère la configuration du workflow d'une organisation
 */
async function _getWorkflowConfig(organizationId) {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { config: true }
    });

    if (org?.config?.workflow?.missionSteps) {
        return org.config.workflow.missionSteps;
    }

    // Workflow simplifié: Direction seulement
    return [
        { role: 'DIRECTEUR', sequence: 1, label: 'Directeur Général' }
    ];
}

/**
 * Create default approval workflow based on organization config
 */
async function createDefaultWorkflow(missionId, organizationId) {
    const stepsConfig = await _getWorkflowConfig(organizationId);

    return await prisma.missionApprovalWorkflow.create({
        data: {
            missionId,
            overallStatus: 'pending',
            currentStep: 1,
            approvalSteps: {
                create: stepsConfig.map(s => ({
                    role: s.role,
                    label: s.label,
                    sequence: s.sequence,
                    status: 'EN_ATTENTE'
                }))
            }
        },
        include: {
            approvalSteps: {
                orderBy: { sequence: 'asc' }
            }
        }
    });
}

/**
 * Get mission approval history and current status
 * @route GET /api/missions/:missionId/approval-history
 */
export const getMissionApprovalHistory = async (req, res) => {
    try {
        const { missionId } = req.params;
        const { organizationId } = req.user;

        // Verify mission exists and belongs to org
        const mission = await prisma.mission.findFirst({
            where: {
                id: missionId,
                organizationId
            },
            include: {
                approvalWorkflow: {
                    include: {
                        approvalSteps: {
                            orderBy: { sequence: 'asc' }
                        }
                    }
                }
            }
        });

        if (!mission) {
            return res.status(404).json({ error: 'Mission not found' });
        }

        // If no workflow exists yet, create one ONLY if mission is NOT a draft
        let workflow = mission.approvalWorkflow;
        if (!workflow && mission.status !== 'draft') {
            workflow = await createDefaultWorkflow(mission.id, organizationId);
        }

        if (!workflow) {
            return res.json({
                missionId: mission.id,
                title: mission.title,
                status: mission.status,
                overallStatus: 'draft',
                steps: []
            });
        }

        return res.json({
            missionId: mission.id,
            title: mission.title,
            orderNumber: mission.orderNumber,
            status: mission.status,
            overallStatus: workflow.overallStatus,
            currentStep: workflow.currentStep,
            steps: workflow.approvalSteps.map(step => ({
                role: step.role,
                label: WORKFLOW_ROLES[step.role]?.label,
                sequence: step.sequence,
                status: step.status,
                approvedBy: step.decidedBy,
                approvedAt: step.decidedAt,
                comment: step.comment
            })),
            orderNumberGeneratedAt: workflow.orderNumberGeneratedAt,
            orderNumberGeneratedBy: workflow.orderNumberGeneratedBy,
            createdAt: workflow.createdAt,
            updatedAt: workflow.updatedAt
        });

    } catch (error) {
        logger.error('Get mission approval history error:', error);
        res.status(500).json({ error: 'Server error while fetching approval history' });
    }
};

/**
 * Approve a mission step in the workflow
 * Workflow: CHEF_PROJET → COMPTABLE → DIRECTEUR
 * After DIRECTEUR approves → auto-generate orderNumber
 * ADMIN can approve all steps at once (super-power)
 * 
 * @route POST /api/missions/:missionId/approve
 */
export const approveMissionStep = async (req, res) => {
    try {
        const { missionId } = req.params;
        const { role, comment } = req.body;
        const { organizationId, id: userId, role: rawUserRole } = req.user;
        const userRole = rawUserRole?.toUpperCase();

        if (!role) {
            return res.status(400).json({ error: 'Role is required' });
        }

        // Verify mission exists
        const mission = await prisma.mission.findFirst({
            where: { id: missionId, organizationId },
            include: {
                approvalWorkflow: {
                    include: {
                        approvalSteps: { orderBy: { sequence: 'asc' } }
                    }
                }
            }
        });

        if (!mission) {
            return res.status(404).json({ error: 'Mission not found' });
        }

        // Create workflow if doesn't exist
        let workflow = mission.approvalWorkflow;
        if (!workflow) {
            workflow = await createDefaultWorkflow(missionId, organizationId);
        }

        // Normalize role
        const normalizedRole = (role || '').toString().toUpperCase();

        if (workflow.overallStatus === 'rejected') {
            return res.status(400).json({ error: 'Cannot approve a rejected mission' });
        }

        if (workflow.overallStatus === 'approved') {
            return res.status(400).json({ error: 'Mission is already approved' });
        }

        // ==============================================
        // ADMIN OR DIRECTOR (SELF-CREATED) SUPER-POWER
        // ==============================================
        const isSelfCreatedDirector = (userRole === 'DIRECTEUR' || userRole === 'DG_PROQUELEC') && mission.createdBy === userId;
        const isAdmin = userRole === 'ADMIN_PROQUELEC' || userRole === 'ADMIN';

        if ((isAdmin && (normalizedRole === 'ADMIN' || normalizedRole === 'ADMIN_PROQUELEC')) || isSelfCreatedDirector) {
            const updatedSteps = await Promise.all(
                workflow.approvalSteps.map(step =>
                    prisma.missionApprovalStep.update({
                        where: { id: step.id },
                        data: {
                            status: 'APPROUVE',
                            decidedBy: userId,
                            decidedAt: new Date(),
                            comment: comment || (isAdmin ? `Admin approval` : `Auto-validation par le Directeur (Créateur)`),
                            signature: req.body.signature || null
                        }
                    })
                )
            );

            // Fetch current mission data to merge signature
            const currentMission = await prisma.mission.findUnique({ where: { id: missionId }, select: { data: true } });
            const missionData = typeof currentMission?.data === 'object' ? currentMission.data : {};

            // Generate orderNumber after all approvals
            const orderNumber = await generateOrderNumber(organizationId);

            const updatedWorkflow = await prisma.missionApprovalWorkflow.update({
                where: { id: workflow.id },
                data: {
                    overallStatus: 'approved',
                    currentStep: 99,
                    orderNumber,
                    orderNumberGeneratedAt: new Date(),
                    orderNumberGeneratedBy: userId,
                    integrityHash: crypto.createHash('sha256').update(JSON.stringify({ missionId, orderNumber, timestamp: new Date() })).digest('hex')
                },
                include: {
                    approvalSteps: { orderBy: { sequence: 'asc' } }
                }
            });

            // Update mission status and orderNumber + SIGNATURE
            await prisma.mission.update({
                where: { id: missionId },
                data: {
                    status: 'approuvee',
                    orderNumber,
                    data: {
                        ...missionData,
                        signatureImage: req.body.signature || missionData?.signatureImage
                    }
                }
            });

            await tracerAction(organizationId, userId, 'MISSION_ADMIN_APPROVED', 'Mission', missionId, {
                orderNumber,
                comment
            });

            // Email Notification: Full Approval (Admin Override)
            missionNotificationService.notifyFullApproval(mission, orderNumber, mission.createdBy)
                .catch(err => logger.error('Admin approval notification failed:', err));

            return res.json({
                success: true,
                message: 'Mission approved by admin (all steps), orderNumber generated',
                missionId,
                orderNumber,
                integrityHash: updatedWorkflow.integrityHash,
                steps: updatedWorkflow.approvalSteps.map(s => ({
                    role: s.role,
                    status: s.status,
                    decidedBy: s.decidedBy,
                    decidedAt: s.decidedAt,
                    comment: s.comment
                }))
            });
        }

        // ==============================================
        // NORMAL WORKFLOW: Step-by-step approval
        // ==============================================
        const step = workflow.approvalSteps.find(s => s.role === normalizedRole);
        if (!step) {
            return res.status(400).json({ error: `No approval step found for role: ${normalizedRole}` });
        }

        // Authorization check: only user role owner or admin can approve
        const canApproveThisRole = userRole === normalizedRole || (normalizedRole === 'DIRECTEUR' && userRole === 'DG_PROQUELEC');
        if (!isAdmin && !canApproveThisRole) {
            return res.status(403).json({ error: 'Not authorized to approve this step' });
        }

        // Robustness: Separation of duties (Creator cannot approve step 2 or 3 of their own mission)
        // Except for step 1 (initiation) which is usually done by the creator
        if (!isAdmin && mission.createdBy === userId && step.sequence > 1) {
            return res.status(403).json({ error: 'Sécurité : Vous ne pouvez pas approuver les étapes supérieures d\'une mission que vous avez créée.' });
        }

        // Ensure correct sequence (no skipping), except admin overrule path handled earlier
        if (workflow.currentStep !== step.sequence && !isAdmin) {
            return res.status(400).json({ error: 'Approval step is not current step' });
        }

        if (step.status !== 'EN_ATTENTE') {
            return res.status(400).json({ error: 'This step has already been processed' });
        }

        // Transaction for atomic update
        const result = await prisma.$transaction(async (tx) => {
            // 1. Update this step
            await tx.missionApprovalStep.update({
                where: { id: step.id },
                data: {
                    status: 'APPROUVE',
                    decidedBy: userId,
                    decidedAt: new Date(),
                    comment: comment || null,
                    signature: req.body.signature || null
                }
            });

            // 2. Determine next step
            const allSteps = workflow.approvalSteps;
            const currentStepIndex = allSteps.findIndex(s => s.role === normalizedRole);
            const nextStep = allSteps[currentStepIndex + 1];
            let newCurrentStep = workflow.currentStep;
            let newOverallStatus = 'pending';
            let orderNumber = mission.orderNumber;

            if (nextStep) {
                newCurrentStep = nextStep.sequence;
                if (mission.status === 'draft') {
                    await tx.mission.update({
                        where: { id: missionId },
                        data: { status: 'en_attente_validation' }
                    });
                }
                
                // NOTIFICATION: Inform next role in chain
                missionNotificationService.notifyNextStep(mission, nextStep.role, organizationId)
                    .catch(err => logger.error('[WF-NOTIF] Could not notify next step:', err));

            } else {
                orderNumber = await generateOrderNumber(organizationId);
                newOverallStatus = 'approved';
                newCurrentStep = step.sequence;

                // Merge signature into mission data
                const missionData = typeof mission.data === 'object' ? mission.data : {};
                const updatedMission = await tx.mission.update({
                    where: { id: missionId },
                    data: {
                        status: 'approuvee',
                        orderNumber,
                        data: {
                            ...missionData,
                            signatureImage: req.body.signature || missionData?.signatureImage
                        }
                    }
                });

                // FINAL NOTIFICATION: Notify Initiator (+ Audit/Financials)
                const initiatorId = mission.createdBy;
                const initiator = await tx.user.findUnique({ where: { id: initiatorId } });
                if (initiator?.email) {
                    missionNotificationService.notifyFullApproval(updatedMission, orderNumber, initiatorId)
                        .catch(err => logger.error('[WF-NOTIF] Full approval notification failed:', err));
                }
            }

            // 3. Update workflow
            const updatedWF = await tx.missionApprovalWorkflow.update({
                where: { id: workflow.id },
                data: {
                    currentStep: newCurrentStep,
                    overallStatus: newOverallStatus,
                    ...(!nextStep && {
                        orderNumber,
                        orderNumberGeneratedAt: new Date(),
                        orderNumberGeneratedBy: userId,
                        integrityHash: crypto.createHash('sha256').update(JSON.stringify({ missionId, orderNumber, timestamp: new Date() })).digest('hex')
                    })
                },
                include: {
                    approvalSteps: { orderBy: { sequence: 'asc' } }
                }
            });

            return { updatedWF, orderNumber, nextStep };
        });

        await tracerAction(organizationId, userId, 'MISSION_APPROVED_STEP', 'Mission', missionId, {
            role,
            orderNumber: result.orderNumber,
            comment
        });

        // ==============================================
        // ASYNC EMAIL NOTIFICATIONS (Normal Workflow)
        // ==============================================
        if (result.nextStep) {
            missionNotificationService.notifyNextStep(mission, result.nextStep.role, organizationId)
                .catch(err => logger.error('Next step notification failed:', err));
        } else {
            missionNotificationService.notifyFullApproval(mission, result.orderNumber, mission.createdBy)
                .catch(err => logger.error('Creator approval notification failed:', err));
        }

        res.json({
            success: true,
            missionId,
            title: mission.title,
            orderNumber: result.orderNumber,
            overallStatus: result.updatedWF.overallStatus,
            currentStep: result.updatedWF.currentStep,
            integrityHash: result.updatedWF.integrityHash,
            nextRole: result.nextStep?.role || 'NONE',
            steps: result.updatedWF.approvalSteps.map(s => ({
                role: s.role,
                status: s.status,
                approvedBy: s.decidedBy,
                approvedAt: s.decidedAt,
                comments: s.comment
            }))
        });

    } catch (error) {
        logger.error('Approve mission step error:', error);
        res.status(500).json({ error: 'Server error while approving mission' });
    }
};

/**
 * Reject a mission in workflow
 * @route POST /api/missions/:missionId/reject
 */
export const rejectMissionStep = async (req, res) => {
    try {
        const { missionId } = req.params;
        const { role, reason } = req.body;
        const { organizationId, id: userId } = req.user;

        if (!role || !reason) {
            return res.status(400).json({ error: 'Role and reason are required' });
        }

        const mission = await prisma.mission.findFirst({
            where: { id: missionId, organizationId },
            include: {
                approvalWorkflow: {
                    include: {
                        approvalSteps: { orderBy: { sequence: 'asc' } }
                    }
                }
            }
        });

        if (!mission) {
            return res.status(404).json({ error: 'Mission not found' });
        }

        let workflow = mission.approvalWorkflow;
        if (!workflow) {
            workflow = await createDefaultWorkflow(missionId, organizationId);
        }

        // Déterminer l'étape cible
        const normalizedRole = (role || '').toString().toUpperCase();
        const isAdmin = req.user.role === 'ADMIN_PROQUELEC' || req.user.role === 'ADMIN';

        let step = workflow.approvalSteps.find(s => s.role === normalizedRole);

        // Si c'est un ADMIN qui rejette globalement
        if (!step && isAdmin) {
            // On rejette l'étape courante
            step = workflow.approvalSteps.find(s => s.sequence === workflow.currentStep);
        }

        if (!step) {
            return res.status(400).json({ error: `No approval step found for role: ${role}` });
        }

        // Transaction for atomic rejection
        const result = await prisma.$transaction(async (tx) => {
            // 1. Update step to REJETE
            await tx.missionApprovalStep.update({
                where: { id: step.id },
                data: {
                    status: 'REJETE',
                    decidedBy: userId,
                    decidedAt: new Date(),
                    comment: reason
                }
            });

            // 2. Update workflow to rejected
            const updatedWF = await tx.missionApprovalWorkflow.update({
                where: { id: workflow.id },
                data: { overallStatus: 'rejected' },
                include: {
                    approvalSteps: { orderBy: { sequence: 'asc' } }
                }
            });

            // 3. Update mission status
            await tx.mission.update({
                where: { id: missionId },
                data: { status: 'rejetee' }
            });

            return updatedWF;
        });

        await tracerAction(organizationId, userId, 'MISSION_REJECTED', 'Mission', missionId, {
            role,
            reason
        });

        // Email Notification: Rejection
        missionNotificationService.notifyRejection(mission, role, reason, mission.createdBy)
            .catch(err => logger.error('Rejection notification failed:', err));

        res.json({
            success: true,
            missionId,
            overallStatus: 'rejected',
            rejectedByRole: role,
            rejectionReason: reason,
            steps: result.approvalSteps.map(s => ({
                role: s.role,
                status: s.status,
                decidedBy: s.decidedBy,
                decidedAt: s.decidedAt,
                comment: s.comment
            }))
        });

    } catch (error) {
        logger.error('Reject mission error:', error);
        res.status(500).json({ error: 'Server error while rejecting mission' });
    }
};

/**
 * Admin override: Change the generated orderNumber
 * @route POST /api/missions/:missionId/override-order-number
 */
export const overrideOrderNumber = async (req, res) => {
    try {
        const { missionId } = req.params;
        const { newOrderNumber } = req.body;
        const { organizationId, id: userId, role: userRole } = req.user;

        if (userRole !== 'ADMIN' && userRole !== 'ADMIN_PROQUELEC') {
            return res.status(403).json({ error: 'Only admins can override order number' });
        }

        if (!newOrderNumber) {
            return res.status(400).json({ error: 'newOrderNumber is required' });
        }

        const mission = await prisma.mission.findFirst({
            where: { id: missionId, organizationId }
        });

        if (!mission) {
            return res.status(404).json({ error: 'Mission not found' });
        }

        if (!mission.orderNumber) {
            return res.status(400).json({ error: 'Mission has not been approved yet, cannot override orderNumber' });
        }

        // Update mission orderNumber
        const updatedMission = await prisma.mission.update({
            where: { id: missionId },
            data: { orderNumber: newOrderNumber }
        });

        // Track the override in workflow
        await prisma.missionApprovalWorkflow.update({
            where: { missionId },
            data: {
                orderNumberOverridenAt: new Date(),
                orderNumberOverridenBy: userId
            }
        });

        await tracerAction(organizationId, userId, 'MISSION_ORDER_NUMBER_OVERRIDE', 'Mission', missionId, {
            oldOrderNumber: mission.orderNumber,
            newOrderNumber
        });

        res.json({
            success: true,
            missionId,
            orderNumber: updatedMission.orderNumber,
            message: 'Order number updated by admin'
        });

    } catch (error) {
        logger.error('Override order number error:', error);
        res.status(500).json({ error: 'Server error while overriding order number' });
    }
};

/**
 * Get all missions awaiting approval for the current user's role
 * @route GET /api/missions/approvals/pending
 */
export const getPendingApprovals = async (req, res) => {
    try {
        const { organizationId, role: userRole, id: userId } = req.user;
        const isAdmin = userRole === 'ADMIN_PROQUELEC' || userRole === 'ADMIN';

        // Mapping roles from Auth to Workflow
        const roleMapping = {
            'DG_PROQUELEC': 'DIRECTEUR',
            'DG': 'DIRECTEUR',
            'DIRECTION': 'DIRECTEUR',
            'DIRECTEUR_GENERAL': 'DIRECTEUR',
            'DIR_GEN': 'DIRECTEUR',
            'ADMIN_PROQUELEC': 'ADMIN'
        };
        const workflowRole = roleMapping[userRole] || userRole;

        const { status: queryStatus } = req.query;
        const isArchiveQuery = queryStatus === 'approuvee';

        // Base query: missions in this organization
        const missions = await prisma.mission.findMany({
            where: {
                organizationId,
                deletedAt: null,
                status: isArchiveQuery ? 'approuvee' : { not: 'draft' },
                ...(isArchiveQuery ? {} : {
                    OR: [
                        { status: 'soumise' },
                        { status: 'en_attente_validation', approvalWorkflow: { isNot: null } },
                        {
                            approvalWorkflow: {
                                approvalSteps: {
                                    some: {
                                        status: 'EN_ATTENTE'
                                    }
                                }
                            }
                        }
                    ],
                    NOT: {
                        status: 'approuvee'
                    }
                })
            },
            include: {
                approvalWorkflow: {
                    include: {
                        approvalSteps: {
                            orderBy: { sequence: 'asc' }
                        }
                    }
                },
                project: {
                    select: { name: true }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        // 🟢 FIX : Récupération MANUELLE des noms d'auteurs (évite de modifier le schéma Prisma Client en plein dev)
        const authorIds = [...new Set(missions.map(m => m.createdBy).filter(Boolean))];
        const authors = await prisma.user.findMany({
            where: { id: { in: authorIds } },
            select: { id: true, name: true, roleLegacy: true }
        });

        // Attacher les auteurs aux missions
        const missionsWithAuthors = missions.map(m => ({
            ...m,
            user: authors.find(u => u.id === m.createdBy) || null
        }));

        // Post-filtering logic for non-admin roles
        const filtered = missionsWithAuthors.filter(m => {
            // 1. Admins and Directors see everything in 'soumise' or 'en_attente_validation'
            if (isAdmin || userRole === 'DG_PROQUELEC') return true;

            // 2. Technical workflow check for others
            const workflow = m.approvalWorkflow;
            if (!workflow) return false; // Non-admins only see missions that have actually entered the workflow

            const step = workflow.approvalSteps.find(s => s.role === workflowRole);
            return step && step.sequence === workflow.currentStep && step.status === 'EN_ATTENTE';
        });

        // --- AGGREGATE STATS (Consumed Budget) ---
        const costAgg = await prisma.mission.aggregate({
            where: {
                organizationId,
                status: 'approuvee',
                deletedAt: null
            },
            _sum: {
                budget: true
            }
        });

        const totalBudgetCertified = Number(costAgg._sum.budget || 0);

        res.json({ 
            missions: filtered,
            stats: {
                totalBudgetCertified
            }
        });
    } catch (error) {
        logger.error('Get pending approvals error:', error);
        res.status(500).json({ error: 'Server error while fetching pending approvals' });
    }
};
