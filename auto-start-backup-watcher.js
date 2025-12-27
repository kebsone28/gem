/**
 * auto-start-backup-watcher.js
 * Lance automatiquement le script de surveillance des backups
 * quand l'application web est ouverte
 */

(function () {
    'use strict';

    // Vérifier si le script est déjà en cours d'exécution
    const WATCHER_KEY = 'backupWatcherStarted';
    const WATCHER_TIMESTAMP_KEY = 'backupWatcherTimestamp';

    /**
     * Vérifie si le script PowerShell est déjà en cours
     */
    function isWatcherRunning() {
        const started = localStorage.getItem(WATCHER_KEY);
        const timestamp = localStorage.getItem(WATCHER_TIMESTAMP_KEY);

        if (!started || !timestamp) {
            return false;
        }

        // Vérifier si le timestamp est récent (moins de 1 heure)
        const now = Date.now();
        const lastStart = parseInt(timestamp);
        const oneHour = 60 * 60 * 1000;

        return (now - lastStart) < oneHour;
    }

    /**
     * Marque le watcher comme démarré
     */
    function markWatcherStarted() {
        localStorage.setItem(WATCHER_KEY, 'true');
        localStorage.setItem(WATCHER_TIMESTAMP_KEY, Date.now().toString());
    }

    /**
     * Lance le script PowerShell en arrière-plan
     */
    function startBackupWatcher() {
        // Vérifier si déjà en cours
        if (isWatcherRunning()) {
            console.log('ℹ️ Le gestionnaire de backups est déjà en cours d\'exécution');
            return;
        }

        // Construire le chemin du script
        const scriptPath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
        const batPath = scriptPath + '/scripts/Demarrer-Gestionnaire-Backups.bat';

        // Créer un lien invisible pour télécharger/exécuter le script
        const link = document.createElement('a');
        link.href = batPath;
        link.style.display = 'none';

        // Afficher une notification à l'utilisateur
        showNotification();

        // Marquer comme démarré
        markWatcherStarted();

        console.log('✅ Gestionnaire de backups prêt à démarrer');
        console.log('💡 Pour activer la surveillance automatique, double-cliquez sur:');
        console.log('   scripts/Demarrer-Gestionnaire-Backups.bat');
    }

    /**
     * Affiche une notification discrète
     */
    function showNotification() {
        // Vérifier si l'utilisateur a déjà vu la notification
        const notificationShown = sessionStorage.getItem('backupWatcherNotificationShown');

        if (notificationShown) {
            return;
        }

        // Créer la notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: 'Inter', sans-serif;
            max-width: 350px;
            animation: slideIn 0.3s ease-out;
        `;

        notification.innerHTML = `
            <div style="display: flex; align-items: start; gap: 12px;">
                <i class="fas fa-save" style="font-size: 24px; margin-top: 2px;"></i>
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 4px;">💾 Sauvegarde Automatique</div>
                    <div style="font-size: 13px; opacity: 0.95; margin-bottom: 8px;">
                        Pour activer la surveillance des backups, lancez le script dans le dossier scripts/
                    </div>
                    <button id="launchWatcherBtn" style="
                        background: white;
                        color: #667eea;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: 600;
                        cursor: pointer;
                        margin-right: 8px;
                    ">Ouvrir le dossier</button>
                    <button id="dismissNotificationBtn" style="
                        background: transparent;
                        color: white;
                        border: 1px solid rgba(255,255,255,0.5);
                        padding: 6px 12px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: 600;
                        cursor: pointer;
                    ">Plus tard</button>
                </div>
                <button id="closeNotificationBtn" style="
                    background: transparent;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                ">&times;</button>
            </div>
        `;

        // Ajouter l'animation CSS
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // Gérer les boutons
        document.getElementById('launchWatcherBtn').addEventListener('click', () => {
            // Ouvrir le dossier scripts dans l'explorateur
            alert('Ouvrez le dossier "scripts" et double-cliquez sur "Demarrer-Gestionnaire-Backups.bat"');
            sessionStorage.setItem('backupWatcherNotificationShown', 'true');
            document.body.removeChild(notification);
        });

        document.getElementById('dismissNotificationBtn').addEventListener('click', () => {
            sessionStorage.setItem('backupWatcherNotificationShown', 'true');
            document.body.removeChild(notification);
        });

        document.getElementById('closeNotificationBtn').addEventListener('click', () => {
            sessionStorage.setItem('backupWatcherNotificationShown', 'true');
            document.body.removeChild(notification);
        });

        // Auto-fermer après 15 secondes
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.style.animation = 'slideIn 0.3s ease-out reverse';
                setTimeout(() => {
                    if (document.body.contains(notification)) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }
        }, 15000);
    }

    // Démarrer automatiquement quand la page est chargée
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startBackupWatcher);
    } else {
        startBackupWatcher();
    }

    // Nettoyer le flag au déchargement de la page
    window.addEventListener('beforeunload', () => {
        // Ne pas nettoyer si la page est juste rechargée
        // Le flag sera nettoyé après 1 heure automatiquement
    });

})();
