/**
 * RestoreService - Service de restauration de données
 * Gère la restauration des données depuis des fichiers Excel de backup
 */

class RestoreService {
    constructor(db, eventBus, logger) {
        this.db = db;
        this.eventBus = eventBus;
        this.logger = logger;
    }

    /**
     * Vérifie si la base de données est vide
     */
    async detectEmptyDatabase() {
        try {
            const householdCount = await this.db.households.count();
            return householdCount === 0;
        } catch (error) {
            this.logger?.warn('Error checking database:', error);
            return true; // Assume empty if error
        }
    }

    /**
     * Affiche le dialogue de restauration
     */
    async showRestoreDialog() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
                    <div class="text-center mb-4">
                        <i class="fas fa-database text-6xl text-gray-400 mb-4"></i>
                        <h3 class="text-xl font-bold text-gray-800 mb-2">Aucune donnée détectée</h3>
                        <p class="text-gray-600">
                            Voulez-vous restaurer vos données depuis un fichier de sauvegarde ?
                        </p>
                    </div>
                    
                    <div class="space-y-3">
                        <button id="selectBackupBtn" class="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center">
                            <i class="fas fa-folder-open mr-2"></i>
                            Sélectionner un fichier de backup
                        </button>
                        
                        <button id="skipRestoreBtn" class="w-full bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center">
                            <i class="fas fa-times mr-2"></i>
                            Commencer sans données
                        </button>
                    </div>
                    
                    <input type="file" id="backupFileInput" accept=".xlsx,.xls" class="hidden">
                </div>
            `;

            document.body.appendChild(modal);

            const fileInput = modal.querySelector('#backupFileInput');
            const selectBtn = modal.querySelector('#selectBackupBtn');
            const skipBtn = modal.querySelector('#skipRestoreBtn');

            selectBtn.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', async (e) => {
                if (e.target.files.length > 0) {
                    document.body.removeChild(modal);
                    resolve({ restore: true, file: e.target.files[0] });
                }
            });

            skipBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve({ restore: false });
            });
        });
    }

    /**
     * Restaure les données depuis un fichier Excel
     */
    async restoreFromFile(file) {
        try {
            this.logger?.info('📥 Démarrage de la restauration...');

            // Lire le fichier Excel
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);

            // Valider le fichier
            const validation = this.validateBackupFile(workbook);
            if (!validation.valid) {
                throw new Error(`Fichier invalide: ${validation.error}`);
            }

            const stats = {
                households: 0,
                projects: 0,
                zones: 0,
                teams: 0
            };

            // Restaurer les households
            if (workbook.SheetNames.includes('Households')) {
                const householdsSheet = workbook.Sheets['Households'];
                const householdsData = XLSX.utils.sheet_to_json(householdsSheet);

                if (householdsData.length > 0) {
                    // Convertir au format attendu
                    const households = householdsData.map(row => this.convertToHousehold(row));

                    // Sauvegarder par batch
                    const batchSize = 500;
                    for (let i = 0; i < households.length; i += batchSize) {
                        const batch = households.slice(i, i + batchSize);
                        await this.db.households.bulkPut(batch);
                        stats.households += batch.length;
                    }
                }
            }

            // Restaurer les projects
            if (workbook.SheetNames.includes('Projects')) {
                const projectsSheet = workbook.Sheets['Projects'];
                const projectsData = XLSX.utils.sheet_to_json(projectsSheet);

                if (projectsData.length > 0) {
                    await this.db.projects.bulkPut(projectsData);
                    stats.projects = projectsData.length;
                }
            }

            // Restaurer les zones
            if (workbook.SheetNames.includes('Zones')) {
                const zonesSheet = workbook.Sheets['Zones'];
                const zonesData = XLSX.utils.sheet_to_json(zonesSheet);

                if (zonesData.length > 0) {
                    await this.db.zones.bulkPut(zonesData);
                    stats.zones = zonesData.length;
                }
            }

            // Restaurer les teams
            if (workbook.SheetNames.includes('Teams')) {
                const teamsSheet = workbook.Sheets['Teams'];
                const teamsData = XLSX.utils.sheet_to_json(teamsSheet);

                if (teamsData.length > 0) {
                    await this.db.teams.bulkPut(teamsData);
                    stats.teams = teamsData.length;
                }
            }

            this.logger?.info('✅ Restauration réussie:', stats);

            // Émettre événement
            if (this.eventBus) {
                this.eventBus.emit('restore.completed', stats);
            }

            return { success: true, stats };

        } catch (error) {
            this.logger?.error('❌ Erreur lors de la restauration:', error);

            if (this.eventBus) {
                this.eventBus.emit('restore.failed', { error: error.message });
            }

            throw error;
        }
    }

    /**
     * Valide la structure du fichier de backup
     */
    validateBackupFile(workbook) {
        // Vérifier qu'il y a au moins une feuille
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return { valid: false, error: 'Aucune feuille trouvée dans le fichier' };
        }

        // Vérifier la présence de la feuille Metadata
        if (!workbook.SheetNames.includes('Metadata')) {
            return { valid: false, error: 'Feuille Metadata manquante' };
        }

        // Vérifier qu'il y a au moins une feuille de données
        const dataSheets = ['Households', 'Projects', 'Zones', 'Teams'];
        const hasDataSheet = dataSheets.some(sheet => workbook.SheetNames.includes(sheet));

        if (!hasDataSheet) {
            return { valid: false, error: 'Aucune feuille de données trouvée' };
        }

        return { valid: true };
    }

    /**
     * Convertit une ligne Excel en objet Household
     */
    convertToHousehold(row) {
        // Construire l'objet coordinates
        const coordinates = (row.latitude && row.longitude) ? {
            latitude: parseFloat(row.latitude),
            longitude: parseFloat(row.longitude),
            precision: parseFloat(row.precision) || 0
        } : null;

        // Construire l'objet location
        const location = {
            region: row.Region || '',
            department: row.Departement || '',
            commune: row.Commune || '',
            village: row['Quartier ou Village'] || '',
            coordinates,
            zoneId: row.zone || 'Non assigné'
        };

        // Construire l'objet owner
        const owner = {
            name: row.Nom || '',
            phone: row.Telephone || '',
            cin: row.CIN || ''
        };

        // Retourner l'objet household complet
        return {
            id: row.ID,
            location,
            owner,
            status: row.Statut || 'En attente',
            statusHistory: [],
            assignedTeams: [],
            scheduledDates: {},
            actualDates: {},
            notes: [],
            createdAt: row.createdAt || new Date().toISOString(),
            updatedAt: row.updatedAt || new Date().toISOString()
        };
    }

    /**
     * Affiche un résumé de restauration
     */
    showRestoreSummary(stats) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
                <div class="text-center mb-4">
                    <i class="fas fa-check-circle text-6xl text-green-500 mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">Restauration réussie !</h3>
                </div>
                
                <div class="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 class="font-medium text-gray-800 mb-2">Données restaurées :</h4>
                    <ul class="text-sm text-gray-600 space-y-1">
                        <li>✅ ${stats.households} ménages</li>
                        <li>✅ ${stats.projects} projets</li>
                        <li>✅ ${stats.zones} zones</li>
                        <li>✅ ${stats.teams} équipes</li>
                    </ul>
                </div>
                
                <button id="closeRestoreSummary" class="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition-colors">
                    Continuer
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#closeRestoreSummary').addEventListener('click', () => {
            document.body.removeChild(modal);
            // Recharger la page pour afficher les données
            window.location.reload();
        });
    }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.RestoreService = RestoreService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RestoreService;
}
