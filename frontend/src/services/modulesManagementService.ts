import { db } from '../store/db';
import { auditService } from './auditService';
import logger from '../utils/logger';
import apiClient from '../api/client';

// Types pour la gestion des modules
export interface ModuleConfig {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'advanced' | 'experimental' | 'admin';
  enabled: boolean;
  global: boolean; // Si true, l'admin peut activer/désactiver globalement
  permissions: string[]; // Permissions requises pour voir/configurer ce module
  icon?: string;
  settings?: Record<string, any>;
}

export interface UserModuleAccess {
  userId: string;
  moduleId: string;
  enabled: boolean;
  customSettings?: Record<string, any>;
  lastModified: Date;
  modifiedBy: string;
}

// Configuration des modules disponibles
export const AVAILABLE_MODULES: ModuleConfig[] = [
  // Modules CORE - Toujours actifs
  {
    id: 'dashboard',
    name: 'Tableaux de Bord',
    description: 'Dashboards par rôle et entreprise',
    category: 'core',
    enabled: true,
    global: false, // Non désactivable globalement
    permissions: ['voir_dashboard'],
    icon: 'BarChart3',
  },
  {
    id: 'missions',
    name: 'Gestion des Missions',
    description: 'Création, suivi et validation des missions',
    category: 'core',
    enabled: true,
    global: false, // Non désactivable globalement
    permissions: ['voir_missions', 'creer_mission'],
    icon: 'Target',
  },
  {
    id: 'users',
    name: 'Gestion des Utilisateurs',
    description: 'Administration des comptes et permissions',
    category: 'core',
    enabled: true,
    global: false, // Non désactivable globalement
    permissions: ['gerer_utilisateurs'],
    icon: 'Users',
  },
  {
    id: 'planning',
    name: 'Planning et Ordonnancement',
    description: 'Gestion du planning de projet',
    category: 'core',
    enabled: true,
    global: false, // Non désactivable globalement
    permissions: ['gerer_planning'],
    icon: 'Calendar',
  },

  // Modules ADVANCED - Désactivables globalement
  {
    id: 'ai_assistant',
    name: 'Assistant IA Wanekoo',
    description: 'Assistant intelligent pour aide à la décision',
    category: 'advanced',
    enabled: true,
    global: true, // Peut être désactivé globalement
    permissions: ['utiliser_ia'],
    icon: 'Zap',
    settings: {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
    },
  },
  {
    id: 'advanced_analytics',
    name: 'Analytics Avancés',
    description: 'Analyse prédictive et tableaux de bord personnalisés',
    category: 'advanced',
    enabled: true,
    global: true, // Peut être désactivé globalement
    permissions: ['voir_metriques_ia'],
    icon: 'TrendingUp',
    settings: {
      realTimeUpdates: true,
      predictiveAnalytics: true,
      customDashboards: false,
    },
  },
  {
    id: 'multi_tenant',
    name: 'Multi-Entreprises',
    description: 'Gestion multi-entreprises et isolation des données',
    category: 'advanced',
    enabled: true,
    global: true, // Peut être désactivé globalement
    permissions: ['gerer_entreprises'],
    icon: 'Building',
    settings: {
      enabledCompanies: ['PROQUELEC', 'LSE', 'SENELEC'],
      dataIsolation: true,
    },
  },
  {
    id: 'automated_workflows',
    name: 'Workflows Automatisés',
    description: 'Automatisation des processus métier',
    category: 'advanced',
    enabled: true,
    global: true, // Peut être désactivé globalement
    permissions: ['gerer_workflows'],
    icon: 'Settings',
    settings: {
      autoApprovalMissions: false,
      autoReportGeneration: true,
      notificationRules: true,
    },
  },

  // Modules EXPERIMENTAL - Désactivables globalement
  {
    id: 'real_time_collaboration',
    name: 'Collaboration Temps Réel',
    description: 'Édition collaborative en temps réel',
    category: 'experimental',
    enabled: false, // Désactivé par défaut
    global: true, // Peut être désactivé globalement
    permissions: ['collaboration_temps_reel'],
    icon: 'Users',
    settings: {
      maxConcurrentUsers: 10,
      conflictResolution: 'manual',
    },
  },
  {
    id: 'blockchain_audit',
    name: 'Audit Blockchain',
    description: 'Traçabilité immuable des actions',
    category: 'experimental',
    enabled: false, // Désactivé par défaut
    global: true, // Peut être désactivé globalement
    permissions: ['voir_audit_blockchain'],
    icon: 'Shield',
    settings: {
      blockchainProvider: 'ethereum',
      gasLimit: 21000,
    },
  },

  // Modules ADMIN - Désactivables globalement
  {
    id: 'god_mode',
    name: 'Mode Dieu (God Mode)',
    description: 'Accès complet et bypass des restrictions',
    category: 'admin',
    enabled: false, // Désactivé par défaut
    global: true, // Peut être désactivé globalement
    permissions: ['acces_god_mode'],
    icon: 'ShieldCheck',
    settings: {
      requireConfirmation: true,
      auditAllActions: true,
      bypassPermissions: true,
    },
  },
  {
    id: 'system_maintenance',
    name: 'Maintenance Système',
    description: 'Outils de maintenance et diagnostics',
    category: 'admin',
    enabled: true,
    global: true, // Peut être désactivé globalement
    permissions: ['voir_diagnostic', 'gerer_parametres'],
    icon: 'Wrench',
    settings: {
      allowScheduledMaintenance: true,
      enableDiagnostics: true,
      performanceMonitoring: true,
    },
  },
];

