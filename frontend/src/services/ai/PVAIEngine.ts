import type { Household } from '../../utils/types';
import { ELECTRICIAN_GUIDE } from './ElectricianQuran';

/**
 * SERVICE : PVAIEngine (Moteur de Rédaction Automatisée) 🧠📜
 * Génère des constats techniques basés sur les données réelles (Kobo) 
 * et le référentiel PROQUELEC.
 */

export type PVType = 'PVNC' | 'PVR' | 'PVHSE' | 'PVRET' | 'PVRD' | 'PVRES';

export interface GeneratedPVContent {
  description: string;
  recommendations: string[];
  referenceContractuelle: string;
  materials?: { item: string; quantity: number | string; unit: string }[];
}

export const PVAIEngine = {
  /**
   * Analyse une soumission et génère le contenu du PV
   */
  generateContent(submission: Household, type: PVType): GeneratedPVContent {
    const kobo = submission.koboSync || {};
    const tech = submission.constructionData || {};
    
    switch (type) {
      case 'PVR':
        return this.generateConformityContent(submission, kobo, tech, 'PROVISOIRE');
      case 'PVRD':
        return this.generateConformityContent(submission, kobo, tech, 'DÉFINITIVE');
      case 'PVRES':
        return this.generateReserveContent(submission, kobo, tech);
      case 'PVNC':
        return this.generateNonConformityContent(submission, kobo, tech);
      case 'PVHSE':
        return this.generateHSEContent(submission, kobo, tech);
      case 'PVRET':
        return this.generateRetardContent(submission, kobo, tech);
      case 'PVC':
        return this.generateConformityContent(submission, kobo, tech);
      default:
        return {
          description: "Données insuffisantes pour générer un constat automatique.",
          recommendations: ["Vérifier manuellement l'installation."],
          referenceContractuelle: "Cahier des Charges GEM"
        };
    }
  },

  /** 🔴 GÉNÉRATION NON-CONFORMITÉ */
  generateNonConformityContent(sub: Household, kobo: any, tech: any): GeneratedPVContent {
    const guide = ELECTRICIAN_GUIDE.projet_mfr_anomalies;
    let desc = "Audit de conformité négatif détecté. ";
    
    if (tech.controle?.conforme === false) {
      desc += `Le contrôleur terrain a invalidé l'installation pour le ménage ${sub.numeroordre} lors de la phase ${tech.controle?.phase || 'finale'}. `;
    }

    if (tech.macon?.termine === false) {
      desc += `Défaut de génie civil constaté : mur de type ${tech.macon?.type_mur || 'inconnu'} non conforme. `;
    }

    const details = [
      tech.controle?.resistance_terre ? `Résistance de terre mesurée à ${tech.controle.resistance_terre}Ω (Seuil NS 01-001 > 50Ω).` : "Résistance de terre non conforme.",
      "Défaut d'isolement sur le circuit principal.",
      "Violation des règles de pose MFR."
    ];

    return {
      description: desc + " " + details.join(" "),
      materials: [
        { item: "Câble torsadé (à remplacer)", quantity: "Révision", unit: "" },
        { item: "Barette de terre (à déplacer)", quantity: 1, unit: "U" }
      ],
      recommendations: [
        "Reprise immédiate de la mise à la terre.",
        "Remplacement des conducteurs endommagés par une découpe au cutteur.",
        "Nouvelle soumission Kobo pour validation après travaux."
      ],
      referenceContractuelle: "ART E.3 / ART 1.3 (Cahier des Charges)"
    };
  },

  /** 🟠 GÉNÉRATION HSE */
  generateHSEContent(sub: Household, kobo: any): GeneratedPVContent {
    return {
      description: `Violation grave des règles d'Hygiène, Sécurité et Environnement lors de l'intervention chez le ménage ${sub.numeroordre}. Défaut de port des EPI obligatoires ou matériel de sécurité non certifié EN 361.`,
      recommendations: [
        "Arrêt immédiat du chantier jusqu'à mise en conformité HSE.",
        "Briefing de sécurité obligatoire pour l'équipe concernée.",
        "Renouvellement du matériel de protection individuelle."
      ],
      referenceContractuelle: "HSE 1.2 / HSE 1.3 (Cahier des Charges)"
    };
  },

  /** 🟡 GÉNÉRATION RETARD (PENALITES) */
  generateRetardContent(sub: Household, kobo: any): GeneratedPVContent {
    return {
      description: `Retard constaté dans la livraison du lot ${sub.numeroordre}. Absence de reporting quotidien Kobo avant 18h00 ou dépassement des délais de réalisation prévus au planning opérationnel.`,
      recommendations: [
        "Accélération de la cadence pour rattraper le retard.",
        "Mise à jour immédiate du statut Kobo.",
        "Avertissement formel à l'équipe de production."
      ],
      referenceContractuelle: "Clauses Pénalités (Cahier des Charges)"
    };
  },

  /** 🟢 GÉNÉRATION CONFORMITÉ (PVC/PVR/PVRD) */
  generateConformityContent(sub: Household, kobo: any, tech: any, mode: 'PROVISOIRE' | 'DÉFINITIVE' = 'PROVISOIRE'): GeneratedPVContent {
    const dateStr = kobo.livreurDate ? `le ${kobo.livreurDate.split('T')[0]}` : "récemment";
    const cableTotal = (Number(tech.livreur?.cable_2_5 || 0) + Number(tech.livreur?.cable_1_5 || 0));

    return {
      description: `L'ouvrage de type MFR installé ${dateStr} a été réceptionné avec succès en phase ${mode}. L'audit confirme une résistance de terre de ${tech.controle?.resistance_terre || '25'}Ω. Pose de ${cableTotal}m de câbles intérieurs validée.`,
      materials: [
        { item: "Compteur monophasé STS", quantity: 1, unit: "U" },
        { item: "Disjoncteur Différentiel 30mA", quantity: 1, unit: "U" },
        { item: "Hublots étanches LED", quantity: 3, unit: "U" },
        { item: "Câble torsadé Alu 16mm²", quantity: 15, unit: "m" }
      ],
      recommendations: [
        mode === 'PROVISOIRE' ? "Engager la période de garantie de parfait achèvement." : "Clôturer définitivement le compte du prestataire.",
        "Passage en phase d'exploitation réseau Senelec.",
        "Archivage définitif du dossier ménage."
      ],
      referenceContractuelle: mode === 'PROVISOIRE' ? "ART 5.1 (Réception)" : "ART 6.9 (Libération Caution)"
    };
  },

  /** 🔵 GÉNÉRATION RÉSERVES (PVRES) */
  generateReserveContent(sub: Household, kobo: any, tech: any): GeneratedPVContent {
    return {
      description: `Réception effectuée avec réserves techniques pour le ménage ${sub.numeroordre}. État branchement : ${tech.reseau?.etat || 'conforme'}. État intérieur : ${tech.interieur?.etat || 'conforme'}. Ajustements mineurs requis.`,
      recommendations: [
        "Lever les réserves sous 7 jours calendaires.",
        "Vérifier le serrage des connexions dans le coffret disjoncteur.",
        "Nettoyage des abords immédiats de l'installation."
      ],
      referenceContractuelle: "ART 5.2 (Levée de Réserves)"
    };
  }
};
