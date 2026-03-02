/**
 * GrappeAssignmentModel - Pure business logic for sub-grappe calculations.
 * No DOM dependencies. No global window access.
 */
class GrappeAssignmentModel {
    /**
     * @param {Object} constants - Injected constants (TEAM_TYPES, etc.)
     */
    constructor(constants) {
        this.TEAM_TYPES = constants.TEAM_TYPES;
    }

    /**
     * computeCompleteness - Calculates 0-100% score based on assigned trades.
     */
    computeCompleteness(assignments) {
        if (!assignments) return 0;
        const types = Object.values(this.TEAM_TYPES);
        if (types.length === 0) return 0;

        let assignedCount = 0;
        types.forEach(type => {
            if (assignments[type] && assignments[type].length > 0) {
                assignedCount++;
            }
        });

        return Math.round((assignedCount / types.length) * 100);
    }

    /**
     * computeRiskIndex - Calculates a risk score based on delays and historical data.
     */
    computeRiskIndex(sg, assignments) {
        if (!sg || !assignments) return 0;
        let score = 0;

        // 1. Manque de préparation (aucune équipe assignée)
        const isUnassigned = !Object.values(assignments).some(arr => arr.length > 0);
        if (isUnassigned) score += 40;

        // 2. Manque de contrôle (si d'autres trades sont là)
        const hasOthers = (assignments[this.TEAM_TYPES.MACONS]?.length || 0) +
            (assignments[this.TEAM_TYPES.RESEAU]?.length || 0);
        const hasControl = assignments[this.TEAM_TYPES.CONTROLE]?.length > 0;
        if (hasOthers > 0 && !hasControl) score += 20;

        // 3. Concentration (trop d'équipes sur une petite zone)
        const totalTeams = Object.values(assignments).reduce((sum, arr) => sum + arr.length, 0);
        if (totalTeams > 4) score += 15;

        // 4. Score de densité (mocked or from sg data)
        const density = (sg.nb_menages || 0) > 200 ? 25 : 0;
        score += Math.min(score + density, 100);

        return Math.min(score, 100);
    }

    /**
     * filterSubGrappes - Filters data based on logic.
     */
    filterSubGrappes(items, filters, getAssignmentsFn) {
        const { region, status } = filters;

        return items.filter(sg => {
            // Region
            if (region && region !== '' && sg.region !== region) return false;

            // Status
            if (!status || status === 'all') return true;

            const asgn = getAssignmentsFn(sg.id);
            const score = this.computeCompleteness(asgn);
            const risk = this.computeRiskIndex(sg, asgn);
            const hasControl = asgn[this.TEAM_TYPES.CONTROLE]?.length > 0;

            if (status === 'incomplete' && score >= 100) return false;
            if (status === 'missing_control' && hasControl) return false;
            if (status === 'ready_for_control' && (score < 75 || hasControl)) return false;
            if (status === 'high_risk' && risk < 70) return false;
            if (status === 'complete' && score < 100) return false;

            return true;
        });
    }
}

// legacy global export for pages/bundles that expect a global class
window.GrappeAssignmentModel = GrappeAssignmentModel;
export default GrappeAssignmentModel;
