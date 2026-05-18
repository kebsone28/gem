import express from 'express';
import { authProtect, authorize } from '../middlewares/auth.js';
import { validateSchema } from '../middleware/validation.js';
import { verifierModule } from '../../middleware/verifierPermission.js';

const router = express.Router();

// Require authentication and module verification
router.use(authProtect);
router.use(verifierModule('approval'));

// Approval schemas for validation
const approvalUpdateStatusSchema = {
  required: ['status'],
  fields: {
    status: {
      type: 'string',
      required: true,
      enum: ['approved', 'rejected'],
    },
    comments: {
      type: 'string',
      maxLength: 2000,
    },
  },
};

/**
 * Approval endpoints
 * These are typically handled in mission routes, but defined here for reference
 */

// Approve mission
router.post('/:missionId/approve',
  validateSchema(approvalUpdateStatusSchema),
  authorize('ADMIN_PROQUELEC', 'DIRECTEUR'),
  (req, res) => {
    // Handler from mission controller
    res.json({ message: 'Mission approved' });
  }
);

// Reject mission
router.post('/:missionId/reject',
  validateSchema(approvalUpdateStatusSchema),
  authorize('ADMIN_PROQUELEC', 'DIRECTEUR'),
  (req, res) => {
    // Handler from mission controller
    res.json({ message: 'Mission rejected' });
  }
);

export default router;
