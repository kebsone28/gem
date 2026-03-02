let currentProject = {};
let currentTeams = [];
let currentRequirements = {};
let teamTemplates = {};
let _lastCalculationHash = null; // Cache pour éviter les recalculs
const TEAM_KEY_MAP = {
    macons: ['macon', 'macons', 'maçon', 'maçons'],
    reseau: ['reseau', 'réseau', 'network'],
    interieur: ['interieur', 'intérieur', 'interior'],
    controle: ['controle', 'contrôle', 'controller']
};
let _lastDbHouseholdCount = 0;

// --- Fonctions d'aide pour l'harmonisation des données ---
function formatDateIso(val) {
    if (!val) return '';
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    if (typeof val === 'string') return val.slice(0, 10);
    return '';
}

function getNormalizedTeamType(type) {
    if (!type) return 'Inconnu';
    const standardizationMap = {
        'mason': 'Maçon', 'macon': 'Maçon', 'macons': 'Maçon', 'maçon': 'Maçon',
        'network': 'Réseau', 'reseau': 'Réseau', 'réseau': 'Réseau',
        'interior': 'Intérieur', 'interieur': 'Intérieur', 'intérieur': 'Intérieur',
        'controller': 'Contrôleur', 'controle': 'Contrôleur', 'contrôleur': 'Contrôleur',
        'preparateur': 'Préparateur', 'préparateur': 'Préparateur', 'preparateurs': 'Préparateur',
        'livreur': 'Livreur', 'livreurs': 'Livreur', 'livraison': 'Livreur',
        'supervisor': 'Superviseur', 'superviseur': 'Superviseur'
    };
    const lower = type.toLowerCase();
    return standardizationMap[lower] || (type.charAt(0).toUpperCase() + type.slice(1).toLowerCase());
}

function getTeamRoleId(type) {
    const normalized = getNormalizedTeamType(type);
    const roleIdMap = {
        'Maçon': 'perMasonTeam',
        'Réseau': 'perNetworkTeam',
        'Intérieur': 'perInteriorTeam',
        'Contrôleur': 'perController',
        'Préparateur': 'perPreparateur',
        'Livreur': 'perLivreur'
    };
    return roleIdMap[normalized] || `per${normalized.replace(/\s+/g, '')}Team`;
}

function validateNumericalInput(input, min = 0, max = Infinity) {
    let value = parseFloat(input.value);
    if (isNaN(value) || value < min) {
        input.value = min;
        input.classList.add('border-red-500');
        setTimeout(() => input.classList.remove('border-red-500'), 2000);
        return min;
    }
    if (value > max) {
        input.value = max;
        return max;
    }
    return value;
}

function handleUiError(error, context = {}, title = 'Erreur') {
    if (window.handleError) {
        return window.handleError(error, context, title);
    }
    if (typeof Swal !== 'undefined') {
        Swal.fire(title, error?.message || 'Erreur inconnue', 'error');
    } else {
        console.error(error);
    }
}
const DEFAULT_TEAM_TEMPLATES = {
    "Maçon": { dailyCapacity: 2, costPerDay: 150000, vehicleType: "none", acquisitionMode: "purchase" },
    "Réseau": { dailyCapacity: 10, costPerDay: 200000, vehicleType: "pickup", acquisitionMode: "location" },
    "Intérieur": { dailyCapacity: 8, costPerDay: 180000, vehicleType: "pickup", acquisitionMode: "location" },
    "Superviseur": { dailyCapacity: 50, costPerDay: 40000, vehicleType: "pickup", acquisitionMode: "location" }
};

/**
 * Vérifie la cohérence entre le type de véhicule et le mode d'acquisition
 */
window.checkAcquisitionConsistency = function (vehicleType, acquisitionMode) {
    if (vehicleType === 'none') return { isValid: true };
    if (vehicleType === 'motorcycle' && acquisitionMode === 'location') {
        return { isValid: false, severity: 'warning', message: "La location de motos est souvent moins rentable." };
    }
    if (vehicleType === 'truck' && acquisitionMode === 'achat_direct') {
        return { isValid: false, severity: 'warning', message: "L'achat direct de camions demande un gros amortissement." };
    }
    if (acquisitionMode === 'sous_traitance' && vehicleType !== 'none') {
        return { isValid: false, severity: 'warning', message: "En sous-traitance, le prestataire fournit généralement ses véhicules." };
    }
    return { isValid: true };
};

window.checkVehicleSuitability = function (vehicle, teamType) {
    const heavyTeams = ['maçon', 'réseau', 'mason', 'network'];
    const isHeavy = teamType && heavyTeams.some(t => teamType.toLowerCase().includes(t));
    const isMotorcycle = vehicle === 'motorcycle';

    // UI Warnings
    const warningEl = document.getElementById('swal-vehicle-warning') || document.getElementById('swal-new-vehicle-warning');
    if (warningEl) {
        if (isHeavy && isMotorcycle) {
            warningEl.classList.remove('hidden');
        } else {
            warningEl.classList.add('hidden');
        }
    }

    // Logic validation
    if (vehicle === 'none') return true;
    if (teamType === 'Livreur' && vehicle !== 'truck') return false;
    if (teamType === 'Superviseur' && vehicle === 'truck') return false;
    return true;
};

/**
 * Génère un hash simple de l'état pour le cache
 */
function generateStateHash(project, teams) {
    const data = {
        duration: project.duration,
        totalHouses: project.totalHousesOverride,
        teams: teams.map(t => ({ id: t.id, type: t.type })),
        caps: project.teamCapabilities,
        staff: project.staffConfig
    };
    return JSON.stringify(data);
}

// Debounced renderer for teams tab to coalesce rapid UI updates
window.debouncedRenderTeams = function (delay = 150) {
    if (window._debTeamsTimer) clearTimeout(window._debTeamsTimer);
    window._debTeamsTimer = setTimeout(() => {
        try {
            if (typeof renderTeamsTab === 'function') renderTeamsTab();
        } catch (e) {
            console.warn('Error during debounced renderTeamsTab:', e);
        }
        window._debTeamsTimer = null;
    }, delay);
};

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // S'assurer que la DB est prête
        if (window.db) await db.open();

        // 1. Charger les templates métier (JSON externe)
        if (window.location.protocol === 'file:') {
            console.warn("Protocole local détecté : Utilisation des templates embarqués.");
            teamTemplates = { ...DEFAULT_TEAM_TEMPLATES };
        } else {
            try {
                const response = await fetch('src/config/team-templates.json');
                if (response.ok) {
                    teamTemplates = await response.json();
                    console.log("Templates chargés via fetch.");
                } else {
                    throw new Error("HTTP " + response.status);
                }
            } catch (fetchErr) {
                console.warn("Échec fetch, utilisation du fallback :", fetchErr.message);
                teamTemplates = { ...DEFAULT_TEAM_TEMPLATES };
            }
        }

        await loadProjectData();
        if (typeof setupEventListeners === 'function') setupEventListeners();
        if (typeof renderLogisticsTab === 'function') renderLogisticsTab();
        if (typeof renderTeamsTab === 'function') renderTeamsTab();
        if (typeof renderRequirementsTab === 'function') renderRequirementsTab();
        if (typeof renderGrappesTab === 'function') renderGrappesTab();

        // Mettre à jour l'heure de sync
        const syncEl = document.getElementById('lastSync');
        if (syncEl) syncEl.textContent = `Dernière synchronisation : ${new Date().toLocaleTimeString()}`;
    } catch (err) {
        handleUiError(err, { scope: 'init' }, 'Impossible de charger les paramètres');
    }
});

/**
 * Centralise toutes les sauvegardes de paramètres du projet.
 * Gère la persistance, le rechargement des données locales et le rafraîchissement UI.
 */
window.saveProjectState = async function (deltas, options = { refreshUI: true, silent: true, reload: true }) {
    try {
        await ProjectRepository.updateProjectParameters(deltas);

        if (options.reload) {
            await loadProjectData();
        }

        if (options.refreshUI) {
            if (typeof renderRequirementsTab === 'function') renderRequirementsTab();
            // Debounced teams render to avoid rapid reflows when multiple updates occur
            window.debouncedRenderTeams();
            if (typeof renderLogisticsTab === 'function') renderLogisticsTab();
        }

        if (!options.silent) {
            Swal.fire({
                icon: 'success',
                title: 'Enregistré',
                toast: true,
                position: 'top-end',
                timer: 2000,
                showConfirmButton: false
            });
        }

        return true;
    } catch (err) {
        handleUiError(err, { scope: 'saveProjectState', deltas }, 'Erreur de sauvegarde');
        return false;
    }
};

async function loadProjectData() {
    try {
        // Attendre que la DB soit prête si nécessaire (max 2s)
        let attempts = 0;
        while ((!window.db || !window.db.isOpen) && attempts < 20) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!window.db) {
            console.error("Database initialization failed or timed out.");
            throw new Error("Base de données non disponible. Rechargez la page.");
        }

        currentProject = await ProjectRepository.getCurrent();
        currentTeams = await TeamRepository.getAll();

        // 1. Synchronisation et Nettoyage des TeamCapabilities
        // IMPORTANT: Si le projet a déjà des capabilities définies, on les utilise EXCLUSIVEMENT comme source de vérité.
        // On n'utilise les DEFAULT_TEAM_TEMPLATES que si c'est la toute première initialisation.

        if (currentProject.teamCapabilities && Object.keys(currentProject.teamCapabilities).length > 0) {
            // Sauvegarder les templates chargés de base (JSON) comme source de richesse
            const baseRichness = { ...teamTemplates };
            teamTemplates = {};

            // On va reconstruire teamTemplates basé sur les clés présentes dans teamCapabilities.
            // Pour chaque clé dans capabilities, on essaie de retrouver la "richesse" (icones du default) si dispo.
            Object.entries(currentProject.teamCapabilities).forEach(([type, cap]) => {
                const standardType = getNormalizedTeamType(type);
                const defaultTmpl = baseRichness[standardType] || DEFAULT_TEAM_TEMPLATES[standardType] || {};

                teamTemplates[standardType] = {
                    ...defaultTmpl,
                    dailyCapacity: cap.daily || defaultTmpl.dailyCapacity || 1,
                    vehicleType: cap.vehicleType || defaultTmpl.vehicleType || 'none',
                    acquisitionMode: cap.acquisitionMode || defaultTmpl.acquisitionMode || 'rental',
                    equipmentCategories: cap.equipmentCategories || defaultTmpl.equipmentCategories || {}
                };
            });
        }

        if (currentProject.teamCapabilities) {
            let needsCleanup = false;
            const cleanedCapabilities = {};

            Object.entries(currentProject.teamCapabilities).forEach(([type, cap]) => {
                const standardType = getNormalizedTeamType(type);
                const key = standardType.toLowerCase();

                if (type !== standardType) needsCleanup = true;

                if (cleanedCapabilities[key]) {
                    needsCleanup = true; // Duplicate detected
                    if (!cleanedCapabilities[key].daily && cap.daily) {
                        cleanedCapabilities[key] = cap;
                    }
                } else {
                    cleanedCapabilities[key] = cap;
                }

                // Reconstruction du template UI actif
                // On récupère les métadonnées cosmétiques depuis les DEFAULT_TEMPLATES si elles existent pour ce type
                const defaultTmpl = DEFAULT_TEAM_TEMPLATES[standardType] || {};

                teamTemplates[standardType] = {
                    ...defaultTmpl, // Récupère description, icones par défaut
                    ...teamTemplates[standardType], // Garde existant si déjà set
                    dailyCapacity: cap.daily || defaultTmpl.dailyCapacity || 1,
                    vehicleType: cap.vehicleType || defaultTmpl.vehicleType || 'none',
                    acquisitionMode: cap.acquisitionMode || defaultTmpl.acquisitionMode || 'rental'
                };

                // Si le capability a ses propres équipements (cas normal après sauvegarde), ils écrasent le défaut
                if (cap.equipmentCategories) {
                    teamTemplates[standardType].equipmentCategories = cap.equipmentCategories;
                } else if (cap.equipment) {
                    // Migration legacy
                    // ... (sera géré par le bloc suivant)
                }

                // Migration et unification des équipements
                if (cap.equipment && Array.isArray(cap.equipment) && cap.equipment.length > 0) {
                    needsCleanup = true;
                    if (!teamTemplates[standardType].equipmentCategories) {
                        teamTemplates[standardType].equipmentCategories = { "Équipements": { icon: "🔧", items: cap.equipment } };
                    } else {
                        const allExistingItems = new Set();
                        Object.values(teamTemplates[standardType].equipmentCategories).forEach(cat => {
                            if (cat.items) cat.items.forEach(item => allExistingItems.add(item));
                        });
                        const newItems = cap.equipment.filter(item => !allExistingItems.has(item));
                        if (newItems.length > 0) {
                            const firstCatKey = Object.keys(teamTemplates[standardType].equipmentCategories)[0];
                            teamTemplates[standardType].equipmentCategories[firstCatKey].items.push(...newItems);
                        }
                    }
                    // Supprimer l'ancien champ
                    delete cap.equipment;
                }

                // Assurer que les catégories du template sont synchronisées avec la persistance si elle en a
                if (cap.equipmentCategories) {
                    teamTemplates[standardType].equipmentCategories = cap.equipmentCategories;
                }
            });

            if (needsCleanup) {
                cleanedCapabilities._overwrite = true;
                await ProjectRepository.updateProjectParameters({ teamCapabilities: cleanedCapabilities });
                currentProject.teamCapabilities = cleanedCapabilities;
            }
        }

        // 1.5 Auto-découverte des types d'équipes orphelins (équipes en base mais sans config)
        if (currentTeams && currentTeams.length > 0) {
            let discoveredCapabilities = {};
            let hasNewDiscoveries = false;

            currentTeams.forEach(team => {
                if (team.type) {
                    const standardType = getNormalizedTeamType(team.type);
                    if (!teamTemplates[standardType]) {
                        console.log(`Auto-discovery: Type d'équipe détecté en base : ${standardType}`);
                        // Enregistrer dans teamTemplates avec des valeurs par défaut sécurisées
                        const defaultTmpl = DEFAULT_TEAM_TEMPLATES[standardType] || {
                            dailyCapacity: 1,
                            vehicleType: 'none',
                            acquisitionMode: 'rental',
                            description: "Équipe détectée automatiquement depuis la base de données."
                        };
                        teamTemplates[standardType] = { ...defaultTmpl };

                        // Si le projet n'avait pas cette capability au chargement, on la prépare pour la prochaine sauvegarde
                        if (!currentProject.teamCapabilities) currentProject.teamCapabilities = {};

                        const key = standardType.toLowerCase();
                        if (!currentProject.teamCapabilities[key]) {
                            currentProject.teamCapabilities[key] = {
                                daily: defaultTmpl.dailyCapacity,
                                vehicleType: defaultTmpl.vehicleType,
                                acquisitionMode: defaultTmpl.acquisitionMode
                            };
                            discoveredCapabilities[key] = currentProject.teamCapabilities[key];
                            hasNewDiscoveries = true;
                        }
                    }
                }
            });

            // Persister immédiatement les découvertes pour qu'elles survivent à une mise à zéro du compteur
            if (hasNewDiscoveries) {
                try {
                    console.log("Saving auto-discovered teams to project configuration...");
                    // On fusionne avec l'existant pour ne rien perdre
                    const allCapabilities = { ...currentProject.teamCapabilities, ...discoveredCapabilities };
                    await ProjectRepository.updateProjectParameters({ teamCapabilities: allCapabilities });
                    // Update local cache
                    currentProject.teamCapabilities = allCapabilities;
                } catch (e) {
                    console.error("Failed to persist auto-discovered teams:", e);
                }
            }
        }

        // 2. Harmonisation des Tarifs (staffConfig)
        if (!currentProject.staffConfig) currentProject.staffConfig = {};
        const staffConfig = currentProject.staffConfig;
        const costs = currentProject.costs || {};
        let needsStaffSync = false;

        Object.keys(teamTemplates).forEach(type => {
            const roleId = getTeamRoleId(type);

            // Migration : Si absent de staffConfig mais présent dans costs, on migre
            if (!staffConfig[roleId] && costs[roleId]) {
                staffConfig[roleId] = {
                    amount: costs[roleId],
                    mode: 'daily',
                    label: type
                };
                needsStaffSync = true;
            } else if (!staffConfig[roleId]) {
                // Fallback total si rien n'existe
                staffConfig[roleId] = {
                    amount: teamTemplates[type]?.costPerDay || 5000,
                    mode: 'daily',
                    label: type
                };
                needsStaffSync = true;
            }

            // Unification : On met à jour costs (shadow) depuis staffConfig pour la rétro-compatibilité
            const config = staffConfig[roleId];
            const dailyEquivalent = config.mode === 'monthly'
                ? Math.round(config.amount / 22)
                : (config.mode === 'task' ? config.amount : config.amount);

            if (costs[roleId] !== dailyEquivalent) {
                costs[roleId] = dailyEquivalent;
                needsStaffSync = true;
            }

            // Sync template local pour l'UI
            teamTemplates[type].costPerDay = dailyEquivalent;
            teamTemplates[type].paymentMode = config.mode;
        });

        if (needsStaffSync) {
            await ProjectRepository.updateProjectParameters({ staffConfig, costs });
        }

        // 3. Calcul des besoins et rendu
        const stateHash = generateStateHash(currentProject, currentTeams);

        if (stateHash !== _lastCalculationHash) {
            console.log("Calcul des besoins globaux...");
            currentRequirements = await ResourceAllocationService.calculateGlobalRequirements(currentProject, currentTeams);
            _lastCalculationHash = stateHash;
        } else {
            console.log("Utilisation du cache pour les besoins globaux.");
        }

        // Ensure a stable persisted order for team types exists. If absent, initialize and persist it.
        if (!Array.isArray(currentProject.teamTypesOrder)) {
            try {
                currentProject.teamTypesOrder = Object.keys(teamTemplates).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
                await ProjectRepository.updateProjectParameters({ teamTypesOrder: currentProject.teamTypesOrder });
            } catch (e) {
                console.warn('Unable to persist teamTypesOrder on first load:', e);
            }
        }

        fillAllInputs();
        renderStaffCosts();

        // Audit rapide
        const missingTariffs = Object.keys(teamTemplates).filter(type => {
            const roleId = getTeamRoleId(type);
            return !currentProject.staffConfig[roleId] || !currentProject.staffConfig[roleId].amount;
        });

        if (missingTariffs.length > 0) {
            Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 })
                .fire({ icon: 'warning', title: `Tarifs manquants : ${missingTariffs.join(', ')}` });
        }

        document.getElementById('lastSync').textContent = `Mise à jour : ${new Date().toLocaleTimeString()}`;
    } catch (error) {
        handleUiError(error, { scope: 'loadProjectData' }, 'Erreur de chargement');
    }
}

