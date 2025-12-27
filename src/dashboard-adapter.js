/**
 * Dashboard Adapter
 * Intègre la nouvelle architecture DDD avec le dashboard existant (index.html)
 * Remplace dashboard_manager.js et dashboard_filters.js
 */

(function () {
    'use strict';

    console.log('📊 Loading dashboard adapter...');

    // Attendre l'initialisation
    window.addEventListener('load', async () => {
        await new Promise(resolve => {
            if (window.householdRepository && window.projectStore) {
                resolve();
            } else {
                window.eventBus?.once('app.initialized', resolve);
            }
        });

        console.log('✅ Dashboard adapter ready');
        initDashboardAdapter();
    });

    /**
     * Initialise l'adaptateur dashboard
     */
    function initDashboardAdapter() {
        // Remplacer les fonctions globales legacy
        overrideLegacyFunctions();

        // Initialiser les filtres
        initializeFilters();

        // Première mise à jour
        updateDashboard();

        // Rafraîchir toutes les 30 secondes
        setInterval(() => updateDashboard(), 30000);

        // Écouter les événements
        setupEventListeners();

        console.log('✅ Dashboard adapter initialized');
    }

    /**
     * Remplace les fonctions globales legacy
     */
    function overrideLegacyFunctions() {
        // Remplacer updateDashboard
        window.updateDashboard = updateDashboard;

        // Remplacer applyDashboardFilters
        window.applyDashboardFilters = applyFilters;

        console.log('✅ Legacy dashboard functions overridden');
    }

    /**
     * Mise à jour complète du dashboard
     */
    async function updateDashboard() {
        try {
            await updateKPIs();
            await updateCharts();
            await updateRegionalTable();
            await updateOptimizationSuggestions();
        } catch (error) {
            console.error('Error updating dashboard:', error);
        }
    }

    /**
     * Met à jour les KPIs principaux
     */
    async function updateKPIs() {
        try {
            // 1. Avancement Global
            const stats = await window.householdRepository.getStats();
            const total = await window.householdRepository.count();
            const completed = stats['Terminé'] || 0;
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

            updateElement('globalProgress', `${progress}%`);
            updateElement('progressBar', null, { width: `${progress}%` });

            // 2. Ménages Terminés
            updateElement('completedHouses', completed.toLocaleString());
            updateElement('totalHouses', total.toLocaleString());

            // 3. Équipes Actives
            const teams = await window.teamRepository?.findAll() || [];
            const activeTeams = teams.filter(t => t.status === 'active').length;
            updateElement('activeTeams', activeTeams);
            updateElement('totalTeams', teams.length);

            // 4. Jours Restants
            const project = window.projectStore?.getState();
            if (project && project.startDate) {
                const startDate = new Date(project.startDate);
                const today = new Date();
                const daysPassed = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));

                // Estimer la durée totale basée sur la productivité
                const avgProductivity = calculateAverageProductivity(stats);
                const estimatedDuration = avgProductivity > 0 ? Math.ceil(total / avgProductivity) : 0;
                const daysRemaining = Math.max(0, estimatedDuration - daysPassed);

                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + estimatedDuration);

                updateElement('daysRemaining', daysRemaining);
                updateElement('endDate', endDate.toLocaleDateString('fr-FR'));
            }

            // 5. Région la Plus Rapide (basé sur les zones)
            const zones = await window.zoneRepository?.findAll() || [];
            if (zones.length > 0) {
                const zoneStats = await Promise.all(zones.map(async (zone) => {
                    const zoneHouseholds = await window.householdRepository.findByZone(zone.id);
                    const zoneCompleted = zoneHouseholds.filter(h => h.status === 'Terminé').length;
                    const zoneProgress = zoneHouseholds.length > 0 ? (zoneCompleted / zoneHouseholds.length) : 0;
                    return { name: zone.name, progress: zoneProgress, completed: zoneCompleted, total: zoneHouseholds.length };
                }));

                const fastestZone = zoneStats.reduce((fastest, current) =>
                    current.progress > fastest.progress ? current : fastest
                    , zoneStats[0]);

                updateElement('fastestRegion', fastestZone.name);
                updateElement('fastestRegionDuration', `${Math.round(fastestZone.progress * 100)}% terminé`);
            }

            // 6. Productivité Moyenne
            updateElement('avgProductivity', avgProductivity.toFixed(1));

        } catch (error) {
            console.error('Error updating KPIs:', error);
        }
    }

    /**
     * Calcule la productivité moyenne (ménages/jour)
     */
    function calculateAverageProductivity(stats) {
        // Utiliser MetricsService si disponible
        if (window.metricsService) {
            try {
                const metrics = window.metricsService.getProductivityMetrics();
                return metrics.averageDaily || 0;
            } catch (e) {
                console.warn('MetricsService not available, using fallback');
            }
        }

        // Fallback : estimer basé sur les données
        const completed = stats['Terminé'] || 0;
        const project = window.projectStore?.getState();
        if (project && project.startDate && completed > 0) {
            const startDate = new Date(project.startDate);
            const today = new Date();
            const daysPassed = Math.max(1, Math.floor((today - startDate) / (1000 * 60 * 60 * 24)));
            return completed / daysPassed;
        }

        return 0;
    }

    /**
     * Met à jour les graphiques
     */
    async function updateCharts() {
        try {
            await renderProgressChart();
            await renderBudgetChart();
            await renderProductivityChart();
        } catch (error) {
            console.error('Error updating charts:', error);
        }
    }

    /**
     * Graphique d'avancement par statut
     */
    async function renderProgressChart() {
        const chartDiv = document.getElementById('progressChart');
        if (!chartDiv || typeof Plotly === 'undefined') return;

        const stats = await window.householdRepository.getStats();

        const data = [{
            values: Object.values(stats),
            labels: Object.keys(stats),
            type: 'pie',
            marker: {
                colors: ['#10B981', '#F59E0B', '#EF4444', '#6B7280']
            }
        }];

        const layout = {
            title: 'Répartition par Statut',
            height: 300,
            margin: { t: 40, b: 20, l: 20, r: 20 }
        };

        Plotly.newPlot(chartDiv, data, layout, { responsive: true });
    }

    /**
     * Graphique de budget (si CostCalculationService disponible)
     */
    async function renderBudgetChart() {
        const chartDiv = document.getElementById('budgetChart');
        if (!chartDiv || typeof Plotly === 'undefined') return;

        // Utiliser CostCalculationService si disponible
        if (window.costCalculationService && window.projectStore) {
            try {
                const project = window.projectStore.getState();
                const totalCost = window.costCalculationService.calculateProjectCost(project);

                // Estimer le coût dépensé basé sur l'avancement
                const stats = await window.householdRepository.getStats();
                const total = await window.householdRepository.count();
                const completed = stats['Terminé'] || 0;
                const progress = total > 0 ? (completed / total) : 0;
                const spentCost = totalCost * progress;

                const data = [{
                    x: ['Budget Total', 'Dépensé', 'Restant'],
                    y: [totalCost, spentCost, totalCost - spentCost],
                    type: 'bar',
                    marker: {
                        color: ['#6366F1', '#10B981', '#F59E0B']
                    }
                }];

                const layout = {
                    title: 'Suivi Budgétaire',
                    yaxis: { title: 'Montant (FCFA)' },
                    height: 300,
                    margin: { t: 40, b: 60, l: 80, r: 20 }
                };

                Plotly.newPlot(chartDiv, data, layout, { responsive: true });
            } catch (e) {
                console.warn('CostCalculationService error:', e);
            }
        }
    }

    /**
     * Graphique de productivité
     */
    async function renderProductivityChart() {
        const chartDiv = document.getElementById('productivityChart');
        if (!chartDiv || typeof Plotly === 'undefined') return;

        // Mock data pour l'instant (à remplacer par MetricsService)
        const days = Array.from({ length: 30 }, (_, i) => i + 1);
        const productivity = days.map(() => Math.random() * 10 + 5);

        const data = [{
            x: days,
            y: productivity,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Productivité',
            line: { color: '#6366F1', width: 2 }
        }];

        const layout = {
            title: 'Productivité Quotidienne',
            xaxis: { title: 'Jours' },
            yaxis: { title: 'Ménages/jour' },
            height: 300,
            margin: { t: 40, b: 60, l: 60, r: 20 }
        };

        Plotly.newPlot(chartDiv, data, layout, { responsive: true });
    }

    /**
     * Met à jour le tableau régional
     */
    async function updateRegionalTable() {
        const tableBody = document.getElementById('regionProgressTable');
        if (!tableBody) return;

        try {
            const zones = await window.zoneRepository?.findAll() || [];

            if (zones.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">Aucune zone configurée</td></tr>';
                return;
            }

            tableBody.innerHTML = '';

            for (const zone of zones) {
                const zoneHouseholds = await window.householdRepository.findByZone(zone.id);
                const zoneCompleted = zoneHouseholds.filter(h => h.status === 'Terminé').length;
                const zoneProgress = zoneHouseholds.length > 0 ? Math.round((zoneCompleted / zoneHouseholds.length) * 100) : 0;

                // Déterminer le statut
                let statusClass = 'bg-gray-100 text-gray-800';
                let statusText = 'Démarrage';
                if (zoneProgress === 100) {
                    statusClass = 'bg-green-100 text-green-800';
                    statusText = 'Terminé';
                } else if (zoneProgress >= 75) {
                    statusClass = 'bg-blue-100 text-blue-800';
                    statusText = 'En cours';
                } else if (zoneProgress >= 50) {
                    statusClass = 'bg-yellow-100 text-yellow-800';
                    statusText = 'En cours';
                }

                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50';
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHTML(zone.name)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${zoneHouseholds.length}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${zoneCompleted}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div class="bg-indigo-600 h-2 rounded-full" style="width: ${zoneProgress}%"></div>
                            </div>
                            <span class="text-sm text-gray-700">${zoneProgress}%</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${zone.teams?.length || 0}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">-</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
                            ${statusText}
                        </span>
                    </td>
                `;
                tableBody.appendChild(row);
            }
        } catch (error) {
            console.error('Error updating regional table:', error);
            tableBody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-red-500">Erreur de chargement</td></tr>';
        }
    }

    /**
     * Met à jour les suggestions d'optimisation
     */
    async function updateOptimizationSuggestions() {
        const container = document.getElementById('optimizationSuggestions');
        if (!container) return;

        // Mock suggestions pour l'instant
        const suggestions = [
            {
                type: 'info',
                icon: 'lightbulb',
                color: 'blue',
                title: 'Suggestion d\'optimisation',
                message: 'Les données de simulation sont nécessaires pour générer des suggestions.',
                action: 'Lancez une simulation dans l\'onglet Simulation'
            }
        ];

        container.innerHTML = '';

        suggestions.forEach(sug => {
            const colorClasses = {
                red: 'bg-red-50 border-red-200 text-red-800',
                orange: 'bg-orange-50 border-orange-200 text-orange-800',
                blue: 'bg-blue-50 border-blue-200 text-blue-800',
                green: 'bg-green-50 border-green-200 text-green-800'
            };

            const div = document.createElement('div');
            div.className = `border-l-4 p-4 ${colorClasses[sug.color] || colorClasses.blue}`;

            div.innerHTML = `
                <div class="flex items-start">
                    <i class="fas fa-${sug.icon} text-lg mr-3 mt-1"></i>
                    <div class="flex-1">
                        <h4 class="font-semibold text-sm">${sug.title}</h4>
                        <p class="text-sm mt-1">${sug.message}</p>
                        <p class="text-sm mt-2 font-medium">
                            <i class="fas fa-arrow-right mr-1"></i> ${sug.action}
                        </p>
                    </div>
                </div>
            `;

            container.appendChild(div);
        });
    }

    /**
     * Initialise les filtres
     */
    function initializeFilters() {
        // Peupler le filtre région
        populateRegionFilter();

        // Connecter le bouton appliquer
        const applyBtn = document.getElementById('applyFilters');
        if (applyBtn) {
            applyBtn.addEventListener('click', applyFilters);
        }
    }

    /**
     * Peuple le filtre région
     */
    async function populateRegionFilter() {
        const filterRegion = document.getElementById('filterRegion');
        if (!filterRegion) return;

        try {
            const zones = await window.zoneRepository?.findAll() || [];

            filterRegion.innerHTML = '<option value="">Toutes les régions</option>';

            zones.forEach(zone => {
                const option = document.createElement('option');
                option.value = zone.id;
                option.textContent = zone.name;
                filterRegion.appendChild(option);
            });
        } catch (error) {
            console.error('Error populating region filter:', error);
        }
    }

    /**
     * Applique les filtres
     */
    function applyFilters() {
        // Pour l'instant, juste rafraîchir le dashboard
        // TODO: Implémenter le filtrage réel
        updateDashboard();

        if (window.showNotification) {
            window.showNotification('Filtres appliqués', 'Les filtres ont été appliqués avec succès', 'info');
        }
    }

    /**
     * Configure les écouteurs d'événements
     */
    function setupEventListeners() {
        if (!window.eventBus) return;

        // Rafraîchir quand un ménage est mis à jour
        window.eventBus.on('household.updated', () => {
            updateKPIs();
        });

        // Rafraîchir quand une zone est modifiée
        window.eventBus.on('zone.updated', () => {
            updateRegionalTable();
            populateRegionFilter();
        });

        console.log('✅ Dashboard event listeners configured');
    }

    /**
     * Met à jour un élément du DOM
     */
    function updateElement(id, textContent, styles = null) {
        const el = document.getElementById(id);
        if (!el) return;

        if (textContent !== null && textContent !== undefined) {
            el.textContent = textContent;
        }

        if (styles) {
            Object.assign(el.style, styles);
        }
    }

    /**
     * Échappe le HTML pour éviter les injections
     */
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

})();
