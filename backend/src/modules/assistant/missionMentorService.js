import { assistantService } from './assistant.service.js';
import logger from '../../utils/logger.js';

const MENTOR_SYSTEM_PROMPT = `Tu es le MENTOR DE MISSION PROQUELEC. 
Ton rôle est d'aider la Direction Générale à valider ou rejeter des ordres de mission.
Tu dois analyser les données fournies (Objet, Équipe, Dates, Région, Budget) et produire :
1. Un RÉSUMÉ DÉCISIONNEL (2-3 lignes maximum).
2. Une RECOMMANDATION (Valider / À surveiller / Risqué).
3. Un CONSEIL STRATÉGIQUE (ex: logistique, sécurité, ou optimisation de l'équipe).

Ton ton est professionnel, direct et expert. Ne sois pas trop verbeux. Sois précis sur les risques (ex: durée trop courte pour la distance, équipe trop grande pour l'objet, budget élevé).`;

export const missionMentorService = {
  async analyzeMission(mission, user) {
    try {
      const missionData = typeof mission.data === 'object' ? mission.data : {};
      const members = missionData.members || [];
      
      const context = {
        title: mission.title,
        purpose: missionData.purpose,
        region: missionData.region,
        startDate: mission.startDate,
        endDate: mission.endDate,
        budget: mission.budget,
        teamSize: members.length,
        teamDetails: members.map(m => `${m.name} (${m.role})`).join(', ')
      };

      const prompt = `Analyse l'ordre de mission suivant et donne ton avis de mentor :\n${JSON.stringify(context, null, 2)}`;

      const aiResponse = await assistantService.processQuery({
        user,
        userId: user.id,
        message: prompt,
        context: { type: 'mission_audit', missionId: mission.id },
        systemPromptOverride: MENTOR_SYSTEM_PROMPT // Si pris en charge
      });

      return {
        analysis: aiResponse.response,
        intent: aiResponse.intent,
        source: aiResponse.source
      };
    } catch (error) {
      logger.error('Mission Mentor analysis failed:', error);
      return {
        analysis: "Désolé, je n'ai pas pu analyser cette mission en raison d'une erreur technique. Veuillez procéder à une vérification manuelle.",
        error: true
      };
    }
  }
};
