/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
/**
 * 🏛️ DG DECISION ENGINE (V3.0 SUPREME+)
 * Système d'Aide à la Décision (DSS) & Moteur Prédictif PROQUELEC.
 * 🆕 V3.0 : Score IGPP multi-facteurs | Seuils dynamiques | Détection anomalies renforcée
 */

import type { MissionStats } from '../missionStatsService';
import type { Household, AuditLog } from '../../utils/types';

export interface DGInsight {
  type: 'alert' | 'opportunity' | 'info' | 'prediction' | 'anomaly';
  priority: 'high' | 'medium' | 'low';
  message: string;
  recommendation?: string;
  action?: {
    label: string;
    path: string;
  };
}

/**
 * 📊 CALCUL DU SCORE IGPP 3.0 (Indice Global de Performance PROQUELEC)
 * Pondération multi-facteurs :
 * - 50% Taux de certification (résultats terrain)
 * - 25% Efficience budgétaire (maîtrise des coûts)
 * - 15% Avancement terrain (ménages finalisés)
 * - 10% Bonus qualité (taux ≥ 80% = bonus)
 */
export function computeIGPPScore(stats: MissionStats, households?: Household[]): number {
  if (!stats.totalMissions) return 0;

  // Facteur 1 : Taux de certification (50%)
  const certificationRate =
    stats.totalMissions > 0 ? stats.totalCertified / stats.totalMissions : 0;

  // Facteur 2 : Efficience budgétaire (25%)
  const avgCostPerMission =
    stats.totalMissions > 0 ? stats.totalIndemnities / stats.totalMissions : 0;
  const COST_OPTIMAL = 50000;
  const COST_MAX = 80000;
  const budgetScore =
    avgCostPerMission <= COST_OPTIMAL
      ? 1.0
      : avgCostPerMission >= COST_MAX
        ? 0.0
        : 1 - (avgCostPerMission - COST_OPTIMAL) / (COST_MAX - COST_OPTIMAL);

  // Facteur 3 : Avancement terrain (15%)
  let terrainScore = 0;
  if (households && households.length > 0) {
    const done = households.filter(
      (h) => h.status === 'Terminé' || h.status === 'Réception: Validée'
    ).length;
    terrainScore = done / households.length;
  } else {
    terrainScore = 0.5;
  }

  // Facteur 4 : Bonus qualité si certification ≥ 80% (10%)
  const qualityBonus = certificationRate >= 0.8 ? 1.0 : certificationRate >= 0.6 ? 0.5 : 0.0;

  const rawScore =
    certificationRate * 0.5 + budgetScore * 0.25 + terrainScore * 0.15 + qualityBonus * 0.1;

  return Math.round(Math.max(0, Math.min(100, rawScore * 100)));
}

/** 🧠 MOTEUR PRÉDICTIF : ANTICIPATION DES RISQUES */
export function predictRisks(stats: MissionStats, households: Household[]): DGInsight[] {
  const predictions: DGInsight[] = [];
  const certRate = stats.totalMissions > 0 ? stats.totalCertified / stats.totalMissions : 0;
  const avgCost = stats.totalMissions > 0 ? stats.totalIndemnities / stats.totalMissions : 0;

  // Risque de retard critique
  if (certRate < 0.4 && stats.totalMissions > 10) {
    const projected = Math.round(certRate * 90);
    predictions.push({
      type: 'prediction',
      priority: 'high',
      message: `⚡ **RISQUE DE RETARD CRITIQUE** : Taux de certification à ${Math.round(certRate * 100)}%`,
      recommendation: `Au rythme actuel, projection de ${projected} missions certifiées d'ici 90 jours. Convoquez une session de validation d'urgence.`,
      action: { label: 'Certifier Missions', path: '/approbation' },
    });
  } else if (certRate < 0.6 && stats.totalMissions > 5) {
    predictions.push({
      type: 'prediction',
      priority: 'medium',
      message: `⚠️ **RISQUE DE RALENTISSEMENT** : Taux de certification à ${Math.round(certRate * 100)}%`,
      recommendation: `Cible recommandée : 70% de certification. Planifiez une revue hebdomadaire.`,
      action: { label: 'Voir Missions', path: '/mission-order' },
    });
  }

  // Risque de stagnation terrain
  if (households.length > 0) {
    const enCours = households.filter((h) => h.status === 'En cours').length;
    const tauxEnCours = enCours / households.length;
    if (tauxEnCours > 0.5) {
      predictions.push({
        type: 'prediction',
        priority: 'medium',
        message: `🏘️ **STAGNATION TERRAIN** : ${Math.round(tauxEnCours * 100)}% des ménages en cours (${enCours}/${households.length})`,
        recommendation: 'Blocage logistique probable (câbles/compteurs). Vérifiez les stocks.',
      });
    }
  }

  // Dérive du coût moyen
  if (avgCost > 70000) {
    predictions.push({
      type: 'prediction',
      priority: 'high',
      message: `💸 **DÉRIVE BUDGÉTAIRE GRAVE** : Coût moyen à ${new Intl.NumberFormat('fr-FR').format(Math.round(avgCost))} FCFA/mission`,
      recommendation: 'Seuil critique de 70.000 FCFA dépassé. Audit immédiat requis.',
      action: { label: 'Audit Finances', path: '/admin' },
    });
  } else if (avgCost > 60000) {
    predictions.push({
      type: 'prediction',
      priority: 'medium',
      message: `💰 **DÉRIVE DU COÛT MOYEN** : ${new Intl.NumberFormat('fr-FR').format(Math.round(avgCost))} FCFA/mission`,
      recommendation: 'Le coût dépasse la moyenne historique de 50.000 FCFA.',
      action: { label: 'Audit Finances', path: '/admin' },
    });
  }

  // Opportunité
  if (certRate >= 0.85 && stats.totalMissions >= 10) {
    predictions.push({
      type: 'opportunity',
      priority: 'low',
      message: `✅ **OPPORTUNITÉ** : Excellente cadence de certification (${Math.round(certRate * 100)}%)`,
      recommendation: 'Bastion en zone verte. Accélérez le déploiement.',
    });
  }

  return predictions;
}

