/**
 * DomainAdapter - Abstract pattern for domain-specific implementations
 *
 * Each domain (electricity, agriculture, health, logistics, etc.)
 * implements this interface to handle domain-specific normalization,
 * validation, alerting, and status derivation logic.
 */

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface Alert {
  id?: string;
  type: string; // "alert_type" | "warning_type"
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  metadata?: Record<string, any>;
}

export interface NormalizedEntity {
  id: string;
  name?: string;
  location?: {
    lat: number;
    lng: number;
    wkt?: string;
  };
  status: string;
  domainData: Record<string, any>; // Domain-specific fields
  metadata?: Record<string, any>;
}

export abstract class DomainAdapter {
  /**
   * Unique domain identifier
   * "electricity" | "agriculture" | "health" | "logistics"
   */
  abstract domainType: string;

  /**
   * Normalize raw data from any source (Kobo, API, form, etc.)
   * into standard NormalizedEntity format
   */
  abstract normalizeEntity(rawData: any): Promise<NormalizedEntity>;

  /**
   * Validate entity according to domain-specific rules
   * @returns empty array if valid, array of ValidationError otherwise
   */
  abstract validateEntity(entity: any): ValidationError[];

  /**
   * Derive status from entity data using domain-specific business logic
   */
  abstract deriveStatus(entity: any): string;

  /**
   * Generate domain-specific alerts for entity
   */
  abstract generateAlerts(entity: any): Alert[];

  /**
   * Get list of fields to monitor/display for this domain
   */
  abstract getEntityFields(): string[];

  /**
   * Return optimal Prisma query shape (select/include) for this domain
   * Used to optimize database queries
   */
  abstract getOptimalQueryShape(): Record<string, any>;

  /**
   * Optional: Custom query builder for advanced filtering
   */
  buildEntityQuery?(filters: Record<string, any>): Record<string, any> {
    return { where: filters };
  }
}
