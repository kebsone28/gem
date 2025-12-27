// import_manager.js - Gestion de l'import Excel
// Refactored to use HouseholdRepository ONLY (Single Table Architecture) with Diagnostic Mode
// V4.3: Universal Fuzzy Matching + Tech Info + Split Teams + Dates + Kobo GeoJSON

class ImportManager {
    // Mapping des statuts pour uniformisation
    // Mapping des statuts pour uniformisation (Clé = Statut UI, Valeur = Code Interne)
    // Mapping des statuts pour uniformisation (Clé = Inport/Logique, Valeur = UI StatusColors)
    static STATUS_MAP = {
        // 0. Initial
        'Attente démarrage': 'Attente démarrage',
        'attente_demarrage': 'Attente démarrage',

        'Inéligible': 'Inéligible',
        'non_eligible': 'Inéligible',
        'Ménage non éligible': 'Inéligible',

        'Injoignable': 'Injoignable',
        'injoignable': 'Injoignable',
        'Ménage injoignable': 'Injoignable',

        // 1. Kit -> Maçon
        'Attente Maçon': 'Attente Maçon',
        'etape1_termine': 'Attente Maçon',
        'Kit maçon disponible': 'Attente Maçon',

        // 2. Maçon -> Réseau
        'Attente Branchement': 'Attente Branchement',
        'etape2_termine': 'Attente Branchement',

        // 3. Réseau -> Électricien
        'Attente Électricien': 'Attente électricien', // Mapping vers minuscule pour match StatusColors
        'Attente électricien': 'Attente électricien',
        'etape3_termine': 'Attente électricien',
        'Branchement terminé': 'Attente électricien',

        'Problème Réseau': 'Attente Branchement', // Fallback visuel ou ajouter dans StatusColors
        'probleme_reseau': 'Attente Branchement',

        // 4. Électricien -> Contrôleur
        'Attente Contrôleur': 'Attente Controleur', // Pas de chapeau dans StatusColors
        'Attente Controleur': 'Attente Controleur',
        'etape4_termine': 'Attente Controleur',

        'Problème Intérieur': 'Attente électricien', // Fallback visuel
        'probleme_interieur': 'Attente électricien',

        // 5. Final
        'Conforme': 'Conforme',
        'conforme': 'Conforme',

        'Attente Reprise': 'Attente électricien(X)', // Mapping Error State
        'non_conforme': 'Attente électricien(X)',
        'Attente électricien(X)': 'Attente électricien(X)',

        // Legacy / Fallbacks
        'Non éligible': 'Inéligible',
        'Ménage éligible': 'Attente démarrage'
    };

