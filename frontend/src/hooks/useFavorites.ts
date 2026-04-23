/* eslint-disable @typescript-eslint/no-explicit-any */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import { useCallback } from 'react';

export function useFavorites(projectId: string | undefined) {
  const favorites = useLiveQuery(async () => {
    if (!projectId) return [];
    return await db.favorites.where('projectId').equals(projectId).toArray();
  }, [projectId]);

  const isFavorite = useCallback(
    (householdId: string) => {
      return favorites?.some((f: any) => f.householdId === householdId) || false;
    },
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (householdId: string) => {
      if (!projectId) return;

      const existing = await db.favorites.where({ projectId, householdId }).first();

      if (existing) {
        await db.favorites.delete(existing.id);
      } else {
        await db.favorites.add({
          projectId,
          householdId,
          createdAt: new Date().toISOString(),
        });
      }
    },
    [projectId]
  );

  return {
    favorites,
    isFavorite,
    toggleFavorite,
  };
}
