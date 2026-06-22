import express from 'express';
import {
  getMESRecords,
  getMESRecordById,
  createMESRecord,
  updateMESRecord,
  deleteMESRecord,
  updateMESStatus,
  getMESStats,
  importFromExcel,
  exportToExcel,
  getZones,
  getPostes,
  getAgents,
  validateMESRecord,
  controlMESRecord
} from '../../modules/mes/mes.controller.js';
import { authProtect } from '../middlewares/auth.js';
import { verifierPermission } from '../../middleware/verifierPermission.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: MES
 *   description: Gestion des Mises en Service Électriques
 */

// Toutes les routes sont protégées par défaut par l'organisation via authProtect
router.use(authProtect);

/**
 * @swagger
 * /api/mes/records:
 *   get:
 *     summary: Lister les enregistrements MES
 *     tags: [MES]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: prestataire
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Liste des enregistrements MES
 */
router.get('/records', getMESRecords);

/**
 * @swagger
 * /api/mes/records/{id}:
 *   get:
 *     summary: Obtenir un enregistrement MES par ID
 *     tags: [MES]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Détails de l'enregistrement MES
 */
router.get('/records/:id', getMESRecordById);

/**
 * @swagger
 * /api/mes/records:
 *   post:
 *     summary: Créer un nouvel enregistrement MES
 *     tags: [MES]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Enregistrement MES créé
 */
router.post('/records', verifierPermission('mes.create'), createMESRecord);

/**
 * @swagger
 * /api/mes/records/{id}:
 *   patch:
 *     summary: Mettre à jour un enregistrement MES
 *     tags: [MES]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Enregistrement MES mis à jour
 */
router.patch('/records/:id', verifierPermission('mes.update'), updateMESRecord);

/**
 * @swagger
 * /api/mes/records/{id}:
 *   delete:
 *     summary: Supprimer un enregistrement MES
 *     tags: [MES]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Enregistrement MES supprimé
 */
router.delete('/records/:id', verifierPermission('mes.delete'), deleteMESRecord);

/**
 * @swagger
 * /api/mes/records/{id}/status:
 *   patch:
 *     summary: Mettre à jour le statut d'un enregistrement MES
 *     tags: [MES]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statut mis à jour
 */
router.patch('/records/:id/status', verifierPermission('mes.update'), updateMESStatus);

/**
 * @swagger
 * /api/mes/records/{id}/validate:
 *   post:
 *     summary: Valider un enregistrement MES
 *     tags: [MES]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Enregistrement MES validé
 */
router.post('/records/:id/validate', verifierPermission('mes.validate'), validateMESRecord);

/**
 * @swagger
 * /api/mes/records/{id}/control:
 *   post:
 *     summary: Contrôler un enregistrement MES
 *     tags: [MES]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Enregistrement MES contrôlé
 */
router.post('/records/:id/control', verifierPermission('mes.control'), controlMESRecord);

/**
 * @swagger
 * /api/mes/stats:
 *   get:
 *     summary: Obtenir les statistiques MES
 *     tags: [MES]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *       - in: query
 *         name: prestataire
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Statistiques MES
 */
router.get('/stats', getMESStats);

/**
 * @swagger
 * /api/mes/import/excel:
 *   post:
 *     summary: Importer des données depuis Excel
 *     tags: [MES]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Données importées
 */
router.post('/import/excel', verifierPermission('mes.import'), importFromExcel);

/**
 * @swagger
 * /api/mes/export/excel:
 *   get:
 *     summary: Exporter des données vers Excel
 *     tags: [MES]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: prestataire
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fichier Excel
 */
router.get('/export/excel', verifierPermission('mes.export'), exportToExcel);

/**
 * @swagger
 * /api/mes/zones:
 *   get:
 *     summary: Obtenir les zones disponibles
 *     tags: [MES]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des zones
 */
router.get('/zones', getZones);

/**
 * @swagger
 * /api/mes/postes:
 *   get:
 *     summary: Obtenir les postes disponibles
 *     tags: [MES]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des postes
 */
router.get('/postes', getPostes);

/**
 * @swagger
 * /api/mes/agents:
 *   get:
 *     summary: Obtenir les agents disponibles
 *     tags: [MES]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: prestataire
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Liste des agents
 */
router.get('/agents', getAgents);

export default router;
