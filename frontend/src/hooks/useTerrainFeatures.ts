import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ADMIN_ONLY_TERRAIN_FEATURES,
  DEFAULT_TERRAIN_FEATURES,
  type TerrainFeatureConfig,
  type TerrainFeatureKey,
} from '../constants/terrainFeatures';
import { usePermissions } from './usePermissions';

export const useTerrainFeatures = () => {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();

  return useMemo(() => {
    const configured = ((user?.organizationConfig as { terrainFeatures?: TerrainFeatureConfig } | undefined)
      ?.terrainFeatures || {}) as TerrainFeatureConfig;
    const resolved = { ...DEFAULT_TERRAIN_FEATURES };

    (Object.keys(DEFAULT_TERRAIN_FEATURES) as TerrainFeatureKey[]).forEach((key) => {
      const configuredValue = configured[key];
      if (typeof configuredValue === 'boolean') {
        resolved[key] = configuredValue;
      }
    });

    ADMIN_ONLY_TERRAIN_FEATURES.forEach((key) => {
      resolved[key] = isAdmin ? true : !!resolved[key];
      if (!isAdmin) {
        resolved[key] = !!configured[key];
      }
    });

    if (!isAdmin) {
      resolved.householdAdminEdit = false;
      resolved.bulkConformingLocks = false;
      resolved.analytics = !!configured.analytics;
      resolved.heatmap = !!configured.heatmap;
      resolved.lasso = !!configured.lasso;
      resolved.measure = !!configured.measure;
      resolved.drawZones = !!configured.drawZones;
      resolved.grappeTools = !!configured.grappeTools;
      resolved.regionDownload = !!configured.regionDownload;
      resolved.dataHub = !!configured.dataHub;
    }

    return resolved;
  }, [user?.organizationConfig, isAdmin]);
};
