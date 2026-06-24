## Documentation GED OS

*Dernière mise à jour du README*

GED OS est une plateforme intelligente multidomaine pour piloter des écosystèmes métiers dans les infrastructures, l'énergie, l'agriculture, la santé, la gouvernance, la logistique et le développement territorial.

### 📚 Documentation Référence

- 📖 [**Définition Complète**](./GED_OS_DEFINITION.md) — Vision, architecture, 6 domaines, capacités
- 📋 [**Version Courte (Institutionnelle)**](./GED_OS_SHORT.md) — Pour décideurs et partenaires
- 🚀 [**Vision (2026–2030)**](./GED_OS_VISION.md) — Manifeste et feuille de route stratégique

### 🛠️ Documentation Implémentation (Dev-focused)

**🆕 Sprint 1 Foundation Just Completed! 🎉**

- 🎉 [**Sprint 1 Summary**](./SPRINT1_SUMMARY.md) — ⭐ START HERE (5 min overview)
- 📋 [**Sprint 1 Checklist**](./SPRINT1_CHECKLIST.md) — Complete checklist + next steps
- 📂 [**Sprint 1 File Manifest**](./SPRINT1_FILE_MANIFEST.md) — All 23 files created today
- 🎊 [**Sprint 1 Foundation Complete**](./SPRINT1_FOUNDATION_COMPLETE.md) — Detailed deliverables
- 🔌 [**Integration Guide**](./SPRINT1_INTEGRATION_GUIDE.md) — How to integrate new code

**📍 Feuille de Route & Planning**

- 📍 [**Feuille de Route Multidomaine**](./GED_OS_IMPLEMENTATION_ROADMAP.md) — Stratégie de transformation (5 phases)
- ✅ [**Plan d'Action Immédiat**](./GED_OS_ACTION_PLAN.md) — Sprints 1–6, métriques, risks

**🏗️ Technical & Architecture**

- 🏗️ [**Architecture Technique**](./ARCHITECTURE_MULTIDOMAINE_TECHNICAL.md) — Patterns, adapters, implémentation détaillée
- 🚀 [**Quick Reference Dev**](./DEVELOPER_QUICK_REFERENCE.md) — Setup, checklist, API examples

### 🎯 Résumé Exécutif & Status

📍 **Status** : Électrification stable (production) + **Sprint 1 Foundation COMPLETE** ✅  
� **ACTION**: [PROCHAINES_ETAPES.md](./PROCHAINES_ETAPES.md) ⭐ **LIRE EN PREMIER** (étapes concrètes 24 mai)  
📖 **Vue d'ensemble** : [SPRINT1_SUMMARY.md](./SPRINT1_SUMMARY.md) (5 min)

**État actuel** (17 mai 2026) : Foundation multidomaine complète (12 fichiers code + 14 documentation).

**État technique** (mai 2026) : Plateforme d'électrification stable (50k+ ménages Sénégal) avec **architecture modulaire multidomaine** désormais prête pour agriculture, santé, logistique.

**Vision** : Plateforme générique supportant agriculture, santé, logistique, gouvernance (2026–2030).

**Stratégie** : Adapter progressivement le code existant sans breaking changes, généraliser via DomainAdapter pattern, ajouter nouveaux domaines tous les 2 semaines.

**Timeline** : Foundation ✅ (17 mai) → **Prisma Migration 24 mai** → Agriculture Pilot (14 juin) → 6 domaines Q4 2026

---

## Quick Start

Ce dépôt contient une version web statique de l'application. Le scaffold Electron permet d'exécuter l'application localement comme application de bureau.

Prérequis
- Node.js 18+ et npm installés

Installer et lancer en environnement de développement (PowerShell sous Windows):

```powershell
cd "c:\Users\User\Documents\PROQUELEC\2. PROJET\GED OS"
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