function renderStaffCosts(searchTerm = "") {
    const container = document.getElementById('staffCostsContainer');
    if (!container) return;
    container.innerHTML = '';

    // 1. Définir les rôles de base (fixés)
    const roles = [
        { id: 'perController', label: 'Contrôleur Individuel', icon: 'fa-clipboard-check', default: 5000 },
        { id: 'perPreparateur', label: 'Préparateur', icon: 'fa-box-open', default: 5000 },
        { id: 'perLivreur', label: 'Livreur', icon: 'fa-truck', default: 5000 }
    ];

    // 2. Ajouter dynamiquement les rôles pour chaque type d'équipe existant
    // NOTE: Ces rôles sont maintenant gérés dans l'onglet "Config. des Équipes"
    // On ne les affiche ici que si searchTerm les cible explicitement ou si on veut garder une vue globale
    // Pour éliminer la redondance, on les filtre.

    const teamTypesKeys = Object.keys(teamTemplates).map(t => t.toLowerCase());
    const filteredRoles = roles.filter(role => {
        const isTeamRole = teamTypesKeys.some(tk => role.id.toLowerCase().includes(tk));
        if (isTeamRole) return false;

        if (searchTerm === "") return true;
        return role.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            role.id.toLowerCase().includes(searchTerm.toLowerCase());
    });

    if (filteredRoles.length === 0) {
        container.innerHTML = ''; // Clear existing content
        const noResultsDiv = document.createElement('div');
        noResultsDiv.className = 'col-span-full py-8 text-center text-gray-400 italic';
        noResultsDiv.textContent = `Aucun rôle ne correspond à "${searchTerm}"`;
        container.appendChild(noResultsDiv);
        return;
    }

    const staffConfig = currentProject.staffConfig || {};
    const legacyCosts = currentProject.costs || {};

    filteredRoles.forEach(role => {
        const config = staffConfig[role.id] || {
            amount: legacyCosts[role.id] || role.default,
            mode: 'daily'
        };

        const card = document.createElement('div');
        card.className = 'p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-gray-50 relative group';

        // Header section
        const headerDiv = document.createElement('div');
        headerDiv.className = 'flex items-center justify-between mb-3';

        const leftDiv = document.createElement('div');
        leftDiv.className = 'flex items-center';

        const iconDiv = document.createElement('div');
        iconDiv.className = 'w-8 h-8 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center mr-3';
        const icon = document.createElement('i');
        icon.className = `fas ${role.icon}`;
        iconDiv.appendChild(icon);
        leftDiv.appendChild(iconDiv);

        const title = document.createElement('h4');
        title.className = 'font-bold text-gray-800 text-sm';
        title.textContent = role.label;
        leftDiv.appendChild(title);

        const deleteBtn = document.createElement('button');
        deleteBtn.onclick = () => deleteStaffRole(role.id, role.label);
        deleteBtn.className = 'text-gray-400 hover:text-red-500 transition-colors p-1';
        deleteBtn.title = 'Supprimer ce rôle et ses configurations';
        const deleteIcon = document.createElement('i');
        deleteIcon.className = 'fas fa-trash-alt text-xs';
        deleteBtn.appendChild(deleteIcon);

        headerDiv.appendChild(leftDiv);
        headerDiv.appendChild(deleteBtn);

        // Form section
        const formDiv = document.createElement('div');
        formDiv.className = 'space-y-3';

        // Mode select
        const modeDiv = document.createElement('div');
        const modeLabel = document.createElement('label');
        modeLabel.className = 'block text-[10px] font-bold text-gray-400 uppercase mb-1';
        modeLabel.textContent = 'Mode de Paiement';
        modeDiv.appendChild(modeLabel);

        const modeSelect = document.createElement('select');
        modeSelect.className = 'staff-mode-select w-full p-2 text-sm border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500';
        modeSelect.setAttribute('data-role', role.id);
        modeSelect.onchange = function () { updateStaffLabel(this); };

        const dailyOption = document.createElement('option');
        dailyOption.value = 'daily';
        dailyOption.textContent = 'Journalier (par jour)';
        if (config.mode === 'daily') dailyOption.selected = true;
        modeSelect.appendChild(dailyOption);

        const taskOption = document.createElement('option');
        taskOption.value = 'task';
        taskOption.textContent = 'Par Tâche / Unité';
        if (config.mode === 'task') taskOption.selected = true;
        modeSelect.appendChild(taskOption);

        const monthlyOption = document.createElement('option');
        monthlyOption.value = 'monthly';
        monthlyOption.textContent = 'Mensuel (Salaire)';
        if (config.mode === 'monthly') monthlyOption.selected = true;
        modeSelect.appendChild(monthlyOption);

        modeDiv.appendChild(modeSelect);
        formDiv.appendChild(modeDiv);

        // Amount input
        const amountDiv = document.createElement('div');
        const amountLabel = document.createElement('label');
        amountLabel.className = 'block text-[10px] font-bold text-gray-400 uppercase mb-1 staff-amount-label';
        amountLabel.textContent = config.mode === 'monthly' ? 'Salaire Mensuel (FCFA)' : config.mode === 'task' ? 'Coût par Tâche (FCFA)' : 'Coût Journalier (FCFA)';
        amountDiv.appendChild(amountLabel);

        const amountInput = document.createElement('input');
        amountInput.type = 'number';
        amountInput.className = 'staff-amount-input w-full p-2 text-sm border-gray-300 rounded font-mono font-medium';
        amountInput.setAttribute('data-role', role.id);
        amountInput.value = config.amount;
        amountDiv.appendChild(amountInput);

        formDiv.appendChild(amountDiv);

        card.appendChild(headerDiv);
        card.appendChild(formDiv);
        container.appendChild(card);
    });
}

window.updateStaffLabel = function (select) {
    const label = select.closest('.space-y-3').querySelector('.staff-amount-label');
    switch (select.value) {
        case 'monthly': label.textContent = 'Salaire Mensuel (FCFA)'; break;
        case 'task': label.textContent = 'Coût par Tâche (FCFA)'; break;
        default: label.textContent = 'Coût Journalier (FCFA)';
    }
};

function fillAllInputs() {
    if (!currentProject) return;

    // Remplir les coûts d'équipements dynamiques d'abord
    renderAssetCosts();

    // Remplir les champs de coûts et logistique
    document.querySelectorAll('.cost-input:not(.asset-cost-input)').forEach(input => {
        let value = currentProject;

        try {
            // Si on a un data-field (ex: materialUnitCosts.potelet)
            if (input.dataset.field) {
                const fieldPath = input.dataset.field.split('.');
                fieldPath.forEach(key => {
                    if (value && value[key] !== undefined) {
                        value = value[key];
                    } else {
                        value = undefined;
                    }
                });
            }

            // Si on a un data-field-root (ex: duration)
            if (input.dataset.fieldRoot) {
                value = currentProject[input.dataset.fieldRoot];
            }

            // Appliquer la valeur
            if (value !== undefined) {
                if (input.type === 'date') {
                    input.value = value ? new Date(value).toISOString().split('T')[0] : '';
                } else {
                    input.value = value;
                }
            }
        } catch (e) {
            console.warn(`Erreur de remplissage pour : ${input.dataset.field || input.dataset.fieldRoot}`, e);
        }
    });
}


function setupEventListeners() {
    // Gestion des onglets
    document.querySelectorAll('[data-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('[data-tab]').forEach(t => {
                t.classList.remove('border-indigo-500', 'text-indigo-600');
                t.classList.add('text-gray-500', 'border-transparent');
            });
            document.querySelectorAll('#tab-content > div').forEach(c => c.classList.add('hidden'));

            tab.classList.remove('text-gray-500', 'border-transparent');
            tab.classList.add('border-indigo-500', 'text-indigo-600');
            document.getElementById(`content-${tab.dataset.tab}`).classList.remove('hidden');

            // Re-render certain tabs if necessary
            if (tab.dataset.tab === 'logistics') renderLogisticsTab();
            if (tab.dataset.tab === 'teams') renderTeamsTab();
            if (tab.dataset.tab === 'requirements') renderRequirementsTab();
        });
    });

    // Bouton ajout type équipe
    const addTeamBtn = document.getElementById('addNewTeamTypeBtn');
    if (addTeamBtn) addTeamBtn.addEventListener('click', addNewTeamType);

    // Sauvegarde des coûts
    const saveCostsBtn = document.getElementById('saveCostsBtn');
    if (saveCostsBtn) saveCostsBtn.addEventListener('click', saveCosts);

    // Export - Check if elements exist before adding listeners
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    if (exportExcelBtn) exportExcelBtn.addEventListener('click', exportToExcel);

    const exportPDFBtn = document.getElementById('exportPDFBtn');
    if (exportPDFBtn) exportPDFBtn.addEventListener('click', exportToPDF);

    // Écouter les mises à jour projet via EventBus
    if (window.eventBus) {
        window.eventBus.on('projectUpdated', (updated) => {
            currentProject = updated;
        });
    }

    // Automatic Updates for Global Parameters
    const durationInput = document.getElementById('projectDuration');
    const householdsInput = document.getElementById('projectTotalHouses');

    const handleGlobalParamChange = async (e) => {
        const field = e.target.dataset.fieldRoot;
        const val = parseInt(e.target.value) || 0;
        if (currentProject) {
            currentProject[field] = val;
            // Debounce slightly to avoid rapid re-rendering
            if (window._reqUpdateTimeout) clearTimeout(window._reqUpdateTimeout);
            window._reqUpdateTimeout = setTimeout(() => {
                renderRequirementsTab();
                updateTeamStats(); // Also update stats bar
            }, 300);
        }
    };

    if (durationInput) durationInput.addEventListener('input', handleGlobalParamChange);
    if (householdsInput) householdsInput.addEventListener('input', handleGlobalParamChange);
}

async function saveCosts() {
    const updates = { costs: {}, staffConfig: {} };

    // 1. Sauvegarder les inputs classiques (.cost-input) ayant un data-field
    document.querySelectorAll('.cost-input[data-field]').forEach(input => {
        const fieldPath = input.dataset.field.split('.');
        if (fieldPath[0] === 'costs' || fieldPath[0] === 'logistics' || fieldPath[0] === 'materialUnitCosts' || fieldPath[0] === 'assetCosts') return;

        // Build object hierarchy
        let target = updates;
        fieldPath.forEach((key, index) => {
            if (index === fieldPath.length - 1) {
                target[key] = parseFloat(input.value);
            } else {
                target[key] = target[key] || {};
                target = target[key];
            }
        });
    });

    // 1.1 Handle logistics manually to avoid overwrite
    updates.logistics = { ...currentProject.logistics };
    document.querySelectorAll('[data-field^="logistics."]').forEach(input => {
        const key = input.dataset.field.split('.')[1];
        updates.logistics[key] = parseFloat(input.value);
    });

    // 1.2 Handle materialUnitCosts manually
    updates.materialUnitCosts = { ...currentProject.materialUnitCosts };
    document.querySelectorAll('[data-field^="materialUnitCosts."]').forEach(input => {
        const key = input.dataset.field.split('.')[1];
        updates.materialUnitCosts[key] = parseFloat(input.value);
    });

    // 1.3 Handle assetCosts manually (dynamic)
    updates.assetCosts = { ...currentProject.assetCosts };
    document.querySelectorAll('.asset-cost-input').forEach(input => {
        const key = input.dataset.assetKey;
        if (key) updates.assetCosts[key] = parseFloat(input.value) || 0;
    });

    // 1.4 Handle global project fields (duration, etc.)
    document.querySelectorAll('[data-field-root]').forEach(input => {
        const key = input.dataset.fieldRoot;
        updates[key] = input.type === 'number' ? parseFloat(input.value) : input.value;
    });

    // 2. Sauvegarder la nouvelle config Staff
    const staffContainers = document.querySelectorAll('#staffCostsContainer > div');

    // Init costs object with current values to preserve other keys
    updates.costs = { ...currentProject.costs };

    staffContainers.forEach(card => {
        const modeSelect = card.querySelector('.staff-mode-select');
        const amountInput = card.querySelector('.staff-amount-input');
        const roleId = modeSelect.dataset.role;
        const mode = modeSelect.value;
        const amount = parseFloat(amountInput.value) || 0;

        // Save detailed config
        updates.staffConfig[roleId] = {
            amount,
            mode,
            label: card.querySelector('h4').innerText
        };

        // Backward compatibility: Calculate daily equivalent for 'costs' object
        let dailyEquivalent = amount;
        if (mode === 'monthly') {
            dailyEquivalent = Math.round(amount / 22);
        }
        updates.costs[roleId] = dailyEquivalent;
    });

    // Also update vehicle rentals which are in legacy form-group inputs if present
    document.querySelectorAll('[data-field^="costs.vehicleRental."]').forEach(input => {
        const key = input.dataset.field.split('.')[2];
        if (!updates.costs.vehicleRental) updates.costs.vehicleRental = {};
        updates.costs.vehicleRental[key] = parseFloat(input.value);
    });

    // 3. Sauvegarder via le point d'entrée unique
    const success = await saveProjectState(updates, { refreshUI: true, reload: true, silent: false });

    if (success) {
        renderLogisticsTab();
        document.getElementById('lastSync').textContent = `Mise à jour à : ${new Date().toLocaleTimeString()}`;
    }
}

// Function to update team statistics
async function updateTeamStats() {
    try {
        const statsBar = document.querySelector('.teams-stats-bar');
        if (statsBar) statsBar.classList.add('teams-loading');

        const totalTeamsCount = document.getElementById('totalTeamsCount');
        const totalEquipmentCount = document.getElementById('totalEquipmentCount');
        const totalBudget = document.getElementById('totalBudget');

        if (!totalTeamsCount || !totalEquipmentCount || !totalBudget) return;

        // Count total teams
        const totalTeams = currentTeams ? currentTeams.length : 0;
        totalTeamsCount.textContent = totalTeams;

        // Count total equipment (actual)
        let totalEquipment = 0;
        if (currentRequirements && currentRequirements.equipment) {
            Object.values(currentRequirements.equipment).forEach(item => {
                totalEquipment += (item.current || 0);
            });
        }
        totalEquipmentCount.textContent = totalEquipment;

        // Display TARGET budget with CAPEX/OPEX split
        const budgetTarget = currentRequirements.budget?.target || { total: 0, opex: { total: 0 }, capex: { total: 0 } };
        const totalFormatted = new Intl.NumberFormat('fr-FR').format(budgetTarget.total);
        const opexFormatted = new Intl.NumberFormat('fr-FR').format(budgetTarget.opex.total);
        const capexFormatted = new Intl.NumberFormat('fr-FR').format(budgetTarget.capex.total);

        totalBudget.innerHTML = `
            <div class="flex flex-col items-end">
                <span class="text-lg font-bold text-gray-900">${totalFormatted} F</span>
                <div class="flex gap-2 text-[10px] mt-1">
                    <span class="text-blue-600 bg-blue-50 px-1 rounded font-medium">OPEX: ${opexFormatted}</span>
                    <span class="text-green-600 bg-green-50 px-1 rounded font-medium">CAPEX: ${capexFormatted}</span>
                </div>
            </div>
        `;

        // Remove loading state
        setTimeout(() => {
            if (statsBar) statsBar.classList.remove('teams-loading');
        }, 300);

    } catch (error) {
        console.warn('Error updating team stats:', error);
        const statsBar = document.querySelector('.teams-stats-bar');
        if (statsBar) statsBar.classList.remove('teams-loading');
    }
}

