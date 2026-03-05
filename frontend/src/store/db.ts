import Dexie, { type Table } from 'dexie';

export interface Project {
    id: string;
    organizationId: string;
    name: string;
    status: string;
    version: number;
    deletedAt?: Date | null;
}

export interface Household {
    id: string;
    zoneId: string;
    organizationId: string;
    status: string;
    version: number;
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
    projects!: Table<any>;
    zones!: Table<any>;
    households!: Table<any>;
    teams!: Table<any>;
    missions!: Table<any>;
    sync_logs!: Table<SyncLog>;
    app_security!: Table<AppSecurity>;
    syncOutbox!: Table<SyncQueueItem>;

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
    }
}

export const db = new ProquelecDatabase();

export const syncData = async (table: string, items: any[]) => {
    return await db.transaction('rw', table, async () => {
        const dbTable = (db as any)[table];
        for (const item of items) {
            if (item.deletedAt) {
                await dbTable.delete(item.id);
            } else {
                const existing = await dbTable.get(item.id);
                if (existing) {
                    await dbTable.update(item.id, { ...existing, ...item });
                } else {
                    await dbTable.put(item);
                }
            }
        }
    });
};
