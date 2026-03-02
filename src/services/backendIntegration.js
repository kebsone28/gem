/**
 * Frontend Integration Bridge
 * Adapte les appels API des pages existantes vers le nouveau backend
 */

import { apiClient } from './apiClient.js';
import logger from '../utils/logger.js';

/**
 * Initialiser le mode Web vs. Electron
 */
export const initializeMode = () => {
  const isElectron = window.require !== undefined;
  const isWeb = !isElectron;

  if (isWeb) {
    logger.info('🌍 Mode Web détecté - Frontend backend integration activée');

    // Hooker les requêtes IndexedDB existantes vers le backend
    hijackIndexedDB();

    // Initialiser le state global avec données backend
    initializeGlobalState();
  } else {
    logger.info('🖥️  Mode Electron détecté - IndexedDB local utilisé');
  }
};

/**
 * Rediriger les appels IndexedDB vers le backend API
 */
const hijackIndexedDB = () => {
  // Sauvegarder l'IndexedDB original
  const originalIndexedDB = window.indexedDB;

  // Créer un proxy
  window.indexedDB = new Proxy(originalIndexedDB, {
    get(target, prop) {
      if (prop === 'open') {
        // Override open() pour utiliser backend
        return async (dbName, version) => {
          logger.debug(`📦 IndexedDB.open("${dbName}") redirigé vers backend`);

          // Créer un objet compatible IDBDatabase
          return createBackendDatabaseProxy(dbName);
        };
      }
      return target[prop];
    }
  });
};

/**
 * Créer un proxy qui simule une IDBDatabase avec appels backend
 */
const createBackendDatabaseProxy = (dbName) => {
  return {
    transaction(stores, mode) {
      return {
        objectStore(storeName) {
          return {
            add: async (data) => ({
              result: data.id,
              onsuccess: () => {}
            }),

            put: async (data) => {
              // Sauvegarder via le backend selon le storeName
              switch (storeName) {
                case 'households':
                  return await apiClient.createHousehold(data);
                case 'deliveries':
                  return await apiClient.createDelivery(data);
                case 'projects':
                  return await apiClient.updateProject(data.id, data);
                default:
                  return data;
              }
            },

            get: async (key) => ({
              result: null
            }),

            getAll: async () => {
              switch (storeName) {
                case 'households':
                  const households = await apiClient.getHouseholds();
                  return { result: households.households || [] };
                case 'projects':
                  const projects = await apiClient.getProjects();
                  return { result: projects.projects || [] };
                default:
                  return { result: [] };
              }
            },

            clear: async () => ({})
          };
        }
      };
    }
  };
};

/**
 * Initialiser l'état global avec les données du backend
 */
const initializeGlobalState = async () => {
  try {
    // Récupérer l'utilisateur courant
    const user = apiClient.getStoredUser();

    if (!user) {
      logger.warn('❌ Utilisateur non authentifié - redirection vers login');
      window.location.href = '/login.html';
      return;
    }

    logger.success(`✅ Utilisateur connecté: ${user.email} (${user.role})`);

    // Récupérer les projets
    const projectsResponse = await apiClient.getProjects();
    window.projectsData = projectsResponse.projects || [];

    // Récupérer les KPI du premier projet si disponible
    if (window.projectsData.length > 0) {
      const projectId = window.projectsData[0].id;
      const kpiResponse = await apiClient.getProjectKPI(projectId);

      if (kpiResponse.snapshot) {
        window.kpiData = kpiResponse.snapshot;
        logger.success(`📊 KPI chargés pour projet ${projectId}`);
      }
    }

    // Déclencher un événement custom pour que les pages existantes les utilisent
    window.dispatchEvent(new CustomEvent('backendReady', {
      detail: { user, projects: window.projectsData, kpi: window.kpiData }
    }));

  } catch (error) {
    logger.error(`Erreur initialisation backend: ${error.message}`);
  }
};

/**
 * Hook pour les pages existantes qui attendent des événements
 */
export const onBackendReady = (callback) => {
  if (window.backendReady) {
    callback({ user: apiClient.getStoredUser(), projects: window.projectsData });
  } else {
    window.addEventListener('backendReady', callback);
  }
};

/**
 * Sync aller-retour client ↔ serveur
 */
export const syncWithBackend = async () => {
  try {
    logger.info('🔄 Synchronisation avec le backend...');

    // Envoyer toutes les modifications en attente
    const pendingChanges = localStorage.getItem('pendingChanges');

    if (pendingChanges) {
      const changes = JSON.parse(pendingChanges);

      for (const change of changes) {
        try {
          switch (change.type) {
            case 'household_update':
              await apiClient.updateHousehold(change.id, change.data);
              break;
            case 'delivery_create':
              await apiClient.createDelivery(change.data);
              break;
            case 'project_update':
              await apiClient.updateProject(change.id, change.data);
              break;
          }
        } catch (error) {
          logger.warn(`⚠️  Sync failed for ${change.type}:`, error);
        }
      }

      localStorage.removeItem('pendingChanges');
    }

    logger.success('✅ Synchronisation complète');
  } catch (error) {
    logger.error(`Erreur sync: ${error.message}`);
  }
};

export default {
  initializeMode,
  onBackendReady,
  syncWithBackend,
  apiClient
};
