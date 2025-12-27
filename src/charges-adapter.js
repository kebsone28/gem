/**
 * Adaptateur pour le module Charges
 * Connecte l'interface de charges (charges.html) au CostCalculationService (DDD)
 */

(function () {
    'use strict';

    console.log('💰 Loading Charges Adapter...');

    // Attendre l'initialisation
    window.addEventListener('load', async () => {
        // Attendre que les services soient disponibles
        if (window.CostCalculationService && window.ProjectService) {
            initChargesAdapter();
        } else {
            // Fallback: attendre l'événement app.initialized
            window.eventBus?.once('app.initialized', initChargesAdapter);
        }
    });

    function initChargesAdapter() {
        console.log('✅ Initializing Charges Adapter');

        // Surcharger la fonction renderCharges définie dans charges.html
        // Note: Comme renderCharges est définie dans un script inline qui s'exécute au DOMContentLoaded,
        // nous devons nous assurer que notre override arrive au bon moment ou remplacer la logique.

        // Stratégie : On remplace window.calculateCosts qui est appelée par renderCharges.
        // C'est moins intrusif que de réécrire tout le rendu HTML qui est déjà bien fait dans charges.html.

        overrideCalculateCosts();
    }

    function overrideCalculateCosts() {
        const originalCalculateCosts = window.calculateCosts;

        window.calculateCosts = function () {
            console.log('🔄 Calculating costs via New Architecture (Adapter)...');

            try {
                // 1. Récupérer la configuration du projet via ProjectService ou AppState (bridge)
                // Le CostCalculationService a besoin d'une config de prix et des quantités

                // On essaie d'utiliser le service DDD s'il est instancié
                if (window.costCalculationService) {
                    // TODO: Le service a besoin d'être alimenté avec les données actuelles
                    // Pour l'instant, on va simuler un retour compatible avec l'ancien format
                    // en utilisant les méthodes du service si possible, ou en refaisant le calcul
                    // proprement ici avec les données du store.
                }

                // Pour assurer la compatibilité immédiate sans casser l'UI existante qui attend une structure précise :
                // On va récupérer les données "propres" depuis le ProjectStore/AppState synchronisé
                const params = window.appState?.parameters || {};
                const project = window.appState?.project || {};

                // Utiliser une logique plus robuste que l'ancien main.js
                // Idéalement, on appellerait : window.costCalculationService.calculateProjectCost(projectData)
                // Mais le service retourne une structure différente. On va donc faire un mapping.

                return calculateCostsDDD(params, project);

            } catch (error) {
                console.error('❌ Cost calculation failed in adapter, falling back to legacy:', error);
                if (typeof originalCalculateCosts === 'function') {
                    return originalCalculateCosts();
                }
                return { totalCost: 0, dailyCost: 0, details: {} };
            }
        };

        console.log('✅ calculateCosts overridden');

        // Forcer le re-rendu si la page est déjà chargée
        if (document.readyState === 'complete') {
            if (typeof window.renderCharges === 'function') {
                window.renderCharges();
            }
        }
    }

    /**
     * Calcule les coûts en utilisant une logique alignée sur le DDD
     * Retourne un format compatible avec charges.html
     */
    function calculateCostsDDD(params, project) {
        const totalHouses = Number(project.totalHouses) || 0;
        const duration = Number(project.duration) || calculateDuration(totalHouses, params); // Fallback duration

        // 1. Coûts unitaires (Tâches)
        const masonUnit = Number(params.masonPayPerWall || 5000);
        const networkUnit = Number(params.networkElectricianPayPerConnection || 7000);
        const interiorUnitType1 = Number(params.interiorElectricianPayType1 || 8000);
        const interiorUnitType2 = Number(params.interiorElectricianPayType2 || 10000);

        // Répartition (Mock ou config)
        const shareType1 = 0.6;
        const housesType1 = Math.round(totalHouses * shareType1);
        const housesType2 = totalHouses - housesType1;

        const masonCost = totalHouses * masonUnit;
        const networkCost = totalHouses * networkUnit;
        const interiorType1Cost = housesType1 * interiorUnitType1;
        const interiorType2Cost = housesType2 * interiorUnitType2;

        // 2. Coûts journaliers (Staff)
        const supervisorCost = duration * (params.supervisorCount || 0) * (params.supervisorPayPerDay || 9000);
        const controllerCost = duration * (params.controllerTeams || 0) * (params.controllerPayPerDay || 6000);
        const deliveryCost = duration * (params.deliveryAgentCount || 0) * (params.deliveryAgentPayPerDay || 5000);
        const driverCost = duration * (params.driverCount || 0) * (params.driverPayPerDay || 4500);

        // 3. Véhicules (Achat ou Location)
        const calcVehicle = (count, purchase, rent, mode) => {
            const n = Number(count || 0);
            if (n === 0) return 0;
            return n * (mode === 'acheter' ? Number(purchase || 0) : (Number(rent || 0) * duration));
        };

        const pmVehicleCost = calcVehicle(params.pmVehicleCount, params.pmVehiclePurchaseCost, params.pmVehicleRentPerDay, params.pmVehicleAcquisition);
        const controllerVehicleCost = calcVehicle(params.controllerVehicleCount, params.controllerVehiclePurchaseCost, params.controllerVehicleRentPerDay, params.controllerVehicleAcquisition);
        const networkVehicleCost = calcVehicle(params.networkInstallerVehicleCount, params.networkInstallerVehiclePurchaseCost, params.networkInstallerVehicleRentPerDay, params.networkInstallerVehicleAcquisition);
        const truckCost = calcVehicle(params.deliveryTruckCount, params.deliveryTruckPurchaseCost, params.deliveryTruckRentPerDay, params.deliveryTruckAcquisition);

        const totalCost = masonCost + networkCost + interiorType1Cost + interiorType2Cost +
            supervisorCost + controllerCost + deliveryCost + driverCost +
            pmVehicleCost + controllerVehicleCost + networkVehicleCost + truckCost;

        return {
            totalCost,
            dailyCost: duration > 0 ? totalCost / duration : 0,
            details: {
                duration,
                totalHouses,
                wallsBuilt: totalHouses, // Assumption: all built
                networkConnections: totalHouses,
                interiorInstallationsType1: housesType1,
                interiorInstallationsType2: housesType2,

                masonUnit, networkUnit, interiorUnitType1, interiorUnitType2,

                masonCost, networkElectricianCost: networkCost,
                interiorType1Cost, interiorType2Cost,

                supervisorCost, controllerCost, deliveryAgentCost: deliveryCost, driverCost,

                pmVehicles: params.pmVehicleCount, pmAcq: params.pmVehicleAcquisition, pmPurchaseCost: params.pmVehiclePurchaseCost, pmRentPerDay: params.pmVehicleRentPerDay, pmVehicleCost,
                controllerVehicles: params.controllerVehicleCount, controllerAcq: params.controllerVehicleAcquisition, controllerPurchaseCost: params.controllerVehiclePurchaseCost, controllerRentPerDay: params.controllerVehicleRentPerDay, controllerVehicleCost,
                networkInstallerVehicles: params.networkInstallerVehicleCount, networkInstallerAcq: params.networkInstallerVehicleAcquisition, networkInstallerPurchaseCost: params.networkInstallerVehiclePurchaseCost, networkInstallerRentPerDay: params.networkInstallerVehicleRentPerDay, networkInstallerVehicleCost: networkVehicleCost,
                deliveryTrucks: params.deliveryTruckCount, deliveryTruckAcq: params.deliveryTruckAcquisition, deliveryTruckPurchaseCost: params.deliveryTruckPurchaseCost, deliveryTruckRentPerDay: params.deliveryTruckRentPerDay, deliveryTruckCost: truckCost
            }
        };
    }

    function calculateDuration(totalHouses, params) {
        // Estimation simple si pas de simulation
        const rate = Math.min(
            (params.masonTeams || 1) * (params.masonRate || 8),
            (params.networkElectricianTeams || 1) * (params.networkRate || 17)
        );
        return Math.ceil(totalHouses / (rate || 1));
    }

})();
