import express from 'express';
import { pullChanges, pushChanges, syncKobo, syncGedToolbox, clearEntityData, bulkImportHouseholds } from '../../modules/sync/sync.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';

const router = express.Router();

// All sync routes are protected
router.use(authProtect);

router.get('/pull', pullChanges);
router.post('/push', pushChanges);
router.post('/kobo', verifierPermission(PERMISSIONS.ACCES_TERMINAL_KOBO), syncKobo);
// GedToolbox sync – uses same permission as Kobo (or could be a dedicated one)
router.post('/gedtoolbox', verifierPermission(PERMISSIONS.ACCES_TERMINAL_KOBO), syncGedToolbox);
router.post('/import-bulk', verifierPermission(PERMISSIONS.GERER_PARAMETRES), bulkImportHouseholds);
router.delete('/clear/:entity', verifierPermission(PERMISSIONS.GERER_PARAMETRES), clearEntityData);

export default router;
