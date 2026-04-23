import { useCallback } from 'react';
import { useTerrainUIStore } from '../store/terrainUIStore';

/**
 * Hook to manage map routing state and common actions.
 */
export const useRouting = () => {
  // @ts-expect-error - selector typing
  const routingEnabled = useTerrainUIStore((s) => s.routingEnabled);
  // @ts-expect-error - selector typing
  const setRoutingEnabled = useTerrainUIStore((s) => s.setRoutingEnabled);
  const setRoutingStart = useTerrainUIStore((s) => s.setRoutingStart);
  const setRoutingDest = useTerrainUIStore((s) => s.setRoutingDest);
  const setRouteStats = useTerrainUIStore((s) => s.setRouteStats);
  const setInstructions = useTerrainUIStore((s) => s.setInstructions);
  // @ts-expect-error - selector typing
  const setFollowUser = useTerrainUIStore((s) => s.setFollowUser);
  const routeStats = useTerrainUIStore((s) => s.routeStats);
  const turnByTurnInstructions = useTerrainUIStore((s) => s.turnByTurnInstructions);

  const cancelRouting = useCallback(() => {
    useTerrainUIStore.getState().closePanel();
    setRoutingDest(null);
    setRouteStats(null);
    setInstructions([]);
    setFollowUser(false);
  }, [setRoutingDest, setRouteStats, setInstructions, setFollowUser]);

  return {
    routingEnabled,
    setRoutingEnabled,
    setRoutingStart,
    setRoutingDest,
    setRouteStats,
    routeStats,
    turnByTurnInstructions,
    setInstructions,
    setFollowUser,
    cancelRouting,
  };
};
