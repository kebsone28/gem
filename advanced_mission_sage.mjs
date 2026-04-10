import { GEM_MINT_KNOWLEDGE_BASE, getContextePrompt } from './GEM_MINT_KNOWLEDGE_BASE.js';
import { staticImprover } from './static_response_improver.js';

/**
 * MissionSageService AVANCÉ - Intégration complète base de connaissances
 * Version optimisée avec réponses statiques améliorées
 */

export class AdvancedMissionSageService {
  static instance;
  optimizedResponses;

  constructor() {
    this.optimizedResponses = new Map();
    this.initializeOptimizedResponses();
  }

  static getInstance() {
    if (!AdvancedMissionSageService.instance) {
      AdvancedMissionSageService.instance = new AdvancedMissionSageService();
    }
    return AdvancedMissionSageService.instance;
  }

  private initializeOptimizedResponses() {
    // Intégrer les réponses optimisées
    const improver = staticImprover.generateImprovedResponseBank();

    // Workflow missions
    this.optimizedResponses.set('workflow_missions', improver.get('workflow_missions')?.improved);

    // Règles techniques
    this.optimizedResponses.set('regles_branchement', improver.get('regles_branchement')?.improved);

    // Sécurité
    this.optimizedResponses.set('authentification', improver.get('authentification')?.improved);

    // Kobo
    this.optimizedResponses.set('sync_kobo', improver.get('sync_kobo')?.improved);

    // FAQs optimisées
    GEM_MINT_KNOWLEDGE_BASE.faq.forEach((item, index) => {
      const optimized = this.optimizeStaticResponse(item.question, item.reponse);
      this.optimizedResponses.set(`faq_${index}`, optimized);
    });
  }

  private optimizeStaticResponse(question: string, response: string): string {
    // Appliquer les mêmes optimisations que le générateur
    let optimized = response;

    // Patterns d'amélioration
    if (question.toLowerCase().includes('workflow') || question.toLowerCase().includes('mission')) {
      optimized = this.applyWorkflowOptimization(optimized);
    }

    if (question.toLowerCase().includes('branchement') || question.toLowerCase().includes('technique')) {
      optimized = this.applyTechnicalOptimization(optimized);
    }

    if (question.toLowerCase().includes('kobo') || question.toLowerCase().includes('sync')) {
      optimized = this.applyKoboOptimization(optimized);
    }

    return this.applyGeneralOptimizations(optimized);
  }

  private applyWorkflowOptimization(response: string): string {
    if (!response.includes('1.') && !response.includes('•')) {
      const steps = response.split(/[→\n-]/).map(step => step.trim()).filter(step => step);
      return steps.map((step, index) => `${index + 1}. **${step}**`).join('\n');
    }
    return response;
  }

  private applyTechnicalOptimization(response: string): string {
    if (!response.includes('NS 01-001')) {
      response = `**Normes NS 01-001:**\n\n${response}`;
    }
    return response;
  }

  private applyKoboOptimization(response: string): string {
    if (!response.includes('numeroordre')) {
      response += '\n\n**Clé unique:** numeroordre (évite doublons)';
    }
    return response;
  }

  private applyGeneralOptimizations(response: string): string {
    let improved = response;

    // Ajouter contexte PROQUELEC
    if (!improved.toLowerCase().includes('proquelec') &&
        (improved.toLowerCase().includes('mission') || improved.toLowerCase().includes('électrif'))) {
      improved = `**PROQUELEC - Électrification nationale:**\n\n${improved}`;
    }

    // Améliorer lisibilité
    improved = improved.replace(/\n- /g, '\n• ');

    return improved;
  }

  async processQuery(query, user, state) {
    try {
      // 1. Vérifier si on a une réponse statique optimisée
      const staticResponse = this.findStaticResponse(query);
      if (staticResponse) {
        return `**Réponse optimisée depuis base de connaissances:**\n\n${staticResponse}`;
      }

      // 2. Sinon, utiliser l'IA avec contexte complet
      return await this.callPublicFreeAI(query, user, state);

    } catch (error) {
      console.error('Erreur AdvancedMissionSageService:', error);
      return `Désolé, une erreur s'est produite. Veuillez réessayer.`;
    }
  }

