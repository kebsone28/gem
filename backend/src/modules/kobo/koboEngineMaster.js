/**
 * Kobo Engine Master v2.0
 * Système de mapping dynamique et auto-adaptatif pour les formulaires Kobo
 * 
 * Fonctionnalités:
 * - Auto-détection des champs depuis le formulaire Kobo
 * - Mapping flexible avec alias multiples
 * - Versioning des formulaires
 * - Fallback intelligent
 * - Migration automatique des données
 */

import prisma from '../../core/utils/prisma.js';
import logger from '../../utils/logger.js';

// Alias known pour les champs métier (multilingue Kobo)
const FIELD_ALIASES = {
  // Numéro d'ordre
  numeroOrdre: ['numeroOrdre', 'numeroordre', 'numero_ordre', 'numero', 'order_number', 'N°', 'numero_dossier'],
  
  // Nom du ménage/owner
  name: ['name', 'nom', 'nom_menage', 'nom_du_menage', 'household_name', 'owner_name', 'owner.nom', 'nom_proprio'],
  
  // Téléphone
  phone: ['phone', 'telephone', 'tel', 'contact', 'contact_phone', 'owner.phone', 'numero_telephone', 'tel_mobile'],
  
  // Status
  status: ['status', 'statut', 'etat', 'etat_menage', 'household_status', 'statut_menage'],
  
  // Région
  region: ['region', 'region_name', 'nom_region', 'admin_region'],
  
  // Village
  village: ['village', 'nom_village', 'commune', 'localite'],
  
  // Département
  departement: ['departement', 'dept', 'admin_dept'],
  
  // Géolocalisation
  latitude: ['latitude', 'lat', 'gps_latitude', 'geopoint_lat'],
  longitude: ['longitude', 'lon', 'gps_longitude', 'geopoint_lon'],
  
  // Date
  date: ['date', 'date_creation', 'submission_date', '_submitted_at'],
  
  // ID externe Kobo
  koboId: ['_id', 'id', 'kobo_id', 'submission_id', '_uuid']
};

/**
 * Classe principale du moteur Kobo
 */
export class KoboEngineMaster {
  constructor() {
    this.cache = new Map(); // Cache des formulaires
    this.mappings = new Map(); // Cache des mappings
  }

