/**
 * DomainAdapterFactory
 *
 * Registry pattern for domain adapters.
 * Each domain registers its adapter, and the factory
 * returns the correct adapter for a given domain type.
 */
var _a;
import logger from '../utils/logger.js';
import { ElectrificationAdapter } from './adapters/ElectrificationAdapter.js';
import { TargetingAdapter } from './adapters/TargetingAdapter.js';
import { DataCollectionAdapter } from './adapters/DataCollectionAdapter.js';
import { MESAdapter } from './adapters/MESAdapter.js';
export class DomainAdapterFactory {
    /**
     * Register a domain adapter
     */
    static register(adapter) {
        if (this.adapters.has(adapter.domainType)) {
            logger.warn(`Domain adapter '${adapter.domainType}' already registered, overwriting`);
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
_a = DomainAdapterFactory;
DomainAdapterFactory.adapters = new Map();
(() => {
    // Register all domain adapters at startup
    _a.register(new ElectrificationAdapter());
    _a.register(new TargetingAdapter());
    _a.register(new DataCollectionAdapter());
    _a.register(new MESAdapter());
})();
