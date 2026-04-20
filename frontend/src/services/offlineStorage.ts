/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import Dexie from 'dexie';
import type { Table } from 'dexie';

export interface LocalHousehold {
  id: string;
  grappeId?: string | null;
  zoneId?: string | null;
  region?: string | null;
  village?: string | null;
  status: string;
  location: { lat: number; lng: number };
  data: Record<string, unknown>; // Complete JSON payload
  synced: boolean;
}

export class GemOfflineDB extends Dexie {
  households!: Table<LocalHousehold, string>;

  constructor() {
    super('GemOfflineStorage');
    // Define indices for quick querying during offline routing/clustering
    this.version(1).stores({
      households: 'id, grappeId, zoneId, region, status, synced',
    });
  }
}

export const offlineDB = new GemOfflineDB();

/**
 * Sync server-side households into the resilient offline IndexedDB.
 */
export const cacheHouseholdsForOffline = async (householdsArray: Record<string, unknown>[]) => {
  try {
    const records: LocalHousehold[] = householdsArray.map((h) => ({
      id: String(h.id || h.household_id),
      grappeId: h.grappeId,
      zoneId: h.zoneId,
      region: h.region || h.data?.region,
      village: h.village || h.data?.village,
      status: h.status,
      location: h.location,
      data: h,
      synced: true, // As it just came from the server
    }));

    // Bulk put updates existing IDs and adds new ones seamlessly
    await offlineDB.households.bulkPut(records);
    console.log(
      `[PWA-OFFLINE] Successfully fully cached ${records.length} households in IndexedDB.`
    );
    return true;
  } catch (error) {
    console.error('[PWA-OFFLINE] Cache failure:', error);
    return false;
  }
};

/**
 * Retrieve all valid households from local IndexedDB when the network is dead.
 */
export const getOfflineHouseholds = async (): Promise<Record<string, unknown>[]> => {
  const raw = await offlineDB.households.toArray();
  return raw.map((r) => r.data);
};
