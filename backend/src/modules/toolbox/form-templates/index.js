/**
 * Form Templates — GED OS Toolbox
 * Collection de templates de formulaires pré-faits pour démarrage rapide
 * Inspiré des templates KoboToolbox, adaptés aux besoins terrain GED OS
 */
import electrifTemplate from './electrification.js';
import santeTemplate from './sante.js';
import eauTemplate from './eau-assainissement.js';
import educationTemplate from './education.js';

export const FORM_TEMPLATES = [
  electrifTemplate,
  santeTemplate,
  eauTemplate,
  educationTemplate,
];

export function getTemplateByKey(key) {
  return FORM_TEMPLATES.find((t) => t.key === key) || null;
}

export function getTemplatesBySector(sector) {
  return FORM_TEMPLATES.filter((t) => t.sector === sector);
}

export default FORM_TEMPLATES;
