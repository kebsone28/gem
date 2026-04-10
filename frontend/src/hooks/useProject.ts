import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import type { Project } from '../utils/types';
import apiClient from '../api/client';

import { useState, useEffect, useRef } from 'react';
import * as safeStorage from '../utils/safeStorage';
import logger from '../utils/logger';

export function useProject() {
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(
    safeStorage.getItem('active_project_id')
  );
  const healingRan = useRef(false);

  const projects = useLiveQuery(() => db.projects.toArray()) || [];

  const activeProject = useLiveQuery(async () => {
    if (activeProjectId) {
      return await db.projects.get(activeProjectId);
    }
    // No active project ID saved: return first project
    return (await db.projects.toArray())[0] ?? null;
  }, [activeProjectId]); // ✅ Only primitive dep — no loop

  useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      const id = projects[0].id;
      setActiveProjectIdState(id);
      safeStorage.setItem('active_project_id', id);
    }
  }, [projects.length, activeProjectId]); // ✅ Use .length (number) not the array ref

  useEffect(() => {
    if (!activeProjectId || projects.length === 0) return;
    const found = projects.some((project) => project.id === activeProjectId);
    if (found) return;

    const id = projects[0].id;
    setActiveProjectIdState(id);
    safeStorage.setItem('active_project_id', id);
    logger.log(`🔄 [PROJECT] Active project ID ${activeProjectId} was stale; switched to ${id}`);
  }, [projects.length, activeProjectId, projects]);

  // ── AUTO-HEALING: Detect orphan local project IDs (proj_xxx) and sync from server ──
  useEffect(() => {
    if (healingRan.current || !activeProjectId) return;
    // Only heal IDs that look like local temp IDs
    if (!activeProjectId.startsWith('proj_')) return;
    healingRan.current = true;

    (async () => {
      try {
        logger.log('🔄 [PROJECT] Detected local-only project ID, syncing from server...');
        const response = await apiClient.get('/projects');
        const serverProjects = response.data?.projects || [];

        if (serverProjects.length > 0) {
          // Replace local Dexie projects with server ones
          await db.projects.clear();
          for (const sp of serverProjects) {
            await db.projects.put(sp);
          }
          // Switch active project to the first server project
          const newId = serverProjects[0].id;
          setActiveProjectIdState(newId);
          safeStorage.setItem('active_project_id', newId);
          logger.log(`✅ [PROJECT] Healed: switched from ${activeProjectId} → ${newId}`);
        }
      } catch (err) {
        logger.warn('⚠️ [PROJECT] Auto-healing failed, will retry next load', err);
        healingRan.current = false; // Allow retry
      }
    })();
  }, [activeProjectId]);

  const setActiveProjectId = (id: string) => {
    setActiveProjectIdState(id);
    safeStorage.setItem('active_project_id', id);
  };

  const createProject = async (name: string) => {
    const tempId = `proj_${Date.now()}`;
    const newProject: Project = {
      id: tempId,
      organizationId: (window as any).organizationId || 'org_test_2026',
      name,
      status: 'active',
      version: 1,
      config: {
        teams: [],
        costs: { staffRates: {}, vehicleRental: {} },
        materialCatalog: [],
      },
    } as any;

    // 1. Save to local Dexie first (optimistic)
    await db.projects.add(newProject);

    // 2. Push to backend and use server-returned ID
    try {
      const response = await apiClient.post('/projects', {
        name,
        status: 'active',
        config: newProject.config,
      });
      const serverProject = response.data;

      // Replace local temp entry with server-confirmed entry
      if (serverProject?.id && serverProject.id !== tempId) {
        await db.projects.delete(tempId);
        await db.projects.put({ ...newProject, ...serverProject });
        setActiveProjectId(serverProject.id);
        return { ...newProject, ...serverProject };
      }
    } catch (err) {
      console.warn('Backend project creation failed, will sync later.', err);
    }

    setActiveProjectId(tempId);
    return newProject;
  };

  const updateProject = async (updates: Partial<Project>) => {
    const currentId = activeProject?.id || activeProjectId;
    if (currentId) {
      // Update local Dexie DB first for immediate UI response
      await db.projects.update(currentId, updates);

      // Push changes to backend (will be queued by interceptor if offline)
      try {
        await apiClient.patch(`/projects/${currentId}`, updates);
      } catch (err) {
        console.warn('Backend sync failed, changes queued for offline sync.', err);
      }
    }
  };

  const deleteProject = async (
    projectId: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Call backend — password verified server-side against DB hash
      await apiClient.delete(`/projects/${projectId}`, { data: { password } });
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Erreur lors de la suppression.';
      return { success: false, error: msg };
    }

    // Remove from local IndexedDB cache
    await db.households.where('projectId').equals(projectId).delete();
    await db.projects.delete(projectId);

    // Switch to another project if the deleted one was active
    if (activeProjectId === projectId) {
      const remaining = await db.projects.toArray();
      if (remaining.length > 0) {
        setActiveProjectId(remaining[0].id);
      } else {
        setActiveProjectIdState(null);
        safeStorage.removeItem('active_project_id');
      }
    }
    return { success: true };
  };

  return {
    project: activeProject,
    projects,
    activeProjectId,
    setActiveProjectId,
    createProject,
    updateProject,
    deleteProject,
    isLoading: activeProject === undefined,
  };
}
