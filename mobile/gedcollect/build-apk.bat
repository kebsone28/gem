@echo off
REM =====================================================
REM  Script de build APK GedCollect (Hermes optimisé)
REM  Prérequis : JDK 17+, Android SDK 33+, Node.js
REM  ATTENTION : Le bundling JS + compilation Hermes sont
REM  gérés automatiquement par le plugin Gradle com.facebook.react
REM  Ne PAS lancer "react-native bundle" manuellement avant Gradle.
REM =====================================================

echo [1/4] Installation des dependances npm...
call npm install
if %errorlevel% neq 0 (
  echo ERREUR: npm install a echoue
  exit /b 1
)

echo [2/4] Verification du keystore...
if not exist android\app\gedcollect-release.keystore (
  echo.
  echo AVERTISSEMENT: Keystore de release introuvable.
  echo Generer une cle avec :
  echo   keytool -genkey -v -keystore android\app\gedcollect-release.keystore ^
    -alias gedcollect -keyalg RSA -keysize 2048 -validity 10000
  echo.
  echo Generation du debug APK uniquement...
  set BUILD_TYPE=assembleDebug
) else (
  set BUILD_TYPE=assembleRelease
)

echo [3/4] Build Gradle (%BUILD_TYPE%) - bundling + Hermes automatique...
cd android
call gradlew --stop 2^>nul
call gradlew clean
call gradlew %BUILD_TYPE% --info
if %errorlevel% neq 0 (
  echo ERREUR: Build Gradle a echoue
  cd ..
  exit /b 1
)
cd ..

echo.
echo =====================================================
echo  BUILD TERMINE AVEC SUCCES !
echo.
if "%BUILD_TYPE%"=="assembleRelease" (
  echo  APK Release : android\app\build\outputs\apk\release\app-release.apk
) else (
  echo  APK Debug : android\app\build\outputs\apk\debug\app-debug.apk
)
echo =====================================================
pause
