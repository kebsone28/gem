# ============================================
# Script de Déplacement Automatique des Backups
# ============================================
# Ce script surveille le dossier Téléchargements et déplace automatiquement
# tous les fichiers backup_*.xlsx vers le dossier Sauvegarde-donnée

# Configuration
$appDirectory = Split-Path -Parent $PSScriptRoot
$backupFolder = Join-Path $appDirectory "Sauvegarde-donnée"
# Obtenir le dossier Téléchargements (UserProfile\Downloads)
$downloadsFolder = Join-Path $env:USERPROFILE "Downloads"
$logFile = Join-Path $appDirectory "backup-mover.log"

# Fonction de logging
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Add-Content -Path $logFile -Value $logMessage
    Write-Host $logMessage
}

# Créer le dossier de sauvegarde s'il n'existe pas
if (-not (Test-Path $backupFolder)) {
    New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
    Write-Log "✅ Dossier créé: $backupFolder"
}

Write-Log "🔍 Surveillance du dossier: $downloadsFolder"
Write-Log "📁 Destination: $backupFolder"
Write-Log "----------------------------------------"

# Fonction de nettoyage des anciens backups
function Cleanup-OldBackups {
    try {
        # 1. Supprimer les fichiers de plus de 30 jours
        $limitDate = (Get-Date).AddDays(-30)
        $oldFiles = Get-ChildItem -Path $backupFolder -Filter "backup_*.xlsx" | Where-Object { $_.LastWriteTime -lt $limitDate }
        
        foreach ($file in $oldFiles) {
            Remove-Item -Path $file.FullName -Force
            Write-Log "🗑️ Nettoyage: Supprimé (vieux > 30j) - $($file.Name)"
        }

        # 2. Garder maximum 50 fichiers récents (sécurité supplémentaire)
        $allFiles = Get-ChildItem -Path $backupFolder -Filter "backup_*.xlsx" | Sort-Object LastWriteTime -Descending
        if ($allFiles.Count -gt 50) {
            $filesToDelete = $allFiles | Select-Object -Skip 50
            foreach ($file in $filesToDelete) {
                Remove-Item -Path $file.FullName -Force
                Write-Log "🗑️ Nettoyage: Supprimé (limite 50) - $($file.Name)"
            }
        }
    }
    catch {
        Write-Log "⚠️ Erreur lors du nettoyage: $_"
    }
}

# Fonction pour déplacer un fichier
function Move-BackupFile {
    param([string]$FilePath)
    
    try {
        $fileName = Split-Path $FilePath -Leaf
        $destination = Join-Path $backupFolder $fileName
        
        # Vérifier si le fichier existe déjà
        if (Test-Path $destination) {
            # Ajouter un suffixe si le fichier existe
            $baseName = [System.IO.Path]::GetFileNameWithoutExtension($fileName)
            $extension = [System.IO.Path]::GetExtension($fileName)
            $counter = 1
            
            do {
                $newFileName = "${baseName}_${counter}${extension}"
                $destination = Join-Path $backupFolder $newFileName
                $counter++
            } while (Test-Path $destination)
        }
        
        # Déplacer le fichier
        Move-Item -Path $FilePath -Destination $destination -Force
        Write-Log "✅ Déplacé: $fileName → Sauvegarde-donnée"
        
        # Lancer le nettoyage après chaque déplacement
        Cleanup-OldBackups
        
        # Afficher une notification Windows
        $notification = New-Object -ComObject Wscript.Shell
        $notification.Popup("Backup déplacé: $fileName", 3, "Sauvegarde Automatique", 64)
        
    }
    catch {
        Write-Log "❌ Erreur lors du déplacement de $FilePath : $_"
    }
}

# Déplacer les fichiers existants au démarrage
Write-Log "🔄 Vérification des fichiers existants..."
$existingBackups = Get-ChildItem -Path $downloadsFolder -Filter "backup_*.xlsx" -ErrorAction SilentlyContinue

if ($existingBackups) {
    foreach ($file in $existingBackups) {
        Move-BackupFile -FilePath $file.FullName
    }
    Write-Log "📊 $($existingBackups.Count) fichier(s) existant(s) déplacé(s)"
}
else {
    Write-Log "ℹ️ Aucun fichier de backup existant trouvé"
}

Write-Log "✅ Surveillance active - Le script vérifie toutes les 3 secondes"
Write-Log "ℹ️ Appuyez sur Ctrl+C pour arrêter"
Write-Log "ℹ️ Pattern recherché: backup_*.xlsx"
Write-Log "----------------------------------------"

# Garder une trace des fichiers déjà traités
$processedFiles = @{}

# Boucle de surveillance (polling toutes les 3 secondes)
try {
    while ($true) {
        # Rechercher tous les fichiers backup_*.xlsx
        $backupFiles = Get-ChildItem -Path $downloadsFolder -Filter "backup_*.xlsx" -ErrorAction SilentlyContinue
        
        foreach ($file in $backupFiles) {
            # Vérifier si le fichier n'a pas déjà été traité
            if (-not $processedFiles.ContainsKey($file.FullName)) {
                # Attendre un peu pour s'assurer que le téléchargement est terminé
                Start-Sleep -Milliseconds 500
                
                # Vérifier que le fichier existe toujours et n'est pas verrouillé
                $canMove = $false
                $attempts = 0
                $maxAttempts = 3
                
                while ($attempts -lt $maxAttempts -and -not $canMove) {
                    try {
                        if (Test-Path $file.FullName) {
                            # Tenter d'ouvrir le fichier pour vérifier qu'il n'est pas verrouillé
                            $fileStream = [System.IO.File]::Open($file.FullName, 'Open', 'Read', 'None')
                            $fileStream.Close()
                            $canMove = $true
                        }
                    }
                    catch {
                        $attempts++
                        Start-Sleep -Milliseconds 500
                    }
                }
                
                if ($canMove) {
                    # Déplacer le fichier
                    Move-BackupFile -FilePath $file.FullName
                    
                    # Marquer comme traité
                    $processedFiles[$file.FullName] = $true
                }
                else {
                    Write-Log "⚠️ Impossible d'accéder au fichier: $($file.Name) (fichier verrouillé)"
                }
            }
        }
        
        # Nettoyer la liste des fichiers traités (garder seulement les 100 derniers)
        if ($processedFiles.Count -gt 100) {
            $keysToRemove = $processedFiles.Keys | Select-Object -First ($processedFiles.Count - 100)
            foreach ($key in $keysToRemove) {
                $processedFiles.Remove($key)
            }
        }
        
        # Attendre 3 secondes avant la prochaine vérification
        Start-Sleep -Seconds 3
    }
}
finally {
    Write-Log "🛑 Surveillance arrêtée"
}

