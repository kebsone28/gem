import express from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import { authorize } from '../../api/middlewares/auth.js';
import {
  listUsers,
  setPhone,
  toggleActivation,
  createGedcollectUser,
  listAssignments,
  createAssignment,
  deleteAssignment,
  listForms,
} from './gedcollect.admin.controller.js';

const router = express.Router();

router.use(authProtect);
router.use(authorize('ADMIN_PROQUELEC'));

router.get('/users', listUsers);
router.post('/users/set-phone', setPhone);
router.post('/users/toggle-activation', toggleActivation);
router.post('/users', createGedcollectUser);

router.get('/assignments', listAssignments);
router.post('/assignments', createAssignment);
router.delete('/assignments/:id', deleteAssignment);

router.get('/forms', listForms);

export default router;
