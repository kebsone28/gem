/**
 * Adaptateur pour la page terrain
 * Intègre la nouvelle architecture avec la gestion terrain existante
 */

(function () {
    'use strict';

    console.log('🗺️ Loading terrain adapter...');

    // Attendre l'initialisation
    window.addEventListener('load', async () => {
        await new Promise(resolve => {
            if (window.householdService) {
                resolve();
            } else {
                window.eventBus?.once('app.initialized', resolve);
            }
        });

        console.log('✅ Terrain adapter ready');

        // Initialiser l'adaptateur
        initTerrainAdapter();
    });

    /**
     * Initialise l'adaptateur terrain
     */
    function initTerrainAdapter() {
        // Écouter les événements de ménages
        setupHouseholdEventListeners();

        // Créer des fonctions utilitaires
        createTerrainUtilities();

        // Wrapper pour les fonctions existantes
        wrapExistingFunctions();
    }

    /**
     * Configure les écouteurs d'événements
     */
    function setupHouseholdEventListeners() {
        if (!window.eventBus) return;

        // Écouter les changements de statut
        window.eventBus.on('household.status.changed', (data) => {
            console.log('Household status changed:', data);

            // Mettre à jour la carte si MapManager existe
            if (window.mapManager && typeof window.mapManager.updateMarkerColor === 'function') {
                window.mapManager.updateMarkerColor(data.householdId, data.newStatus);
            }

            // Rafraîchissement via la fonction exposée par terrain_main.js
            if (typeof window.renderHouseholdList === 'function') {
                window.renderHouseholdList();
            } else if (typeof window.refreshTerrainData === 'function') {
                window.refreshTerrainData();
            }

            // Afficher une notification
            showTerrainNotification(
                'Statut mis à jour',
                `Ménage ${data.householdId} : ${data.newStatus}`,
                'success'
            );
        });

        // Écouter la création de ménages
        window.eventBus.on('household.created', (data) => {
            console.log('Household created:', data);

            if (typeof window.renderHouseholdList === 'function') {
                window.renderHouseholdList();
            } else if (typeof window.refreshTerrainData === 'function') {
                window.refreshTerrainData();
            }

            if (window.mapManager && typeof window.mapManager.addMarker === 'function') {
                // Charger le ménage et l'ajouter à la carte
                loadAndDisplayHousehold(data.householdId);
            }
        });

        // Écouter l'import batch
        window.eventBus.on('households.imported', (data) => {
            console.log('Households imported:', data.count);

            showTerrainNotification(
                'Import réussi',
                `${data.count} ménages importés`,
                'success'
            );

            if (typeof window.renderHouseholdList === 'function') {
                window.renderHouseholdList();
            } else if (typeof window.refreshTerrainData === 'function') {
                window.refreshTerrainData();
            }
        });

        console.log('✅ Terrain event listeners configured');
    }

    /**
     * Crée des fonctions utilitaires pour terrain
     */
    function createTerrainUtilities() {
        /**
         * Charge tous les ménages et les affiche
         */
        window.loadAllHouseholds = async function () {
            try {
                window.metricsService?.startTimer('loadAllHouseholds');

                const households = await window.householdRepository.findAll();

                console.log(`Loaded ${households.length} households`);

                window.metricsService?.endTimer('loadAllHouseholds');

                return households;
            } catch (error) {
                window.logger?.error('Error loading households', error);
                throw error;
            }
        };

        /**
         * Recherche des ménages
         */
        window.searchHouseholds = async function (criteria) {
            try {
                return await window.householdService.searchHouseholds(criteria);
            } catch (error) {
                window.logger?.error('Error searching households', error);
                throw error;
            }
        };

        /**
         * Met à jour le statut d'un ménage
         */
        window.updateHouseholdStatus = async function (householdId, newStatus, reason = null) {
            try {
                window.metricsService?.startTimer('updateHouseholdStatus');

                const household = await window.householdService.updateHouseholdStatus(
                    householdId,
                    newStatus,
                    'terrain-user',
                    reason
                );

                window.metricsService?.endTimer('updateHouseholdStatus');

                return household;
            } catch (error) {
                window.logger?.error('Error updating household status', error);
                showTerrainNotification('Erreur', error.message, 'error');
                throw error;
            }
        };

        /**
         * Importe des ménages depuis Excel
         */
        window.importHouseholdsFromExcel = async function (excelData) {
            try {
                window.metricsService?.startTimer('importHouseholds');

                const households = await window.householdService.importHouseholds(excelData);

                window.metricsService?.endTimer('importHouseholds');
                window.metricsService?.incrementCounter('households.imported', households.length);

                return households;
            } catch (error) {
                window.logger?.error('Error importing households', error);
                showTerrainNotification('Erreur d\'import', error.message, 'error');
                throw error;
            }
        };

        /**
         * Obtient les statistiques des ménages
         */
        window.getHouseholdStats = async function (zoneId = null) {
            try {
                return await window.householdService.getStats(zoneId);
            } catch (error) {
                window.logger?.error('Error getting household stats', error);
                throw error;
            }
        };

        /**
         * Ajoute une note à un ménage
         */
        window.addHouseholdNote = async function (householdId, content, author = 'terrain-user') {
            try {
                return await window.householdService.addNote(householdId, content, author);
            } catch (error) {
                window.logger?.error('Error adding note', error);
                throw error;
            }
        };



        // Écouter les événements d'import
        if (window.eventBus) {
            window.eventBus.on('household-imported', (data) => {
                showTerrainNotification(
                    'Import réussi',
                    `${data.count} ménages importés`,
                    'success'
                );

                if (typeof window.renderHouseholdList === 'function') {
                    window.renderHouseholdList();
                } else if (typeof window.refreshTerrainData === 'function') {
                    window.refreshTerrainData();
                }
            });
        }

        console.log('✅ Terrain event listeners configured');
    }

    /**
     * Wrapper pour les fonctions existantes
     */
    function wrapExistingFunctions() {
        // Si une fonction loadHouseholds existe déjà, la wrapper
        if (typeof window.loadHouseholds === 'function') {
            const originalLoadHouseholds = window.loadHouseholds;

            window.loadHouseholds = async function () {
                // Essayer d'utiliser le nouveau service
                if (window.householdRepository) {
                    try {
                        return await window.loadAllHouseholds();
                    } catch (error) {
                        console.warn('New architecture failed, falling back:', error);
                    }
                }

                // Fallback sur l'ancienne fonction
                return originalLoadHouseholds();
            };
        }

        console.log('✅ Existing functions wrapped');
    }

    /**
     * Charge et affiche un ménage sur la carte
     */
    async function loadAndDisplayHousehold(householdId) {
        try {
            const household = await window.householdRepository.findById(householdId);

            if (household && household.location.coordinates) {
                const coords = household.location.coordinates;

                if (window.mapManager && typeof window.mapManager.addMarker === 'function') {
                    window.mapManager.addMarker({
                        id: household.id,
                        lat: coords.latitude,
                        lon: coords.longitude,
                        status: household.status,
                        owner: household.owner.name
                    });
                }
            }
        } catch (error) {
            console.error('Error loading household for display:', error);
        }
    }

    /**
     * Affiche une notification terrain
     */
    function showTerrainNotification(title, message, type = 'info') {
        // Utiliser le système de notification existant s'il existe
        if (window.showNotification) {
            window.showNotification(title, message, type);
            return;
        }

        // Fallback sur console
        const emoji = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        console.log(`${emoji[type] || 'ℹ️'} ${title}: ${message}`);
    }

    /**
     * Crée des fonctions utilitaires pour terrain
     */
    function createTerrainUtilities() {
        /**
         * Charge tous les ménages et les affiche
         */
        window.loadAllHouseholds = async function () {
            try {
                window.metricsService?.startTimer('loadAllHouseholds');

                const households = await window.householdRepository.findAll();

                console.log(`Loaded ${households.length} households`);

                window.metricsService?.endTimer('loadAllHouseholds');

                return households;
            } catch (error) {
                window.logger?.error('Error loading households', error);
                throw error;
            }
        };

        /**
         * Recherche des ménages
         */
        window.searchHouseholds = async function (criteria) {
            try {
                return await window.householdService.searchHouseholds(criteria);
            } catch (error) {
                window.logger?.error('Error searching households', error);
                throw error;
            }
        };

        /**
         * Met à jour le statut d'un ménage
         */
        window.updateHouseholdStatus = async function (householdId, newStatus, reason = null) {
            try {
                window.metricsService?.startTimer('updateHouseholdStatus');

                const household = await window.householdService.updateHouseholdStatus(
                    householdId,
                    newStatus,
                    'terrain-user',
                    reason
                );

                window.metricsService?.endTimer('updateHouseholdStatus');

                return household;
            } catch (error) {
                window.logger?.error('Error updating household status', error);
                showTerrainNotification('Erreur', error.message, 'error');
                throw error;
            }
        };

        /**
         * Importe des ménages depuis Excel
         */
        window.importHouseholdsFromExcel = async function (excelData) {
            try {
                window.metricsService?.startTimer('importHouseholds');

                const households = await window.householdService.importHouseholds(excelData);

                window.metricsService?.endTimer('importHouseholds');
                window.metricsService?.incrementCounter('households.imported', households.length);

                return households;
            } catch (error) {
                window.logger?.error('Error importing households', error);
                showTerrainNotification('Erreur d\'import', error.message, 'error');
                throw error;
            }
        };

        /**
         * Obtient les statistiques des ménages
         */
        window.getHouseholdStats = async function (zoneId = null) {
            try {
                return await window.householdService.getStats(zoneId);
            } catch (error) {
                window.logger?.error('Error getting household stats', error);
                throw error;
            }
        };

        /**
         * Ajoute une note à un ménage
         */
        window.addHouseholdNote = async function (householdId, content, author = 'terrain-user') {
            try {
                return await window.householdService.addNote(householdId, content, author);
            } catch (error) {
                window.logger?.error('Error adding note', error);
                throw error;
            }
        };

        console.log('✅ Terrain utilities created');
    }

    /**
     * Wrapper pour les fonctions existantes
     */
    function wrapExistingFunctions() {
        // Si une fonction loadHouseholds existe déjà, la wrapper
        if (typeof window.loadHouseholds === 'function') {
            const originalLoadHouseholds = window.loadHouseholds;

            window.loadHouseholds = async function () {
                // Essayer d'utiliser le nouveau service
                if (window.householdRepository) {
                    try {
                        return await window.loadAllHouseholds();
                    } catch (error) {
                        console.warn('New architecture failed, falling back:', error);
                    }
                }

                // Fallback sur l'ancienne fonction
                return originalLoadHouseholds();
            };
        }

        console.log('✅ Existing functions wrapped');
    }

    /**
     * Charge et affiche un ménage sur la carte
     */
    async function loadAndDisplayHousehold(householdId) {
        try {
            const household = await window.householdRepository.findById(householdId);

            if (household && household.location.coordinates) {
                const coords = household.location.coordinates;

                if (window.mapManager && typeof window.mapManager.addMarker === 'function') {
                    window.mapManager.addMarker({
                        id: household.id,
                        lat: coords.latitude,
                        lon: coords.longitude,
                        status: household.status,
                        owner: household.owner.name
                    });
                }
            }
        } catch (error) {
            console.error('Error loading household for display:', error);
        }
    }

    /**
     * Affiche une notification terrain
     */
    function showTerrainNotification(title, message, type = 'info') {
        // Utiliser le système de notification existant s'il existe
        if (window.showNotification) {
            window.showNotification(title, message, type);
            return;
        }

        // Fallback sur console
        const emoji = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        console.log(`${emoji[type] || 'ℹ️'} ${title}: ${message}`);
    }

    /**
     * Fonction pour basculer vers la nouvelle architecture
     */
    window.useNewTerrainArchitecture = function () {
        console.log('🔄 Switching terrain to new architecture...');

        // Marquer comme utilisant la nouvelle architecture
        window.terrainUseNewArchitecture = true;

        // Recharger les données avec la nouvelle architecture
        if (typeof window.loadAllHouseholds === 'function') {
            window.loadAllHouseholds().then(households => {
                console.log(`✅ Loaded ${households.length} households with new architecture`);

                if (typeof window.renderHouseholdList === 'function') {
                    window.renderHouseholdList();
                } else if (typeof window.refreshTerrainData === 'function') {
                    window.refreshTerrainData();
                }
            });
        }

        console.log('✅ Terrain switched to new architecture');
    };

    /**
     * Fonction de diagnostic
     */
    window.terrainDiagnostics = function () {
        console.log('🔍 Terrain Diagnostics:');
        console.log('- HouseholdService:', !!window.householdService);
        console.log('- HouseholdRepository:', !!window.householdRepository);
        console.log('- EventBus:', !!window.eventBus);
        console.log('- Logger:', !!window.logger);
        console.log('- MetricsService:', !!window.metricsService);
        console.log('- MapManager:', !!window.mapManager);

        if (window.householdRepository) {
            window.householdRepository.count().then(count => {
                console.log(`- Total households in DB: ${count}`);
            });
        }
    };

})();