async function renderTeamsTab() {
    const container = document.getElementById('teamTypesContainer');
    if (!container) return;

    // Update statistics
    await updateTeamStats();

    // Clear children safely
    while (container.firstChild) container.removeChild(container.firstChild);

    // Check if we have any teams to display
    const hasTeams = Object.keys(teamTemplates).length > 0;
    const emptyState = document.getElementById('teamsEmptyState');

    if (!hasTeams) {
        if (emptyState) emptyState.style.display = 'block';
        return;
    } else {
        if (emptyState) emptyState.style.display = 'none';
    }

    // Update filters
    const typeFilter = document.getElementById('teamTypeFilter');
    if (typeFilter && typeFilter.options.length <= 1) {
        // remove existing options
        while (typeFilter.firstChild) typeFilter.removeChild(typeFilter.firstChild);
        const defaultOption = document.createElement('option');
        defaultOption.value = 'all';
        defaultOption.textContent = 'Tous les types d\'équipes';
        typeFilter.appendChild(defaultOption);
        const availableTypes = new Set(currentTeams.map(t => t.type));

        // Always include types from templates that exist in currentTeams OR show all if filter logic requires
        // The user asked for "available teams". Assuming this means instantiated teams.
        // But if no instance exists, maybe they want to see the template to add one?
        // Actually, adding is done via "Ajouter Type équipe". This filter is for the list.
        // If a type has 0 instances, it won't be in the list anyway (since we iterate logic above usually filters or we iterate keys).

        // Let's filter the dropdown to only show types that actually have active teams
        const typesToShow = Object.keys(teamTemplates).filter(type => availableTypes.has(type));

        // If no active teams, maybe show all? No, user specific request.
        // If typesToShow is empty, maybe fallback to all or just show empty.

        const typesIterate = typesToShow.length > 0 ? typesToShow : [];

        typesIterate.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = `${type} (${currentTeams.filter(t => t.type === type).length})`;
            typeFilter.appendChild(option);
        });
        typeFilter.addEventListener('change', () => renderTeamsTab());
    }

    const selectedType = typeFilter ? typeFilter.value : 'all';

    // Determine stable iteration order: prefer persisted order in project, fallback to alphabetical
    const persistedOrder = Array.isArray(currentProject.teamTypesOrder) ? currentProject.teamTypesOrder.slice() : [];
    const templateKeys = Object.keys(teamTemplates);

    // Start with persisted order (filtered to existing templates), then append any missing templates sorted
    const orderedTypes = [];
    persistedOrder.forEach(t => { if (templateKeys.includes(t)) orderedTypes.push(t); });
    const missing = templateKeys.filter(t => !orderedTypes.includes(t)).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
    orderedTypes.push(...missing);

    for (const type of orderedTypes) {
        const template = teamTemplates[type];
        if (!template) continue;
        if (selectedType === 'all' || selectedType === type) {
            // Calculate team statistics for this type from currentRequirements
            const normalizedTemplateType = getNormalizedTeamType(type);
            const teamsOfType = currentTeams.filter(t => getNormalizedTeamType(t.type) === normalizedTemplateType);
            const currentCount = teamsOfType.length;

            // Récupérer la durée du projet pour l'affichage par défaut
            const projectDuration = currentProject.duration || 180;

            // Récupérer les besoins pré-calculés dans loadProjectData
            // currentRequirements.teams est un objet mappé par type normalisé
            const normalizedType = getNormalizedTeamType(type);

            // Check in both teams (technical) and support (supervisors, etc.)
            let reqData = (currentRequirements.teams || {})[normalizedType];
            if (!reqData) {
                // Try case-insensitive lookup in support
                const supportReqs = currentRequirements.support || {};
                const supportKey = Object.keys(supportReqs).find(k => getNormalizedTeamType(k) === normalizedType);
                if (supportKey) {
                    reqData = supportReqs[supportKey];
                }
            }

            const requiredTeams = reqData ? reqData.required : 0;
            const progress = requiredTeams > 0 ? Math.min(100, Math.round((currentCount / requiredTeams) * 100)) : 0;
            const caps = currentProject.teamCapabilities || {};
            const capKey = Object.keys(caps).find(k => getNormalizedTeamType(k).toLowerCase() === normalizedType.toLowerCase());
            const capObj = capKey ? caps[capKey] : {};
            const totalHouses = currentProject.totalHouses || currentProject.total || _lastDbHouseholdCount || 0;
            const dailyCap = template.dailyCapacity || capObj.daily || capObj.dailyCapacity || 1;
            // Durée basée sur les équipes réellement disponibles; si aucune, au moins 1
            const teamCountForCalc = Math.max(1, currentCount || capObj.required || 1);
            const computedDuration = totalHouses ? Math.ceil(totalHouses / Math.max(1e-6, dailyCap * teamCountForCalc)) : (template.interventionDays || projectDuration);

            const card = document.createElement('div');
            card.className = 'team-config-card teams-card-enter';

            // Enhanced Header with gradient background
            const header = document.createElement('div');
            header.className = 'relative';
            header.style.cssText = 'background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 1.5rem; border-bottom: 2px solid #e2e8f0;';

            const headerInner = document.createElement('div');
            headerInner.className = 'flex justify-between items-start';

            const left = document.createElement('div');
            left.className = 'flex items-center gap-4';

            // Enhanced avatar with better styling
            const avatar = document.createElement('div');
            avatar.className = 'relative';
            avatar.style.cssText = 'width: 3.5rem; height: 3.5rem; border-radius: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);';

            const icon = document.createElement('i');
            icon.className = `fas ${type === 'Maçon' ? 'fa-hammer' : type === 'Électricien' ? 'fa-bolt' : type === 'Technicien Réseau' ? 'fa-network-wired' : type === 'Superviseur' ? 'fa-clipboard-check' : type === 'Chef de Projet' ? 'fa-project-diagram' : type === 'Préparateur' ? 'fa-boxes' : type === 'Livreur' ? 'fa-truck' : 'fa-users'} text-xl`;
            avatar.appendChild(icon);

            // Status indicator
            const statusIndicator = document.createElement('div');
            statusIndicator.className = 'absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white';
            statusIndicator.style.cssText = `background: ${currentCount > 0 ? '#10b981' : '#f59e0b'};`;
            statusIndicator.title = currentCount > 0 ? 'Équipe active' : 'Équipe inactive';
            avatar.appendChild(statusIndicator);

            const meta = document.createElement('div');
            const title = document.createElement('h4');
            title.className = 'text-xl font-bold text-gray-900 mb-1';
            title.textContent = type;

            const desc = document.createElement('p');
            desc.className = 'text-sm text-gray-600 mb-2';
            desc.textContent = template.description || "Paramètres de l'équipe technique";

            // Stats badges
            const statsDiv = document.createElement('div');
            statsDiv.className = 'flex gap-2';

            const capacityBadge = document.createElement('span');
            capacityBadge.className = 'px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold border border-blue-200';
            const capIcon = document.createElement('i');
            capIcon.className = 'fas fa-tachometer-alt mr-1';
            capacityBadge.appendChild(capIcon);
            capacityBadge.appendChild(document.createTextNode(`${template.dailyCapacity}/jour`));

            const countBadge = document.createElement('span');
            countBadge.className = 'px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold flex items-center gap-2';

            // On affiche Réel / Requis
            countBadge.innerHTML = `
                <span>${currentCount} Mobilisée${currentCount > 1 ? 's' : ''}</span>
                <span class="text-indigo-300">|</span>
                <span class="text-indigo-500 font-normal">Besoin: ${requiredTeams}</span>
            `;

            statsDiv.appendChild(capacityBadge);
            statsDiv.appendChild(countBadge);

            meta.appendChild(title);
            meta.appendChild(desc);
            meta.appendChild(statsDiv);

            left.appendChild(avatar);
            left.appendChild(meta);

            const right = document.createElement('div');
            right.className = 'flex gap-2';

            // Progress indicator
            if (requiredTeams > 0) {
                const progressContainer = document.createElement('div');
                progressContainer.className = 'text-right mr-4';

                const progressLabel = document.createElement('div');
                progressLabel.className = 'text-xs text-gray-500 mb-1';
                progressLabel.textContent = 'Progression';

                const progressBar = document.createElement('div');
                progressBar.className = 'w-20 h-2 bg-gray-200 rounded-full overflow-hidden';

                const progressFill = document.createElement('div');
                progressFill.className = `h-full transition-all duration-500 ${progress >= 80 ? 'bg-green-500' : progress >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`;
                progressFill.style.cssText = `width: ${progress}%;`;

                progressBar.appendChild(progressFill);

                const progressText = document.createElement('div');
                progressText.className = 'text-xs font-semibold text-gray-700 mt-1';
                progressText.textContent = `${progress}%`;

                progressContainer.appendChild(progressLabel);
                progressContainer.appendChild(progressBar);
                progressContainer.appendChild(progressText);

                right.appendChild(progressContainer);
            }

            // Team count control
            const countControl = document.createElement('div');
            countControl.className = 'flex items-center gap-2 mr-2';

            const countLabel = document.createElement('span');
            countLabel.className = 'text-xs text-gray-500';
            countLabel.textContent = 'Équipes:';
            countControl.appendChild(countLabel);

            const countInput = document.createElement('input');
            countInput.type = 'number';
            countInput.className = 'w-16 px-2 py-1 text-xs border border-gray-300 rounded text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';
            countInput.value = currentCount;
            countInput.min = '0';
            countInput.max = '50';
            countInput.addEventListener('change', async (e) => {
                const targetCount = parseInt(e.target.value) || 0;
                await adjustTeamCount(type, targetCount);
            });
            countControl.appendChild(countInput);

            const countBtnGroup = document.createElement('div');
            countBtnGroup.className = 'flex gap-1';

            const decreaseBtn = document.createElement('button');
            decreaseBtn.className = 'w-6 h-6 flex items-center justify-center text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors';
            decreaseBtn.innerHTML = '<i class="fas fa-minus"></i>';
            decreaseBtn.title = 'Réduire le nombre d\'équipes';
            decreaseBtn.addEventListener('click', () => {
                const current = parseInt(countInput.value) || 0;
                if (current > 0) {
                    countInput.value = current - 1;
                    countInput.dispatchEvent(new Event('change'));
                }
            });
            countBtnGroup.appendChild(decreaseBtn);

            const increaseBtn = document.createElement('button');
            increaseBtn.className = 'w-6 h-6 flex items-center justify-center text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors';
            increaseBtn.innerHTML = '<i class="fas fa-plus"></i>';
            increaseBtn.title = 'Augmenter le nombre d\'équipes';
            increaseBtn.addEventListener('click', () => {
                const current = parseInt(countInput.value) || 0;
                countInput.value = current + 1;
                countInput.dispatchEvent(new Event('change'));
            });
            countBtnGroup.appendChild(increaseBtn);

            countControl.appendChild(countBtnGroup);
            right.appendChild(countControl);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200';
            deleteBtn.title = `Supprimer le type ${type}`;
            deleteBtn.addEventListener('click', () => deleteTeamType(type));
            const delIcon = document.createElement('i');
            delIcon.className = 'fas fa-trash-alt';
            deleteBtn.appendChild(delIcon);
            right.appendChild(deleteBtn);

            // Besoin estimé + capacité/jour
            const needWrapper = document.createElement('div');
            needWrapper.className = 'text-right mr-4';
            const durationDays = computedDuration;
            const durationMonths = durationDays ? (durationDays / 30).toFixed(1) : '-';
            const startDateValue = template.startDate || capObj.startDate || currentProject.startDate || currentProject.start || '';
            const startDate = formatDateIso(startDateValue) || '-';
            let endDate = '-';
            if (startDate !== '-' && durationDays) {
                try {
                    const startTimestamp = new Date(startDate).getTime();
                    if (!isNaN(startTimestamp)) {
                        endDate = new Date(startTimestamp + durationDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                    }
                } catch (e) {
                    console.warn('Erreur calcul date de fin:', e);
                }
            }
            needWrapper.innerHTML = `
                <div class="text-xs uppercase tracking-wide text-gray-500">Besoin estimé</div>
                <div class="text-2xl font-black text-indigo-600">${requiredTeams || 0}</div>
                <div class="text-[11px] text-gray-500">Capacité/jour : ${template.dailyCapacity || template.daily || '-'}</div>
                <div class="text-[11px] text-gray-500 mt-1">Durée: ${durationDays || '-'} j (~${durationMonths} mois)</div>
                <div class="text-[11px] text-gray-500">Démarrage: ${startDate}</div>
                <div class="text-[11px] text-gray-500">Fin estimée: ${endDate}</div>
            `;
            right.insertBefore(needWrapper, deleteBtn);

            headerInner.appendChild(left);
            headerInner.appendChild(right);
            header.appendChild(headerInner);

            // Enhanced Body with better organization
            const body = document.createElement('div');
            body.className = 'p-6 team-body';

            // Collapse / expand per team card
            let isCollapsed = false;
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors';
            toggleBtn.title = 'Replier / dérouler';
            const toggleIcon = document.createElement('i');
            toggleIcon.className = 'fas fa-chevron-up';
            toggleBtn.appendChild(toggleIcon);
            right.insertBefore(toggleBtn, right.firstChild);
            const applyCollapse = () => {
                body.classList.toggle('collapsed', isCollapsed);
                card.classList.toggle('team-collapsed', isCollapsed);
                toggleIcon.className = isCollapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
            };
            toggleBtn.addEventListener('click', () => {
                isCollapsed = !isCollapsed;
                applyCollapse();
            });
            applyCollapse();

            // Technical Parameters Section
            const techSection = document.createElement('div');
            techSection.className = 'mb-6';

            const techHeader = document.createElement('div');
            techHeader.className = 'flex items-center gap-3 mb-4';

            const techIcon = document.createElement('div');
            techIcon.className = 'w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center';
            techIcon.innerHTML = '<i class="fas fa-cog text-blue-600"></i>';

            const techTitle = document.createElement('h5');
            techTitle.className = 'text-sm font-bold text-gray-900 uppercase tracking-wide';
            techTitle.textContent = 'Paramètres Techniques';

            techHeader.appendChild(techIcon);
            techHeader.appendChild(techTitle);
            techSection.appendChild(techHeader);

            const techGrid = document.createElement('div');
            techGrid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';

            // Production capacity
            const prodCard = document.createElement('div');
            prodCard.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200';

            const prodLabel = document.createElement('label');
            prodLabel.className = 'block text-xs font-semibold text-gray-500 uppercase mb-2';
            prodLabel.textContent = 'Production / Jour';

            const prodInput = document.createElement('input');
            prodInput.type = 'number';
            prodInput.className = 'w-full p-3 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all';
            prodInput.value = template.dailyCapacity;
            prodInput.addEventListener('change', async function () {
                const validVal = validateNumericalInput(this, 1);
                await updateTeamParam(type, 'daily', validVal);
                await autoCalculateTeams();
                renderRequirementsTab();
            });

            prodCard.appendChild(prodLabel);
            prodCard.appendChild(prodInput);
            techGrid.appendChild(prodCard);

            // Intervention Duration
            const durationCard = document.createElement('div');
            durationCard.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200';
            const durationLabel = document.createElement('label');
            durationLabel.className = 'block text-xs font-semibold text-gray-500 uppercase mb-2';
            durationLabel.textContent = "Durée d'Intervention (jours)";
            const durationInput = document.createElement('input');
            durationInput.type = 'number';
            durationInput.className = 'w-full p-3 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-500';
            durationInput.value = computedDuration;
            durationInput.readOnly = true;
            const durationHint = document.createElement('div');
            durationHint.className = 'text-[11px] text-gray-500 mt-1';
            durationHint.textContent = `≈ ${(durationInput.value / 30).toFixed(1)} mois`;

            durationCard.appendChild(durationLabel);
            durationCard.appendChild(durationInput);
            durationCard.appendChild(durationHint);
            techGrid.appendChild(durationCard);

            // Start date editable
            const startCard = document.createElement('div');
            startCard.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200';
            startCard.innerHTML = `
                <label class="block text-xs font-semibold text-gray-500 uppercase mb-2">Date de démarrage (équipe)</label>
                <input type="date" class="w-full p-3 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                       value="${formatDateIso(template.startDate || currentProject.startDate || currentProject.start || '')}">
                <div class="text-[11px] text-gray-500 mt-1" id="endDate-${type}"></div>
            `;
            const startInput = startCard.querySelector('input');
            const endDateLabel = startCard.querySelector(`#endDate-${CSS.escape(type)}`);
            const recomputeEnd = () => {
                const d = startInput.value;
                const days = computedDuration;
                if (d && days) {
                    const end = new Date(new Date(d).getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                    endDateLabel.textContent = `Fin estimée : ${end}`;
                } else {
                    endDateLabel.textContent = '';
                }
            };
            recomputeEnd();
            startInput.addEventListener('change', async (e) => {
                await updateTeamParam(type, 'startDate', e.target.value);
                await autoCalculateTeams();
                recomputeEnd();
            });
            techGrid.appendChild(startCard);

            techSection.appendChild(techGrid);
            body.appendChild(techSection);

            // Logistics Section
            const logSection = document.createElement('div');
            logSection.className = 'mb-6';

            const logHeader = document.createElement('div');
            logHeader.className = 'flex items-center gap-3 mb-4';

            const logIconContainer = document.createElement('div');
            logIconContainer.className = 'w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center';
            const logIcon = document.createElement('i');
            logIcon.className = 'fas fa-truck text-indigo-600';
            logIconContainer.appendChild(logIcon);

            const logTitle = document.createElement('h5');
            logTitle.className = 'text-sm font-bold text-gray-900 uppercase tracking-wide';
            logTitle.textContent = 'Logistique & Acquisition';

            logHeader.appendChild(logIconContainer);
            logHeader.appendChild(logTitle);
            logSection.appendChild(logHeader);

            const logGrid = document.createElement('div');
            logGrid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';

            // Vehicle type
            const vCard = document.createElement('div');
            vCard.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200';
            vCard.innerHTML = `
                <label class="block text-xs font-semibold text-gray-500 uppercase mb-2">Véhicule</label>
                <div class="flex items-center gap-2">
                    <select class="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                            onchange="updateTeamParam('${type}', 'vehicleType', this.value)">
                        <option value="none" ${template.vehicleType === 'none' ? 'selected' : ''}>Aucun</option>
                        <option value="pickup" ${template.vehicleType === 'pickup' ? 'selected' : ''}>Pickup 4x4</option>
                        <option value="truck" ${template.vehicleType === 'truck' ? 'selected' : ''}>Camion</option>
                        <option value="motorcycle" ${template.vehicleType === 'motorcycle' ? 'selected' : ''}>Moto</option>
                    </select>
                </div>
            `;
            logGrid.appendChild(vCard);

            // Acquisition mode with consistency check
            const aCard = document.createElement('div');
            const consistency = checkAcquisitionConsistency(template.vehicleType, template.acquisitionMode);

            aCard.className = `rounded-lg p-4 border transition-all duration-300 ${consistency.isValid ? 'bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-200 shadow-sm'}`;

            const aLabel = document.createElement('label');
            aLabel.className = 'block text-xs font-semibold text-gray-500 uppercase mb-2 flex justify-between items-center';

            const aLabelText = document.createElement('span');
            aLabelText.textContent = "Mode d'acquisition";
            aLabel.appendChild(aLabelText);

            if (!consistency.isValid) {
                const warningIcon = document.createElement('i');
                warningIcon.className = 'fas fa-exclamation-triangle text-amber-500 animate-pulse';
                warningIcon.title = consistency.message;
                aLabel.appendChild(warningIcon);
            }

            const aSelect = document.createElement('select');
            aSelect.className = 'w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 transition-all';

            const options = [
                { value: 'location', label: 'Location (OPEX)' },
                { value: 'achat_direct', label: 'Achat direct (CAPEX)' },
                { value: 'inventory', label: 'Inventaire / Stock (Coût 0)' },
                { value: 'sous_traitance', label: 'Sous-traitance' }
            ];

            options.forEach(optData => {
                const opt = document.createElement('option');
                opt.value = optData.value;
                opt.textContent = optData.label;
                if (template.acquisitionMode === optData.value) opt.selected = true;
                aSelect.appendChild(opt);
            });
            aSelect.addEventListener('change', (e) => updateTeamParam(type, 'acquisitionMode', e.target.value));
            const disableAcquisition = () => {
                const disabled = template.vehicleType === 'none';
                aSelect.disabled = disabled;
                aSelect.classList.toggle('bg-gray-100', disabled);
                aSelect.classList.toggle('text-gray-500', disabled);
            };
            disableAcquisition();

            // Keep acquisition mode disabled when no vehicle is selected
            const vehicleSelect = vCard.querySelector('select');
            if (vehicleSelect) {
                vehicleSelect.addEventListener('change', (e) => {
                    template.vehicleType = e.target.value;
                    disableAcquisition();
                });
            }

            aCard.appendChild(aLabel);
            aCard.appendChild(aSelect);

            if (!consistency.isValid) {
                const hint = document.createElement('p');
                hint.className = 'text-[10px] text-amber-600 mt-2 leading-tight';
                hint.textContent = consistency.message;
                aCard.appendChild(hint);
            }

            logGrid.appendChild(aCard);
            logSection.appendChild(logGrid);
            body.appendChild(logSection);

            // Financial & Logistics Parameters Section
            const financeSection = document.createElement('div');
            financeSection.className = 'mb-6';

            const financeHeader = document.createElement('div');
            financeHeader.className = 'flex items-center gap-3 mb-4';

            const financeIcon = document.createElement('div');
            financeIcon.className = 'w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center';
            financeIcon.innerHTML = '<i class="fas fa-dollar-sign text-green-600"></i>';

            const financeTitle = document.createElement('h5');
            financeTitle.className = 'text-sm font-bold text-gray-900 uppercase tracking-wide';
            financeTitle.textContent = 'Paramètres Financiers';

            financeHeader.appendChild(financeIcon);
            financeHeader.appendChild(financeTitle);
            financeSection.appendChild(financeHeader);

            const financeGrid = document.createElement('div');
            financeGrid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4'; // Changed from 3 to 2 as acquisition mode moved

            // Get current configuration for this team type
            const roleId = getTeamRoleId(type);
            const currentConfig = (currentProject.staffConfig || {})[roleId] || { amount: template.costPerDay || 5000, mode: 'daily' };

            // Tarif de prestation
            const rateGroup = document.createElement('div');
            rateGroup.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200';

            const rateLabel = document.createElement('label');
            rateLabel.className = 'block text-xs font-bold text-gray-600 uppercase mb-2';
            rateLabel.textContent = 'Tarif de Prestation (FCFA)';

            const rateInput = document.createElement('input');
            rateInput.type = 'number';
            rateInput.className = 'w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500';
            rateInput.value = currentConfig.amount || template.costPerDay || 0;
            rateInput.setAttribute('data-team-type', type);
            rateInput.setAttribute('data-field', 'amount');
            rateInput.addEventListener('change', (e) => {
                const validVal = validateNumericalInput(e.target, 0);
                updateTeamFinancial(type, 'amount', validVal);
            });

            rateGroup.appendChild(rateLabel);

            const rateInputContainer = document.createElement('div');
            rateInputContainer.className = 'flex gap-2 items-center';

            rateInputContainer.appendChild(rateInput);

            // Petit texte pour préciser le mode
            const modeLabel = document.createElement('span');
            modeLabel.className = 'text-xs text-gray-500 font-medium whitespace-nowrap min-w-[60px]';
            const modeMap = { 'daily': '/ jour', 'task': '/ tâche', 'monthly': '/ mois' };
            modeLabel.textContent = modeMap[currentConfig.mode] || '/ jour';
            rateInputContainer.appendChild(modeLabel);

            const editRateBtn = document.createElement('button');
            editRateBtn.className = 'px-3 py-1 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-100 transition-colors text-xs whitespace-nowrap';
            editRateBtn.innerHTML = '<i class="fas fa-edit"></i>';
            editRateBtn.title = "Modifier le mode de tarification";
            editRateBtn.onclick = (e) => {
                e.preventDefault();
                editPaymentMode(type);
            };

            rateInputContainer.appendChild(editRateBtn);
            rateGroup.appendChild(rateInputContainer);

            // Logistique
            const logisticsGroup = document.createElement('div');
            logisticsGroup.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200';

            const logisticsLabel = document.createElement('label');
            logisticsLabel.className = 'block text-xs font-bold text-gray-600 uppercase mb-2';
            logisticsLabel.textContent = 'Détails Logistiques';

            const logisticsInput = document.createElement('textarea');
            logisticsInput.className = 'w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none';
            logisticsInput.rows = '3';
            logisticsInput.placeholder = 'Détails sur la logistique, transport, hébergement...';
            logisticsInput.value = currentConfig.logistics || '';
            logisticsInput.setAttribute('data-team-type', type);
            logisticsInput.setAttribute('data-field', 'logistics');
            logisticsInput.addEventListener('change', (e) => updateTeamFinancial(type, 'logistics', e.target.value));

            logisticsGroup.appendChild(logisticsLabel);
            logisticsGroup.appendChild(logisticsInput);

            financeGrid.appendChild(rateGroup);
            financeGrid.appendChild(logisticsGroup); // Only two items now
            financeSection.appendChild(financeGrid);

            body.appendChild(financeSection);

            // --- NOUVEAU : Section Gestion des Sous-Équipes (Instances) ---
            const instancesSection = document.createElement('div');
            instancesSection.className = 'mt-6 pt-6 border-t border-gray-100';
            instancesSection.innerHTML = `
                <div class="flex items-center justify-between mb-4">
                    <h5 class="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <i class="fas fa-users-cog"></i> Équipes Individuelles (${currentCount})
                    </h5>
                </div>
                <div class="space-y-3" id="instancesContainer-${type}">
                </div>
            `;

            const instContainer = instancesSection.querySelector(`#instancesContainer-${CSS.escape(type)}`);
            const allGrappes = currentProject.grappes || [];

            teamsOfType.forEach(team => {
                const instRow = document.createElement('div');
                instRow.className = 'bg-white border border-gray-200 rounded-lg p-3 hover:border-indigo-200 transition-colors shadow-sm';
                instRow.innerHTML = `
                    <div class="flex flex-wrap items-center justify-between gap-4">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded bg-gray-50 flex items-center justify-center text-gray-500 font-bold text-xs">
                                ${team.name.match(/\d+/) || String(team.id).slice(-2)}
                            </div>
                            <span class="text-sm font-semibold text-gray-700">${team.name}</span>
                        </div>
                        
                        <div class="flex flex-wrap items-center gap-4">
                            <!-- Date de démarrage spécifique -->
                            <div class="flex items-center gap-2">
                                <label class="text-[10px] font-bold text-orange-500 uppercase">Démarrage</label>
                                <input type="date" value="${(team.startDate || startDate).slice(0, 10)}" 
                                       class="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500"
                                       onchange="updateInstanceParam('${team.id}', 'startDate', this.value)">
                            </div>
                            
                            <!-- Affectation Grappes -->
                            <div class="flex items-center gap-2">
                                <label class="text-[10px] font-bold text-blue-500 uppercase">Grappes</label>
                                <div class="relative group">
                                    <button class="bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 flex items-center gap-1 hover:bg-white">
                                        ${team.assignedGrappes?.length || 0} grappes <i class="fas fa-chevron-down text-[10px]"></i>
                                    </button>
                                    <div class="hidden group-focus-within:block absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-2">
                                        <div class="text-[10px] font-bold text-gray-400 uppercase mb-2 px-1">Choisir les grappes</div>
                                        <div class="max-h-40 overflow-y-auto space-y-1">
                                            ${allGrappes.map(g => `
                                                <label class="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer text-xs">
                                                    <input type="checkbox" ${team.assignedGrappes?.includes(g) ? 'checked' : ''} 
                                                           onchange="toggleInstanceGrappe('${team.id}', '${g}', this.checked)">
                                                    <span>${g}</span>
                                                </label>
                                            `).join('') || '<div class="p-1 text-gray-400 italic">Aucune grappe créée</div>'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button onclick="deleteTeamInstance('${team.id}')" class="text-gray-300 hover:text-red-500 transition-colors p-1" title="Supprimer cette équipe">
                                <i class="fas fa-trash-alt text-xs"></i>
                            </button>
                        </div>
                    </div>
                `;
                instContainer.appendChild(instRow);
            });
            body.appendChild(instancesSection);

            // Equipment Section
            const equipSection = document.createElement('div');

            const equipHeader = document.createElement('div');
            equipHeader.className = 'flex items-center gap-3 mb-4';

            const equipIcon = document.createElement('div');
            equipIcon.className = 'w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center';
            equipIcon.innerHTML = '<i class="fas fa-tools text-orange-600"></i>';

            const equipTitle = document.createElement('h5');
            equipTitle.className = 'text-sm font-bold text-gray-900 uppercase tracking-wide';
            equipTitle.textContent = 'Équipements par Catégorie';

            equipHeader.appendChild(equipIcon);
            equipHeader.appendChild(equipTitle);
            equipSection.appendChild(equipHeader);

            if (template.equipmentCategories && Object.keys(template.equipmentCategories).length > 0) {
                Object.entries(template.equipmentCategories).forEach(([category, data]) => {
                    const categoryCard = document.createElement('div');
                    categoryCard.className = 'mb-4 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm';

                    const categoryHeader = document.createElement('div');
                    categoryHeader.className = 'bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 flex items-center justify-between cursor-pointer hover:from-gray-100 hover:to-gray-200 transition-all duration-200';
                    categoryHeader.addEventListener('click', function () { toggleCategory(this); });

                    const leftHeader = document.createElement('div');
                    leftHeader.className = 'flex items-center gap-3';

                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'text-lg';
                    iconSpan.textContent = data.icon || '🔧';

                    const catLabel = document.createElement('span');
                    catLabel.className = 'font-semibold text-gray-800';
                    catLabel.textContent = category;

                    const countBadge = document.createElement('span');
                    countBadge.className = `px-2 py-1 rounded-full text-xs font-medium ${data.consumable ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`;
                    countBadge.textContent = `${(data.items && data.items.length) || 0} items`;

                    leftHeader.appendChild(iconSpan);
                    leftHeader.appendChild(catLabel);
                    leftHeader.appendChild(countBadge);

                    const chevron = document.createElement('i');
                    chevron.className = 'fas fa-chevron-down category-toggle-icon text-gray-400 transition-transform duration-200';

                    categoryHeader.appendChild(leftHeader);
                    categoryHeader.appendChild(chevron);

                    const categoryContent = document.createElement('div');
                    categoryContent.className = 'category-content bg-gray-50 equipment-list-container border-t border-gray-200';
                    categoryContent.style.display = 'none';

                    if (data.items && data.items.length > 0) {
                        const itemsGrid = document.createElement('div');
                        itemsGrid.className = 'p-4 grid grid-cols-1 sm:grid-cols-2 gap-2';

                        data.items.forEach(item => {
                            const itemCard = document.createElement('div');
                            itemCard.className = 'bg-white rounded-lg p-3 border border-gray-200 flex items-center justify-between group hover:shadow-md transition-all duration-200';

                            const itemLabel = document.createElement('span');
                            itemLabel.className = 'text-sm text-gray-700 font-medium';
                            itemLabel.textContent = item;

                            const removeBtn = document.createElement('button');
                            removeBtn.className = 'p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all duration-200 opacity-0 group-hover:opacity-100';
                            removeBtn.title = `Supprimer ${item}`;
                            removeBtn.addEventListener('click', () => removeEquipmentFromCategory(type, category, item));

                            const btnIcon = document.createElement('i');
                            btnIcon.className = 'fas fa-times text-xs';
                            removeBtn.appendChild(btnIcon);

                            itemCard.appendChild(itemLabel);
                            itemCard.appendChild(removeBtn);
                            itemsGrid.appendChild(itemCard);
                        });

                        categoryContent.appendChild(itemsGrid);
                    } else {
                        const emptyDiv = document.createElement('div');
                        emptyDiv.className = 'p-6 text-center text-gray-500';
                        emptyDiv.innerHTML = '<i class="fas fa-inbox text-2xl mb-2 block text-gray-300"></i><span class="text-sm">Aucun équipement dans cette catégorie</span>';
                        categoryContent.appendChild(emptyDiv);
                    }

                    const footer = document.createElement('div');
                    footer.className = 'p-3 bg-gray-100 border-t border-gray-200';
                    const addBtn = document.createElement('button');
                    addBtn.className = 'w-full py-2 text-sm text-indigo-600 font-semibold border-2 border-indigo-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-200 flex items-center justify-center gap-2';
                    addBtn.innerHTML = '<i class="fas fa-plus"></i> Ajouter un équipement';
                    addBtn.addEventListener('click', () => openAddEquipmentModal(type, category));
                    footer.appendChild(addBtn);

                    categoryCard.appendChild(categoryHeader);
                    categoryCard.appendChild(categoryContent);
                    categoryCard.appendChild(footer);
                    equipSection.appendChild(categoryCard);
                });
            } else {
                // Fallback for old equipment structure
                const oldEquipment = template.equipment || [];
                if (oldEquipment.length > 0) {
                    const fallbackCard = document.createElement('div');
                    fallbackCard.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200';

                    const fallbackTitle = document.createElement('h6');
                    fallbackTitle.className = 'text-sm font-semibold text-gray-700 mb-3';
                    fallbackTitle.textContent = 'Équipements (structure héritée)';

                    const itemsGrid = document.createElement('div');
                    itemsGrid.className = 'flex flex-wrap gap-2';

                    oldEquipment.forEach(item => {
                        const itemTag = document.createElement('span');
                        itemTag.className = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 border border-indigo-200';
                        itemTag.textContent = item;
                        itemsGrid.appendChild(itemTag);
                    });

                    fallbackCard.appendChild(fallbackTitle);
                    fallbackCard.appendChild(itemsGrid);
                    equipSection.appendChild(fallbackCard);
                }
            }



            card.appendChild(header);
            card.appendChild(body);
            container.appendChild(card);
        }
    }
}

window.addTeamInstance = async function (type) {
    try {
        const count = currentTeams.filter(t => t.type === type).length + 1;
        const newTeam = {
            id: `team - ${type.toLowerCase()} -${Date.now()} `,
            name: `${type} ${count} `,
            type,
            region: 'Dakar',
            capacity: teamTemplates[type].dailyCapacity,
            productivityRate: { housesPerDay: teamTemplates[type].dailyCapacity, teamType: type },
            equipment: teamTemplates[type].equipment,
            createdAt: new Date().toISOString()
        };

        await TeamRepository.addTeam(newTeam);
        await Swal.fire({
            title: 'Succès',
            text: `Nouvelle équipe "${type} ${count}" ajoutée.`,
            icon: 'success',
            timer: 1500,
            toast: true,
            position: 'top-end',
            showConfirmButton: false
        });

        await loadProjectData();
        window.debouncedRenderTeams();
        renderRequirementsTab();
    } catch (error) {
        handleUiError(error, { scope: 'addTeamInstance', type });
    }
};

// Helper function to get all equipment items from a template (handles both old and new structure)
function getAllEquipmentFromTemplate(template) {
    if (!template) return [];
    const allItems = [];

    if (template.equipmentCategories) {
        Object.values(template.equipmentCategories).forEach(category => {
            if (category.items && Array.isArray(category.items)) {
                allItems.push(...category.items);
            }
        });
    }

    return [...new Set(allItems)]; // Supprime les doublons
}

window.adjustTeamCount = async function (type, targetCount) {
    try {
        const normalizedType = getNormalizedTeamType(type);
        const teamsOfType = currentTeams.filter(t => getNormalizedTeamType(t.type) === normalizedType);
        const currentCount = teamsOfType.length;

        if (targetCount === currentCount) return;

        if (targetCount > currentCount) {
            // Add teams
            for (let i = currentCount; i < targetCount; i++) {
                const count = i + 1;
                const newTeam = {
                    id: `team-${type.toLowerCase()}-${Date.now()}-${i}`,
                    name: `${type} ${count}`,
                    type,
                    region: 'Dakar',
                    capacity: teamTemplates[type].dailyCapacity,
                    productivityRate: { housesPerDay: teamTemplates[type].dailyCapacity, teamType: type },
                    equipment: getAllEquipmentFromTemplate(teamTemplates[type]),
                    createdAt: new Date().toISOString()
                };
                await TeamRepository.addTeam(newTeam);
            }
            await Swal.fire({
                title: 'Succès',
                text: `${targetCount - currentCount} équipe(s) "${type}" ajoutée(s).`,
                icon: 'success',
                timer: 1500,
                toast: true,
                position: 'top-end',
                showConfirmButton: false
            });
        } else {
            // Remove teams (remove the most recently added ones)
            const teamsToRemove = teamsOfType.slice(targetCount).reverse();
            for (const team of teamsToRemove) {
                await TeamRepository.delete(team.id);
            }
            await Swal.fire({
                title: 'Supprimée',
                text: `${currentCount - targetCount} équipe(s) "${type}" supprimée(s).`,
                icon: 'success',
                timer: 1500,
                toast: true,
                position: 'top-end',
                showConfirmButton: false
            });
        }

        await loadProjectData();
        window.debouncedRenderTeams();
        renderRequirementsTab();
    } catch (error) {
        handleUiError(error, { scope: 'adjustTeamCount', type });
    }
};

// La fonction updateTeamFinanceConfig a été fusionnée avec updateTeamFinancial

window.manageTeamInstances = async function (type) {
    const teamsOfType = currentTeams.filter(t => t.type === type);

    if (teamsOfType.length === 0) {
        return Swal.fire({
            title: `Instances: ${type} `,
            text: `Aucune équipe de type ${type} n'est actuellement créée.`,
            icon: 'info'
        });
    }

    const listHtml = teamsOfType.map(team => `
        <div class="flex items-center justify-between p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
            <div class="text-left">
                <div class="font-bold text-gray-800">${team.name}</div>
                <div class="text-[10px] text-gray-400">ID: ${team.id}</div>
            </div>
            <button onclick="deleteIndividualTeam('${team.id}', '${team.name}', '${type}')" 
                    class="p-2 text-red-400 hover:text-red-600 transition-colors"
                    title="Supprimer cette instance">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `).join('');

    Swal.fire({
        title: `Gestion des Équipes: ${type}`,
        html: `
            <div class="max-h-[400px] overflow-y-auto mt-4 border rounded-lg">
                ${listHtml}
            </div>
        `,
        showCloseButton: true,
        showConfirmButton: false,
        width: '500px'
    });
};

window.deleteTeamType = async function (type) {
    const roleId = getTeamRoleId(type);

    // Check active instances
    const activeTeams = currentTeams.filter(t => t.type === type);
    const count = activeTeams.length;

    const result = await Swal.fire({
        title: 'Supprimer le Type d\'Équipe ?',
        html: `
            Vous êtes sur le point de supprimer définivement le type <b>${type}</b>.<br>
            <br>
            Ceci entraînera :<br>
            - La suppression de <b>${count}</b> équipes existantes.<br>
            - La suppression de la configuration financière.<br>
            - La suppression des équipements associés.<br>
            <br>
            <span class="text-red-500 font-bold">Cette action est irréversible.</span>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Tout Supprimer',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#d33'
    });

    if (result.isConfirmed) {
        try {
            // 1. Delete all instances
            const instanceIds = activeTeams.map(t => t.id);
            if (instanceIds.length > 0) {
                await window.db.teams.bulkDelete(instanceIds);
                // Also reset assignments for these teams
                await window.db.households.where('teamId').anyOf(instanceIds).modify({ teamId: null, status: (window.HouseholdStatus?.NON_DEBUTE) || 'Non débuté' }); // Simple reset logic
            }

            // 2. Prepare Updates to remove Type from Project
            const updates = {
                teamCapabilities: { ...currentProject.teamCapabilities },
                staffConfig: { ...currentProject.staffConfig },
                costs: { ...currentProject.costs }
            };

            // Remove from capabilities (source of truth for templates)
            const typeKey = type.toLowerCase();
            delete updates.teamCapabilities[typeKey];

            // Try normalized key if not found
            const normKey = getNormalizedTeamType(type).toLowerCase();
            if (updates.teamCapabilities[normKey]) delete updates.teamCapabilities[normKey];

            // Trigger overwrite in repository to prevent merging back the deleted key
            updates.teamCapabilities._overwrite = true;

            // Remove from staff config
            delete updates.staffConfig[roleId];
            delete updates.costs[roleId];

            // 3. Save & Refresh
            // We need to force reload because teamTemplates is derived from capabilities in loadProjectData
            await saveProjectState(updates, { reload: true, refreshUI: true, silent: false });

            // Manually remove from local templates copy to be sure immediate UI update works even if reload takes time
            delete teamTemplates[type];

            // Force re-render of teams tab completely (debounced to coalesce)
            window.debouncedRenderTeams();

            Swal.fire(
                'Supprimé !',
                `Le type d'équipe ${type} a été supprimé.`,
                'success'
            );

        } catch (error) {
            handleUiError(error, { scope: 'deleteTeamType', type });
        }
    }
};

