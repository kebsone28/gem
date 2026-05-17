/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import type { Project } from '../utils/types';
import { projectService } from '../services/projectService';
import * as safeStorage from '../utils/safeStorage';
import logger from '../utils/logger';
import { useAuth } from './AuthContext';
import apiClient from '../api/client';

interface ProjectContextType {
  project: Project | null;
  projects: Project[];
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  refreshProjects: (preferredProjectId?: string | null) => Promise<Project[]>;
  createProject: (data: Partial<Project>) => Promise<Project>;
  updateProject: (updates: Partial<Project>, id?: string) => Promise<void>;
  deleteProject: (
    projectId: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  isSyncing: boolean;
  syncError: string | null;
  t: (key: string, defaultValue: string) => string;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  
  const lastSyncedUserIdRef = useRef<string | null>(null);
  const lastSyncedOrgIdRef = useRef<string | null>(null);
  const syncMutexRef = useRef<Promise<Project[]> | null>(null);

  // Refs synchronisées à jour pour éviter tout problème de closure React
  const userRef = useRef(user);
  const activeProjectIdRef = useRef(activeProjectId);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  // Charger le projet actif du tenant dès que l'utilisateur ou l'organisation change
  useEffect(() => {
    if (user?.organizationId) {
      const storedId = safeStorage.getItem(`active_project_${user.organizationId}`);
      setActiveProjectIdState(storedId);
    } else {
      setActiveProjectIdState(null);
    }
  }, [user?.organizationId]);

  // 1. ISOLATION TENANT - CHARGEMENT DES PROJETS UNIQUEMENT DU TENANT ACTIF
  const projects = useLiveQuery(
    () => {
      if (!user?.organizationId) return [];
      return db.projects.where('organizationId').equals(user.organizationId).toArray();
    },
    [user?.organizationId]
  ) || [];

  // 2. ISOLATION TENANT - PROJET ACTIF DU TENANT ACTIF SANS FLICKER
  const activeProject = useLiveQuery(
    async () => {
      if (!user?.organizationId) return null;
      if (activeProjectId) {
        const p = await db.projects.get(activeProjectId);
        if (p && p.organizationId === user.organizationId) {
          return p;
        }
      }
      const all = await db.projects.where('organizationId').equals(user.organizationId).toArray();
      return all[0] ?? null;
    },
    [activeProjectId, user?.organizationId]
  );

  const persistActiveProjectId = (id: string | null) => {
    setActiveProjectIdState(id);
    if (user?.organizationId) {
      const key = `active_project_${user.organizationId}`;
      if (id) {
        safeStorage.setItem(key, id);
      } else {
        safeStorage.removeItem(key);
      }
    }
  };

  // 3. SYNCHRONISATION SYNCHRONE DES PROJETS SANS TIMEOUT
  useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      persistActiveProjectId(projects[0].id);
    }
  }, [projects, activeProjectId]);

  useEffect(() => {
    if (!activeProjectId || projects.length === 0) return;

    if (!projects.some((project) => project.id === activeProjectId)) {
      logger.warn(
        `⚠️ [PROJECT] Active project ${activeProjectId} is stale. Falling back to first valid project.`
      );
      persistActiveProjectId(projects[0]?.id || null);
    }
  }, [projects, activeProjectId]);

  // 4. SYNC ENGINE ROBUSTE AVEC MUTEX (PREVENTS RACE CONDITIONS) & MERGE INTELLIGENT
  const syncProjectsFromServer = async (preferredProjectId?: string | null): Promise<Project[]> => {
    if (syncMutexRef.current) {
      return syncMutexRef.current;
    }

    const syncPromise = (async (): Promise<Project[]> => {
      setSyncError(null);
      setIsSyncing(true);
      try {
        const currentUser = userRef.current;
        if (!currentUser?.organizationId) {
          return [];
        }

        const response = await apiClient.get('/projects');
        const data = response?.data || {};
        const serverProjects: Project[] = data.projects || (Array.isArray(data) ? data : []);

        // Filtrer les projets pour l'organisation de l'utilisateur
        const filteredServerProjects = serverProjects.filter(
          (p) => p.organizationId === currentUser.organizationId
        );

        logger.debug(`[PROJECT] Serveur a renvoyé ${filteredServerProjects.length} projet(s)`);

        // Sécurité bulkDelete : on ne supprime que s'il s'agit d'une synchro complète (fullSync)
        const isFullSync = data.isFullSync !== false;

        // Transaction atomique : MERGE intelligent ciblé par tenant pour préserver le cache local
        await (db as any).transaction('rw', db.projects, async () => {
          const existing = await db.projects
            .where('organizationId')
            .equals(currentUser.organizationId)
            .toArray();

          const serverIds = new Set(filteredServerProjects.map((p) => p.id));
          const toDelete = existing.filter((p) => !serverIds.has(p.id)).map((p) => p.id);

          if (filteredServerProjects.length > 0) {
            await (db.projects as any).bulkPut(filteredServerProjects);
          }

          if (isFullSync && toDelete.length > 0) {
            await db.projects.bulkDelete(toDelete);
          }
        });

        const currentActiveId = activeProjectIdRef.current;
        const nextActiveId =
          preferredProjectId && filteredServerProjects.some((project) => project.id === preferredProjectId)
            ? preferredProjectId
            : currentActiveId && filteredServerProjects.some((project) => project.id === currentActiveId)
              ? currentActiveId
              : filteredServerProjects[0]?.id || null;

        persistActiveProjectId(nextActiveId);

        logger.debug(`♻️ [STORE] ${filteredServerProjects.length} projets synchronisés`);
        return filteredServerProjects;
      } catch (err: any) {
        logger.warn('⚠️ [PROJECT] Sync réseau échouée, utilisation du cache local', err);
        const currentUser = userRef.current;
        if (currentUser?.organizationId) {
          const localProjects = await db.projects
            .where('organizationId')
            .equals(currentUser.organizationId)
            .toArray();

          if (localProjects.length > 0) {
            const nextActiveId =
              preferredProjectId && localProjects.some((p) => p.id === preferredProjectId)
                ? preferredProjectId
                : localProjects[0]?.id || null;
            persistActiveProjectId(nextActiveId);
            return localProjects;
          }
        }
        const errorMessage =
          err?.response?.data?.error || err?.message || 'Erreur de synchronisation';
        setSyncError(errorMessage);
        logger.error('❌ [PROJECT] Erreur lors de la synchronisation des projets', err);
        return [];
      } finally {
        setIsSyncing(false);
      }
    })();

    syncMutexRef.current = syncPromise;

    try {
      return await syncPromise;
    } finally {
      syncMutexRef.current = null;
    }
  };

  // 5. AUTO-SYNC & PURGE CIBLÉE DU TENANT AU LOGOUT (MULTI-TENANT SAFETY)
  useEffect(() => {
    const handleUserSession = async () => {
      if (!user?.id) {
        const prevOrgId = lastSyncedOrgIdRef.current;
        lastSyncedUserIdRef.current = null;
        lastSyncedOrgIdRef.current = null;
        if (prevOrgId) {
          logger.debug(`🧹 [PROJECT] Déconnexion détectée, purge des projets du tenant ${prevOrgId}...`);
          // Purge ciblée uniquement pour la sécurité multi-tenant
          await db.projects.where('organizationId').equals(prevOrgId).delete();
        }
        persistActiveProjectId(null);
        return;
      }

      if (lastSyncedUserIdRef.current === user.id && lastSyncedOrgIdRef.current === user.organizationId) return;
      lastSyncedUserIdRef.current = user.id;
      lastSyncedOrgIdRef.current = user.organizationId || null;

      try {
        logger.debug(`🔄 [PROJECT] Déclenchement sync initiale pour user ${user.id}`);
        await syncProjectsFromServer();
      } catch (err) {
        logger.error('❌ Échec de synchronisation initiale des projets', err);
        lastSyncedUserIdRef.current = null;
        lastSyncedOrgIdRef.current = null;
      }
    };

    void handleUserSession();
  }, [user?.id, user?.organizationId]);

  const setActiveProjectId = (id: string | null) => {
    persistActiveProjectId(id);
    logger.debug(id ? `🎯 [PROJECT] Switched to ${id}` : '🎯 [PROJECT] Active project cleared');
  };

  const createProject = async (data: Partial<Project>) => {
    const serverProject = await projectService.createProject(data);
    await syncProjectsFromServer(serverProject.id);
    return serverProject;
  };

  // 6. UPDATE AVEC ROLLBACK ET SÉCURITÉ TENANT DE BOUT EN BOUT
  const updateProject = async (updates: Partial<Project>, id?: string) => {
    const currentId = id || activeProjectId;
    if (!currentId) return;

    // Sauvegarde pour rollback en cas d'échec
    const oldProject = await db.projects.get(currentId);
    if (!oldProject) return;

    // Protection de sécurité tenant stricte
    if (oldProject.organizationId !== user?.organizationId) {
      logger.error('❌ [SECURITY-VIOLATION] Tentative de modification hors tenant bloquée.');
      throw new Error('Non autorisé');
    }

    try {
      // Étape 1 : Mise à jour optimiste dans Dexie
      await db.projects.update(currentId, updates);

      // Étape 2 : Envoi au serveur
      if (user?.id) {
        await apiClient.patch(`/projects/${currentId}`, updates);
        await syncProjectsFromServer(currentId);
      }
    } catch (err) {
      logger.warn('⚠️ [PROJECT] Échec de la mise à jour serveur, rollback local...', err);
      // Étape 3 : Rollback local
      await db.projects.put(oldProject);
      throw err;
    }
  };

  const deleteProject = async (projectId: string, password: string) => {
    try {
      const existing = await db.projects.get(projectId);
      if (!existing || existing.organizationId !== user?.organizationId) {
        return { success: false, error: 'Non autorisé' };
      }

      await apiClient.delete(`/projects/${projectId}`, { data: { password } });
      await db.projects.delete(projectId); // Optimistic local deletion
      const fallbackProjectId = activeProjectId === projectId ? null : activeProjectId;
      await syncProjectsFromServer(fallbackProjectId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.response?.data?.error || 'Erreur lors de la suppression' };
    }
  };

  const t = (key: string, defaultValue: string): string => {
    if (!activeProject?.config?.labels) return defaultValue;
    const label = activeProject.config.labels[key];
    if (!label) return defaultValue;

    if (typeof label === 'object' && label.plural) {
      return label.plural;
    }

    return typeof label === 'string' ? label : defaultValue;
  };

  return (
    <ProjectContext.Provider
      value={{
        project: activeProject === undefined ? null : activeProject,
        projects,
        activeProjectId,
        setActiveProjectId,
        refreshProjects: syncProjectsFromServer,
        createProject,
        updateProject,
        deleteProject,
        isLoading: activeProject === undefined || (projects.length === 0 && isSyncing),
        isSyncing,
        syncError,
        t,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
