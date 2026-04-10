import express from 'express';
import { authProtect, authorize } from '../../api/middlewares/auth.js';
import { getSizingRecommendation, applySizingScale } from './sizing.controller.js';

const router = express.Router();

router.post('/recommend', authProtect, authorize('CHEF_PROJET'), getSizingRecommendation);
router.post('/apply', authProtect, authorize('CHEF_PROJET'), applySizingScale);

export default router;
