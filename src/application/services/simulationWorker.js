/**
 * Web Worker for heavy simulation computations
 */
self.onmessage = function (e) {
    const { params, project, totalHouseholds } = e.data;

    // Calcul de la durée estimée basé sur le goulot d'étranglement
    const teamCaps = project.teamCapabilities || {};
    const capacities = [];

    // On parcourt tous les paramètres passés pour trouver les équipes
    Object.keys(params).forEach(key => {
        if (key.endsWith('Teams')) {
            const type = key.replace('Teams', '').toLowerCase();
            const count = params[key];
            const cap = teamCaps[type] ? teamCaps[type].daily : 5;
            if (count > 0) {
                capacities.push(count * cap);
            }
        }
    });

    const minDailyCapacity = Math.min(...capacities.filter(c => c > 0)) || 5;
    const baseDuration = Math.ceil(totalHouseholds / minDailyCapacity);
    const duration = baseDuration * (1 + params.unforeseenRate / 100);

    // Calcul des coûts
    const projectCosts = project.costs || {};
    let dailyOpsCost = 0;

    Object.keys(params).forEach(key => {
        if (key.endsWith('Teams')) {
            const type = key.replace('Teams', '');
            // Capitalize first letter to match naming convention "perXTeam"
            const formattedType = type.charAt(0).toUpperCase() + type.slice(1);
            const costKey = `per${formattedType}Team`;
            const unitCost = projectCosts[costKey] || 100000; // Fallback
            dailyOpsCost += params[key] * unitCost;
        }
    });

    const directLaborCost = dailyOpsCost * duration;

    // Logistique
    const vehicleCost = (params.vehicleCount || 5) * (params.vehicleDailyRate || 50000) * duration;
    const fuelCost = (params.vehicleCount || 5) * (params.fuelPrice || 700) * 20 * duration;

    const totalCost = directLaborCost + vehicleCost + fuelCost;

    const results = {
        duration: Math.round(duration),
        cost: Math.round(totalCost),
        households: totalHouseholds,
        phases: [
            { name: 'Gros Œuvre', duration: duration * 0.4, cost: totalCost * 0.3 },
            { name: 'Raccordement', duration: duration * 0.3, cost: totalCost * 0.4 },
            { name: 'Second Œuvre', duration: duration * 0.2, cost: totalCost * 0.2 },
            { name: 'Validation', duration: duration * 0.1, cost: totalCost * 0.1 }
        ],
        progress: [10, 30, 60, 90, 100],
        timeLabels: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Terminé']
    };

    self.postMessage(results);
};
