import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../store/db';
import { hasPermission, PERMISSIONS, isPlatformAdmin } from '../utils/permissions';
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

export function useProjectSelector() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [userAssignments, setUserAssignments] = useState<ProjectAssignment[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<'all' | 'active' | 'completed' | 'my'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Vérifier si l'utilisateur a accès aux projets
  const canAccessProjects = useMemo(() => {
    if (!user) return false;
    return isPlatformAdmin(user) || hasPermission(user, PERMISSIONS.UI_PROJECTS);
  }, [user]);

  // Charger les projets
  const loadProjects = async () => {
    if (!canAccessProjects) {
      setProjects([]);
      setUserAssignments([]);
      setLoading(false);
      return;
    }

    try {
      // Charger tous les projets depuis IndexedDB
      const allDbProjects = await db.projects.toArray();
      
      // Déterminer le rôle
      const nRole = normalizeRole(user.role);
      const isGlobalAdmin = isPlatformAdmin(user) || nRole === ROLES.ADMIN || nRole === ROLES.DG;

      // 🛡️ Filtrage de visibilité Enterprise
      const accessibleProjects = isGlobalAdmin 
        ? allDbProjects 
        : allDbProjects.filter(p => (p.assignedUsers || []).includes(user.id) || (p.assignedUsers || []).includes(user.email));

      // Créer les assignments réels ou simulés pour la navigation
      const assignments: ProjectAssignment[] = accessibleProjects.map(project => {
        const isAssigned = (project.assignedUsers || []).includes(user.id) || (project.assignedUsers || []).includes(user.email);
        return {
          projectId: project.id,
          userId: user.id,
          role: isGlobalAdmin ? 'admin' : 'member',
          assignedAt: project.createdAt,
          assignedBy: 'system',
          permissions: isGlobalAdmin ? ['all'] : ['view'],
          canSwitch: isGlobalAdmin || isAssigned,
          lastAccessed: new Date(),
        };
      });

      // Filtrer les projets archivés pour la vue principale
      const activeProjects = accessibleProjects.filter(p => !p.isArchived);

      setProjects(activeProjects);
      setUserAssignments(assignments);

      // Sélectionner automatiquement le projet
      if (!selectedProject && activeProjects.length > 0) {
        // 🥇 Priorité 1 : Projet Kobo Global
        const globalProject = activeProjects.find(p => p.name.toLowerCase().includes('global') || p.name.toLowerCase().includes('kobo'));
        
        // 🥈 Priorité 2 : Premier projet accessible
        const firstAccessibleProject = globalProject?.id || assignments.find(a => a.canSwitch)?.projectId || activeProjects[0]?.id;
        
        if (firstAccessibleProject) {
          setSelectedProject(firstAccessibleProject);
        }
      }
    } catch (error) {
      logger.error('[useProjectSelector] Error loading projects:', error);
      toast.error('Erreur lors du chargement des projets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [user, canAccessProjects]);

  // Projets filtrés selon le filtre et la recherche
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Filtrer par statut
    if (projectFilter === 'active') {
      filtered = filtered.filter(p => p.status === 'active');
    } else if (projectFilter === 'completed') {
      filtered = filtered.filter(p => p.status === 'completed');
    } else if (projectFilter === 'my') {
      // Projets où l'utilisateur est assigné
      const userProjectIds = userAssignments
        .filter(assignment => assignment.canSwitch)
        .map(assignment => assignment.projectId);
      filtered = filtered.filter(p => userProjectIds.includes(p.id));
    }

    // Filtrer par recherche
    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    return filtered;
  }, [projects, userAssignments, projectFilter, searchTerm]);

  // Obtenir les détails du projet sélectionné
  const selectedProjectDetails = useMemo(() => {
    if (!selectedProject) return null;
    return projects.find(p => p.id === selectedProject) || null;
  }, [projects, selectedProject]);

  // Obtenir l'assignment de l'utilisateur pour le projet sélectionné
  const userAssignment = useMemo(() => {
    if (!selectedProject || !user) return null;
    return userAssignments.find(a => a.projectId === selectedProject) || null;
  }, [userAssignments, selectedProject, user]);

  // Changer de projet
  const switchProject = async (projectId: string) => {
    if (!user) return;

    try {
      // Vérifier si l'utilisateur a accès à ce projet
      const assignment = userAssignments.find(a => a.projectId === projectId);
      if (!assignment || !assignment.canSwitch) {
        toast.error('Vous n\'avez pas accès à ce projet');
        return;
      }

      // Mettre à jour la date de dernier accès si l'assignation existe en base
      if (assignment.id) {
        await db.projectAssignments.update(assignment.id, {
          lastAccessed: new Date(),
        });
      }

      setSelectedProject(projectId);
      toast.success(`Projet "${projects.find(p => p.id === projectId)?.name}" sélectionné`);

      // Logger l'action
      logger.info(`[useProjectSelector] User ${user.id} switched to project ${projectId}`);
    } catch (error) {
      logger.error('[useProjectSelector] Error switching project:', error);
      toast.error('Erreur lors du changement de projet');
    }
  };

  // Statistiques des projets
  const projectStats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter(p => p.status === 'active').length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const myProjects = userAssignments.filter(a => a.canSwitch).length;

    return {
      total,
      active,
      completed,
      myProjects,
      archived: projects.filter(p => p.isArchived).length,
    };
  }, [projects, userAssignments]);

  return {
    // Données
    projects,
    userAssignments,
    selectedProject,
    selectedProjectDetails,
    userAssignment,
    filteredProjects,
    projectStats,
    loading,
    canAccessProjects,

    // Actions
    switchProject,
    setProjectFilter,
    setSearchTerm,
    refreshProjects: loadProjects,

    // État
    projectFilter,
    searchTerm,
  };
}
