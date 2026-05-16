import express from 'express';
import { getUsers, createUser, updateUser, deleteUser, requestUserDeletion } from '../../modules/user/user.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';
import { validate } from '../../middleware/validate.js';
import {
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
  requestUserDeletionSchema
} from '../../modules/user/user.validation.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Gestion des utilisateurs de l'organisation
 */

// All user routes are protected
router.use(authProtect);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Lister les utilisateurs de l'organisation
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des utilisateurs récupérée avec succès
 */
router.get('/', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), getUsers);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Créer un nouvel utilisateur
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               roleLegacy:
 *                 type: string
 *               roleId:
 *                 type: string
 *                 format: uuid
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 */
router.post('/', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), validate(createUserSchema), createUser);

/**
 * @swagger
 * /api/users/{id}/request-deletion:
 *   post:
 *     summary: Demander la suppression d'un utilisateur
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Demande de suppression enregistrée
 */
router.post('/:id/request-deletion', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), validate(requestUserDeletionSchema), requestUserDeletion);

/**
 * @swagger
 * /api/users/{id}:
 *   patch:
 *     summary: Mettre à jour un utilisateur existant
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               roleLegacy:
 *                 type: string
 *               roleId:
 *                 type: string
 *                 format: uuid
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Utilisateur mis à jour avec succès
 */
router.patch('/:id', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), validate(updateUserSchema), updateUser);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Supprimer un utilisateur
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Utilisateur supprimé avec succès
 */
router.delete('/:id', verifierPermission(PERMISSIONS.GERER_UTILISATEURS), validate(deleteUserSchema), deleteUser);

export default router;
