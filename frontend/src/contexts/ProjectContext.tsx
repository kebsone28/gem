/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import type { Project } from '../utils/types';
import { projectService } from '../services/projectService';
import * as safeStorage from '../utils/safeStorage';
import logger from '../utils/logger';
import { useAuth } from './AuthContext';

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
  syncError: string | null;
  t: (key: string, defaultValue: string) => string;
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
      // 🔑 Ne pas bloquer sur le token localStorage : l'apiClient utilise
      // les cookies HttpOnly et gère le refresh automatiquement.
      // On tente toujours l'appel réseau si l'utilisateur est authentifié.
      const response = await apiClient.get('/projects');
      const data = response?.data || {};
      const serverProjects: Project[] = data.projects || (Array.isArray(data) ? data : []);

      logger.debug(`[PROJECT] Serveur a renvoyé ${serverProjects.length} projet(s)`);

      // Transaction atomique : si bulkPut échoue, clear() est annulé → base jamais vide
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
      // En cas d'erreur réseau, utiliser le cache local sans vider la base
      logger.warn('⚠️ [PROJECT] Sync réseau échouée, utilisation du cache local', err);
      const localProjects = await db.projects.toArray();
      if (localProjects.length > 0) {
        const nextActiveId = preferredProjectId && localProjects.some(p => p.id === preferredProjectId)
          ? preferredProjectId
          : localProjects[0]?.id || null;
        persistActiveProjectId(nextActiveId);
        return localProjects;
      }
      const errorMessage = err?.response?.data?.error || err?.message || 'Erreur de synchronisation des projets';
      setSyncError(errorMessage);
      logger.error('❌ [PROJECT] Erreur lors de la synchronisation des projets', err);
      return [];
    }
  };

  // 🔄 Auto-Sync server-first: synchronise dès que l'utilisateur est authentifié.
  // La vérification du token est supprimée : apiClient gère l'auth via cookies HttpOnly.
  useEffect(() => {
    const fetchInitialProjects = async () => {
      if (!user?.id) {
        lastSyncedUserIdRef.current = null;
        return;
      }
      // Forcer une nouvelle synchro à chaque changement d'utilisateur
      if (lastSyncedUserIdRef.current === user.id) return;

      lastSyncedUserIdRef.current = user.id;
      try {
        logger.debug(`🔄 [PROJECT] Déclenchement sync initiale pour user ${user.id}`);
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

  const createProject = async (data: Partial<Project>) => {
    const serverProject = await projectService.createProject(data);
    await syncProjectsFromServer(serverProject.id);
    return serverProject;
  };

  const updateProject = async (updates: Partial<Project>, id?: string) => {
    const currentId = id || activeProjectId;
    if (currentId) {
      // 1. Optimistic local update
      await db.projects.update(currentId, updates);

      // 2. Attempt to sync with server if token exists
      try {
        if (getStoredAccessToken()) {
          await apiClient.patch(`/projects/${currentId}`, updates);
          await syncProjectsFromServer(currentId);
        }
      } catch (err) {
        logger.warn('⚠️ [PROJECT] Local update only (offline or no token).', err);
      }
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

  const t = (key: string, defaultValue: string): string => {
    if (!activeProject?.config?.labels) return defaultValue;
    const label = activeProject.config.labels[key];
    if (!label) return defaultValue;
    
    // Si c'est un objet (ex: {singular, plural}), on renvoie le pluriel par défaut (pour la Sidebar)
    if (typeof label === 'object' && label.plural) {
      return label.plural;
    }
    
    // Sinon c'est une chaîne simple
    return typeof label === 'string' ? label : defaultValue;
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
