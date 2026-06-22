/**
 * DomainRenderAdapterFactory
 *
 * Frontend registry for domain render adapters
 * Each domain registers its render adapter
 */

import { DomainRenderAdapter } from './DomainRenderAdapter';
import { ElectrificationRenderAdapter } from './ElectrificationRenderAdapter';
import logger from '../services/logger';

export class DomainRenderAdapterFactory {
  private static adapters = new Map<string, DomainRenderAdapter>();

  static {
    // Register render adapters
    this.register('gem', new ElectrificationRenderAdapter());
    this.register('mes', new ElectrificationRenderAdapter());
  }

  /**
   * Register a domain render adapter
   */
  static register(domainType: string, adapter: DomainRenderAdapter): void {
    if (this.adapters.has(domainType)) {
      logger.warn(`Render adapter for '${domainType}' already registered, overwriting`);
    }
    this.adapters.set(domainType, adapter);
  }

  /**
   * Get render adapter for domain
   */
  static getAdapter(domainType: string): DomainRenderAdapter {
    const adapter = this.adapters.get(domainType);

    if (!adapter) {
      logger.warn(
        `Render adapter not found for domain '${domainType}'. Using gem adapter as fallback.`
      );
      return this.adapters.get('gem')!;
    }

    return adapter;
  }

  /**
   * Check if render adapter exists
   */
  static hasAdapter(domainType: string): boolean {
    return this.adapters.has(domainType);
  }

  /**
   * Get all supported domains
   */
  static getSupportedDomains(): string[] {
    return Array.from(this.adapters.keys()).sort();
  }
}
