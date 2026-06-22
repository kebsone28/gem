import logger from '../services/logger';
import Dexie, { type Table } from 'dexie';
import type { Project, Household, AuditLog, Team } from '../utils/types';

export interface SyncLog {
  id?: number;
  timestamp: Date;
  action: string;
  details?: Record<string, unknown>;
}

export interface SyncQueueItem {
  id?: number;
  action: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  payload: Record<string, unknown>;
  timestamp: number;
  status: 'pending' | 'failed';
  retryCount: number;
  lastError?: string;
  lastAttemptAt?: number;
  nextRetryAt?: number;
  errorType?: 'network' | 'server' | 'validation' | 'version' | 'unknown';
}

export interface MissionNotification {
  id: string;
  projectId?: string;
  missionId?: string;
  type: 'approval' | 'rejection' | 'system';
  title: string;
  message: string;
  sender: string;
  createdAt: string;
  read: boolean;
  archived: boolean;
  dedupKey?: string; // 🔑 Clé pour éviter les doublons métier
}

// Paramètres de sécurité applicatifs (persistés localement)
export interface AppSecurity {
  key: string; // identifier: 'projectDeletePassword' | 'adminPassword' | 'securityQuestion' | 'securityAnswer' | 'recoveryCode'
  value: string;
  updatedAt: string;
}

export interface UserModuleAccess {
  id?: number;
  userId: string;
  moduleId: string;
  enabled: boolean;
  assignedAt: string;
  assignedBy: string;
}

export interface ProjectAssignment {
  id?: number;
  projectId: number;
  userId: string;
  role: string;
  assignedAt: Date;
  assignedBy: string;
  permissions: string[];
  canSwitch: boolean;
  lastAccessed: Date;
}

export interface SyncJob {
  id: string;
  entityType: 'project';
  operation: 'create' | 'update' | 'delete';
  entityId: string;
  tenantId: string;
  payload: any;
  retries: number;
  status: 'pending' | 'syncing' | 'failed';
  createdAt: number;
  updatedAt: number;
  lastError?: string;
}

export class ProquelecDatabase extends Dexie {
  organizations!: Table<{ id: string; name: string }>;
  users!: Table<{ id: string; email: string; name: string; role: string }>;
  /** projects stored locally using Project interface above */
  projects!: Table<Project>;
  zones!: Table<{ id: string; name: string; projectId: string; region?: string }>;
  households!: Table<Household>;
  grappes!: Table<{ id: string; name: string; projectId: string }>; // Add grappes table for bordereau caching
  teams!: Table<Team>;
  missions!: Table<{ id: string; projectId: string; status: string; [key: string]: unknown }>;
  notifications!: Table<MissionNotification>;
  sync_logs!: Table<SyncLog>;
  app_security!: Table<AppSecurity>;
  syncOutbox!: Table<SyncQueueItem>;
  syncQueue!: Table<SyncJob>; // 🚀 File d'attente SaaS Offline Mutation Queue
  favorites!: Table<{
    id?: number;
    projectId: string;
    householdId: string;
    createdAt: string;
  }>;
  map_tiles!: Table<{
    url: string;
    timestamp: number;
    zoom: number;
  }>;
  ai_learning_logs!: Table<{
    id?: number;
    query: string;
    userId: string;
    role: string;
    timestamp: number;
  }>;
  user_feedback!: Table<{
    id?: number;
    query: string;
    response: string;
    rating: 'positive' | 'negative' | 'neutral';
    userId: string;
    role: string;
    timestamp: number;
    reason?: string;
    improvedAnswer?: string;
  }>;
  audit_logs!: Table<{
    id?: number;
    userId: string;
    action: string;
    timestamp: number;
  }>;
  pvs!: Table<{
    id?: number;
    householdId: string;
    projectId: string;
    type: string;
    createdAt: string;
  }>;
  user_modules_access!: Table<UserModuleAccess>;
  projectAssignments!: Table<ProjectAssignment>;