/** 🕵️ DÉTECTION D'ANOMALIES RENFORCÉE (V3.0) */
export function detectAnomalies(
  stats: MissionStats,
  households: Household[],
  auditLogs: AuditLog[]
): DGInsight[] {
  const anomalies: DGInsight[] = [];

  // Incohérence Finance/Mission
  if (stats.totalIndemnities > 0 && stats.totalMissions === 0) {
    anomalies.push({
      type: 'anomaly',
      priority: 'high',
      message: '🚨 **ANOMALIE GRAVE** : Dépenses détectées sans mission enregistrée.',
      recommendation: "Signalez à l'Admin. Possible fraude ou erreur de saisie.",
    });
  }

  // Missions certifiées > Missions totales
  if (stats.totalCertified > stats.totalMissions && stats.totalMissions > 0) {
    anomalies.push({
      type: 'anomaly',
      priority: 'high',
      message: '🚨 **ANOMALIE DONNÉES** : Missions certifiées > Total missions.',
      recommendation: 'Incohérence critique de base de données.',
    });
  }

  // Activité suspecte hors heures de service
  const suspiciousLogs = auditLogs.filter((log) => {
    const hour = new Date(log.timestamp).getHours();
    return hour >= 22 || hour < 6;
  });
  if (suspiciousLogs.length > 3) {
    anomalies.push({
      type: 'anomaly',
      priority: 'medium',
      message: `🚨 **ANOMALIE ACTIVITÉ** : ${suspiciousLogs.length} actions nocturnes suspectes (22h-6h).`,
      recommendation: 'Vérifiez les logs et les utilisateurs concernés.',
    });
  }

  // Absence de données terrain malgré missions
  if (stats.totalMissions > 5 && households.length === 0) {
    anomalies.push({
      type: 'anomaly',
      priority: 'medium',
      message: '🚨 **ANOMALIE TERRAIN** : Missions actives mais aucun ménage recensé.',
      recommendation: 'Synchronisation Kobo défaillante ou non initiée.',
    });
  }

  // Congestion validation
  const pendingMissions = stats.totalMissions - stats.totalCertified;
  if (pendingMissions > 20) {
    anomalies.push({
      type: 'anomaly',
      priority: 'medium',
      message: `🚨 **CONGESTION VALIDATION** : ${pendingMissions} missions en attente.`,
      recommendation: "File d'attente DG critique. Certifiez en masse.",
      action: { label: 'Certifier en masse', path: '/approbation' },
    });
  }

  return anomalies;
}

/** 🧠 ANALYSE STRATÉGIQUE DG : SYNTHÈSE TOTALE (V3.0) */
export function analyzeDG(
  stats: MissionStats | null,
  households: Household[],
  auditLogs: AuditLog[]
): DGInsight[] {
  let allInsights: DGInsight[] = [];
  if (!stats) return allInsights;

  // 1. Score IGPP 3.0
  const igpp = computeIGPPScore(stats, households);
  const igppLabel =
    igpp >= 80 ? 'EXCELLENT' : igpp >= 60 ? 'STABLE' : igpp >= 40 ? 'INSUFFISANT' : 'CRITIQUE';
  const igppType = igpp >= 60 ? 'info' : 'alert';

  allInsights.push({
    type: igppType,
    priority: igpp < 40 ? 'high' : igpp < 60 ? 'medium' : 'low',
    message: `🏛️ **INDICE IGPP 3.0 : ${igpp}/100 — ${igppLabel}**`,
    recommendation: igpp < 60 ? "Intervention d'urgence sur la validation recommandée." : undefined,
  });

  // 2. Alertes budgétaires
  if (stats.totalIndemnities > 8000000) {
    allInsights.push({
      type: 'alert',
      priority: 'high',
      message: `🚨 **ALERTE BUDGET CRITIQUE** : ${new Intl.NumberFormat('fr-FR').format(stats.totalIndemnities)} FCFA — Seuil de 8M dépassé.`,
      action: { label: 'Auditer Finances', path: '/admin' },
    });
  } else if (stats.totalIndemnities > 5000000) {
    allInsights.push({
      type: 'alert',
      priority: 'high',
      message: `⚠️ **ALERTE BUDGET** : ${new Intl.NumberFormat('fr-FR').format(stats.totalIndemnities)} FCFA — Seuil de 5M dépassé.`,
      action: { label: 'Auditer Finances', path: '/admin' },
    });
  }

  // 3. Prédictions & Anomalies
  allInsights = [...allInsights, ...predictRisks(stats, households)];
  allInsights = [...allInsights, ...detectAnomalies(stats, households, auditLogs)];

  // Tri par priorité
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  allInsights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return allInsights;
}
