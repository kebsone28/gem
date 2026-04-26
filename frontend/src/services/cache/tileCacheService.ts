import maplibregl from 'maplibre-gl';
import { db } from './db';

const TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function registerTileCacheProtocol() {
  try {
    (maplibregl as any).addProtocol('cached', (params: { url: string }, callback: any) => {
      const url = params.url.replace('cached://', '');
      db.map_tiles
        .get(url)
        .then((entry) => {
          if (entry && Date.now() - entry.ts < TTL) {
            const blob = new Blob([entry.blob as BlobPart]);
            callback(null, blob, null);
            return;
          }
          fetch(url)
            .then(async (res) => {
              if (!res.ok) return callback(new Error('fetch failed'), null, null);
              const buffer = await res.arrayBuffer();
              db.map_tiles.put({ url, blob: new Uint8Array(buffer), ts: Date.now() }).catch(() => {});
              const blob = new Blob([buffer]);
              callback(null, blob, null);
            })
            .catch((err) => callback(err as Error, null, null));
        })
        .catch((err) => callback(err as Error, null, null));
      return { cancel: () => {} };
    });
  } catch (e) {
    console.warn('addProtocol not available', e);
  }
}
