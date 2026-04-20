/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import Dexie, { type Table } from 'dexie';
import type { Project, Household, AuditLog } from '../utils/types';

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

export class ProquelecDatabase extends Dexie {
  organizations!: Table<{ id: string; name: string }>;
  users!: Table<{ id: string; email: string; name: string; role: string }>;
  /** projects stored locally using the Project interface above */
  projects!: Table<Project>;
  zones!: Table<{ id: string; name: string; projectId: string }>;
  households!: Table<Household>;
  grappes!: Table<{ id: string; name: string; projectId: string }>; // Add grappes table for bordereau caching
  teams!: Table<{ id: string; name: string; projectId: string }>;
  missions!: Table<{ id: string; projectId: string; status: string }>;
  notifications!: Table<MissionNotification>;
  sync_logs!: Table<SyncLog>;
  app_security!: Table<AppSecurity>;
  syncOutbox!: Table<SyncQueueItem>;
  favorites!: Table<{
    id?: number;
    projectId: string;
    householdId: string;
    createdAt: string;
  }>;
  map_tiles!: Table<{
    url: string;
    blob: Blob; // Or ArrayBuffer
    timestamp: number;
    zoom: number;
  }>;
  audit_logs!: Table<AuditLog>;
  ai_learning_logs!: Table<{
    id?: number;
    query: string;
    userId: string;
    role: string;
    timestamp: Date;
    context?: string;
  }>;
  pvs!: Table<{
    id: string;
    householdId: string;
    projectId: string;
    type: string;
    content: string;
    createdBy: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;

  constructor() {
    super('ProquelecDB');
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

    // Version 12 — IA Learning Logs (GEM-MINT Evolution)
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
