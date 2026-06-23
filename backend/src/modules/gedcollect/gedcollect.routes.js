import express from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import {
  sendOtp,
  verifyOtp,
  getAssignedForms,
  submitForm,
} from './gedcollect.controller.js';

const router = express.Router();

// Auth endpoints (no auth required)
router.post('/auth/send-otp', sendOtp);
router.post('/auth/verify-otp', verifyOtp);

// Protected endpoints
router.use(authProtect);
router.get('/forms', getAssignedForms);
router.post('/submissions', submitForm);

export default router;
