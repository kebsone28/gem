import express from 'express';
import rateLimit from 'express-rate-limit';
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
    verifyPassword,
    getMe
} from '../../modules/auth/auth.controller.js';
import { authProtect } from '../../api/middlewares/auth.js';
import { validate } from '../../middleware/validate.js';
import {
    registerOrganizationSchema,
    loginSchema,
    verify2FASchema,
    impersonateUserSchema,
    changePasswordSchema,
    updateSecuritySettingsSchema,
    verifyPasswordSchema,
    resetPasswordSchema
} from '../../modules/auth/auth.validation.js';

const router = express.Router();

// Strict rate limiter for auth endpoints (5 attempts per minute per IP)
const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de tentatives. Réessayez dans une minute.' },
    skip: () => process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
});

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Endpoints d'authentification et d'autorisation
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Inscrire une nouvelle organisation
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               organizationName:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Organisation inscrite avec succès
 */
router.post('/register', authLimiter, validate(registerOrganizationSchema), registerOrganization);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Se connecter à l'application
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connexion réussie
 *       401:
 *         description: Non autorisé
 */
router.post('/login', authLimiter, validate(loginSchema), login);

router.post('/verify-2fa', authLimiter, validate(verify2FASchema), verify2FA);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Rafraîchir le token d'accès
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Token rafraîchi avec succès
 */
router.post('/refresh', refreshToken);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Récupérer les informations de l'utilisateur connecté
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Données de l'utilisateur
 */
router.get('/me', authProtect, getMe);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Déconnecter l'utilisateur courant
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 */
router.post('/logout', logout);

/**
 * @swagger
 * /api/auth/impersonate:
 *   post:
 *     summary: Prendre l'identité d'un autre utilisateur (God Mode)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usurpation d'identité réussie
 */
router.post('/impersonate', authProtect, validate(impersonateUserSchema), impersonateUser);

/**
 * @swagger
 * /api/auth/stop-impersonation:
 *   post:
 *     summary: Arrêter l'usurpation d'identité
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usurpation d'identité arrêtée
 */
router.post('/stop-impersonation', authProtect, stopImpersonation);

// Routes sécurisées (nécessitent d'être connecté)
/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Changer le mot de passe
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mot de passe modifié avec succès
 */
router.post('/change-password', authProtect, validate(changePasswordSchema), changePassword);

/**
 * @swagger
 * /api/auth/security-settings:
 *   post:
 *     summary: Mettre à jour les paramètres de sécurité
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Paramètres mis à jour
 */
router.post('/security-settings', authProtect, validate(updateSecuritySettingsSchema), updateSecuritySettings);

/**
 * @swagger
 * /api/auth/verify-password:
 *   post:
 *     summary: Vérifier le mot de passe pour des opérations sensibles
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mot de passe vérifié
 */
router.post('/verify-password', authProtect, validate(verifyPasswordSchema), verifyPassword);

// Route publique (récupération de mot de passe)
/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Réinitialiser le mot de passe
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Email de réinitialisation envoyé
 */
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

export default router;