class ModulesManagementService {
  private readonly MODULES_KEY = 'global_modules_config';
  private readonly USER_MODULES_KEY = 'user_modules_access';

  // Récupérer la configuration globale des modules
  async getGlobalModulesConfig(): Promise<Record<string, ModuleConfig>> {
    try {
      // Priorité 1 : API backend (source de vérité)
      try {
        const response = await apiClient.get('/api/admin/modules/config');
        const config = response.data?.config || {};
        // Cache dans localStorage pour offline
        localStorage.setItem(this.MODULES_KEY, JSON.stringify(config));
        return config;
      } catch (apiErr) {
        logger.warn('[ModulesManagementService] API indisponible, fallback localStorage', apiErr);
        // Priorité 2 : localStorage (fallback)
        const config = localStorage.getItem(this.MODULES_KEY);
        if (config) {
          return JSON.parse(config);
        }

        // Priorité 3 : config par défaut
        const defaultConfig: Record<string, ModuleConfig> = {};
        AVAILABLE_MODULES.forEach((module) => {
          defaultConfig[module.id] = module;
        });
        localStorage.setItem(this.MODULES_KEY, JSON.stringify(defaultConfig));
        return defaultConfig;
      }
    } catch (error) {
      logger.error('[ModulesManagementService] Error loading global modules config:', error);
      throw error;
    }
  }

  // Sauvegarder la configuration globale des modules
  async setGlobalModulesConfig(config: Record<string, ModuleConfig>): Promise<void> {
    try {
      // Sauvegarder sur le backend (source de vérité)
      try {
        await apiClient.post('/api/admin/modules/config', { config });
        logger.info('[ModulesManagementService] Global modules config saved to backend');
      } catch (apiErr) {
        logger.warn('[ModulesManagementService] Failed to save to backend, using localStorage', apiErr);
      }
      // Toujours sauvegarder en cache local pour offline
      localStorage.setItem(this.MODULES_KEY, JSON.stringify(config));
      logger.info('[ModulesManagementService] Global modules config updated');
    } catch (error) {
      logger.error('[ModulesManagementService] Error saving global modules config:', error);
      throw error;
    }
  }

  // Activer/désactiver un module globalement
  async toggleGlobalModule(moduleId: string, enabled: boolean, userId: string): Promise<void> {
    try {
      const config = await this.getGlobalModulesConfig();
      const module = config[moduleId];

      if (!module) {
        throw new Error(`Module ${moduleId} not found`);
      }

      if (!module.global) {
        throw new Error(`Module ${moduleId} cannot be toggled globally`);
      }

      // Mettre à jour le module
      config[moduleId] = {
        ...module,
        enabled,
      };

      await this.setGlobalModulesConfig(config);

      // Logger l'action
      await auditService.logAction(
        { id: userId, email: '', role: 'ADMIN' } as any,
        'Module Global',
        'MODULES',
        `${enabled ? 'Activation' : 'Désactivation'} globale du module ${module.name}`,
        enabled ? 'info' : 'warning'
      );

      logger.info(
        `[ModulesManagementService] Module ${moduleId} ${enabled ? 'enabled' : 'disabled'} globally`
      );
    } catch (error) {
      logger.error('[ModulesManagementService] Error toggling global module:', error);
      throw error;
    }
  }

  // Récupérer les accès d'un utilisateur aux modules
  async getUserModulesAccess(userId: string): Promise<UserModuleAccess[]> {
    try {
      // Essayer d'abord IndexedDB
      const userAccess = await db.user_modules_access.where('userId').equals(userId).toArray();

      if (userAccess.length === 0) {
        // Si pas d'accès enregistrés, utiliser les permissions par défaut
        const globalConfig = await this.getGlobalModulesConfig();
        const defaultAccess: UserModuleAccess[] = [];

        Object.entries(globalConfig).forEach(([moduleId, module]) => {
          if (module.enabled) {
            defaultAccess.push({
              userId,
              moduleId,
              enabled: true,
              lastModified: new Date(),
              modifiedBy: 'system',
            });
          }
        });

        // Sauvegarder les accès par défaut
        await db.user_modules_access.bulkPut(defaultAccess);
        return defaultAccess;
      }

      return userAccess;
    } catch (error) {
      logger.error('[ModulesManagementService] Error loading user modules access:', error);
      throw error;
    }
  }

