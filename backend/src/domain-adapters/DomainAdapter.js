/**
 * DomainAdapter - Abstract pattern for domain-specific implementations
 *
 * Each domain (electricity, agriculture, health, logistics, etc.)
 * implements this interface to handle domain-specific normalization,
 * validation, alerting, and status derivation logic.
 */

export class DomainAdapter {
  /**
   * Unique domain identifier
   * "electricity" | "agriculture" | "health" | "logistics"
   */
  get domainType() {
    throw new Error('domainType must be implemented');
  }

  /**
   * Normalize raw data from any source (Kobo, API, form, etc.)
   * into standard NormalizedEntity format
   */
  async normalizeEntity(rawData) {
    throw new Error('normalizeEntity must be implemented');
  }

  /**
   * Validate entity according to domain-specific rules
   * @returns empty array if valid, array of ValidationError otherwise
   */
  validateEntity(entity) {
    throw new Error('validateEntity must be implemented');
  }

  /**
   * Derive status from entity data using domain-specific business logic
   */
  deriveStatus(entity) {
    throw new Error('deriveStatus must be implemented');
  }

  /**
   * Generate domain-specific alerts for entity
   */
  generateAlerts(entity) {
    throw new Error('generateAlerts must be implemented');
  }

  /**
   * Get list of fields to monitor/display for this domain
   */
  getEntityFields() {
    throw new Error('getEntityFields must be implemented');
  }

  /**
   * Return optimal Prisma query shape (select/include) for this domain
   * Used to optimize database queries
   */
  getOptimalQueryShape() {
    throw new Error('getOptimalQueryShape must be implemented');
  }

  /**
   * Optional: Custom query builder for advanced filtering
   */
  buildEntityQuery(filters) {
    return { where: filters };
  }
}

export const ValidationError = {
  // Type definition as object for reference
};

export const Alert = {
  // Type definition as object for reference
};

export const NormalizedEntity = {
  // Type definition as object for reference
};
