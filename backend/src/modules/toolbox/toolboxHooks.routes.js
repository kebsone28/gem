import express from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import { listHooks, createHook, updateHook, deleteHook, testHook } from './toolboxHooks.controller.js';

const router = express.Router();
router.use(authProtect);

router.get('/hooks', listHooks);
router.post('/hooks', createHook);
router.patch('/hooks/:id', updateHook);
router.delete('/hooks/:id', deleteHook);
router.post('/hooks/:id/test', testHook);

export default router;