  // Mettre à jour l'accès d'un utilisateur à un module
  async updateUserModuleAccess(
    userId: string,
    moduleId: string,
    enabled: boolean,
    modifiedBy: string,
    customSettings?: Record<string, any>
  ): Promise<void> {
    try {
      const existingAccess = await db.user_modules_access
        .where('[userId+moduleId]')
        .equals([userId, moduleId])
        .first();

      const access: UserModuleAccess = existingAccess || {
        userId,
        moduleId,
        enabled: true,
        lastModified: new Date(),
        modifiedBy: 'system',
      };

      access.enabled = enabled;
      access.lastModified = new Date();
      access.modifiedBy = modifiedBy;
      if (customSettings) {
        access.customSettings = customSettings;
      }

      if (existingAccess) {
        await db.user_modules_access.update(existingAccess.id!, access as any);
      } else {
        await db.user_modules_access.add(access);
      }

      logger.info(
        `[ModulesManagementService] User ${userId} ${enabled ? 'enabled' : 'disabled'} module ${moduleId}`
      );
    } catch (error) {
      logger.error('[ModulesManagementService] Error updating user module access:', error);
      throw error;
    }
  }

  // Vérifier si un module est activé pour un utilisateur
  async isModuleEnabledForUser(userId: string, moduleId: string): Promise<boolean> {
    try {
      // Vérifier d'abord la configuration globale
      const globalConfig = await this.getGlobalModulesConfig();
      const globalModule = globalConfig[moduleId];

      // Si le module est désactivé globalement, il n'est pas accessible
      if (globalModule && !globalModule.enabled) {
        return false;
      }

      // Vérifier l'accès utilisateur
      const userAccess = await db.user_modules_access
        .where('[userId+moduleId]')
        .equals([userId, moduleId])
        .first();

      return userAccess?.enabled ?? true; // Par défaut, activé si pas spécifié
    } catch (error) {
      logger.error('[ModulesManagementService] Error checking module access:', error);
      return false;
    }
  }

  // Récupérer les modules disponibles pour un utilisateur
  async getAvailableModulesForUser(
    userId: string,
    userPermissions: string[]
  ): Promise<ModuleConfig[]> {
    try {
      const globalConfig = await this.getGlobalModulesConfig();
      const userAccess = await this.getUserModulesAccess(userId);

      // Créer un map des accès utilisateur
      const userAccessMap = new Map(userAccess.map((access) => [access.moduleId, access.enabled]));

      return AVAILABLE_MODULES.filter((module) => {
        // Vérifier si le module est activé globalement
        if (!module.enabled) {
          return false;
        }

        // Vérifier si l'utilisateur a les permissions requises
        const hasPermission = module.permissions.some((perm) => userPermissions.includes(perm));

        if (!hasPermission) {
          return false;
        }

        // Vérifier l'accès utilisateur spécifique
        const userEnabled = userAccessMap.get(module.id);
        return userEnabled !== false; // false si explicitement désactivé, true sinon
      });
    } catch (error) {
      logger.error('[ModulesManagementService] Error getting available modules:', error);
      return [];
    }
  }

  // Réinitialiser les accès d'un utilisateur aux valeurs par défaut
  async resetUserModulesAccess(userId: string, modifiedBy: string): Promise<void> {
    try {
      await db.user_modules_access.where('userId').equals(userId).delete();

      await auditService.logAction(
        { id: userId, email: '', role: 'ADMIN' } as any,
        'Réinitialisation Modules',
        'MODULES',
        `Réinitialisation des accès modules pour l'utilisateur ${userId}`,
        'warning'
      );

      logger.info(`[ModulesManagementService] Reset modules access for user ${userId}`);
    } catch (error) {
      logger.error('[ModulesManagementService] Error resetting user modules access:', error);
      throw error;
    }
  }

  // Obtenir les statistiques d'utilisation des modules
  async getModulesUsageStats(): Promise<Record<string, any>> {
    try {
      const globalConfig = await this.getGlobalModulesConfig();
      const allUserAccess = await db.user_modules_access.toArray();

      const stats: Record<string, any> = {};

      Object.entries(globalConfig).forEach(([moduleId, module]) => {
        const userCount = allUserAccess.filter(
          (access) => access.moduleId === moduleId && access.enabled
        ).length;

        stats[moduleId] = {
          name: module.name,
          globalEnabled: module.enabled,
          globalToggleable: module.global,
          userCount,
          userEnabledCount: userCount,
          category: module.category,
        };
      });

      return stats;
    } catch (error) {
      logger.error('[ModulesManagementService] Error getting modules usage stats:', error);
      return {};
    }
  }
}

export const modulesManagementService = new ModulesManagementService();