  /**
   * Récupère la définition du formulaire Kobo depuis l'API Kobo
   */
  async fetchFormDefinition(koboAssetId, koboServerUrl) {
    const cacheKey = `${koboServerUrl}:${koboAssetId}`;
    
    // Vérifier le cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`${koboServerUrl}/api/v2/assets/${koboAssetId}/`, {
        headers: { 'Authorization': `Token ${process.env.KOBO_TOKEN}` }
      });
      
      if (!response.ok) throw new Error(`Kobo API error: ${response.status}`);
      
      const asset = await response.json();
      const formDef = {
        assetId: asset.uid,
        name: asset.name,
        version: asset.version_number || '1',
        fields: this.extractFields(asset.content),
        settings: asset.settings,
        deployed: asset.deployed
      };
      
      this.cache.set(cacheKey, formDef);
      return formDef;
    } catch (error) {
      logger.error('[KOBO_ENGINE] Fetch form definition failed:', error);
      throw error;
    }
  }

  /**
   * Extrait les champs depuis le contenu du formulaire Kobo
   */
  extractFields(content) {
    const fields = [];
    const survey = content?.survey || [];
    
    for (const row of survey) {
      if (row.type === 'begin_group') continue;
      if (row.type === 'end_group') continue;
      
      fields.push({
        name: row.name,
        type: row.type,
        label: row.label || row.hint || row.name,
        required: row.required === 'true' || row.required === true,
        constraint: row.constraint,
        default: row.default,
        choiceFilter: row.choice_filter
      });
    }
    
    return fields;
  }

  /**
   * Trouve le champ Kobo correspondant à un concept métier (avec alias)
   */
  findFieldForConcept(formFields, concept) {
    const aliases = FIELD_ALIASES[concept] || [concept];
    
    for (const alias of aliases) {
      // Recherche exacte
      let field = formFields.find(f => f.name === alias);
      if (field) return field;
      
      // Recherche insensible à la casse
      field = formFields.find(f => f.name.toLowerCase() === alias.toLowerCase());
      if (field) return field;
      
      // Recherche par label
      field = formFields.find(f => 
        f.label && f.label.toLowerCase().includes(alias.toLowerCase())
      );
      if (field) return field;
    }
    
    return null; // Pas de correspondance trouvée
  }

  /**
   * Génère le mapping automatique pour un formulaire
   */
  async generateMapping(koboAssetId, koboServerUrl) {
    const formDef = await this.fetchFormDefinition(koboAssetId, koboServerUrl);
    const fields = formDef.fields;
    
    const mapping = {
      version: formDef.version,
      generatedAt: new Date().toISOString(),
      fields: {}
    };

    // Mapper chaque concept métier
    for (const concept of Object.keys(FIELD_ALIASES)) {
      const field = this.findFieldForConcept(fields, concept);
      
      if (field) {
        mapping.fields[concept] = {
          koboField: field.name,
          koboType: field.type,
          confidence: this.calculateConfidence(field, concept),
          label: field.label
        };
      } else {
        mapping.fields[concept] = {
          koboField: null,
          koboType: null,
          confidence: 0,
          label: null,
          warning: `Aucun champ Kobo trouvé pour le concept: ${concept}`
        };
      }
    }

    return mapping;
  }

  /**
   * Calcule le niveau de confiance du mapping (0-100%)
   */
  calculateConfidence(field, concept) {
    if (!field) return 0;
    
    const aliases = FIELD_ALIASES[concept];
    const exactMatch = aliases.includes(field.name);
    const caseMatch = aliases.some(a => a.toLowerCase() === field.name.toLowerCase());
    
    if (exactMatch) return 100;
    if (caseMatch) return 80;
    if (field.label && aliases.some(a => field.label.toLowerCase().includes(a.toLowerCase()))) {
      return 60;
    }
    
    return 40; // Matching faible
  }

  /**
   * Transforme les données Kobo en format GEM avec le mapping
   */
  transformData(koboData, mapping) {
    const result = {};
    
    for (const [concept, mappingInfo] of Object.entries(mapping.fields)) {
      if (!mappingInfo.koboField) {
        result[concept] = null;
        continue;
      }
      
      // Naviguer dans les objets imbriqués (ex: owner.nom)
      const value = this.getNestedValue(koboData, mappingInfo.koboField);
      result[concept] = this.normalizeValue(value, concept, mappingInfo.koboType);
    }
    
    return result;
  }

  /**
   * Récupère une valeur dans un objet avec notation pointée
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  /**
   * Normalise la valeur selon le type de concept
   */
  normalizeValue(value, concept, koboType) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    switch (concept) {
      case 'latitude':
      case 'longitude':
        return parseFloat(value) || null;
        
      case 'phone':
        // Normaliser le téléphone
        return value.toString().replace(/[\s\-\(\)]/g, '').trim();
        
      case 'koboId':
        return value.toString();
        
      default:
        return value.toString().trim();
    }
  }

  /**
   * Sauvegarde le mapping dans la base de données
   */
  async saveMapping(organizationId, koboAssetId, mapping) {
    const existing = await prisma.koboFormMapping.findFirst({
      where: { organizationId, koboAssetId }
    });

    if (existing) {
      return prisma.koboFormMapping.update({
        where: { id: existing.id },
        data: {
          mapping: mapping,
          version: mapping.version,
          lastValidated: new Date()
        }
      });
    }

    return prisma.koboFormMapping.create({
      data: {
        organizationId,
        koboAssetId,
        mapping: mapping,
        version: mapping.version
      }
    });
  }

  /**
   * Charge le mapping depuis la base (ou génère si absent)
   */
  async getMapping(organizationId, koboAssetId, koboServerUrl) {
    // Chercher dans la DB
    const stored = await prisma.koboFormMapping.findFirst({
      where: { organizationId, koboAssetId }
    });

    if (stored) {
      return stored.mapping;
    }

    // Générer automatiquement si absent
    const generated = await this.generateMapping(koboAssetId, koboServerUrl);
    await this.saveMapping(organizationId, koboAssetId, generated);
    
    return generated;
  }

  /**
   * Détecte les changements dans le formulaire Kobo
   */
  async detectFormChanges(organizationId, koboAssetId, koboServerUrl) {
    const storedMapping = await prisma.koboFormMapping.findFirst({
      where: { organizationId, koboAssetId }
    });

    if (!storedMapping) {
      return { changed: true, reason: 'Aucun mapping existant' };
    }

    const currentForm = await this.fetchFormDefinition(koboAssetId, koboServerUrl);
    const currentVersion = currentForm.version;
    const storedVersion = storedMapping.version;

    if (currentVersion !== storedVersion) {
      return {
        changed: true,
        reason: `Version changée: ${storedVersion} → ${currentVersion}`,
        oldVersion: storedVersion,
        newVersion: currentVersion
      };
    }

    // Vérifier si des champs ont été ajoutés/supprimés
    const currentFields = new Set(currentForm.fields.map(f => f.name));
    const mappedFields = new Set(
      Object.values(storedMapping.mapping.fields)
        .filter(f => f.koboField)
        .map(f => f.koboField)
    );

    const addedFields = [...currentFields].filter(f => !mappedFields.has(f));
    const removedFields = [...mappedFields].filter(f => !currentFields.has(f));

    if (addedFields.length > 0 || removedFields.length > 0) {
      return {
        changed: true,
        reason: 'Champs ajoutés ou supprimés',
        addedFields,
        removedFields
      };
    }

    return { changed: false };
  }

  /**
   * Migre automatiquement vers le nouveau mapping
   */
  async migrateMapping(organizationId, koboAssetId, koboServerUrl) {
    const changes = await this.detectFormChanges(organizationId, koboAssetId, koboServerUrl);
    
    if (!changes.changed) {
      return { migrated: false, message: 'Aucun changement détecté' };
    }

    logger.info(`[KOBO_ENGINE] Migration nécessaire: ${changes.reason}`);

    // Générer nouveau mapping
    const newMapping = await this.generateMapping(koboAssetId, koboServerUrl);
    
    // Sauvegarder
    await this.saveMapping(organizationId, koboAssetId, newMapping);

    return {
      migrated: true,
      changes,
      newMapping
    };
  }
}

// Instance singleton
export const koboEngine = new KoboEngineMaster();

export default koboEngine;