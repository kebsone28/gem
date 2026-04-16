import type { Household } from '../../utils/types';
import type { PVType } from './PVAIEngine';

export interface PVDecisionRule {
  field: string;
  operator: 'equals' | 'includes' | 'exists' | 'boolean' | 'greater_than';
  value?: string | number | boolean;
  result: PVType;
}

/**
 * Projet-Specific Rules
 * This allows administrators to change how PVs are assigned online without modifying code.
 * (Usually fetched from database JSON)
 */
export const DEFAULT_PV_RULES: PVDecisionRule[] = [
  // Règles critiques HSE (Tolérance Zéro)
  { field: 'koboData.hse_violation', operator: 'equals', value: 'yes', result: 'PVHSE' },
  { field: 'koboSync.hseViolation', operator: 'equals', value: 'yes', result: 'PVHSE' },

  // Règles d'Abandon et Inéligibilité (Hors Projet)
  { field: 'koboData.Situation_du_M_nage', operator: 'includes', value: 'menage_non_eligible', result: 'PVINE' },
  { field: 'koboData.Situation_du_M_nage', operator: 'includes', value: 'menage_injoignable', result: 'PVINE' },
  { field: 'koboData.group_wu8kv54/Situation_du_M_nage', operator: 'includes', value: 'menage_non_eligible', result: 'PVINE' },
  { field: 'koboData.group_wu8kv54/justificatif', operator: 'includes', value: 'desistement_du_menage', result: 'PVINE' },
  { field: 'koboData.group_wu8kv54/justificatif', operator: 'includes', value: 'probleme_technique_d_installation', result: 'PVINE' },
  { field: 'koboData.group_wu8kv54/justificatif', operator: 'includes', value: 'maison_en_paille', result: 'PVINE' },
  { field: 'koboData.justificatif', operator: 'includes', value: 'desistement_du_menage', result: 'PVINE' },
  { field: 'koboData.justificatif', operator: 'includes', value: 'probleme_technique_d_installation', result: 'PVINE' },
  { field: 'koboData.justificatif', operator: 'includes', value: 'maison_en_paille', result: 'PVINE' },
  { field: 'koboData.eligibilite', operator: 'equals', value: 'ineligible', result: 'PVINE' },
  { field: 'koboData.status_global', operator: 'equals', value: 'abandon', result: 'PVINE' },

  // Règles de Non-Conformité Techniques
  { field: 'koboData.status_global', operator: 'equals', value: 'refused', result: 'PVNC' },
  { field: 'koboSync.controleOk', operator: 'equals', value: false, result: 'PVNC' },
  { field: 'constructionData.controle.conforme', operator: 'equals', value: false, result: 'PVNC' },
  { field: 'constructionData.macon.termine', operator: 'equals', value: false, result: 'PVNC' },
  { field: 'constructionData.controle.resistance_terre', operator: 'greater_than', value: 1500, result: 'PVNC' },

  // Règles de Délais / Retards
  { field: 'koboData.delay_detected', operator: 'equals', value: 'yes', result: 'PVRET' },
  { field: 'koboSync.retard', operator: 'equals', value: true, result: 'PVRET' }
];

/**
 * Moteur d'évaluation dynamique des règles.
 * Remplace les "if/else" statiques par un traitement de graphe JSON
 */
export const PVRulesEngine = {
  getNestedValue(obj: any, path: string) {
    return path.split('.').reduce((acc, part) => (acc === undefined || acc === null ? undefined : acc[part]), obj);
  },

  evaluate(submission: Household, rules: PVDecisionRule[] = DEFAULT_PV_RULES, fallback: PVType = 'PVR'): PVType {
    if (!submission) return fallback;

    for (const rule of rules) {
      const actualValue = this.getNestedValue(submission, rule.field);
      
      switch (rule.operator) {
        case 'equals':
          if (actualValue === rule.value) return rule.result;
          break;
        case 'includes':
          if (typeof actualValue === 'string' && typeof rule.value === 'string' && actualValue.includes(rule.value)) return rule.result;
          if (Array.isArray(actualValue) && actualValue.includes(rule.value)) return rule.result;
          break;
        case 'exists':
          if (actualValue !== undefined && actualValue !== null && actualValue !== '') return rule.result;
          break;
        case 'boolean':
          if (!!actualValue === rule.value) return rule.result;
          break;
        case 'greater_than':
          if (typeof actualValue === 'number' && typeof rule.value === 'number' && actualValue > rule.value) return rule.result;
          if (typeof actualValue === 'string' && typeof rule.value === 'number' && Number(actualValue) > rule.value) return rule.result;
          break;
      }
    }
    
    return fallback;
  },

  evaluateAll(submission: Household, rules: PVDecisionRule[] = DEFAULT_PV_RULES): PVType[] {
    if (!submission) return ['PVR'];

    const results = new Set<PVType>();
    for (const rule of rules) {
      const actualValue = this.getNestedValue(submission, rule.field);
      
      switch (rule.operator) {
        case 'equals':
          if (actualValue === rule.value) results.add(rule.result);
          break;
        case 'includes':
          if (typeof actualValue === 'string' && typeof rule.value === 'string' && actualValue.includes(rule.value)) results.add(rule.result);
          if (Array.isArray(actualValue) && actualValue.includes(rule.value)) results.add(rule.result);
          break;
        case 'exists':
          if (actualValue !== undefined && actualValue !== null && actualValue !== '') results.add(rule.result);
          break;
        case 'boolean':
          if (!!actualValue === rule.value) results.add(rule.result);
          break;
        case 'greater_than':
          if (typeof actualValue === 'number' && typeof rule.value === 'number' && actualValue > rule.value) results.add(rule.result);
          if (typeof actualValue === 'string' && typeof rule.value === 'number' && Number(actualValue) > rule.value) results.add(rule.result);
          break;
      }
    }
    
    if (results.has('PVINE')) {
      return ['PVINE'];
    }
    
    if (results.size === 0) {
      results.add('PVR');
      results.add('PVRD');
    }
    
    return Array.from(results);
  }
};
