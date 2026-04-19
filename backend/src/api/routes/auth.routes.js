import express from 'express';
import {
    registerOrganization,
    login,
    refreshToken,
    logout,
    changePassword,
    updateSecuritySettings,
    resetPassword,
    verify2FA,
    impersonateUser,
    stopImpersonation,
    verifyPassword
} from '../../modules/auth/auth.controller.js';
import { authProtect } from '../../api/middlewares/auth.js';

const router = express.Router();

router.post('/register', registerOrganization);
router.post('/login', login);
router.post('/verify-2fa', verify2FA);
router.post('/refresh', refreshToken);
router.get('/me', authProtect, getMe);
router.post('/logout', logout);
router.post('/impersonate', authProtect, impersonateUser);
router.post('/stop-impersonation', authProtect, stopImpersonation);

// Routes sécurisées (nécessitent d'être connecté)
router.post('/change-password', authProtect, changePassword);
router.post('/security-settings', authProtect, updateSecuritySettings);
router.post('/verify-password', authProtect, verifyPassword);

// Route publique (récupération de mot de passe)
router.post('/reset-password', resetPassword);

export default router;
