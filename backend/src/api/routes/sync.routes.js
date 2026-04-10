import express from 'express';
import { pullChanges, pushChanges, syncKobo, clearEntityData } from '../../modules/sync/sync.controller.js';
import { authProtect } from '../middlewares/auth.js';

const router = express.Router();

// All sync routes are protected
router.use(authProtect);

router.get('/pull', pullChanges);
router.post('/push', pushChanges);
router.post('/kobo', syncKobo);
router.delete('/clear/:entity', clearEntityData);

export default router;
