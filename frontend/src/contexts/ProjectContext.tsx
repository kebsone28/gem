/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import type { Project } from '../utils/types';
import apiClient from '../api/client';
import * as safeStorage from '../utils/safeStorage';
import logger from '../utils/logger';

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
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(
    safeStorage.getItem('active_project_id')
  );
  const hasLoadedServerProjects = useRef(false);

  const projects = useLiveQuery(() => db.projects.toArray()) || [];

  const activeProject = useLiveQuery(async () => {
    if (activeProjectId) {
      return await db.projects.get(activeProjectId);
    }
    const all = await db.projects.toArray();
    return all[0] ?? null;
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      const firstId = projects[0].id;
      setActiveProjectIdState(firstId);
      safeStorage.setItem('active_project_id', firstId);
    }
  }, [projects.length, activeProjectId]);

  const syncProjectsFromServer = async (preferredProjectId?: string | null) => {
    const response = await apiClient.get('/projects');
    const serverProjects: Project[] = response.data.projects || response.data || [];

    await db.projects.clear();
    if (serverProjects.length > 0) {
      await db.projects.bulkPut(serverProjects as any[]);
    }

    const nextActiveId =
      preferredProjectId && serverProjects.some((project) => project.id === preferredProjectId)
        ? preferredProjectId
        : activeProjectId && serverProjects.some((project) => project.id === activeProjectId)
          ? activeProjectId
          : serverProjects[0]?.id || null;

    setActiveProjectIdState(nextActiveId);
    if (nextActiveId) {
      safeStorage.setItem('active_project_id', nextActiveId);
    } else {
      safeStorage.removeItem('active_project_id');
    }

    logger.log(`♻️ [STORE] ${serverProjects.length} projets synchronisés depuis le serveur`);
    return serverProjects;
  };

  // 🔄 Auto-Sync server-first: au démarrage connecté, le serveur réaligne toujours le cache local.
  useEffect(() => {
    const fetchInitialProjects = async () => {
      const token = safeStorage.getItem('access_token');
      if (!token || hasLoadedServerProjects.current) return;

      hasLoadedServerProjects.current = true;
      try {
        await syncProjectsFromServer();
      } catch (err) {
        logger.error('❌ Échec de synchronisation initiale des projets', err);
      }
    };
    fetchInitialProjects();
  }, []);

  const setActiveProjectId = (id: string | null) => {
    setActiveProjectIdState(id);
    if (id) {
      safeStorage.setItem('active_project_id', id);
      logger.log(`🎯 [PROJECT] Switched to ${id}`);
    } else {
      safeStorage.removeItem('active_project_id');
      logger.log('🎯 [PROJECT] Active project cleared');
    }
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