window.deleteIndividualTeam = async function (teamId, teamName, type) {
    try {
        // Check for assignments
        const households = await window.db.households.where('teamId').equals(teamId).toArray();
        const impactCount = households.length;

        const result = await Swal.fire({
            title: 'Confirmation',
            html: `Voulez-vous supprimer l'équipe <b>${teamName}</b> ?<br>${impactCount > 0 ? `<span class="text-red-500 text-sm mt-2"><i class="fas fa-exclamation-triangle"></i> Attention: ${impactCount} ménage(s) assignés seront réinitialisés.</span>` : ''}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Supprimer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#ef4444'
        });

        if (result.isConfirmed) {
            if (impactCount > 0) {
                await TeamRepository.resetAssignments(teamId);
            }
            await TeamRepository.delete(teamId);

            Swal.fire({
                title: 'Supprimée',
                text: `L'équipe ${teamName} a été supprimée.`,
                icon: 'success',
                timer: 1500,
                toast: true,
                position: 'top-end',
                showConfirmButton: false
            });

            await loadProjectData();
            window.debouncedRenderTeams();
            renderRequirementsTab();

            // If modal is open, refresh it
            const currentModal = Swal.getHtmlContainer();
            if (currentModal && currentModal.innerText.includes('Gestion des Équipes')) {
                manageTeamInstances(type);
            }
        }
    } catch (error) {
        handleUiError(error, { scope: 'deleteIndividualTeam', teamId, type });
    }
};

window.updateTeamParam = async function (type, field, value) {
    const template = teamTemplates[type];
    if (!template) return;

    if (field === 'daily') template.dailyCapacity = parseInt(value) || 1;
    if (field === 'vehicleType') template.vehicleType = value;
    if (field === 'acquisitionMode') template.acquisitionMode = value;
    if (field === 'interventionDays') template.interventionDays = parseInt(value) || currentProject.duration || 180;
    if (field === 'startDate') template.startDate = value;

    const deltas = {
        teamCapabilities: {
            [type]: {
                daily: template.dailyCapacity,
                equipmentCategories: template.equipmentCategories,
                vehicleType: template.vehicleType,
                acquisitionMode: template.acquisitionMode,
                interventionDays: template.interventionDays,
                startDate: template.startDate
            }
        }
    };

    await saveProjectState(deltas);
};

window.updateTeamFinancial = async function (type, field, value) {
    const roleId = getTeamRoleId(type);
    const staffConfig = { ...currentProject.staffConfig };

    if (!staffConfig[roleId]) {
        const template = teamTemplates[type];
        staffConfig[roleId] = { amount: template?.costPerDay || 5000, mode: 'daily', logistics: '' };
    }

    const config = staffConfig[roleId];
    if (field === 'mode') config.mode = value;
    if (field === 'amount') config.amount = parseFloat(value) || 0;
    if (field === 'logistics') config.logistics = value;

    config.label = type;

    const costs = { ...currentProject.costs };
    costs[roleId] = config.mode === 'monthly' ? Math.round(config.amount / 22) : config.amount;

    const success = await saveProjectState({ staffConfig, costs }, { refreshUI: true, silent: true });

    if (success && (field === 'amount' || field === 'mode')) {
        await updateTeamStats();
        renderStaffCosts();
    }
};

