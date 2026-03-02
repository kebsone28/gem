/**
 * DataStructureGenerator.js
 * Régénère la structure (Projets, Zones, Équipes) à partir des données ménages existantes
 */

export class DataStructureGenerator {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
    }

    async regenerate() {
        console.log('🔄 [DataStructureGenerator] Analyse des données pour régénération...');

        if (!this.db || !this.db.households) {
            console.warn('⚠️ DB non prête');
            return;
        }

        const households = await this.db.households.toArray();
        if (households.length === 0) {
            console.log('ℹ️ Aucun ménage trouvé, rien à régénérer');
            return;
        }

        await this.generateProject(households);
        await this.generateZones(households);
        await this.generateTeams(households);

        console.log('✅ [DataStructureGenerator] Régénération terminée !');
    }

    // 1. Créer Projet Global
    async generateProject(households) {
        const count = await this.db.projects.count();
        if (count === 0) {
            await this.db.projects.add({
                name: "Programme Électrification Importé",
                status: "En cours",
                startDate: new Date(),
                description: "Projet généré automatiquement depuis les données importées",
                stats: {
                    totalHouseholds: households.length
                }
            });
            console.log('✅ Projet par défaut créé');
        }
    }

    // 2. Créer Zones basées sur les Régions
    async generateZones(households) {
        // Extraire les régions uniques
        const regions = [...new Set(households.map(h => h.location?.region).filter(Boolean))];

        console.log(`📍 ${regions.length} régions trouvées:`, regions);

        // Projet ID par défaut (1er projet)
        const projects = await this.db.projects.toArray();
        const projectId = projects[0]?.id;

        for (const region of regions) {
            // Vérifier si la zone existe déjà
            const existing = await this.db.zones.where('name').equals(region).first();

            if (!existing) {
                // Compter les ménages dans cette région
                const target = households.filter(h => h.location?.region === region).length;

                await this.db.zones.add({
                    projectId: projectId,
                    name: region, // La Zone s'appelle comme la Région
                    type: "Region",
                    targetHouseholds: target,
                    stats: {
                        householdsCount: target
                    }
                });
                console.log(`✅ Zone créée: ${region} (${target} ménages)`);
            }
        }
    }

    // 3. Créer Équipes
    async generateTeams(households) {
        // Extraire équipes uniques
        const teamsSet = new Set();

        households.forEach(h => {
            // Vérifier assignedTeams (nouveau)
            if (h.assignedTeams && h.assignedTeams.length > 0) {
                h.assignedTeams.forEach(t => teamsSet.add(t.name));
            }
            // Vérifier ancien champ note/equipe au cas où
            if (h.equipe) teamsSet.add(h.equipe);
        });

        const teams = [...teamsSet].filter(Boolean);
        console.log(`👷 ${teams.length} équipes trouvées:`, teams);

        for (const teamName of teams) {
            const existing = await this.db.teams.where('name').equals(teamName).first();

            if (!existing) {
                await this.db.teams.add({
                    name: teamName,
                    type: "Principale",
                    status: "Active",
                    stats: {
                        assignedCount: households.filter(h =>
                            (h.assignedTeams?.some(t => t.name === teamName)) || h.equipe === teamName
                        ).length
                    }
                });
                console.log(`✅ Équipe créée: ${teamName}`);
            }
        }
    }
}

// Exposer globalement
window.DataStructureGenerator = DataStructureGenerator;

// Auto-exécution si demandé
window.regenerateStructure = async () => {
    if (window.db) {
        const generator = new DataStructureGenerator(window.db, console);
        await generator.regenerate();
        // Rafraîchir backup après régénération
        if (window.backupService) {
            console.log('💾 Lancement d\'un backup avec les nouvelles données...');
            await window.backupService.performBackup(false);
        }
    }
};
