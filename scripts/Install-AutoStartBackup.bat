@echo off
REM ============================================
REM Installateur Tâche Planifiée - Backup Auto
REM ============================================
REM Ce fichier installe une tâche Windows pour démarrer automatiquement
REM le gestionnaire de backups au démarrage de Windows

echo.
echo ========================================
echo   Installation Backup Automatique
echo ========================================
echo.

REM Vérifier les droits administrateur
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERREUR: Ce script nécessite des droits administrateur!
    echo.
    echo Clic droit sur ce fichier ^> "Exécuter en tant qu'administrateur"
    echo.
    pause
    exit /b 1
)

echo [OK] Droits administrateur confirmés
echo.

REM Obtenir le chemin du script PowerShell
set SCRIPT_DIR=%~dp0
set PS_SCRIPT=%SCRIPT_DIR%Install-AutoStartBackup.ps1

REM Vérifier que le script existe
if not exist "%PS_SCRIPT%" (
    echo ERREUR: Script PowerShell introuvable!
    echo Chemin: %PS_SCRIPT%
    pause
    exit /b 1
)

echo [INFO] Lancement de l'installation...
echo.

REM Exécuter le script PowerShell d'installation
powershell.exe -ExecutionPolicy Bypass -File "%PS_SCRIPT%"

echo.
echo ========================================
echo.

exit /b 0
