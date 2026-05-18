/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type SyncJob } from '../store/db';
import type { Project } from '../utils/types';
import * as safeStorage from '../utils/safeStorage';
import logger from '../utils/logger';
import { useAuth } from './AuthContext';
import apiClient from '../api/client';

// ====================================================================
// TYPES & METRICS HARDENING
// ====================================================================
export interface SyncMetrics {
  lastSyncedAt: number | null;
  totalSyncs: number;
  failedSyncs: number;
  conflictResolvedCount: number;
  networkLatencyMs: number;
}

// ====================================================================
// LAYER 1: NETWORK SERVICE (HARDENED NETWORK LAYER)
// ====================================================================
export class NetworkService {
  private static circuitBreakerFailureCount = 0;
  private static circuitBreakerState: 'closed' | 'open' | 'half-open' = 'closed';
  private static lastStateChange = Date.now();
  private static activeRequests = new Map<string, Promise<any>>();

  public static isOnline(): boolean {
    return navigator.onLine;
  }

  public static async executeWithTimeout<T>(
    requestFn: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number = 15000
  ): Promise<T> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await requestFn(controller.signal);
    } finally {
      clearTimeout(id);
    }
  }

  public static async fetchWithRetry<T>(
    requestFn: (signal: AbortSignal) => Promise<T>,
    retries: number = 3,
    delayMs: number = 1000,
    dedupKey?: string
  ): Promise<T> {
    if (dedupKey && this.activeRequests.has(dedupKey)) {
      return this.activeRequests.get(dedupKey)!;
    }

    const promise = (async () => {
      if (this.circuitBreakerState === 'open') {
        if (Date.now() - this.lastStateChange > 30000) {
          this.circuitBreakerState = 'half-open';
          this.lastStateChange = Date.now();
        } else {
          throw new Error('Circuit Breaker est OUVERT. Requête réseau bloquée temporairement.');
        }
      }

      let attempt = 0;
      while (attempt < retries) {
        try {
          const result = await this.executeWithTimeout(requestFn);
          if (this.circuitBreakerState === 'half-open') {
            this.circuitBreakerFailureCount = 0;
            this.circuitBreakerState = 'closed';
            this.lastStateChange = Date.now();
          }
          return result;
        } catch (err: any) {
          attempt++;
          if (attempt >= retries) {
            this.circuitBreakerFailureCount++;
            if (this.circuitBreakerFailureCount >= 5) {
              this.circuitBreakerState = 'open';
              this.lastStateChange = Date.now();
              logger.error('🚨 [CIRCUIT-BREAKER] Circuit Breaker déclenché (5 échecs consécutifs).');
            }
            throw err;
          }
          const backoff = delayMs * Math.pow(2, attempt) + Math.random() * 200;
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
      throw new Error('Échec après toutes les tentatives de retry');
    })();

    if (dedupKey) {
      this.activeRequests.set(dedupKey, promise);
      try {
        return await promise;
      } finally {
        this.activeRequests.delete(dedupKey);
      }
    }
    return promise;
  }
}

// ====================================================================
// LAYER 2: PROJECT SECURITY SERVICE (MULTI-TENANT SAFETY)
// ====================================================================
export class ProjectSecurityService {
  public static validateTenant(project: Project, tenantId: string): void {
    if (!project || project.organizationId !== tenantId) {
      throw new Error(
        `[SECURITY-VIOLATION] Accès cross-tenant détecté. L'organisation du projet (${project.organizationId}) ne correspond pas à l'organisation active (${tenantId}).`
      );
    }
  }

  public static validateMutation(job: SyncJob, tenantId: string): void {
    if (job.tenantId !== tenantId) {
      throw new Error(
        `[SECURITY-VIOLATION] Mutation de tenant mismatch détectée. Attendu: ${tenantId}, Reçu: ${job.tenantId}.`
      );
    }
  }
}

// ====================================================================
// LAYER 3: PROJECT CONFLICT RESOLVER (DISTRIBUTED RECONCILIATION)
// ====================================================================
export class ProjectConflictResolver {
  public static resolve(local: Project, remote: Project): Project {
    if (local.dirty) {
      const localTime = new Date(local.updatedAt || 0).getTime();
      const remoteTime = new Date(remote.updatedAt || 0).getTime();

      // Last-Write-Wins basé sur les timestamps
      if (localTime > remoteTime) {
        return {
          ...remote,
          ...local,
          syncStatus: 'pending',
          dirty: true,
        };
      }
    }

    return {
      ...remote,
      syncStatus: 'synced',
      dirty: false,
    };
  }
}

// ====================================================================
// LAYER 4: PROJECT REPOSITORY (ATOMIC DEXIE DATA ACCESS)
// ====================================================================
export class ProjectRepository {
  public static async getById(id: string): Promise<Project | null> {
    return (await db.projects.get(id)) || null;
  }

  public static async getByTenant(tenantId: string): Promise<Project[]> {
    return await db.projects
      .where('organizationId')
      .equals(tenantId)
      .and((p) => p.deletedAt === undefined || p.deletedAt === null)
      .toArray();
  }

  public static async save(project: Project): Promise<void> {
    await db.transaction('rw', db.projects, async () => {
      await db.projects.put(project);
    });
  }

  public static async saveBulk(projects: Project[]): Promise<void> {
    if (projects.length === 0) return;
    await db.transaction('rw', db.projects, async () => {
      await db.projects.bulkPut(projects);
    });
  }

  public static async deleteBulk(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await db.transaction('rw', db.projects, async () => {
      await db.projects.bulkDelete(ids);
    });
  }

  public static async softDelete(id: string): Promise<void> {
    await db.transaction('rw', db.projects, async () => {
      const p = await db.projects.get(id);
      if (p) {
        p.deletedAt = Date.now();
        p.dirty = true;
        p.syncStatus = 'pending';
        await db.projects.put(p);
      }
    });
  }

  public static async purgeTenantData(tenantId: string): Promise<void> {
    await db.transaction('rw', db.projects, async () => {
      const ids = (
        await db.projects.where('organizationId').equals(tenantId).toArray()
      ).map((p) => p.id);
      if (ids.length > 0) {
        await db.projects.bulkDelete(ids);
      }
    });
  }
}

// ====================================================================
// LAYER 5: PROJECT MUTATION QUEUE (OFFLINE JOB QUEUE MANAGER)
// ====================================================================
export class ProjectMutationQueue {
  private static isProcessing = false;
  private static processingPromise: Promise<void> | null = null;
  private static listeners: Array<(job: SyncJob) => void> = [];

  public static subscribe(listener: (job: SyncJob) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private static notify(job: SyncJob) {
    this.listeners.forEach((l) => l(job));
  }

  public static async enqueue(
    operation: 'create' | 'update' | 'delete',
    entityId: string,
    tenantId: string,
    payload: any
  ): Promise<SyncJob> {
    const job: SyncJob = {
      id: crypto.randomUUID(),
      entityType: 'project',
      operation,
      entityId,
      tenantId,
      payload,
      retries: 0,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.transaction('rw', db.syncQueue, async () => {
      await db.syncQueue.put(job);
    });

    this.notify(job);
    void this.processQueue();
    return job;
  }

  public static async getPending(tenantId: string): Promise<SyncJob[]> {
    return await db.syncQueue
      .where('tenantId')
      .equals(tenantId)
      .and((j) => j.status !== 'syncing')
      .sortBy('createdAt');
  }

  public static async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    this.processingPromise = (async () => {
      try {
        if (!NetworkService.isOnline()) return;

        let jobs = await db.syncQueue.orderBy('createdAt').toArray();
        while (jobs.length > 0 && NetworkService.isOnline()) {
          const job = jobs[0];
          job.status = 'syncing';
          job.updatedAt = Date.now();
          await db.syncQueue.put(job);
          this.notify(job);

          try {
            if (job.operation === 'update') {
              await NetworkService.fetchWithRetry(async (signal) => {
                await apiClient.patch(`/projects/${job.entityId}`, job.payload, { signal });
              }, 3, 1000);
            } else if (job.operation === 'delete') {
              await NetworkService.fetchWithRetry(async (signal) => {
                await apiClient.delete(`/projects/${job.entityId}`, {
                  data: { password: job.payload?.password },
                  signal,
                });
              }, 3, 1000);
            } else if (job.operation === 'create') {
              await NetworkService.fetchWithRetry(async (signal) => {
                await apiClient.post('/projects', job.payload, { signal });
              }, 3, 1000);
            }

            await db.syncQueue.delete(job.id);
            const project = await db.projects.get(job.entityId);
            if (project) {
              project.dirty = false;
              project.syncStatus = 'synced';
              await db.projects.put(project);
            }
          } catch (err: any) {
            logger.error(`❌ [QUEUE] Échec de synchronisation de la mutation ${job.id}`, err);
            job.status = 'failed';
            job.retries++;
            job.lastError = err?.message || 'Erreur réseau';
            job.updatedAt = Date.now();
            await db.syncQueue.put(job);
            this.notify(job);

            const backoff = Math.min(1000 * Math.pow(2, job.retries), 30000);
            await new Promise((resolve) => setTimeout(resolve, backoff));
            break;
          }

          jobs = await db.syncQueue.orderBy('createdAt').toArray();
        }
      } finally {
        this.isProcessing = false;
        this.processingPromise = null;
      }
    })();

    return this.processingPromise;
  }
}

// ====================================================================
// LAYER 6: PROJECT SYNC ENGINE (ENTERPRISE RECONCILIATION & DELTA SYNC)
// ====================================================================
export class ProjectSyncEngine {
  private static syncMutex: Promise<Project[]> | null = null;
  private static metrics: SyncMetrics = {
    lastSyncedAt: null,
    totalSyncs: 0,
    failedSyncs: 0,
    conflictResolvedCount: 0,
    networkLatencyMs: 0,
  };

  public static getMetrics(): SyncMetrics {
    return { ...this.metrics };
  }

  public static async sync(
    tenantId: string,
    preferredProjectId?: string | null
  ): Promise<Project[]> {
    if (this.syncMutex) {
      return this.syncMutex;
    }

    const syncPromise = (async (): Promise<Project[]> => {
      const startTime = Date.now();
      try {
        if (!NetworkService.isOnline()) {
          logger.warn('⚠️ [SYNC-ENGINE] Mode Offline détecté, utilisation des données locales.');
          return await ProjectRepository.getByTenant(tenantId);
        }

        const localProjects = await ProjectRepository.getByTenant(tenantId);
        const lastSyncedAt = localProjects.reduce((max, p) => Math.max(max, p.lastSyncedAt || 0), 0);

        // Delta sync avec paramètre updatedAfter
        const response = await NetworkService.fetchWithRetry(
          async (signal) => {
            return await apiClient.get('/projects', {
              params: {
                updatedAfter: lastSyncedAt > 0 ? new Date(lastSyncedAt).toISOString() : undefined,
              },
              signal,
            });
          },
          3,
          1000,
          `sync_${tenantId}`
        );

        const data = response?.data || {};
        const serverProjects: Project[] = data.projects || (Array.isArray(data) ? data : []);

        const filteredServerProjects = serverProjects.filter((p) => p.organizationId === tenantId);
        const isFullSync = data.isFullSync !== false;

        // Transaction atomique de réconciliation
        await db.transaction('rw', [db.projects, db.syncQueue], async () => {
          const existing = await db.projects.where('organizationId').equals(tenantId).toArray();
          const localMap = new Map(existing.map((p) => [p.id, p]));

          const toPut: Project[] = [];
          let conflictCount = 0;

          for (const serverProj of filteredServerProjects) {
            const localProj = localMap.get(serverProj.id);
            if (localProj) {
              const resolved = ProjectConflictResolver.resolve(localProj, serverProj);
              resolved.lastSyncedAt = Date.now();
              if (resolved.syncStatus === 'synced') {
                conflictCount++;
              }
              toPut.push(resolved);
            } else {
              serverProj.syncStatus = 'synced';
              serverProj.lastSyncedAt = Date.now();
              toPut.push(serverProj);
            }
          }

          if (toPut.length > 0) {
            await ProjectRepository.saveBulk(toPut);
          }

          if (isFullSync) {
            const serverIds = new Set(filteredServerProjects.map((p) => p.id));
            const toDelete = existing.filter((p) => !serverIds.has(p.id) && !p.dirty).map((p) => p.id);
            if (toDelete.length > 0) {
              await ProjectRepository.deleteBulk(toDelete);
            }
          }

          this.metrics.conflictResolvedCount += conflictCount;
        });

        this.metrics.lastSyncedAt = Date.now();
        this.metrics.totalSyncs++;
        this.metrics.networkLatencyMs = Date.now() - startTime;

        logger.debug(
          `♻️ [SYNC-ENGINE] Synchronisation effectuée. Latence: ${this.metrics.networkLatencyMs}ms, Conflits: ${this.metrics.conflictResolvedCount}`
        );

        return await ProjectRepository.getByTenant(tenantId);
      } catch (err: any) {
        this.metrics.failedSyncs++;
        logger.error('❌ [SYNC-ENGINE] Échec lors de la synchronisation des projets', err);
        throw err;
      }
    })();

    this.syncMutex = syncPromise;
    try {
      return await syncPromise;
    } finally {
      this.syncMutex = null;
    }
  }
}

// ====================================================================
// LAYER 7: PROJECT CONTEXT & STATE PROVIDER (DECOUPLED UI INTERFACE)
// ====================================================================
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
  syncMetrics: SyncMetrics;
  t: (key: string, defaultValue: string) => string;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMetrics, setSyncMetrics] = useState<SyncMetrics>(ProjectSyncEngine.getMetrics());

  const lastSyncedUserIdRef = useRef<string | null>(null);
  const lastSyncedOrgIdRef = useRef<string | null>(null);

  const userRef = useRef(user);
  const activeProjectIdRef = useRef(activeProjectId);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
  }, [activeProjectId]);

  // Événement de reconnexion automatique pour vider la queue offline
  useEffect(() => {
    const handleOnline = () => {
      logger.info('🔌 [NETWORK] De retour en ligne ! Traitement de la queue de mutations...');
      void ProjectMutationQueue.processQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Détecter les mutations en arrière-plan pour mettre à jour les métriques
  useEffect(() => {
    return ProjectMutationQueue.subscribe(() => {
      setSyncMetrics(ProjectSyncEngine.getMetrics());
    });
  }, []);

  // Charger le projet actif du tenant
  useEffect(() => {
    if (authLoading) return;

    if (user?.organizationId) {
      const storedId = safeStorage.getItem(`active_project_${user.organizationId}`);
      setActiveProjectIdState(storedId);
      if (storedId) {
        safeStorage.setItem('active_project_id', storedId);
      } else {
        safeStorage.removeItem('active_project_id');
      }
    } else {
      setActiveProjectIdState(null);
      safeStorage.removeItem('active_project_id');
    }
  }, [user?.organizationId, authLoading]);

  // 1. QUERY PERSISTÉE SELECTIVE (HAUTE PERFORMANCE)
  const projects = useLiveQuery(
    () => {
      if (!user?.organizationId) return [];
      return ProjectRepository.getByTenant(user.organizationId);
    },
    [user?.organizationId]
  ) || [];

  // 2. QUERY ACTIVE PROJECT SANS FLICKER
  const activeProject = useLiveQuery(
    async () => {
      if (!user?.organizationId) return null;
      if (activeProjectId) {
        const p = await ProjectRepository.getById(activeProjectId);
        if (p && p.organizationId === user.organizationId) {
          return p;
        }
      }
      const all = await ProjectRepository.getByTenant(user.organizationId);
      return all[0] ?? null;
    },
    [activeProjectId, user?.organizationId],
    null
  );

  const persistActiveProjectId = (id: string | null) => {
    setActiveProjectIdState(id);
    const currentUser = userRef.current;
    if (currentUser?.organizationId) {
      const key = `active_project_${currentUser.organizationId}`;
      if (id) {
        safeStorage.setItem(key, id);
        safeStorage.setItem('active_project_id', id);
      } else {
        safeStorage.removeItem(key);
        safeStorage.removeItem('active_project_id');
      }
    }
  };

  // Alignement automatique du projet actif
  useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      persistActiveProjectId(projects[0].id);
    }
  }, [projects, activeProjectId]);

  useEffect(() => {
    if (!activeProjectId || projects.length === 0) return;

    if (!projects.some((project) => project.id === activeProjectId)) {
      persistActiveProjectId(projects[0]?.id || null);
    }
  }, [projects, activeProjectId]);

  // API DE SYNCHRONISATION
  const syncProjects = async (preferredProjectId?: string | null): Promise<Project[]> => {
    setSyncError(null);
    setIsSyncing(true);
    try {
      const currentUser = userRef.current;
      if (!currentUser?.organizationId) {
        return [];
      }

      const synced = await ProjectSyncEngine.sync(currentUser.organizationId, preferredProjectId);
      setSyncMetrics(ProjectSyncEngine.getMetrics());

      const currentActiveId = activeProjectIdRef.current;
      const nextActiveId =
        preferredProjectId && synced.some((project) => project.id === preferredProjectId)
          ? preferredProjectId
          : currentActiveId && synced.some((project) => project.id === currentActiveId)
            ? currentActiveId
            : synced[0]?.id || null;

      persistActiveProjectId(nextActiveId);
      return synced;
    } catch (err: any) {
      const errorMessage = err?.message || 'Erreur de synchronisation réseau';
      setSyncError(errorMessage);
      return await ProjectRepository.getByTenant(userRef.current?.organizationId || '');
    } finally {
      setIsSyncing(false);
    }
  };

  // 3. AUTO-SYNC & PURGE CIBLÉE DU TENANT AU LOGOUT
  useEffect(() => {
    const handleUserSession = async () => {
      if (authLoading) return;

      if (!user?.id) {
        const prevOrgId = lastSyncedOrgIdRef.current;
        lastSyncedUserIdRef.current = null;
        lastSyncedOrgIdRef.current = null;
        if (prevOrgId) {
          logger.debug(`🧹 Purge des données locales du tenant sortant: ${prevOrgId}...`);
          await ProjectRepository.purgeTenantData(prevOrgId);
        }
        persistActiveProjectId(null);
        return;
      }

      if (lastSyncedUserIdRef.current === user.id && lastSyncedOrgIdRef.current === user.organizationId) return;
      lastSyncedUserIdRef.current = user.id;
      lastSyncedOrgIdRef.current = user.organizationId || null;

      try {
        await syncProjects();
      } catch (err) {
        logger.error('Échec de la synchronisation initiale', err);
      }
    };

    void handleUserSession();
  }, [user?.id, user?.organizationId, authLoading]);

  const setActiveProjectId = (id: string | null) => {
    persistActiveProjectId(id);
  };

  // 4. CRÉATION OFFLINE-FIRST AVEC MUTATION QUEUE
  const createProject = async (data: Partial<Project>): Promise<Project> => {
    const currentUser = userRef.current;
    if (!currentUser?.organizationId) {
      throw new Error('Non autorisé (Organisation manquante)');
    }

    const tempId = crypto.randomUUID();
    const newProj: Project = {
      id: tempId,
      organizationId: currentUser.organizationId,
      name: data.name || 'Nouveau Projet',
      client: data.client,
      description: data.description,
      status: data.status || 'planning',
      version: 1,
      config: data.config || {},
      dirty: true,
      syncStatus: 'pending',
      updatedAt: new Date().toISOString(),
    };

    // Écriture optimiste immédiate en local
    await ProjectRepository.save(newProj);

    // Ajout à la queue de mutation persistée
    await ProjectMutationQueue.enqueue('create', tempId, currentUser.organizationId, newProj);

    return newProj;
  };

  // 5. UPDATE OFFLINE-FIRST AVEC RECONCILIATION ET SÉCURITÉ TENANT
  const updateProject = async (updates: Partial<Project>, id?: string) => {
    const currentId = id || activeProjectId;
    if (!currentId) return;

    const oldProject = await ProjectRepository.getById(currentId);
    if (!oldProject) return;

    const currentUser = userRef.current;
    if (!currentUser?.organizationId) return;

    // Validation stricte du tenant avant mutation
    ProjectSecurityService.validateTenant(oldProject, currentUser.organizationId);

    const updatedProj: Project = {
      ...oldProject,
      ...updates,
      dirty: true,
      syncStatus: 'pending',
      updatedAt: new Date().toISOString(),
    };

    // Écriture optimiste locale immédiate
    await ProjectRepository.save(updatedProj);

    // Enfilement mutation
    await ProjectMutationQueue.enqueue('update', currentId, currentUser.organizationId, updates);
  };

  // 6. DELETE OFFLINE-FIRST
  const deleteProject = async (projectId: string, password: string) => {
    try {
      const existing = await ProjectRepository.getById(projectId);
      const currentUser = userRef.current;
      if (!existing || !currentUser?.organizationId) {
        return { success: false, error: 'Non autorisé' };
      }

      ProjectSecurityService.validateTenant(existing, currentUser.organizationId);

      // Suppression optimiste locale
      await ProjectRepository.softDelete(projectId);

      // Mutation Queue
      await ProjectMutationQueue.enqueue('delete', projectId, currentUser.organizationId, { password });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erreur lors de la suppression' };
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
        project: activeProject,
        projects,
        activeProjectId,
        setActiveProjectId,
        refreshProjects: syncProjects,
        createProject,
        updateProject,
        deleteProject,
        isLoading: activeProject === null && projects.length === 0 && isSyncing,
        isSyncing,
        syncError,
        syncMetrics,
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
