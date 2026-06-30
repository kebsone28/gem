import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { useProject } from '@contexts/ProjectContext';
import { useTeams } from '@hooks/useTeams';
import * as safeStorage from '@utils/safeStorage';
import type { TaskLibrary, CahierTask } from '@utils/types';
import {
  DEFAULT_CONTRACT_TEMPLATES,
  type ContractTemplateLibrary,
} from '@/data/contractTemplates';
import {
  DEFAULT_OPERATIONAL_STRATEGY,
  type OperationalStrategyTemplate,
} from '@/data/operationalStrategyTemplates';
import { DEFAULT_TASK_LIBRARY, ROLE_TO_TRADE_MAPPING } from '@/data/cahierTaskLibrary';
import logger from '@utils/logger';
import {
  mergeContractLibraryWithDefaults,
  restoreTaskLibraryIcons,
  serializeTaskLibrary,
  sanitizeTaskLibraryForCahier,
} from '../utils/cahierUtils';

const getDefaultTechnicalLibrary = (): TaskLibrary =>
  sanitizeTaskLibraryForCahier(DEFAULT_TASK_LIBRARY);

const getDefaultContractLibrary = (): ContractTemplateLibrary =>
  mergeContractLibraryWithDefaults(DEFAULT_CONTRACT_TEMPLATES);

const getDefaultOperationalStrategy = (): OperationalStrategyTemplate =>
  DEFAULT_OPERATIONAL_STRATEGY;

const loadBaseTechnicalLibrary = (): TaskLibrary => {
  try {
    const saved = safeStorage.getItem('ged_os_cahier_library');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.['Électricien']) {
        return restoreTaskLibraryIcons(parsed);
      }
    }
  } catch (e) {
    logger.warn('[useCahierState] Base library load failed', e);
  }
  return getDefaultTechnicalLibrary();
};

const loadBaseContractLibrary = (): ContractTemplateLibrary => {
  try {
    const saved = safeStorage.getItem('ged_os_contract_library');
    if (saved) {
      const parsed = JSON.parse(saved) as ContractTemplateLibrary;
      if (parsed?.['LOT A']) {
        return mergeContractLibraryWithDefaults(parsed);
      }
    }
  } catch (e) {
    logger.warn('[useCahierState] Base contract load failed', e);
  }
  return getDefaultContractLibrary();
};

