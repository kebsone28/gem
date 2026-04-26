import Dexie from 'dexie';

export interface TileEntry {
  url: string;
  blob: Uint8Array;
  ts: number;
}

export class MapDB extends Dexie {
  map_tiles!: Dexie.Table<TileEntry, string>;

  constructor() {
    super('gem_map_db');
    this.version(1).stores({ map_tiles: '&url,ts' });
  }
}

export const db = new MapDB();
