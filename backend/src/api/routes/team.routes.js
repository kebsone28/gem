import express from 'express';
import {
    getTeams,
    getTeamsTree,
    createTeam,
    updateTeam,
    deleteTeam,
    assignTeamToZone,
    autoGenerateTeams
} from '../../modules/team/team.controller.js';
import { getRegions } from '../../modules/team/region.controller.js';
import { getGrappes, syncGrappes } from '../../modules/team/grappe.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission, verifierModule } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

router.use(authProtect);
router.use(verifierModule('users'));

router.get('/', getTeams);
router.get('/tree', getTeamsTree);
router.get('/regions', getRegions);
router.get('/grappes', getGrappes);
router.post('/auto-generate', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), autoGenerateTeams);
router.post('/grappes/sync', verifierPermission(PERMISSIONS.GERER_PARAMETRES), syncGrappes);

router.post('/', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), createTeam);
router.patch('/:id', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), updateTeam);
router.delete('/:id', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), deleteTeam);
router.post('/:id/assign', verifierPermission(PERMISSIONS.GERER_LOGISTIQUE), assignTeamToZone);

export default router;