window.editTeamTemplate = function (type) {
    const template = teamTemplates[type];
    if (!template) return;

    // Préparer le HTML des catégories d'équipements
    let equipmentHtml = '';
    const categories = template.equipmentCategories || { "Équipements": { icon: "🔧", items: [] } };

    Object.entries(categories).forEach(([name, data]) => {
        equipmentHtml += `
            <div class="form-group mb-3">
                <label class="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                    ${data.icon || '📦'} ${name}
                </label>
                <textarea class="swal-equipment-category w-full p-2 border rounded h-16 text-xs" 
                          data-category="${name}" 
                          placeholder="Pelle x2, Pioche, Casque x3...">${(data.items || []).join(', ')}</textarea>
            </div>
        `;
    });

    Swal.fire({
        title: `Configuration : ${type}`,
        width: '650px',
        html: `
            <div class="text-left space-y-4 p-2">
                <!-- Warning container -->
                <div id="swal-vehicle-warning" class="hidden p-2 bg-yellow-50 border border-yellow-100 text-yellow-700 text-xs rounded mb-2">
                    <i class="fas fa-exclamation-triangle mr-1"></i> <strong>Attention:</strong> Ce véhicule semble inadapté pour ce type d'équipe (charge lourde estimée).
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Capacité / Jour</label>
                        <input id="swal-daily-capacity" type="number" class="w-full p-2 border rounded" value="${template.dailyCapacity}">
                    </div>
                    <div class="form-group">
                        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Tarif de Prestation (FCFA)</label>
                        <input id="swal-daily-cost" type="number" class="w-full p-2 border rounded" value="${template.costPerDay}">
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4 border-b pb-4">
                    <div class="form-group">
                        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Logistique</label>
                        <select id="swal-vehicle-type" class="w-full p-2 border rounded" onchange="checkVehicleSuitability(this.value, '${type}')">
                            <option value="none" ${template.vehicleType === 'none' ? 'selected' : ''}>Aucun</option>
                            <option value="motorcycle" ${template.vehicleType === 'motorcycle' ? 'selected' : ''}>Moto</option>
                            <option value="pickup" ${template.vehicleType === 'pickup' ? 'selected' : ''}>Pickup</option>
                            <option value="truck" ${template.vehicleType === 'truck' ? 'selected' : ''}>Camion</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Mode Acquisition</label>
                        <select id="swal-acquisition-mode" class="w-full p-2 border rounded">
                            <option value="location" ${template.acquisitionMode === 'location' ? 'selected' : ''}>Location</option>
                            <option value="achat_direct" ${template.acquisitionMode === 'achat_direct' ? 'selected' : ''}>Achat direct</option>
                            <option value="sous_traitance" ${template.acquisitionMode === 'sous_traitance' ? 'selected' : ''}>Sous-traitance</option>
                        </select>
                    </div>
                </div>
                <div class="mt-4">
                    <h4 class="text-xs font-black text-indigo-600 uppercase mb-2 border-b border-indigo-50 pb-1">Équipements par Catégorie</h4>
                    <div class="max-h-[300px] overflow-y-auto pr-2">
                        ${equipmentHtml}
                    </div>
                </div>
            </div>
        `,
        didOpen: () => {
            window.checkVehicleSuitability(template.vehicleType, type);
            const vehicleEl = document.getElementById('swal-vehicle-type');
            const acquisitionEl = document.getElementById('swal-acquisition-mode');
            const toggleAcquisition = () => {
                if (!acquisitionEl || !vehicleEl) return;
                const disabled = vehicleEl.value === 'none';
                acquisitionEl.disabled = disabled;
                acquisitionEl.classList.toggle('bg-gray-100', disabled);
                acquisitionEl.classList.toggle('text-gray-500', disabled);
            };
            if (vehicleEl) vehicleEl.addEventListener('change', toggleAcquisition);
            toggleAcquisition();
        },
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Sauvegarder',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#4f46e5',
        preConfirm: () => {
            const result = {
                dailyCapacity: parseInt(document.getElementById('swal-daily-capacity').value),
                costPerDay: parseInt(document.getElementById('swal-daily-cost').value),
                vehicleType: document.getElementById('swal-vehicle-type').value,
                acquisitionMode: document.getElementById('swal-acquisition-mode').value,
                equipmentCategories: {}
            };

            document.querySelectorAll('.swal-equipment-category').forEach(textarea => {
                const catName = textarea.dataset.category;
                const items = textarea.value.split(',').map(item => item.trim()).filter(i => i);
                result.equipmentCategories[catName] = {
                    ...categories[catName],
                    items: items
                };
            });

            return result;
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const { dailyCapacity, costPerDay, vehicleType, acquisitionMode, equipmentCategories } = result.value;
            const updates = {
                teamCapabilities: {
                    [type.toLowerCase()]: {
                        daily: dailyCapacity,
                        equipmentCategories,
                        vehicleType,
                        acquisitionMode
                    }
                },
                costs: {
                    [`per${type}Team`]: costPerDay
                }
            };

            const success = await saveProjectState(updates, { reload: true, refreshUI: true, silent: false });
            if (success) {
                window.debouncedRenderTeams();
            }
        }
    });
};


async function addNewTeamType() {
    Swal.fire({
        title: "Nouveau Type d'Équipe",
        html: `
            <div class="text-left space-y-4 p-2">
                <div id="swal-new-vehicle-warning" class="hidden p-2 bg-yellow-50 border border-yellow-100 text-yellow-700 text-xs rounded mb-2">
                    <i class="fas fa-exclamation-triangle mr-1"></i> <strong>Attention:</strong> Ce véhicule semble inadapté (charge lourde).
                </div>
                <div class="form-group">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Nom du Type</label>
                    <input id="swal-new-type" type="text" class="w-full p-2 border rounded" placeholder="ex: Maçon" oninput="checkVehicleSuitability(document.getElementById('swal-new-vehicle').value, this.value)">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Capacité / Jour</label>
                        <input id="swal-new-capacity" type="number" class="w-full p-2 border rounded" value="5">
                    </div>
                    <div class="form-group">
                        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Mode de Tarification</label>
                        <select id="swal-new-payment-mode" class="w-full p-2 border rounded">
                            <option value="daily" selected>Journalier (FCFA/jour)</option>
                            <option value="task">À la tâche (FCFA/tâche)</option>
                            <option value="monthly">Mensuel (FCFA/mois)</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Tarif de Prestation (FCFA)</label>
                    <input id="swal-new-cost" type="number" class="w-full p-2 border rounded" value="150000">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-group">
                        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Logistique</label>
                        <select id="swal-new-vehicle" class="w-full p-2 border rounded" onchange="checkVehicleSuitability(this.value, document.getElementById('swal-new-type').value)">
                            <option value="none">Aucun</option>
                            <option value="motorcycle">Moto</option>
                            <option value="pickup" selected>Pickup</option>
                            <option value="truck">Camion</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Catégorie Équipement</label>
                        <input id="swal-new-cat" type="text" class="w-full p-2 border rounded" placeholder="ex: Outils Spécifiques" value="Équipements">
                    </div>
                </div>
                <div class="form-group">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Articles (séparés par virgule, ex: Pelle x2, Pioche)</label>
                    <textarea id="swal-new-items" class="w-full p-2 border rounded h-16 text-xs" placeholder="Pelle x2, Pioche, Casque x3..."></textarea>
                </div>
                <div class="form-group">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Mode Acquisition</label>
                    <select id="swal-new-acquisition" class="w-full p-2 border rounded">
                        <option value="location">Location</option>
                        <option value="achat_direct" selected>Achat direct</option>
                        <option value="sous_traitance">Sous-traitance</option>
                    </select>
                </div>
            </div>
        `,
        didOpen: () => {
            const vehicleEl = document.getElementById('swal-new-vehicle');
            const acquisitionEl = document.getElementById('swal-new-acquisition');
            const toggle = () => {
                if (!acquisitionEl || !vehicleEl) return;
                const disabled = vehicleEl.value === 'none';
                acquisitionEl.disabled = disabled;
                acquisitionEl.classList.toggle('bg-gray-100', disabled);
                acquisitionEl.classList.toggle('text-gray-500', disabled);
            };
            if (vehicleEl) vehicleEl.addEventListener('change', toggle);
            toggle();
        },
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Créer',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#4f46e5',
        preConfirm: () => {
            const typeInput = document.getElementById('swal-new-type');
            const type = typeInput.value.trim();
            if (!type) {
                typeInput.classList.add('border-red-500');
                return Swal.showValidationMessage("Le nom est obligatoire");
            }

            const formattedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
            if (teamTemplates[formattedType]) {
                return Swal.showValidationMessage("Ce type d'équipe existe déjà");
            }
            return {
                type,
                daily: parseInt(document.getElementById('swal-new-capacity').value) || 5,
                cost: parseInt(document.getElementById('swal-new-cost').value) || 150000,
                paymentMode: document.getElementById('swal-new-payment-mode').value || 'daily',
                vehicleType: document.getElementById('swal-new-vehicle').value,
                acquisitionMode: document.getElementById('swal-new-acquisition').value,
                category: document.getElementById('swal-new-cat').value.trim() || "Équipements",
                items: document.getElementById('swal-new-items').value.split(',').map(i => i.trim()).filter(i => i)
            }
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const { type, daily, cost, paymentMode, vehicleType, acquisitionMode, category, items } = result.value;
                const formattedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();

                // 1. Mettre à jour le registre des équipements du projet si nécessaire
                const registry = { ...currentProject.equipmentRegistry || {} };
                if (!registry[category]) {
                    registry[category] = { icon: "🔧", items: [] };
                    console.log(`🆕 Nouvelle catégorie ajoutée au registre : ${category}`);
                }

                // 2. Mettre à jour les templates locaux
                teamTemplates[formattedType] = {
                    dailyCapacity: daily,
                    costPerDay: cost,
                    vehicleType: vehicleType,
                    acquisitionMode: acquisitionMode,
                    equipmentCategories: { [category]: { icon: registry[category].icon, items: items } },
                    description: "Nouveau type personnalisé"
                };

                const updates = {
                    teamCapabilities: {
                        [type.toLowerCase()]: {
                            daily,
                            equipmentCategories: { [category]: { icon: registry[category].icon, items: items } },
                            vehicleType,
                            acquisitionMode
                        }
                    },
                    costs: {
                        [getTeamRoleId(type)]: cost
                    },
                    staffConfig: {
                        [getTeamRoleId(type)]: {
                            mode: paymentMode,
                            amount: cost
                        }
                    },
                    equipmentRegistry: registry
                };

                // Ensure teamTypesOrder persists the new type at the end (avoid duplicates)
                const existingOrder = Array.isArray(currentProject.teamTypesOrder) ? currentProject.teamTypesOrder.slice() : [];
                const formattedForOrder = formattedType;
                if (!existingOrder.includes(formattedForOrder)) existingOrder.push(formattedForOrder);
                updates.teamTypesOrder = existingOrder;

                const success = await saveProjectState(updates, { reload: true, refreshUI: true, silent: false });
                if (success) {
                    window.debouncedRenderTeams();
                    renderRequirementsTab();
                    Swal.fire({
                        title: 'Succès',
                        text: `Le type "${formattedType}" a été créé.`,
                        icon: 'success',
                        toast: true,
                        position: 'top-end',
                        timer: 2000,
                        showConfirmButton: false
                    });
                }
            } catch (err) {
                handleUiError(err, { scope: 'createTeamType' });
            }
        }
    });
}
async function deleteTeamType(type) {
    const teamsUsingType = currentTeams.filter(t => t.type === type).length;
    const confirm = await Swal.fire({
        title: `Supprimer le type "${type}" ? `,
        html: `
        <div class="text-sm text-left">
        <p class="mb-2">Cette action supprimera également le coût salarial associé.</p>
                ${teamsUsingType > 0 ? `
                <div class="p-3 bg-red-50 border border-red-100 rounded text-red-700 font-bold mb-2">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    Attention : ${teamsUsingType} équipe(s) active(s) de ce type seront supprimées et leurs assignations réinitialisées.
                </div>
                ` : '<p class="text-green-600 mb-2">Aucune équipe active n\'utilise ce type.</p>'}
            </div>
    `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Supprimer tout',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#ef4444'
    });

    if (confirm.isConfirmed) {
        try {
            // 1. Supprimer les équipes et réinitialiser les ménages via le repository
            await TeamRepository.deleteByType(type);

            // 2. Mettre à jour les paramètres du projet
            const capabilities = { ...currentProject.teamCapabilities };
            const lowType = type.toLowerCase();

            // Supprimer toutes les variations possibles de la clé
            delete capabilities[lowType];
            // Supprimer aussi l'équivalent anglais si présent (fallback)
            const engMap = { 'Maçon': 'mason', 'Réseau': 'network', 'Intérieur': 'interior', 'Contrôleur': 'controller', 'Superviseur': 'supervisor' };
            if (engMap[type]) delete capabilities[engMap[type]];

            capabilities._overwrite = true; // Forcer l'écrasement pour supprimer les clés

            const costs = { ...currentProject.costs };
            const staffConfig = { ...currentProject.staffConfig };

            const roleId = getTeamRoleId(type);

            delete costs[roleId];
            delete staffConfig[roleId];

            costs._overwrite = true;
            staffConfig._overwrite = true;

            // Also remove from persisted order if present
            const existingOrder = Array.isArray(currentProject.teamTypesOrder) ? currentProject.teamTypesOrder.filter(t => t !== type) : [];

            const success = await saveProjectState({
                teamCapabilities: capabilities,
                costs: costs,
                staffConfig: staffConfig,
                teamTypesOrder: existingOrder
            }, { reload: true, refreshUI: true, silent: false });

            if (success) {
                delete teamTemplates[type];
                window.debouncedRenderTeams();
            }
        } catch (err) {
            handleUiError(err, { scope: 'deleteTeamConfig', type });
        }
    }
}

window.deleteStaffRole = async function (roleId, label) {
    linkedType = Object.keys(teamTemplates).find(t => getTeamRoleId(t) === roleId);

    if (linkedType) {
        return deleteTeamType(linkedType);
    }

    // Si c'est un rôle sans équipe liée (ex: Superviseur si non géré en template)
    const confirm = await Swal.fire({
        title: `Supprimer le rôle "${label}" ? `,
        text: "Cette action est irréversible.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Supprimer',
        confirmButtonColor: '#ef4444'
    });

    if (confirm.isConfirmed) {
        const costs = { ...currentProject.costs };
        const staffConfig = { ...currentProject.staffConfig };
        delete costs[roleId];
        delete staffConfig[roleId];
        costs._overwrite = true;
        staffConfig._overwrite = true;

        await saveProjectState({ costs, staffConfig }, { reload: true, refreshUI: true, silent: false });
    }
}

window.resetToStandardRoles = async function () {
    const confirm = await Swal.fire({
        title: 'Réinitialiser les rôles standards ?',
        text: "Cela restaurera les types Maçon, Réseau, Intérieur, Contrôleur, Préparateur et Livreur avec leurs valeurs par défaut. Vos types personnalisés seront conservés.",
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Réinitialiser'
    });

    if (confirm.isConfirmed) {
        const standards = {
            "Maçon": { daily: 2, cost: 150000, vehicle: "none", acquisition: "rental" },
            "Réseau": { daily: 10, cost: 200000, vehicle: "pickup", acquisition: "rental" },
            "Intérieur": { daily: 8, cost: 180000, vehicle: "pickup", acquisition: "rental" },
            "Contrôleur": { daily: 15, cost: 120000, vehicle: "motorcycle", acquisition: "purchase" },
            "Préparateur": { daily: 50, cost: 100000, vehicle: "none", acquisition: "rental" },
            "Livreur": { daily: 30, cost: 80000, vehicle: "truck", acquisition: "rental" }
        };

        const caps = { ...currentProject.teamCapabilities };
        const costs = { ...currentProject.costs };

        Object.entries(standards).forEach(([type, val]) => {
            caps[type.toLowerCase()] = { daily: val.daily, equipmentCategories: { "Équipements": { icon: "🔧", items: [] } }, vehicleType: val.vehicle, acquisitionMode: val.acquisition };
            costs[`per${type}Team`] = val.cost;
        });

        await saveProjectState({ teamCapabilities: caps, costs }, { reload: true, refreshUI: true, silent: false });
    }
}

window.addTeamEquipment = async function (type, inputId) {
    const input = document.getElementById(inputId);
    const equipmentName = input.value.trim();
    if (!equipmentName) return;

    if (!teamTemplates[type].equipment) teamTemplates[type].equipment = [];
    if (!teamTemplates[type].equipment.includes(equipmentName)) {
        teamTemplates[type].equipment.push(equipmentName);

        // Persister dans le projet
        const caps = { ...currentProject.teamCapabilities };
        const key = type.toLowerCase();
        if (!caps[key]) caps[key] = { daily: teamTemplates[type].dailyCapacity, equipment: [] };
        caps[key].equipment = teamTemplates[type].equipment;

        await ProjectRepository.updateProjectParameters({ teamCapabilities: caps });
        await loadProjectData();
        window.debouncedRenderTeams();
        renderAssetCosts();
        renderRequirementsTab();
    }
    input.value = '';
};

window.removeTeamEquipment = async function (type, equipmentName) {
    // Handle both old and new structure
    if (teamTemplates[type].equipment) {
        teamTemplates[type].equipment = teamTemplates[type].equipment.filter(e => e !== equipmentName);
    }
    if (teamTemplates[type].equipmentCategories) {
        for (const category of Object.values(teamTemplates[type].equipmentCategories)) {
            if (category.items) {
                category.items = category.items.filter(e => e !== equipmentName);
            }
        }
    }

    // Collect all equipment for persistence
    const allEquipment = [];
    if (teamTemplates[type].equipmentCategories) {
        Object.values(teamTemplates[type].equipmentCategories).forEach(cat => {
            if (cat.items) allEquipment.push(...cat.items);
        });
    }

    // Persister
    const caps = { ...currentProject.teamCapabilities };
    const key = type.toLowerCase();
    if (caps[key]) {
        caps[key].equipment = allEquipment;
        await ProjectRepository.updateProjectParameters({ teamCapabilities: caps });
        await loadProjectData();
        window.debouncedRenderTeams();
        renderAssetCosts();
        renderRequirementsTab();
    }
};

// New helper functions for categorized equipment
window.toggleCategory = function (headerElement) {
    const content = headerElement.nextElementSibling;
    const icon = headerElement.querySelector('.category-toggle-icon');

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if (icon) icon.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        if (icon) icon.style.transform = 'rotate(0deg)';
    }
};

window.addEquipmentToCategory = async function (type, category, inputId) {
    const input = document.getElementById(inputId);
    const equipmentName = input.value.trim();
    if (!equipmentName) return;

    if (!teamTemplates[type].equipmentCategories) {
        teamTemplates[type].equipmentCategories = {};
    }
    if (!teamTemplates[type].equipmentCategories[category]) {
        teamTemplates[type].equipmentCategories[category] = { icon: "🔧", items: [] };
    }

    if (!teamTemplates[type].equipmentCategories[category].items.includes(equipmentName)) {
        teamTemplates[type].equipmentCategories[category].items.push(equipmentName);

        // Collect all equipment for persistence
        const allEquipment = [];
        Object.values(teamTemplates[type].equipmentCategories).forEach(cat => {
            if (cat.items) allEquipment.push(...cat.items);
        });

        // Persister dans le projet
        const caps = { ...currentProject.teamCapabilities };
        const key = type.toLowerCase();
        if (!caps[key]) caps[key] = { daily: teamTemplates[type].dailyCapacity, equipment: [] };
        caps[key].equipment = allEquipment;

        await ProjectRepository.updateProjectParameters({ teamCapabilities: caps });
        await loadProjectData();
        window.debouncedRenderTeams();
        renderAssetCosts();
        renderRequirementsTab();
    }
    input.value = '';
};