const loadBaseOperationalStrategy = (): OperationalStrategyTemplate => {
  try {
    const saved = safeStorage.getItem('ged_os_operational_strategy');
    if (saved) {
      const parsed = JSON.parse(saved) as OperationalStrategyTemplate;
      if (Array.isArray(parsed?.content) && parsed.content.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    logger.warn('[useCahierState] Base strategy load failed', e);
  }
  return getDefaultOperationalStrategy();
};

export function useCahierState(projectId: string | undefined, isAdmin: boolean) {
  const { user } = useAuth();
  const { project, updateProject } = useProject();
  const { teams: allTeams, fetchTeams } = useTeams(projectId);
  const migratedProjectRef = useRef<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  // 1. Technical Library
  const [customLibrary, setCustomLibrary] = useState<TaskLibrary>(() => {
    if (!projectId || !project?.id) {
      return loadBaseTechnicalLibrary();
    }
    try {
      const serverLibrary = (project?.config as any)?.cahierLibrary;
      if (serverLibrary?.['Électricien']) {
        return restoreTaskLibraryIcons(serverLibrary);
      }
      const localSaved = safeStorage.getItem('ged_os_cahier_library');
      if (localSaved) {
        const parsed = JSON.parse(localSaved);
        if (parsed['Électricien']) return restoreTaskLibraryIcons(parsed);
      }
    } catch (e) {
      logger.warn('[useCahierState] Library load failed', e);
    }
    return getDefaultTechnicalLibrary();
  });

  // 2. Contract Library
  const [contractLibrary, setContractLibrary] = useState<ContractTemplateLibrary>(() => {
    if (!projectId || !project?.id) {
      return loadBaseContractLibrary();
    }
    try {
      const serverLibrary = (project?.config as any)?.contractLibrary as ContractTemplateLibrary;
      if (serverLibrary?.['LOT A']) return mergeContractLibraryWithDefaults(serverLibrary);
      const saved = safeStorage.getItem('ged_os_contract_library');
      if (saved) {
        const parsed = JSON.parse(saved) as ContractTemplateLibrary;
        if (parsed['LOT A']) return mergeContractLibraryWithDefaults(parsed);
      }
    } catch (e) {
      logger.warn('[useCahierState] Contract load failed', e);
    }
    return getDefaultContractLibrary();
  });

  // 3. Operational Strategy
  const [operationalStrategy, setOperationalStrategy] = useState<OperationalStrategyTemplate>(
    () => {
      if (!projectId || !project?.id) {
        return loadBaseOperationalStrategy();
      }
      try {
        const serverStrategy = (project?.config as any)
          ?.operationalStrategy as OperationalStrategyTemplate;
        if (Array.isArray(serverStrategy?.content) && serverStrategy.content.length > 0) {
          return serverStrategy;
        }
        const saved = safeStorage.getItem('ged_os_operational_strategy');
        if (saved) {
          const parsed = JSON.parse(saved) as OperationalStrategyTemplate;
          if (Array.isArray(parsed.content) && parsed.content.length > 0) return parsed;
        }
      } catch (e) {
        logger.warn('[useCahierState] Strategy load failed', e);
      }
      return getDefaultOperationalStrategy();
    }
  );

  // Persist logic
  const persistCahierConfig = useCallback(
    async (updates: Record<string, unknown>, successMessage?: string): Promise<boolean> => {
      if (!project || !isAdmin) return false;
      try {
        setIsSaving(true);
        await updateProject({
          config: {
            ...(project.config as any),
            ...updates,
            cahierServerSyncedAt: new Date().toISOString(),
            cahierServerSyncedBy: user?.email || user?.name || user?.role || 'admin',
          } as any,
        });
        if (successMessage) alert(successMessage);
        return true;
      } catch (error) {
        logger.error('[useCahierState] Save failed', error);
        alert('Erreur pendant la sauvegarde serveur.');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [isAdmin, project, updateProject, user]
  );

  // Automated Rate calculation
  const getAutomatedRate = useCallback((role: string) => {
    if (!project?.config?.costs?.staffRates) return null;
    const tradeKey = ROLE_TO_TRADE_MAPPING[role];
    if (!tradeKey) return null;

    const staffRates = project.config.costs.staffRates;
    for (const regionId in staffRates) {
      const regionRates = staffRates[regionId] as unknown as Record<
        string,
        { amount: number; mode: 'daily' | 'monthly' | 'task' }
      >;
      if (!regionRates || typeof regionRates !== 'object') continue;

      for (const teamId in regionRates) {
        const team = (allTeams || []).find((t) => t.id === teamId);
        if (team?.tradeKey === tradeKey) {
          const rate = regionRates[teamId];
          if (rate) return rate.amount || null;
        }
      }
    }
    return null;
  }, [allTeams, project?.config?.costs?.staffRates]);

  useEffect(() => {
    if (!projectId) return;
    void fetchTeams();
  }, [fetchTeams, projectId]);

  // Sync from project config changes
  useEffect(() => {
    if (!project?.id) {
      setCustomLibrary(loadBaseTechnicalLibrary());
      setContractLibrary(loadBaseContractLibrary());
      setOperationalStrategy(loadBaseOperationalStrategy());
      return;
    }
    const config = project.config as any;
    if (config?.cahierLibrary?.['Électricien']) {
      setCustomLibrary(restoreTaskLibraryIcons(config.cahierLibrary));
    }
    if (config?.contractLibrary?.['LOT A']) {
      setContractLibrary(mergeContractLibraryWithDefaults(config.contractLibrary));
    }
    if (Array.isArray(config?.operationalStrategy?.content)) {
      setOperationalStrategy(config.operationalStrategy);
    }
  }, [project?.id, project?.config]);

  // Migration logic
  useEffect(() => {
    if (!project?.id || !isAdmin) return;
    if (migratedProjectRef.current === project.id) return;

    const config = project.config as any;
    const hasServerCahier = Boolean(config?.cahierLibrary?.['Électricien']);
    const hasServerContracts = Boolean(config?.contractLibrary?.['LOT A']);
    const hasServerStrategy = Boolean(config?.operationalStrategy?.content?.length);

    if (hasServerCahier && hasServerContracts && hasServerStrategy) {
      migratedProjectRef.current = project.id;
      return;
    }

    const updates: Record<string, unknown> = {};
    try {
      if (!hasServerCahier) {
        const local = safeStorage.getItem('ged_os_cahier_library');
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed?.['Électricien']) {
            const hydrated = restoreTaskLibraryIcons(parsed);
            setCustomLibrary(hydrated);
            updates.cahierLibrary = serializeTaskLibrary(hydrated);
          }
        } else updates.cahierLibrary = serializeTaskLibrary(DEFAULT_TASK_LIBRARY);
      }
      if (!hasServerContracts) {
        const local = safeStorage.getItem('ged_os_contract_library');
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed?.['LOT A']) {
            const merged = mergeContractLibraryWithDefaults(parsed);
            setContractLibrary(merged);
            updates.contractLibrary = merged;
          }
        } else updates.contractLibrary = DEFAULT_CONTRACT_TEMPLATES;
      }
      if (!hasServerStrategy) {
        const local = safeStorage.getItem('ged_os_operational_strategy');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed?.content)) {
            setOperationalStrategy(parsed);
            updates.operationalStrategy = parsed;
          }
        } else updates.operationalStrategy = DEFAULT_OPERATIONAL_STRATEGY;
      }
    } catch (e) {
      logger.warn('[useCahierState] Migration failed', e);
    }

    if (Object.keys(updates).length > 0) {
      migratedProjectRef.current = project.id;
      void persistCahierConfig(updates).then(saved => {
        if (!saved) migratedProjectRef.current = null;
      });
    }
  }, [isAdmin, persistCahierConfig, project?.id, project?.config]);

  return {
    customLibrary,
    setCustomLibrary,
    contractLibrary,
    setContractLibrary,
    operationalStrategy,
    setOperationalStrategy,
    persistCahierConfig,
    getAutomatedRate,
    isSaving,
  };
}
