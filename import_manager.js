// import_manager.js - Gestion de l'import Excel
// Refactored to use HouseholdRepository ONLY (Single Table Architecture) with Diagnostic Mode
// V4.3: Universal Fuzzy Matching + Tech Info + Split Teams + Dates + Kobo GeoJSON

class ImportManager {
    // Mapping des statuts pour uniformisation
    static STATUS_MAP = {
        // Statut par défaut
        'Attente démarrage': 'attente_demarrage',

        // Étape 1
        'Étape 1: Matériel livré et marqué': 'etape1_termine',
        'Étape 1: Matériel livré (marquage manquant)': 'etape1_partiel',
        'Étape 1: Livraison en cours': 'etape1_en_cours',
        'Non éligible': 'non_eligible',
        'Injoignable': 'injoignable',

        // Étape 2
        'Attente Branchement': 'etape2_termine',
        'Attente Maçon (En cours)': 'etape2_en_cours',

        // Étape 3
        'Attente électricien': 'etape3_termine',
        'Attente Branchement (En cours)': 'etape3_en_cours',

        // Étape 4
        'Attente Controleur': 'etape4_termine',
        'Attente électricien (En cours)': 'etape4_en_cours',

        // Étape 5
        'Conforme': 'conforme',
        'Attente Controleur (En cours)': 'etape5_en_cours',
        'Attente électricien(X)': 'non_conforme'
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
                        household.status = this.normalizeStatus(aggregateState.status);
                    }
                        // Use ImportNormalizer when available to infer admin fields and coords
                        let normalizer = null;
                        try { normalizer = window?.ImportNormalizer || (typeof require !== 'undefined' && require('./src/utils/import_normalizer')); } catch (e) { normalizer = window?.ImportNormalizer || null; }
                        const firstProps = submissions[0].props || {};
                        const locInfo = normalizer ? normalizer.normalizeLocation(firstProps, this.getValue.bind(this)) : {
                            region: this.getValue(firstProps, ['Region', 'C5', 'TYPE_DE_VISITE/region_key']) || 'Non Renseigné',
                            department: 'Non Renseigné',
                            commune: 'Non Renseigné',
                            village: 'Non Renseigné',
                            coordinates: aggregateState.location ? { latitude: aggregateState.location.latitude, longitude: aggregateState.location.longitude } : null,
                            warnings: []
                        };

                        if (locInfo.warnings && locInfo.warnings.length) console.warn(`ImportNormalizer warnings for ${koboId}:`, locInfo.warnings);
                        // Build and sanitize location
                        const rawLoc = {
                            region: locInfo.region,
                            department: locInfo.department || 'Non Renseigné',
                            commune: locInfo.commune || 'Non Renseigné',
                            village: locInfo.village || 'Non Renseigné',
                            coordinates: locInfo.coordinates || (aggregateState.location ? { latitude: aggregateState.location.latitude, longitude: aggregateState.location.longitude } : null),
                            zoneId: 'Non assigné'
                        };

