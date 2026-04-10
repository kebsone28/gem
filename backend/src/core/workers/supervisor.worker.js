import prisma from '../utils/prisma.js';
import { sendMail } from '../../services/mail.service.js';

/**
 * Le Superviseur Silencieux
 * Tâche de fond (Daemon) qui vérifie l'avancement des équipes par rapport 
 * au volume de foyers assignés. Si le temps moyen / dernier passage 
 * dépasse une limite, on envoie une alerte.
 */
export const startSilentSupervisor = () => {
    console.log('🤖 [SUPERVISOR] Silent Supervisor Initialized. Monitoring delays...');
    
    // Intervalle de vérification : toutes les 12 heures (43200000 ms)
    // En DEV, on peut tester plus court si on veut, mais 12h est idéal en prod
    const CHECK_INTERVAL = 12 * 60 * 60 * 1000;

    let supervisorTimeout = null;
    let supervisorInterval = null; 

    // Helper pour envoyer les rapports
    const notifyProjectManagers = async (subject, text, organizationId) => {
        // Obtenir le chef de projet et l'admin
        const pmArray = await prisma.user.findMany({
            where: {
                organizationId,
                roleLegacy: { in: ['CHEF_PROJET', 'ADMIN'] }
            }
        });

        for (const pm of pmArray) {
            const email = pm.notificationEmail || pm.email;
            if (email) {
                await sendMail({
                    to: email,
                    subject,
                    title: 'Alerte Système GEM',
                    body: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
                    actionLabel: "Voir l'outil logistique",
                    actionLink: `${process.env.FRONTEND_URL}/admin/logistique`
                });
            }
        }
    };

    const checkDelays = async () => {
        console.log('🤖 [SUPERVISOR] Checking for team delays...');
        try {
            // ✅ IMPROVED: Détection basée sur le dernier timestamp Kobo réel
            // Équipes sans soumission Kobo depuis 5 jours = inactives
            const staleSince = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
            
            // Trouver les équipes qui ont des ménages mais dont les derniers updates sont vieux
            const inactiveTeams = await prisma.team.findMany({
                where: {
                    grappeId: { not: null },
                    households: {
                        some: {
                            koboSync: { isNot: null } // Ont eu au moins une synchro Kobo
                        }
                    }
                },
                include: { 
                    grappe: true,
                    households: {
                        where: {
                            koboSync: { isNot: null },
                            updatedAt: { lt: staleSince }
                        },
                        orderBy: { updatedAt: 'desc' },
                        take: 5 // Derniers ménages pour analyse
                    }
                }
            });

            // Filtrer les équipes qui ont vraiment des ménages stagnants (tous vieux)
            const trulyInactiveTeams = inactiveTeams.filter(team => 
                team.households.length > 0 && 
                team.households.every(h => h.updatedAt < staleSince)
            );

            if (trulyInactiveTeams.length > 0) {
                // Grouper par organisation pour ne pas spammer
                const alertsByOrg = {};

                for (const team of trulyInactiveTeams) {
                    if (!alertsByOrg[team.organizationId]) alertsByOrg[team.organizationId] = [];
                    alertsByOrg[team.organizationId].push(team);
                }

                for (const [orgId, teamsList] of Object.entries(alertsByOrg)) {
                    let msg = `Bonjour,\n\nLe Superviseur Silencieux a détecté des anomalies critiques sur vos déploiements :\n\n`;
                    teamsList.forEach(t => {
                        msg += `⚠️ L'équipe "${t.name}" affectée à la "Grappe ${t.grappe.id}" est tombée en Inactivité excessive.\n`;
                    });
                    msg += `\nVeuillez vérifier vos équipes terrain — aucune soumission Kobo détectée depuis plus de 5 jours.\n\nCordialement,\nLe Superviseur GEM.`;
                    
                    await notifyProjectManagers('🚨 [GEM] Alerte de Retard : Équipes Inactives', msg, orgId);
                    console.log(`🤖 [SUPERVISOR] Alert sent to org ${orgId} for ${teamsList.length} inactive teams.`);
                }
            } else {
                console.log('🤖 [SUPERVISOR] All teams are optimal.');
            }

        } catch (e) {
            console.error('🤖 [SUPERVISOR] Execution error:', e.message);
        }
    };

    // Run first check 1 minute after boot
    supervisorTimeout = setTimeout(checkDelays, 60 * 1000);

    // Keep running
    supervisorInterval = setInterval(checkDelays, CHECK_INTERVAL);

    // Return cleanup function
    return () => {
        console.log('🤖 [SUPERVISOR] Arrêt du Superviseur Silencieux...');
        if (supervisorTimeout) {
            clearTimeout(supervisorTimeout);
            supervisorTimeout = null;
        }
        if (supervisorInterval) {
            clearInterval(supervisorInterval);
            supervisorInterval = null;
        }
    };
};