window.removeEquipmentFromCategory = async function (type, category, equipmentName) {
    if (teamTemplates[type].equipmentCategories && teamTemplates[type].equipmentCategories[category]) {
        teamTemplates[type].equipmentCategories[category].items =
            teamTemplates[type].equipmentCategories[category].items.filter(e => e !== equipmentName);

        // Collect all equipment for persistence
        const allEquipment = [];
        Object.values(teamTemplates[type].equipmentCategories).forEach(cat => {
            if (cat.items) allEquipment.push(...cat.items);
        });

        // Persister
        const caps = { ...currentProject.teamCapabilities };
        const key = type.toLowerCase();
        if (caps[key]) {
            caps[key].equipment = allEquipment;
            await ProjectRepository.updateProjectParameters({ teamCapabilities: caps });
            await loadProjectData();
            window.debouncedRenderTeams();
            renderAssetCosts();
            renderRequirementsTab();
        }
    }
};

function renderAssetCosts() {
    const container = document.getElementById('assetCostsContainer');
    if (!container) return;

    container.innerHTML = '';
    const assetCosts = currentProject.assetCosts || {};
    let registry = currentProject.equipmentRegistry || {};

    // Chiffres clés du projet
    const houses = currentProject.totalHousesOverride || 0;
    const duration = currentProject.duration || 180;
    const teamCount = (currentTeams || []).length;
    const equipCount = Object.keys(currentProject.equipmentRegistry || {}).length;

    // Concaténer les valeurs critiques pour le hachage
    // Cela permet de déclencher un recalcul si ces valeurs changent
    const stateStr = `${houses}-${duration}-${teamCount}-${equipCount}-${JSON.stringify(currentProject.teamCapabilities || {})}`;

    // 1. Migration automatique si le registre est vide
    if (Object.keys(registry).length === 0) {
        console.log('📦 Migration des équipements vers le registre de projet...');
        Object.values(teamTemplates).forEach(template => {
            if (template.equipmentCategories) {
                Object.entries(template.equipmentCategories).forEach(([categoryName, categoryData]) => {
                    if (!registry[categoryName]) {
                        registry[categoryName] = {
                            icon: categoryData.icon || '📦',
                            items: []
                        };
                    }
                    if (categoryData.items) {
                        categoryData.items.forEach(item => {
                            if (!registry[categoryName].items.includes(item)) {
                                registry[categoryName].items.push(item);
                            }
                        });
                    }
                });
            }
        });

        // Ajouter standards par défaut
        if (!registry['Équipements Standards']) {
            registry['Équipements Standards'] = {
                icon: '💼',
                items: ["Ordinateur / Tablette", "EPI Complet"]
            };
        }

        // Sauvegarder immédiatement la migration
        currentProject.equipmentRegistry = registry;
    }

    // 3. Créer les cartes par catégorie
    Object.entries(registry).forEach(([categoryName, categoryData]) => {
        const categoryCard = document.createElement('div');
        categoryCard.className = 'bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm hover:shadow-md transition-shadow relative';

        // Header de la catégorie
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'flex items-center gap-3 mb-4 pb-3 border-b border-gray-100';

        const categoryIcon = document.createElement('span');
        categoryIcon.className = 'text-2xl cursor-pointer hover:scale-110 transition-transform';
        categoryIcon.textContent = categoryData.icon;
        categoryIcon.title = 'Changer l\'icône';
        categoryIcon.onclick = () => changeCategoryIcon(categoryName);
        categoryHeader.appendChild(categoryIcon);

        const categoryTitle = document.createElement('h4');
        categoryTitle.className = 'text-lg font-semibold text-gray-800';
        categoryTitle.textContent = categoryName;
        categoryHeader.appendChild(categoryTitle);

        const actions = document.createElement('div');
        actions.className = 'ml-auto flex items-center gap-2';

        const addItemBtn = document.createElement('button');
        addItemBtn.className = 'text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded transition-colors flex items-center gap-1';
        addItemBtn.innerHTML = '<i class="fas fa-plus"></i> Ajouter un outil';
        addItemBtn.onclick = () => addEquipmentToCategory(categoryName);
        actions.appendChild(addItemBtn);

        const deleteCatBtn = document.createElement('button');
        deleteCatBtn.className = 'text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors flex items-center gap-1';
        deleteCatBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Supprimer';
        deleteCatBtn.title = 'Supprimer la catégorie';
        deleteCatBtn.onclick = () => deleteEquipmentCategory(categoryName);
        actions.appendChild(deleteCatBtn);

        categoryHeader.appendChild(actions);
        categoryCard.appendChild(categoryHeader);

        // Contenu de la catégorie
        const categoryContent = document.createElement('div');
        categoryContent.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';

        const items = categoryData.items || [];
        items.sort().forEach(equipment => {
            const key = equipment.toLowerCase().replace(/\s+/g, '_');
            const cost = assetCosts[key] || 0;

            const equipmentGroup = document.createElement('div');
            equipmentGroup.className = 'bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-indigo-300 transition-colors relative';

            const equipmentHeader = document.createElement('div');
            equipmentHeader.className = 'flex justify-between items-start mb-3';

            const equipmentName = document.createElement('h5');
            equipmentName.className = 'text-sm font-medium text-gray-800 flex-1 pr-4';
            equipmentName.textContent = equipment;
            equipmentHeader.appendChild(equipmentName);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors';
            removeBtn.title = 'Supprimer cet équipement';
            removeBtn.addEventListener('click', () => removeAssetCost(categoryName, equipment));

            const removeIcon = document.createElement('i');
            removeIcon.className = 'fas fa-times text-xs';
            removeBtn.appendChild(removeIcon);
            equipmentHeader.appendChild(removeBtn);

            equipmentGroup.appendChild(equipmentHeader);

            // Input pour le coût
            const costGroup = document.createElement('div');
            costGroup.className = 'flex items-center gap-2';

            const costInput = document.createElement('input');
            costInput.type = 'number';
            costInput.className = 'asset-cost-input p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';
            costInput.setAttribute('data-asset-key', key);
            costInput.value = cost;
            costInput.addEventListener('change', (e) => {
                validateNumericalInput(e.target, 0);
            });

            const costLabel = document.createElement('span');
            costLabel.className = 'text-xs text-gray-500 whitespace-nowrap';
            costLabel.textContent = 'FCFA';

            costGroup.appendChild(costInput);
            costGroup.appendChild(costLabel);
            equipmentGroup.appendChild(costGroup);

            categoryContent.appendChild(equipmentGroup);
        });

        // Message si catégorie vide
        if (items.length === 0) {
            const emptyItems = document.createElement('div');
            emptyItems.className = 'col-span-full py-4 text-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-lg';
            emptyItems.textContent = 'Aucun outil dans cette catégorie';
            categoryContent.appendChild(emptyItems);
        }

        categoryCard.appendChild(categoryContent);
        container.appendChild(categoryCard);
    });

    // Message si registre vide (ne devrait pas arriver avec la migration)
    if (Object.keys(registry).length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'text-center py-12 text-gray-500';
        emptyState.innerHTML = `
            <i class="fas fa-tools text-4xl mb-4 text-gray-300"></i>
            <p class="text-lg">Aucun équipement configuré</p>
            <p class="text-sm">Cliquez sur le bouton pour ajouter votre première catégorie.</p>
        `;
        container.appendChild(emptyState);
    }
}

window.removeAssetCost = async function (categoryName, equipmentName) {
    const confirm = await Swal.fire({
        title: 'Supprimer cet outil ?',
        text: `Voulez-vous supprimer "${equipmentName}" de la catégorie "${categoryName}" ?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Supprimer',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#ef4444'
    });

    if (confirm.isConfirmed) {
        const registry = { ...currentProject.equipmentRegistry };
        if (registry[categoryName]) {
            registry[categoryName].items = registry[categoryName].items.filter(i => i !== equipmentName);

            // On garde le prix dans assetCosts pour ne pas perdre l'historique si on le réajoute
            // mais on pourrait aussi le supprimer. Pour l'instant on met à jour le registre.

            currentProject.equipmentRegistry = registry;
            const success = await ProjectRepository.updateProjectParameters({ equipmentRegistry: registry });
            if (success) renderAssetCosts();
        }
    }
};

window.addEquipmentCategory = async function () {
    const { value: formValues } = await Swal.fire({
        title: 'Nouvelle Catégorie',
        html: `
            <div class="space-y-4 pt-2">
                <input id="swal-cat-name" class="swal2-input m-0 w-full" placeholder="Nom de la catégorie (ex: Outillage lourd)">
                <input id="swal-cat-icon" class="swal2-input m-0 w-full" placeholder="Icône (ex: ⚒️, 🚜, 📦)" value="📦">
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Créer',
        cancelButtonText: 'Annuler',
        preConfirm: () => {
            const name = document.getElementById('swal-cat-name').value.trim();
            const icon = document.getElementById('swal-cat-icon').value.trim() || '📦';
            if (!name) return Swal.showValidationMessage('Le nom est requis');
            if (currentProject.equipmentRegistry?.[name]) return Swal.showValidationMessage('Cette catégorie existe déjà');
            return { name, icon };
        }
    });

    if (formValues) {
        const registry = { ...currentProject.equipmentRegistry || {} };
        registry[formValues.name] = {
            icon: formValues.icon,
            items: []
        };
        currentProject.equipmentRegistry = registry;
        const success = await ProjectRepository.updateProjectParameters({ equipmentRegistry: registry });
        if (success) renderAssetCosts();
    }
};

window.addEquipmentToCategory = async function (categoryName) {
    const { value: equipmentName } = await Swal.fire({
        title: `Ajouter à ${categoryName}`,
        input: 'text',
        inputLabel: 'Nom de l\'équipement / outil',
        inputPlaceholder: 'ex: Tronçonneuse',
        showCancelButton: true,
        confirmButtonText: 'Ajouter',
        cancelButtonText: 'Annuler',
        inputValidator: (value) => {
            if (!value) return 'Le nom est requis';
            const registry = currentProject.equipmentRegistry || {};
            if (registry[categoryName]?.items.includes(value.trim())) return 'Cet outil existe déjà dans cette catégorie';
        }
    });

    if (equipmentName) {
        const registry = { ...currentProject.equipmentRegistry };
        if (registry[categoryName]) {
            registry[categoryName].items.push(equipmentName.trim());
            currentProject.equipmentRegistry = registry;
            const success = await ProjectRepository.updateProjectParameters({ equipmentRegistry: registry });
            if (success) renderAssetCosts();
        }
    }
};

window.deleteEquipmentCategory = async function (categoryName) {
    const confirm = await Swal.fire({
        title: 'Supprimer la catégorie ?',
        text: `La catégorie "${categoryName}" et tous ses outils seront supprimés définitivement.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Supprimer tout',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#ef4444'
    });

    if (confirm.isConfirmed) {
        try {
            // Supprimer du registre
            const registry = { ...currentProject.equipmentRegistry };
            delete registry[categoryName];

            // Mettre à jour le projet
            const success = await ProjectRepository.updateProjectParameters({
                equipmentRegistry: registry
            });

            if (success) {
                // Mettre à jour currentProject en mémoire
                currentProject.equipmentRegistry = registry;

                // Rafraîchir l'affichage
                renderAssetCosts();

                // Notification de succès
                Swal.fire({
                    title: 'Supprimée !',
                    text: `La catégorie "${categoryName}" a été supprimée.`,
                    icon: 'success',
                    toast: true,
                    position: 'top-end',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
            Swal.fire({
                title: 'Erreur',
                text: 'Impossible de supprimer la catégorie.',
                icon: 'error'
            });
        }
    }
};

window.changeCategoryIcon = async function (categoryName) {
    const { value: newIcon } = await Swal.fire({
        title: 'Changer l\'icône',
        input: 'text',
        inputValue: currentProject.equipmentRegistry[categoryName].icon,
        inputPlaceholder: 'Emoji (ex: ⚒️)',
        showCancelButton: true
    });

    if (newIcon) {
        const registry = { ...currentProject.equipmentRegistry };
        registry[categoryName].icon = newIcon;
        currentProject.equipmentRegistry = registry;
        const success = await ProjectRepository.updateProjectParameters({ equipmentRegistry: registry });
        if (success) renderAssetCosts();
    }
};

// Initialisation de la page
(async function () {
    await loadProjectData();
    renderAssetCosts();
    renderTeamsTab();
    renderRequirementsTab();
})();

window.clearAllAssetCosts = async function () {
    const confirm = await Swal.fire({
        title: 'Tout effacer ?',
        text: 'Cette action supprimera TOUS les équipements et leurs coûts de la grille tarifaire. Cette action est irréversible.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Oui, tout effacer',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#ef4444'
    });

    if (confirm.isConfirmed) {
        // Clear all asset costs
        const assetCosts = {};

        // Clear all equipment from templates
        Object.values(teamTemplates).forEach(template => {
            if (template.equipment) {
                template.equipment = [];
            }
            if (template.equipmentCategories) {
                Object.values(template.equipmentCategories).forEach(category => {
                    if (category.items) {
                        category.items = [];
                    }
                });
            }
        });

        // Update project
        await ProjectRepository.updateProjectParameters({ assetCosts });
        await loadProjectData();
        renderAssetCosts();
        window.debouncedRenderTeams();
        renderRequirementsTab();

        Swal.fire({
            title: 'Tous les équipements ont été effacés',
            icon: 'success',
            toast: true,
            position: 'top-end',
            timer: 2000,
            showConfirmButton: false
        });
    }
};

function renderLogisticsTab() {
    const vehiclesTable = document.getElementById('vehiclesTableBody');
    if (!vehiclesTable) return;

    // Clear safely
    while (vehiclesTable.firstChild) vehiclesTable.removeChild(vehiclesTable.firstChild);

    // 1. HEADER DE LA TABLE (Mise à jour des colonnes)
    const thead = vehiclesTable.closest('table').querySelector('thead');
    if (thead) {
        thead.innerHTML = `
            <tr class="bg-gray-50">
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Équipe</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Véhicule</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mode & Durée</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chauffeur</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
            </tr>
        `;
    }

    // 2. CORPS DE LA TABLE (Dispatch par équipe)
    const vehicleByTeam = currentRequirements.vehicles?.byTeam || {};

    if (Object.keys(vehicleByTeam).length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="5" class="px-6 py-8 text-center text-gray-400 italic">Aucun véhicule requis pour la configuration actuelle.</td>`;
        vehiclesTable.appendChild(row);
    }

    Object.entries(vehicleByTeam).forEach(([teamType, data]) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors border-b border-gray-100';

        const acqLabel = data.acquisitionMode === 'rental' ? 'Location' :
            data.acquisitionMode === 'achat_direct' ? 'Achat' : 'Inventaire';
        const acqClass = data.acquisitionMode === 'rental' ? 'bg-blue-50 text-blue-700' :
            data.acquisitionMode === 'achat_direct' ? 'bg-green-50 text-green-700' : 'bg-purple-50 text-purple-700';

        row.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-500">
                        <i class="fas fa-users-cog"></i>
                    </div>
                    <span class="font-semibold text-gray-900">${teamType}</span>
                </div>
            </td>
            <td class="px-6 py-4 text-gray-600 capitalize">
                <i class="fas ${data.type === 'motorcycle' ? 'fa-motorcycle' : 'fa-truck-pickup'} mr-2"></i>
                ${data.type} (x${data.count})
            </td>
            <td class="px-6 py-4">
                <div class="flex flex-col gap-1">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold self-start ${acqClass}">${acqLabel}</span>
                    <span class="text-xs text-gray-400">${data.duration} jours d'usage</span>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="text-xs ${data.needsDriver && !data.driverFlexible ? 'text-indigo-600 font-medium' : 'text-gray-400'}">
                    ${data.needsDriver ? (data.driverFlexible ? 'Conduite Autonome' : 'Chauffeur Dédié') : 'Non requis'}
                </span>
            </td>
            <td class="px-6 py-4">
                <button onclick="renderTeamsTab(); document.querySelector('[data-tab=\\'teams\\']').click();" 
                        class="text-xs text-gray-400 hover:text-indigo-600 border border-gray-200 px-2 py-1 rounded">
                    Configurer
                </button>
            </td>
        `;
        vehiclesTable.appendChild(row);
    });

    // Équipements par équipe (utiliser teamTemplates pour avoir la structure complète)
    const equipmentConfig = document.getElementById('equipmentConfig');
    // Clear safely
    while (equipmentConfig.firstChild) equipmentConfig.removeChild(equipmentConfig.firstChild);

    Object.entries(teamTemplates).forEach(([type, template]) => {
        const allEquipment = getAllEquipmentFromTemplate(template);

        const card = document.createElement('div');
        card.className = 'p-5 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-shadow';

        // Header section
        const headerDiv = document.createElement('div');
        headerDiv.className = 'flex justify-between items-start mb-3';

        const title = document.createElement('h4');
        title.className = 'font-bold text-gray-800 uppercase text-sm tracking-wide';
        title.textContent = type;
        headerDiv.appendChild(title);

        const capacitySpan = document.createElement('span');
        capacitySpan.className = 'text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-semibold';
        capacitySpan.textContent = `${template.dailyCapacity} / jour`;
        headerDiv.appendChild(capacitySpan);

        card.appendChild(headerDiv);

        // Equipment section
        if (template.equipmentCategories) {
            const categoriesDiv = document.createElement('div');
            categoriesDiv.className = 'space-y-2 mb-3';

            Object.entries(template.equipmentCategories).forEach(([categoryName, categoryData]) => {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'border-l-2 border-indigo-200 pl-2';

                const categoryTitle = document.createElement('div');
                categoryTitle.className = 'text-[10px] font-bold text-gray-500 mb-1';
                categoryTitle.textContent = `${categoryData.icon || '🔧'} ${categoryName}`;
                categoryDiv.appendChild(categoryTitle);

                const itemsDiv = document.createElement('div');
                itemsDiv.className = 'flex flex-wrap gap-1';

                (categoryData.items || []).forEach(item => {
                    const itemSpan = document.createElement('span');
                    itemSpan.className = 'px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] border border-gray-200';
                    itemSpan.textContent = item;
                    itemsDiv.appendChild(itemSpan);
                });

                categoryDiv.appendChild(itemsDiv);
                categoriesDiv.appendChild(categoryDiv);
            });

            card.appendChild(categoriesDiv);
        } else {
            const simpleDiv = document.createElement('div');
            simpleDiv.className = 'flex flex-wrap gap-2 mb-3';

            allEquipment.forEach(item => {
                const itemSpan = document.createElement('span');
                itemSpan.className = 'px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs border border-gray-200';
                itemSpan.textContent = item;
                simpleDiv.appendChild(itemSpan);
            });

            card.appendChild(simpleDiv);
        }

        // Footer section
        const footerDiv = document.createElement('div');
        footerDiv.className = 'pt-2 border-t border-gray-100 text-[10px] text-gray-400 italic';
        footerDiv.textContent = `Ratio : 1 kit par équipe · Total: ${allEquipment.length} items`;
        card.appendChild(footerDiv);

        equipmentConfig.appendChild(card);
    });
}

// Make renderRequirementsTab available globally as refreshRequirementsBilan for compatibility
async function renderRequirementsTab() {
    try {
        if (!currentProject) {
            console.warn('Cannot render requirements: project not loaded');
            return;
        }
        // Validation basique de la BDD avant calcul
        if (!window.db || !window.db.isOpen()) {
            console.warn('DB not ready in renderRequirementsTab, skipping calculation.');
            currentRequirements = {}; // Fallback empty
        } else {
            // Note: currentRequirements a déjà été calculé dans loadProjectData()
            if (!currentRequirements || Object.keys(currentRequirements).length === 0) {
                try {
                    if (window.ResourceAllocationService) {
                        currentRequirements = await ResourceAllocationService.calculateGlobalRequirements(currentProject, currentTeams);
                    }
                } catch (e) {
                    console.error("Error calculating requirements:", e);
                }
            }
        }

        let hasCalculationError = !currentRequirements;
        // Set default values if calculation failed or returned empty
        if (!currentRequirements || Object.keys(currentRequirements).length === 0) {
            currentRequirements = {
                totalHouseholds: 0,
                duration: currentProject.duration || 180,
                teams: {},
                vehicles: {},
                equipment: {},
                support: {},
                fuel: { totalCost: 0 }
            };
        }

        // Get households count safely
        let totalHouseholds = 0;
        try {
            const households = await HouseholdRepository.getAll();
            totalHouseholds = households.length;
            // Update currentRequirements with actual household count if available
            if (currentRequirements) currentRequirements.totalHouseholds = totalHouseholds;
        } catch (err) {
            console.warn('Could not get households count:', err);
        }

        const requirementsContainer = document.getElementById('content-requirements');
        if (!requirementsContainer) return;

        // 1. Nettoyage et Reconstruction du Layout
        // On vide le conteneur pour une reconstruction propre
        // 2. Remplissage des tableaux
        const purchaseTableBody = document.querySelector('#req-table-purchase tbody');
        const rentalTableBody = document.querySelector('#req-table-rental tbody');
        const stockTableBody = document.querySelector('#req-table-stock tbody');

        if (purchaseTableBody) purchaseTableBody.innerHTML = '';
        if (rentalTableBody) rentalTableBody.innerHTML = '';
        if (stockTableBody) stockTableBody.innerHTML = '';

        // A. Location (Véhicules)
        if (currentRequirements.vehicles && rentalTableBody) {
            Object.entries(currentRequirements.vehicles).forEach(([type, data]) => {
                const countReal = Math.ceil(data.current || 0);
                const countTarget = Math.ceil(data.required || 0);
                if (countReal <= 0 && countTarget <= 0) return;

                let dailyRate = (currentProject.costs?.vehicleRental?.[type]) || (type === 'pickup' ? 35000 : type === 'truck' ? 65000 : 5000);
                // Utiliser la durée spécifique de l'équipe calculée par le service
                const teamData = (currentRequirements.vehicles?.byTeam || {})[getNormalizedTeamType(type)] || {};
                const duration = teamData.duration || currentProject.duration || 180;

                const totalCostReal = countReal * dailyRate * duration;
                const totalCostTarget = countTarget * dailyRate * duration;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-4 py-3 text-sm text-gray-900 font-medium capitalize flex items-center">
                        <i class="fas fa-truck mr-2 text-blue-500"></i> ${type === 'truck' ? 'Camion' : (type === 'pickup' ? 'Pick-up' : type)}
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600">
                        <span class="font-bold text-indigo-600">${countReal}</span> / <span class="text-gray-400">${countTarget}</span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600">
                        ${new Intl.NumberFormat('fr-FR').format(dailyRate)}/j
                    </td>
                    <td class="px-4 py-3 text-right text-sm">
                        <div class="font-bold text-gray-900">${new Intl.NumberFormat('fr-FR').format(totalCostReal)} F</div>
                        <div class="text-[10px] text-gray-400">Cible: ${new Intl.NumberFormat('fr-FR').format(totalCostTarget)} F</div>
                    </td>
                `;
                rentalTableBody.appendChild(tr);
            });
        }

        // C. Maintenance & Carburant (OPEX Additionnels)
        if (currentRequirements.budget?.target?.opex) {
            const opex = currentRequirements.budget.target.opex;

            // Carburant
            const fuelRow = document.createElement('tr');
            fuelRow.innerHTML = `
                <td class="px-4 py-3 text-sm text-gray-900 font-medium capitalize flex items-center">
                    <i class="fas fa-gas-pump mr-2 text-amber-500"></i> Carburant (Calcul Proratisé)
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">-</td>
                <td class="px-4 py-3 text-sm text-gray-600">-</td>
                <td class="px-4 py-3 text-right text-sm font-bold text-gray-900">
                    ${new Intl.NumberFormat('fr-FR').format(opex.fuel)} F
                </td>
            `;
            rentalTableBody.appendChild(fuelRow);

            // Maintenance
            if (opex.maintenance > 0) {
                const maintRow = document.createElement('tr');
                maintRow.innerHTML = `
                    <td class="px-4 py-3 text-sm text-gray-900 font-medium capitalize flex items-center">
                        <i class="fas fa-tools mr-2 text-orange-500"></i> Maintenance (Flotte Acquis/Stock)
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600">-</td>
                    <td class="px-4 py-3 text-sm text-gray-600">-</td>
                    <td class="px-4 py-3 text-right text-sm font-bold text-gray-900">
                        ${new Intl.NumberFormat('fr-FR').format(opex.maintenance)} F
                    </td>
                `;
                rentalTableBody.appendChild(maintRow);
            }
        }
        if (currentRequirements.equipment && purchaseTableBody) {
            Object.entries(currentRequirements.equipment).forEach(([itemName, data]) => {
                const qtyReal = data.current || 0;
                const qtyTarget = data.required || 0;
                if (qtyReal <= 0 && qtyTarget <= 0) return;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="px-4 py-3 text-sm text-gray-900 font-medium flex items-center">
                        <span class="mr-2">${data.icon || '🛠️'}</span> ${itemName}
                    </td>
                    <td class="px-4 py-3 text-sm">
                        <span class="font-bold text-green-600">${qtyReal}</span> / <span class="text-gray-400">${qtyTarget}</span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-400">
                        Kit Complet
                    </td>
                    <td class="px-4 py-3 text-right text-xs text-gray-500 italic">
                        Inclus dans presta.
                    </td>
                `;
                purchaseTableBody.appendChild(tr);
            });
        }

        // C. Ressources Humaines (Teams Summary)
        const teamsContainer = document.getElementById('requirements-teams-container');
        if (teamsContainer) {
            teamsContainer.innerHTML = '';

            // On affiche le budget RÉEL vs CIBLE en haut
            const budgetHeader = document.createElement('div');
            budgetHeader.className = 'col-span-full bg-indigo-50 p-4 rounded-lg border border-indigo-100 mb-4 flex justify-between items-center';
            budgetHeader.innerHTML = `
                <div>
                    <h4 class="font-bold text-indigo-900">Budget Prestation (Configuration Actuelle)</h4>
                    <p class="text-xs text-indigo-700">Calculé sur ${currentProject.duration || 180} jours</p>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-black text-indigo-900">${new Intl.NumberFormat('fr-FR').format(currentRequirements.budget?.current?.total || 0)} FCFA</div>
                    <div class="text-xs text-indigo-400 italic">Cible recommandée: ${new Intl.NumberFormat('fr-FR').format(currentRequirements.budget?.target?.total || 0)} FCFA</div>
                </div>
            `;
            teamsContainer.appendChild(budgetHeader);

            Object.entries(currentRequirements.teams || {}).forEach(([type, data]) => {
                const countReal = data.current || 0;
                const countTarget = data.required || 0;

                const normalizedType = ResourceAllocationService.getNormalizedType(type);
                const roleId = ResourceAllocationService.getRoleId(type);
                const staffConfig = currentProject.staffConfig?.[roleId] || {};

                const card = document.createElement('div');
                card.className = `p-4 rounded-lg border ${countReal >= countTarget ? 'bg-green-50 border-green-100' : 'bg-white border-gray-200 shadow-sm'}`;
                card.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <div class="font-bold text-gray-800">${normalizedType}</div>
                        <div class="text-right">
                            <span class="text-lg font-black ${countReal > 0 ? 'text-indigo-600' : 'text-gray-400'}">${countReal}</span>
                            <span class="text-xs text-gray-400">/ ${countTarget} requis</span>
                        </div>
                    </div>
                    <div class="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">
                        Coût: ${new Intl.NumberFormat('fr-FR').format(currentRequirements.budget?.current?.details?.teams?.[type] || 0)} F
                    </div>
                    <div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-indigo-500 h-full transition-all duration-500" style="width: ${Math.min(100, (countReal / countTarget) * 100)}%"></div>
                    </div>
                `;
                teamsContainer.appendChild(card);
            });
        }

    } catch (err) {
        handleUiError(err, { scope: 'renderRequirementsTab' }, 'Calcul des besoins impossible');
    }
}