                        const sanitizedLoc = (typeof sanitizeLocation === 'function') ? sanitizeLocation(rawLoc) : rawLoc;

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
                // Logique de validation de la progression
                const etapes = {
                    livreur: submissions.some(s => s.props['role']?.toLowerCase().includes('livreur') || s.props['TYPE_DE_VISITE/role']?.toLowerCase().includes('livreur')),
                    macon: submissions.some(s => s.props['role']?.toLowerCase().includes('macon') || s.props['TYPE_DE_VISITE/role']?.toLowerCase().includes('macon')),
                    reseau: submissions.some(s => s.props['role']?.toLowerCase().includes('reseau') || s.props['TYPE_DE_VISITE/role']?.toLowerCase().includes('reseau')),
                    interieur: submissions.some(s => s.props['role']?.toLowerCase().includes('interieur') || s.props['TYPE_DE_VISITE/role']?.toLowerCase().includes('interieur')),
                    controleur: submissions.some(s => s.props['role']?.toLowerCase().includes('controleur') || s.props['TYPE_DE_VISITE/role']?.toLowerCase().includes('controleur'))
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
                        maybe.then(c => { el.textContent = `${(c||0).toLocaleString()} ménages en base`; }).catch(() => {});
                    } else {
                        el.textContent = `${(maybe||0).toLocaleString()} ménages en base`;
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
        const findCol = (row, patterns) => {
            const clean = (k) => k.trim().toLowerCase();
            const key = Object.keys(row).find(k => {
                const normalized = clean(k);
                return patterns.some(p => {
                    if (p instanceof RegExp) return p.test(normalized);
                    return normalized === p.toLowerCase();
                });
            });
            return key ? row[key] : null;
        };

        // ETAPE 1 : Pré-analyse des coordonnées pout diagnostic
        const tempHouseholds = data.map((row, index) => {
            // ===== COORDONNÉES GPS (Détection Améliorée) =====
            const lat = this.parseCoordinate(findCol(row, [/^(latitude|lat|gps_lat|gps lat|y)$/]));
            const lon = this.parseCoordinate(findCol(row, [/^(longitude|lon|gps_lon|gps lon|lng|x)$/]));

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
        const sanitizeLocation = (loc) => {
            if (!loc) return { region: 'Non Renseigné', department: 'Non Renseigné', commune: 'Non Renseigné', village: '', coordinates: null, zoneId: 'Non assigné' };
            const region = (loc.region || loc.region === 0) ? String(loc.region) : 'Non Renseigné';
            const department = (loc.department || loc.department === 0) ? String(loc.department) : 'Non Renseigné';
            const commune = (loc.commune || loc.commune === 0) ? String(loc.commune) : 'Non Renseigné';
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
        };

        const households = tempHouseholds.map(({ row, coordinates, findCol }, index) => {
            // ===== IDENTIFIANT =====
            const idVal = findCol(row, ['id', 'identifiant', 'code', 'ref', 'menage_id']);
            const id = idVal ? String(idVal).trim() : `MEN-${String(index+1).padStart(3,'0')}`;

            // ===== LOCALISATION =====
            // Use ImportNormalizer when available to infer admin fields and coords
            let normalizer = null;
            try { normalizer = window?.ImportNormalizer || (typeof require !== 'undefined' && require('./src/utils/import_normalizer')); } catch (e) { normalizer = window?.ImportNormalizer || null; }
            const locInfo = normalizer ? normalizer.normalizeLocation(row, findCol) : {
                region: findCol(row, ['region', 'reg']) || 'Non Renseigné',
                department: findCol(row, ['departement', 'dept', 'dep']) || 'Non Renseigné',
                commune: findCol(row, ['commune', 'com']) || 'Non Renseigné',
                village: findCol(row, ['village', 'quartier', 'quartier ou village', 'village/quartier', 'localite', 'site']) || '',
                coordinates: coordinates
            };

            if (locInfo.warnings && locInfo.warnings.length) console.warn('ImportNormalizer warnings for row', index, locInfo.warnings);

            const region = locInfo.region;
            const department = locInfo.department;
            const commune = locInfo.commune;
            const village = locInfo.village;
            // Prefer coordinates inferred by normalizer when present
            if (locInfo.coordinates) coordinates = locInfo.coordinates;

            // ===== ÉQUIPES (V4.2 Spécifique) =====
            const equipeRes = findCol(row, ['equipe_reseau', 'equipe reseau', 'res_team', 'reseau']) ||
                findCol(row, ['equipe', 'team', 'groupe', 'technicien', 'instalateur']) || '';

            const equipeInt = findCol(row, ['equipe_interieur', 'equipe interieur', 'int_team', 'interieur', 'equipe_int']) || '';

            // ===== STATUT =====
            const statut = findCol(row, ['statut', 'status', 'statut_installation', 'etat', 'avancement', 'situation']) || 'Attente démarrage';

            // ===== DATES =====
            const dateMaj = findCol(row, ['date', 'date_installation', 'date_visite', 'maj', 'updated_at']) || '';
            const datePrev = findCol(row, ['date_prevue', 'date_prevue_livraison', 'prevision', 'deadline', 'date_livraison']) || '';

            // ===== CIN =====
            const cin = findCol(row, ['cin', 'niche', 'cni', 'identite']) || '';

            // ===== INFOS TECHNIQUES / COMMENTAIRES =====
            const infos = findCol(row, ['infos', 'info', 'tech', 'technique', 'commentaire', 'obs', 'observation', 'materiel', 'puissance']) || '';

            // === CRÉATION ENTITÉ HOUSEHOLD ===
            const locationData = sanitizeLocation({ region, department, commune, village, coordinates, zoneId: findCol(row, ['zone', 'secteur', 'bassin']) || 'Non assigné' });

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
        for (let i = 0; i < households.length; i++) {
            const household = households[i];

            try {
                console.log(`ImportManager: attempting save for household ${household.id}`);
                const existing = await window.householdRepository.findById(household.id);

                if (existing) {
                    // console.log(`📝 Updating: ${household.id}`);
                    updatedCount++;
                } else {
                    // console.log(`➕ Adding: ${household.id}`);
                    insertedCount++;
                }

                try {
                    await window.householdRepository.save(household);
                    console.log(`ImportManager: saved household ${household.id}`);
                } catch (saveErr) {
                    console.error(`ImportManager: failed to save household ${household.id}`, saveErr);
                    throw saveErr;
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
        const role = (this.getValue(props, ['TYPE_DE_VISITE/role', 'role', 'Votre Role']) || '').toLowerCase();

        // DEBUG ROLE (décommenter pour tester)
        // console.log('Rôle détecté:', role, 'de props:', props['Votre Role'], props['role']);

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

        // --- DÉTERMINATION STATUT SÉQUENTIEL (V5 - GOLD STANDARD) ---

        // 1. LIVREUR
        if (role.includes('livreur')) {
            const situation = this.getValue(props, ['Situation du Ménage', 'group_wu8kv54/Situation_du_M_nage']);

            if (['menage_eligible', 'Ménage éligible'].includes(situation)) {
                // Validation Complète
                const remiseOK = this.getValue(props, ['Je confirme la remise du materiel au ménage', 'group_wu8kv54/group_sy9vj14/Je_confirme_la_remis_u_materiel_au_m_nage']);
                const marquageOK = this.getValue(props, ['Je confirme le marquage de l\'emplacement des coffret électrique', 'Je_confirme_le_marqu_s_coffret_lectrique', 'group_wu8kv54/group_sy9vj14/Je_confirme_le_marqu_s_coffret_lectrique']);

                if (remiseOK === 'OK' && marquageOK === 'OK') {
                    state.status = 'Étape 1: Matériel livré et marqué'; // Next: Maçon
                } else if (remiseOK === 'OK') {
                    state.status = 'Étape 1: Matériel livré (marquage manquant)';
                } else {
                    state.status = 'Étape 1: Livraison en cours';
                }

                // Tech Notes (FULL)
                const c25 = this.getValue(props, ['Longueur Cable 2,5mm² Intérieure', 'Longueur_Cable_2_5mm_Int_rieure', 'group_wu8kv54/group_sy9vj14/Longueur_Cable_2_5mm_Int_rieure']);
                const c15 = this.getValue(props, ['Longueur Cable 1,5mm² Intérieure', 'Longueur_Cable_1_5mm_Int_rieure', 'group_wu8kv54/group_sy9vj14/Longueur_Cable_1_5mm_Int_rieure']);
                const t4 = this.getValue(props, ['Longueur Tranchée (Cable armé 4mm²)', 'Longueur_Tranch_e_Cable_arm_4mm', 'group_wu8kv54/group_sy9vj14/Longueur_Tranch_e_Cable_arm_4mm']);
                const t15 = this.getValue(props, ['Longueur Tranchée Câble armé 1,5mm²)', 'Longueur_Tranch_e_C_ble_arm_1_5mm', 'group_wu8kv54/group_sy9vj14/Longueur_Tranch_e_C_ble_arm_1_5mm']);

                if (c25 || c15 || t4 || t15) {
                    state.notes.push(`📏 Matériel: Câble 2.5mm²=${c25 || 0}m, 1.5mm²=${c15 || 0}m, Tranchée 4mm²=${t4 || 0}m, 1.5mm²=${t15 || 0}m`);
                }

            } else if (['menage_non_eligible', 'Ménage non éligible'].includes(situation)) {
                state.status = 'Non éligible';
                const justif = this.getValue(props, ['justificatif', 'pr4rq21', 'group_wu8kv54/pr4rq21']);
                if (justif) state.notes.push(`❌ Justificatif: ${justif}`);
            } else if (['menage_injoignable', 'Ménage injoignable'].includes(situation)) {
                state.status = 'Injoignable';
            }
        }

        // 2. MAÇON
        else if (role.includes('macon') || role.includes('maçon')) {
            if (!state.teams.find(t => t.type === 'macon')) state.teams.push({ type: 'macon', name: extractTeam('macon') });

            const kit = this.getValue(props, ['Le kit est-il disponible et complet ?', 'etape_macon/kit_disponible_macon']);

            if (kit === 'oui' || kit === '✅ Oui - Kit maçon disponible') {
                const val = this.getValue(props, ['etape_macon/validation_macon_final']);

                if (val === 'OK') {
                    state.status = 'Attente Branchement'; // Validé, Next: Réseau
                } else {
                    state.status = 'Attente Maçon (En cours)';
                }
            } else if (kit === 'non' || kit === '❌ Non - Kit maçon non disponible') {
                state.notes.push(`[MAÇON] Kit non disponible signalé`);
            }

            // Tech Notes
            const pb = this.getValue(props, ['PROBLEME', 'etape_macon/problemes_travail_macon']);
            if (pb && pb !== 'RAS') state.notes.push(`[PB MAÇON]: ${pb}`);
        }

        // 3. RÉSEAU
        else if (role.includes('reseau')) {
            if (!state.teams.find(t => t.type === 'reseau')) state.teams.push({ type: 'reseau', name: extractTeam('reseau') });

            const murConforme = this.getValue(props, ['Le mur est-il réalisé et conforme ?', 'etape_reseau/verification_mur_reseau']);

            if (murConforme === 'oui' || murConforme === '✅ Oui - Mur conforme') {
                const val = this.getValue(props, ['etape_reseau/validation_reseau_final']);

                if (val === 'OK') {
                    state.status = 'Attente électricien'; // Validé, Next: Interieur
                } else {
                    state.status = 'Attente Branchement (En cours)';
                }
            } else {
                state.notes.push(`[RESEAU] Mur non conforme signalé`);
            }
        }

        // 4. INTÉRIEUR (Installateur)
        else if (role.includes('interieur') || role.includes('installateur')) {
            if (!state.teams.find(t => t.type === 'interieur')) state.teams.push({ type: 'interieur', name: extractTeam('interieur') });

            const branchConforme = this.getValue(props, ['Le branchement est-il réalisé et conforme ?', 'etape_interieur/verification_branchement_interieur']);

            if (branchConforme === 'oui' || branchConforme === '✅ Oui - Branchement conforme') {
                const val = this.getValue(props, ['etape_interieur/validation_interieur_final']);

                if (val === 'OK') {
                    state.status = 'Attente Controleur'; // Validé, Next: Controleur
                } else {
                    state.status = 'Attente électricien (En cours)';
                }
            } else {
                state.notes.push(`[INTERIEUR] Branchement non conforme signalé`);
            }
        }

        // 5. CONTRÔLEUR
        else if (role.includes('controleur') || role.includes('contrôleur')) {
            const val = this.getValue(props, ['etape_controleur/validation_controleur_final']);
            if (val === 'OK') {
                state.status = 'Conforme';
            } else {
                const etat = this.getValue(props, ['Controle préalable', 'etape_controleur/ETAT_DE_L_INSTALLATION']);
                if (etat && etat.includes('probleme')) state.status = 'Attente électricien(X)'; // Rejet
                else state.status = 'Attente Controleur (En cours)';
            }

            // Observations Détaillées
            const obsKeys = [
                'OBSERVATION???', 'OBSERVATIONS ???', 'OBSERVATIONS???',
                'Observations', 'Observations_001', 'OBSERVATION_001',
                'OBSERVATION_002', 'OBSERVATION_003'
            ];
            obsKeys.forEach(k => {
                const v = this.getValue(props, [k]);
                if (v && v !== 'RAS' && v !== 'NC') state.notes.push(`🔍 [CONTRÔLE - ${k}]: ${v}`);
            });

            // Resistance Terre
            const terre = this.getValue(props, ['VALEUR DE LA RESISTANCE DE TERRE OU DE BOUCLE', 'etape_controleur/VALEUR_DE_LA_RESISTANCE_DE_TER']);
            if (terre) state.notes.push(`⚡ Résistance de terre: ${terre} Ohm`);
        }

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
            state.notes.push(`${new Date(submission.submissionTime).toLocaleDateString()} [${role.toUpperCase()}]: ${note}`);
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
    }
}

// Initialisation
window.importManager = new ImportManager();
