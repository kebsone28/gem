
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
  setActiveProjectId: (id: string) => void;
  createProject: (name: string) => Promise<Project>;
  updateProject: (updates: Partial<Project>, id?: string) => Promise<void>;
  deleteProject: (projectId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(
    safeStorage.getItem('active_project_id')
  );

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

  const setActiveProjectId = (id: string) => {
    setActiveProjectIdState(id);
    safeStorage.setItem('active_project_id', id);
    logger.log(`🎯 [PROJECT] Switched to ${id}`);
  };

  const createProject = async (name: string) => {
    const response = await apiClient.post('/projects', { name, status: 'active', config: {} });
    const serverProject = response.data;
    await db.projects.put(serverProject);
    setActiveProjectId(serverProject.id);
    return serverProject;
  };

  const updateProject = async (updates: Partial<Project>, id?: string) => {
    const currentId = id || activeProjectId;
    if (currentId) {
      //@ts-ignore
    await db.projects.update(currentId, updates);
      await apiClient.patch(`/projects/${currentId}`, updates);
    }
  };

  const deleteProject = async (projectId: string, password: string) => {
    try {
      await apiClient.delete(`/projects/${projectId}`, { data: { password } });
      await db.projects.delete(projectId);
      if (activeProjectId === projectId) {
        const remaining = await db.projects.toArray();
        setActiveProjectId(remaining[0]?.id || null);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.response?.data?.error || 'Erreur' };
    }
  };

  return (
    <ProjectContext.Provider value={{
      project: activeProject || null,
      projects,
      activeProjectId,
      setActiveProjectId,
      createProject,
      updateProject,
      deleteProject,
      isLoading: activeProject === undefined
    }}>
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