  constructor() {
    super('GEM_DB');
    this.version(3).stores({
      organizations: 'id, name',
      users: 'id, organizationId, email, role',
      projects: 'id, organizationId, name, status, version',
      zones: 'id, projectId, organizationId, name, version',
      households: 'id, projectId, zoneId, organizationId, status, version',
      grappes: 'id, projectId, region',
      teams: 'id, organizationId, name, type, specialty',
      sync_logs: '++id, timestamp, action',
    });
    // Version 4 — table sécurité
    this.version(4).stores({
      organizations: 'id, name',
      users: 'id, organizationId, email, role',
      projects: 'id, organizationId, name, status, version',
      zones: 'id, projectId, organizationId, name, version',
      households: 'id, projectId, zoneId, organizationId, status, version',
      grappes: 'id, projectId, region',
      teams: 'id, organizationId, name, type, specialty',
      sync_logs: '++id, timestamp, action',
      app_security: 'key, updatedAt',
    });

    // Version 5 — logistique et finances
    this.version(5).stores({
      inventory: 'id, projectId, category, name',
      expenses: 'id, projectId, category, date',
      organizations: 'id, name',
      users: 'id, organizationId, email, role',
      projects: 'id, organizationId, name, status, version',
      zones: 'id, projectId, organizationId, name, version',
      households: 'id, projectId, zoneId, organizationId, status, version',
      grappes: 'id, projectId, region',
      teams: 'id, organizationId, name, type, specialty',
      sync_logs: '++id, timestamp, action',
      app_security: 'key, updatedAt',
    });

    // Version 6 — missions
    this.version(6).stores({
      missions: 'id, projectId, orderNumber, startDate, endDate',
      inventory: 'id, projectId, category, name',
      expenses: 'id, projectId, category, date',
      organizations: 'id, name',
      users: 'id, organizationId, email, role',
      projects: 'id, organizationId, name, status, version',
      zones: 'id, projectId, organizationId, name, version',
      households: 'id, projectId, zoneId, organizationId, status, version',
      grappes: 'id, projectId, region',
      teams: 'id, organizationId, name, type, specialty',
      sync_logs: '++id, timestamp, action',
      app_security: 'key, updatedAt',
      user_modules_access: '++id, userId, moduleId',
    });

    // Version 7 — File d'attente de synchronisation hors-ligne
    this.version(7).stores({
      missions: 'id, projectId, orderNumber, startDate, endDate',
      inventory: 'id, projectId, category, name',
      expenses: 'id, projectId, category, date',
      organizations: 'id, name',
      users: 'id, organizationId, email, role',
      projects: 'id, organizationId, name, status, version',
      zones: 'id, projectId, organizationId, name, version',
      households: 'id, projectId, zoneId, organizationId, status, version',
      grappes: 'id, projectId, region',
      teams: 'id, organizationId, name, type, specialty',
      sync_logs: '++id, timestamp, action',
      app_security: 'key, updatedAt',
      syncOutbox: '++id, status, timestamp',
    });

    // Version 8 — Favoris et Bookmarks
    this.version(8).stores({
      missions: 'id, projectId, orderNumber, startDate, endDate',
      inventory: 'id, projectId, category, name',
      expenses: 'id, projectId, category, date',
      organizations: 'id, name',
      users: 'id, organizationId, email, role',
      projects: 'id, organizationId, name, status, version',
      zones: 'id, projectId, organizationId, name, version',
      households: 'id, projectId, zoneId, organizationId, status, version',
      grappes: 'id, projectId, region',
      teams: 'id, organizationId, name, type, specialty',
      sync_logs: '++id, timestamp, action',
      app_security: 'key, updatedAt',
      syncOutbox: '++id, status, timestamp',
      favorites: '++id, projectId, householdId, createdAt',
    });

    // Version 9 — Cache Tuiles Hybride Offline MapLibre
    this.version(9).stores({
      missions: 'id, projectId, orderNumber, startDate, endDate',
      inventory: 'id, projectId, category, name',
      expenses: 'id, projectId, category, date',
      organizations: 'id, name',
      users: 'id, organizationId, email, role',
      projects: 'id, organizationId, name, status, version',
      zones: 'id, projectId, organizationId, name, version',
      households: 'id, projectId, zoneId, organizationId, status, version',
      grappes: 'id, projectId, region',
      teams: 'id, organizationId, name, type, specialty',
      sync_logs: '++id, timestamp, action',
      app_security: 'key, updatedAt',
      syncOutbox: '++id, status, timestamp', // 🔑 Préserver explicitement — absent = supprimé par Dexie lors de la migration v8→v9
      favorites: '++id, projectId, householdId, createdAt',
      map_tiles: 'url, timestamp, zoom', // Clé primaire: url
    });

    // Version 10 — Notifications d'approbation et alertes
    this.version(10).stores({
      notifications: 'id, type, projectId, missionId, archived, read, createdAt',
      missions: 'id, projectId, orderNumber, startDate, endDate',
      inventory: 'id, projectId, category, name',
      expenses: 'id, projectId, category, date',
      organizations: 'id, name',
      users: 'id, organizationId, email, role',
      projects: 'id, organizationId, name, status, version',
      zones: 'id, projectId, organizationId, name, version',
      households: 'id, projectId, zoneId, organizationId, status, version',
      grappes: 'id, projectId, region',
      teams: 'id, organizationId, name, type, specialty',
      sync_logs: '++id, timestamp, action',
      app_security: 'key, updatedAt',
      syncOutbox: '++id, status, timestamp',
      favorites: '++id, projectId, householdId, createdAt',
      map_tiles: 'url, timestamp, zoom',
    });

    // Version 11 — Audit logs pour la sécurité
    this.version(11).stores({
      audit_logs: 'id, userId, action, timestamp',
      notifications: 'id, type, projectId, missionId, archived, read, createdAt',
      missions: 'id, projectId, orderNumber, startDate, endDate',
      inventory: 'id, projectId, category, name',
      expenses: 'id, projectId, category, date',
      organizations: 'id, name',
      users: 'id, organizationId, email, role',
      projects: 'id, organizationId, name, status, version',
      zones: 'id, projectId, organizationId, name, version',
      households: 'id, projectId, zoneId, organizationId, status, version',
      grappes: 'id, projectId, region',
      teams: 'id, organizationId, name, type, specialty',
      sync_logs: '++id, timestamp, action',
      app_security: 'key, updatedAt',
      syncOutbox: '++id, status, timestamp',
      favorites: '++id, projectId, householdId, createdAt',
      map_tiles: 'url, timestamp, zoom',
    });

    // Version 12 — IA Learning Logs (GED OS Evolution)
    this.version(12).stores({
      ai_learning_logs: '++id, query, userId, role, timestamp',
      audit_logs: 'id, userId, action, timestamp',
      notifications: 'id, type, projectId, missionId, archived, read, createdAt',
      missions: 'id, projectId, orderNumber, startDate, endDate',
      inventory: 'id, projectId, category, name',
      expenses: 'id, projectId, category, date',
      organizations: 'id, name',
      users: 'id, organizationId, email, role',
      projects: 'id, organizationId, name, status, version',
      zones: 'id, projectId, organizationId, name, version',
      households: 'id, projectId, zoneId, organizationId, status, version',
      grappes: 'id, projectId, region',
      teams: 'id, organizationId, name, type, specialty',
      sync_logs: '++id, timestamp, action',
      app_security: 'key, updatedAt',
      syncOutbox: '++id, status, timestamp',
      favorites: '++id, projectId, householdId, createdAt',
      map_tiles: 'url, timestamp, zoom',
    });

    // Version 13 — Persistance des PV
    this.version(13).stores({
      pvs: 'id, householdId, projectId, type, createdAt',
      ai_learning_logs: '++id, query, userId, role, timestamp',
      audit_logs: 'id, userId, action, timestamp',
      notifications: 'id, type, projectId, missionId, archived, read, createdAt',
      missions: 'id, projectId, orderNumber, startDate, endDate',
      inventory: 'id, projectId, category, name',
      expenses: 'id, projectId, category, date',
      organizations: 'id, name',
      users: 'id, organizationId, email, role',
      projects: 'id, organizationId, name, status, version',
      zones: 'id, projectId, organizationId, name, version',
      households: 'id, projectId, zoneId, organizationId, status, version',
      grappes: 'id, projectId, region',
      teams: 'id, organizationId, name, type, specialty',
      sync_logs: '++id, timestamp, action',
      app_security: 'key, updatedAt',
      syncOutbox: '++id, status, timestamp',
      favorites: '++id, projectId, householdId, createdAt',
      map_tiles: 'url, timestamp, zoom',
    });

    // 🔑 Version 14: Ajout déduplication des notifications par clé métier & Restauration schéma complet
    this.version(14).stores({
      notifications: 'id, type, projectId, missionId, archived, read, createdAt, dedupKey',
      pvs: 'id, householdId, projectId, type, createdAt',
      ai_learning_logs: '++id, query, userId, role, timestamp',
      audit_logs: 'id, userId, action, timestamp',
      missions: 'id, projectId, orderNumber, startDate, endDate',
      inventory: 'id, projectId, category, name',
      expenses: 'id, projectId, category, date',
      organizations: 'id, name',
      users: 'id, organizationId, email, role',
      projects: 'id, organizationId, name, status, version',
      zones: 'id, projectId, organizationId, name, version',
      households: 'id, projectId, zoneId, organizationId, status, version',
      grappes: 'id, projectId, region',
      teams: 'id, organizationId, name, type, specialty',
      sync_logs: '++id, timestamp, action',
      app_security: 'key, updatedAt',
      syncOutbox: '++id, status, timestamp',
      favorites: '++id, projectId, householdId, createdAt',
      map_tiles: 'url, timestamp, zoom',
      projectAssignments: '++id, projectId, userId, role, assignedAt',
      user_modules_access: '++id, userId, moduleId',
    });

    // Version 15 — AI Auto-Training System (Feedback utilisateur)
    this.version(15).stores({
      user_feedback: '++id, query, userId, role, rating, timestamp',
      notifications: 'id, type, projectId, missionId, archived, read, createdAt, dedupKey',
      pvs: 'id, householdId, projectId, type, createdAt',
      ai_learning_logs: '++id, query, userId, role, timestamp',
      audit_logs: 'id, userId, action, timestamp',
      missions: 'id, projectId, orderNumber, startDate, endDate',
      inventory: 'id, projectId, category, name',
      expenses: 'id, projectId, category, date',
      organizations: 'id, name',
      users: 'id, organizationId, email, role',
      projects: 'id, organizationId, name, status, version',
      zones: 'id, projectId, organizationId, name, version',
      households: 'id, projectId, zoneId, organizationId, status, version',
      grappes: 'id, projectId, region',
      teams: 'id, organizationId, name, type, specialty',
      sync_logs: '++id, timestamp, action',
      app_security: 'key, updatedAt',
      syncOutbox: '++id, status, timestamp',
      favorites: '++id, projectId, householdId, createdAt',
      map_tiles: 'url, timestamp, zoom',
      projectAssignments: '++id, projectId, userId, role, assignedAt',
    });

    // Version 16 — Enforce Multi-Tenant Isolation
    this.version(16).stores({
      user_feedback: '++id, query, userId, role, rating, timestamp, organizationId, projectId',
      notifications: 'id, type, projectId, missionId, archived, read, createdAt, dedupKey, organizationId',
      pvs: 'id, householdId, projectId, type, createdAt, organizationId',
      ai_learning_logs: '++id, query, userId, role, timestamp, organizationId, projectId',
      audit_logs: 'id, userId, action, timestamp, organizationId, projectId',
      missions: 'id, projectId, organizationId, orderNumber, startDate, endDate',
      inventory: 'id, projectId, organizationId, category, name',
      expenses: 'id, projectId, organizationId, category, date',
      organizations: 'id, slug, name',
      users: 'id, organizationId, email, role',
      projects: 'id, organizationId, name, status, version',
      zones: 'id, projectId, organizationId, name, version',
      households: 'id, projectId, zoneId, organizationId, status, version',
      grappes: 'id, projectId, organizationId, region',
      teams: 'id, organizationId, projectId, name, type, specialty',
      sync_logs: '++id, timestamp, action, organizationId',
      app_security: 'key, updatedAt, organizationId',
      syncOutbox: '++id, status, timestamp, organizationId',
      favorites: '++id, projectId, householdId, createdAt, organizationId',
      map_tiles: 'url, timestamp, zoom',
      projectAssignments: '++id, projectId, userId, role, assignedAt, organizationId',
    }).upgrade(async tx => {
      // 🛡️ [MIGRATION v16] Sécurisation de la persistance multi-tenant
      // On s'assure que les données existantes ne sont pas corrompues par l'ajout des index de tenant
      logger.log('🚀 [DEXIE MIGRATION] Début de la mise à jour vers v16 (Multi-Tenant)...');
      
      return tx.table('syncOutbox').toCollection().modify(item => {
          if (!item.organizationId) {
             // On laisse l'application le remplir au prochain démarrage si possible, 
             // ou on marque le besoin de resync.
          }
      });
    });

    // Version 17 — SaaS Offline Mutation Queue & Hardened Indices
    this.version(17).stores({
      syncQueue: 'id, entityType, operation, entityId, tenantId, status, createdAt',
      user_feedback: '++id, query, userId, role, rating, timestamp, organizationId, projectId',
      notifications: 'id, type, projectId, missionId, archived, read, createdAt, dedupKey, organizationId',
      pvs: 'id, householdId, projectId, type, createdAt, organizationId',
      ai_learning_logs: '++id, query, userId, role, timestamp, organizationId, projectId',
      audit_logs: 'id, userId, action, timestamp, organizationId, projectId',
      missions: 'id, projectId, organizationId, orderNumber, startDate, endDate',
      inventory: 'id, projectId, organizationId, category, name',
      expenses: 'id, projectId, organizationId, category, date',
      organizations: 'id, slug, name',
      users: 'id, organizationId, email, role',
      projects: 'id, organizationId, name, status, version, syncStatus, dirty',
      zones: 'id, projectId, organizationId, name, version',
      households: 'id, projectId, zoneId, organizationId, status, version',
      grappes: 'id, projectId, organizationId, region',
      teams: 'id, organizationId, projectId, name, type, specialty',
      sync_logs: '++id, timestamp, action, organizationId',
      app_security: 'key, updatedAt, organizationId',
      syncOutbox: '++id, status, timestamp, organizationId',
      favorites: '++id, projectId, householdId, createdAt, organizationId',
      map_tiles: 'url, timestamp, zoom',
      projectAssignments: '++id, projectId, userId, role, assignedAt, organizationId',
    });
  }
}

export const db = new ProquelecDatabase();

export const syncData = async (table: string, items: Record<string, unknown>[]) => {
  return await db.transaction('rw', table, async () => {
    const dbTable = (
      db as unknown as Record<
        string,
        {
          bulkDelete: (ids: unknown[]) => Promise<void>;
          bulkPut: (items: unknown[]) => Promise<void>;
        }
      >
    )[table];

    const toDelete = items.filter((item) => item.deletedAt).map((item) => item.id);
    const toPut = items.filter((item) => !item.deletedAt);

    if (toDelete.length > 0) {
      await dbTable.bulkDelete(toDelete);
    }

    if (toPut.length > 0) {
      // Use bulkPut to handle both creation and updates efficiently
      await dbTable.bulkPut(toPut);
    }
  });
};
