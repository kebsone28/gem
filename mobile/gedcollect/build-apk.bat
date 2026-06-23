@echo off
REM =====================================================
REM  Script de build APK GedCollect
REM  Prérequis : JDK 17+, Android SDK 33+, Node.js
REM =====================================================

echo [1/5] Installation des dependances npm...
call npm install
if %errorlevel% neq 0 (
  echo ERREUR: npm install a echoue
  exit /b 1
)

echo [2/5] Verification du keystore...
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

echo [3/5] Bundling JS...
call npx react-native bundle --platform android --dev false --entry-file index.js ^
  --bundle-output android/app/src/main/assets/index.android.bundle ^
  --assets-dest android/app/src/main/res
if %errorlevel% neq 0 (
  echo ERREUR: Bundle JS a echoue
  exit /b 1
)

echo [4/5] Nettoyage des ressources dupliquees...
if exist android\app\src\main\res\drawable-mdpi (
  rmdir /s /q android\app\src\main\res\drawable-mdpi 2>nul
)
if exist android\app\src\main\res\drawable-hdpi (
  rmdir /s /q android\app\src\main\res\drawable-hdpi 2>nul
)
if exist android\app\src\main\res\drawable-xhdpi (
  rmdir /s /q android\app\src\main\res\drawable-xhdpi 2>nul
)
if exist android\app\src\main\res\drawable-xxhdpi (
  rmdir /s /q android\app\src\main\res\drawable-xxhdpi 2>nul
)
if exist android\app\src\main\res\drawable-xxxhdpi (
  rmdir /s /q android\app\src\main\res\drawable-xxxhdpi 2>nul
)
if exist android\app\src\main\res\raw (
  rmdir /s /q android\app\src\main\res\raw 2>nul
)

echo [5/5] Build Gradle (%BUILD_TYPE%)...
cd android
call gradlew %BUILD_TYPE%
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
