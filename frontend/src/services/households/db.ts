import Dexie from 'dexie';

export interface HouseholdEntry {
  id: string;
  geometry: GeoJSON.Geometry | null;
  properties: Record<string, any>;
  last_modified: number;
}

class HouseholdDB extends Dexie {
  households!: Dexie.Table<HouseholdEntry, string>;

  constructor() {
    super('gem_household_db');
    this.version(1).stores({ households: '&id,last_modified' });
  }
}

export const householdDb = new HouseholdDB();
