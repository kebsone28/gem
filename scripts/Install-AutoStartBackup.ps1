# Tâche Planifiée Windows - Démarrage Automatique du Gestionnaire de Backups
# À exécuter en tant qu'administrateur

# Nom de la tâche
$taskName = "Electrification-BackupWatcher"

# Chemin du script batch
$scriptPath = "C:\Mes Sites Web\Gestion électrification massive - V3\scripts\Demarrer-Gestionnaire-Backups.bat"

# Vérifier que le script existe
if (-not (Test-Path $scriptPath)) {
    Write-Host "ERREUR: Script introuvable à $scriptPath" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour quitter"
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Installation Tâche Planifiée Windows" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier si la tâche existe déjà
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "⚠️  La tâche existe déjà. Suppression..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Créer l'action (exécuter le script)
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$scriptPath`""

# Créer le déclencheur (au démarrage de Windows + à la connexion utilisateur)
$trigger1 = New-ScheduledTaskTrigger -AtStartup
$trigger2 = New-ScheduledTaskTrigger -AtLogOn

# Paramètres de la tâche
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Enregistrer la tâche
try {
    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger1, $trigger2 `
        -Principal $principal `
        -Settings $settings `
        -Description "Démarre automatiquement le gestionnaire de backups pour l'application Gestion Électrification" `
        -ErrorAction Stop

    Write-Host ""
    Write-Host "✅ Tâche planifiée créée avec succès!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Configuration:" -ForegroundColor Cyan
    Write-Host "  - Nom: $taskName" -ForegroundColor White
    Write-Host "  - Démarrage: Au démarrage Windows + Connexion utilisateur" -ForegroundColor White
    Write-Host "  - Script: $scriptPath" -ForegroundColor White
    Write-Host ""
    Write-Host "La surveillance des backups démarrera automatiquement" -ForegroundColor Green
    Write-Host "à chaque connexion Windows!" -ForegroundColor Green
    Write-Host ""
    
    # Demander si on veut démarrer immédiatement
    $start = Read-Host "Voulez-vous démarrer la tâche maintenant? (O/N)"
    if ($start -eq "O" -or $start -eq "o") {
        Start-ScheduledTask -TaskName $taskName
        Write-Host "✅ Tâche démarrée!" -ForegroundColor Green
    }

} catch {
    Write-Host ""
    Write-Host "❌ Erreur lors de la création de la tâche:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Assurez-vous d'exécuter ce script en tant qu'administrateur" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Pour gérer la tâche:" -ForegroundColor Cyan
Write-Host "  - Ouvrir: Planificateur de tâches (taskschd.msc)" -ForegroundColor White
Write-Host "  - Chercher: $taskName" -ForegroundColor White
Write-Host ""

Read-Host "Appuyez sur Entrée pour quitter"
