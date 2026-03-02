import express from 'express';
import { pullChanges, pushChanges } from '../../modules/sync/sync.controller.js';
import { authProtect } from '../middlewares/auth.js';

const router = express.Router();

// All sync routes are protected
router.use(authProtect);

router.get('/pull', pullChanges);
router.post('/push', pushChanges);

export default router;
