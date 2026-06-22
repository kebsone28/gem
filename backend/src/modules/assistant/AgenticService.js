import logger from '../../utils/logger.js';


/**
 * AgenticService - Le cerveau de l'assistant opérationnel
 * Responsable de transformer le langage naturel en intentions et actions métier.
 */
export const agenticService = {
    /**
     * Analyse une requête utilisateur et suggère des actions
     */
    async analyze(userId, message, context = {}) {
        const query = message.toLowerCase();
        const suggestions = [];

        // 1. Détection d'intention : Synchronisation
        if (query.includes('sync') || query.includes('kobo') || query.includes('rafraichir')) {
            suggestions.push({
                id: 'sync_kobo',
                type: 'action',
                label: 'Synchroniser KoBoToolbox',
                description: 'Je peux lancer une récupération des dernières données du terrain.',
                severity: 'info',
                action: {
                    module: 'sync',
                    method: 'kobo',
                    params: { projectId: context.projectId }
                }
            });
        }

        // 2. Détection d'intention : Plan B (GemToolbox)
        if (query.includes('plan b') || query.includes('interne') || query.includes('gemtoolbox')) {
            suggestions.push({
                id: 'switch_plan_b',
                type: 'action',
                label: 'Activer le Plan B (GemToolbox)',
                description: 'Je vais configurer le projet pour utiliser la collecte interne GEM.',
                severity: 'warning',
                action: {
                    module: 'project',
                    method: 'updateConfig',
                    params: { collectSource: 'gemtoolbox' }
                }
            });
        }

        // 3. Détection d'intention : Création de Mission (Exemple demandé)
        if (query.includes('mission') || query.includes('crée')) {
            const location = query.includes('kaffrine') ? 'Kaffrine' : 
                           query.includes('thies') ? 'Thiès' : 
                           query.includes('saint-louis') ? 'Saint-Louis' : null;

            if (location) {
                suggestions.push({
                    id: 'create_mission',
                    type: 'form',
                    label: `Préparer une mission à ${location}`,
                    description: `J'ai identifié le lieu. Souhaitez-vous que je prépare le dossier pour ${location} ?`,
                    severity: 'success',
                    fields: [
                        { name: 'title', label: 'Nom de la mission', type: 'text', value: `Mission Électrification ${location}` },
                        { name: 'startDate', label: 'Date de début', type: 'date', value: new Date().toISOString().split('T')[0] }
                    ],
                    action: {
                        module: 'mission',
                        method: 'create',
                        params: { location }
                    }
                });
            } else {
                return {
                    text: "D'accord, je peux préparer une mission. Pour quelle localité (Kaffrine, Thiès, etc.) ?",
                    suggestions: []
                };
            }
        }

        // Réponse par défaut si rien n'est trouvé
        if (suggestions.length === 0) {
            return {
                text: "Je n'ai pas encore de capacité pour cette demande spécifique, mais je peux vous aider à synchroniser vos données ou préparer des missions.",
                suggestions: []
            };
        }

        return {
            text: `J'ai compris votre demande. Voici ce que je peux faire pour vous :`,
            suggestions
        };
    },

    /**
     * Exécute une action validée par l'utilisateur
     */
    async execute(userId, actionPayload) {
        const { module, method, params } = actionPayload;
        logger.info(`[AGENTIC] Executing ${module}.${method}`, { params });

        try {
            switch (module) {
                case 'sync':
                    if (method === 'kobo') {
                        // Ici on appellerait le service de synchro réel
                        // Pour le POC on simule ou on appelle le controller si accessible
                        return { success: true, message: "La synchronisation Kobo a été lancée en arrière-plan." };
                    }
                    break;
                
                case 'project':
                    if (method === 'updateConfig') {
                        // Logique de mise à jour de la config projet
                        return { success: true, message: "La source de collecte a été basculée sur GemToolbox." };
                    }
                    break;

                case 'mission':
                    if (method === 'create') {
                        // Logique de création de mission
                        return { success: true, message: `Mission à ${params.location} créée avec succès.` };
                    }
                    break;

                default:
                    throw new Error(`Module ${module} non supporté par l'agent.`);
            }
        } catch (error) {
            logger.error(`[AGENTIC] Execution failed`, error);
            throw error;
        }
    }
};
