import express from 'express';
import { registerOrganization, login, refreshToken, logout } from '../../modules/auth/auth.controller.js';

const router = express.Router();

router.post('/register', registerOrganization);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

export default router;
