 
import { AIEngineConfig } from '../config/AIEngineConfig';
import logger from '../utils/logger';

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
      return `Je suis GED OS AI, votre assistant IA souverain. Votre question était: "${query}". Je suis configuré pour vous assister dans le pilotage de votre écosystème digital.`;
    } catch (error) {
      logger.error('[MissionSageService] Erreur dans MissionSageService', error);
      return `Désolé, une erreur s'est produite lors du traitement de votre demande. Veuillez réessayer plus tard.`;
    }
  }

  private async callPublicFreeAI(query: string, user?: User, state?: AppState): Promise<string> {
    // Enrichir le prompt avec le contexte métier GEM-MINT
    const contextPrompt = `
Tu es GED OS AI, l'assistant IA intelligent du système GED OS.

CONTEXTE MÉTIER GED OS:
- GED OS est un système d'exploitation métier pour le pilotage d'écosystèmes complexes.
- Le système gère les missions d'ordres de mission (OM) et la traçabilité terrain.
- Les données sont validées en temps réel et certifiées par la Direction Générale.

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
