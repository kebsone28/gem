import express from 'express';
import rateLimit from 'express-rate-limit';
import { authProtect } from '../../api/middlewares/auth.js';
import { authorize } from '../../api/middlewares/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  listUsers,
  setPhone,
  toggleActivation,
  createGedcollectUser,
  deleteGedcollectUser,
  getGedcollectStats,
  listGedcollectSubmissions,
  listAssignments,
  createAssignment,
  deleteAssignment,
  listForms,
  exportGedcollectSubmissions,
} from './gedcollect.admin.controller.js';
import {
  createAssignmentSchema,
  deleteAssignmentSchema,
  createGedcollectUserSchema,
  updateGedcollectUserSchema,
  listSubmissionsSchema,
  listFormsSchema,
} from './gedcollect.validation.js';

const router = express.Router();

// Rate limiter pour les endpoints admin (plus permissif mais protégé)
const gedcollectAdminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requêtes par minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de requêtes. Réessayez dans une minute.',
    code: 'GEDCOLLECT_ADMIN_RATE_LIMIT',
  },
  skip: () => process.env.NODE_ENV === 'development',
});

router.use(authProtect);
router.use(authorize('ADMIN_PROQUELEC'));
router.use(gedcollectAdminLimiter);

router.get('/users', listUsers);
router.post('/users/set-phone', validate(updateGedcollectUserSchema), setPhone);
router.post('/users/toggle-activation', validate(updateGedcollectUserSchema), toggleActivation);
router.post('/users', validate(createGedcollectUserSchema), createGedcollectUser);
router.delete('/users/:id', validate(updateGedcollectUserSchema), deleteGedcollectUser);

router.get('/assignments', listAssignments);
router.post('/assignments', validate(createAssignmentSchema), createAssignment);
router.delete('/assignments/:id', validate(deleteAssignmentSchema), deleteAssignment);

router.get('/stats', getGedcollectStats);
router.get('/submissions', validate(listSubmissionsSchema), listGedcollectSubmissions);
router.get('/submissions/export', exportGedcollectSubmissions);
router.get('/forms', validate(listFormsSchema), listForms);

export default router;
