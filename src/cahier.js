// Global settings accessible by all functions in this file
let CAHIER_SETTINGS = {};

(() => {
    const TASK_LIBRARY = {
        'Préparateur': {
            missions: [
                'Précâbler les coffrets principaux : installation des disjoncteurs, connecteurs et filerie selon schéma type.',
                'Organiser et charger l’ensemble du matériel dans les véhicules du transporteur (optimisation espace).',
                'Renseigner l’application sur le nombre de kits finalisés et le nombre effectivement chargé sur camion.',
                'Contrôler la complétude de chaque kit et tracer les numéros de série (Tablette).',
                'Étiqueter et conditionner les kits par ménage pour faciliter la livraison terrain.'
            ],
            livrables: ['Kits précâblés & conformes', 'Inventaire de chargement signé', 'Rapport de stock à jour'],
            jalons: ['Coffrets câblés avant J-1', 'Chargement terminé avant 7h00'],
            kpi: ['Kits finalisés/jour', 'Taux de chargement conforme', 'Zéro kit manquant au départ'],
            hse: ['Port des gants de manutention', 'Poste de câblage ergonomique', 'Sécurisation des charges dans le camion']
        },
        'Livreur': {
            missions: [
                'Charger les kits selon le planning et assurer la traçabilité (scan / feuille de route).',
                'Livrer chaque kit au ménage ciblé et obtenir accusé de réception signé.',
                'Signaler les anomalies terrain (absence, accès, refus) et replanifier.',
                'Assurer le retour des emballages et documents signés au dépôt.'
            ],
            livrables: ['Feuille de route signée', 'Accusés de réception (BL)', 'Rapport d’anomalies'],
            jalons: ['Tournée journalière terminée', '100 % kits déposés / zone planifiée'],
            kpi: ['Livraisons réussies/jour', 'Taux d’anomalies (%)'],
            hse: ['Chaussures de sécurité obligatoires', 'Vigilance routière et arrimage du chargement']
        },
        'Maçon': {
            missions: [
                'Réaliser d\'un pan de mur pour support coffret compteur par ménage (solution cheminée).',
                'Fondation : Creuser 70×70 cm sur 50 cm de profondeur. Béton de propreté 10 cm.',
                'Montage mur : ~40 briques creuses + 8 briques pleines (20x15x40 cm).',
                'Scellement Potelet : Verticalité parfaite, queue de cochon orientée vers le réseau.',
                'Finitions : Remplissage béton (bas/haut) et sable compacté (milieu).',
                'Nettoyage du site et évacuation des gravats.'
            ],
            livrables: ['Muret support conforme', 'Fiche génie civil signée', 'Photos (Fondation + Mur fini)'],
            jalons: ['Fouilles terminées', 'Muret finalisé et sec pour électricien'],
            kpi: ['Murs terminés/jour', 'Qualité du dosage béton'],
            hse: ['Port du casque et gants', 'Balisage de la fouille si laissée ouverte', 'Utilisation d\'eau potable pour le mélange']
        },
        'Réseau': {
            missions: [
                'Installation et raccordement au réseau du coffret compteur par ménage.',
                'Pose Potelet Galva 4m avec tous les accessoires (Bride, Arrêtoir, Queue de cochon, Coude Ф25).',
                'Tirage Câble Préassemblé 2x16mm² (Portée max 20m) entre poteau et potelet.',
                'Pose des connecteurs CPB1/CT70 et de la pince d’ancrage 25.',
                'Vérification mécanique des fixations et étanchéité du coude.'
            ],
            livrables: ['Branchement extérieur opérationnel', 'Schéma de raccordement', 'Fiche technique'],
            jalons: ['Branchement mécaniquement stable', 'Continuité vérifiée jusqu\'au coffret'],
            kpi: ['Branchements/jour', 'Taux de reprises sur connectique'],
            hse: ['Harnais de sécurité pour travaux en hauteur', 'Vérification absence de tension sur support', 'Gants isolants BT']
        },
        'Intérieur': {
            missions: [
                'Installation et raccordement du Coffret modulaire du kit principal.',
                'Pose appareillage : 1 Hublot, 1 lampe LBC, 1 douille IP23, 2 interrupteurs, 1 prise.',
                'Câblage : Câble 3x1,5mm² (4m) et protection par modulaires C10, C20, Diff 25A/30mA.',
                'Réalisation de tranchées (30x50cm) et pose de grillage avertisseur pour câble FRN05 VV-U 2x6 mm².',
                'Mise à la terre : Piquet 1,5m, conducteur Cu nu Ф25mm (3m), barrette et fil TH 6mm².',
                'Installation kit secondaire (si prévu) : Lampe, interrupteur, câble armé 3x1,5mm² (10m).'
            ],
            livrables: ['Tableau intérieur opérationnel', 'PV de mise à la terre', 'Installation intérieure finie'],
            jalons: ['Tranchées rebouchées', 'Test différentiel OK', 'Brief sécurité usager'],
            kpi: ['Maisons terminées/jour', 'Valeur de la prise de terre (< 50 Ohms)'],
            hse: ['Lunettes de protection pour perçage', 'Vérification serrage bornes', 'Nettoyage poussières']
        },
        'Contrôleur': {
            missions: [
                'Contrôle de conformité, suivi et reporting des travaux par ménage.',
                'Vérification visuelle (Génie civil) et mesures électriques (Réseau/Intérieur).',
                'Validation de la mise à la terre et du bon fonctionnement du différentiel.',
                'Signature du PV de réception avec l\'usager et le chef d\'équipe.',
                'Photos systématiques des points critiques avant fermeture.'
            ],
            livrables: ['PV de conformité signé', 'Rapport de non-conformité (si réserve)', 'Reporting quotidien'],
            jalons: ['Contrôles journaliers validés', 'Levée des réserves constatées'],
            kpi: ['Taux d\'acceptation au 1er passage', 'Délai de traitement des réserves'],
            hse: ['Vérification des EPI des équipes', 'Interdiction de mise sous tension si danger']
        },
        'Superviseur': {
            missions: [
                'Coordonner les équipes sur zone (Kaffrine/Tamba) et valider le planning.',
                'Gestion de l\'interface avec LSE pour l\'approvisionnement matériel.',
                'Arbitrer les conflits techniques et valider les modifications de parcours.',
                'Garantir l\'application stricte des règles HSE sur l\'ensemble du chantier.',
                'Consolider le reporting hebdomadaire pour la direction.'
            ],
            livrables: ['Rapport de pilotage', 'Planning consolidé', 'Bilan HSE'],
            jalons: ['Réunion hebdomadaire de zone', 'Audit sécurité inopiné'],
            kpi: ['Progression globale vs Cible', 'Taux d\'accidents du travail (Zéro cible)'],
            hse: ['Leadership sécurité', 'Audit constant des outils et véhicules']
        }
    };

    const CHECKLIST_LIBRARY = {
        'Préparateur': [
            'Kits précâblés (Disjoncteurs, Connecteurs, Filerie)',
            'Inventaire chargement complet (Camion/Voiture)',
            'Reporting : Nombre de kits finalisés saisi',
            'Reporting : Nombre de kits chargés saisi',
            'Étiquetage par ménage ok'
        ],
        'Livreur': [
            'Situation du Ménage identifiée (Éligible/Non éligible)',
            'Justificatifs de livraison récupérés',
            'Marquage position Mur & Coffrets validé avec client',
            'Photo de la livraison prise',
            'Matériel remis officiellement'
        ],
        'Maçon': [
            'Kit maçon disponible et complet',
            'Fouille 70x70x50 conforme',
            'Type de Mur : Standard ou Cheminée validé',
            'Verticalité potelet (Niveau)',
            'Validation finale : Mur terminé et sec'
        ],
        'Réseau': [
            'Mur vérifié conforme avant branchement',
            'Pince ancrage 25 bien tendue',
            'Connecteurs CPB1 bien perçés',
            'Étanchéité coude Ø25 (Ciment plâtre)',
            'Branchement validé et fonctionnel'
        ],
        'Intérieur': [
            'Branchement extérieur vérifié conforme',
            'Tranchée 30x50cm avec grillage avertisseur',
            'Différentiel 25A/30mA testé (Bouton Test OK)',
            'Protection circuits (Lumière/Prise) séparée',
            'Prise de terre (< 50 Ohms mesuré)'
        ],
        'Contrôleur': [
            'Contrôle Branchement (Hauteur coffret 1.2m-1.6m)',
            'Contrôle Installation (DDR 30mA présent)',
            'Isolation coffret et protection descente ok',
            'Conducteur principal terre vert/jaune gaîné',
            'Signature PV de conformité effectuée'
        ],
        'Superviseur': [
            'Brief sécurité HSE du matin fait',
            'Stock matériel équipes suffisant',
            'Objectif journalier communiqué',
            'Reporting consolidation envoyé'
        ]
    };

    const MATERIAL_LIBRARY = {
        'Maçon': [
            '40 x Briques creuses 20x15x40 cm',
            '8 x Briques pleines 20x15x40 cm',
            '1.5 x Sac de ciment (50kg)',
            '5 x Brouettes de sable (dune/mer)',
            '1 x Brouette de gravillons / pierres',
            '200 Litres d\'eau (1 fût)',
            'Outils : Pelle, truelle, niveau, pioche, mètre, seaux'
        ],
        'Réseau': [
            '1 x Potelet Galvanisé 4m',
            '1 x Queue de cochon + Bride de serrage + Arrêtoir',
            '1 x Coude Ф25 sectionné + 2kg ciment plâtre',
            '20m x Câble Préassemblé 2x16mm²',
            '2 x Connecteurs CPB1/CT70',
            '1 x Pince d\'Ancrage 25',
            '1 x Coffret compteur extérieur'
        ],
        'Intérieur': [
            '1 x Coffret modulaire (principal)',
            '1 x Câble 2x6mm² FRN05 VV-U (15m)',
            '1 x Dispositif de terre (Piquet 1.5m, Cu nu Ø25 3m, Barrette, TH 6mm²)',
            'Grillage avertisseur + Tranchée 30x50cm',
            'Appareillage : 1 Hublot, 1 lampe LBC, 1 douille, 2 interrupteurs, 1 prise',
            'Protections : Disjoncteur 5/15A, Diff 25A/30mA, C10, C20',
            'Option Kit Secondaire : Lampe LBC + interrupteur, Prise, Câble armé 3x1.5 (10m)'
        ],
        'Préparateur': [
            'Coffrets compteurs et disjoncteurs pour précâblage',
            'Filerie HO7V-K (Noir/Bleu/Vert-Jaune)',
            'Connecteurs et peignes d\'alimentation',
            'Étiqueteuse industrielle et rubans',
            'Outillage : Tournevis isolés, pinces coupantes, sertisseuse',
            'EPI : Gants de manutention, lunettes'
        ],
        'Livreur': [
            'Véhicule de transport (Camionnette / Pickup)',
            'Tablette tactile avec application Terrain',
            'Bordereaux de livraison papier (Secours)',
            'Sangles d\'arrimage et couvertures de protection',
            'EPI : Chaussures de sécurité, gilet haute visibilité'
        ]
    };

    const ICONS = {
        'Préparateur': 'fa-boxes',
        'Livreur': 'fa-truck-loading'
    };

    const getRegistry = () => window.TeamRegistry || {
        get: (id) => ({ icon: 'fas fa-question', label: id, color: 'gray' }),
        normalizeId: (id) => id?.toLowerCase()
    };

    const normalize = (t) => {
        const trade = getRegistry().get(t);
        return trade ? trade.label : (t.charAt(0).toUpperCase() + t.slice(1));
    };

    const fmtDate = (d) => d ? new Date(d).toISOString().slice(0, 10) : '-';
    const addDays = (d, days) => d ? new Date(new Date(d).getTime() + days * 86400000).toISOString().slice(0, 10) : '-';

    const waitForRepo = () => new Promise((resolve) => {
        let attempts = 0;
        const timer = setInterval(() => {
            attempts++;
            const hasRepo = window.ProjectRepository || window.projectRepository;
            const hasDb = window.db && window.db.isOpen();
            const hasService = window.projectService;

            if (hasRepo && hasDb && hasService) {
                clearInterval(timer);
                resolve();
            } else if (attempts > 100) { // 3s timeout
                clearInterval(timer);
                console.warn('⚠️ Cahier: Wait for services timed out', { repo: !!hasRepo, db: !!hasDb, svc: !!hasService });
                resolve();
            }
        }, 30);
    });

    async function loadData() {
        try {
            await waitForRepo();

            const project = await window.ProjectRepository.getCurrent();
            const teams = await window.TeamRepository.getAll();
            const householdsCount = await window.HouseholdRepository.count();
            const zones = await window.db.zones.toArray();

            if (!window.projectService) {
                console.error('ProjectService not available');
                return;
            }
            window.projectService.project = project;
            window.projectService.rebuildIndex(project);

            CAHIER_SETTINGS = project?.config?.cahier_settings || JSON.parse(localStorage.getItem('cahier_global_settings') || '{}');

            const consolidatedCards = [];
            const types = window.projectService.TEAM_TYPES;

            // Iterate through official métier types
            for (const key in types) {
                const typeValue = types[key];
                const normalizedType = normalize(typeValue);

                // Get assignments for this métier
                const assignments = project.config.grappe_assignments || {};
                const assignedSGs = [];
                const teamIds = new Set();

                for (const sgId in assignments) {
                    const sgAssignments = assignments[sgId][typeValue] || [];
                    if (sgAssignments.length > 0) {
                        assignedSGs.push(sgId);
                        // Convert to string for Set consistency (IndexedDB IDs are often Numbers)
                        sgAssignments.forEach(tid => teamIds.add(String(tid)));
                    }
                }

                // If no assignments and not a core métier that should be visible, skip
                // But usually we want to see the 4 core métiers
                const assignedTeams = teams.filter(t => teamIds.has(String(t.id)));

                // Calculate aggregate capacity
                let totalDaily = 0;
                assignedTeams.forEach(t => {
                    const cap = project.teamCapabilities?.[t.type.toLowerCase()] || {};
                    totalDaily += cap.daily || cap.dailyCapacity || 1;
                });

                // Start date from project or first team
                const startDate = project.startDate || project.start || new Date().toISOString().slice(0, 10);
                const duration = project.duration || 180;
                const endDate = addDays(startDate, duration);

                consolidatedCards.push({
                    type: normalizedType,
                    rawType: typeValue,
                    teams: assignedTeams,
                    assignedGrappes: assignedSGs,
                    daily: totalDaily || (assignedTeams.length > 0 ? assignedTeams.length : 1),
                    count: assignedTeams.length,
                    startDate,
                    endDate,
                    duration,
                    householdsCount
                });
            }

            // Also add static roles like "Superviseur" or "Préparateur" if not in TEAM_TYPES but in TASK_LIBRARY
            ['Superviseur', 'Préparateur', 'Livreur'].forEach(role => {
                if (!consolidatedCards.find(c => c.type === role)) {
                    consolidatedCards.push({
                        type: role,
                        rawType: role.toLowerCase(),
                        teams: [],
                        assignedGrappes: [],
                        daily: 1,
                        count: 0,
                        startDate: project.startDate || new Date().toISOString().slice(0, 10),
                        duration: project.duration || 180,
                        endDate: addDays(project.startDate, project.duration || 180),
                        householdsCount
                    });
                }
            });

            render(consolidatedCards, householdsCount, zones);
        } catch (err) {
            console.error('❌ Cahier: Error loading data', err);
            render([], 0);
        }
    }

    function render(teamData, households, zones = []) {
        const container = document.getElementById('cahierContainer');
        if (!container) return;
        container.innerHTML = '';
        if (!teamData.length) {
            container.innerHTML = '<div class="text-center text-gray-500">Aucune équipe configurée.</div>';
            return;
        }
        teamData.forEach(data => container.appendChild(buildCard(data, households, zones)));

        const downloadAllBtn = document.getElementById('downloadAllBtn');
        if (downloadAllBtn) {
            downloadAllBtn.onclick = () => {
                teamData.forEach(d => downloadWord(d, households));
            };
        }
    }

    function buildCard(data, totalHouseholds, allZones = []) {
        const card = document.createElement('div');
        card.className = 'cahier-card bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6 print:shadow-none print:border-slate-300';

        const header = document.createElement('div');
        header.className = 'bg-slate-50 border-b border-slate-200 p-6 print:p-4';

        const titleRow = document.createElement('div');
        titleRow.className = 'flex justify-between items-start mb-4';

        const trade = getRegistry().get(data.type);
        const titleLabel = trade ? trade.label : data.type;
        const icon = trade ? trade.icon : 'fa-users';

        // List of team names for this métier
        const teamNames = data.teams?.length > 0
            ? data.teams.map(t => escapeHtml(t.name)).join(', ')
            : (data.count > 0 ? `${data.count} équipe(s)` : 'Aucune équipe assignée');

        titleRow.innerHTML = `
            <div class="flex-1 min-w-0">
                <h2 class="text-2xl font-black text-slate-800 tracking-tight leading-none mb-2 truncate">
                    <i class="${icon} text-indigo-500 mr-2"></i>${escapeHtml(titleLabel)}
                </h2>
                <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold uppercase tracking-wider">${teamNames}</span>
                </div>
            </div>
            <div class="text-right flex flex-col items-end gap-2 ml-4">
                <div class="flex flex-col items-end">
                    <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Secteurs d'Intervention
                    </div>
                    <div class="text-slate-700 text-sm font-bold flex flex-wrap justify-end gap-1 max-w-[250px]">
                        ${data.assignedGrappes?.length > 0
                ? data.assignedGrappes.map(g => `<span class="bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 text-indigo-700 text-[10px]">${escapeHtml(g)}</span>`).join('')
                : '<span class="text-slate-400 italic font-normal text-xs text-right">Aucune zone assignée (Voir Logistique)</span>'}
                    </div>
                </div>
                <button onclick="downloadWord(${JSON.stringify(data).replace(/"/g, '&quot;')}, ${totalHouseholds})" 
                        class="bg-white text-indigo-700 border border-indigo-200 px-3 py-1 rounded text-[10px] font-black uppercase hover:bg-indigo-50 transition flex items-center gap-2 mt-2">
                    <i class="fas fa-file-word"></i> Exporter Word
                </button>
            </div>
        `;
        header.appendChild(titleRow);

        // Stats blocks
        const statsRow = document.createElement('div');
        statsRow.className = 'grid grid-cols-2 md:grid-cols-4 gap-4 mt-6';

        const stats = [
            { label: 'Démarrage', value: fmtDate(data.startDate), icon: 'fa-calendar-alt', color: 'orange' },
            { label: 'Fin Estimée', value: fmtDate(data.endDate), icon: 'fa-check-circle', color: 'emerald' },
            { label: 'Effectif', value: `${data.count} Éq.`, icon: 'fa-users', color: 'indigo' },
            { label: 'Objectif/j', value: `${data.daily} mén.`, icon: 'fa-bullseye', color: 'rose' }
        ];

        stats.forEach(s => {
            const stat = document.createElement('div');
            stat.className = `bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3`;
            stat.innerHTML = `
                <div class="w-8 h-8 rounded-lg bg-${s.color}-50 text-${s.color}-600 flex items-center justify-center text-xs">
                    <i class="fas ${s.icon}"></i>
                </div>
                <div class="min-w-0">
                    <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">${s.label}</div>
                    <div class="text-xs font-bold text-slate-700 truncate">${s.value}</div>
                </div>
            `;
            statsRow.appendChild(stat);
        });
        header.appendChild(statsRow);
        card.appendChild(header);

        // Meta bloc (dates editables, responsables, contacts)
        const meta = document.createElement('div');
        meta.className = 'grid grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-white border-b border-slate-100';
        const startInput = metaInput(meta, 'Date de début', 'date', `cahier_${data.type}_start`, data.startDate);
        const endInput = metaInput(meta, 'Date de fin', 'date', `cahier_${data.type}_end`, data.endDate);
        const respInput = metaInput(meta, 'Responsable', 'text', `cahier_${data.type}_resp`, '');
        const contactInput = metaInput(meta, 'Contact terrain', 'text', `cahier_${data.type}_contact`, '');

        const deadline = document.createElement('div');
        deadline.className = 'flex flex-col';
        const badge = document.createElement('div');
        badge.className = 'bg-orange-50 text-orange-700 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-orange-100 uppercase tracking-tight mt-auto text-center';
        const refreshBadge = () => {
            const dl = computeDaysLeft(endInput.value);
            badge.innerHTML = `<i class="fas fa-hourglass-half mr-1"></i> ${dl === null ? '—' : `${dl} j restants`}`;
        };
        refreshBadge();
        endInput.addEventListener('input', refreshBadge);
        deadline.appendChild(badge);
        meta.appendChild(deadline);
        card.appendChild(meta);

        // Kobo Notice
        const koboNotice = document.createElement('div');
        koboNotice.className = 'mx-4 mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3 text-blue-800';
        koboNotice.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <i class="fas fa-info-circle text-blue-600"></i>
            </div>
            <span class="text-[10px] font-bold uppercase tracking-wide">Reporting obligatoire : Tous les membres doivent remplir le formulaire Kobo quotidiennement.</span>
        `;
        card.appendChild(koboNotice);

        const body = document.createElement('div');
        body.className = 'p-6 grid grid-cols-1 md:grid-cols-2 gap-8';

        const taskDef = TASK_LIBRARY[data.type] || {
            missions: ['Définir clairement les tâches à réaliser.', 'Assurer la sécurité et la qualité des travaux.'],
            livrables: ['Livrables définis avec le superviseur.'],
            jalons: ['Jalon de démarrage', 'Jalon de fin'],
            kpi: ['Production/jour', 'Taux de conformité'],
            hse: ['Port des EPI obligatoires', 'Vigilance sécurité']
        };

        body.appendChild(editableSection(data.type, 'missions', 'Missions techniques', taskDef.missions));
        body.appendChild(editableSection(data.type, 'livrables', 'Livrables attendus', taskDef.livrables));
        body.appendChild(editableSection(data.type, 'materiel', 'Matériel & Outillage', MATERIAL_LIBRARY[data.type] || []));
        body.appendChild(editableSection(data.type, 'hse', 'Sécurité / HSE', taskDef.hse));
        body.appendChild(editableSection(data.type, 'jalons', 'Jalons & Planning', taskDef.jalons));
        body.appendChild(editableSection(data.type, 'kpi', 'KPIs & Qualité', taskDef.kpi));

        card.appendChild(body);

        // Checklist
        const checklistSec = document.createElement('div');
        checklistSec.className = 'p-4 border-t border-gray-50 bg-gray-50/30';

        const defaultChecklist = CHECKLIST_LIBRARY[data.type] || CHECKLIST_LIBRARY['Superviseur'];
        const storedChecks = getChecklist(data.type, defaultChecklist);

        const checkHeader = document.createElement('div');
        checkHeader.className = 'flex justify-between items-center mb-3';
        const checklistTitle = document.createElement('h4');
        checklistTitle.className = 'text-xs font-bold text-gray-400 uppercase tracking-widest';

        const progressBadge = document.createElement('div');
        progressBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-gray-100 text-gray-500';

        const updateProgress = () => {
            const prog = getChecklistProgress(data.type, defaultChecklist);
            checklistTitle.textContent = `Checklist technique (${prog.done}/${defaultChecklist.length})`;
            progressBadge.textContent = prog.done === defaultChecklist.length ? '100% Terminée' : 'En progression';
        };
        updateProgress();

        checkHeader.appendChild(checklistTitle);
        checkHeader.appendChild(progressBadge);
        checklistSec.appendChild(checkHeader);

        const list = document.createElement('ul');
        list.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2';
        list.innerHTML = storedChecks.map((item, idx) => `
            <li class="flex items-center gap-2 bg-white p-2 rounded border border-gray-100">
                <input type="checkbox" data-ck="${idx}" ${item.done ? 'checked' : ''} class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 transition cursor-pointer">
                <span class="text-[11px] text-gray-700 font-medium">${escapeHtml(item.label)}</span>
            </li>
        `).join('');

        list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', async () => {
                const idx = parseInt(cb.dataset.ck, 10);
                storedChecks[idx].done = cb.checked;
                await saveChecklist(data.type, storedChecks);
                updateProgress();
            });
        });

        checklistSec.appendChild(list);
        card.appendChild(checklistSec);

        // Budget & Staff
        const staff = document.createElement('div');
        staff.className = 'p-4 border-t border-gray-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4';

        const totalCost = (data.daily * data.count * 1000).toLocaleString(); // Factice pour démo

        staff.innerHTML = `
            <div class="flex items-center gap-6">
                <div class="space-y-1">
                    <div class="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">Budget Prévisionnel</div>
                    <div class="text-sm font-black text-indigo-600 tracking-tight">${totalCost} FCFA <span class="text-[10px] font-normal text-gray-400">/ jour</span></div>
                </div>
                <div class="w-px h-8 bg-gray-100"></div>
                <div class="space-y-1">
                    <div class="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">Effectifs Totaux</div>
                    <div class="text-sm font-black text-gray-800 tracking-tight">${data.count} <span class="text-[10px] font-normal text-gray-400">équipe(s) terrain</span></div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <span class="flex h-2 w-2 rounded-full bg-green-500"></span>
                <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">HSE : Audit conforme</span>
            </div>
        `;
        card.appendChild(staff);

        // Signatures (Visuel uniquement dans la carte, utile pour export)
        const signatures = document.createElement('div');
        signatures.className = 'grid grid-cols-2 gap-px bg-gray-100 border-t border-gray-100';
        signatures.innerHTML = `
            <div class="bg-gray-50/50 p-3 text-center">
                <div class="text-[9px] font-bold text-gray-400 uppercase mb-4">Visa PROQUELEC (Direction)</div>
                <div class="h-px w-16 bg-gray-200 mx-auto mb-1"></div>
                <div class="text-[8px] text-gray-400 italic">Lu et approuvé</div>
            </div>
            <div class="bg-gray-50/50 p-3 text-center border-l border-gray-100">
                <div class="text-[9px] font-bold text-gray-400 uppercase mb-4">Visa Prestataire (${escapeHtml(data.type)})</div>
                <div class="h-px w-16 bg-gray-200 mx-auto mb-1"></div>
                <div class="text-[8px] text-gray-400 italic">Lu et approuvé</div>
            </div>
        `;
        card.appendChild(signatures);

        const editBtn = card.querySelector('.edit-grappes-btn');
        if (editBtn) {
            editBtn.onclick = () => openGrappeAssignmentModal(data, allZones);
        }

        return card;
    }

    async function openGrappeAssignmentModal(teamData, allZones) {
        if (!teamData.t) return;

        // Get all teams to check for conflicts
        const allTeams = await window.TeamRepository.getAll();
        const otherTeamsInType = allTeams.filter(t => getRegistry().normalizeId(t.type) === getRegistry().normalizeId(teamData.type) && t.id !== teamData.t.id);

        // Get unique grappe IDs from config
        const grappeIds = Array.from(new Set((window.GRAPPES_CONFIG?.sous_grappes || []).map(sg => sg.id))).sort();

        if (grappeIds.length === 0) {
            Swal.fire('Info', 'Aucune sous-grappe trouvée dans la configuration.', 'info');
            return;
        }

        const currentAssigned = teamData.assignedGrappes || [];

        const html = `
            <div class="text-left">
                <p class="text-sm text-gray-500 mb-4">Sélectionnez les sous-grappes à assigner à <b>${escapeHtml(teamData.t.name)}</b>.</p>
                <div class="max-h-60 overflow-y-auto border rounded-lg p-2 space-y-1">
                    ${grappeIds.map(id => {
            const assignedTo = otherTeamsInType.find(t => t.assignedGrappes?.includes(id));
            const conflictInfo = assignedTo ? `<span class="text-[9px] bg-amber-100 text-amber-700 px-1 rounded ml-2">⚠️ Affecté à ${escapeHtml(assignedTo.name)}</span>` : '';
            return `
                            <label class="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer transition-colors">
                                <input type="checkbox" name="grappe-choice" value="${escapeHtml(id)}" ${currentAssigned.includes(id) ? 'checked' : ''} class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500">
                                <span class="text-xs font-medium text-gray-700">${escapeHtml(id)}</span>
                                ${conflictInfo}
                            </label>
                        `;
        }).join('')}
                </div>
            </div>
        `;

        const result = await Swal.fire({
            title: 'Assignation des Grappes',
            html: html,
            showCancelButton: true,
            confirmButtonText: 'Enregistrer',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#4f46e5',
            preConfirm: () => {
                const checked = Array.from(document.querySelectorAll('input[name="grappe-choice"]:checked')).map(i => i.value);
                return checked;
            }
        });

        if (result.isConfirmed) {
            try {
                const newAssigns = result.value;
                const teamInstance = teamData.t;
                teamInstance.assignedGrappes = newAssigns;

                // Use static update for simplicity since we have a plain object (or hydrated)
                await window.TeamRepository.update(teamInstance);
                Swal.fire({
                    title: 'Enregistré !',
                    text: 'Les affectations ont été mises à jour.',
                    icon: 'success',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });

                // Refresh the whole UI
                loadData();
            } catch (err) {
                console.error('Save error:', err);
                Swal.fire('Erreur', 'Impossible de sauvegarder les affectations.', 'error');
            }
        }
    }

    // Helper for safer HTML
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function editableSection(teamType, key, title, defaults) {
        const storageKey = `cahier_${teamType}_${key}`;
        const saved = localStorage.getItem(storageKey);
        const rawContent = CAHIER_SETTINGS[`${teamType}_${key}`] || saved || (Array.isArray(defaults) ? defaults.join('\n') : String(defaults));

        const div = document.createElement('div');
        div.className = 'space-y-2 group';

        const label = document.createElement('h4');
        label.className = 'text-[10px] font-black text-gray-400 uppercase tracking-widest m-0 flex justify-between items-center';
        label.innerHTML = `<span>${title}</span> <i class="fas fa-pen text-[9px] text-gray-300 opacity-0 group-hover:opacity-100 transition"></i>`;
        div.appendChild(label);

        const editor = document.createElement('div');
        editor.className = 'w-full min-h-[60px] p-2 bg-gray-50/50 rounded-lg text-xs leading-relaxed text-gray-600 focus:bg-indigo-50/30 focus:outline-none focus:ring-1 focus:ring-indigo-100 transition';
        editor.contentEditable = 'true';

        const lines = rawContent.split('\n').filter(Boolean);
        editor.innerHTML = lines.map(line => `<div class="mb-1 flex gap-2"><span class="text-indigo-400 font-bold">•</span><span>${escapeHtml(line.trim())}</span></div>`).join('');

        editor.addEventListener('blur', async () => {
            const cleanText = editor.innerText.split('\n').map(l => l.replace(/^•\s?/, '').trim()).filter(Boolean).join('\n');
            CAHIER_SETTINGS[`${teamType}_${key}`] = cleanText;
            localStorage.setItem(storageKey, cleanText);
            await persistSettings();
        });

        div.appendChild(editor);
        return div;
    }

    function downloadWord(data, totalHouseholds) {
        const type = data.type;
        const taskDef = TASK_LIBRARY[type] || TASK_LIBRARY['Superviseur'];
        const getVal = (k, def) => CAHIER_SETTINGS[`cahier_${type}_${k}`] || localStorage.getItem(`cahier_${type}_${k}`) || (Array.isArray(def) ? def.join('\n') : def);

        // Prepare data for sections
        const missions = getVal('missions', taskDef.missions).split('\n').filter(Boolean);
        const livrables = getVal('livrables', taskDef.livrables).split('\n').filter(Boolean);
        const materials = getVal('materiel', MATERIAL_LIBRARY[type] || ['Matériel standard de chantier']).split('\n').filter(Boolean);
        const hse = getVal('hse', taskDef.hse || ['Port des EPI obligatoire', 'Respect des normes NF C 15-100']).split('\n').filter(Boolean);
        const jalons = getVal('jalons', taskDef.jalons || ['Démarrage sous 48h', 'Validation intermédiaire hebdomadaire']).split('\n').filter(Boolean);
        const kpis = getVal('kpi', taskDef.kpi || ['Qualité : 100% conformité', 'Délai : Respect du planning']).split('\n').filter(Boolean);

        const start = CAHIER_SETTINGS[`cahier_${type}_start`] || localStorage.getItem(`cahier_${type}_start`) || data.startDate || '';
        const end = CAHIER_SETTINGS[`cahier_${type}_end`] || localStorage.getItem(`cahier_${type}_end`) || data.endDate || '';
        const resp = CAHIER_SETTINGS[`cahier_${type}_resp`] || localStorage.getItem(`cahier_${type}_resp`) || 'À définir';
        const contact = CAHIER_SETTINGS[`cahier_${type}_contact`] || localStorage.getItem(`cahier_${type}_contact`) || 'À définir';
        const teamNames = data.teams?.map(t => t.name).join(', ') || 'Équipes projet';
        const grappes = data.assignedGrappes || [];

        // Build HTML for Word
        const html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <style>
                @page { size: A4; margin: 2.5cm; }
                body { font-family: 'Calibri', 'Arial', sans-serif; color: #334155; line-height: 1.5; font-size: 11pt; }
                .header-box { border-bottom: 3px solid #1e3a8a; margin-bottom: 25px; padding-bottom: 15px; }
                h1 { color: #1e3a8a; font-size: 24pt; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
                .subtitle { color: #64748b; font-size: 10pt; font-weight: bold; margin-top: 5px; }
                h2 { color: #1e40af; border-left: 5px solid #1e40af; padding-left: 12px; margin-top: 25px; margin-bottom: 10px; font-size: 14pt; background: #f8fafc; padding-top: 5px; padding-bottom: 5px; }
                h3 { color: #1e3a8a; font-size: 12pt; margin-top: 15px; text-decoration: underline; }
                .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                .meta-table td { border: 1px solid #e2e8f0; padding: 8px; font-size: 9pt; }
                .label { font-weight: bold; color: #475569; width: 25%; background: #f1f5f9; }
                ul { margin-top: 5px; margin-bottom: 10px; }
                li { margin-bottom: 4px; }
                .alert-box { background: #fff7ed; border: 1px solid #ffedd5; color: #9a3412; padding: 15px; border-radius: 6px; margin: 15px 0; font-size: 10pt; }
                .kpi-box { background: #f0f9ff; border: 1px solid #e0f2fe; color: #0369a1; padding: 15px; border-radius: 6px; }
                .signature-section { margin-top: 50px; }
                .signature-box { border: 1px solid #cbd5e1; padding: 20px; width: 45%; display: inline-block; vertical-align: top; height: 150px; text-align: left; }
                .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 8pt; color: #94a3b8; text-align: center; }
                .annex-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                .annex-table th, .annex-table td { border: 1px solid #e2e8f0; padding: 6px; font-size: 9pt; text-align: left; }
                .annex-table th { background: #f8fafc; }
            </style>
        </head>
        <body>
            <div class="header-box">
                <div style="text-align: right; font-size: 8pt; color: #94a3b8;">Document Réf: LSE-CDC-${type.toUpperCase()}-2026</div>
                <h1>Cahier des Charges Opérationnel</h1>
                <div class="subtitle">Missions : Équipe ${type} | Prestataire : ${teamNames}</div>
            </div>

            <table class="meta-table">
                <tr><td class="label">Période du projet</td><td>Du ${fmtDate(start)} au ${fmtDate(end)}</td><td class="label">Responsable Terrain</td><td>${resp}</td></tr>
                <tr><td class="label">Lieu(x) d'intervention</td><td>${grappes.length > 0 ? grappes.join(', ') : 'Toute la zone'}</td><td class="label">Contact / Mobile</td><td>${contact}</td></tr>
                <tr><td class="label">Effectifs concernés</td><td>${data.count} équipe(s) technique(s)</td><td class="label">Capacité journalière</td><td>${data.daily} ménages / jour</td></tr>
            </table>

            <h2>1. Contexte du Projet</h2>
            <p>Dans le cadre du programme d'électrification massive, LSE mandate l'équipe <strong>${type}</strong> pour l'exécution des travaux techniques sur les zones définies ci-après. Ce document cadre les obligations de résultat, de qualité et de sécurité.</p>

            <h2>2. Objectifs Globaux</h2>
            <div class="kpi-box">
                Ce projet vise l'électrification de <strong>${totalHouseholds.toLocaleString()} ménages</strong>. 
                Votre objectif sectoriel est de traiter l'intégralité des ménages dans vos zones assignées selon la cadence de ${data.daily} ménages/jour.
            </div>

            <h2>3. Sécurité & HSE (Crucial)</h2>
            <div class="alert-box">
                <strong>Attention :</strong> La sécurité est une condition de maintien du contrat. 
                <ul>${hse.map(m => `<li>⚠️ ${m}</li>`).join('')}</ul>
            </div>

            <h2>4. Tâches & Missions Techniques</h2>
            <ul>${missions.map(m => `<li>✅ ${m}</li>`).join('')}</ul>

            <h2>5. Responsabilités</h2>
            <p>L'équipe est responsable de la conformité technique de l'installation, de la propreté du chantier, et de la saisie immédiate des données dans l'application mobile (KoboCollect).</p>

            <h2>6. Délais & Planning</h2>
            <p>Calendrier d'exécution : <strong>${data.duration} jours</strong>.</p>
            <ul>${jalons.map(j => `<li>📅 ${j}</li>`).join('')}</ul>

            <h2>7. Livrables Attendus</h2>
            <ul>${livrables.map(l => `<li>📦 ${l}</li>`).join('')}</ul>

            <h2>8. Matériel & Outillage</h2>
            <p>Liste minimum requise par équipe :</p>
            <ul>${materials.map(m => `<li>🛠️ ${m}</li>`).join('')}</ul>

            <h2>9. KPI & Performance</h2>
            <ul>${kpis.map(k => `<li>📊 ${k}</li>`).join('')}</ul>

            <h2>10. Reporting & Données</h2>
            <p>Chaque intervention doit faire l'objet d'une remontée digitale via <strong>KoboCollect</strong>. Une zone non renseignée est considérée comme non effectuée.</p>

            <h2>11. Validation & Recette</h2>
            <p>Les travaux seront validés par l'équipe de supervision après contrôle de conformité. Les levées de réserves doivent être effectuées sous 24h.</p>

            <h2>12. Coordonnées & Assistance</h2>
            <p>En cas de problème technique ou logistique : <strong>${contact}</strong> ou Supervision Centrale LSE.</p>

            <br clear="all" style="page-break-before:always" />

            <h2>13. Annexes : Secteur d'Intervention Détaillé</h2>
            <p>Liste des sous-grappes assignées et volumes prévisionnels :</p>
            <table class="annex-table">
                <thead>
                    <tr><th>Code SG</th><th>Région</th><th>Ménages prévus</th></tr>
                </thead>
                <tbody>
                    ${grappes.map(g => {
            const sgInfo = window.GRAPPES_CONFIG?.sous_grappes?.find(s => s.id === g || s.code === g) || {};
            return `<tr><td>${g}</td><td>${sgInfo.region || '--'}</td><td>${sgInfo.nb_menages || '--'}</td></tr>`;
        }).join('')}
                    ${grappes.length === 0 ? '<tr><td colspan="3" style="text-align:center">Affectation globale (Toute la zone)</td></tr>' : ''}
                </tbody>
            </table>

            <div class="signature-section">
                <div class="signature-box" style="margin-right: 5%;">
                    <strong>LSE (Client)</strong><br><br>
                    <div style="font-size: 8pt; margin-top: 50px;">Date et signature :</div>
                </div>
                <div class="signature-box">
                    <strong>PRESTATAIRE / RESPONSABLE</strong><br>
                    ${resp}<br>
                    <div style="font-size: 8pt; margin-top: 50px;">Date et signature :</div>
                </div>
            </div>

            <div class="footer">
                Document généré automatiquement par Électrification Massive SaaS - Proquelec & Antigravity
            </div>
        </body>
        </html>`;

        const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `CDC_${type.replace(/\s+/g, '_')}_2026.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    window.downloadWord = downloadWord;
    document.addEventListener('DOMContentLoaded', loadData);
})();

function persistSettings() {
    return new Promise(async (resolve) => {
        localStorage.setItem('cahier_global_settings', JSON.stringify(CAHIER_SETTINGS));
        try {
            const project = await ProjectRepository.getCurrent();
            project.config = project.config || {};
            project.config.cahier_settings = CAHIER_SETTINGS;
            await ProjectRepository.updateProjectParameters({ config: project.config });
        } catch (err) { console.warn('⚠️ Cahier: Local persistence failed', err); }
        resolve();
    });
}

function getStoredList(teamType, key, defaults) {
    const raw = CAHIER_SETTINGS[`${teamType}_${key}`] || localStorage.getItem(`cahier_${teamType}_${key}`);
    if (!raw) return defaults;
    return raw.split('\n').map(l => l.trim()).filter(Boolean);
}

function metaInput(container, labelText, type, storageKey, fallback) {
    const block = document.createElement('div');
    block.className = 'flex flex-col gap-1';
    const label = document.createElement('label');
    label.className = 'text-[9px] font-bold text-gray-400 uppercase tracking-tight';
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = type;
    input.className = 'text-xs border-none bg-gray-50/50 rounded p-1 focus:bg-indigo-50/50 focus:ring-0 transition font-medium text-gray-700';
    input.value = CAHIER_SETTINGS[storageKey] || localStorage.getItem(storageKey) || fallback || '';
    input.addEventListener('input', async () => {
        CAHIER_SETTINGS[storageKey] = input.value;
        localStorage.setItem(storageKey, input.value || '');
        await persistSettings();
    });
    block.appendChild(label);
    block.appendChild(input);
    container.appendChild(block);
    return input;
}

function computeDaysLeft(dateStr) {
    if (!dateStr) return null;
    const end = new Date(dateStr).getTime();
    const today = new Date().setHours(0, 0, 0, 0);
    return Math.ceil((end - today) / 86400000);
}

function getChecklist(teamType, defaults) {
    const raw = CAHIER_SETTINGS[`ck_${teamType}`] || localStorage.getItem(`cahier_ck_${teamType}`);
    if (raw) {
        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (Array.isArray(parsed)) return parsed;
        } catch { }
    }
    return defaults.map(label => ({ label, done: false }));
}

async function saveChecklist(teamType, list) {
    CAHIER_SETTINGS[`ck_${teamType}`] = list;
    localStorage.setItem(`cahier_ck_${teamType}`, JSON.stringify(list));
    await persistSettings();
}

function getChecklistProgress(teamType, defaults) {
    const list = getChecklist(teamType, defaults);
    const done = list.filter(i => i.done).length;
    return { done, total: list.length };
}
