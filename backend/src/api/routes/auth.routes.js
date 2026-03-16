import express from 'express';
import {
    registerOrganization,
    login,
    refreshToken,
    logout,
    changePassword,
    updateSecuritySettings,
    resetPassword,
    verify2FA
} from '../../modules/auth/auth.controller.js';
import { authProtect } from '../../api/middlewares/auth.js';

const router = express.Router();

router.post('/register', registerOrganization);
router.post('/login', login);
router.post('/verify-2fa', verify2FA);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

// Routes sécurisées (nécessitent d'être connecté)
router.post('/change-password', authProtect, changePassword);
router.post('/security-settings', authProtect, updateSecuritySettings);

// Route publique (récupération de mot de passe)
router.post('/reset-password', resetPassword);

export default router;
