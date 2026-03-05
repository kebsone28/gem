import express from 'express';
import {
    getTeams,
    createTeam
} from '../../modules/team/team.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

router.use(authProtect);

router.get('/', getTeams);
router.post('/', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), createTeam);

export default router;
