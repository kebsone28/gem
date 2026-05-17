/**
 * DomainConfigService
 *
 * Manages domain configuration per organization
 * Loads, caches, and provides domain-specific settings
 */

import { PrismaClient } from '@prisma/client';
import { DomainAdapterFactory } from '../domain-adapters/DomainAdapterFactory';

const prisma = new PrismaClient();

export interface DomainConfig {
  id: string;
  organizationId: string;
  domainType: string;
  entityFields: Record<string, any>;
  statusEnum: string[];
  priorityRules: Record<string, any>;
  validationSchemas: Record<string, any>;
  projectTemplates: any[];
  missionTemplates: any[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Default configurations per domain
 */
const DEFAULT_CONFIGS: Record<string, Partial<DomainConfig>> = {
  electricity: {
    statusEnum: ['planning', 'connected', 'maintenance', 'disconnected'],
    entityFields: {
      fields: [
        'name',
        'numeroordre',
        'phone',
        'status',
        'voltage',
        'connectionDate',
        'region',
        'departement',
        'village',
      ],
    },
    priorityRules: {
      low_voltage_threshold: 180,
      low_voltage_critical: 150,
      alert_threshold: 0.8,
      warning_threshold: 0.6,
    },
  },
  agriculture: {
    statusEnum: ['idle', 'planted', 'growing', 'harvested', 'alert'],
    entityFields: {
      fields: ['name', 'crop', 'area', 'soilType', 'waterSource', 'status', 'yield'],
    },
    priorityRules: {
      pest_detection: 'critical',
      water_shortage: 'high',
      soil_degradation: 'medium',
    },
  },
  health: {
    statusEnum: ['operational', 'understaffed', 'closed', 'alert'],
    entityFields: {
      fields: ['name', 'type', 'beds', 'staff', 'status', 'equipment'],
    },
    priorityRules: {
      stock_critical: 'critical',
      staff_shortage: 'high',
      equipment_failure: 'high',
    },
  },
  logistics: {
    statusEnum: ['operational', 'understocked', 'full', 'delayed'],
    entityFields: {
      fields: ['name', 'location', 'capacity', 'stock', 'status'],
    },
    priorityRules: {
      stock_below_min: 'high',
      delivery_delayed: 'high',
      capacity_exceeded: 'critical',
    },
  },
};

export class DomainConfigService {
  /**
   * Cache for configs (organizationId + domainType -> config)
   */
  private static cache = new Map<string, DomainConfig>();

  /**
   * Get domain configuration for organization
   * Uses cache, loads from DB, or creates default
   */
  static async getConfig(organizationId: string, domainType: string): Promise<DomainConfig> {
    const cacheKey = `${organizationId}:${domainType}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Load from database
    let config = await prisma.domainConfig.findUnique({
      where: {
        organizationId_domainType: {
          organizationId,
          domainType,
        },
      },
    });

    // If not found, create default config
    if (!config) {
      config = await this.createDefaultConfig(organizationId, domainType);
    }

    // Cache it
    this.cache.set(cacheKey, config as DomainConfig);

    return config as DomainConfig;
  }

  /**
   * Create default configuration for domain
   */
  private static async createDefaultConfig(
    organizationId: string,
    domainType: string
  ): Promise<any> {
    const defaults = DEFAULT_CONFIGS[domainType] || DEFAULT_CONFIGS.electricity;

    const config = await prisma.domainConfig.create({
      data: {
        organizationId,
        domainType,
        entityFields: defaults.entityFields || {},
        statusEnum: defaults.statusEnum || [],
        priorityRules: defaults.priorityRules || {},
        validationSchemas: {},
        projectTemplates: [],
        missionTemplates: [],
        metadata: {},
      },
    });

    return config;
  }

  /**
   * Update domain configuration
   */
  static async updateConfig(
    organizationId: string,
    domainType: string,
    updates: Partial<DomainConfig>
  ): Promise<DomainConfig> {
    const config = await prisma.domainConfig.update({
      where: {
        organizationId_domainType: {
          organizationId,
          domainType,
        },
      },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    const cacheKey = `${organizationId}:${domainType}`;
    this.cache.delete(cacheKey);

    return config as DomainConfig;
  }

  /**
   * Validate entity using domain adapter and config
   */
  static async validateEntity(
    organizationId: string,
    domainType: string,
    entity: any
  ): Promise<{ valid: boolean; errors: any[] }> {
    try {
      const adapter = DomainAdapterFactory.getAdapter(domainType);
      const errors = adapter.validateEntity(entity);

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{ message: error instanceof Error ? error.message : String(error) }],
      };
    }
  }

  /**
   * Get status options for domain
   */
  static async getStatusOptions(organizationId: string, domainType: string): Promise<string[]> {
    const config = await this.getConfig(organizationId, domainType);
    return config.statusEnum || [];
  }

  /**
   * Clear cache (useful for testing)
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get all domain configurations for organization
   */
  static async getAllConfigs(organizationId: string): Promise<DomainConfig[]> {
    const configs = await prisma.domainConfig.findMany({
      where: { organizationId },
    });

    return configs as DomainConfig[];
  }

  /**
   * Get supported domains (adapted + configs created)
   */
  static async getSupportedDomains(organizationId: string): Promise<string[]> {
    const supported = DomainAdapterFactory.getSupportedDomains();

    // Filter to only domains with configs for this org
    const configs = await this.getAllConfigs(organizationId);
    const configuredDomains = configs.map((c) => c.domainType);

    return supported.filter((d) => configuredDomains.includes(d));
  }
}