// Make globally available for persistence system
window.refreshRequirementsBilan = renderRequirementsTab;

/**
 * Auto-calcul équipes en fonction du total ménages et de la durée cible.
 * Stocke le besoin dans teamCapabilities.required et rafraîchit le bilan.
 */
async function autoCalculateTeams() {
    try {
        let total = currentProject.totalHouses || currentProject.totalHouseholds || currentProject.total || 0;
        if (!total && window.householdRepository?.count) {
            try {
                total = await window.householdRepository.count();
                _lastDbHouseholdCount = total;
                currentProject.totalHouses = total;
                await ProjectRepository.updateProjectParameters({ totalHouses: total });
            } catch (e) {
                console.warn('Impossible de récupérer le total en base pour auto-calc', e);
            }
        }
        const duration = currentProject.duration || 180;
        const caps = { ...(currentProject.teamCapabilities || {}) };
        const defaultProd = window.DEFAULT_PRODUCTIVITY || {};
        const prod = {
            preparateurs: defaultProd.preparateurs || 50,
            livreur: defaultProd.livreur || 30,
            macons: defaultProd.macons || defaultProd.macon || 3,
            reseau: defaultProd.reseau || 4,
            interieur: defaultProd.interieur || 5,
            controleur: defaultProd.controle || 15
        };

        // Hydrate productivity with current capabilities
        Object.entries(caps).forEach(([key, cap]) => {
            const low = key.toLowerCase();
            const dailyCap = cap.daily || cap.dailyCapacity;
            if (TEAM_KEY_MAP.macons.some(k => low.includes(k))) prod.macons = dailyCap || prod.macons;
            if (TEAM_KEY_MAP.reseau.some(k => low.includes(k))) prod.reseau = dailyCap || prod.reseau;
            if (TEAM_KEY_MAP.interieur.some(k => low.includes(k))) prod.interieur = dailyCap || prod.interieur;
            if (TEAM_KEY_MAP.controle.some(k => low.includes(k))) prod.controleur = dailyCap || prod.controleur;
            if (low.includes('prepar')) prod.preparateurs = dailyCap || prod.preparateurs;
            if (low.includes('livr')) prod.livreur = dailyCap || prod.livreur;
        });

        const suggestions = ResourceAllocationService.suggestTeamsFull(total, duration, prod);

        // Ensure capability entries exist for all standard roles
        // calcul du besoin + durée d'intervention par type
        const currentCountByType = {};
        currentTeams.forEach(t => {
            const norm = getNormalizedTeamType(t.type).toLowerCase();
            currentCountByType[norm] = (currentCountByType[norm] || 0) + 1;
        });

        const ensureCap = (key, daily) => {
            const low = key.toLowerCase();
            if (!caps[low]) caps[low] = { daily: daily, equipment: [] };
            if (!caps[low].daily) caps[low].daily = daily;
            const teamCount = Math.max(1, currentCountByType[low] || suggestions[key] || 1);
            caps[low].required = suggestions[key];
            caps[low].interventionDays = Math.ceil(total / Math.max(1e-6, caps[low].daily * teamCount));
            // conserver startDate si déjà présent, sinon fallback start projet
            if (!caps[low].startDate && currentProject.startDate) {
                caps[low].startDate = currentProject.startDate;
            }
        };

        ensureCap('preparateurs', prod.preparateurs);
        ensureCap('livreur', prod.livreur);
        ensureCap('macons', prod.macons);
        ensureCap('reseau', prod.reseau);
        ensureCap('interieur', prod.interieur);
        ensureCap('controleur', prod.controleur);
        ensureCap('superviseur', prod.superviseur || 10);

        // sync templates from capabilities to ensure UI shows per-type durations
        Object.entries(caps).forEach(([key, cap]) => {
            const normCap = getNormalizedTeamType(key).toLowerCase();
            const tmplKey = Object.keys(teamTemplates).find(tk => getNormalizedTeamType(tk).toLowerCase() === normCap);
            if (tmplKey) {
                teamTemplates[tmplKey].dailyCapacity = cap.daily || cap.dailyCapacity || teamTemplates[tmplKey].dailyCapacity;
                teamTemplates[tmplKey].interventionDays = cap.interventionDays || teamTemplates[tmplKey].interventionDays || duration;
                if (cap.startDate) teamTemplates[tmplKey].startDate = cap.startDate;
            }
        });

        // Calculer la durée totale du projet: min start / max end
        const startsEnds = Object.entries(caps).map(([k, cap]) => {
            const start = new Date(cap.startDate || currentProject.startDate || currentProject.start || new Date());
            const days = cap.interventionDays || duration;
            const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
            return { start, end };
        });
        if (startsEnds.length > 0) {
            const minStart = new Date(Math.min(...startsEnds.map(se => se.start.getTime())));
            const maxEnd = new Date(Math.max(...startsEnds.map(se => se.end.getTime())));
            const totalDuration = Math.max(1, Math.ceil((maxEnd - minStart) / (24 * 60 * 60 * 1000)));
            currentProject.duration = totalDuration;
            await ProjectRepository.updateProjectParameters({
                duration: totalDuration,
                startDate: currentProject.startDate || minStart.toISOString().slice(0, 10)
            });
            const durationInput = document.getElementById('projectDuration');
            if (durationInput) durationInput.value = totalDuration;
        }

        const summary = [
            `Préparateurs: ${suggestions.preparateurs}`,
            `Livreurs: ${suggestions.livreur}`,
            `Maçons: ${suggestions.macons}`,
            `Réseau: ${suggestions.reseau}`,
            `Intérieur: ${suggestions.interieur}`,
            `Contrôle: ${suggestions.controleur}`,
            `Superviseurs: ${suggestions.superviseur}`
        ];

        await ProjectRepository.updateProjectParameters({ teamCapabilities: caps, _autoTeamsTimestamp: new Date().toISOString() });
        currentProject.teamCapabilities = caps;

        renderRequirementsTab();
        if (typeof updateTeamStats === 'function') updateTeamStats();
        updateHouseholdCounters(total);

        const msg = `Besoin estimé (durée ${duration} j, ${total} ménages):\n- ${summary.join('\n- ')}`;
        if (window.Swal) await Swal.fire({ icon: 'success', title: 'Auto-calcul effectué', text: msg });
        else alert(msg);
    } catch (e) {
        console.error('Auto-calc teams failed', e);
        if (window.Swal) Swal.fire('Erreur', e.message, 'error'); else alert(e.message);
    }
}

document.getElementById('autoTeamsBtn')?.addEventListener('click', autoCalculateTeams);

// --- Sync ménages projet <-> base ---
async function syncHouseholdsWithDb() {
    try {
        const count = await window.householdRepository.count();
        await ProjectRepository.updateProjectParameters({ totalHouses: count, _syncedAt: new Date().toISOString() });
        currentProject.totalHouses = count;
        updateHouseholdCounters(count);
        renderRequirementsTab();
        if (window.Swal) Swal.fire('Synchronisé', `Total projet mis à ${count} ménages`, 'success');
    } catch (e) {
        console.error('Sync ménages échoué', e);
        if (window.Swal) Swal.fire('Erreur', e.message, 'error'); else alert(e.message);
    }
}

function updateHouseholdCounters(dbCount) {
    const dbEl = document.getElementById('dbHouseholdCount');
    const projEl = document.getElementById('projectHouseholdTotal');
    const inputTotal = document.getElementById('projectTotalHouses');
    if (dbEl) dbEl.textContent = (dbCount !== undefined && dbCount !== null && dbCount !== '-') ? dbCount.toLocaleString() : '-';
    const projVal = currentProject.totalHouses || currentProject.total || 0;
    if (projEl) projEl.textContent = projVal ? projVal.toLocaleString() : '-';
    if (inputTotal) {
        const val = projVal || dbCount || 0;
        inputTotal.value = (val !== '-' && !isNaN(val)) ? val : 0;
        inputTotal.setAttribute('readonly', 'readonly');
    }
}

async function refreshDbHouseholdCount() {
    try {
        const count = await window.householdRepository.count();
        _lastDbHouseholdCount = count;
        updateHouseholdCounters(count);
    } catch (e) {
        updateHouseholdCounters('-');
    }
}

document.getElementById('syncHouseholdsBtn')?.addEventListener('click', syncHouseholdsWithDb);

// Init counters on load
refreshDbHouseholdCount();

window.toggleCollapsible = function (header) {
    if (!header) return;
    const content = header.nextElementSibling;
    const icon = header.querySelector('i');

    if (!content) return;

    const isHidden = content.classList.contains('hidden');

    if (isHidden) {
        content.classList.remove('hidden');
        if (icon) icon.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        if (icon) icon.style.transform = 'rotate(0deg)';
    }
};

