/**
 * DomainRenderAdapterFactory
 *
 * Frontend registry for domain render adapters
 * Each domain registers its render adapter
 */

import { DomainRenderAdapter } from './DomainRenderAdapter';
import { ElectrificationRenderAdapter } from './ElectrificationRenderAdapter';

export class DomainRenderAdapterFactory {
  private static adapters = new Map<string, DomainRenderAdapter>();

  static {
    // Register render adapters
    this.register('electricity', new ElectrificationRenderAdapter());
    // Future domains will be registered here
    // this.register('agriculture', new AgricultureRenderAdapter());
    // this.register('health', new HealthRenderAdapter());
    // this.register('logistics', new LogisticsRenderAdapter());
  }

  /**
   * Register a domain render adapter
   */
  static register(domainType: string, adapter: DomainRenderAdapter): void {
    if (this.adapters.has(domainType)) {
      console.warn(`Render adapter for '${domainType}' already registered, overwriting`);
    }
    this.adapters.set(domainType, adapter);
  }

  /**
   * Get render adapter for domain
   */
  static getAdapter(domainType: string): DomainRenderAdapter {
    const adapter = this.adapters.get(domainType);

    if (!adapter) {
      console.warn(
        `Render adapter not found for domain '${domainType}'. Using electricity adapter as fallback.`
      );
      return this.adapters.get('electricity')!;
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
