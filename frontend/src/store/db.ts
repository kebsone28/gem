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

export class ProquelecDatabase extends Dexie {
    organizations!: Table<{ id: string; name: string }>;
    users!: Table<{ id: string; organizationId: string; email: string; role: string }>;
    projects!: Table<any>;
    zones!: Table<any>;
    households!: Table<any>;
    teams!: Table<any>;
    sync_logs!: Table<SyncLog>;

    constructor() {
        super('ProquelecDB');
        this.version(2).stores({
            organizations: 'id, name',
            users: 'id, organizationId, email, role',
            projects: 'id, organizationId, name, status, version',
            zones: 'id, projectId, organizationId, name, version',
            households: 'id, zoneId, organizationId, status, version',
            teams: 'id, organizationId, name, type, specialty',
            sync_logs: '++id, timestamp, action'
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
                await dbTable.put(item);
            }
        }
    });
};