async function exportToExcel() {
    const workbook = XLSX.utils.book_new();
    const totalHouses = await HouseholdRepository.count() || 80000;

    // 1. Feuille "Configuration Équipes"
    const teamsConfig = [
        ['Type', 'Capacité/Jour', 'Coût/Jour (FCFA)', 'Période Projet (Jours)', 'Équipes Actuelles', 'Besoins', 'Écart', 'Équipements']
    ];

    Object.entries(teamTemplates).forEach(([type, template]) => {
        const teamsOfType = currentTeams.filter(t => t.type === type);
        const requiredTeams = Math.ceil(totalHouses / (template.dailyCapacity * (currentProject.duration || 180)));

        teamsConfig.push([
            type,
            template.dailyCapacity,
            template.costPerDay,
            currentProject.duration || 180,
            teamsOfType.length,
            requiredTeams,
            requiredTeams - teamsOfType.length,
            (template.equipment || []).join(', ')
        ]);
    });

    const teamsSheet = XLSX.utils.aoa_to_sheet(teamsConfig);
    XLSX.utils.book_append_sheet(workbook, teamsSheet, "Synthèse Équipes");

    // 2. Feuille "Configuration Équipes" (NEW) (Renommée pour éviter conflit)
    const teamConfigData = [
        ['CONFIGURATION DÉTAILLÉE DES ÉQUIPES'],
        [''],
        ['TYPE ÉQUIPE', 'CAPACITÉ/J', 'COUT/J', 'VÉHICULE', 'ACQUISITION', 'ÉQUIPEMENTS']
    ];
    Object.entries(teamTemplates).forEach(([type, template]) => {
        teamConfigData.push([
            type,
            template.dailyCapacity,
            template.costPerDay,
            template.vehicleType === 'none' ? 'Aucun' : template.vehicleType,
            template.acquisitionMode === 'location' ? 'Location' : 'Achat',
            (template.equipment || []).join(', ')
        ]);
    });
    const teamConfigSheet = XLSX.utils.aoa_to_sheet(teamConfigData);
    XLSX.utils.book_append_sheet(workbook, teamConfigSheet, "Détails Configuration");

    // 3. Feuille "Bilan des Besoins"
    const globalData = [
        ['BILAN GLOBAL DES BESOINS LOGISTIQUES'],
        ['Projet', currentProject.name],
        ['Date d\'exportation', new Date().toLocaleString()],
        ['Ménages Totaux', totalHouses],
        ['Durée du projet', `${currentProject.duration || 180} jours`],
        [''],
        ['VÉHICULES & TRANSPORT'],
        ['Type', 'Actuel', 'Requis', 'Écart'],
        ...Object.entries(currentRequirements.vehicles).map(([type, data]) => [
            type.toUpperCase(), data.current, data.required, data.gap
        ]),
        [''],
        ['CARBURANT ESTIMÉ', '', '', (currentRequirements.fuel?.totalCost || 0).toLocaleString() + ' F'],
        [''],
        ['PERSONNEL DE SUPPORT'],
        ['Rôle', 'Requis', 'Description'],
        ...Object.entries(currentRequirements.support || {}).map(([role, data]) => [
            role, data.required, data.description
        ]),
        [''],
        ['ÉQUIPEMENTS & MATÉRIEL'],
        ['Équipement', 'Quantité Totale'],
        ...Object.entries(currentRequirements.equipment).map(([item, count]) => [
            item, count
        ])
    ];
    const globalSheet = XLSX.utils.aoa_to_sheet(globalData);
    XLSX.utils.book_append_sheet(workbook, globalSheet, "Bilan Global");

    XLSX.writeFile(workbook, `Bilan_Besoins_Detailles_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text("BILAN DES BESOINS LOGISTIQUES", 105, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(156, 163, 175); // Gray-400
    doc.setFont("helvetica", "normal");
    doc.text(`Généré le: ${new Date().toLocaleString()}`, 105, 28, { align: 'center' });

    doc.setDrawColor(229, 231, 235);
    doc.line(20, 35, 190, 35);

    // Section Équipes
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text("1. Besoins en Équipes de Terrain", 20, 45);

    const teamsData = Object.entries(currentRequirements.teams).map(([type, data]) => [
        type, data.current, data.required, data.gap > 0 ? `+${data.gap}` : "OK"
    ]);

    doc.autoTable({
        startY: 50,
        head: [['Métier', 'Effectif Actuel', 'Cible', 'Écart']],
        body: teamsData,
        theme: 'striped',
        headStyles: { fillStyle: [79, 70, 229] }
    });

    // Section Véhicules
    doc.text("2. Flotte de Véhicules de Projet", 20, doc.lastAutoTable.finalY + 15);
    const vehiclesData = Object.entries(currentRequirements.vehicles).map(([type, data]) => [
        type, data.current, data.required, data.gap > 0 ? `+${data.gap}` : "OK"
    ]);

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Véhicule', 'Disponibles', 'Requis', 'Écart']],
        body: vehiclesData,
        theme: 'striped',
        headStyles: { fillStyle: [79, 70, 229] }
    });

    // Section Équipements
    doc.text("3. Inventaire des Équipements et Consommables", 20, doc.lastAutoTable.finalY + 15);
    const equipmentData = Object.entries(currentRequirements.equipment).map(([item, count]) => [item, count]);

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 20,
        head: [['Équipement / Outils', 'Quantité']],
        body: equipmentData,
        theme: 'striped',
        headStyles: { fillStyle: [79, 70, 229] }
    });

    doc.save(`Bilan_Besoin_Logistique_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// Fonction pour éditer un véhicule
window.editVehicle = function (type) {
    Swal.fire({
        title: `Configuration du Véhicule : ${type.toUpperCase()}`,
        html: `
            <div class="text-left space-y-4 p-2">
                <div class="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 mb-4 border border-blue-100 italic">
                    Ajustez les paramètres techniques pour affiner le calcul des coûts logistiques globaux.
                </div>
                <div class="form-group mb-4">
                    <label class="block text-sm font-semibold text-gray-700 mb-1">Stock Disponible</label>
                    <input id="swal-count" type="number" class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" value="${currentProject.logistics.vehicles[type].count || 0}">
                </div>
                <div class="form-group mb-4">
                    <label class="block text-sm font-semibold text-gray-700 mb-1">Capacité Transport (Personnes)</label>
                    <input id="swal-capacity" type="number" class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" value="${currentProject.logistics.vehicles[type].capacity || 1}">
                </div>
                <div class="form-group">
                    <label class="block text-sm font-semibold text-gray-700 mb-1">Consommation moyenne (L/100km)</label>
                    <input id="swal-consumption" type="number" step="0.1" class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500" value="${currentProject.logistics.vehicles[type].fuelConsumption || 0}">
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Appliquer les changements',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#4f46e5',
        preConfirm: () => {
            const count = parseInt(document.getElementById('swal-count').value);
            const capacity = parseInt(document.getElementById('swal-capacity').value);
            const consumption = parseFloat(document.getElementById('swal-consumption').value);

            if (isNaN(count) || isNaN(capacity) || isNaN(consumption)) {
                Swal.showValidationMessage('Veuillez saisir des valeurs numériques valides');
                return false;
            }

            return { count, capacity, consumption };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const updates = {
                logistics: {
                    vehicles: {
                        [type]: {
                            count: result.value.count,
                            capacity: result.value.capacity,
                            fuelConsumption: result.value.consumption
                        }
                    }
                }
            };

            await ProjectRepository.updateProjectParameters(updates);
            await loadProjectData();
            renderLogisticsTab();
            renderRequirementsTab();
            Swal.fire({
                title: 'Mis à jour',
                icon: 'success',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    });
};



window.openAddEquipmentModal = async function (type, category) {
    const { value: itemName } = await Swal.fire({
        title: 'Nouvel équipement',
        html: `<p class="text-sm text-gray-500 mb-4">Ajouter un élément à <strong>${category}</strong></p>`,
        input: 'text',
        inputPlaceholder: 'Nom de l\'équipement...',
        showCancelButton: true,
        confirmButtonText: 'Ajouter',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#4f46e5',
        inputValidator: (value) => {
            if (!value) {
                return 'Le nom est requis !'
            }
        }
    });

    if (itemName) {
        // Reuse the robust logic from addEquipmentToCategory (which now handles persistence and rendering)
        // We need an input element ID for the function, so we create a dummy one or refactor.
        // Refactoring is cleaner. Let's make addEquipmentToCategory accept a name string optionally.
        // But since we can't change the signature easily in a multi-replace safely without creating a mess,
        // let's just duplicate the persistence logic here for safety and speed.

        if (teamTemplates[type] && teamTemplates[type].equipmentCategories && teamTemplates[type].equipmentCategories[category]) {
            if (!teamTemplates[type].equipmentCategories[category].items.includes(itemName)) {
                teamTemplates[type].equipmentCategories[category].items.push(itemName);

                // Collect all equipment for persistence
                const allEquipment = [];
                Object.values(teamTemplates[type].equipmentCategories).forEach(cat => {
                    if (cat.items) allEquipment.push(...cat.items);
                });

                // Persister dans le projet
                const caps = { ...currentProject.teamCapabilities };
                const key = type.toLowerCase();
                if (!caps[key]) caps[key] = { daily: teamTemplates[type].dailyCapacity, equipment: [] };
                caps[key].equipment = allEquipment;

                try {
                    await ProjectRepository.updateProjectParameters({ teamCapabilities: caps });
                    await loadProjectData();
                    window.debouncedRenderTeams();
                    renderAssetCosts();
                    renderRequirementsTab();

                    const toast = Swal.mixin({
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });
                    toast.fire({
                        icon: 'success',
                        title: 'Équipement ajouté'
                    });
                } catch (err) {
                    handleUiError(err, { scope: 'saveEquipment', type });
                }
            }
        }
    }
};

// Fonction pour éditer le mode de paiement d'une équipe existante
// Fonction pour éditer le mode de paiement d'une équipe existante
window.editPaymentMode = async function (teamType) {
    const roleId = getTeamRoleId(teamType);
    const currentConfig = currentProject.staffConfig?.[roleId] || { mode: 'daily', amount: 0 };
    const currentCost = currentProject.costs?.[roleId] || currentConfig.amount;

    const result = await Swal.fire({
        title: `Modifier la Tarification - ${teamType}`,
        html: `
            <div class="text-left space-y-4 p-2">
                <div class="form-group">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Mode de Tarification</label>
                    <select id="swal-edit-payment-mode" class="w-full p-2 border rounded">
                        <option value="daily" ${currentConfig.mode === 'daily' ? 'selected' : ''}>Journalier (FCFA/jour)</option>
                        <option value="task" ${currentConfig.mode === 'task' ? 'selected' : ''}>À la tâche (FCFA/tâche)</option>
                        <option value="monthly" ${currentConfig.mode === 'monthly' ? 'selected' : ''}>Mensuel (FCFA/mois)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Tarif de Prestation (FCFA)</label>
                    <input id="swal-edit-cost" type="number" class="w-full p-2 border rounded" value="${currentCost}">
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Enregistrer',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#4f46e5',
        preConfirm: () => {
            return {
                mode: document.getElementById('swal-edit-payment-mode').value,
                amount: parseInt(document.getElementById('swal-edit-cost').value) || 0
            };
        }
    });

    if (result.isConfirmed) {
        const { mode, amount } = result.value;

        // Mettre à jour staffConfig et costs
        const updates = {
            staffConfig: {
                ...currentProject.staffConfig,
                [roleId]: {
                    mode: mode,
                    amount: amount
                }
            },
            costs: {
                ...currentProject.costs,
                [roleId]: amount
            }
        };

        const success = await saveProjectState(updates, { reload: true, refreshUI: true, silent: false });

        if (success) {
            // Force refresh of the teams tab (debounced)
            window.debouncedRenderTeams();
            // Also refresh other affected tabs
            if (typeof renderRequirementsTab === 'function') renderRequirementsTab();

            await Swal.fire({
                title: 'Succès',
                text: `Tarification mise à jour pour "${teamType}"`,
                icon: 'success',
                toast: true,
                position: 'top-end',
                timer: 2000,
                showConfirmButton: false
            });
        }
    }
};

// --- Gestion de l'Onglet Données & Sauvegardes ---

const initDataTab = () => {
    // 1. Initialiser ImportManager
    if (window.ImportManager) {
        if (!window._importManagerInstance) {
            window._importManagerInstance = new window.ImportManager();
            console.log('✅ ImportManager initialized for Data Tab');
        }
    } else {
        console.warn('⚠️ ImportManager not found. Ensure import_manager.js is loaded.');
    }

    // 2. Initialiser BackupService UI
    if (window.backupService) {
        const timeEl = document.getElementById('lastAutoBackupTime');
        const config = window.backupService.getConfig();
        if (timeEl && config.lastBackupDate) {
            timeEl.textContent = new Date(config.lastBackupDate).toLocaleString();
        }
    }

    // 3. Initialiser RestoreService Handler
    window.handleRestoreFile = async (file) => {
        if (!file) return;

        if (!window.RestoreService) {
            handleUiError(new Error('Service de restauration non disponible'), { scope: 'restore' }, 'Erreur');
            return;
        }

        const confirm = await Swal.fire({
            title: 'Êtes-vous sûr ?',
            text: "Cette action REMPLACERA toutes vos données actuelles. Assurez-vous d'avoir une sauvegarde.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Oui, restaurer !'
        });

        if (confirm.isConfirmed) {
            try {
                Swal.fire({
                    title: 'Restauration en cours...',
                    text: 'Veuillez patienter',
                    allowOutsideClick: false,
                    didOpen: () => Swal.showLoading()
                });

                const service = new window.RestoreService(window.db, null, console);
                const result = await service.restoreFromFile(file);

                if (result.success) {
                    service.showRestoreSummary(result.stats);

                    // Reload UI after Restore
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                }
            } catch (err) {
                handleUiError(err, { scope: 'restore' }, 'Échec de la restauration');
            }
        }

        // Reset input
        document.getElementById('restoreInput').value = '';
    };

    // 4. Initialiser Reset Handler
    window.confirmResetAll = async () => {
        const confirm = await Swal.fire({
            title: 'DANGER: Réinitialisation Totale',
            html: `Vous êtes sur le point de <strong>TOUT EFFACER</strong>.<br>
                   Cela supprimera :<br>
                   - Tous les ménages<br>
                   - Toutes les zones<br>
                   - Toute la configuration<br>
                   <br>
                   Tapez <strong>CONFIRMER</strong> pour continuer.`,
            input: 'text',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'TOUT EFFACER'
        });

        if (confirm.value === 'CONFIRMER') {
            await window.db.delete();
            await window.db.open();
            localStorage.clear();
            location.reload();
        }
    };
};

// --- Gestion des Grappes ---

window.renderGrappesTab = async function () {
    const container = document.getElementById('grappesContainer');
    const unassignedContainer = document.getElementById('unassignedZonesContainer');
    if (!container || !unassignedContainer) return;

    // S'assurer que la DB est accessible via window.db (Dexie)
    const allZones = await window.db.zones.toArray();
    const grappes = [...new Set(allZones.map(z => z.grappe).filter(g => g))];

    // Forcer l'affichage des grappes même si vides (depuis le projet)
    const project = await ProjectRepository.getCurrent();
    const projectGrappes = project.grappes || [];
    const combinedGrappes = [...new Set([...grappes, ...projectGrappes])];

    container.innerHTML = '';
    unassignedContainer.innerHTML = '';

    // Render Grappes
    combinedGrappes.forEach(grappeName => {
        const zonesInGrappe = allZones.filter(z => z.grappe === grappeName);
        const totalHouses = zonesInGrappe.reduce((sum, z) => sum + (z.totalHouses || 0), 0);

        const grappeCard = document.createElement('div');
        grappeCard.className = 'bg-gray-50 rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all';
        grappeCard.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h4 class="text-lg font-bold text-gray-900">${grappeName}</h4>
                    <p class="text-xs text-gray-500 uppercase tracking-wider">${zonesInGrappe.length} Village(s) • ${totalHouses} Ménages</p>
                </div>
                <button onclick="deleteGrappe('${grappeName}')" class="text-gray-400 hover:text-red-500 transition-colors">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
            <div class="space-y-2 mb-4 max-h-40 overflow-y-auto">
                ${zonesInGrappe.map(z => `
                    <div class="flex justify-between items-center text-sm bg-white p-2 rounded border border-gray-100">
                        <span class="text-gray-700 truncate mr-2" title="${z.name}">${z.name}</span>
                        <button onclick="removeFromGrappe('${z.id}')" class="text-gray-400 hover:text-orange-500">
                            <i class="fas fa-times-circle"></i>
                        </button>
                    </div>
                `).join('')}
                ${zonesInGrappe.length === 0 ? '<p class="text-xs text-gray-400 italic">Aucun village dans cette grappe</p>' : ''}
            </div>
            <div class="mt-4 pt-4 border-t border-gray-100">
                <select onchange="addToGrappe('${grappeName}', this.value)" class="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500">
                    <option value="">+ Ajouter un village...</option>
                    ${allZones.filter(z => !z.grappe).map(z => `<option value="${z.id}">${z.name}</option>`).join('')}
                </select>
            </div>
        `;
        container.appendChild(grappeCard);
    });

    // Render Unassigned Zones
    const unassigned = allZones.filter(z => !z.grappe);
    if (unassigned.length === 0) {
        unassignedContainer.innerHTML = '<span class="text-gray-400 italic text-sm">Tous les villages sont assignés à une grappe.</span>';
    } else {
        unassigned.forEach(zone => {
            const badge = document.createElement('div');
            badge.className = 'px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-700 flex items-center gap-2 hover:border-indigo-300 transition-colors cursor-default';
            badge.innerHTML = `
                <i class="fas fa-map-marker-alt text-gray-400"></i>
                ${zone.name}
            `;
            unassignedContainer.appendChild(badge);
        });
    }
};

window.addNewGrappe = async function () {
    const { value: name } = await Swal.fire({
        title: 'Nouvelle Grappe',
        input: 'text',
        inputLabel: 'Nom de la grappe (ex: Zone Nord, Axe Kaolack)',
        inputPlaceholder: 'Entrez le nom...',
        showCancelButton: true,
        confirmButtonText: 'Créer',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#4f46e5',
        inputValidator: (value) => {
            if (!value) return 'Le nom est requis !';
        }
    });

    if (name) {
        const project = await ProjectRepository.getCurrent();
        const grappes = project.grappes || [];
        if (!grappes.includes(name)) {
            grappes.push(name);
            await ProjectRepository.updateProjectParameters({ grappes });
            await renderGrappesTab();
            Swal.fire({ icon: 'success', title: 'Grappe créée', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
        } else {
            Swal.fire({ icon: 'error', title: 'Ce nom existe déjà' });
        }
    }
};

window.deleteGrappe = async function (name) {
    const confirm = await Swal.fire({
        title: `Supprimer la grappe "${name}" ?`,
        text: "Les villages de cette grappe redeviendront 'non assignés'.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Oui, supprimer'
    });

    if (confirm.isConfirmed) {
        const zones = await window.db.zones.where('grappe').equals(name).toArray();
        for (const z of zones) {
            await window.db.zones.update(z.id, { grappe: null });
        }

        const project = await ProjectRepository.getCurrent();
        const grappes = (project.grappes || []).filter(g => g !== name);
        await ProjectRepository.updateProjectParameters({ grappes });

        await renderGrappesTab();
        Swal.fire({ icon: 'success', title: 'Grappe supprimée', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
    }
};

window.addToGrappe = async function (grappeName, zoneId) {
    if (!zoneId) return;
    await window.db.zones.update(zoneId, { grappe: grappeName });
    await renderGrappesTab();
};

window.removeFromGrappe = async function (zoneId) {
    await window.db.zones.update(zoneId, { grappe: null });
    await renderGrappesTab();
};

// --- Event Listeners and Tab Logic ---

window.setupEventListeners = function () {
    const tabs = document.querySelectorAll('[data-tab]');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            toggleTab(tabId);
        });
    });
};

window.toggleTab = function (tabId) {
    // Hidden all contents
    document.querySelectorAll('[id^="content-"]').forEach(el => el.classList.add('hidden'));
    // Show target content
    const target = document.getElementById(`content-${tabId}`);
    if (target) target.classList.remove('hidden');

    // Update tab styles
    document.querySelectorAll('[data-tab]').forEach(tab => {
        if (tab.getAttribute('data-tab') === tabId) {
            tab.classList.add('border-indigo-500', 'text-indigo-600');
            tab.classList.remove('border-transparent', 'text-gray-500');
        } else {
            tab.classList.remove('border-indigo-500', 'text-indigo-600');
            tab.classList.add('border-transparent', 'text-gray-500');
        }
    });

    // Specific triggers
    if (tabId === 'grappes') renderGrappesTab();
    if (tabId === 'teams') renderTeamsTab();
};

window.updateInstanceParam = async function (teamId, field, value) {
    const team = await TeamRepository.getById(teamId);
    if (team) {
        team[field] = value;
        await TeamRepository.update(team);
        console.log(`Team ${teamId} updated: ${field} = ${value}`);
    }
};

window.toggleInstanceGrappe = async function (teamId, grappeName, isChecked) {
    const team = await TeamRepository.getById(teamId);
    if (team) {
        let grappes = team.assignedGrappes || [];
        if (isChecked && !grappes.includes(grappeName)) {
            grappes.push(grappeName);
        } else if (!isChecked) {
            grappes = grappes.filter(g => g !== grappeName);
        }
        team.assignedGrappes = grappes;
        await TeamRepository.update(team);
        console.log(`Team ${teamId} grappes: ${grappes.join(', ')}`);
    }
};

window.deleteTeamInstance = async function (teamId) {
    const confirm = await Swal.fire({
        title: 'Supprimer cette équipe ?',
        text: "Cette action est irréversible.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Oui, supprimer'
    });

    if (confirm.isConfirmed) {
        await TeamRepository.delete(teamId);
        await loadProjectData();
        window.debouncedRenderTeams();
    }
};

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', () => {
    // Si initUi existe déjà (dans init.js ou ailleurs), on ajoute notre initDataTab via timeout
    setTimeout(() => {
        initDataTab();
    }, 500);
});
