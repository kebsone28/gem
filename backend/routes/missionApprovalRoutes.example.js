/**
 * Mission Approval API Handlers - Backend Implementation Example
 * Frame: Express.js + Node.js
 * 
 * Endpoint implementations for mission approval workflow
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const auditLog = require('../services/auditLog');
const { authenticateToken, authorize } = require('../middleware/auth');

// ============================================
// GET /api/missions/:missionId/approval-history
// ============================================
/**
 * Récupère l'historique complet d'approbation d'une mission
 * 
 * @param missionId - ID de la mission
 * @returns MissionApprovalWorkflow avec toutes les étapes
 */
router.get('/:missionId/approval-history', authenticateToken, async (req, res) => {
  try {
    const { missionId } = req.params;

    // Vérification que la mission existe
    const mission = await db.query(
      'SELECT id, order_number FROM missions WHERE id = $1',
      [missionId]
    );

    if (mission.rows.length === 0) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    // Récupération du workflow d'approbation
    const workflowResult = await db.query(
      'SELECT * FROM mission_approvals WHERE mission_id = $1',
      [missionId]
    );

    if (workflowResult.rows.length === 0) {
      // Initialiser un nouveau workflow s'il n'existe pas
      const newWorkflow = await initializeApprovalWorkflow(missionId);
      return res.json(newWorkflow);
    }

    const workflow = workflowResult.rows[0];

    // Récupération de toutes les étapes
    const stepsResult = await db.query(
      'SELECT * FROM mission_approval_steps WHERE approval_id = $1 ORDER BY created_at ASC',
      [workflow.id]
    );

    const response = {
      missionId: workflow.mission_id,
      orderNumber: mission.rows[0].order_number,
      overallStatus: workflow.overall_status,
      steps: stepsResult.rows.map(step => ({
        role: step.role,
        status: step.status,
        approvedBy: step.approved_by,
        approvedAt: step.approved_at,
        comments: step.comments
      })),
      createdAt: workflow.created_at,
      updatedAt: workflow.updated_at
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching approval history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// POST /api/missions/:missionId/approve
// ============================================
/**
 * Approuve une étape du workflow
 * 
 * @body {
 *   role: 'CHEF_PROJET' | 'ADMIN' | 'DIRECTEUR',
 *   comments?: string,
 *   timestamp: ISO string
 * }
 */
router.post('/:missionId/approve', authenticateToken, async (req, res) => {
  try {
    const { missionId } = req.params;
    const { role, comments, timestamp } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validation
    if (!['CHEF_PROJET', 'ADMIN', 'DIRECTEUR'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Vérification des permissions
    if (!canApproveRole(userRole, role)) {
      return res.status(403).json({ error: 'Not authorized to approve this role' });
    }

    // Récupération du workflow
    const workflowResult = await db.query(
      'SELECT * FROM mission_approvals WHERE mission_id = $1',
      [missionId]
    );

    if (workflowResult.rows.length === 0) {
      const newWorkflow = await initializeApprovalWorkflow(missionId);
      // Relancer la requête
      return router.post(`/${missionId}/approve`)(req, res);
    }

    const workflow = workflowResult.rows[0];

    // Récupération de l'étape à approuver
    const stepResult = await db.query(
      'SELECT * FROM mission_approval_steps WHERE approval_id = $1 AND role = $2',
      [workflow.id, role]
    );

    if (stepResult.rows.length === 0) {
      return res.status(404).json({ error: 'Approval step not found' });
    }

    const step = stepResult.rows[0];

    // Vérification que l'étape est en attente
    if (step.status !== 'pending') {
      return res.status(400).json({ error: 'Step already processed' });
    }

    // Mise à jour de l'étape
    const User = require('../models/User');
    const user = await User.findById(userId);

    await db.query(
      `UPDATE mission_approval_steps 
       SET status = 'approved', approved_by = $1, approved_at = $2, comments = $3, updated_at = NOW()
       WHERE id = $4`,
      [user.name, new Date(timestamp), comments, step.id]
    );

    // Mise à jour du statut global du workflow
    await updateWorkflowStatus(workflow.id, missionId);

    // Log d'audit
    await auditLog.create({
      userId,
      action: 'MISSION_APPROVED',
      missionId,
      role,
      metadata: { comments }
    });

    // Email notification
    await notifyApprovalStateChange(missionId, role, 'approved');

    // Retourner le workflow mis à jour
    const updatedWorkflow = await getApprovalWorkflow(missionId);
    res.json(updatedWorkflow);
  } catch (error) {
    console.error('Error approving step:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// POST /api/missions/:missionId/reject
// ============================================
/**
 * Rejette une étape du workflow
 * 
 * @body {
 *   role: 'CHEF_PROJET' | 'ADMIN' | 'DIRECTEUR',
 *   reason: string,
 *   timestamp: ISO string
 * }
 */
router.post('/:missionId/reject', authenticateToken, async (req, res) => {
  try {
    const { missionId } = req.params;
    const { role, reason, timestamp } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validation
    if (!role || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Vérification des permissions
    if (!canRejectRole(userRole, role)) {
      return res.status(403).json({ error: 'Not authorized to reject this role' });
    }

    // Récupération du workflow
    const workflowResult = await db.query(
      'SELECT * FROM mission_approvals WHERE mission_id = $1',
      [missionId]
    );

    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const workflow = workflowResult.rows[0];

    // Récupération de l'étape
    const stepResult = await db.query(
      'SELECT * FROM mission_approval_steps WHERE approval_id = $1 AND role = $2',
      [workflow.id, role]
    );

    if (stepResult.rows.length === 0) {
      return res.status(404).json({ error: 'Approval step not found' });
    }

    const step = stepResult.rows[0];

    // Vérification que l'étape est en attente
    if (step.status !== 'pending') {
      return res.status(400).json({ error: 'Step already processed' });
    }

    // Mise à jour de l'étape
    const User = require('../models/User');
    const user = await User.findById(userId);

    await db.query(
      `UPDATE mission_approval_steps 
       SET status = 'rejected', approved_by = $1, approved_at = $2, comments = $3, updated_at = NOW()
       WHERE id = $4`,
      [user.name, new Date(timestamp), reason, step.id]
    );

    // Mise à jour du workflow à "rejected"
    await db.query(
      'UPDATE mission_approvals SET overall_status = $1, updated_at = NOW() WHERE id = $2',
      ['rejected', workflow.id]
    );

    // Log d'audit
    await auditLog.create({
      userId,
      action: 'MISSION_REJECTED',
      missionId,
      role,
      metadata: { reason }
    });

    // Email notification
    await notifyApprovalStateChange(missionId, role, 'rejected', reason);

    // Retourner le workflow mis à jour
    const updatedWorkflow = await getApprovalWorkflow(missionId);
    res.json(updatedWorkflow);
  } catch (error) {
    console.error('Error rejecting step:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Initialise un nouveau workflow d'approbation pour une mission
 */
async function initializeApprovalWorkflow(missionId) {
  const workflowId = generateUUID();
  
  // Créer le workflow
  await db.query(
    `INSERT INTO mission_approvals (id, mission_id, overall_status, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())`,
    [workflowId, missionId, 'pending']
  );

  // Créer les étapes (3 niveaux)
  const roles = ['CHEF_PROJET', 'ADMIN', 'DIRECTEUR'];
  for (const role of roles) {
    await db.query(
      `INSERT INTO mission_approval_steps (id, approval_id, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      [generateUUID(), workflowId, role, 'pending']
    );
  }

  return await getApprovalWorkflow(missionId);
}

/**
 * Récupère le workflow d'approbation complet
 */
async function getApprovalWorkflow(missionId) {
  const mission = await db.query('SELECT order_number FROM missions WHERE id = $1', [missionId]);
  const workflow = await db.query('SELECT * FROM mission_approvals WHERE mission_id = $1', [missionId]);
  const steps = await db.query(
    `SELECT * FROM mission_approval_steps 
     WHERE approval_id = $1 ORDER BY created_at ASC`,
    [workflow.rows[0].id]
  );

  return {
    missionId,
    orderNumber: mission.rows[0]?.order_number,
    overallStatus: workflow.rows[0]?.overall_status,
    steps: steps.rows.map(s => ({
      role: s.role,
      status: s.status,
      approvedBy: s.approved_by,
      approvedAt: s.approved_at,
      comments: s.comments
    })),
    createdAt: workflow.rows[0]?.created_at,
    updatedAt: workflow.rows[0]?.updated_at
  };
}

/**
 * Met à jour le statut global du workflow
 */
async function updateWorkflowStatus(workflowId, missionId) {
  const steps = await db.query(
    'SELECT status FROM mission_approval_steps WHERE approval_id = $1',
    [workflowId]
  );

  const allApproved = steps.rows.every(s => s.status === 'approved');
  const hasRejected = steps.rows.some(s => s.status === 'rejected');

  let newStatus;
  if (hasRejected) {
    newStatus = 'rejected';
  } else if (allApproved) {
    newStatus = 'approved';
  } else {
    newStatus = 'in_progress';
  }

  await db.query(
    'UPDATE mission_approvals SET overall_status = $1, updated_at = NOW() WHERE id = $2',
    [newStatus, workflowId]
  );
}

/**
 * Vérification des droits d'approbation
 */
function canApproveRole(userRole, targetRole) {
  const hierarchy = {
    'ADMIN': ['CHEF_PROJET', 'ADMIN', 'DIRECTEUR'],
    'DIRECTEUR': ['DIRECTEUR'],
    'CHEF_PROJET': ['CHEF_PROJET']
  };

  return hierarchy[userRole]?.includes(targetRole) ?? false;
}

/**
 * Vérification des droits de rejet
 */
function canRejectRole(userRole, targetRole) {
  return canApproveRole(userRole, targetRole);
}

/**
 * Envoie une notification email
 */
async function notifyApprovalStateChange(missionId, role, status, reason = null) {
  // Implémenter avec votre service d'email (SendGrid, AWS SES, etc)
  console.log(`Email: Mission ${missionId} - ${role} ${status}${reason ? ` (${reason})` : ''}`);
}

/**
 * Génère un UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

module.exports = router;
