/**
 * DomainAdapterFactory
 *
 * Registry pattern for domain adapters.
 * Each domain registers its adapter, and the factory
 * returns the correct adapter for a given domain type.
 */

import { ElectrificationAdapter } from './adapters/ElectrificationAdapter.js';
// import { AgricultureAdapter } from './adapters/AgricultureAdapter.js';
// import { HealthAdapter } from './adapters/HealthAdapter.js';
// import { LogisticsAdapter } from './adapters/LogisticsAdapter.js';

export class DomainAdapterFactory {
  static adapters = new Map();

  /**
   * Initialize adapters at startup
   */
  static {
    // Register adapters at startup
    DomainAdapterFactory.register(new ElectrificationAdapter());
    // Future domains will be registered here
    // DomainAdapterFactory.register(new AgricultureAdapter());
    // DomainAdapterFactory.register(new HealthAdapter());
    // DomainAdapterFactory.register(new LogisticsAdapter());
  }

  /**
   * Register a domain adapter
   */
  static register(adapter) {
    if (this.adapters.has(adapter.domainType)) {
      console.warn(`Domain adapter '${adapter.domainType}' already registered, overwriting`);
    }
    this.adapters.set(adapter.domainType, adapter);
  }

  /**
   * Get adapter for a specific domain type
   * @throws Error if domain not registered
   */
  static getAdapter(domainType) {
    const adapter = this.adapters.get(domainType);

    if (!adapter) {
      const supported = Array.from(this.adapters.keys()).join(', ');
      throw new Error(`Domain adapter not found: '${domainType}'. Supported domains: ${supported}`);
    }

    return adapter;
  }

  /**
   * Check if domain is registered
   */
  static hasAdapter(domainType) {
    return this.adapters.has(domainType);
  }

  /**
   * Get all supported domain types
   */
  static getSupportedDomains() {
    return Array.from(this.adapters.keys()).sort();
  }

  /**
   * Get total number of registered adapters
   */
  static getAdapterCount() {
    return this.adapters.size;
  }
}
