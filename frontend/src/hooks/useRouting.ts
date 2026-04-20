/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useCallback } from 'react';
import { useTerrainUIStore } from '../store/terrainUIStore';

/**
 * Hook to manage map routing state and common actions.
 */
export const useRouting = () => {
  //@ts-ignore
  const routingEnabled = useTerrainUIStore((s) => s.routingEnabled);
  //@ts-ignore
  const setRoutingEnabled = useTerrainUIStore((s) => s.setRoutingEnabled);
  const setRoutingStart = useTerrainUIStore((s) => s.setRoutingStart);
  const setRoutingDest = useTerrainUIStore((s) => s.setRoutingDest);
  const setRouteStats = useTerrainUIStore((s) => s.setRouteStats);
  const setInstructions = useTerrainUIStore((s) => s.setInstructions);
  //@ts-ignore
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