    constructor() {
        this._fileProcessingStarted = false;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');

        if (dropZone && fileInput) {
            // Drag & Drop events
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('bg-indigo-50', 'border-indigo-500');
            });

            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                dropZone.classList.remove('bg-indigo-50', 'border-indigo-500');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('bg-indigo-50', 'border-indigo-500');
                const files = e.dataTransfer.files;
                if (files.length > 0) this.handleFile(files[0]);
            });

            // File input change
            fileInput.addEventListener('change', (e) => {
                if (this._fileProcessingStarted) return;
                if (e.target.files.length > 0) {
                    this._fileProcessingStarted = true;
                    this.handleFile(e.target.files[0]);
                }
            });

            // Polling fallback: some test runners set files programmatically and
            // the change event may not always be observed. Poll fileInput.files
            // and trigger handleFile once when files are present.
            const pollInterval = 250;
            let pollHandle = null;
            pollHandle = setInterval(() => {
                try {
                    if (this._fileProcessingStarted) { clearInterval(pollHandle); return; }
                    if (fileInput.files && fileInput.files.length > 0) {
                        console.log('ImportManager: fallback poll detected files');
                        this._fileProcessingStarted = true;
                        this.handleFile(fileInput.files[0]);
                        // Clear the file input to avoid duplicate processing in some browsers
                        try { fileInput.value = ''; } catch (e) { /* ignore */ }
                        clearInterval(pollHandle);
                    }
                } catch (e) {
                    // ignore polling errors
                }
            }, pollInterval);
        }
    }

    async handleFile(file) {
        // mark as started to avoid duplicate processing (poll/change)
        this._fileProcessingStarted = true;
        console.log('📂 Traitement du fichier:', file.name);
        this.showProgress(0);
        document.getElementById('importStatus').classList.remove('hidden');

        try {
            // DÉTECTION TYPE FICHIER
            if (file.name.toLowerCase().endsWith('.json') || file.name.toLowerCase().endsWith('.geojson')) {
                await this.handleJsonFile(file);
                return;
            }

            // ... Suite logique Excel existante ...
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { cellDates: true, cellNF: false });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];

            // IMPORTANT: raw: false pour lire les VALEURS évaluées au lieu des formules
            // defval: '' pour remplacer les cellules vides par chaînes vides
            const jsonData = XLSX.utils.sheet_to_json(sheet, {
                raw: false,      // Lire valeurs formatées, pas formules
                defval: '',      // Valeur par défaut pour cellules vides
                blankrows: false // Ignorer lignes vides
            });

            console.log(`📊 ${jsonData.length} lignes trouvées (Excel)`);
            if (jsonData.length > 0) {
                console.log('📋 En-têtes détectés:', Object.keys(jsonData[0]));
            }
            this.showProgress(30);

            await this.processMenages(jsonData);
            this.finalizeImport();

        } catch (error) {
            console.error('Erreur import:', error);
            alert('Erreur lors de l\'import: ' + error.message);
            document.getElementById('importStatus').classList.add('hidden');
        }
    }

    // ===== GESTION KOBO (JSON) =====
    async handleJsonFile(file) {
        const text = await file.text();
        let jsonData;
        try {
            jsonData = JSON.parse(text);
        } catch (e) {
            throw new Error("Fichier JSON invalide");
        }

        // Vérification format Kobo / GeoJSON
        let features = [];
        if (jsonData.type === 'FeatureCollection' && Array.isArray(jsonData.features)) {
            features = jsonData.features;
        } else if (Array.isArray(jsonData)) {
            features = jsonData; // Cas liste simple
        } else {
            throw new Error("Format Kobo non reconnu (pas de FeatureCollection)");
        }

        console.log(`🌍 ${features.length} Entrées Kobo détectées`);
        this.showProgress(30);

        await this.processKoboData(features);
        this.finalizeImport();
    }

    async processKoboData(features) {
        const total = features.length;
        let processed = 0;
        let insertedCount = 0;
        let updatedCount = 0;
        let ignoredCount = 0;
        let lastErrorMessage = "";

        // 1. GROUPEMENT PAR MÉNAGE (Numero_ordre)
        const householdsMap = new Map();

        for (const feature of features) {
            const props = feature.properties || feature;

            // Extraction ID robuste (avec nouveau helper ou inline)
            // On utilise une logique inline ici pour garantir l'indépendance de cette phase
            const getVal = (keys) => {
                for (const k of keys) {
                    if (props[k] !== undefined) return props[k];
                    // Essai auto avec _ (certains exports Kobo)
                    if (props[`_${k}`] !== undefined) return props[`_${k}`];
                }
                return null;
            };

            let koboId = getVal([
                'Numero ordre',
                'Numero_ordre',
                'numero_ordre',
                'Numero ordre (Numero_ordre)'
            ]);

            if (koboId && String(koboId).trim() !== '') {
                // Extraire le nombre (ex: "1.0" → 1, "001" → 1, "2" → 2)
                const num = parseInt(String(koboId).replace(/[^0-9]/g, ''));
                koboId = `MEN-${String(num).padStart(3, '0')}`;
            } else {
                // Fallback ou Ignore - ID Obligatoire pour le groupement
                koboId = props['_uuid'] || getVal(['meta/instanceID', '_id']);
                if (!koboId) continue;
            }

            if (!householdsMap.has(koboId)) {
                householdsMap.set(koboId, []);
            }
            householdsMap.get(koboId).push({
                props: props,
                geom: feature.geometry,
                submissionTime: new Date(props['_submission_time'] || props['start'] || 0).getTime()
            });
        }

        console.log(`🌍 ${householdsMap.size} Ménages uniques identifiés parmi ${total} soumissions.`);

        // 2. TRAITEMENT SÉQUENTIEL PAR MÉNAGE
        for (const [koboId, submissions] of householdsMap) {
            try {
                // TRI CHRONOLOGIQUE
                submissions.sort((a, b) => a.submissionTime - b.submissionTime);

                // RECONSTRUCTION DE L'ÉTAT DU MÉNAGE
                let aggregateState = {
                    status: 'Attente démarrage',
                    location: null,
                    owner: { name: 'Inconnu', phone: '' },
                    teams: [],
                    notes: [],
                    photos: [],
                    history: []
                };

                // MACHINE À ÉTATS
                for (const sub of submissions) {
                    this.applySubmissionToState(aggregateState, sub);
                }

                // 3. PERSISTANCE
                let household = await window.householdRepository.findById(koboId);

                if (household) {
                    // UPDATE
                    console.log(`🔄 Update Kobo Multi pour ${koboId} (${aggregateState.status})`);

                    if (typeof household.updateStatus === 'function') {
                        const normalizedStatus = this.normalizeStatus(aggregateState.status);
                        household.updateStatus(normalizedStatus, 'Synchro Kobo (Multi)');
                    } else {
                        // Fallback if updateStatus is missing (unlikely for Household instance)
                        const normalizedStatus = this.normalizeStatus(aggregateState.status);
                        // If setter exists or this is a raw object
                        try { household.status = normalizedStatus; } catch (e) { /* ignore */ }
                    }
                    // Use ImportNormalizer when available to infer admin fields and coords
                    let normalizer = null;
                    try { normalizer = window?.ImportNormalizer || (typeof require !== 'undefined' && require('./src/utils/import_normalizer')); } catch (e) { normalizer = window?.ImportNormalizer || null; }
                    const firstProps = submissions[0].props || {};
                    const regionVal = this.getValue(firstProps, ['Region', 'region', 'C5', 'TYPE_DE_VISITE/region_key']) || 'Non Renseigné';

                    const locInfo = normalizer ? normalizer.normalizeLocation(firstProps, this.getValue.bind(this)) : {
                        region: regionVal,
                        department: this.getValue(firstProps, ['Departement', 'departement', 'C6', 'TYPE_DE_VISITE/departement_key']) || regionVal,
                        commune: this.getValue(firstProps, ['Commune', 'commune', 'C7', 'TYPE_DE_VISITE/commune_key']) || regionVal,
                        village: this.getValue(firstProps, ['Village', 'village', 'quartier', 'Quartier', 'C8', 'TYPE_DE_VISITE/village_key']) || regionVal,
                        coordinates: aggregateState.location ? { latitude: aggregateState.location.latitude, longitude: aggregateState.location.longitude } : null,
                        warnings: []
                    };

                    if (locInfo.warnings && locInfo.warnings.length) console.warn(`ImportNormalizer warnings for ${koboId}:`, locInfo.warnings);
                    // Build and sanitize location
                    // FALLBACK: Si Departement/Commune/Village sont vides ou "Non Renseigné", utiliser la Région (Demande Utilisateur)
                    const effectiveRegion = locInfo.region || 'Non Renseigné';
                    const rawLoc = {
                        region: effectiveRegion,
                        department: (locInfo.department && locInfo.department !== 'Non Renseigné') ? locInfo.department : effectiveRegion,
                        commune: (locInfo.commune && locInfo.commune !== 'Non Renseigné') ? locInfo.commune : effectiveRegion,
                        village: (locInfo.village && locInfo.village !== 'Non Renseigné') ? locInfo.village : effectiveRegion,
                        coordinates: locInfo.coordinates || (aggregateState.location ? { latitude: aggregateState.location.latitude, longitude: aggregateState.location.longitude } : null),
                        zoneId: 'Non assigné'
                    };

                    const sanitizedLoc = this._sanitizeLocation(rawLoc);

                    household = window.Household.fromJSON({
                        id: koboId,
                        location: sanitizedLoc,
                        owner: aggregateState.owner,
                        status: this.normalizeStatus(aggregateState.status),
                        assignedTeams: aggregateState.teams,
                        notes: aggregateState.notes,
                        photos: aggregateState.photos,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });


                    // Merge Photos
                    if (aggregateState.photos.length > 0 && typeof household.addPhoto === 'function') {
                        aggregateState.photos.forEach(p => household.addPhoto(p));
                    }

                    if (household.touch) household.touch();
                    await window.householdRepository.save(household);
                    updatedCount++;

                } else {
                    // CREATE
                    const region = this.getValue(submissions[0].props, ['Region', 'C5', 'TYPE_DE_VISITE/region_key']) || 'Non Renseigné';
                    const coords = aggregateState.location ? { latitude: aggregateState.location.latitude, longitude: aggregateState.location.longitude } : null;

                    household = window.Household.fromJSON({
                        id: koboId,
                        location: {
                            region: region,
                            department: 'Non Renseigné',
                            commune: 'Non Renseigné',
                            village: 'Non Renseigné',
                            coordinates: coords,
                            zoneId: 'Non assigné'
                        },
                        owner: aggregateState.owner,
                        status: this.normalizeStatus(aggregateState.status),
                        assignedTeams: aggregateState.teams,
                        notes: aggregateState.notes,
                        photos: aggregateState.photos,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                    await window.householdRepository.save(household);
                    insertedCount++;
                }

            } catch (err) {
                console.warn(`Erreur traitement Kobo ${koboId} `, err);
                lastErrorMessage = err.message;
                ignoredCount++;
            }

            processed++;
            // Approx progress (counting households)
            if (processed % 5 === 0) this.showProgress(30 + Math.round((processed / householdsMap.size) * 70));
        }

        // 4. VALIDATION ET PROGRESSION
        let totalProgress = 0;
        let validatedCount = 0;

        for (const [koboId, submissions] of householdsMap) {
            const household = await window.householdRepository.findById(koboId);
            if (household) {
                // Logique de validation de la progression (Robust)
                const getRole = (s) => {
                    const val = s.props['role'] ||
                        s.props['TYPE_DE_VISITE/role'] ||
                        s.props['Votre Role'] ||
                        s.props['Votre_Role'] ||
                        '';
                    return String(val).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\u{1F300}-\u{1F9FF}]/gu, "").trim();
                };

                const etapes = {
                    livreur: submissions.some(s => getRole(s).includes('livreur')),
                    macon: submissions.some(s => getRole(s).includes('macon')),
                    reseau: submissions.some(s => getRole(s).includes('reseau')),
                    interieur: submissions.some(s => getRole(s).includes('interieur') || getRole(s).includes('installateur')),
                    controleur: submissions.some(s => getRole(s).includes('controleur'))
                };

                // Calculer le pourcentage d'avancement
                const stepsCount = Object.values(etapes).filter(v => v).length;
                const progression = Math.round((stepsCount / 5) * 100);

                // Mettre à jour le ménage avec la progression
                household.progression = progression;
                household.etapesRealisees = etapes;
                await window.householdRepository.save(household);

                totalProgress += progression;
                validatedCount++;
                console.log(`📈 ${koboId}: ${progression}% (${stepsCount}/5 étapes)`);
            }
        }

        const avgProgress = validatedCount > 0 ? Math.round(totalProgress / validatedCount) : 0;

        // DEBUG: Afficher un ménage exemple
        try {
            const debugHouseholdId = 'MEN-002';
            const debugHousehold = await window.householdRepository.findById(debugHouseholdId);
            if (debugHousehold) {
                console.log('🔍 DEBUG MEN-002:', {
                    id: debugHousehold.id,
                    status: debugHousehold.status,
                    notes: debugHousehold.notes?.slice(0, 3),
                    teams: debugHousehold.assignedTeams,
                    progression: debugHousehold.progression
                });
            }
        } catch (e) {
            console.log('Debug MEN-002 non disponible');
        }

        this._lastImportSummary = {
            total: features.length,
            inserted: insertedCount,
            updated: updatedCount,
            ignored: ignoredCount,
            lastError: lastErrorMessage,
            householdsProcessed: validatedCount,
            avgProgress: avgProgress
        };
    }

    // Normaliser les statuts pour la base de données
    normalizeStatus(status) {
        return ImportManager.STATUS_MAP[status] || status;
    }

    finalizeImport() {
        const summary = this._lastImportSummary;
        let msg = `✅ Import terminé avec succès!`;

        if (summary.ignored > 0) msg += `\n\n⚠️ ${summary.ignored} ignorés`;
        msg += `\n\n📊 Stats: \n➕ Ajoutés: ${summary.inserted} \n📝 Mis à jour: ${summary.updated} \nTotal: ${summary.total} `;

        if (summary.householdsProcessed) {
            msg += `\n🏠 Ménages traités: ${summary.householdsProcessed}`;
            msg += `\n📊 Progression moyenne: ${summary.avgProgress || 0}%`;
        }

        if (summary.lastError) msg += `\n\nDernière erreur: ${summary.lastError} `;

        if (window.Swal) {
            window.Swal.fire({
                icon: summary.ignored > 0 ? 'warning' : 'success',
                title: 'Import Terminé',
                text: msg,
                preConfirm: () => { location.reload(); }
            });
        } else {
            alert(msg);
            location.reload();
        }
        const statusEl = document.getElementById('importStatus');
        if (statusEl) statusEl.classList.add('hidden');
        this.updateStats();

        // Ensure DOM counter `#totalMenagesDb` is updated immediately as a fallback
        try {
            const el = document.getElementById('totalMenagesDb');
            if (el) {
                // Prefer in-memory mirror when available
                if (window.__inMemoryData && Array.isArray(window.__inMemoryData.households)) {
                    el.textContent = `${window.__inMemoryData.households.length.toLocaleString()} ménages en base`;
                } else if (window.householdRepository && typeof window.householdRepository.count === 'function') {
                    // count may return a promise
                    const maybe = window.householdRepository.count();
                    if (maybe && typeof maybe.then === 'function') {
                        maybe.then(c => { el.textContent = `${(c || 0).toLocaleString()} ménages en base`; }).catch(() => { });
                    } else {
                        el.textContent = `${(maybe || 0).toLocaleString()} ménages en base`;
                    }
                }
            }
        } catch (e) {
            // ignore
        }
    }

    async processMenages(data) {
        const total = data.length;
        let processed = 0;

        // Vérification architecture
        if (!window.householdRepository || !window.Household) {
            throw new Error("Architecture 'Households' non initialisée. Rechargez la page.");
        }

        console.log('✅ Utilisation exclusive de la table "households"');

        // Helper pour recherche flexible de colonne (avec cache regex possible)
        // Helper pour recherche flexible de colonne (avec cache regex possible)
        const findCol = (row, patterns) => {
            // Normalizer: trim, lowercase, AND strip accents -- Strict string handling
            // This ensures 'État' matches 'etat' but 'username' does NOT match 'name'
            const clean = (k) => k.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            // Clean patterns once if they are strings
            const cleanPatterns = patterns.map(p => (typeof p === 'string') ? clean(p) : p);

            const key = Object.keys(row).find(originalKey => {
                const normalizedKey = clean(originalKey);
                return cleanPatterns.some((pattern) => {
                    // 1. Regex Match (Explicit Partial/Fuzzy via Regex)
                    if (pattern instanceof RegExp) return pattern.test(normalizedKey);

                    // 2. Strict String Match (Normalized)
                    if (normalizedKey === pattern) return true;

                    // Note: REMOVED .includes() fallback to prevent false positives
                    return false;
                });
            });
            return key ? row[key] : null;
        };

        // ETAPE 1 : Pré-analyse des coordonnées pout diagnostic
        const tempHouseholds = data.map((row, index) => {
            // ===== COORDONNÉES GPS (Détection Améliorée pour Kobo) =====
            // On cherche 'latitude' ou 'longitude' n'importe où dans la clé (ex: 'TYPE_DE_VISITE/latitude_key')
            const lat = this.parseCoordinate(findCol(row, [/latitude/i, /lat/i, /gps_lat/i, /^y$/i]));
            const lon = this.parseCoordinate(findCol(row, [/longitude/i, /lon/i, /gps_lon/i, /^x$/i]));

            // Précision (optionnel)
            const precVal = findCol(row, ['precision', 'prec', 'gps_prec']);
            const precision = parseFloat(String(precVal || 0).replace(',', '.'));

            const coordinates = (lat !== 0 && lon !== 0) ? {
                latitude: lat,
                longitude: lon,
                precision: precision
            } : null;

            // On passe findCol dans l'objet retourné pour réutilisation en Etape 2
            return { row, coordinates, findCol };
        });

        // Diagnostic : Compter combien ont des coordonnées valides
        const validCoordsCount = tempHouseholds.filter(h => h.coordinates).length;

        if (total > 0 && validCoordsCount === 0) {
            const headers = data.length > 0 ? Object.keys(data[0]).join(', ') : 'Aucun';
            const msg = `⚠️ PROBLÈME GPS DÉTECTÉ\n\n` +
                `Aucun ménage n'a de coordonnées lisibles sur ${total} lignes.\n` +
                `Les points ne s'afficheront PAS sur la carte.\n\n` +
                `Colonnes trouvées dans votre fichier :\n[ ${headers} ]\n\n` +
                `👉 Solution : Renommez vos colonnes GPS en "Latitude" et "Longitude".`;
            alert(msg);
        } else {
            console.log(`✅ ${validCoordsCount} / ${total} ménages ont des coordonnées valides.`);
        }

        // ETAPE 2 : Création des entités finales
        // Helper: sanitize location object for Household.fromJSON
        // This helper is now a class method: this._sanitizeLocation

        const households = tempHouseholds.map(({ row, coordinates, findCol }, index) => {
            // ===== IDENTIFIANT =====
            // On ne prend PAS _id ou uuid car ils changent à chaque modification de la soumission Kobo.
            const idVal = findCol(row, ['id', 'identifiant', 'code', 'ref', 'menage_id', 'Numero_ordre', 'numero_ordre']);

            // Nettoyage de l'ID : Standardisation MEN-XXX pour correspondre à l'import Kobo
            let safeId = idVal ? String(idVal).trim() : null;

            // Si l'ID est numérique (ex: "1" ou "1.0"), on le formate en MEN-001
            if (safeId && !isNaN(parseFloat(safeId)) && isFinite(safeId)) {
                const num = parseInt(String(safeId).replace(/[^0-9]/g, ''));
                safeId = `MEN-${String(num).padStart(3, '0')}`;
            }

            const id = safeId || `MEN-${String(index + 1).padStart(3, '0')}`;

            // ===== LOCALISATION =====
            // Use ImportNormalizer when available to infer admin fields and coords
            let normalizer = null;
            try { normalizer = window?.ImportNormalizer || (typeof require !== 'undefined' && require('./src/utils/import_normalizer')); } catch (e) { normalizer = window?.ImportNormalizer || null; }
            const locInfo = normalizer ? normalizer.normalizeLocation(row, findCol) : {
                region: findCol(row, ['region', 'reg', 'C5', 'TYPE_DE_VISITE/region_key', 'region_key']) || 'Non Renseigné',
                department: findCol(row, ['departement', 'dept', 'dep', 'C6', 'TYPE_DE_VISITE/departement_key', 'departement_key']) || 'Non Renseigné',
                commune: findCol(row, ['commune', 'com', 'C7', 'TYPE_DE_VISITE/commune_key', 'commune_key']) || 'Non Renseigné',
                village: findCol(row, ['village', 'quartier', 'quartier ou village', 'village/quartier', 'localite', 'site', 'C8', 'TYPE_DE_VISITE/village_key', 'village_key']) || '',
                coordinates: coordinates,
                warnings: []
            };

            if (locInfo.warnings && locInfo.warnings.length) console.warn('ImportNormalizer warnings for row', index, locInfo.warnings);

            // FALLBACK: Uniformisation avec la logique Kobo Import
            // Si Region est dispo mais Dept/Commune/Village manquants, on force la Region (Demande Utilisateur)
            if (locInfo.region && locInfo.region !== 'Non Renseigné') {
                if (!locInfo.department || locInfo.department === 'Non Renseigné') locInfo.department = locInfo.region;
                if (!locInfo.commune || locInfo.commune === 'Non Renseigné') locInfo.commune = locInfo.region;
                if (!locInfo.village || locInfo.village === 'Non Renseigné' || locInfo.village === '') locInfo.village = locInfo.region;
            }

            // Build and sanitize location
            const rawLoc = {
                region: locInfo.region,
                department: locInfo.department || 'Non Renseigné',
                commune: locInfo.commune || 'Non Renseigné',
                village: locInfo.village || 'Non Renseigné',
                coordinates: locInfo.coordinates || null,
                zoneId: findCol(row, ['zone', 'secteur', 'bassin']) || 'Non assigné'
            };

            // ===== ÉQUIPES (V4.2 Spécifique) =====
            const equipeRes = findCol(row, ['equipe_reseau', 'equipe reseau', 'res_team', 'reseau']) ||
                findCol(row, ['equipe', 'team', 'groupe', 'technicien', 'instalateur']) || '';

            const equipeInt = findCol(row, ['equipe_interieur', 'equipe interieur', 'int_team', 'interieur', 'equipe_int']) || '';

            // ===== STATUT =====
            // V4.7: Advanced Status Parsing (Kobo Logic - Unified with applySubmissionToState)
            const determineStatus = (row, findCol) => {
                // Helper: Normalize values (accents + emojis)
                const val = (keys) => String(findCol(row, keys) || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\u{1F300}-\u{1F9FF}]/gu, "").trim();

                // 0. Detect Role (Optional but helps context)
                const role = val(['TYPE_DE_VISITE/role', 'role', 'Votre Role', 'Votre_Role']);

                // DIAGNOSTIC COMPLET POUR L'UTILISATEUR
                if (window._debugOneShot === undefined) {
                    console.log("🔥 --- COMPARAISON DE FORMAT KOBO (PREMIER ENREGISTREMENT) --- 🔥");
                    console.log("Données brutes reçues de Kobo :", JSON.stringify(row, null, 2));
                    console.log("----------------------------------------------------------------");
                    window._debugOneShot = true;
                }

                console.log(`[SYNC SPY] ID: ${findCol(row, ['numero_ordre', 'id'])} Role: "${role}"`);

                // 1. Situation (Inéligible / Injoignable)
                const situation = val(['Situation_du_M_nage', 'situation', 'Situaion', 'Situation du Ménage', 'group_wu8kv54/Situation_du_M_nage']);
                console.log(`[SYNC SPY] Situation: "${situation}"`);

                if (situation.includes('non_eligible') || situation.includes('non eligible') || situation.includes('ineligible')) return 'Inéligible';
                if (situation.includes('injoignable')) return 'Injoignable';

                // 1b. Livreur Validation (If Eligible)
                // Si Situation OK, on vérifie si la livraison est validée pour passer à "Attente Maçon"
                if (role.includes('livreur') || situation.includes('eligible') || situation.includes('ok')) {
                    const remiseOK = val(['Je confirme la remise du materiel au ménage', 'group_wu8kv54/group_sy9vj14/Je_confirme_la_remis_u_materiel_au_m_nage']);
                    const marquageOK = val(['Je confirme le marquage de l\'emplacement des coffret électrique', 'Je_confirme_le_marqu_s_coffret_lectrique', 'group_wu8kv54/group_sy9vj14/Je_confirme_le_marqu_s_coffret_lectrique']);

                    if ((remiseOK === 'ok' || remiseOK === 'oui') && (marquageOK === 'ok' || marquageOK === 'oui')) {
                        return 'Attente Maçon';
                    }
                }

                // 2. Control (Final)
                const etatInstall = val(['ETAT_DE_L_INSTALLATION', 'etat_installation']);
                if (etatInstall.includes('terminee') || etatInstall.includes('conforme')) return 'Conforme';
                if (etatInstall.includes('probleme') || etatInstall.includes('non_conforme')) return 'Attente Reprise';

                // 3. Indoor
                const etatInterieur = val(['etat_installation_interieur', 'Etat_installation_interieur']);
                if (etatInterieur.includes('termine')) return 'Attente Contrôleur';
                if (etatInterieur.includes('probleme')) return 'Problème Intérieur';

                // 4. Network
                const etatReseau = val(['etat_branchement_reseau', 'Etat_branchement_reseau']);
                if (etatReseau.includes('termine')) return 'Attente Électricien';
                if (etatReseau.includes('probleme')) return 'Problème Réseau';

                // 5. Wall
                const typeMur = findCol(row, ['type_mur_realise_macon', 'realisation_mur']); // Check presence often enough
                // Or check explicit validation
                const murFini = val(['Je valide que le mur est terminé et conforme', '\u2705 Je valide que le mur est terminé et conforme']);
                if (murFini === 'ok' || murFini.includes('oui')) return 'Attente Branchement';
                if (typeMur) return 'Attente Branchement';

                // 6. Kit Availability
                const kitDispo = val(['kit_disponible_macon', 'kit_disponible']);
                if (kitDispo.includes('oui')) return 'Attente Maçon';

                // 7. Explicit Status
                const explicitStatus = findCol(row, ['statut', 'status', 'statut_installation', 'etat', 'avancement']);
                if (explicitStatus) return explicitStatus;

                return 'Attente démarrage';
            };

            const statut = determineStatus(row, findCol);

            // ===== DATES =====
            const dateMaj = findCol(row, ['date', 'date_installation', 'date_visite', 'maj', 'updated_at']) || '';
            const datePrev = findCol(row, ['date_prevue', 'date_prevue_livraison', 'prevision', 'deadline', 'date_livraison']) || '';

            // ===== CIN =====
            const cin = findCol(row, ['cin', 'niche', 'cni', 'identite']) || '';

            // ===== INFOS TECHNIQUES / COMMENTAIRES =====
            const infos = findCol(row, ['infos', 'info', 'tech', 'technique', 'commentaire', 'obs', 'observation', 'materiel', 'puissance', 'C12', 'C13', 'C16', 'REMARQUES', 'NOTES', 'TYPE_DE_VISITE/notes_key', 'notes_key', 'observations']) || '';

            // === CRÉATION ENTITÉ HOUSEHOLD ===
            const locationData = this._sanitizeLocation(rawLoc);

            const nom = findCol(row, ['Prénom et Nom', 'C1', 'nom', 'name']) || 'Inconnu';
            const telephone = findCol(row, ['Telephone', 'C3', 'tel', 'telephone', 'phone']) || '';

            const ownerData = { name: nom, phone: telephone, cin };

            const assignedTeams = [];
            if (equipeRes) assignedTeams.push({ type: 'reseau', name: equipeRes });
            if (equipeInt) assignedTeams.push({ type: 'interieur', name: equipeInt });

            const householdData = {
                id,
                location: locationData,
                owner: ownerData,
                status: statut,
                statusHistory: [],
                assignedTeams,
                scheduledDates: datePrev ? { installation: datePrev } : {},
                actualDates: dateMaj ? { derniere_maj: dateMaj } : {},
                notes: infos ? [infos] : [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            try {
                return window.Household.fromJSON(householdData);
            } catch (e) {
                console.error('Error creating household entity:', e, 'householdData.location=', householdData.location);
                return null;
            }
        }).filter(h => h !== null);

        // Stats
        let ignoredCount = total - households.length;

        console.log(`ImportManager: ${households.length} household entities created for insertion (ignored ${ignoredCount})`);
        let insertedCount = 0;
        let updatedCount = 0;

        // INSERTION EN BASE (Table Households UNIQUEMENT)
        // STRICT DEDUPLICATION BY ID ONLY (Simpler, faster, requested by user)
        for (let i = 0; i < households.length; i++) {
            const household = households[i];

            try {
                // Strict check: only ID matters
                const existing = await window.householdRepository.findById(household.id);

                if (existing) {
                    // Update Existant
                    // We preserve existing data unless overwritten by non-empty new data
                    if (household.owner.name) existing.owner.name = household.owner.name;
                    if (household.owner.phone) existing.owner.phone = household.owner.phone;

                    // STATUS UPDATE VIA METHOD
                    if (household.status && household.status !== 'Attente démarrage') {
                        const normalizedStatus = this.normalizeStatus(household.status);
                        if (typeof existing.updateStatus === 'function') {
                            existing.updateStatus(normalizedStatus, 'Mise à jour Import Excel');
                        }
                    }

                    // Location updates (Respect Immutable Value Object pattern)
                    // 1. Get current data as plain object
                    const locData = existing.location.toJSON ? existing.location.toJSON() : { ...existing.location };
                    let locChanged = false;

                    // 2. Merge new values
                    if (household.location.region && household.location.region !== 'Non Renseigné') {
                        locData.region = household.location.region;
                        locChanged = true;
                    }
                    // Handle other fields if needed (department, etc - kept simple for now)

                    if (household.location.coordinates) {
                        const newCoords = household.location.coordinates.toJSON ? household.location.coordinates.toJSON() : household.location.coordinates;
                        locData.coordinates = newCoords;
                        locChanged = true;
                    }

                    // 3. Apply Update if changed
                    if (locChanged && window.Location && typeof window.Location.fromJSON === 'function') {
                        const newLocation = window.Location.fromJSON(locData);
                        existing.updateLocation(newLocation);
                    }

                    // Update timestamps
                    existing.touch(); // Utilise la méthode native de l'entité au lieu de forcer le setter manquant

                    await window.householdRepository.save(existing);
                    updatedCount++;
                } else {
                    // INSERT
                    await window.householdRepository.save(household);
                }

            } catch (error) {
                console.warn(`⚠️ Erreur import ligne ID ${household.id}:`, error.message);
                ignoredCount++;
            }

            processed++;

            if (processed % 10 === 0 || processed === households.length) {
                const progress = 30 + Math.round((processed / total) * 70);
                this.showProgress(progress);
            }
        }

        // Résumé
        this._lastImportSummary = {
            total,
            inserted: insertedCount,
            updated: updatedCount,
            ignored: ignoredCount
        };
    }

    showProgress(percent) {
        const bar = document.getElementById('importProgressBar');
        const text = document.getElementById('importProgressText');
        if (bar && text) {
            bar.style.width = `${percent}%`;
            text.textContent = `${percent}%`;
        }
    }

    updateStats() {
        if (window.DatabaseManager) {
            window.DatabaseManager.getStats().then(stats => {
                const counter = document.getElementById('totalHouseholdsCount');
                if (counter) counter.textContent = stats.menages;
            });
        }
    }

    parseCoordinate(value) {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        // Remplacer virgule par point et nettoyer les caractères invisibles
        return parseFloat(String(value).replace(',', '.').trim()) || 0;
    }

    // Helper pour extraction robuste (supporte les chemins avec slash)
    getNestedValue(obj, path) {
        if (!obj || !path) return null;
        const keys = path.split('/');
        let current = obj;

        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return null;
            }
        }
        return current;
    }

    // Helper plus robuste pour extraire une valeur depuis plusieurs clés possibles
    getValue(props, keys) {
        if (!props || !keys) return null;
        for (const key of keys) {
            // 1. Essai Direct
            if (props[key] !== undefined && props[key] !== '') return props[key];

            // 2. Essai Nested (pour les chemins Kobo type "group/question")
            if (key.includes('/')) {
                const val = this.getNestedValue(props, key);
                if (val !== undefined && val !== '') return val;
            }

            // 3. Essai avec préfixe _ (Kobo ajoute parfois _)
            const koboKey = `_${key}`;
            if (props[koboKey] !== undefined && props[koboKey] !== '') return props[koboKey];
        }
        return null;
    }

    // Helper Description Action
    getActionDescription(role, props) {
        if (!role) return 'Action inconnue';

        if (role.includes('livreur')) {
            const situation = this.getValue(props, ['Situation du Ménage', 'group_wu8kv54/Situation_du_M_nage']);
            return (situation === 'menage_eligible' || situation === 'Ménage éligible')
                ? 'Livraison matériel'
                : `Situation: ${situation || 'Non spécifiée'}`;
        }
        else if (role.includes('macon') || role.includes('maçon')) {
            const kit = this.getValue(props, ['Le kit est-il disponible et complet ?', 'etape_macon/kit_disponible_macon']);
            return (kit === 'oui' || kit?.includes('Oui')) ? 'Construction mur' : 'Kit non disponible';
        }
        else if (role.includes('reseau')) return 'Branchement électrique';
        else if (role.includes('interieur') || role.includes('installateur')) return 'Installation intérieure';
        else if (role.includes('controleur') || role.includes('contrôleur')) return 'Contrôle final';

        return 'Visite technique';
    }


    // LOGIQUE MÉTIER PURE (Machine à états)
    applySubmissionToState(state, submission) {
        const props = submission.props;

        // Helper normalize pour accents et emojis
        // Updated to handle strings like "🛠️ Livreur", "👷 Maçon" etc.
        const simpleClean = (s) => String(s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\u{1F300}-\u{1F9FF}]/gu, "").trim();

        // Value might be just "Livreur" or "🛠️ Livreur"
        // Also check "Équipe Réseau" -> "equipe reseau"
        let role = simpleClean(this.getValue(props, ['TYPE_DE_VISITE/role', 'role', 'Votre Role', 'Votre_Role']));

        // Map UI roles to internal keys if needed
        if (role.includes('livreur')) role = 'livreur';
        else if (role.includes('macon')) role = 'macon';
        else if (role.includes('reseau')) role = 'reseau';
        else if (role.includes('installateur') || role.includes('interieur')) role = 'interieur';
        else if (role.includes('controleur')) role = 'controleur';

        // DEBUG ROLE (décommenter pour tester)
        console.log('Rôle détecté (Clean):', role, ' Brut:', props['Votre Role'] || props['role']);

        // Extraction Équipe
        const extractTeam = (roleType) => {
            const specificKeys = [`equipe_${roleType}`, `nom_equipe_${roleType}`, `team_${roleType}`];
            const specificVal = this.getValue(props, specificKeys);
            if (specificVal) return specificVal;
            return props['username'] || 'Inconnu';
        };

        // Info Base
        const nom = this.getValue(props, ['Prénom et Nom', 'C1', 'TYPE_DE_VISITE/nom_key']);
        const tel = this.getValue(props, ['Telephone', 'C3', 'TYPE_DE_VISITE/telephone_key']);
        if (nom && nom !== 'Inconnu') state.owner.name = nom;
        if (tel) state.owner.phone = tel;

        // GPS ROBUSTE
        const geom = submission.geom || {};
        let lat = 0, lon = 0;
        if (geom.coordinates && Array.isArray(geom.coordinates)) {
            lon = geom.coordinates[0]; lat = geom.coordinates[1];
        } else if (props['_geolocation']) {
            lat = props['_geolocation'][0]; lon = props['_geolocation'][1];
        }

        if (lat && lat !== 0 && lon && lon !== 0) {
            if (window.Coordinates) {
                state.location = new window.Coordinates(lat, lon);
            } else {
                state.location = {
                    latitude: lat,
                    longitude: lon,
                    altitude: geom.coordinates?.[2] || 0,
                    precision: props['_GPS_du_Ménage_precision'] || 0
                };
            }
        }

        // --- DÉTERMINATION STATUT SÉQUENTIEL (V5.1 - ROBUST KOBO IMPORT) ---

        // 1. LIVREUR
        if (role.includes('livreur')) {
            const situationRaw = this.getValue(props, ['Situation du Ménage', 'group_wu8kv54/Situation_du_M_nage']);
            const situation = simpleClean(situationRaw);

            console.log(`[LIVREUR CHECK] ${state.owner.name} SituationRaw: "${situationRaw}" Clean: "${situation}"`);

            // Inéligible
            if (situation.includes('non_eligible') || situation.includes('non eligible') || situation.includes('ineligible')) {
                state.status = 'Inéligible';
                const justif = this.getValue(props, ['justificatif', 'pr4rq21', 'group_wu8kv54/pr4rq21']);
                if (justif) state.notes.push(`❌ Justificatif: ${justif}`);
            }
            // Injoignable
            else if (situation.includes('injoignable')) {
                state.status = 'Injoignable';
            }
            // Éligible -> Vérification Livraison
            else if (situation.includes('eligible') || situation.includes('ok') || situation.includes('ras')) {
                // Est-ce que le kit est marqué livré ?
                const remiseOK = this.getValue(props, ['Je confirme la remise du materiel au ménage', 'group_wu8kv54/group_sy9vj14/Je_confirme_la_remis_u_materiel_au_m_nage']);
                const marquageOK = this.getValue(props, ['Je confirme le marquage de l\'emplacement des coffret électrique', 'Je_confirme_le_marqu_s_coffret_lectrique', 'group_wu8kv54/group_sy9vj14/Je_confirme_le_marqu_s_coffret_lectrique']);

                console.log(`[LIVREUR CHECK] Remise: "${remiseOK}" Marquage: "${marquageOK}"`);

                if ((remiseOK === 'OK' || remiseOK === 'Oui') && (marquageOK === 'OK' || marquageOK === 'Oui')) {
                    state.status = 'Attente Maçon';
                } else {
                    state.status = 'Attente démarrage';
                }

                // Tech Notes
                const c25 = this.getValue(props, ['Longueur Cable 2,5mm² Intérieure', 'Longueur_Cable_2_5mm_Int_rieure']);
                if (c25) state.notes.push({
                    content: `📏 Matériel noté lors de la livraison`,
                    date: new Date(submission.submissionTime),
                    author: 'System'
                });
            }
        }

        // 2. MAÇON
        else if (role.includes('macon')) {
            if (!state.teams.find(t => t.type === 'macon')) state.teams.push({ type: 'macon', name: extractTeam('macon') });

            const kitRaw = this.getValue(props, ['Le kit est-il disponible et complet ?', 'etape_macon/kit_disponible_macon']);
            const kit = simpleClean(kitRaw);

            console.log(`[MACON CHECK] KitRaw: "${kitRaw}" Clean: "${kit}"`);

            if (kit.includes('oui') || kit.includes('yes')) {
                const murFiniRaw = this.getValue(props, ['Je valide que le mur est terminé et conforme', '\u2705 Je valide que le mur est terminé et conforme']);
                const murFini = simpleClean(murFiniRaw);

                console.log(`[MACON CHECK] MurFiniRaw: "${murFiniRaw}" Clean: "${murFini}"`);

                if (murFini.includes('ok') || murFini.includes('oui')) {
                    state.status = 'Attente Branchement';
                } else {
                    state.status = 'Attente Maçon';
                }
            } else if (kit.includes('non')) {
                state.notes.push({
                    content: `[MAÇON] Kit non disponible signalé`,
                    date: new Date(submission.submissionTime),
                    author: 'System'
                });
                // Reste au statut précédent ou erreur
            }
        }

        // 3. RÉSEAU
        else if (role.includes('reseau')) {
            if (!state.teams.find(t => t.type === 'reseau')) state.teams.push({ type: 'reseau', name: extractTeam('reseau') });

            const branchementFini = simpleClean(this.getValue(props, ['Etat du branchement', '\u00c9tat du branchement', 'etat_branchement_reseau']));

            if (branchementFini.includes('termine') || branchementFini.includes('realise')) {
                const val = this.getValue(props, ['Je valide que le branchement est terminé et conforme', '\u2705 Je valide que le branchement est terminé et conforme']);
                if (val === 'OK') {
                    state.status = 'Attente Électricien'; // Next: Intérieur
                } else {
                    state.status = 'Attente Branchement';
                }
            } else if (branchementFini.includes('probleme')) {
                state.status = 'Problème Réseau';
            }
        }

        // 4. INTÉRIEUR (Installateur)
        else if (role.includes('interieur') || role.includes('installateur')) {
            if (!state.teams.find(t => t.type === 'interieur')) state.teams.push({ type: 'interieur', name: extractTeam('interieur') });

            const installFini = simpleClean(this.getValue(props, ['etat_installation_interieur', 'Etat installation intérieure']));

            if (installFini.includes('termine')) {
                state.status = 'Attente Contrôleur';
            } else if (installFini.includes('probleme')) {
                state.status = 'Problème Intérieur';
            }
        }

        // 5. CONTRÔLEUR
        else if (role.includes('controleur')) {
            const etatInstall = simpleClean(this.getValue(props, ['ETAT_DE_L_INSTALLATION', "Etat de l'installation"]));

            if (etatInstall.includes('terminee') || etatInstall.includes('conforme')) {
                state.status = 'Conforme';
            } else if (etatInstall.includes('probleme') || etatInstall.includes('non_conforme')) {
                state.status = 'Attente Reprise';
            }

            // Observations Détaillées
            const obsKeys = [
                'OBSERVATION???', 'OBSERVATIONS ???', 'OBSERVATIONS???',
                'Observations', 'Observations_001', 'OBSERVATION_001'
            ];
            obsKeys.forEach(k => {
                const v = this.getValue(props, [k]);
                if (v && v !== 'RAS' && v !== 'NC') state.notes.push(`🔍 [CONTRÔLE - ${k}]: ${v}`);
            });
        }      // Resistance Terre
        const terre = this.getValue(props, ['VALEUR DE LA RESISTANCE DE TERRE OU DE BOUCLE', 'etape_controleur/VALEUR_DE_LA_RESISTANCE_DE_TER']);
        if (terre) state.notes.push(`⚡ Résistance de terre: ${terre} Ohm`);


        // HISTORIQUE (Avec Dates)
        if (state.history) {
            state.history.push({
                date: new Date(submission.submissionTime).toISOString(), // ISO for storage
                role: role,
                status: state.status,
                agent: props['username'] || 'Non spécifié',
                action: this.getActionDescription(role, props)
            });
        }

        // Notes (Accumulation)
        const note = props['notes_generales'] || props['Observations'];
        if (note && note !== 'RAS' && note !== 'NC') {
            state.notes.push({
                content: `${note} [${role.toUpperCase()}]`,
                date: new Date(submission.submissionTime),
                author: 'Kobo Import'
            });
        }

        // PHOTOS (Extraction Smart)
        if (props['_attachments'] && Array.isArray(props['_attachments'])) {
            props['_attachments'].forEach(att => {
                let photoType = 'Autre';
                if (role.includes('livreur')) photoType = 'Preuve Livraison';
                else if (role.includes('macon')) photoType = 'Travaux Maçonnerie';
                else if (role.includes('interieur')) photoType = 'Installation Intérieure';
                else if (role.includes('reseau')) photoType = 'Branchement Réseau';
                else if (role.includes('controleur')) photoType = 'Attestation Conformité';

                const url = att.download_url || att.download_small_url;
                if (url) {
                    state.photos.push({
                        url: url,
                        type: photoType,
                        date: new Date(submission.submissionTime),
                        author: role.toUpperCase()
                    });
                }
            });
        }

        // Single Photo field fallback
        const singlePhoto = this.getValue(props, ['Photo', '_1_photo_anomalie_si_possible']);
        if (singlePhoto && !state.photos.find(p => p.url === singlePhoto)) {
            state.photos.push({
                url: singlePhoto,
                type: 'Photo ' + role,
                date: new Date(submission.submissionTime),
                author: role.toUpperCase()
            });
        }
        // 6. GENERIC COMMENTS / NOTES (Pour toutes les étapes)
        // Demande utilisateur: "Pour l'imp KOBO AUSSI"
        // 6. GENERIC COMMENTS / NOTES (Pour toutes les étapes)
        // Demande utilisateur: "Pour l'imp KOBO AUSSI"
        const genericNotes = this.getValue(props, ['infos', 'info', 'tech', 'technique', 'commentaire', 'obs', 'observation', 'materiel', 'puissance', 'C12', 'C13', 'C16', 'REMARQUES', 'NOTES', 'TYPE_DE_VISITE/notes_key', 'notes_key', 'observations']);
        if (genericNotes && String(genericNotes).trim() !== '') {
            state.notes.push({
                content: `🗒️ ${String(genericNotes).trim()}`,
                date: new Date(submission.submissionTime),
                author: 'Kobo Comments'
            });
        }

        // Return the updated state
        return state;
    }

    /**
     * Nettoie les données brutes pour éviter les objets vides
     */
    _sanitizeLocation(loc) {
        if (!loc) return { region: 'Non Renseigné', department: 'Non Renseigné', commune: 'Non Renseigné', village: '', coordinates: null, zoneId: 'Non assigné' };

        const cleanStr = (v) => (v === undefined || v === null) ? 'Non Renseigné' : String(v);

        const region = cleanStr(loc.region);
        const department = cleanStr(loc.department);
        const commune = cleanStr(loc.commune);
        const village = loc.village || '';
        let coordinates = null;
        if (loc.coordinates) {
            try {
                const lat = parseFloat(String(loc.coordinates.latitude).replace(',', '.'));
                const lon = parseFloat(String(loc.coordinates.longitude).replace(',', '.'));
                if (!Number.isNaN(lat) && !Number.isNaN(lon) && lat !== 0 && lon !== 0) {
                    coordinates = { latitude: lat, longitude: lon, precision: loc.coordinates.precision || 0 };
                }
            } catch (e) {
                coordinates = null;
            }
        }
        return { region, department, commune, village, coordinates, zoneId: loc.zoneId || 'Non assigné' };
    }
}

// Initialisation
window.importManager = new ImportManager();
