import { Router } from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import { handleQuery, saveMemory, getMemory } from './assistant.controller.js';

const router = Router();

router.use(authProtect);

router.post('/query', handleQuery);
router.post('/memory', saveMemory);
router.get('/memory/:userId', getMemory);

export default router;
