import express from 'express';
import { getUsers, createUser, updateUser, deleteUser } from '../../modules/user/user.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

// All user routes are protected
router.use(authProtect);

// Only administrators can manage users
router.get('/', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), getUsers);
router.post('/', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), createUser);
router.patch('/:id', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), updateUser);
router.delete('/:id', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), deleteUser);

export default router;
