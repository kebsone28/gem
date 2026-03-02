/**
 * logistique_main.js — Logique principale de la page Gestion Logistique
 * ═══════════════════════════════════════════════════════════════════════
 * Ce fichier orchestre 6 onglets :
 *   1. Stock & Matériel  — Calcul du stock à partir des kits chargés (BOM)
 *   2. Livraisons        — Historique des visites terrain par agent/date
 *   3. Équipes & Agents  — Performance, badge d'activité, anomalies
 *   4. Atelier & Chargement — Saisie journalière + prédiction IA
 *   5. Grappes & Équipes — Affectation des sous-grappes aux équipes
 *
 * Sources de données :
 *   - window.householdRepository  → IndexedDB (tous les ménages)
 *   - window.projectRepository    → IndexedDB (config projet)
 *   - window.KIT_COMPOSITION      → src/config/kit-composition.js
 *   - window.GRAPPES_CONFIG       → src/config/grappes-config.js
 *   - window.PredictiveEngine     → src/domain/services/PredictiveEngine.js
 *   - window.projectService       → src/application/services/ProjectService.js
 */
(function () {
    'use strict';

    // ========== VARIABLES GLOBALES ==========
    // GrappeAssignmentModel is loaded via init.js and set to window during bootstrap
    // This variable assumes the global is already available (no fallback needed)
    /** @type {Array} Tous les ménages chargés depuis IndexedDB (rechargés à chaque actualisation). */
    let allHouseholds = [];
    /** @type {Object} Cache des instances de graphiques Chart.js (si utilisés). */
    let charts = {};

    /**
     * MATERIAL_LABELS — Mapping clé technique → libellé français
     * Utilisé pour afficher des colonnes matériel lisibles dans les tableaux.
     * Ces 7 catégories correspondent aux champs du formulaire KoboCollect.
     */
    const MATERIAL_LABELS = {
        cable_2_5mm: 'Câble 2.5mm² (m)',
        cable_4mm: 'Câble 4mm² (m)',
        coffrets: 'Coffrets',
        disjoncteurs: 'Disjoncteurs',
        ampoules: 'Ampoules',
        prises: 'Prises',
        interrupteurs: 'Interrupteurs'
    };

    /**
     * MATERIAL_COLORS — Couleur par catégorie matériel (format hex).
     * Utilisé pour la cohérence visuelle des cartes et graphiques.
     */
    const MATERIAL_COLORS = {
        cable_2_5mm: '#6366f1',
        cable_4mm: '#8b5cf6',
        coffrets: '#ec4899',
        disjoncteurs: '#f59e0b',
        ampoules: '#10b981',
        prises: '#3b82f6',
        interrupteurs: '#f97316'
    };

    /**
     * STATUS_COLORS — Couleur par statut de ménage (format hex).
     * Permet d'afficher des badges colorés cohérents dans tous les tableaux.
     * Les statuts correspondent au workflow terrain : Inéligible → Conforme.
     */
    const STATUS_COLORS = {
        'Conforme': '#22c55e',
        'Attente Maçon': '#f59e0b',
        'Attente Branchement': '#3b82f6',
        'Attente électricien': '#8b5cf6',
        'Attente Controleur': '#ec4899',
        'Attente démarrage': '#94a3b8',
        'Inéligible': '#ef4444',
        'Injoignable': '#6b7280',
        'Attente électricien(X)': '#dc2626'
    };

    // ========== INITIALISATION ==========
    /**
     * Point d'entrée principal — exécuté quand le DOM est prêt.
     * Ordre d'exécution :
     *   1. initTabs()    → active le système de navigation par onglet
     *   2. waitForDB()   → attend que la base IndexedDB (Dexie) soit ouverte
     *   3. loadData()    → charge les données et rend tous les onglets
     *   4. Listeners     → branche les boutons (actualiser, exporter, sauvegarder…)
     */
    // Initialize Industrial Module
    async function initGrappeModule() {
        if (!window.GrappeModule || !window.projectService) return;

        const config = window.GRAPPES_CONFIG;
        // Limit to 4 core trades for the 25% progression logic
        const coreTeamTypes = {
            MACONS: 'macons',
            RESEAU: 'reseau',
            INTERIEUR_TYPE1: 'interieur_type1',
            CONTROLE: 'controle'
        };

        window.grappeModuleController = window.GrappeModule.create(
            window.projectService,
            config,
            coreTeamTypes
        );
        console.log('🚀 GrappeModule initialized with core keys for progression');
    }

    document.addEventListener('DOMContentLoaded', async () => {
        initTabs(); // Renamed from setupTabs() to match existing function

        // Initialize Grappe UI module immediately so it's ready for loadData
        if (window.GrappeAssignmentUI) {
            window.GrappeAssignmentUI.init('grappeCardGrid', 'grappeKPIContainer');
        }

        await waitForDB(); // Renamed from initRepositories() to match existing function
        await initGrappeModule(); // Initialize new module
        await loadData(); // Renamed from refreshData() to match existing function

        document.getElementById('refreshBtn').addEventListener('click', loadData);
        document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
        document.getElementById('deliveryFilterBtn')?.addEventListener('click', () => renderDeliveries());
        document.getElementById('saveWorkshopBtn')?.addEventListener('click', saveWorkshopData);
        document.getElementById('saveStockOverridesBtn')?.addEventListener('click', saveStockOverrides);

        // Listeners for Grappe Tab
        if (window.GrappeAssignmentUI) {
            document.getElementById('grappeRegionFilter')?.addEventListener('change', () => window.renderGrappes());
            document.getElementById('grappeStatusFilter')?.addEventListener('change', () => window.renderGrappes());
        }
        document.getElementById('grappeExportBtn')?.addEventListener('click', exportGrappesCSV);
    });

    /**
     * waitForDB — Attend que la base IndexedDB (Dexie.js) soit disponible.
     * Tente pendant 30 × 200 ms (6 secondes max).
     * Si la DB n'est toujours pas ouverte, tente un open() forcé.
     * Nécessaire car init.js charge les repositories de manière asynchrone.
     */
    async function waitForDB() {
        let attempts = 0;
        // Wait for DB AND ProjectService to be ready
        while ((!window.db || !window.db.isOpen() || !window.projectService) && attempts < 30) {
            await new Promise(r => setTimeout(r, 200));
            attempts++;
        }
        if (window.db && !window.db.isOpen()) {
            try { await window.db.open(); } catch (e) { console.error('DB open failed', e); }
        }

        // Final check for projectService
        if (!window.projectService) {
            console.error('❌ ProjectService not initialized after 6s');
        }
    }

    /**
     * loadData — Charge TOUTES les données et rafraîchit TOUS les onglets.
     * Appelée au chargement initial et lors du clic sur «Actualiser».
     *
     * Flux :
     *   1. Récupère tous les ménages via HouseholdRepository
     *   2. Récupère le projet courant via ProjectRepository (pour config + overrides)
     *   3. Appelle chaque fonction de rendu dans l'ordre
     *   4. Met à jour l'horodatage «Actualisé à HH:MM:SS»
     */
    async function loadData() {
        try {
            const repo = window.householdRepository || window.HouseholdRepository;
            if (!repo) { console.error('HouseholdRepository not available'); return; }
            allHouseholds = await (repo.findAll ? repo.findAll() : repo.getAll());
            console.log(`📦 Logistique: ${allHouseholds.length} ménages chargés`);

            // Stock & Project config
            const projRepo = window.projectRepository || window.ProjectRepository;
            const project = projRepo ? await (projRepo.getCurrent ? projRepo.getCurrent() : projRepo.getAll?.().then(a => a[0])) : null;

            if (project && window.projectService) {
                // Enterprise-grade: Automatically migrate and clean legacy keys on load
                window.projectService.rebuildIndex(project, { migrate: true });
            }

            renderKitStock(project);

            // Fetch teams robustly (same logic as renderGrappes)
            let allTeams = [];
            const teamRepo = window.teamRepository;
            const TeamRepoClass = window.TeamRepository;
            if (teamRepo && typeof teamRepo.findAll === 'function') {
                allTeams = await teamRepo.findAll();
            } else if (TeamRepoClass && typeof TeamRepoClass.getAll === 'function') {
                allTeams = await TeamRepoClass.getAll();
            }

            renderDeliveries();
            renderAgents(allTeams);
            renderWorkshop();
            await renderGrappes(project, allTeams);

            setText('lastRefresh', 'Actualisé ' + new Date().toLocaleTimeString('fr-FR'));
        } catch (err) {
            console.error('Erreur chargement données logistique:', err);
            if (window.Swal) Swal.fire('Erreur', 'Impossible de charger les données: ' + err.message, 'error');
        }
    }

    // ========== NAVIGATION PAR ONGLETS ==========
    /**
     * initTabs — Initialise le système de navigation par onglets.
     * Chaque bouton (.tab-btn) porte un attribut [data-tab] qui correspond
     * à l'ID d'un panneau (#tab-{data-tab}). Au clic :
     *   - Tous les boutons perdent la classe 'active'
     *   - Tous les panneaux perdent la classe 'active'
     *   - Le bouton cliqué et son panneau gagnent 'active'
     * Le CSS de logistique.html gère l'affichage (display:none ↔ block).
     */
    function initTabs() {
        const savedTab = localStorage.getItem('logistique_active_tab');
        const tabs = document.querySelectorAll('.tab-btn');
        const panels = document.querySelectorAll('.tab-panel');

        function activateTab(tabId) {
            tabs.forEach(b => b.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));

            const btn = Array.from(tabs).find(b => b.dataset.tab === tabId);
            const panel = document.getElementById('tab-' + tabId);

            if (btn && panel) {
                btn.classList.add('active');
                panel.classList.add('active');
                localStorage.setItem('logistique_active_tab', tabId);
            }
        }

        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                activateTab(btn.dataset.tab);
            });
        });

        // Restore or default
        if (savedTab) {
            activateTab(savedTab);
        } else {
            // Default to first tab if nothing saved
            const firstTab = tabs[0]?.dataset.tab;
            if (firstTab) activateTab(firstTab);
        }
    }

    // ========== FONCTIONS UTILITAIRES ==========

    /**
     * safe(obj, path, def) — Lecture sécurisée d'une valeur profondément imbriquée.
     * Évite les erreurs «Cannot read property of undefined».
     * Supporte aussi les propriétés privées préfixées _  (ex: entity._config → config).
     *
     * @param {Object} obj  - L'objet source
     * @param {string} path - Chemin pointé (ex: 'delivery.agent')
     * @param {*}      def  - Valeur par défaut si path introuvable (défaut : '')
     * @returns {*} La valeur trouvée ou def
     *
     * Exemple :
     *   safe(household, 'owner.name', 'Inconnu')  → 'Babacar Sow'
     *   safe(household, 'material.coffrets', 0)   → 3
     */
    function safe(obj, path, def = '') {
        if (!obj) return def;
        const keys = path.split('.');
        let v = obj;
        for (const k of keys) {
            if (v == null) return def;
            v = typeof v === 'object' ? (v[k] ?? (v['_' + k] ?? undefined)) : undefined;
        }
        return v ?? def;
    }

    /**
     * debounce(fn, ms) — Anti-rebond pour les événements fréquents (ex: saisie clavier).
     * Retarde l'exécution de fn jusqu'à ce que ms ms se soient écoulées sans nouvel appel.
     *
     * @param {Function} fn - Fonction à retarder
     * @param {number}   ms - Délai en millisecondes
     * @returns {Function} Fonction «anti-rebond»
     *
     * Exemple :
     *   input.addEventListener('input', debounce(renderStockTable, 300));
     */
    function debounce(fn, ms) {
        let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    }

    /**
     * fmt(n) — Formate un nombre en notation française (ex: 1 234 567).
     * Utilise Intl.NumberFormat via toLocaleString('fr-FR').
     * @param {number} n
     * @returns {string}
     */
    function fmt(n) { return (n || 0).toLocaleString('fr-FR'); }

    /**
     * getStatusColor(s) — Retourne la couleur hex associée à un statut de ménage.
     * Si le statut n'est pas dans STATUS_COLORS, retourne gris (#94a3b8).
     * @param {string} s - Statut (ex: 'Conforme', 'Inéligible')
     * @returns {string} Couleur hex
     */
    function getStatusColor(s) { return STATUS_COLORS[s] || '#94a3b8'; }

    /**
     * escapeHtml(str) — Échappe les caractères spéciaux HTML pour prévenir les injections XSS.
     * Utilisé avant toute insertion de texte dynamique dans innerHTML.
     * Convertit < > & " ' en entités HTML sûres.
     * @param {string} str
     * @returns {string} Chaîne échappée
     */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * setText(id, text) — Écrit du texte dans un élément DOM de manière sécurisée.
     * Utilise textContent (pas innerHTML) pour éviter toute injection.
     * Ne fait rien si l'élément n'existe pas (évite les erreurs silencieuses).
     * @param {string} id   - ID de l'élément DOM
     * @param {string} text - Texte à afficher
     */
    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    // ========== ONGLET 2 : STOCK (Basé sur les Kits) ==========
    /**
     * renderKitStock — Calcule et affiche l'état du stock théorique.
     * Le stock n'est pas saisi manuellement, il est DÉRIVÉ :
     *   Stock = (Nombre de kits chargés) × (Quantité par article dans le kit)
     *
     * Fonctionnalités :
     *   - Récupère 'kitsLoaded' depuis la config projet.
     *   - Applique les 'stock_overrides' (corrections manuelles admin) si présentes.
     *   - Groupe les articles par catégorie (Électricité, Quincaillerie...) via KIT_COMPOSITION.
     *   - Affiche un badge «✏️ Corrigé» si une valeur manuelle écrase le calcul auto.
     *
     * @param {Object} project - L'objet projet contenant la config logistique.
     */
    function renderKitStock(project) {
        const bom = window.KIT_COMPOSITION || [];
        const categories = window.KIT_CATEGORIES || [];
        const catColors = window.CATEGORY_COLORS || {};

        // Kits loaded drives the calculation
        const kitsLoaded = project?.config?.logistics_workshop?.kitsLoaded || 0;
        const overrides = project?.config?.stock_overrides || {};

        // Update banner
        setText('stockKitsLoaded', fmt(kitsLoaded));

        // Group BOM by category
        const byCategory = {};
        bom.forEach(item => {
            if (!byCategory[item.category]) byCategory[item.category] = [];
            byCategory[item.category].push(item);
        });

        // Render stock table
        const container = document.getElementById('kitStockContainer');
        if (!container) return;
        container.innerHTML = '';

        const orderedCats = categories.length ? categories : Object.keys(byCategory);

        orderedCats.forEach(cat => {
            const items = byCategory[cat] || [];
            if (items.length === 0) return;
            const c = catColors[cat] || { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', badge: 'bg-gray-100 text-gray-600' };

            const section = document.createElement('div');
            section.className = `bg-white rounded-xl card-shadow overflow-hidden`;

            // Category header
            const header = document.createElement('div');
            header.className = `px-6 py-3 flex items-center justify-between border-b ${c.border} ${c.bg}`;
            const totalQty = items.reduce((s, i) => s + (overrides[i.id] ?? i.qty * kitsLoaded), 0);
            header.innerHTML = `
                <h3 class="font-bold text-sm ${c.text}">${escapeHtml(cat)}</h3>
                <span class="text-xs font-semibold ${c.badge} px-2 py-0.5 rounded">${fmt(Math.round(totalQty))} unités total</span>
            `;
            section.appendChild(header);

            // Items rows
            const table = document.createElement('table');
            table.className = 'min-w-full text-sm';
            table.innerHTML = `
                <thead class="bg-gray-50">
                    <tr>
                        <th class="text-left px-4 py-2 font-semibold text-gray-500 text-xs uppercase">Article</th>
                        <th class="text-center px-4 py-2 font-semibold text-gray-500 text-xs uppercase">Qté/kit</th>
                        <th class="text-right px-4 py-2 font-semibold text-gray-500 text-xs uppercase">Unité</th>
                        <th class="text-right px-4 py-2 font-semibold text-gray-500 text-xs uppercase w-36">Stock total</th>
                    </tr>
                </thead>
            `;
            const tbody = document.createElement('tbody');
            tbody.className = 'divide-y divide-gray-100';

            items.forEach(item => {
                const calculated = item.qty * kitsLoaded;
                const hasOverride = overrides[item.id] !== undefined;
                const displayQty = hasOverride ? overrides[item.id] : calculated;

                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50';
                tr.innerHTML = `
                    <td class="px-4 py-2 text-gray-700">${escapeHtml(item.label)}</td>
                    <td class="px-4 py-2 text-center font-mono text-gray-500">${item.qty}</td>
                    <td class="px-4 py-2 text-right text-gray-400 text-xs">${escapeHtml(item.unit)}</td>
                    <td class="px-4 py-2 text-right">
                        <span class="font-bold text-gray-800">${fmt(Math.round(displayQty))}</span>
                        ${hasOverride ? `<span class="ml-1 text-[10px] text-amber-600 font-semibold" title="Calcul auto: ${fmt(Math.round(calculated))}">✏️ Corrigé</span>` : ''}
                    </td>
                `;
                tbody.appendChild(tr);
            });

            table.appendChild(tbody);
            section.appendChild(table);
            container.appendChild(section);
        });

        // Admin panel
        const currentUser = window.currentUser || window.appState?.currentUser;
        const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin === true;
        const adminPanel = document.getElementById('adminStockPanel');
        if (adminPanel) {
            if (isAdmin) {
                adminPanel.classList.remove('hidden');
                renderAdminOverrideForm(bom, kitsLoaded, overrides);
            } else {
                adminPanel.classList.add('hidden');
            }
        }
    }

    /**
     * renderAdminOverrideForm — Construit le formulaire de correction du stock.
     * Affiche une liste d'inputs numériques permettant à l'admin de forcer
     * une valeur de stock pour n'importe quel article de la nomenclature (BOM).
     *
     * @param {Array}  bom         - Liste des articles (KIT_COMPOSITION)
     * @param {number} kitsLoaded  - Nombre de kits actuellement chargés
     * @param {Object} overrides   - Corrections existantes { itemId: value }
     */
    function renderAdminOverrideForm(bom, kitsLoaded, overrides) {
        const form = document.getElementById('adminOverrideForm');
        if (!form) return;
        form.innerHTML = '';
        bom.forEach(item => {
            const calculated = item.qty * kitsLoaded;
            const currentVal = overrides[item.id] ?? '';
            const div = document.createElement('div');
            div.className = 'flex flex-col gap-1';
            div.innerHTML = `
                <label class="text-xs font-semibold text-gray-600 truncate" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</label>
                <div class="flex items-center gap-2">
                    <input type="number" min="0" step="1"
                        data-item-id="${escapeHtml(item.id)}"
                        value="${currentVal}"
                        placeholder="${Math.round(calculated)} (auto)"
                        class="stock-override-input w-full px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none">
                    <span class="text-xs text-gray-400 whitespace-nowrap">${escapeHtml(item.unit)}</span>
                </div>
            `;
            form.appendChild(div);
        });
    }

    /**
     * saveStockOverrides — Enregistre les corrections manuelles de l'admin.
     * Lit tous les inputs du formulaire, les stocke dans project.config.stock_overrides
     * et persistante l'objet Projet dans IndexedDB via ProjectRepository.
     * Si un champ est vidé, la correction est supprimée (retour au calcul auto).
     */
    async function saveStockOverrides() {
        try {
            const inputs = document.querySelectorAll('.stock-override-input');
            const repo = window.projectRepository || window.ProjectRepository;
            const project = await (repo.getCurrent ? repo.getCurrent() : window.ProjectRepository.getCurrent());
            if (!project) return;

            if (!project.config) project.config = {};
            if (!project.config.stock_overrides) project.config.stock_overrides = {};

            let changed = 0;
            inputs.forEach(input => {
                const id = input.dataset.itemId;
                const val = input.value.trim();
                if (val === '') {
                    delete project.config.stock_overrides[id];
                } else {
                    project.config.stock_overrides[id] = parseFloat(val);
                    changed++;
                }
            });

            await (repo.save ? repo.save(project) : repo.updateProjectParameters(project.config));
            renderKitStock(project);

            Swal.fire({ icon: 'success', title: `${changed} correction(s) enregistrée(s)`, toast: true, position: 'top-end', showConfirmButton: false, timer: 2500 });
        } catch (err) {
            console.error('Stock override save error:', err);
            Swal.fire('Erreur', 'Impossible de sauvegarder les corrections', 'error');
        }
    }


    // ========== ONGLET 3 : LIVRAISONS (Historique) ==========
    /**
     * renderDeliveries — Affiche le journal des visites terrain.
     * Liste les 200 derniers ménages ayant une donnée de livraison, triés par date décroissante.
     *
     * Filtres supportés :
     *   - Agent (Dropdown dynamique basé sur les données présentes)
     *   - Période (Date début / Date fin)
     *
     * Affiche pour chaque ménage : ID, Agent, Date, Durée de visite, Device ID et Statut final.
     */
    async function renderDeliveries() {
        const tbody = document.getElementById('deliveryTableBody');

        // Affichage du Skeleton Loader (Premium UI)
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-12">
            <div class="flex flex-col items-center justify-center space-y-3">
                <div class="w-8 h-8 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                <div class="text-sm font-medium text-indigo-600 animate-pulse">Chargement de l'historique (Patientez...)</div>
            </div>
        </td></tr>`;

        // Yielding : libère le Main Thread pour afficher le skeleton
        await new Promise(resolve => setTimeout(resolve, 20));

        const dateFrom = document.getElementById('deliveryDateFrom')?.value || '';
        const dateTo = document.getElementById('deliveryDateTo')?.value || '';
        const agentFilter = document.getElementById('deliveryAgentFilter')?.value || '';

        // Populate agent filter dropdown
        const agentSelect = document.getElementById('deliveryAgentFilter');
        const agents = new Set();
        allHouseholds.forEach(h => {
            const a = safe(h, 'delivery.agent') || (safe(h, 'delivery') || {}).agent;
            if (a) agents.add(a);
        });
        // Only repopulate if empty
        if (agentSelect && agentSelect.options.length <= 1) {
            agents.forEach(a => {
                const opt = document.createElement('option');
                opt.value = a;
                opt.textContent = a;
                agentSelect.appendChild(opt);
            });
        }

        let deliveries = allHouseholds.filter(h => {
            const d = safe(h, 'delivery');
            return d && (d.agent || d.date);
        });

        if (agentFilter) {
            deliveries = deliveries.filter(h => (safe(h, 'delivery') || {}).agent === agentFilter);
        }
        if (dateFrom) {
            deliveries = deliveries.filter(h => {
                const d = (safe(h, 'delivery') || {}).date;
                return d && d >= dateFrom;
            });
        }
        if (dateTo) {
            deliveries = deliveries.filter(h => {
                const d = (safe(h, 'delivery') || {}).date;
                return d && d <= dateTo + 'T23:59:59';
            });
        }

        // Sort by date desc
        deliveries.sort((a, b) => {
            const da = (safe(a, 'delivery') || {}).date || '';
            const db = (safe(b, 'delivery') || {}).date || '';
            return db.localeCompare(da);
        });

        const fragment = document.createDocumentFragment();
        const slice = deliveries.slice(0, 200);
        for (const h of slice) {
            const d = safe(h, 'delivery') || {};
            const wt = safe(h, 'workTime') || {};
            const status = safe(h, 'status') || '';

            const tr = document.createElement('tr');
            tr.className = 'agent-row hover:bg-slate-50 transition-colors';

            const dateStr = d.date ? new Date(d.date).toLocaleDateString('fr-FR') : '-';
            const durationStr = wt.durationMinutes ? wt.durationMinutes + ' min' : '-';
            const validBadge = d.validationStatus
                ? (d.validationStatus === 'Approved' ? 'badge-ok' : d.validationStatus === 'Not Approved' ? 'badge-err' : 'badge-info')
                : 'badge-info';

            tr.innerHTML = `
                <td class="px-4 py-3 font-mono text-xs text-slate-500">${escapeHtml(String(safe(h, 'id') || ''))}</td>
                <td class="px-4 py-3 font-bold text-slate-700">${escapeHtml(d.agent || '-')}</td>
                <td class="px-4 py-3 text-slate-600">${dateStr}</td>
                <td class="px-4 py-3 text-slate-600"><i class="far fa-clock mr-1 text-slate-400"></i>${durationStr}</td>
                <td class="px-4 py-3 text-xs text-slate-400 font-mono">${escapeHtml(d.deviceId || '-')}</td>
                <td class="px-4 py-3"><span class="badge ${validBadge} shadow-sm">${escapeHtml(d.validationStatus || 'N/A')}</span></td>
                <td class="px-4 py-3 text-center"><span class="badge shadow-sm" style="background:${getStatusColor(status)}15; color:${getStatusColor(status)}; border: 1px solid ${getStatusColor(status)}30">${escapeHtml(status)}</span></td>
            `;
            fragment.appendChild(tr);
        }

        tbody.innerHTML = ''; // Nettoyer le skeleton
        tbody.appendChild(fragment);

        if (slice.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="7" class="text-center py-8 text-gray-400">Aucune livraison enregistrée</td>';
            tbody.appendChild(tr);
        }
    }

    // ========== ONGLET 4 : PERFORMANCE AGENTS ==========
    /**
     * renderAgents — Calcule et affiche les statistiques de productivité par agent et équipe.
     * Parcourt allHouseholds pour agréger :
     *   - Nombre total de visites.
     *   - Temps de visite moyen (durée cumulée / nombre de visites chronométrées).
     *   - Date de dernière activité sur le terrain.
     *   - Assignation des ménages aux différentes types d'équipes (Maçonnerie, Réseau, Intérieur).
     *
     * Détermine le statut d'activité :
     *   - Actif   (<= 3 jours)
     *   - Ralenti (<= 7 jours)
     *   - Inactif (> 7 jours)
     */
    /**
     * renderAgents — Calcule et affiche les statistiques de productivité par agent et équipe.
     * @param {Array} allTeams - Liste de toutes les équipes (hydratées)
     */
    async function renderAgents(allTeams = []) {
        const tbody = document.getElementById('agentTableBody');
        const teamContainer = document.getElementById('teamSummary');

        // Skeletons
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-12">
            <div class="flex flex-col items-center justify-center space-y-3">
                <div class="w-8 h-8 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                <div class="text-sm font-medium text-indigo-600 animate-pulse">Calcul des performances...</div>
            </div>
        </td></tr>`;
        teamContainer.innerHTML = `<div class="p-6 text-center">
            <div class="w-6 h-6 mx-auto mb-2 rounded-full border-2 border-indigo-100 border-t-indigo-600 animate-spin"></div>
            <div class="text-xs font-bold text-indigo-600 uppercase tracking-widest animate-pulse">Répartition...</div>
        </div>`;

        // Yielding
        await new Promise(resolve => setTimeout(resolve, 20));

        const agentMap = {};
        const teamMap = {};

        allHouseholds.forEach(h => {
            // Agent stats
            const d = safe(h, 'delivery') || {};
            const agent = d.agent;
            if (agent) {
                if (!agentMap[agent]) agentMap[agent] = { visits: 0, totalMinutes: 0, timeCount: 0, lastDate: '' };
                agentMap[agent].visits++;
                const wt = safe(h, 'workTime') || {};
                if (wt.durationMinutes) {
                    agentMap[agent].totalMinutes += wt.durationMinutes;
                    agentMap[agent].timeCount++;
                }
                if (d.date && d.date > agentMap[agent].lastDate) agentMap[agent].lastDate = d.date;
            }

            // Team stats
            const teams = safe(h, 'assignedTeams') || [];
            const teamArr = teams instanceof Map ? Array.from(teams.values()) : (Array.isArray(teams) ? teams : []);
            teamArr.forEach(item => {
                const t = item && typeof item === 'object' ? item : (Array.isArray(item) ? { type: item[0], name: item[1] } : {});
                const tName = t.name || t.type || String(item);
                if (tName) {
                    if (!teamMap[tName]) teamMap[tName] = 0;
                    teamMap[tName]++;
                }
            });
        });

        // Build Fragments
        const agentFragment = document.createDocumentFragment();
        const teamFragment = document.createDocumentFragment();

        const now = Date.now();

        const sortedAgents = Object.entries(agentMap).sort((a, b) => b[1].visits - a[1].visits);
        for (const [name, stats] of sortedAgents) {
            const avgTime = stats.timeCount > 0 ? Math.round(stats.totalMinutes / stats.timeCount) : 0;
            const lastDate = stats.lastDate ? new Date(stats.lastDate) : null;
            const daysSince = lastDate ? Math.round((now - lastDate.getTime()) / 86400000) : 999;
            const statusBadge = daysSince <= 3 ? 'badge-ok' : daysSince <= 7 ? 'badge-warn' : 'badge-err';
            const statusText = daysSince <= 3 ? 'Actif' : daysSince <= 7 ? 'Ralenti' : 'Inactif';

            const tr = document.createElement('tr');
            tr.className = 'agent-row hover:bg-slate-50 transition-colors';
            tr.innerHTML = `
                <td class="px-4 py-3 font-bold text-slate-800">${escapeHtml(name)}</td>
                <td class="text-right px-4 py-3 font-black text-indigo-600">${stats.visits}</td>
                <td class="text-right px-4 py-3 text-slate-600"><i class="far fa-clock mr-1 text-slate-400"></i>${avgTime > 0 ? avgTime + ' min' : '-'}</td>
                <td class="px-4 py-3 text-sm text-slate-500">${lastDate ? lastDate.toLocaleDateString('fr-FR') : '-'}</td>
                <td class="text-center px-4 py-3"><span class="badge ${statusBadge} shadow-sm border border-slate-200">${statusText}</span></td>
            `;
            agentFragment.appendChild(tr);
        }

        tbody.innerHTML = '';
        tbody.appendChild(agentFragment);

        if (sortedAgents.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="5" class="text-center py-8 text-gray-400">Aucun agent enregistré</td>';
            tbody.appendChild(tr);
        }

        // Team summary
        teamContainer.innerHTML = '';
        const sortedTeams = Object.entries(teamMap).sort((a, b) => b[1] - a[1]);
        for (const [name, count] of sortedTeams) {
            // Find team clusters
            const teamObj = allTeams.find(t => t.name === name);
            const assignments = teamObj && window.projectService ? (window.projectService._assignmentsIndex?.byTeam?.[teamObj.id] || []) : [];
            const zoneTags = assignments.length > 0
                ? assignments.map(id => `<span class="bg-indigo-50 text-indigo-700 px-1 rounded border border-indigo-100 text-[10px]">${id}</span>`).join(' ')
                : '<span class="text-gray-400 italic text-[10px]">Non assignée</span>';

            const div = document.createElement('div');
            div.className = 'flex flex-col gap-1 border-b border-gray-50 pb-2 mb-2 last:border-0';
            div.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="text-sm font-black text-slate-800">${escapeHtml(name)}</span>
                    <span class="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">${fmt(count)} mén.</span>
                </div>
                <div class="flex flex-wrap gap-1 mt-1">
                    ${zoneTags}
                </div>
            `;
            teamFragment.appendChild(div);
        }
        teamContainer.appendChild(teamFragment);
        if (sortedTeams.length === 0) {
            teamContainer.innerHTML = '<p class="text-sm text-gray-400 text-center">Aucune équipe assignée</p>';
        }

        // Anomalies
        renderAnomalies(agentMap);
    }

    /**
     * renderAnomalies — Analyse les données pour détecter des problèmes logistiques.
     * Liste des alertes affichées en bas de l'onglet Agents :
     *   - Agents inactifs depuis plus de 3 jours.
     *   - Visites terrain suspectes (durée > 120 minutes).
     *   - Incohérences : ménages terminés (Contrôle/Conforme) sans inventaire matériel.
     *
     * @param {Object} agentMap - Map des stats agents générée par renderAgents.
     */
    function renderAnomalies(agentMap) {
        const container = document.getElementById('anomalyList');
        container.innerHTML = '';
        const anomalies = [];
        const now = Date.now();

        // Agents inactifs > 3 jours
        Object.entries(agentMap).forEach(([name, stats]) => {
            if (stats.lastDate) {
                const days = Math.round((now - new Date(stats.lastDate).getTime()) / 86400000);
                if (days > 3) anomalies.push(`⚠️ Agent <b>${escapeHtml(name)}</b> inactif depuis ${days} jours`);
            }
        });

        // Temps de visite > 120 min
        allHouseholds.forEach(h => {
            const wt = safe(h, 'workTime') || {};
            if (wt.durationMinutes && wt.durationMinutes > 120) {
                anomalies.push(`🕐 Ménage <b>${escapeHtml(String(safe(h, 'id')))}</b> — visite de ${wt.durationMinutes} min (> 2h)`);
            }
        });

        // Ménages avancés sans matériel
        const noMat = allHouseholds.filter(h => {
            const s = safe(h, 'status');
            const m = safe(h, 'material');
            return ['Attente Controleur', 'Conforme'].includes(s) && (!m || Object.keys(m).length === 0);
        });
        if (noMat.length > 0) {
            anomalies.push(`📦 ${noMat.length} ménage(s) au stade Contrôle/Conforme sans données matériel`);
        }

        if (anomalies.length === 0) {
            container.innerHTML = '<p class="text-green-700">✅ Aucune anomalie détectée</p>';
        } else {
            anomalies.forEach(a => {
                const div = document.createElement('div');
                div.innerHTML = a;
                container.appendChild(div);
            });
        }
    }



    // ========== EXPORT DES DONNÉES ==========
    /**
     * exportCSV — Génère et télécharge un fichier CSV contenant l'inventaire complet.
     * Colonnes incluses : ID, Propriétaire, Statut, Agent, Date, Durée, et les 7 matériels.
     * Utilise le point-virgule (;) comme séparateur pour une compatibilité Excel FR.
     * Inclut le BOM (Byte Order Mark) pour le support des accents sous Windows.
     */
    function exportCSV() {
        const headers = ['ID', 'Propriétaire', 'Statut', 'Agent', 'Date Livraison', 'Durée (min)',
            'Câble 2.5mm', 'Câble 4mm', 'Coffrets', 'Disjoncteurs', 'Ampoules', 'Prises', 'Interrupteurs'];

        const rows = allHouseholds.map(h => {
            const m = safe(h, 'material') || {};
            const d = safe(h, 'delivery') || {};
            const wt = safe(h, 'workTime') || {};
            const ownerName = safe(h, 'owner.name', safe(h, 'owner', ''));
            const displayOwner = typeof ownerName === 'object' ? (ownerName.name || '') : ownerName;

            return [
                safe(h, 'id'),
                displayOwner,
                safe(h, 'status'),
                d.agent || '',
                d.date ? new Date(d.date).toLocaleDateString('fr-FR') : '',
                wt.durationMinutes || '',
                m.cable_2_5mm || '',
                m.cable_4mm || '',
                m.coffrets || '',
                m.disjoncteurs || '',
                m.ampoules || '',
                m.prises || '',
                m.interrupteurs || ''
            ].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';');
        });

        const csv = '\uFEFF' + headers.join(';') + '\n' + rows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'logistique_export_' + new Date().toISOString().substring(0, 10) + '.csv';
        a.click();
        URL.revokeObjectURL(url);

        if (window.Swal) {
            Swal.fire({ icon: 'success', title: 'Export réussi', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
        }
    }

    // ========== ONGLET 5 : ATELIER & CHARGEMENT ==========
    /** @type {Array} Liste statique des 14 régions du Sénégal pour le sélecteur. */
    const SENEGAL_REGIONS = [
        'Dakar', 'Thiès', 'Diourbel', 'Saint-Louis', 'Tambacounda', 'Kaolack', 'Ziguinchor', 'Kolda',
        'Matam', 'Kaffrine', 'Kédougou', 'Sédhiou', 'Fatick', 'Louga'
    ];

    /**
     * renderWorkshop — Affiche le suivi de la production et des chargements.
     *
     * Fonctionnalités :
     *   1. Calcule les stats via projectService.calculateWorkshopStats.
     *   2. Affiche un tableau par région (Prévu vs Chargé + Barre de progression).
     *   3. Affiche les totaux globaux avec une jauge de progression.
     *   4. IA : Calcule la cadence (kits/j) et l'estimation de date de fin via PredictiveEngine.
     *   5. Affiche un badge de santé (En avance / En retard) basé sur la date cible du projet.
     */
    async function renderWorkshop() {
        const repo = window.projectRepository || window.ProjectRepository;
        const project = await (repo.getCurrent ? repo.getCurrent() : window.ProjectRepository.getCurrent());
        if (!project) return;

        // 1. Calculate stats via projectService
        const stats = window.projectService.calculateWorkshopStats(project);
        const { global, regions: regionalStats } = stats;

        // 2. Identify all regions (from households or default)
        let regions = [...new Set(allHouseholds.map(h => safe(h, 'location.region')).filter(Boolean))];
        if (regions.length === 0) regions = [...SENEGAL_REGIONS];
        regions.sort();

        // 3. Populate Region Selector
        const regionSelect = document.getElementById('inputWorkshopRegion');
        if (regionSelect && regionSelect.options.length <= 1) {
            regions.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r;
                opt.textContent = r;
                regionSelect.appendChild(opt);
            });
        }

        // 4. Render Regional Table
        const regionalRows = regions.map(r => {
            const data = regionalStats[r] || { kitsPrepared: 0, kitsLoaded: 0, progress: 0, remaining: 0 };
            return `
                <tr class="hover:bg-gray-50">
                    <td class="px-6 py-3 font-semibold text-gray-700">${escapeHtml(r)}</td>
                    <td class="px-6 py-3 text-right font-mono text-indigo-600">${fmt(data.kitsPrepared)}</td>
                    <td class="px-6 py-3 text-right font-mono text-emerald-600">${fmt(data.kitsLoaded)}</td>
                    <td class="px-6 py-3 text-right">
                        <div class="flex items-center justify-end gap-2">
                             <span class="text-xs font-bold ${data.progress > 90 ? 'text-emerald-600' : 'text-gray-500'}">${data.progress}%</span>
                             <div class="w-16 bg-gray-100 rounded-full h-1.5">
                                 <div class="h-1.5 rounded-full ${data.progress > 90 ? 'bg-emerald-500' : 'bg-indigo-500'}" style="width: ${data.progress}%"></div>
                             </div>
                        </div>
                    </td>
                    <td class="px-6 py-3 text-right font-mono text-amber-600">${fmt(data.remaining)}</td>
                </tr>
            `;
        });

        // 5. Render Global Stats
        setText('kitsPreparedTotal', fmt(global.kitsPrepared));
        setText('kitsLoadedTotal', fmt(global.kitsLoaded));

        const progressLine = document.getElementById('loadingProgress');
        if (progressLine) {
            progressLine.style.width = global.progress + '%';
            progressLine.className = global.progress > 90 ? 'bg-emerald-500 h-2.5 rounded-full' : (global.progress > 50 ? 'bg-indigo-600 h-2.5 rounded-full' : 'bg-amber-500 h-2.5 rounded-full');
        }
        setText('loadingProgressText', `Chargement global : ${global.progress}%`);

        // 6. AI Predictions
        const prediction = window.projectService.getWorkshopPredictions(project, global);

        setText('aiDailyRate', prediction.dailyRate > 0 ? `${prediction.dailyRate} kits/j` : '-- kits/j');
        setText('aiEstimatedDate', prediction.estimatedEndDate ? prediction.estimatedEndDate.toLocaleDateString('fr-FR') : '--/--/--');

        const healthBadge = document.getElementById('aiHealthBadge');
        if (healthBadge && window.PredictiveEngine) {
            const startDate = project.startDate instanceof Date ? project.startDate : new Date(project.startDate);
            const targetDate = project.endDate ? (project.endDate instanceof Date ? project.endDate : new Date(project.endDate)) : new Date(startDate.getTime() + 90 * 86400000);
            const status = window.PredictiveEngine.getHealthStatus(prediction.estimatedEndDate, targetDate);
            healthBadge.textContent = status === 'ON_TRACK' ? 'En avance' : (status === 'AT_RISK' ? 'À surveiller' : (status === 'BEHIND' ? 'En retard' : 'Données insuf.'));
            healthBadge.className = `px-2 py-0.5 rounded text-[9px] font-bold uppercase ${status === 'ON_TRACK' ? 'bg-emerald-50 text-emerald-700' : (status === 'AT_RISK' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700')}`;
        }

        const tableBody = document.getElementById('regionalWorkshopTableBody');
        if (tableBody) {
            tableBody.innerHTML = regionalRows.join('');
        }
    }

    /**
     * saveWorkshopData — Enregistre un nouveau rapport de chargement journalier.
     * Lit les kits préparés et chargés saisis dans le formulaire régional.
     *
     * Workflow :
     *   - Met à jour les compteurs régionaux dans project.config.logistics_workshop.
     *   - Enregistre un point dans l'historique (pour le calcul de cadence IA).
     *   - Sauvegarde localement (IndexedDB) et tente une synchro serveur (ApiService).
     */
    async function saveWorkshopData() {
        try {
            const region = document.getElementById('inputWorkshopRegion').value;
            const addedKits = parseInt(document.getElementById('inputNewKits').value) || 0;
            const addedLoaded = parseInt(document.getElementById('inputNewLoaded').value) || 0;

            if (addedKits === 0 && addedLoaded === 0) return;

            const project = await (window.projectRepository.getCurrent ? window.projectRepository.getCurrent() : window.ProjectRepository.getCurrent());

            // 1. Use projectService to update data
            window.projectService.updateRegionalWorkshop(project, region, addedKits, addedLoaded);

            // 2. Manage history snapshot
            if (!project.config.logistics_workshop.history) project.config.logistics_workshop.history = [];
            const history = project.config.logistics_workshop.history;
            const today = new Date().toISOString().split('T')[0];

            // Update or add today's snapshot
            const todayIdx = history.findIndex(h => h.date === today);
            if (todayIdx > -1) {
                history[todayIdx].value = project.config.logistics_workshop.kitsPrepared;
            } else {
                history.push({ date: today, value: project.config.logistics_workshop.kitsPrepared });
            }

            // Keep only last 30 days
            if (history.length > 30) history.shift();

            // 3. Save
            const repo = window.projectRepository || window.ProjectRepository;
            await (repo.save ? repo.save(project) : repo.updateProjectParameters(project.config));

            if (window.apiService && window.apiService.isOnline && window.apiService.isAuthenticated) {
                await window.apiService.updateProject(project.id, { config: project.config });
            }

            // Reset UI
            document.getElementById('inputNewKits').value = 0;
            document.getElementById('inputNewLoaded').value = 0;

            renderWorkshop();

            Swal.fire({
                icon: 'success',
                title: 'Rapport enregistré',
                text: `${region === 'global' ? 'Global' : 'Région ' + region} : +${addedKits} kits, +${addedLoaded} chargés.`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        } catch (err) {
            console.error('Workshop save error:', err);
            Swal.fire('Erreur', 'Impossible d\'enregistrer le rapport', 'error');
        }
    }

    /**
     * renderGrappes — Affiche la répartition géographique des ménages via GrappeAssignmentUI.
     */
    window.renderGrappes = async function renderGrappes(project, allTeams = []) {
        const config = window.GRAPPES_CONFIG;
        if (!config || !window.projectService || !window.GrappeAssignmentUI) return;

        try {
            if (!project) {
                const projRepo = window.projectRepository || window.ProjectRepository;
                project = projRepo ? await (projRepo.getCurrent ? projRepo.getCurrent() : null) : null;
            }

            if (project) {
                window.projectService.project = project;
                window.projectService.rebuildIndex(project);
            }

            // Only fetch if not provided
            if (!allTeams || allTeams.length === 0) {
                const repo = window.teamRepository;
                const TeamRepoClass = window.TeamRepository;

                if (repo && typeof repo.findAll === 'function') {
                    allTeams = await repo.findAll();
                } else if (TeamRepoClass && typeof TeamRepoClass.getAll === 'function') {
                    allTeams = await TeamRepoClass.getAll();
                }
            }

            // SMART DISCOVERY: If DB is empty, try to find teams in households or create defaults
            if (allTeams.length === 0) {
                console.warn('🔍 Grappe UI: Aucune équipe en DB. Tentative d\'auto-découverte via les ménages...');
                const discovered = new Set();
                (allHouseholds || []).forEach(h => {
                    const ts = h.assignedTeams || h.equipe;
                    if (ts) {
                        if (Array.isArray(ts)) ts.forEach(t => discovered.add(t.name || t.type || String(t)));
                        else if (typeof ts === 'string') discovered.add(ts);
                    }
                });

                if (discovered.size > 0) {
                    allTeams = Array.from(discovered).map(name => ({
                        id: 'temp-' + name,
                        name: name,
                        type: name.includes('Maçon') ? 'Maçon' : name.includes('Réseau') ? 'Réseau' : name.includes('Intérieur') ? 'Intérieur' : name.includes('Contrôl') ? 'Contrôleur' : 'Inconnu'
                    }));
                } else {
                    const TeamRepoClass = window.TeamRepository;
                    if (TeamRepoClass && TeamRepoClass.createDefaultTeams) {
                        console.log('🔍 Grappe UI: Création des équipes par défaut...');
                        allTeams = await TeamRepoClass.createDefaultTeams();
                    }
                }
            }
            console.log(`🔍 Grappe UI: ${allTeams.length} équipes prêtes`, allTeams);

            // Group teams dynamically based on TeamRegistry (Unified source of truth)
            const registry = window.TeamRegistry;
            const teamsByType = { others: [] };

            if (registry) {
                registry.getIds().forEach(id => teamsByType[id] = []);
            } else {
                ['mason', 'network', 'interior', 'control'].forEach(id => teamsByType[id] = []);
            }

            allTeams.forEach(t => {
                const rawType = t.type || t.name || '';
                const typeId = registry ? registry.normalizeId(rawType) : rawType.toLowerCase();
                const isDuplicate = (existing) => existing.id === t.id || existing.name === t.name;

                if (teamsByType[typeId]) {
                    if (!teamsByType[typeId].some(isDuplicate)) {
                        teamsByType[typeId].push(t);
                    }
                } else {
                    // Fallback for custom configured types in capabilities
                    const capabilities = project?.config?.teamCapabilities || {};
                    const customMatch = Object.keys(capabilities).find(c => rawType.toLowerCase().includes(c.toLowerCase()));

                    if (customMatch) {
                        if (!teamsByType[customMatch]) teamsByType[customMatch] = [];
                        if (!teamsByType[customMatch].some(isDuplicate)) {
                            teamsByType[customMatch].push(t);
                        }
                    } else {
                        if (!teamsByType.others.some(isDuplicate)) {
                            teamsByType.others.push(t);
                        }
                    }
                }
            });

            const regionFilter = document.getElementById('grappeRegionFilter')?.value || '';
            const statusFilter = document.getElementById('grappeStatusFilter')?.value || 'all';

            // Populate region filter if empty
            const regionSel_el = document.getElementById('grappeRegionFilter');
            if (regionSel_el && regionSel_el.options.length <= 1) {
                const regions = [...new Set((config.sous_grappes || []).map(g => g.region))]; // Use sous_grappes for regions
                regions.sort().forEach(r => {
                    const opt = document.createElement('option'); opt.value = r; opt.textContent = r;
                    regionSel_el.appendChild(opt);
                });
            }

            // USE THE INDUSTRIAL MODULE CONTROLLER
            if (window.grappeModuleController) {
                // Backward compatibility: Sync state to legacy UI for the modal system
                window.GrappeAssignmentUI.project = project;
                window.GrappeAssignmentUI.teamsByType = teamsByType;
                window.GrappeAssignmentUI.config = config;

                await window.grappeModuleController.render({
                    region: regionFilter,
                    status: statusFilter
                });

                // Update counts in header
                const filtered = await window.grappeModuleController.render({ region: regionFilter, status: statusFilter });
                setText('grappeTotalCount', fmt((config.sous_grappes || []).reduce((s, sg) => s + sg.nb_menages, 0)));
                setText('sousGrappeCount', filtered.length);
            } else {
                // Fallback to legacy
                await window.GrappeAssignmentUI.render(project, teamsByType, config, regionFilter, statusFilter);
            }

        } catch (e) {
            console.error('Error in renderGrappes:', e);
        }
    };


    /**
     * exportGrappesCSV — Exporte la liste des sous-grappes et leurs équipes assignées.
     */
    function exportGrappesCSV() {
        const config = window.GRAPPES_CONFIG;
        if (!config || !window.projectService) return;

        const headers = ['Code SG', 'Nom', 'Région', 'Grappe', 'Ménages', 'Maçons', 'Réseau', 'Intérieur', 'Contrôle'];
        const rows = [headers];

        (config.sous_grappes || []).forEach(sg => {
            const asgn = window.projectService.getAssignments(sg.id);
            const getTeamNames = (ids) => ids.map(id => id).join(', ');

            rows.push([
                sg.code,
                sg.nom,
                sg.region,
                sg.grappe_id,
                sg.nb_menages,
                getTeamNames(asgn['mason'] || []),
                getTeamNames(asgn['network'] || []),
                getTeamNames(asgn['interior'] || []),
                getTeamNames(asgn['control'] || [])
            ]);
        });

        const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'export-grappes-v2.csv'; a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Synchronise les types d'équipes locaux avec la configuration globale du projet (Paramètres)
     */
    window.syncTeamsWithConfig = async function () {
        try {
            const project = await (window.projectRepository || window.ProjectRepository).getCurrent();
            if (!project || !project.config || !project.config.teamCapabilities) {
                Swal.fire('Info', 'Aucune configuration de type d\'équipe trouvée dans les paramètres.', 'info');
                return;
            }

            // On rafraîchit l'affichage (renderAgents utilise les agents + les équipes de la DB)
            await renderAgents();
            if (window.renderGrappes) await window.renderGrappes(project);

            Swal.fire({
                icon: 'success',
                title: 'Synchronisation réussie',
                text: 'Les types d\'équipes ont été mis à jour selon vos paramètres.',
                toast: true,
                position: 'top-end',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (err) {
            console.error('Sync failed:', err);
        }
    };

    /**
     * UI pour créer une nouvelle équipe avec choix de type restreint aux paramètres
     */
    window.createNewTeamUI = async function () {
        try {
            const repo = window.projectRepository || window.ProjectRepository;
            const project = await repo.getCurrent();
            const capabilities = project?.config?.teamCapabilities || {};
            const types = Object.keys(capabilities).map(t => t.charAt(0).toUpperCase() + t.slice(1));

            if (types.length === 0) {
                Swal.fire('Attention', 'Veuillez d\'abord configurer des types d\'équipes dans la page Paramètres.', 'warning');
                return;
            }

            const { value: formValues } = await Swal.fire({
                title: 'Créer une nouvelle équipe',
                html: `
                <div class="text-left space-y-3 p-2">
                    <label class="block text-xs font-bold text-gray-400 uppercase">Nom de l'équipe</label>
                    <input id="swal-team-name" class="swal2-input m-0 w-full" placeholder="ex: Alpha 1">
                    
                    <label class="block text-xs font-bold text-gray-400 uppercase mt-4">Type de métier (Configuré)</label>
                    <select id="swal-team-type" class="swal2-select m-0 w-full">
                        ${types.map(t => `<option value="${t}">${t}</option>`).join('')}
                    </select>
                </div>
            `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Créer',
                confirmButtonColor: '#10b981',
                preConfirm: () => {
                    const name = document.getElementById('swal-team-name').value;
                    const type = document.getElementById('swal-team-type').value;
                    if (!name) return Swal.showValidationMessage('Le nom est requis');
                    return { name, type };
                }
            });

            if (formValues) {
                const TeamRepo = window.teamRepository || window.TeamRepository;
                const typeLower = formValues.type.toLowerCase();
                const config = capabilities[typeLower] || {};

                const newTeam = {
                    id: `team-${Date.now()}`,
                    name: formValues.name,
                    type: formValues.type,
                    capacity: config.daily || 1,
                    isActive: true,
                    createdAt: new Date().toISOString()
                };

                // Gérer le cas où on a une instance ou le constructeur
                if (TeamRepo.addTeam) {
                    await TeamRepo.addTeam(newTeam);
                } else {
                    const inst = new TeamRepo(window.db);
                    await inst.addTeam(newTeam);
                }

                await renderAgents();
                if (window.renderGrappes) await window.renderGrappes(project);

                Swal.fire({
                    icon: 'success',
                    title: 'Équipe créée',
                    toast: true,
                    position: 'top-end',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        } catch (err) {
            console.error('Create team failed:', err);
        }
    };

    /**
     * Vérifie l'intégrité des données d'assignation
     */
    window.checkDataHealth = async function () {
        try {
            const project = await (window.projectRepository || window.ProjectRepository).getCurrent();
            const service = window.projectService;
            if (!service || !service.validateIntegrity) return;

            const result = await service.validateIntegrity(project);

            if (result.isValid) {
                Swal.fire({
                    icon: 'success',
                    title: 'Santé OK',
                    text: 'Toutes les assignations pointent vers des équipes valides.',
                    confirmButtonColor: '#4f46e5'
                });
            } else {
                const { isConfirmed } = await Swal.fire({
                    icon: 'warning',
                    title: 'Incohérences détectées',
                    text: `${result.orphans.length} assignations pointent vers des équipes supprimées.`,
                    showCancelButton: true,
                    confirmButtonText: 'Réparer (Nettoyer)',
                    cancelButtonText: 'Plus tard',
                    confirmButtonColor: '#f59e0b'
                });

                if (isConfirmed) {
                    const count = await service.cleanupOrphans(project);
                    Swal.fire('Réparé', `${count} liens rompus ont été supprimés.`, 'success');
                    if (window.renderGrappes) window.renderGrappes(project);
                }
            }
        } catch (err) {
            console.error('Health check failed:', err);
        }
    };

})();
