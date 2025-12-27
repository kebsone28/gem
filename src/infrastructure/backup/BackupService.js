/**
 * BackupService - Service de sauvegarde automatique
 * Gère l'export périodique des données vers des fichiers Excel
 */

class BackupService {
    constructor(db, eventBus, logger) {
        this.db = db;
        this.eventBus = eventBus;
        this.logger = logger;
        this.autoBackupTimer = null;
        this.config = this.loadConfig();
        this.directoryHandle = null; // V4.6: File System Access API
    }

    /**
     * Sélectionne un dossier de sauvegarde (File System Access API)
     */
    async selectBackupDirectory() {
        if (!window.showDirectoryPicker) {
            throw new Error("Votre navigateur ne supporte pas la sauvegarde directe sur disque.");
        }

        try {
            this.directoryHandle = await window.showDirectoryPicker();
            this.logger?.info('✅ Dossier de sauvegarde sélectionné:', this.directoryHandle.name);

            // Persist handle to IndexedDB
            if (this.db.settings) {
                await this.db.settings.put({ key: 'backupHandle', value: this.directoryHandle });
            }

            if (this.eventBus) {
                this.eventBus.emit('backup.directory.selected', { name: this.directoryHandle.name });
            }

            return this.directoryHandle.name;
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.logger?.error('Error selecting directory:', error);
            }
            throw error;
        }
    }

    /**
     * Initialise le service et tente de restaurer le handle
     */
    async initialize() {
        try {
            if (this.db.settings) {
                const record = await this.db.settings.get('backupHandle');
                if (record && record.value) {
                    this.directoryHandle = record.value;
                    // On ne peut pas vérifier la permission sans geste utilisateur au démarrage
                    // Mais on informe l'UI qu'un dossier est connu
                    this.logger?.info('📁 Handle restauré:', this.directoryHandle.name);
                    if (this.eventBus) {
                        this.eventBus.emit('backup.directory.selected', { name: this.directoryHandle.name, needsPermission: true });
                    }
                }
            }
        } catch (e) {
            console.warn('Erreur restauration backupHandle:', e);
        }
    }

    async verifyPermission(handle, readWrite) {
        const options = {};
        if (readWrite) {
            options.mode = 'readwrite';
        }
        if ((await handle.queryPermission(options)) === 'granted') {
            return true;
        }
        if ((await handle.requestPermission(options)) === 'granted') {
            return true;
        }
        return false;
    }

    /**
     * Charge la configuration depuis localStorage
     */
    loadConfig() {
        const defaultConfig = {
            autoBackupEnabled: false,
            backupInterval: 5, // minutes
            lastBackupDate: null,
            backupHistory: []
        };

        try {
            const saved = localStorage.getItem('backupConfig');
            return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
        } catch (e) {
            console.warn('Error loading backup config:', e);
            return defaultConfig;
        }
    }

    /**
     * Sauvegarde la configuration
     */
    saveConfig() {
        try {
            localStorage.setItem('backupConfig', JSON.stringify(this.config));
        } catch (e) {
            console.error('Error saving backup config:', e);
        }
    }

    /**
     * Active/désactive la sauvegarde automatique
     */
    setAutoBackupEnabled(enabled) {
        this.config.autoBackupEnabled = enabled;
        this.saveConfig();

        if (enabled) {
            this.scheduleAutoBackup();
            this.logger?.info('✅ Auto-backup activé');
        } else {
            this.stopAutoBackup();
            this.logger?.info('⏸️ Auto-backup désactivé');
        }

        if (this.eventBus) {
            this.eventBus.emit('backup.config.changed', { enabled });
        }
    }

    /**
     * Définit l'intervalle de sauvegarde
     */
    setBackupInterval(minutes) {
        if (minutes < 1 || minutes > 60) {
            throw new Error('Backup interval must be between 1 and 60 minutes');
        }

        this.config.backupInterval = minutes;
        this.saveConfig();

        // Redémarrer le timer si auto-backup est actif
        if (this.config.autoBackupEnabled) {
            this.stopAutoBackup();
            this.scheduleAutoBackup();
        }

        this.logger?.info(`⏱️ Intervalle de backup changé: ${minutes} minutes`);
    }

    /**
     * Démarre la sauvegarde automatique
     */
    scheduleAutoBackup() {
        if (this.autoBackupTimer) {
            clearInterval(this.autoBackupTimer);
        }

        const intervalMs = this.config.backupInterval * 60 * 1000;

        this.autoBackupTimer = setInterval(() => {
            this.performBackup(true); // true = auto backup
        }, intervalMs);

        this.logger?.info(`🔄 Auto-backup programmé toutes les ${this.config.backupInterval} minutes`);
    }

    /**
     * Arrête la sauvegarde automatique
     */
    stopAutoBackup() {
        if (this.autoBackupTimer) {
            clearInterval(this.autoBackupTimer);
            this.autoBackupTimer = null;
        }
    }

    /**
     * Effectue une sauvegarde complète
     */
    async performBackup(isAuto = false) {
        try {
            this.logger?.info('💾 Démarrage de la sauvegarde...');

            // Récupérer toutes les données
            const data = await this.exportAllData();

            // Générer le nom de fichier avec timestamp (format: YYYY-MM-DD_HH-mm-ss)
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
            const filename = `backup_${timestamp}.xlsx`;

            console.log('📝 Nom du fichier de backup:', filename);

            // Créer le fichier Excel
            const workbook = XLSX.utils.book_new();

            // Feuille 1: Households (Ménages)
            if (data.households && data.households.length > 0) {
                const householdsSheet = XLSX.utils.json_to_sheet(data.households);
                XLSX.utils.book_append_sheet(workbook, householdsSheet, 'Households');
            }

            // Feuille 2: Projects
            if (data.projects && data.projects.length > 0) {
                const projectsSheet = XLSX.utils.json_to_sheet(data.projects);
                XLSX.utils.book_append_sheet(workbook, projectsSheet, 'Projects');
            }

            // Feuille 3: Zones
            if (data.zones && data.zones.length > 0) {
                const zonesSheet = XLSX.utils.json_to_sheet(data.zones);
                XLSX.utils.book_append_sheet(workbook, zonesSheet, 'Zones');
            }

            // Feuille 4: Teams
            if (data.teams && data.teams.length > 0) {
                const teamsSheet = XLSX.utils.json_to_sheet(data.teams);
                XLSX.utils.book_append_sheet(workbook, teamsSheet, 'Teams');
            }

            // Feuille 5: Metadata
            const metadata = [{
                backupDate: new Date().toISOString(),
                appVersion: '2.0',
                totalHouseholds: data.households?.length || 0,
                totalProjects: data.projects?.length || 0,
                totalZones: data.zones?.length || 0,
                totalTeams: data.teams?.length || 0,
                isAutoBackup: isAuto
            }];
            const metadataSheet = XLSX.utils.json_to_sheet(metadata);
            XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');

            // --- V4.6 FILE SYSTEM ACCESS API ---
            // --- V4.6 FILE SYSTEM ACCESS API ---
            if (this.directoryHandle) {
                try {
                    // Vérifier la permission en écriture avant d'essayer
                    const hasPermission = await this.verifyPermission(this.directoryHandle, true);
                    if (!hasPermission) {
                        throw new Error("Permission refusée pour le dossier de sauvegarde.");
                    }

                    // Créer un fichier dans le dossier sélectionné
                    const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: true });
                    const writable = await fileHandle.createWritable();

                    // Générer le binaire
                    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

                    // Écrire
                    await writable.write(wbout);
                    await writable.close();

                    this.logger?.info(`✅ Fichier écrit directement sur le disque: ${filename}`);

                } catch (fsError) {
                    console.error('Erreur écriture disque, fallback téléchargement:', fsError);
                    alert(`Erreur sauvegarde locale: ${fsError.message}. Le fichier sera téléchargé à la place.`);
                    XLSX.writeFile(workbook, filename);
                }
            } else {
                // Télécharger le fichier (Standard fallback)
                XLSX.writeFile(workbook, filename);
            }

            // Mettre à jour la configuration
            this.config.lastBackupDate = new Date().toISOString();
            this.config.backupHistory.unshift({
                filename,
                date: this.config.lastBackupDate,
                recordCount: data.households?.length || 0,
                isAuto
            });

            // Garder seulement les 20 derniers backups dans l'historique
            if (this.config.backupHistory.length > 20) {
                this.config.backupHistory = this.config.backupHistory.slice(0, 20);
            }

            this.saveConfig();

            this.logger?.info(`✅ Sauvegarde réussie: ${filename}`);

            // Émettre événement
            if (this.eventBus) {
                this.eventBus.emit('backup.completed', {
                    filename,
                    recordCount: data.households?.length || 0,
                    isAuto,
                    location: this.directoryHandle ? this.directoryHandle.name : 'Downloads'
                });
            }

            return { success: true, filename };

        } catch (error) {
            this.logger?.error('❌ Erreur lors de la sauvegarde:', error);

            if (this.eventBus) {
                this.eventBus.emit('backup.failed', { error: error.message });
            }

            throw error;
        }
    }

    /**
     * Exporte toutes les données de la base
     */
    async exportAllData() {
        const data = {};

        try {
            // Exporter les households
            if (this.db.households) {
                const households = await this.db.households.toArray();
                data.households = households.map(h => this.flattenHousehold(h));
            }

            // Exporter les projects
            if (this.db.projects) {
                data.projects = await this.db.projects.toArray();
            }

            // Exporter les zones
            if (this.db.zones) {
                data.zones = await this.db.zones.toArray();
            }

            // Exporter les teams
            if (this.db.teams) {
                data.teams = await this.db.teams.toArray();
            }

            return data;

        } catch (error) {
            this.logger?.error('Error exporting data:', error);
            throw error;
        }
    }

    /**
     * Aplatit la structure d'un household pour Excel
     */
    flattenHousehold(household) {
        return {
            ID: household.id,
            Nom: household.owner?.name || household.nom_prenom_chef || '',
            Telephone: household.owner?.phone || household.telephone || '',
            CIN: household.owner?.cin || household.cin || '',
            latitude: household.location?.coordinates?.latitude || household.gpsLat || '',
            longitude: household.location?.coordinates?.longitude || household.gpsLon || '',
            precision: household.location?.coordinates?.precision || '',
            Region: household.location?.region || household.region || '',
            Departement: household.location?.department || household.departement || '',
            Commune: household.location?.commune || household.commune || '',
            'Quartier ou Village': household.location?.village || household.quartier_village || '',
            zone: household.location?.zoneId || household.zone || '',
            Statut: household.status || household.statut || 'En attente',
            createdAt: household.createdAt || household._createdAt || '',
            updatedAt: household.updatedAt || household._updatedAt || ''
        };
    }

    /**
     * Obtient l'historique des backups
     */
    getBackupHistory() {
        return this.config.backupHistory;
    }

    /**
     * Obtient la configuration actuelle
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Nettoie l'historique (garde les N derniers)
     */
    cleanOldBackups(keepCount = 10) {
        if (this.config.backupHistory.length > keepCount) {
            this.config.backupHistory = this.config.backupHistory.slice(0, keepCount);
            this.saveConfig();
            this.logger?.info(`🧹 Historique nettoyé, ${keepCount} backups conservés`);
        }
    }
    /**
     * Efface tout l'historique des backups
     */
    clearBackupHistory() {
        this.config.backupHistory = [];
        this.saveConfig();
        this.logger?.info('🧹 Historique des backups effacé');

        if (this.eventBus) {
            this.eventBus.emit('backup.history.cleared');
        }
    }
}

// Export pour utilisation globale
if (typeof window !== 'undefined') {
    window.BackupService = BackupService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BackupService;
}
