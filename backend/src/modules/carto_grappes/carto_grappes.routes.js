import { Router } from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import {
  getHouseholdEntries,
  upsertHouseholdEntry,
  bulkUpsertEntries,
  getEntrepreneurs,
  upsertEntrepreneur,
  deleteEntrepreneur,
  getVillageOverrides,
  setVillageOverride,
  getHistory,
  clearHistory,
  getSettings,
  updateSettings,
  getWorkflowQueue,
  submitWorkflow,
  approveWorkflow,
  getArchives,
  createArchive,
  getStatsSnapshots,
  createStatsSnapshot,
  getPlanningParams,
  updatePlanningParams,
  getGantt,
  upsertGantt,
  getFiches,
  addFicheEntry,
  deleteFicheEntry,
  getPhoto,
  savePhoto,
  getContractTemplates,
  saveContractTemplate,
  getAlertsConfig,
  updateAlertsConfig,
  getVillages,
  getMenages,
  getGps,
  getPrestataires,
  upsertPrestataires,
  updatePrestataire,
  deletePrestataire,
  getRegions,
  upsertRegion,
  getGrappes,
  upsertGrappe,
  getLots,
  upsertLot,
  initializeDefaultData,
  getDashboardStats,
} from './carto_grappes.controller.js';

const router = Router();

// All routes require authentication
router.use(authProtect);

// Carto Regions, Grappes and Lots
router.get('/regions', getRegions);
router.post('/regions', upsertRegion);
router.get('/grappes', getGrappes);
router.post('/grappes', upsertGrappe);
router.get('/lots', getLots);
router.post('/lots', upsertLot);
router.post('/initialize', initializeDefaultData);
router.get('/dashboard-stats', getDashboardStats);

// Household Entries
router.get('/entries', getHouseholdEntries);
router.post('/entries', upsertHouseholdEntry);
router.post('/entries/bulk', bulkUpsertEntries);

// Entrepreneurs
router.get('/entrepreneurs', getEntrepreneurs);
router.post('/entrepreneurs', upsertEntrepreneur);
router.delete('/entrepreneurs/:id', deleteEntrepreneur);

// Village Overrides
router.get('/overrides', getVillageOverrides);
router.post('/overrides', setVillageOverride);

// History
router.get('/history', getHistory);
router.delete('/history', clearHistory);

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// Workflow
router.get('/workflow', getWorkflowQueue);
router.post('/workflow', submitWorkflow);
router.put('/workflow/:id/approve', approveWorkflow);

// Archives
router.get('/archives', getArchives);
router.post('/archives', createArchive);

// Stats
router.get('/stats', getStatsSnapshots);
router.post('/stats/snapshot', createStatsSnapshot);

// Planning Params
router.get('/planning', getPlanningParams);
router.put('/planning', updatePlanningParams);

// Gantt
router.get('/gantt', getGantt);
router.post('/gantt', upsertGantt);

// Fiches
router.get('/fiches', getFiches);
router.post('/fiches', addFicheEntry);
router.delete('/fiches/:id', deleteFicheEntry);

// Photos
router.get('/photos', getPhoto);
router.post('/photos', savePhoto);

// Contract Templates
router.get('/templates', getContractTemplates);
router.post('/templates', saveContractTemplate);

// Alerts
router.get('/alerts', getAlertsConfig);
router.put('/alerts', updateAlertsConfig);

// Reference Data
router.get('/villages', getVillages);
router.get('/menages', getMenages);
router.get('/gps', getGps);
router.get('/prestataires', getPrestataires);
router.post('/prestataires/bulk', upsertPrestataires);
router.put('/prestataires/:id', updatePrestataire);
router.delete('/prestataires/:id', deletePrestataire);

export default router;
