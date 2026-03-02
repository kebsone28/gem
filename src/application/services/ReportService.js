/**
 * Service pour la génération de rapports
 * Fournit des statistiques et des données filtrées pour les rapports
 */
export class ReportService {
    static async generateReport(filters) {
        if (typeof HouseholdRepository === 'undefined') {
            console.error('HouseholdRepository is not defined');
            return { households: [], stats: {} };
        }

        const households = await HouseholdRepository.getAll();
        const teams = await TeamRepository.getAll();
        const project = await ProjectRepository.getCurrent();

        // Appliquer les filtres
        let filteredHouseholds = households;
        if (filters.zone && filters.zone !== 'all') {
            filteredHouseholds = filteredHouseholds.filter(h => h.zone === filters.zone || h.zoneId === filters.zone);
        }
        if (filters.team && filters.team !== 'all') {
            filteredHouseholds = filteredHouseholds.filter(h => h.teamId === filters.team);
        }
        if (filters.status && filters.status !== 'all') {
            filteredHouseholds = filteredHouseholds.filter(h => h.status === filters.status);
        }

        return {
            households: filteredHouseholds.map(h => {
                const team = teams.find(t => t.id === h.teamId);
                const zone = project.zones ? project.zones.find(z => z.id === h.zoneId) : null;
                return {
                    ...h,
                    teamName: team ? team.name : '-',
                    zoneName: zone ? zone.name : (h.zone || '-')
                };
            }),
            stats: this.calculateStats(filteredHouseholds, teams, project)
        };
    }

    static calculateStats(households, teams, project) {
        if (!households || households.length === 0) {
            return {
                totalHouseholds: 0,
                completedHouseholds: 0,
                progressRate: "0.00",
                totalCost: 0
            };
        }

        const normalize = (typeof window !== 'undefined' && window.normalizeStatus) ? window.normalizeStatus : (s => s);
        const completed = households.filter(h => normalize(h.status) === (window.HouseholdStatus?.RECEPTION_VALIDEE || 'Réception: Validée')).length;
        const progress = (completed / households.length) * 100;
        const budget = project.budget || 100000000;
        const cost = budget * (progress / 100);

        return {
            totalHouseholds: households.length,
            completedHouseholds: completed,
            progressRate: progress.toFixed(2),
            totalCost: Math.round(cost)
        };
    }

    static generateExecutiveSummary(households, teams) {
        const insights = [];
        const normalize = (typeof window !== 'undefined' && window.normalizeStatus) ? window.normalizeStatus : (s => s);
        const completed = households.filter(h => normalize(h.status) === (window.HouseholdStatus?.RECEPTION_VALIDEE || 'Réception: Validée')).length;
        const progress = households.length > 0 ? (completed / households.length) * 100 : 0;

        if (progress < 20) {
            insights.push("Le projet est en phase de démarrage initial.");
        } else if (progress > 80) {
            insights.push("Le projet est proche de la finalisation.");
        }

        const teamsWithoutWork = teams.filter(t => !households.some(h => h.teamId === t.id));
        if (teamsWithoutWork.length > 0) {
            insights.push(`${teamsWithoutWork.length} équipes sont actuellement inactives.`);
        }

        const problemHouseholds = households.filter(h => h.status === 'Problème').length;
        if (problemHouseholds > 0) {
            insights.push(`${problemHouseholds} ménages présentent des anomalies à résoudre.`);
        }

        return insights;
    }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.ReportService = ReportService;
}
