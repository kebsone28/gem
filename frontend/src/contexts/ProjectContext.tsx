/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import type { Project } from '../utils/types';
import apiClient from '../api/client';
import * as safeStorage from '../utils/safeStorage';
import logger from '../utils/logger';
import { useAuth } from './AuthContext';

interface ProjectContextType {
  project: Project | null;
  projects: Project[];
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  refreshProjects: (preferredProjectId?: string | null) => Promise<Project[]>;
  createProject: (name: string) => Promise<Project>;
  updateProject: (updates: Partial<Project>, id?: string) => Promise<void>;
  deleteProject: (
    projectId: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  syncError: string | null;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const getStoredAccessToken = () => {
  const token = safeStorage.getItem('access_token');
  if (!token || token === 'undefined' || token === 'null') {
    return null;
  }
  return token;
};

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(
    safeStorage.getItem('active_project_id')
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const lastSyncedUserIdRef = useRef<string | null>(null);

  const projects = useLiveQuery(() => db.projects.toArray()) || [];

  const activeProject = useLiveQuery(async () => {
    if (activeProjectId) {
      return (await db.projects.get(activeProjectId)) ?? null;
    }
    const all = await db.projects.toArray();
    return all[0] ?? null;
  }, [activeProjectId]);

  const persistActiveProjectId = (id: string | null) => {
    setActiveProjectIdState(id);
    if (id) {
      safeStorage.setItem('active_project_id', id);
    } else {
      safeStorage.removeItem('active_project_id');
    }
  };

  useEffect(() => {
    let t: number | null = null;
    if (!activeProjectId && projects.length > 0) {
      t = window.setTimeout(() => {
        const firstId = projects[0].id;
        persistActiveProjectId(firstId);
      }, 0);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [projects.length, activeProjectId]);

  useEffect(() => {
    if (!activeProjectId || projects.length === 0) return;

    if (!projects.some((project) => project.id === activeProjectId)) {
      logger.warn(
        `⚠️ [PROJECT] Active project ${activeProjectId} is stale. Falling back to the first valid project.`
      );
      const timeoutId = window.setTimeout(() => {
        persistActiveProjectId(projects[0]?.id || null);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [projects, activeProjectId]);

  const syncProjectsFromServer = async (preferredProjectId?: string | null) => {
    setSyncError(null);
    try {
      if (!getStoredAccessToken()) {
        logger.warn('⚠️ [PROJECT] Synchronisation serveur ignorée: aucun token disponible.');
        const localProjects = await db.projects.toArray();
        const nextActiveId =
          preferredProjectId && localProjects.some((project) => project.id === preferredProjectId)
            ? preferredProjectId
            : activeProjectId && localProjects.some((project) => project.id === activeProjectId)
              ? activeProjectId
              : localProjects[0]?.id || null;

        persistActiveProjectId(nextActiveId);
        return localProjects;
      }

      const response = await apiClient.get('/projects');
      const serverProjects: Project[] = response.data.projects || response.data || [];

      // Transaction atomique : si bulkPut échoue, clear() est annulé → base jamais vide
      // Cast `db` en `any` pour éviter l'inférence sur Team.children (référence circulaire TS)
      await (db as any).transaction('rw', db.projects, async () => {
        await db.projects.clear();
        if (serverProjects.length > 0) {
          await (db.projects as any).bulkPut(serverProjects);
        }
      });

      const nextActiveId =
        preferredProjectId && serverProjects.some((project) => project.id === preferredProjectId)
          ? preferredProjectId
          : activeProjectId && serverProjects.some((project) => project.id === activeProjectId)
            ? activeProjectId
            : serverProjects[0]?.id || null;

      persistActiveProjectId(nextActiveId);

      logger.debug(`♻️ [STORE] ${serverProjects.length} projets synchronisés depuis le serveur`);
      return serverProjects;
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.error || err?.message || 'Erreur de synchronisation des projets';
      setSyncError(errorMessage);
      logger.error('❌ [PROJECT] Erreur lors de la synchronisation des projets', err);
      throw err;
    }
  };

  // 🔄 Auto-Sync server-first: à chaque nouvelle session, le serveur réaligne le cache local.
  useEffect(() => {
    const fetchInitialProjects = async () => {
      if (!user?.id || !getStoredAccessToken()) {
        lastSyncedUserIdRef.current = null;
        return;
      }
      if (lastSyncedUserIdRef.current === user.id) return;

      lastSyncedUserIdRef.current = user.id;
      try {
        await syncProjectsFromServer();
      } catch (err) {
        logger.error('❌ Échec de synchronisation initiale des projets', err);
        lastSyncedUserIdRef.current = null;
      }
    };
    void fetchInitialProjects();
  }, [user?.id]);

  const setActiveProjectId = (id: string | null) => {
    persistActiveProjectId(id);
    logger.debug(id ? `🎯 [PROJECT] Switched to ${id}` : '🎯 [PROJECT] Active project cleared');
  };

  const createProject = async (name: string) => {
    const response = await apiClient.post('/projects', { name, status: 'active', config: {} });
    const serverProject = response.data;
    await syncProjectsFromServer(serverProject.id);
    return serverProject;
  };

  const updateProject = async (updates: Partial<Project>, id?: string) => {
    const currentId = id || activeProjectId;
    if (currentId) {
      await apiClient.patch(`/projects/${currentId}`, updates);
      await syncProjectsFromServer(currentId);
    }
  };

  const deleteProject = async (projectId: string, password: string) => {
    try {
      await apiClient.delete(`/projects/${projectId}`, { data: { password } });
      const fallbackProjectId = activeProjectId === projectId ? null : activeProjectId;
      await syncProjectsFromServer(fallbackProjectId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.response?.data?.error || 'Erreur' };
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        project: activeProject || null,
        projects,
        activeProjectId,
        setActiveProjectId,
        refreshProjects: syncProjectsFromServer,
        createProject,
        updateProject,
        deleteProject,
        isLoading: activeProject === undefined,
        syncError,
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
