/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Household } from './types';
import { getStatusMeta, normalizeStatus } from '../domain/status/statusUtils';

/**
 * Obtenir la couleur hex d'un statut
 */
export const getStatusHexColor = (status?: string): string => {
  const meta = getStatusMeta(status);
  // Un peu hacky mais on continue de supporter text-XYZ-500 vers hex
  if (meta.color.includes('emerald')) return '#10b981';
  if (meta.color.includes('rose')) return '#f43f5e';
  if (meta.color.includes('blue')) return '#3b82f6';
  if (meta.color.includes('cyan')) return '#06b6d4';
  if (meta.color.includes('amber')) return '#f59e0b';
  if (meta.color.includes('indigo')) return '#818cf8';
  return '#64748b'; // slate fallback
};

/**
 * Obtenir les classes Tailwind CSS pour un statut (texte + fond)
 * @deprecated Use getStatusMeta(status) directly instead
 */
export const getStatusTailwindClasses = (status?: string) => {
  const meta = getStatusMeta(status);
  return {
    text: meta.color,
    bg: meta.bg,
  };
};

export const getHouseholdDerivedStatus = (h: Household) => {
  if (!h) return 'Non encore installée';

  // 1. Statuts bloquants et normalisés
  const normalized = normalizeStatus(h.status);
  if (['Non éligible', 'Désistement', 'Refusé'].includes(normalized)) return normalized;

  // 2. Alertes critiques
  const alerts = Array.isArray(h.alerts) ? h.alerts : [];
  if (
    alerts.some(
      (a: { severity?: string; type?: string }) => a.severity === 'HIGH' || a.type === 'CRITICAL'
    )
  )
    return 'Non conforme';

  // 3. Nouvelle architecture (constructionData)
  const cData: any = h.constructionData || null;
  if (cData) {
    if (
      cData.audit?.installation_conforme === 'conforme' ||
      cData.audit?.branchement_conforme === 'conforme' ||
      normalized === 'Contrôle conforme'
    ) {
      return 'Contrôle conforme';
    }

    if (
      cData.audit?.installation_conforme === 'non_conforme' ||
      cData.audit?.branchement_conforme === 'non-conforme' ||
      h.status === 'BLOQUE'
    ) {
      return 'Non conforme';
    }

    if (cData.interiorStatus === 'COMPLETE') return 'Intérieur terminé';
    if (cData.networkStatus === 'COMPLETE') return 'Réseau terminé';
    if (['STANDARD', 'CHIMNEY'].includes(String(cData.wallType))) return 'Murs terminés';
    if (cData.kit?.status === 'COMPLETE') return 'Livraison effectuée';
  }

  // 4. Ancien système Kobo
  if (h.koboSync?.controleOk === true) return 'Contrôle conforme';
  if (h.koboSync?.controleOk === false) return 'Non conforme';
  if (h.koboSync?.interieurOk) return 'Intérieur terminé';
  if (h.koboSync?.reseauOk) return 'Réseau terminé';
  if (h.koboSync?.maconOk) return 'Murs terminés';
  if (h.koboSync?.livreurDate) return 'Livraison effectuée';

  // 5. Statut brut fallback
  if (h.status) {
    const finalStatus = normalizeStatus(h.status);
    if (finalStatus !== 'Inconnu') return finalStatus;
  }

  return 'Non encore installée';
};
