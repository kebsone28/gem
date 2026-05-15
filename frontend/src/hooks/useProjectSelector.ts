import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import { PERMISSIONS, hasPermission } from '../utils/permissions';
import logger from '../utils/logger';
import toast from 'react-hot-toast';

export interface Project {
  id: string;
  name: string;
  description: string;
  client: string;
  status: 'planning' | 'active' | 'completed' | 'paused';
  startDate: Date;
  endDate?: Date;
  progress: number;
  assignedUsers: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  budget?: number;
  actualCost?: number;
  organizationId?: string;
  isArchived?: boolean;
}

export interface ProjectAssignment {
  id?: number;
  projectId: string;
  userId: string;
  role: 'manager' | 'member' | 'viewer' | 'admin';
  assignedAt: Date;
  assignedBy: string;
  permissions: string[];
  canSwitch: boolean;
  lastAccessed?: Date;
}

/**
 * Vérifie si un rôle correspond à un admin global (bypass complet des filtres)
 * Inclut tous les alias connus pour éviter toute dépendance aux chaînes de normalisation.
 */
function isAdminRole(role?: string): boolean {
  if (!role) return false;
  const r = role.trim().toUpperCase();
  return [
    'PLATFORM_ADMIN',
    'ADMIN',
    'ADMIN_PROQUELEC',
    'PROQUELEC_ADMIN',
    'DIRECTEUR',
    'DG',
    'DG_PROQUELEC',
    'PROQUELEC_DG',
    'SOUS_TRAITANT_DIRECTEUR',
  ].includes(r);
}

export function useProjectSelector() {
  const { user } = useAuth();

  // 1. Observer la base Dexie de manière réactive.
  //    useLiveQuery retourne `undefined` pendant le premier chargement (pas encore résolu),
  //    et un tableau (possiblement vide) ensuite.
  const rawDbProjects = useLiveQuery(() => db.projects.toArray());

  // Tant que Dexie n'a pas répondu, on est en état "loading"
  const isHydrating = rawDbProjects === undefined;
  const allDbProjectsFromDb = rawDbProjects ?? [];

  // 2. L'utilisateur est-il un admin global ?
  const isGlobalAdmin = useMemo(() => {
    if (!user) return false;
    return (user as any).isPlatformAdmin === true || isAdminRole(user.role);
  }, [user]);

  // 3. Moteur de Visibilité — calcule les projets accessibles
  const accessibleProjects = useMemo(() => {
    if (!user) return [];
    if (isHydrating) return []; // Dexie pas encore prêt

    logger.debug(`[ProjectSelector] DB: ${allDbProjectsFromDb.length} projet(s), admin=${isGlobalAdmin}`);

    if (isGlobalAdmin) {
      // L'admin voit tout sauf les projets explicitement archivés
      return allDbProjectsFromDb.filter(p => p.isArchived !== true);
    }

    // Pour les autres, vérifier l'assignation explicite
    const userId = user.id;
    const userEmail = (user as any).email || '';

    return allDbProjectsFromDb.filter(p => {
      if (p.isArchived === true) return false;

      // Permission globale via le système PERMISSIONS
      if (hasPermission(user as any, PERMISSIONS.UI_PROJECTS)) return true;

      // Vérification directe des assignedUsers (root ou config)
      const assignedRoot: string[] = Array.isArray(p.assignedUsers) ? p.assignedUsers : [];
      const assignedConfig: string[] = Array.isArray((p as any).config?.assignedUsers)
        ? (p as any).config.assignedUsers
        : [];
      const allAssigned = [...new Set([...assignedRoot, ...assignedConfig])];

      return (
        allAssigned.includes(userId) ||
        allAssigned.includes(userEmail) ||
        (p as any).createdBy === userId
      );
    });
  }, [allDbProjectsFromDb, user, isGlobalAdmin, isHydrating]);

  // 4. Assignations dérivées
  const userAssignments = useMemo((): ProjectAssignment[] => {
    return accessibleProjects.map(project => ({
      projectId: project.id,
      userId: user?.id || '',
      role: (isGlobalAdmin ? 'admin' : 'member') as ProjectAssignment['role'],
      assignedAt: project.createdAt ? new Date(project.createdAt) : new Date(),
      assignedBy: 'system',
      permissions: isGlobalAdmin ? ['all'] : ['view'],
      canSwitch: true,
      lastAccessed: new Date(),
    }));
  }, [accessibleProjects, user, isGlobalAdmin]);

  // 5. Filtres et sélection
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<'all' | 'active' | 'completed' | 'my'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 6. Sélection automatique du projet global/kobo en priorité
  useEffect(() => {
    if (!selectedProjectId && accessibleProjects.length > 0) {
      const globalProject = accessibleProjects.find(p =>
        p.name?.toLowerCase().includes('global') ||
        p.name?.toLowerCase().includes('kobo')
      );
      setSelectedProjectId(globalProject?.id || accessibleProjects[0]?.id);
    }
  }, [accessibleProjects, selectedProjectId]);

  // 7. Filtrage final pour l'UI — défensif et insensible à la casse
  const filteredProjects = useMemo(() => {
    let filtered = accessibleProjects;

    if (projectFilter === 'active') {
      filtered = filtered.filter(p => p.status?.toLowerCase() === 'active');
    } else if (projectFilter === 'completed') {
      filtered = filtered.filter(p => p.status?.toLowerCase() === 'completed');
    } else if (projectFilter === 'my') {
      const switchableIds = new Set(
        userAssignments.filter(a => a.canSwitch).map(a => a.projectId)
      );
      filtered = filtered.filter(p => switchableIds.has(p.id));
    }
    // 'all' → pas de filtre supplémentaire

    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(lowerSearch) ||
        (p.description || '').toLowerCase().includes(lowerSearch)
      );
    }

    return filtered;
  }, [accessibleProjects, userAssignments, projectFilter, searchTerm]);

  const switchProject = async (projectId: string) => {
    if (!user) return;
    setSelectedProjectId(projectId);
    toast.success('Projet changé');
  };

  return {
    projects: accessibleProjects,
    userAssignments,
    selectedProject: selectedProjectId,
    selectedProjectDetails: accessibleProjects.find(p => p.id === selectedProjectId) || null,
    userAssignment: userAssignments.find(a => a.projectId === selectedProjectId) || null,
    filteredProjects,
    projectStats: {
      total: accessibleProjects.length,
      active: accessibleProjects.filter(p => p.status?.toLowerCase() === 'active').length,
      completed: accessibleProjects.filter(p => p.status?.toLowerCase() === 'completed').length,
      myProjects: userAssignments.filter(a => a.canSwitch).length,
      archived: 0,
    },
    canAccessProjects: isGlobalAdmin || accessibleProjects.length > 0,
    switchProject,
    setProjectFilter,
    setSearchTerm,
    refreshProjects: () => {},
    projectFilter,
    searchTerm,
    // loading = true uniquement pendant l'hydration Dexie initiale
    loading: isHydrating && !!user,
  };
}
