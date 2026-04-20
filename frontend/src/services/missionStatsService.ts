/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import * as XLSX from 'xlsx';
import { db } from '../store/db';
import type { MissionOrderData, MissionMember } from '../pages/mission/core/missionTypes';

export interface MissionStats {
  totalMissions: number;
  totalCertified: number;
  totalIndemnities: number;
  avgCostPerMission: number;
  missionsByMonth: Record<string, number>;
  totalMembersDeployed: number;
}

/**
 * SERVICE : MissionStatsService
 * Calculateur Master pour le Dashboard Financier & Compta.
 */
export const missionStatsService = {
  /**
   * Calcule les stats globales (Admin/DG/Comptable)
   */
  async getGlobalStats(): Promise<MissionStats> {
    const missions = await db.missions.toArray() as any[];
    return this.processMissions(missions);
  },

  /**
   * Calcule les stats pour UN seul utilisateur (User Independence)
   */
  async getUserStats(userEmail: string, userId: string): Promise<MissionStats> {
    const missions = await db.missions
      .filter((m) => (m as any).createdBy === userEmail || (m as any).creatorId === userId)
      .toArray() as any[];
    return this.processMissions(missions);
  },

  /**
   * Moteur de calcul partagé
   */
  processMissions(
    missions: any[]
  ): MissionStats {
    let totalIndemnities = 0;
    let certifiedCount = 0;
    const memberSet = new Set();
    const months: Record<string, number> = {};

    missions.forEach((m) => {
      const data = (m.data || m.formData) as MissionOrderData;
      const isCertified = !!(m.isCertified || data?.isCertified);

      if (isCertified) certifiedCount++;

      // Calcul financier (Somme des indemnités)
      const members = (m.members || data?.members || []) as MissionMember[];
      members.forEach((member) => {
        const cost = (Number(member.dailyIndemnity) || 0) * (Number(member.days) || 1);
        totalIndemnities += cost;
        if (member.name) memberSet.add(member.name);
      });

      // Stats par mois (Format: MM/YYYY)
      const dateStr = m.updatedAt || m.createdAt || new Date().toISOString();
      const date = new Date(dateStr);
      const monthKey = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
      months[monthKey] = (months[monthKey] || 0) + 1;
    });

    return {
      totalMissions: missions.length,
      totalCertified: certifiedCount,
      totalIndemnities,
      avgCostPerMission: missions.length > 0 ? totalIndemnities / missions.length : 0,
      missionsByMonth: months,
      totalMembersDeployed: memberSet.size,
    };
  },

  /**
   * EXPORT COMPTABLE : Génère un fichier Excel des missions certifiées
   */
  async exportCertifiedMissionsToExcel(): Promise<void> {
    const allMissions = await db.missions.toArray() as any[];

    // On ne garde que les missions certifiées
    const certifiedMissions = allMissions.filter((m) => {
      const data = (m.data || m.formData) as MissionOrderData;
      return !!(m.isCertified || data?.isCertified);
    });

    if (certifiedMissions.length === 0) {
      throw new Error('Aucune mission certifiée à exporter.');
    }

    // Transformation pour Excel (Format plat, prêt pour la compta)
    const exportData = certifiedMissions.flatMap((m) => {
      const data = (m.data || m.formData) as MissionOrderData;
      const members = (m.members || data?.members || []) as MissionMember[];

      return members.map((member) => ({
        'N° ORDRE': data.orderNumber || 'Brouillon',
        'DATE CRÉATION': new Date(m.createdAt || Date.now()).toLocaleDateString('fr-FR'),
        DESTINATION: data.region || 'N/A',
        OBJET: data.purpose || 'N/A',
        AGENT: member.name || 'Inconnu',
        RÔLE: member.role || 'Opératif',
        JOURS: Number(member.days) || 1,
        'INDEMNITÉ JOUR (FCFA)': Number(member.dailyIndemnity) || 0,
        'TOTAL INDEMNITÉS (FCFA)':
          (Number(member.dailyIndemnity) || 0) * (Number(member.days) || 1),
        STATUT: 'CERTIFIÉ DG',
        'CRÉÉ PAR': m.createdBy || 'Système',
      }));
    });

    // Création du Workbook Excel
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Missions_PROQUELEC');

    // Onglet Résumé par mission (1 ligne par mission)
    const summaryData = certifiedMissions.map((m) => {
      const data = (m.data || m.formData) as MissionOrderData;
      const members = (m.members || data?.members || []) as MissionMember[];
      const totalCost = members.reduce(
        (s, mb) => s + (Number(mb.dailyIndemnity) || 0) * (Number(mb.days) || 1),
        0
      );
      return {
        'N° ORDRE': data.orderNumber || 'Brouillon',
        DATE: new Date(m.createdAt || Date.now()).toLocaleDateString('fr-FR'),
        DESTINATION: data.region || 'N/A',
        OBJET: data.purpose || 'N/A',
        'NB AGENTS': members.length,
        'TOTAL INDEMNITÉS (FCFA)': totalCost,
        STATUT: 'CERTIFIÉ DG',
        'CRÉÉ PAR': m.createdBy || 'Système',
      };
    });
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, wsSummary, 'Résumé_Missions');

    // Téléchargement
    XLSX.writeFile(
      workbook,
      `PROQUELEC_COMPTA_MISSIONS_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  },
};
