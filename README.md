# GED OS - Gestionnaire Écosystème Digital (Ex-GEM)

Ce dépôt contient une version web statique de l'application. Le scaffold Electron permet d'exécuter l'application localement comme application de bureau.

Prérequis
- Node.js 18+ et npm installés

Installer et lancer en environnement de développement (PowerShell sous Windows):

```powershell
cd "c:\Users\User\Documents\PROQUELEC\2. PROJET\Gestion électrification massive"
npm install
npm start
```

Notes
- Le script `npm start` lance Electron et charge la page `index.html` locale.
- Pour packager en exécutable Windows, installez les dépendances dev et utilisez `npm run package-win` (nécessite `electron-builder` et configuration additionnelle).
- L'application reste côté client; les imports de fichiers sont gérés par les inputs `<input type=file>` déjà ajoutés.
- Lors des imports (Excel/Kobo), le statut du ménage dans le fichier écrase toujours le statut local; les valeurs sont normalisées vers le workflow unique : Non débuté → Murs → Réseau → Intérieur → Réception ou Problème/Inéligible.

IndexedDB & Cartographie
- L'application utilise IndexedDB pour stocker localement l'état du projet et une file d'attente de synchronisation (offline-first). Les données sont automatiquement chargées au démarrage.
- La page `terrain.html` affiche la cartographie des ménages importés via Leaflet (GeoJSON ou CSV avec lat/lon). Importez un fichier depuis la page `Paramètres` puis ouvrez `Terrain` pour visualiser les points.

- Map rendering est centralisé dans `map_manager.js` (MapManager). La version legacy dans `main.js` est dépréciée : préférer `window.mapManager` et l'EventBus pour interagir avec la carte.
- Vous pouvez forcer le comportement legacy pour tests/rollback en définissant `window.APP_CONFIG.mapImplementation = 'legacy'` avant que les scripts soient chargés.

Publication & Signage (Windows installer)
--------------------------------------
Si vous souhaitez publier des installeurs Windows sur GitHub Releases (workflow CI déjà préparé), suivez ces étapes :

1. Ajoutez vos secrets dans GitHub (Settings → Secrets → Actions) :
	- CSC_LINK : URL ou contenu encodé (base64) de votre fichier .pfx de signature
	- CSC_KEY_PASSWORD : mot de passe du fichier .pfx

2. Le workflow `release.yml` se déclenche automatiquement lorsque vous poussez une **tag** au format `v*` (ex: `v1.2.0`).

3. Pour créer un tag et publier :
```powershell
# sur votre machine locale, créez un tag (par ex. v1.2.0) et poussez
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0
```

4. Le workflow va exécuter `npm run package-win` (utilise `electron-builder`), tenter de signer si `CSC_LINK`/`CSC_KEY_PASSWORD` sont fournis, et créer une Release GitHub avec les artifacts (installers) disponibles dans `dist/`.

5. Si vous ne souhaitez pas signer immédiatement, laissez `CSC_LINK` vide ; le workflow publiera l'installateur sans signature.

6. Notes sécurité : Ne jamais stocker des clés/certificats dans le dépôt. Utilisez GitHub Secrets, Azure Key Vault, ou autre gestionnaire de secrets.

### Synchronisation Cloud & Master Local

Pour synchroniser vos données locales avec la production Railway :

1.  **Ouvrez un terminal** dans le dossier `backend`.
2.  **Lancer les commandes** :
    - `npm run sync-up` : Pousse vos ménages locaux vers le Cloud (Master Local).
    - `npm run sync-down` : Récupère les modifications du terrain sur votre PC.

*Note : Le script est intelligent et protège les données les plus récentes via le champ `updatedAt`.*

#   e l e c t r o n 
