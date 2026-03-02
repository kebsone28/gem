// terrain_main.js - Point d'entrée principal pour la page Terrain
// Intègre le nouveau système de gestion des statuts via HouseholdService

// Variable globale pour stocker tous les ménages
let allHouseholds = [];

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initialisation du Hub de Données Terrain...');

    // Attendre que les services soient prêts (via init.js)
    const waitForServices = () => {
        return new Promise((resolve) => {
            if (window.householdService) {
                resolve();
            } else {
                const checkInterval = setInterval(() => {
                    if (window.householdService) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
                // Timeout de sécurité
                setTimeout(() => {
                    clearInterval(checkInterval);
                    if (!window.householdService) console.warn('⚠️ HouseholdService non disponible après timeout');
                    resolve();
                }, 5000);
            }
        });
    };

    await waitForServices();

    const normalizeStatus = (window.normalizeStatus) ? window.normalizeStatus : (s => s);
    const getStatusCategory = (window.getStatusCategory) ? window.getStatusCategory : (_ => 'in_progress');

    // 1. Initialiser le MapManager s'il est chargé mais pas encore instancié
    if (!window.mapManager && window.MapManager) {
        console.log('🗺️ Instantiation manuelle de MapManager...');
        // MapManager attache automatiquement la carte à l'ID "householdMap"
        window.mapManager = new window.MapManager();
    }

    // 2. Initialiser l'ImportManager
    if (!window.importManager && window.ImportManager) {
        console.log('📥 Instantiation manuelle de ImportManager...');
        // ImportManager gère dropZone et fileInput
        window.importManager = new window.ImportManager();
    }

    // 3. Préparer le bouton de synchro Kobo (l'activation dépendra de la config chargée)
    const syncBtnInit = document.getElementById('triggerKoboSyncBtn');
    if (syncBtnInit) {
        syncBtnInit.disabled = true;
    }

    const zoneSelect = document.getElementById('zoneFilterSelect');
    const teamSelect = document.getElementById('teamFilterSelect');

    const renderFilterOptions = () => {
        if (!zoneSelect && !teamSelect) return;
        const zones = new Set();
        const teams = new Set();
        allHouseholds.forEach(h => {
            if (h.commune) zones.add(h.commune);
            if (h.quartier_village) zones.add(h.quartier_village);
            if (h.equipe_reseau && h.equipe_reseau !== '-') teams.add(h.equipe_reseau);
            if (h.equipe_interieur && h.equipe_interieur !== '-') teams.add(h.equipe_interieur);
        });

        if (zoneSelect) {
            const current = zoneSelect.value || 'all';
            zoneSelect.innerHTML = '<option value="all">Toutes</option>' + Array.from(zones).sort().map(z => `<option value="${z}">${z}</option>`).join('');
            if (Array.from(zones).includes(current)) zoneSelect.value = current;
        }
        if (teamSelect) {
            const currentT = teamSelect.value || 'all';
            teamSelect.innerHTML = '<option value="all">Toutes</option>' + Array.from(teams).sort().map(t => `<option value="${t}">${t}</option>`).join('');
            if (Array.from(teams).includes(currentT)) teamSelect.value = currentT;
        }
    };

    const getFilteredData = () => {
        const searchInput = document.getElementById('searchHousehold');
        const term = searchInput ? searchInput.value.toLowerCase() : '';
        const activeBtn = document.querySelector('.filter-btn.active');
        const statusFilter = activeBtn ? activeBtn.dataset.filter : 'all';
        const zoneVal = zoneSelect ? zoneSelect.value : 'all';
        const teamVal = teamSelect ? teamSelect.value : 'all';

        const HS = window.HouseholdStatus || {};
        const statusMap = {
            'debut': [HS.NON_DEBUTE],
            'travaux': [HS.MURS_EN_COURS, HS.MURS_TERMINE, HS.RESEAU_EN_COURS, HS.RESEAU_TERMINE, HS.INTERIEUR_EN_COURS],
            'controle': [HS.INTERIEUR_TERMINE],
            'conforme': [HS.RECEPTION_VALIDEE],
            'bloque': [HS.PROBLEME, HS.INELIGIBLE]
        };

        let data = allHouseholds;
        if (statusFilter !== 'all') {
            const targetStatuses = statusMap[statusFilter] || [];
            data = data.filter(h => targetStatuses.includes(h.status));
        }
        if (zoneVal && zoneVal !== 'all') {
            data = data.filter(h => h.commune === zoneVal || h.quartier_village === zoneVal);
        }
        if (teamVal && teamVal !== 'all') {
            data = data.filter(h => h.equipe_reseau === teamVal || h.equipe_interieur === teamVal);
        }
        if (term) {
            data = data.filter(h =>
                (h.nom_prenom_chef && h.nom_prenom_chef.toLowerCase().includes(term)) ||
                (h.id && h.id.toLowerCase().includes(term)) ||
                (h.telephone && String(h.telephone).includes(term)) ||
                (h.commune && h.commune.toLowerCase().includes(term)) ||
                (h.quartier_village && h.quartier_village.toLowerCase().includes(term))
            );
        }
        return data;
    };

    const updateFilteredList = () => {
        renderFilterOptions();
        const filtered = getFilteredData();
        renderHouseholdList(filtered);
    };

    // 4. Fonction de chargement centralisée
    const loadHouseholds = async () => {
        try {
            if (!window.householdService) {
                console.warn('HouseholdService non initialisé - Passage en mode lecture seule ou dégradé.');
                return;
            }

            // Récupérer tous les ménages
            const households = await window.householdService.searchHouseholds({});

            // Mapper vers le viewModel pour l'affichage
            allHouseholds = households.map(h => {
                const loc = h.location || {};
                const coords = loc.coordinates || {};
                const owner = h.owner || {};

                const normalizedStatus = normalizeStatus(h.status);

                return {
                    id: h.id,
                    nom_prenom_chef: owner.name || 'Nom Inconnu',
                    status: normalizedStatus,
                    quartier_village: loc.village || '',
                    commune: loc.commune || '',
                    telephone: owner.phone || '',
                    gps_lat: parseFloat(coords.latitude || h.gps_lat || 0),
                    gps_lon: parseFloat(coords.longitude || h.gps_lon || 0),
                    equipe_reseau: h.assignedTeams?.find(t => t.type === 'RESEAU' || t.name?.includes('RES'))?.name || '-',
                    equipe_interieur: h.assignedTeams?.find(t => t.type === 'INTERIEUR' || t.name?.includes('INT'))?.name || '-',
                    date_installation: h.actualDates?.completion ? new Date(h.actualDates.completion).toLocaleDateString() : '-',
                    infos_techniques: h.notes && h.notes.length > 0 ? h.notes[h.notes.length - 1].content : '-',
                    photos: h.photos || [],
                    _entity: h
                };
            });

            // Mise à jour du compteur UI
            // Mise à jour du compteur UI (Legacy)
            const countEl = document.getElementById('totalMenagesDb');
            if (countEl) countEl.textContent = `${allHouseholds.length.toLocaleString()} ménages en base`;

            // === MISE À JOUR DASHBOARD STATS (V4.4) ===
            const stats = {
                total: allHouseholds.length,
                attente: 0,
                enCours: 0,
                termine: 0
            };

            allHouseholds.forEach(h => {
                const category = getStatusCategory(h.status);
                if (category === 'done') stats.termine++;
                else if (category === 'todo') stats.attente++;
                else stats.enCours++;
            });

            const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val.toLocaleString(); };
            setTxt('statTotal', stats.total);
            setTxt('statAttente', stats.attente);
            setTxt('statEnCours', stats.enCours);
            setTxt('statTermine', stats.termine);

            // Rendu de la liste + filtres
            updateFilteredList();

            // Rendu de la carte
            if (window.mapManager) {
                console.log('🔄 Rafraîchissement de la carte avec', allHouseholds.length, 'points');
                await window.mapManager.loadData();
            }

        } catch (error) {
            console.error('Erreur chargement ménages:', error);
            if (window.Swal) Swal.fire('Erreur', 'Impossible de charger les données: ' + error.message, 'error');
        }
    };

    /**
     * Configuration des écouteurs d'événements (EventBus)
     */
    const setupEventListeners = () => {
        if (!window.eventBus) return;

        console.log('📡 Abonnement aux événements...');

        window.eventBus.on('household.status.changed', () => loadHouseholds());
        window.eventBus.on('household.created', () => loadHouseholds());
        window.eventBus.on('household.deleted', () => loadHouseholds());

        window.eventBus.on('households.batch.saved', (data) => {
            if (window.Swal && data.count > 0) {
                const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
                Toast.fire({ icon: 'success', title: 'Import terminé', text: `${data.count} ménages importés` });
            }
            loadHouseholds();
        });

        window.eventBus.on('sync.completed', async (data) => {
            await refreshLastSyncUi();
            loadHouseholds();
        });

        window.eventBus.on('sync.failed', async () => {
            await refreshLastSyncUi();
        });
    };

    const setupBackupUI = () => {
        const backupService = window.backupService;
        const restoreService = window.restoreService;

        if (!backupService || !restoreService) {
            console.warn('Backup/Restore services not available');
            return;
        }

        // Elements
        const autoBackupToggle = document.getElementById('autoBackupToggle');
        const backupIntervalSelect = document.getElementById('backupIntervalSelect');
        const manualBackupBtn = document.getElementById('manualBackupBtn');
        const restoreBackupBtn = document.getElementById('restoreBackupBtn');
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        const historyList = document.getElementById('backupHistoryList');
        const lastBackupTime = document.getElementById('lastBackupTime');
        const restoreFileInput = document.getElementById('restoreFileInput');
        const selectFolderBtn = document.getElementById('selectFolderBtn');
        const backupLocationDisplay = document.getElementById('backupLocationDisplay');

        // Init UI state from Config
        const config = backupService.getConfig();
        if (autoBackupToggle) autoBackupToggle.checked = config.autoBackupEnabled;
        if (backupIntervalSelect) backupIntervalSelect.value = config.backupInterval;
        updateLastBackupTime(config.lastBackupDate);
        renderHistory();

        // Listeners
        if (selectFolderBtn) {
            selectFolderBtn.addEventListener('click', async () => {
                try {
                    await backupService.selectBackupDirectory();
                } catch (e) {
                    if (window.Swal && e.name !== 'AbortError') Swal.fire('Erreur', e.message, 'error');
                }
            });
        }

        if (selectFolderBtn) {
            selectFolderBtn.addEventListener('click', async () => {
                try {
                    await backupService.selectBackupDirectory();
                    // Event 'backup.directory.selected' will handle UI update
                } catch (e) {
                    if (window.Swal && e.name !== 'AbortError') Swal.fire('Erreur', e.message, 'error');
                }
            });
        }

        if (autoBackupToggle) {
            autoBackupToggle.addEventListener('change', (e) => {
                backupService.setAutoBackupEnabled(e.target.checked);
            });
        }

        if (backupIntervalSelect) {
            backupIntervalSelect.addEventListener('change', (e) => {
                backupService.setBackupInterval(parseInt(e.target.value));
            });
        }

        if (manualBackupBtn) {
            manualBackupBtn.addEventListener('click', async () => {
                try {
                    manualBackupBtn.disabled = true;
                    manualBackupBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>...';
                    await backupService.performBackup(false);
                } catch (e) {
                    // Handled by service/events
                } finally {
                    manualBackupBtn.disabled = false;
                    manualBackupBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Sauvegarder';
                }
            });
        }

        if (restoreBackupBtn) {
            restoreBackupBtn.addEventListener('click', () => {
                // Trigger file input
                if (restoreFileInput) restoreFileInput.click();
            });
        }

        if (restoreFileInput) {
            restoreFileInput.addEventListener('change', async (e) => {
                if (e.target.files.length > 0) {
                    const file = e.target.files[0];
                    if (confirm(`Restaurer depuis ${file.name} ? Cela remplacera les données actuelles.`)) {
                        try {
                            const res = await restoreService.restoreFromFile(file);
                            if (res.success) {
                                restoreService.showRestoreSummary(res.stats);
                            }
                        } catch (err) {
                            alert('Erreur restauration: ' + err.message);
                        }
                    }
                    e.target.value = ''; // Reset
                }
            });
        }

        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                if (confirm('Effacer tout l\'historique des sauvegardes ?')) {
                    backupService.clearBackupHistory();
                    renderHistory();
                }
            });
        }

        // Functions
        function updateLastBackupTime(dateStr) {
            if (lastBackupTime) {
                lastBackupTime.textContent = dateStr ? new Date(dateStr).toLocaleString() : 'Jamais';
            }
        }

        function renderHistory() {
            if (!historyList) return;
            const history = backupService.getBackupHistory();

            if (history.length === 0) {
                historyList.innerHTML = '<p class="text-xs text-gray-400 italic">Aucune sauvegarde</p>';
                return;
            }

            historyList.innerHTML = history.map(item => `
                <div class="flex justify-between items-center p-2 hover:bg-gray-100 rounded text-xs border-b border-gray-50 last:border-0">
                    <div>
                        <span class="font-medium text-gray-700">${new Date(item.date).toLocaleString()}</span>
                        <div class="text-gray-500 scale-90 origin-left">
                            ${item.isAuto ? '<i class="fas fa-robot mr-1" title="Auto"></i>' : '<i class="fas fa-user mr-1" title="Manuel"></i>'}
                            ${item.recordCount} ménages
                        </div>
                    </div>
                    <span class="text-gray-400 text-[10px]">${item.filename.split('_').pop().replace('.xlsx', '')}</span>
                </div>
            `).join('');
        }

        // Bus Events for UI updates
        window.eventBus.on('backup.directory.selected', (data) => {
            if (backupLocationDisplay) {
                backupLocationDisplay.innerHTML = `<span class="text-xs text-indigo-700 font-bold"><i class="fas fa-folder mr-1"></i>${data.name}</span>`;
            }
            if (window.Swal) Swal.fire({
                icon: 'success',
                title: 'Dossier connecté',
                text: `Les futures sauvegardes iront dans "${data.name}"`,
                timer: 2000,
                showConfirmButton: false
            });
        });

        window.eventBus.on('backup.completed', (data) => {
            updateLastBackupTime(new Date().toISOString());
            renderHistory();
            if (!data.isAuto && window.Swal) Swal.fire({
                icon: 'success',
                title: 'Sauvegarde réussie',
                text: `Fichier: ${data.filename}\nLieu: ${data.location || 'Downloads'}`,
                timer: 3000,
                showConfirmButton: false
            });
        });

        window.eventBus.on('backup.history.cleared', () => renderHistory());
    };

    setupEventListeners();
    setupBackupUI();

    // -- Gestion de l'UI --

    // Recherche
    document.getElementById('searchHousehold')?.addEventListener('input', () => {
        updateFilteredList();
    });

    // Filtres
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // UI Toggle
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('active');
                b.style.opacity = "0.7";
            });
            e.target.classList.add('active');
            e.target.style.opacity = "1";

            updateFilteredList();
        });
    });

    // Filtres zone / équipe
    zoneSelect?.addEventListener('change', updateFilteredList);
    teamSelect?.addEventListener('change', updateFilteredList);

    // Fonction de rendu liste
    const renderHouseholdList = (households) => {
        const container = document.getElementById('householdListContainer');
        if (!container) return;

        container.innerHTML = '';

        if (households.length === 0) {
            container.innerHTML = '<div class="p-8 text-center text-gray-500">Aucun ménage trouvé</div>';
            return;
        }

        const displayLimit = 50;
        const visibleHouseholds = households.slice(0, displayLimit);

        visibleHouseholds.forEach(h => {
            const status = h.status || 'En attente';
            // Utiliser window.createStatusBadge s'il est dispo (global helper), sinon fallback simple
            const statusBadge = window.createStatusBadge ?
                window.createStatusBadge(status, false) :
                `<span class="px-2 py-1 text-xs rounded bg-gray-100">${status}</span>`;

            const div = document.createElement('div');
            div.className = 'p-4 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 group';
            div.onclick = () => selectHousehold(h.id);

            const safeName = h.nom_prenom_chef;

            div.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <span class="font-bold text-gray-800 text-sm block">${safeName}</span>
                        <span class="text-xs text-gray-500">${h.id}</span>
                    </div>
                    ${statusBadge}
                </div>
                <div class="text-xs text-gray-500 mt-1">
                    <i class="fas fa-map-marker-alt mr-1"></i> ${h.quartier_village || 'N/A'}
                </div>
            `;
            container.appendChild(div);
        });

        if (households.length > displayLimit) {
            const moreDiv = document.createElement('div');
            moreDiv.className = 'p-4 text-center text-xs text-gray-400 italic';
            moreDiv.textContent = `+ ${households.length - displayLimit} autres ménages masqués`;
            container.appendChild(moreDiv);
        }
    };

    // Sélection ménage
    window.selectHousehold = async (id) => {
        const household = allHouseholds.find(h => h.id === id);
        if (!household) return;

        // Remplir le panneau latéral
        const safelySetText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text || '-';
        };

        safelySetText('detailId', household.id);
        safelySetText('detailName', household.nom_prenom_chef);
        safelySetText('detailLocation', `${household.quartier_village} - ${household.commune}`);
        safelySetText('detailPhone', household.telephone);
        safelySetText('detailTeamRes', household.equipe_reseau);
        safelySetText('detailTeamInt', household.equipe_interieur);
        safelySetText('detailDatePrev', household.date_installation);
        safelySetText('detailInfosTech', household.infos_techniques);

        // Afficher panneau
        const listView = document.getElementById('householdListView');
        const detailView = document.getElementById('householdDetailView');
        if (listView && detailView) {
            listView.classList.add('hidden');
            detailView.classList.remove('hidden');
        }

        // Recentrer carte
        if (window.mapManager?.map && household.gps_lat && household.gps_lon) {
            const lat = household.gps_lat;
            const lon = household.gps_lon;
            window.mapManager.map.invalidateSize();
            window.mapManager.map.setView([lat, lon], 18);
        }
    };

    // Bouton retour
    document.getElementById('backToListBtn')?.addEventListener('click', () => {
        const detailView = document.getElementById('householdDetailView');
        const listView = document.getElementById('householdListView');
        if (detailView && listView) {
            detailView.classList.add('hidden');
            listView.classList.remove('hidden');
        }
    });

    // Bouton Recentrer Carte
    document.getElementById('recenterMapBtn')?.addEventListener('click', () => {
        if (window.mapManager) {
            window.mapManager.fitBoundsToMarkers();
        }
    });

    // === KOBO CONFIGURATION UI ===
    const updateKoboStatus = (configured, lastLog = null) => {
        const statusDot = document.getElementById('koboStatusDot');
        const statusText = document.getElementById('koboConnectionStatus');
        if (statusDot) statusDot.className = `w-3 h-3 rounded-full mr-2 ${configured ? 'bg-green-500' : 'bg-gray-300'}`;
        if (statusText) {
            const base = configured ? 'Config OK (stockée localement)' : 'Non configuré';
            const last = lastLog ? ` – Dernière sync: ${new Date(lastLog.date).toLocaleString()} (${lastLog.status})` : '';
            statusText.textContent = `${base}${last}`;
        }
        const syncBtn = document.getElementById('triggerKoboSyncBtn');
        if (syncBtn) syncBtn.disabled = !configured;
        return configured;
    };

    const loadKoboConfig = async () => {
        try {
            if (window.db?.settings) {
                const stored = await window.db.settings.get('kobo_config');
                if (stored) {
                    const tokenEl = document.getElementById('koboApiToken');
                    const uidEl = document.getElementById('koboAssetUid');
                    if (tokenEl) tokenEl.value = stored.token || '';
                    if (uidEl) uidEl.value = stored.assetUid || '';
                    updateKoboStatus(!!stored.token && !!stored.assetUid);
                }
            }
        } catch (e) {
            console.warn('Impossible de charger la config Kobo stockée', e);
        }
        const tokenEl = document.getElementById('koboApiToken');
        const uidEl = document.getElementById('koboAssetUid');
        updateKoboStatus(!!(tokenEl?.value && uidEl?.value));
    };

    const refreshLastSyncUi = async () => {
        try {
            if (window.syncService?.getLastSyncLog) {
                const log = await window.syncService.getLastSyncLog();
                const el = document.getElementById('lastKoboSyncTime');
                if (el) {
                    if (log) {
                        el.textContent = new Date(log.date).toLocaleString();
                        updateKoboStatus(true, log);
                    } else {
                        el.textContent = 'Jamais';
                    }
                }
                await renderSyncHistory();
            }
        } catch (e) {
            console.warn('Impossible de rafraîchir le dernier log de sync', e);
        }
    };

    const renderSyncHistory = async () => {
        const container = document.getElementById('syncHistoryList');
        if (!container) return;

        if (!window.db?.sync_logs) {
            container.innerHTML = '<div class="text-gray-400 italic">Logs non disponibles</div>';
            return;
        }

        const logs = await window.db.sync_logs.orderBy('date').reverse().limit(10).toArray();
        if (!logs || logs.length === 0) {
            container.innerHTML = '<div class="text-gray-400 italic">Aucun log</div>';
            return;
        }

        container.innerHTML = logs.map(log => {
            const color = log.status === 'success' ? 'text-green-600' : 'text-red-600';
            return `<div class="flex justify-between items-center border-b border-gray-100 pb-1 last:border-0 last:pb-0">
                        <div>
                            <div class="font-semibold text-gray-700">${log.type}</div>
                            <div class="text-[11px] text-gray-500">${new Date(log.date).toLocaleString()}</div>
                        </div>
                        <div class="${color} font-semibold text-xs">${log.status}</div>
                    </div>`;
        }).join('');
    };

    await loadKoboConfig();
    await refreshLastSyncUi();

    const configToggle = document.getElementById('toggleKoboConfig');
    const configPanel = document.getElementById('koboConfigPanel');
    const saveConfigBtn = document.getElementById('saveKoboConfigBtn');

    if (configToggle && configPanel) {
        configToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isHidden = configPanel.classList.contains('hidden');
            if (isHidden) {
                configPanel.classList.remove('hidden');
            } else {
                configPanel.classList.add('hidden');
            }
        });
    }

    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', async () => {
            const token = document.getElementById('koboApiToken').value.trim();
            const assetUid = document.getElementById('koboAssetUid').value.trim();

            if (!token || !assetUid) {
                if (window.Swal) return Swal.fire('Configuration incomplète', 'Token et Asset UID sont requis', 'warning');
                alert('Token et Asset UID sont requis');
                return;
            }

            try {
                if (window.koboProxy?.saveToken) {
                    await window.koboProxy.saveToken(token);
                }
                if (window.db?.settings) {
                    await window.db.settings.put({ key: 'kobo_config', token: null, assetUid }); // token non stocké en clair
                }
                if (window.syncService && window.syncService.apiService) {
                    window.syncService.apiService.token = null; // forcé à récupérer via proxy
                    window.syncService.apiService.assetUid = assetUid;
                }
                updateKoboStatus(true);
                configPanel.classList.add('hidden');
                if (window.Swal) Swal.fire({ icon: 'success', title: 'Configuration enregistrée', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
            } catch (e) {
                console.error('Erreur sauvegarde config Kobo', e);
                if (window.Swal) Swal.fire('Erreur', e.message, 'error');
            }
        });
    }

    // Action Sync Kobo (Click Listener)
    const syncActionBtn = document.getElementById('triggerKoboSyncBtn');
    if (syncActionBtn) {
        syncActionBtn.addEventListener('click', async () => {
            try {
                // UI Loading
                const originalHtml = syncActionBtn.innerHTML;
                syncActionBtn.innerHTML = '<i class="fas fa-spin fa-sync mr-2"></i>Traitement...';
                syncActionBtn.disabled = true;

                // Sync call
                let syncInstance = window.syncService;
                // Fallback instantiation if missing globally but DB is present
                if (!syncInstance && window.db) {
                    syncInstance = new SyncService(window.db, window.eventBus, console);
                }

                if (syncInstance) {
                    await syncInstance.syncFromApi(); // Will trigger 'households.batch.saved' or similar

                    if (window.Swal) {
                        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
                        Toast.fire({ icon: 'success', title: 'Synchronisation terminée' });
                    } else {
                        alert('Synchronisation terminée');
                    }

                    await loadHouseholds();
                } else {
                    throw new Error("Service de synchronisation indisponible");
                }

            } catch (error) {
                console.error("Sync Error:", error);
                if (error.message.includes('CORS_ALL_FAILED') || error.message.includes('Failed to fetch')) {
                    if (window.Swal) {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Sécurité Navigateur (CORS)',
                            html: `
                                Le navigateur bloque l'accès direct aux serveurs Kobo depuis ce fichier local.<br><br>
                                <strong>Solutions :</strong><br>
                                1. Installez l'extension <a href="https://chrome.google.com/webstore/detail/allow-cors-access-control/lhobafahddgcelffkeicbagpwh4u" target="_blank" class="text-blue-600 underline">Allow CORS</a> (Recommandé)<br>
                                2. Ou téléchargez vos données Kobo en JSON et glissez le fichier dans la zone d'import.<br>
                                <br>
                                <em class="text-sm text-gray-500">Les proxys publics sont actuellement instables.</em>
                            `,
                            confirmButtonText: 'Compris'
                        });
                    } else {
                        alert("Erreur de sécurité CORS du navigateur. Veuillez utiliser l'import manuel ou installer l'extension 'Allow CORS'.");
                    }
                } else {
                    if (window.Swal) Swal.fire('Erreur', error.message, 'error');
                    else alert(error.message);
                }
            } finally {
                syncActionBtn.innerHTML = '<i class="fas fa-cloud-download-alt mr-2"></i>Lancer Synchronisation';
                syncActionBtn.disabled = false;
            }
        });
    }

    // Action Reset DB
    window.resetMenagesDB = async () => {
        if (confirm("ATTENTION: Cela va effacer toutes les données locales des ménages. Continuer ?")) {
            if (window.db) {
                await window.db.households.clear();
                alert("Base vidée.");
                location.reload();
            }
        }
    };

    // Action Update Status (Global function called by onclick in HTML)
    window.updateStatus = async (newStatus) => {
        const id = document.getElementById('detailId').textContent;
        if (!id || id.includes('MEN-XXXX')) return;

        try {
            if (!window.householdService) throw new Error("Service non disponible");

            await window.householdService.updateHouseholdStatus(id, newStatus, 'terrain-user');

            if (window.Swal) {
                const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
                Toast.fire({ icon: 'success', title: 'Statut mis à jour', text: newStatus });
            } else {
                alert("Statut mis à jour");
            }

            // Refresh data
            await loadHouseholds();
            // Auto-back to list
            document.getElementById('backToListBtn')?.click();

        } catch (error) {
            console.error("Update error:", error);
            alert("Erreur: " + error.message);
        }
    };

    // Premier chargement
    loadHouseholds();

    // Fonction d'export Excel (globale)
    window.exportToExcel = () => {
        try {
            if (!allHouseholds || allHouseholds.length === 0) {
                if (window.Swal) Swal.fire('Info', 'Aucune donnée à exporter', 'info');
                return;
            }

            // Réappliquer tous les filtres actifs (statut, recherche, zone, équipe)
            let dataToExport = getFilteredData();

            // Mappage
            const rows = dataToExport.map(h => ({
                'ID': h.id,
                'Nom Chef': h.nom_prenom_chef,
                'Téléphone': h.telephone,
                'Statut': h.status,
                'Village': h.quartier_village,
                'Commune': h.commune,
                'Latitude': h.gps_lat,
                'Longitude': h.gps_lon,
                'Équipe Réseau': h.equipe_reseau,
                'Équipe Intérieur': h.equipe_interieur,
                'Date Install': h.date_installation,
                'Infos': h.infos_techniques
            }));

            // Excel Gen
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Menages");
            XLSX.writeFile(wb, `Export_Terrain_${new Date().toISOString().slice(0, 10)}.xlsx`);

            if (window.Swal) {
                const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
                Toast.fire({ icon: 'success', title: 'Export réussi', text: `${rows.length} lignes` });
            }

        } catch (e) {
            console.error('Export error:', e);
            alert('Erreur export: ' + e.message);
        }
    };
});
