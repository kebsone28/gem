import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import type { Project } from '../utils/types';
import apiClient from '../api/client';

import { useState, useEffect } from 'react';
import * as safeStorage from '../utils/safeStorage';

export function useProject() {
    const [activeProjectId, setActiveProjectIdState] = useState<string | null>(safeStorage.getItem('active_project_id'));

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

    const setActiveProjectId = (id: string) => {
        setActiveProjectIdState(id);
        safeStorage.setItem('active_project_id', id);
    };

    const createProject = async (name: string) => {
        const id = `proj_${Date.now()}`;
        const newProject: Project = {
            id,
            organizationId: (window as any).organizationId || 'org_test_2026',
            name,
            status: 'planned',
            version: 1,
            config: {
                teams: [],
                costs: { staffRates: {}, vehicleRental: {} },
                materialCatalog: []
            }
        } as any;
        await db.projects.add(newProject);
        setActiveProjectId(id);
        return newProject;
    };

    const updateProject = async (updates: Partial<Project>) => {
        const currentId = activeProject?.id || activeProjectId;
        if (currentId) {
            await db.projects.update(currentId, updates);
        }
    };

    const deleteProject = async (projectId: string, password: string): Promise<{ success: boolean; error?: string }> => {
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
        isLoading: activeProject === undefined
    };
}
