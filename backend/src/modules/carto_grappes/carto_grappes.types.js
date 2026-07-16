/**
 * @module carto_grappes.types
 * Contrat de types partagé entre le frontend et le backend
 * Ces définitions JSDoc servent de source de vérité pour les échanges API
 */

/**
 * @typedef {Object} LotEntry
 * @property {string} status - 'non_fait' | 'en_cours' | 'fait' | 'non_conforme' | 'bloque_acces' | 'bloque_absent' | 'bloque_refus' | 'bloque_support' | 'bloque_materiel' | 'bloque_securite' | 'reporte' | 'autre'
 * @property {string} justif
 * @property {string|null} updatedAt
 */

/**
 * @typedef {Object} HouseholdEntry
 * @property {LotEntry} A
 * @property {LotEntry} B
 * @property {LotEntry} C
 * @property {boolean} conforme
 * @property {string} obs
 */

/**
 * @typedef {Object} EntrepreneurData
 * @property {string} entreprise
 * @property {string} societe
 * @property {string} telephone
 * @property {string} email
 * @property {string} adresse
 */

/**
 * @typedef {Object} VillageOverrideData
 * @property {string} villageKey - Format: "Region|VillageName"
 * @property {number} grappeNumber
 */

/**
 * @typedef {Object} CartoWebhookEvent
 * @property {'entries'|'config'|'overrides'|'history'|'settings'|'workflow'|'archive'|'stats'|'planning'|'gantt'|'fiches'|'photos'|'templates'|'alerts'} type
 * @property {string} [organizationId]
 */

export {};
