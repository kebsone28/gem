# GedCollect — Application Mobile de Collecte Terrain

GedCollect est une application Android (React Native) qui permet aux enquêteurs terrain de télécharger, remplir et soumettre des formulaires de collecte de données, connectée au serveur **GED OS** (https://ged.proquelec.sn).

## Architecture

```
gedcollect/
├── App.tsx                    # Point d'entrée avec navigation
├── index.js                   # Registration React Native
├── src/
│   ├── config/settings.ts     # Gestion des paramètres (AsyncStorage)
│   ├── services/
│   │   ├── api.ts             # API Client (downloadForm, submitForm, fetchServerForms)
│   │   ├── storage.ts         # Persistance AsyncStorage (forms + submissions)
│   │   └── backgroundSync.ts  # Synchronisation arrière-plan (BackgroundFetch + NetInfo)
│   ├── screens/
│   │   ├── FormListScreen.tsx # Écran principal : liste des formulaires téléchargés
│   │   ├── FormScreen.tsx     # Remplissage de formulaire (champs natifs)
│   │   └── SettingsScreen.tsx # Configuration serveur, sync, langues
│   ├── components/
│   │   ├── FormCard.tsx       # Carte formulaire (titre, version, stats, supprimer)
│   │   ├── SyncStatusBar.tsx  # Barre d'état sync (idle/syncing/success/error)
│   │   └── OfflineBanner.tsx  # Bannière hors-ligne
│   ├── types/index.ts         # Types TypeScript
│   └── utils/
│       ├── logger.ts          # Logger structuré
│       ├── strings.ts         # Traductions FR/EN
│       └── xmlParser.ts       # Parseur XML XLSForm
└── android/                   # Généré par react-native init
```

## Fonctionnalités

1. **Téléchargement de formulaires** — depuis le serveur GED OS
2. **Remplissage hors-ligne** — tous les formulaires sont stockés localement
3. **File d'attente de soumission** — les réponses sont mises en file d'attente
4. **Synchronisation automatique** — en arrière-plan via BackgroundFetch
5. **Détection de connectivité** — avec NetInfo (option WiFi uniquement)
6. **Interface KoboCollect-like** — dark mode, navigation fluide
7. **Multilingue** — Français / Anglais

## Prérequis

- Node.js >= 18
- JDK 17
- Android Studio avec SDK 33+
- Une clé de signature APK (voir ci-dessous)

## Installation

```bash
# 1. Installer les dépendances
cd mobile/gedcollect
npm install

# 2. Lier les bibliothèques natives
npx react-native link

# 3. Lancer sur appareil/émulateur
npx react-native run-android
```

## Génération et Signature APK

### 1. Créer la clé de signature (keystore)

```bash
keytool -genkey -v -keystore android/app/gedcollect-release.keystore \
  -alias gedcollect -keyalg RSA -keysize 2048 -validity 10000
```

Renseigner :
- Mot de passe keystore
- Mot de passe clé (peut être identique)
- Prénom/Nom, Unité, Organisation, Ville, Région, Pays

### 2. Configurer Gradle

Dans `android/gradle.properties`, ajouter :

```properties
GEDCOLLECT_RELEASE_STORE_FILE=gedcollect-release.keystore
GEDCOLLECT_RELEASE_KEY_ALIAS=gedcollect
GEDCOLLECT_RELEASE_STORE_PASSWORD=***votre_mdp***
GEDCOLLECT_RELEASE_KEY_PASSWORD=***votre_mdp***
```

### 3. Configurer le build Gradle

Dans `android/app/build.gradle`, dans le bloc `android { signingConfigs { ... } }` :

```gradle
signingConfigs {
    release {
        storeFile file(GEDCOLLECT_RELEASE_STORE_FILE)
        storePassword GEDCOLLECT_RELEASE_STORE_PASSWORD
        keyAlias GEDCOLLECT_RELEASE_KEY_ALIAS
        keyPassword GEDCOLLECT_RELEASE_KEY_PASSWORD
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

### 4. Builder l'APK

```bash
# Build de release
npm run build
# ou
cd android && ./gradlew assembleRelease
```

### 5. APK généré

```
android/app/build/outputs/apk/release/app-release.apk
```

## Endpoints API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v2/assets` | Liste des formulaires disponibles |
| GET | `/api/v2/assets/{uid}/download` | Télécharger un formulaire (XML) |
| POST | `/api/v2/assets/{uid}/submission` | Soumettre les réponses (multipart) |
| GET | `/api/v2/status` | Vérifier l'état du serveur |

## Backend Sync

Le backend expose également :

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/sync/gedtoolbox` | Déclenche la synchronisation des soumissions GedCollect vers la base de données |

Logs backend : `[GEDCOLLECT_PULL_SYNC]` dans `sync.controller.js`.

## Tests

```bash
npm test
```

Linting :

```bash
npm run lint
```

## Licence

Propriété de Proquèlec — Usage interne uniquement.
