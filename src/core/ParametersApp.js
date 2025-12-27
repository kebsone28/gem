(function (global) {
    /**
     * Main Application Controller for Parametres Page
     * Implements the "Modern Architecture" while bridging with Legacy Systems.
     */
    class ParametersApp {
        constructor() {
            this.mode = 'manual'; // 'manual', 'ai', 'auto'
            // Ensure AIService is available manually if not imported
            this.ai = (typeof AIService !== 'undefined') ? new AIService() : null;
            this.sync = window.syncService; // Using existing global service
            this.projectService = window.projectService; // Using existing global service

            // State
            this.currentProject = null;
            this.isInitialized = false;

            // UI References
            this.ui = {
                modeButtons: {
                    manual: document.getElementById('modeManual'),
                    ai: document.getElementById('modeAI'),
                    auto: document.getElementById('modeAuto')
                },
                modeDescription: document.getElementById('modeDescription'),
                statusLabel: document.getElementById('currentModeLabel')
            };
        }

        async init() {
            console.log('🚀 ParametersApp initializing...');

            try {
                // 1. Wait for Global Services (Dexie, etc.)
                await this.waitForGlobals();

                // 2. Refresh references (in case they were null)
                this.sync = window.syncService;
                this.projectService = window.projectService;

                // 3. Load Data
                await this.loadProjectData();

                // 4. Setup Event Listeners
                this.setupEventListeners();

                this.isInitialized = true;
                console.log('✅ ParametersApp initialized successfully');

                // Default to manual mode
                this.setMode('manual');

            } catch (error) {
                console.error('❌ ParametersApp initialization failed:', error);
                if (window.showNotification) window.showNotification('Erreur initialisation app', 'error');
            }
        }

        async waitForGlobals() {
            return new Promise(resolve => {
                if (window.projectService && window.syncService) return resolve();

                const check = setInterval(() => {
                    if (window.projectService && window.syncService) {
                        clearInterval(check);
                        resolve();
                    }
                }, 100);

                // Fallback timeout
                setTimeout(() => {
                    clearInterval(check);
                    resolve(); // Try anyway
                }, 5000);
            });
        }

        async loadProjectData() {
            // Load the current project from params or default
            // For V3, we often grab from DOM or LocalStorage if not fully SPA
            const projectId = 'current'; // or parse URL
            // this.currentProject = await this.projectService.getProject(projectId);
        }

        setupEventListeners() {
            // Mode Switching
            if (this.ui.modeButtons.manual) {
                this.ui.modeButtons.manual.addEventListener('click', () => this.setMode('manual'));
                this.ui.modeButtons.ai.addEventListener('click', () => this.setMode('ai'));
                this.ui.modeButtons.auto.addEventListener('click', () => this.setMode('auto'));
            }

            // Optimize Button
            const btnOptimize = document.getElementById('btnOptimize');
            if (btnOptimize) {
                btnOptimize.addEventListener('click', () => this.optimizeWithAI());
            }

            // Bridge with Legacy "Save" events if needed
            window.addEventListener('project.saved', () => {
                if (this.mode === 'auto') {
                    console.log('Auto-optimizing after save...');
                    // this.optimizeWithAI();
                }
            });
        }

        setMode(mode) {
            this.mode = mode;

            // Update UI Classes
            Object.keys(this.ui.modeButtons).forEach(key => {
                const btn = this.ui.modeButtons[key];
                if (btn) {
                    if (key === mode) btn.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
                    else btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-md');
                }
            });

            // Update Description
            const descriptions = {
                manual: 'Vous avez le contrôle total sur tous les paramètres. Saisissez directement le nombre d\'équipes.',
                ai: "L'IA analyse vos choix et suggère des optimisations.",
                auto: 'Le système ajuste automatiquement les ressources pour tenir les délais.'
            };

            if (this.ui.modeDescription) this.ui.modeDescription.textContent = descriptions[mode];
            if (this.ui.statusLabel) this.ui.statusLabel.textContent = mode === 'ai' ? 'IA Assistée' : (mode === 'auto' ? 'Auto-Optimisé' : 'Manuel');

            document.body.setAttribute('data-mode', mode);

            // Toggle ReadOnly on Team Inputs
            const inputs = [
                'totalPrepTeams', 'totalDeliveryTeams', 'totalMasonTeams', 'totalNetworkTeams',
                'totalInteriorType1Teams', 'totalInteriorType2Teams', 'totalControllerTeams'
            ];

            const isManual = (mode === 'manual');
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    if (isManual) {
                        el.removeAttribute('readonly');
                        el.classList.remove('bg-transparent', 'border-none'); // Visual cue for editable
                        el.classList.add('bg-white', 'border', 'border-gray-300', 'shadow-sm');
                    } else {
                        el.setAttribute('readonly', 'true');
                        el.classList.add('bg-transparent', 'border-none');
                        el.classList.remove('bg-white', 'border', 'border-gray-300', 'shadow-sm');
                    }
                }
            });

            console.log(`Mode changed to: ${mode}`);
        }

        async optimizeWithAI() {
            try {
                if (!this.ai) {
                    if (typeof AIService !== 'undefined') this.ai = new AIService();
                    else return alert("Service IA non disponible");
                }

                // Gather current data from DOM (via legacy helpers or adapter)
                // Ideally we check getZonesFromForm() exposed by adapter
                const totalHouses = document.getElementById('totalHouses')?.value || 0;
                const projectData = { totalHouses };

                const suggestions = await this.ai.optimizeProject(projectData);

                if (suggestions.length > 0) {
                    const topTip = suggestions[0];
                    alert(`🤖 Conseil IA:\n${topTip.title}\n\n${topTip.description}`);

                    // If Auto mode, apply automatically (simulated)
                    if (this.mode === 'auto' && topTip.action === 'apply_team_counts') {
                        // Apply logic would go here
                        // e.g. fill inputs
                    }
                } else {
                    alert('🤖 Tout semble optimal pour le moment !');
                }

            } catch (e) {
                console.error('Optimization error:', e);
                alert('Erreur IA: ' + e.message);
            }
        }
    }

    // Export globally
    global.ParametersApp = ParametersApp;

})(typeof window !== 'undefined' ? window : this);
