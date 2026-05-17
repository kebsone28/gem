/**
 * Backend Domain Adapters Index
 * Central export for all domain adapter functionality
 */

export { DomainAdapter, ValidationError, Alert, NormalizedEntity } from './DomainAdapter';
export { DomainAdapterFactory } from './DomainAdapterFactory';
export { ElectrificationAdapter } from './adapters/ElectrificationAdapter';

// Future adapters
// export { AgricultureAdapter } from './adapters/AgricultureAdapter';
// export { HealthAdapter } from './adapters/HealthAdapter';
// export { LogisticsAdapter } from './adapters/LogisticsAdapter';
