/**
 * DomainConfigService
 *
 * Manages domain configuration per organization
 * Loads, caches, and provides domain-specific settings
 */
import prisma from '../../core/utils/prisma.js';
import { DomainAdapterFactory } from '../../domain-adapters/DomainAdapterFactory.js';
/**
 * Default configurations per domain
 */
const DEFAULT_CONFIGS = {
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
    high_voltage: {
        statusEnum: ['operational', 'maintenance_overdue', 'overloaded', 'alert'],
        entityFields: {
            fields: ['name', 'type', 'voltageCapacity', 'currentLoad', 'maxLoad', 'status'],
        },
        priorityRules: {
            load_critical: 'critical',
            maintenance_overdue: 'high',
        },
    },
    solar: {
        statusEnum: ['active', 'degraded', 'faulty'],
        entityFields: {
            fields: ['name', 'systemType', 'capacityWp', 'batteryHealth', 'dailyGenerationWh', 'status'],
        },
        priorityRules: {
            battery_critical: 'critical',
            generation_zero: 'high',
        },
    },
    targeting: {
        statusEnum: ['identified', 'approved', 'rejected'],
        entityFields: {
            fields: ['name', 'score', 'eligibilityStatus', 'vulnerabilityFactors', 'status'],
        },
        priorityRules: {
            high_vulnerability: 'high',
        },
    },
    data_collection: {
        statusEnum: ['draft', 'in_progress', 'completed', 'flagged'],
        entityFields: {
            fields: ['name', 'formId', 'surveyorId', 'platform', 'completeness', 'qualityScore', 'status'],
        },
        priorityRules: {
            quality_critical: 'critical',
        },
        metadata: {
            // Paramétrage explicite du choix de l'écosystème pour le tenant
            defaultEcosystem: 'ged', // Choix: 'ged' ou 'kobo'
            // Paramètres de synchronisation si Kobo est choisi
            koboSync: {
                formIdReference: null, // ex: 'aEYZwPujJiFBTNb6mxMGCB'
                kpiReference: null, // Indicateur KPI lié
                apiToken: null // Jeton d'accès (chiffré en production)
            }
        }
    },
};
export class DomainConfigService {
    /**
     * Get domain configuration for organization
     * Uses cache, loads from DB, or creates default
     */
    static async getConfig(organizationId, domainType) {
        const cacheKey = `${organizationId}:${domainType}`;
        // Check cache
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
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
        this.cache.set(cacheKey, config);
        return config;
    }
    /**
     * Create default configuration for domain
     */
    static async createDefaultConfig(organizationId, domainType) {
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
    static async updateConfig(organizationId, domainType, updates) {
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
        return config;
    }
    /**
     * Validate entity using domain adapter and config
     */
    static async validateEntity(organizationId, domainType, entity) {
        try {
            const adapter = DomainAdapterFactory.getAdapter(domainType);
            const errors = adapter.validateEntity(entity);
            return {
                valid: errors.length === 0,
                errors,
            };
        }
        catch (error) {
            return {
                valid: false,
                errors: [{ message: error instanceof Error ? error.message : String(error) }],
            };
        }
    }
    /**
     * Get status options for domain
     */
    static async getStatusOptions(organizationId, domainType) {
        const config = await this.getConfig(organizationId, domainType);
        return config.statusEnum || [];
    }
    /**
     * Clear cache (useful for testing)
     */
    static clearCache() {
        this.cache.clear();
    }
    /**
     * Get all domain configurations for organization
     */
    static async getAllConfigs(organizationId) {
        const configs = await prisma.domainConfig.findMany({
            where: { organizationId },
        });
        return configs;
    }
    /**
     * Get supported domains (adapted + configs created)
     */
    static async getSupportedDomains(organizationId) {
        const supported = DomainAdapterFactory.getSupportedDomains();
        // Filter to only domains with configs for this org
        const configs = await this.getAllConfigs(organizationId);
        const configuredDomains = configs.map((c) => c.domainType);
        return supported.filter((d) => configuredDomains.includes(d));
    }
}
/**
 * Cache for configs (organizationId + domainType -> config)
 */
DomainConfigService.cache = new Map();
