import Dexie, { type Table } from 'dexie';

export interface Project {
    id: string;
    organizationId: string;
    name: string;
    status: string;
    version: number;
    config?: Record<string, any>;
    deletedAt?: Date | null;
}

export interface Household {
    id: string;
    projectId?: string;
    zoneId: string;
    organizationId: string;
    updatedAt?: string;
    grappeId?: string;
    grappeName?: string;
    deliveryStatus?: string;
    delivery?: any;
    assignedTeams?: string[];
    workTime?: any;
    latitude?: number;
    longitude?: number;
    name?: string;
    phone?: string;
    region?: string;
    departement?: string;
    village?: string;
    status: string;
    version: number;
    location?: any;
    owner?: any;
    koboData?: any;
    deletedAt?: Date | null;
}

export interface SyncLog {
    id?: number;
    timestamp: Date;
    action: string;
    details?: any;
}

export interface SyncQueueItem {
    id?: number;
    action: string;
    endpoint: string;
    method: 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    payload: any;
    timestamp: number;
    status: 'pending' | 'failed';
    retryCount: number;
    lastError?: string;
}

// Paramètres de sécurité applicatifs (persistés localement)
export interface AppSecurity {
    key: string;   // identifier: 'projectDeletePassword' | 'adminPassword' | 'securityQuestion' | 'securityAnswer' | 'recoveryCode'
    value: string;
    updatedAt: string;
}

export class ProquelecDatabase extends Dexie {
    organizations!: Table<{ id: string; name: string }>;
    users!: Table<any>;
    /** projects stored locally using the Project interface above */
    projects!: Table<Project>;
    zones!: Table<any>;
    households!: Table<any>;
    teams!: Table<any>;
    missions!: Table<any>;
    sync_logs!: Table<SyncLog>;
    app_security!: Table<AppSecurity>;
    syncOutbox!: Table<SyncQueueItem>;
    favorites!: Table<{
        id?: number;
        projectId: string;
        householdId: string;
        createdAt: string;
    }>;

    constructor() {
        super('ProquelecDB');
        this.version(3).stores({
            organizations: 'id, name',
            users: 'id, organizationId, email, role',
            projects: 'id, organizationId, name, status, version',
            zones: 'id, projectId, organizationId, name, version',
            households: 'id, projectId, zoneId, organizationId, status, version',
            teams: 'id, organizationId, name, type, specialty',
            sync_logs: '++id, timestamp, action'
        });
        // Version 4 — table sécurité
        this.version(4).stores({
            organizations: 'id, name',
            users: 'id, organizationId, email, role',
            projects: 'id, organizationId, name, status, version',
            zones: 'id, projectId, organizationId, name, version',
            households: 'id, projectId, zoneId, organizationId, status, version',
            teams: 'id, organizationId, name, type, specialty',
            sync_logs: '++id, timestamp, action',
            app_security: 'key, updatedAt'
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
            teams: 'id, organizationId, name, type, specialty',
            sync_logs: '++id, timestamp, action',
            app_security: 'key, updatedAt'
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
            teams: 'id, organizationId, name, type, specialty',
            sync_logs: '++id, timestamp, action',
            app_security: 'key, updatedAt'
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
            teams: 'id, organizationId, name, type, specialty',
            sync_logs: '++id, timestamp, action',
            app_security: 'key, updatedAt',
            syncOutbox: '++id, status, timestamp'
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
            teams: 'id, organizationId, name, type, specialty',
            sync_logs: '++id, timestamp, action',
            app_security: 'key, updatedAt',
            syncOutbox: '++id, status, timestamp',
            favorites: '++id, projectId, householdId, createdAt'
        });
    }
}

export const db = new ProquelecDatabase();

export const syncData = async (table: string, items: any[]) => {
    return await db.transaction('rw', table, async () => {
        const dbTable = (db as any)[table];
        
        const toDelete = items.filter(item => item.deletedAt).map(item => item.id);
        const toPut = items.filter(item => !item.deletedAt);

        if (toDelete.length > 0) {
            await dbTable.bulkDelete(toDelete);
        }
        
        if (toPut.length > 0) {
            // Use bulkPut to handle both creation and updates efficiently
            await dbTable.bulkPut(toPut);
        }
    });
};
