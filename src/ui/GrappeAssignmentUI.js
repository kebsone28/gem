/**
 * GrappeAssignmentUI - SaaS-Grade UI Module for Cluster Assignments
 */
(function () {
    const getRegistry = () => window.TeamRegistry || {
        get: (id) => ({ icon: 'fas fa-question', label: id, color: 'gray' }),
        getIds: () => ['mason', 'network', 'interior', 'control']
    };

    const TEAM_TYPES = {
        MASON: 'mason',
        NETWORK: 'network',
        INTERIOR: 'interior',
        CONTROL: 'control'
    };

    const UI = {
        container: null,
        kpiContainer: null,
        project: null,
        teamsByType: {},
        config: null,
        currentFilter: 'all', // all, incomplete, missing_control, complete
        regionFilter: '',

        init(containerId, kpiContainerId) {
            this.container = document.getElementById(containerId);
            this.kpiContainer = document.getElementById(kpiContainerId);
        },

        /**
         * computeCompleteness - Calculates 0-100% score based on assigned trades.
         */
        computeCompleteness(assignments) {
            if (!assignments) return 0;
            const total = Object.keys(TEAM_TYPES).length;
            let assignedCount = 0;

            Object.values(TEAM_TYPES).forEach(type => {
                if (assignments[type] && assignments[type].length > 0) {
                    assignedCount++;
                }
            });

            return Math.round((assignedCount / total) * 100);
        },

        /**
         * computeRiskIndex - Nuanced scoring (0-100)
         * - No Control: 30
         * - Score < 50: 40
         * - No Mason: 30
         */
        computeRiskIndex(sg, asgn) {
            const score = this.computeCompleteness(asgn);
            let risk = 0;
            if (!asgn[TEAM_TYPES.CONTROL] || asgn[TEAM_TYPES.CONTROL].length === 0) risk += 30;
            if (score < 50) risk += 40;
            if (!asgn[TEAM_TYPES.MASON] || asgn[TEAM_TYPES.MASON].length === 0) risk += 30;
            return risk;
        },

        getScoreColorClass(score) {
            if (score >= 100) return 'complete';
            if (score >= 50) return 'partial';
            return 'missing';
        },

        getRiskColorClass(risk) {
            if (risk >= 70) return 'text-rose-600';
            if (risk >= 40) return 'text-amber-600';
            return 'text-emerald-600';
        },

        /**
         * renderKPIs - Displays the summary dashboard with Enterprise metrics.
         */
        renderKPIs(filteredSG) {
            if (!this.kpiContainer) return;

            const total = filteredSG.length;
            if (total === 0) {
                this.kpiContainer.innerHTML = '';
                return;
            }

            let complete = 0;
            let readyForControl = 0;
            let highRisk = 0;
            let totalWeightedScore = 0;
            let totalMenages = 0;

            filteredSG.forEach(sg => {
                const asgn = window.projectService.getAssignments(sg.id);
                const score = this.computeCompleteness(asgn);
                const risk = this.computeRiskIndex(sg, asgn);

                totalWeightedScore += (score * sg.nb_menages);
                totalMenages += sg.nb_menages;

                if (score >= 100) complete++;
                if (risk >= 70) highRisk++;

                const hasControl = asgn[TEAM_TYPES.CONTROL]?.length > 0;
                if (score >= 75 && !hasControl) readyForControl++;
            });

            const weightedAvg = totalMenages > 0 ? Math.round(totalWeightedScore / totalMenages) : 0;

            this.kpiContainer.innerHTML = `
                <div class="kpi-grid">
                    <div class="kpi-card border-l-4 border-indigo-500">
                        <span class="kpi-value text-indigo-600">${weightedAvg}%</span>
                        <span class="kpi-label">Complétude (Pondérée)</span>
                        <div class="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div class="h-full bg-indigo-500" style="width: ${weightedAvg}%"></div>
                        </div>
                    </div>
                    <div class="kpi-card border-l-4 border-emerald-500">
                        <span class="kpi-value text-emerald-600">${complete}/${total}</span>
                        <span class="kpi-label">Zones Finalisées</span>
                    </div>
                    <div class="kpi-card border-l-4 border-amber-500">
                        <span class="kpi-value text-amber-600">${readyForControl}</span>
                        <span class="kpi-label">Prêtes pour Contrôle</span>
                    </div>
                    <div class="kpi-card border-l-4 border-rose-500">
                        <span class="kpi-value text-rose-600">${highRisk}</span>
                        <span class="kpi-label">Risque Élevé (Index > 70)</span>
                    </div>
                </div>
            `;
        },

        /**
         * render - Main entry point with Enterprise filters.
         */
        async render(project, teamsByType, config, regionFilter = '', statusFilter = 'all') {
            this.project = project;
            this.teamsByType = teamsByType;
            this.config = config;
            this.regionFilter = regionFilter;
            this.currentFilter = statusFilter;

            if (!this.container) return;

            const sousGrappes = config.sous_grappes || [];

            // Filter logic
            const filtered = sousGrappes.filter(sg => {
                // Region check
                if (regionFilter && regionFilter !== '' && sg.region !== regionFilter) return false;

                // Status check
                if (!statusFilter || statusFilter === 'all') return true;

                const asgn = window.projectService.getAssignments(sg.id);
                const score = this.computeCompleteness(asgn);
                const risk = this.computeRiskIndex(sg, asgn);
                const hasControl = asgn[TEAM_TYPES.CONTROL]?.length > 0;

                if (statusFilter === 'incomplete' && score >= 100) return false;
                if (statusFilter === 'missing_control' && hasControl) return false;
                if (statusFilter === 'ready_for_control' && (score < 75 || hasControl)) return false;
                if (statusFilter === 'high_risk' && risk < 70) return false;
                if (statusFilter === 'complete' && score < 100) return false;

                return true;
            });

            this.renderKPIs(filtered);

            if (filtered.length === 0) {
                this.container.innerHTML = `
                    <div class="col-span-full py-20 text-center">
                        <div class="text-gray-300 mb-4"><i class="fas fa-search fa-4x"></i></div>
                        <p class="text-gray-500 font-medium">Aucune zone ne correspond à votre stratégie actuelle.</p>
                        <button onclick="GrappeAssignmentUI.resetFilters()" class="mt-4 text-indigo-600 font-bold hover:underline">Voir toutes les zones</button>
                    </div>
                `;
                return;
            }

            this.container.innerHTML = '';
            filtered.forEach(sg => {
                const asgn = window.projectService.getAssignments(sg.id);
                const card = this.createCardElement(sg, asgn);
                this.container.appendChild(card);
            });
        },

        resetFilters() {
            const regionSelect = document.getElementById('grappeRegionFilter');
            const statusSelect = document.getElementById('grappeStatusFilter');
            if (regionSelect) regionSelect.value = '';
            if (statusSelect) statusSelect.value = 'all';

            if (window.renderGrappes) window.renderGrappes();
        },

        createCardElement(sg, asgn) {
            const score = this.computeCompleteness(asgn);
            const risk = this.computeRiskIndex(sg, asgn);
            const colorClass = this.getScoreColorClass(score);
            const riskColor = this.getRiskColorClass(risk);
            const teamLookup = this.buildTeamLookup();

            const card = document.createElement('div');
            card.id = `card-${sg.id}`;
            card.className = 'sg-card';

            const renderBadgeList = (typeIds) => {
                if (!typeIds || typeIds.length === 0) return '—';
                return typeIds.map(id => teamLookup[id] || id).join(', ');
            };

            const isMissing = (type) => !asgn[type] || asgn[type].length === 0;

            card.innerHTML = `
                <div class="sg-card-header">
                    <div>
                        <span class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">${sg.region}</span>
                        <h4 class="font-black text-gray-800 flex items-center gap-2">
                            <span class="bg-violet-600 text-white text-[10px] px-1.5 py-0.5 rounded">${sg.code}</span>
                            ${sg.nom}
                        </h4>
                    </div>
                    <div class="text-right">
                        <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">${sg.nb_menages} Ménages</span>
                        <span class="text-[9px] font-black ${riskColor} uppercase">Risk Index: ${risk}</span>
                    </div>
                </div>
                <div class="sg-card-body">
                    <div class="completeness-container">
                        <div class="completeness-header">
                            <span class="text-[11px] font-bold text-gray-600">Complétude</span>
                            <span class="text-xs font-black text-${colorClass}">${score}%</span>
                        </div>
                        <div class="completeness-bar-bg">
                            <div class="completeness-bar-fill bg-${colorClass}" style="width: ${score}%"></div>
                        </div>
                    </div>
                    <div class="trade-status-list">
                        ${getRegistry().getIds().map(typeId => {
                const trade = getRegistry().get(typeId);
                const missing = !asgn[typeId] || asgn[typeId].length === 0;
                return `
                                <div class="trade-item ${missing ? 'missing' : 'active'}">
                                    <i class="${trade.icon} w-3 text-center"></i>
                                    <span class="truncate">${renderBadgeList(asgn[typeId])}</span>
                                </div>
                            `;
            }).join('')}
                    </div>
                </div>
                <div class="sg-card-footer">
                   <button onclick="GrappeAssignmentUI.openModal('${sg.id}')" 
                           class="w-full bg-white border-2 border-indigo-600 text-indigo-700 font-black text-xs py-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-all uppercase tracking-tighter">
                        <i class="fas fa-user-plus mr-1"></i> Modifier l'Affectation
                   </button>
                </div>
            `;
            return card;
        },

        buildTeamLookup() {
            const all = [];
            Object.values(this.teamsByType || {}).forEach(list => all.push(...list));
            return all.reduce((acc, t) => {
                acc[t.id] = t.name || t._name || t.id;
                return acc;
            }, {});
        },

        /**
         * openModal - Build and show the assignment modal for a specific SG.
         */
        openModal(sgId) {
            // Use window.GrappeAssignmentUI to ensure context if 'this' is lost during industrial delegation
            const self = window.GrappeAssignmentUI;
            const config = self.config || window.GRAPPES_CONFIG;

            if (!config || !config.sous_grappes) {
                console.error('[GrappeAssignmentUI] Configuration not found for modal');
                return;
            }

            const sg = config.sous_grappes.find(s => s.id === sgId);
            if (!sg) return;

            const asgn = window.projectService.getAssignments(sgId);

            const createSection = (title, key, icon) => {
                const trade = getRegistry().get(key) || { label: title || key, icon: icon || 'fa-users', color: 'gray' };
                const options = this.teamsByType[key] || [];
                const currentIds = asgn[key] || [];

                return `
                    <div class="trade-group">
                        <label class="trade-group-title">
                            <i class="${trade.icon} text-indigo-500"></i>
                            ${trade.label}
                        </label>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            ${options.map(t => {
                    const checked = currentIds.some(id => String(id) === String(t.id)) ? 'checked' : '';
                    return `
                                    <label class="flex items-center gap-2 p-2 rounded hover:bg-white cursor-pointer transition-all border border-transparent hover:border-violet-100">
                                        <input type="checkbox" class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" 
                                               data-sg-id="${sgId}" data-team-key="${key}" value="${t.id}" ${checked}
                                               onchange="GrappeAssignmentUI.saveFromModal('${sgId}')">
                                        <span class="text-xs font-semibold text-gray-700">${t.name || t._name || 'Équipe sans nom'}</span>
                                    </label>
                                `;
                }).join('')}
                            ${options.length === 0 ? '<p class="text-[10px] text-gray-400 italic">Aucune équipe disponible</p>' : ''}
                        </div>
                    </div>
                `;
            };

            const TITLE_MAP = {
                mason: { title: 'Maçonnerie', icon: 'fa-hammer' },
                network: { title: 'Réseau MT/BT', icon: 'fa-plug' },
                interior: { title: 'Installation Intérieure', icon: 'fa-home' },
                control: { title: 'Départ Contrôle', icon: 'fa-clipboard-check' },
                others: { title: 'Autres Équipes', icon: 'fa-users' }
            };

            let sectionsHtml = '';
            Object.keys(this.teamsByType).forEach(key => {
                const info = TITLE_MAP[key] || { title: key.charAt(0).toUpperCase() + key.slice(1), icon: 'fa-users' };
                if (this.teamsByType[key].length > 0 || !TEAM_TYPES[key.toUpperCase()]) {
                    sectionsHtml += createSection(info.title, key, info.icon);
                }
            });

            const content = document.createElement('div');
            content.className = 'assignment-modal-grid';
            content.innerHTML = `
                <div class="flex items-center gap-3 mb-2 p-4 bg-indigo-50 rounded-xl">
                    <div class="bg-indigo-600 text-white p-2 rounded-lg"><i class="fas fa-map-marked-alt"></i></div>
                    <div>
                        <h3 class="text-sm font-black text-indigo-900">${sg.nom}</h3>
                        <p class="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">${sg.code} • ${sg.region} • ${sg.nb_menages} Ménages</p>
                    </div>
                </div>
                ${sectionsHtml}
                
                <div class="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                    <button onclick="closeModal()" class="px-6 py-2 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-all uppercase">Fermer</button>
                    <button onclick="closeModal()" class="px-6 py-2 rounded-xl text-sm font-black bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all uppercase">Terminer</button>
                </div>
            `;

            window.openModal(`Piloter la Zone : ${sg.code}`, content);
        },

        saveTimeout: null,
        async saveFromModal(sgId) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(async () => {
                try {
                    const inputs = document.querySelectorAll(`input[data-sg-id="${sgId}"]`);
                    const assignments = {};

                    inputs.forEach(input => {
                        const key = input.dataset.teamKey;
                        if (!assignments[key]) assignments[key] = [];
                        if (input.checked) assignments[key].push(input.value);
                    });

                    // Persistence & Update
                    // Persistence & Update (SaaS-Grade: Always use the Class)
                    if (window.ProjectRepository) {
                        const project = await window.ProjectRepository.getCurrent();
                        if (project) {
                            // Update local service with project context
                            for (const [key, ids] of Object.entries(assignments)) {
                                window.projectService.updateAssignment(project, sgId, key, ids);
                            }

                            await window.ProjectRepository.save(project);
                            // S'assurer que le service global utilise cette instance à jour
                            window.projectService.project = project;

                            // Reconstruction index avec migration FORCEE car on vient de modifier l'UI
                            if (window.projectService.rebuildIndex) {
                                window.projectService.rebuildIndex(project, { migrate: true });
                            }
                        }
                    }

                    // UI Feedback
                    this.refreshCard(sgId);
                    this.renderKPIs(this.getCurrentlyFilteredSG());

                    Toast.fire({
                        icon: 'success',
                        title: 'Réaffectation réussie'
                    });
                } catch (err) {
                    console.error('Save failed:', err);
                    Toast.fire({
                        icon: 'error',
                        title: 'Erreur de sauvegarde',
                        text: 'La modification n\'a pas pu être enregistrée.'
                    });
                    // Rollback UI (re-render)
                    if (window.renderGrappes) window.renderGrappes();
                }
            }, 300);
        },

        refreshCard(sgId) {
            const card = document.getElementById(`card-${sgId}`);
            if (!card) return;

            const sg = (this.config.sous_grappes || []).find(s => s.id === sgId);
            const asgn = window.projectService.getAssignments(sgId);

            const newCard = this.createCardElement(sg, asgn);
            card.replaceWith(newCard);
        },

        getCurrentlyFilteredSG() {
            const sousGrappes = this.config.sous_grappes || [];
            return sousGrappes.filter(sg => {
                if (this.regionFilter && sg.region !== this.regionFilter) return false;
                const asgn = window.projectService.getAssignments(sg.id);
                const score = this.computeCompleteness(asgn);
                const risk = this.computeRiskIndex(sg, asgn);
                const hasControl = asgn[TEAM_TYPES.CONTROL]?.length > 0;

                if (this.currentFilter === 'incomplete' && score >= 100) return false;
                if (this.currentFilter === 'missing_control' && hasControl) return false;
                if (this.currentFilter === 'ready_for_control' && (score < 75 || hasControl)) return false;
                if (this.currentFilter === 'high_risk' && risk < 70) return false;
                if (this.currentFilter === 'complete' && score < 100) return false;
                return true;
            });
        }
    };

    const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });

    window.GrappeAssignmentUI = UI;
})();
