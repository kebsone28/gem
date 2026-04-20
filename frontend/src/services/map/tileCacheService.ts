/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import maplibregl from 'maplibre-gl';
import { db } from '../../store/db';
import logger from '../../utils/logger';

const TTL = 1000 * 60 * 60 * 24 * 30; // 30 jours de cache
const MAX_TILES = 10000; // Limite arbitraire pour éviter d'exploser IndexedDB

let isProtocolRegistered = false;

export const registerTileCacheProtocol = () => {
  if (isProtocolRegistered) return;
  isProtocolRegistered = true;

  maplibregl.addProtocol(
    'cached',
    (params: { url: string }, abortController: { abort: () => void }) => {
      const url = params.url.replace('cached://', '');

      // Extraction approximative du zoom depuis l'url (souvent /{z}/{x}/{y}.png)
      const match = url.match(/\/(\d+)\/\d+\/\d+\.(png|jpeg|jpg)/);
      const zoom = match ? parseInt(match[1], 10) : 0;

      return new Promise((resolve, reject) => {
        const fetchAndCache = async () => {
          try {
            // Try getting from IndexedDB
            const cachedTile = await db.map_tiles.get(url);

            if (cachedTile) {
              // Check TTL
              if (Date.now() - cachedTile.timestamp < TTL) {
                resolve({ data: await cachedTile.blob.arrayBuffer() });
                return;
              } else {
                // Expired, delete
                await db.map_tiles.delete(url);
              }
            }

            // Not cached or expired, fetch from network
            const response = await fetch(url, { signal: abortController.signal });

            if (!response.ok) {
              throw new Error(`Tile fetch failed: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();

            // Asynchronously save to Dexie to avoid blocking render
            (async () => {
              try {
                const count = await db.map_tiles.count();
                if (count >= MAX_TILES) {
                  // Delete oldest tiles if limit reached
                  const oldest = await db.map_tiles.orderBy('timestamp').limit(500).primaryKeys();
                  await db.map_tiles.bulkDelete(oldest as string[]);
                }

                await db.map_tiles.put({
                  url,
                  blob,
                  timestamp: Date.now(),
                  zoom,
                });
              } catch (err) {
                logger.error('Failed to cache map tile', err);
              }
            })();

            resolve({ data: await blob.arrayBuffer() });
          } catch (error: unknown) {
            const err = error as { name?: string; message?: string };
            if (err.name === 'AbortError') {
              reject(new Error('Canceled by MapLibre'));
            } else {
              reject(error);
            }
          }
        };
        fetchAndCache();
      });
    }
  );
};
