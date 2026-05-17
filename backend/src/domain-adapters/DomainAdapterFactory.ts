/**
 * DomainAdapterFactory
 *
 * Registry pattern for domain adapters.
 * Each domain registers its adapter, and the factory
 * returns the correct adapter for a given domain type.
 */

import { DomainAdapter } from './DomainAdapter';
import { ElectrificationAdapter } from './adapters/ElectrificationAdapter';
// import { AgricultureAdapter } from './adapters/AgricultureAdapter';
// import { HealthAdapter } from './adapters/HealthAdapter';
// import { LogisticsAdapter } from './adapters/LogisticsAdapter';

export class DomainAdapterFactory {
  private static adapters = new Map<string, DomainAdapter>();

  static {
    // Register adapters at startup
    this.register(new ElectrificationAdapter());
    // Future domains will be registered here
    // this.register(new AgricultureAdapter());
    // this.register(new HealthAdapter());
    // this.register(new LogisticsAdapter());
  }

  /**
   * Register a domain adapter
   */
  static register(adapter: DomainAdapter): void {
    if (this.adapters.has(adapter.domainType)) {
      console.warn(`Domain adapter '${adapter.domainType}' already registered, overwriting`);
    }
    this.adapters.set(adapter.domainType, adapter);
  }

  /**
   * Get adapter for a specific domain type
   * @throws Error if domain not registered
   */
  static getAdapter(domainType: string): DomainAdapter {
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
  static hasAdapter(domainType: string): boolean {
    return this.adapters.has(domainType);
  }

  /**
   * Get all supported domain types
   */
  static getSupportedDomains(): string[] {
    return Array.from(this.adapters.keys()).sort();
  }

  /**
   * Get total number of registered adapters
   */
  static getAdapterCount(): number {
    return this.adapters.size;
  }
}
