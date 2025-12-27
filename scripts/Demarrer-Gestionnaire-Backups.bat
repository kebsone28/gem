@echo off
REM ============================================
REM Lanceur du Script de Déplacement Automatique
REM ============================================
REM Ce fichier lance le script PowerShell en arrière-plan

echo.
echo ========================================
echo   Demarrage du Gestionnaire de Backups
echo ========================================
echo.

REM Obtenir le chemin du script
set SCRIPT_DIR=%~dp0
set PS_SCRIPT=%SCRIPT_DIR%auto-move-backups.ps1

REM Vérifier que le script PowerShell existe
if not exist "%PS_SCRIPT%" (
    echo ERREUR: Script PowerShell introuvable!
    echo Chemin: %PS_SCRIPT%
    pause
    exit /b 1
)

echo [INFO] Lancement du script de surveillance...
echo [INFO] Les backups seront automatiquement deplaces vers:
echo        %SCRIPT_DIR%..\Sauvegarde-donnee
echo.
echo [INFO] Une fenetre PowerShell va s'ouvrir.
echo        NE PAS LA FERMER pour que la surveillance continue.
echo.
echo Appuyez sur une touche pour demarrer...
pause >nul

REM Lancer le script PowerShell dans une nouvelle fenêtre
start "Gestionnaire de Backups" powershell.exe -ExecutionPolicy Bypass -NoExit -File "%PS_SCRIPT%"

echo.
echo [OK] Script lance avec succes!
echo.
echo Pour arreter la surveillance:
echo   - Fermez la fenetre PowerShell qui vient de s'ouvrir
echo   - Ou appuyez sur Ctrl+C dans cette fenetre
echo.

exit /b 0