  private findStaticResponse(query: string): string | null {
    const query_lower = query.toLowerCase();

    // Recherche par mots-clés
    const keywordMap = {
      'workflow': 'workflow_missions',
      'mission': 'workflow_missions',
      'branchement': 'regles_branchement',
      'technique': 'regles_branchement',
      'senelec': 'regles_branchement',
      'kobo': 'sync_kobo',
      'sync': 'sync_kobo',
      'synchronis': 'sync_kobo',
      'authentif': 'authentification',
      'secur': 'authentification',
      'jwt': 'authentification'
    };

    for (const [keyword, responseKey] of Object.entries(keywordMap)) {
      if (query_lower.includes(keyword)) {
        return this.optimizedResponses.get(responseKey) || null;
      }
    }

    // Recherche dans FAQs
    for (let i = 0; i < GEM_MINT_KNOWLEDGE_BASE.faq.length; i++) {
      const faq = GEM_MINT_KNOWLEDGE_BASE.faq[i];
      if (this.isSimilarQuestion(query_lower, faq.question.toLowerCase())) {
        return this.optimizedResponses.get(`faq_${i}`) || faq.reponse;
      }
    }

    return null;
  }

  private isSimilarQuestion(query: string, faqQuestion: string): boolean {
    // Logique simple de similarité (peut être améliorée avec NLP)
    const queryWords = query.split(' ').filter(word => word.length > 3);
    const faqWords = faqQuestion.split(' ').filter(word => word.length > 3);

    const commonWords = queryWords.filter(word =>
      faqWords.some(faqWord => faqWord.includes(word) || word.includes(faqWord))
    );

    return commonWords.length >= 2; // Au moins 2 mots en commun
  }

  private async callPublicFreeAI(query: string, user?: any, state?: any): Promise<string> {
    const contextPrompt = getContextePrompt(user, state);

    const fullPrompt = `${contextPrompt}

QUESTION UTILISATEUR: ${query}

INSTRUCTION: Tu es MissionSage, expert PROQUELEC. Utilise TOUTES les connaissances disponibles.
Réponds de façon professionnelle, précise et structurée. Si la question concerne un aspect spécifique,
fournis des détails techniques et des références aux normes quand applicable.`;

    try {
      const response = await fetch(
        `https://text.pollinations.ai/${encodeURIComponent(fullPrompt)}?model=openai`
      );
      if (!response.ok) throw new Error('Service public Pollinations indisponible.');
      return await response.text();
    } catch (e) {
      throw e;
    }
  }

  // MÉTHODES DE DIAGNOSTIC ET ANALYSE
  getKnowledgeStats() {
    return {
      total_static_responses: this.optimizedResponses.size,
      faq_count: GEM_MINT_KNOWLEDGE_BASE.faq.length,
      knowledge_areas: Object.keys(GEM_MINT_KNOWLEDGE_BASE).length,
      last_updated: new Date().toISOString()
    };
  }

  async testResponseCoherence(question: string, user?: any, state?: any) {
    const response = await this.processQuery(question, user, state);
    return {
      question,
      response,
      is_static: response.includes('Réponse optimisée'),
      length: response.length,
      has_structure: response.includes('•') || response.includes('**') || response.includes('1.')
    };
  }
}

// TEST ET VALIDATION
async function testAdvancedService() {
  console.log('🧠 TEST AdvancedMissionSageService\n');

  const service = AdvancedMissionSageService.getInstance();

  const mockUser = {
    role: 'ADMIN_PROQUELEC',
    displayName: 'Test User',
    email: 'test@proquelec.sn'
  };

  const mockState = {
    stats: {
      totalMissions: 150,
      totalCertified: 120,
      totalHouseholds: 2500,
      totalIndemnities: 25000000
    }
  };

  const testQuestions = [
    "Comment créer une mission OM?", // Devrait utiliser réponse statique optimisée
    "Quelles sont les règles branchement?", // Devrait utiliser réponse statique
    "Quelle est la différence entre partie active et masse?", // Devrait utiliser IA avec contexte
    "Comment fonctionne la sécurité?", // Devrait utiliser réponse statique
  ];

  for (const question of testQuestions) {
    console.log(`\n❓ Question: ${question}`);
    const result = await service.testResponseCoherence(question, mockUser, mockState);
    console.log(`📝 Type: ${result.is_static ? 'STATIQUE OPTIMISÉE' : 'IA AVEC CONTEXTE'}`);
    console.log(`📏 Longueur: ${result.length} caractères`);
    console.log(`🏗️ Structuré: ${result.has_structure ? 'OUI' : 'NON'}`);
    console.log(`💬 Réponse: ${result.response.substring(0, 100)}...`);
  }

  console.log(`\n📊 Stats service:`, service.getKnowledgeStats());
}

export { testAdvancedService };

// Si exécuté directement
if (import.meta.url === `file://${process.argv[1]}`) {
  testAdvancedService();
}