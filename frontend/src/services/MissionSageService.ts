/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { AIEngineConfig } from '../config/AIEngineConfig';

export interface User {
  role: string;
  displayName?: string;
  name?: string;
  email?: string;
}

export interface SystemStats {
  totalMissions: number;
  totalCertified: number;
  totalHouseholds: number;
  totalIndemnities?: number;
}

export interface AppState {
  stats?: SystemStats;
}

export class MissionSageService {
  private static instance: MissionSageService;

  private constructor() {}

  static getInstance(): MissionSageService {
    if (!MissionSageService.instance) {
      MissionSageService.instance = new MissionSageService();
    }
    return MissionSageService.instance;
  }

  async processQuery(query: string, user?: User, state?: AppState): Promise<string> {
    try {
      // Utiliser l'IA publique enrichie avec le contexte métier
      if (AIEngineConfig.getProvider() === 'PUBLIC_POLLINATIONS') {
        return await this.callPublicFreeAI(query, user, state);
      }

      // Fallback vers une réponse par défaut si aucun provider configuré
      return `Je suis MissionSage, votre assistant IA pour GEM-MINT. Votre question était: "${query}". Pour le moment, je suis configuré pour utiliser l'IA publique avec le contexte métier PROQUELEC.`;
    } catch (error) {
      console.error('Erreur dans MissionSageService:', error);
      return `Désolé, une erreur s'est produite lors du traitement de votre demande. Veuillez réessayer plus tard.`;
    }
  }

  private async callPublicFreeAI(query: string, user?: User, state?: AppState): Promise<string> {
    // Enrichir le prompt avec le contexte métier GEM-MINT
    const contextPrompt = `
Tu es MissionSage, l'assistant IA intelligent du système GEM-MINT de PROQUELEC.

CONTEXTE MÉTIER GEM-MINT:
- PROQUELEC est une entreprise sénégalaise d'électrification de masse
- GEM-MINT gère les missions d'ordres de mission (OM) pour l'électrification
- Les missions suivent les normes NS 01-001 pour installations BT ≤1000V
- Les techniciens utilisent Kobo Collect pour la collecte de données terrain
- Les données sont validées par les Chefs de Projet puis certifiées par la DG

UTILISATEUR ACTUEL:
- Rôle: ${user?.role || 'Inconnu'}
- Nom: ${user?.displayName || user?.name || 'Utilisateur'}
- Email: ${user?.email || 'N/A'}

STATISTIQUES SYSTÈME:
- Total missions: ${state?.stats?.totalMissions || 0}
- Missions certifiées: ${state?.stats?.totalCertified || 0}
- Ménages collectés: ${state?.stats?.totalHouseholds || 0}
- Indemnités totales: ${state?.stats?.totalIndemnities ? new Intl.NumberFormat('fr-FR').format(state.stats.totalIndemnities) + ' FCFA' : 'N/A'}

RÈGLES MÉTIER CLÉS:
- Les branchements doivent respecter la norme Senelec
- Coffret compteur en limite propriété, hublot à 1.60m
- Câbles enterrés 0.5m sous grillage rouge
- Protection PVC obligatoire, hauteur ≥4m ruelles/6m routes
- Interdiction poteaux bois pourris, barrettes terre extérieures

BASE CONNAISSANCES TECHNIQUES:
- Partie active = conducteur sous tension
- Masse = pièce touchable pouvant être sous tension
- DDR = dispositif de coupure fuite terre
- PE = prise terre vert/jaune
- Section câble standard: 1.5mm², 2.5mm², 4mm²

INSTRUCTION: Réponds en tant qu'expert PROQUELEC, utilise le contexte fourni, sois précis et professionnel.

QUESTION UTILISATEUR: ${query}
`;

    const response = await fetch(
      `https://text.pollinations.ai/${encodeURIComponent(contextPrompt)}?model=openai`
    );
    if (!response.ok) throw new Error('Service public Pollinations indisponible.');
    return await response.text();
  }
}
