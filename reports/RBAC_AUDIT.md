# Audit RBAC — GEM_SAAS

Date: 2026-05-05

Résumé exécutif
---------------
Audit du système de droits d'accès granulaires (RBAC + permissions) et validation fonctionnelle.

Conclusions rapides
- Schéma Prisma implémente `Role`, `Permission`, `RolePermission` — source de vérité en DB.
- Configuration centrale des clés : `backend/src/core/config/permissions.js` (mis à jour).
- JWT inclut `permissions` et `role` : système supporte overrides utilisateur.
- Middlewares d'enforcement : `authProtect` + `authorize` + `verifierPermission` + `verifierAssignation`.
- UI montre des cases granulaire pour les modules; certaines clés manquantes ont été ajoutées et mappées.

Travail réalisé
---------------
- Inventaire des fichiers clés (schema, config, middlewares, routes). Voir :
  - `backend/prisma/schema.prisma`
  - `backend/src/core/config/permissions.js`
  - `backend/src/middleware/verifierPermission.js`
  - `backend/src/api/middlewares/auth.js`
  - Routes missions : `backend/src/api/routes/mission.routes.js`
- Ajout de permissions manquantes pour actions liées aux missions (voir fichier `permissions.js`).
- Seed RBAC exécuté (`backend/prisma/seed_rbac.js`) pour synchroniser DB.
- Passage des routes missions pour utiliser `verifierPermission(...)` au lieu de se fier uniquement aux rôles.
- Ajout d'un endpoint debug : `GET /api/debug/whoami` retournant `rolePermissions`, `tokenPermissions`, `effectivePermissions`.
- Tests automatisés rapides :
  - `frontend/e2e/permissions-missions.spec.ts` (Playwright) ajouté.
  - `backend/scripts/check_permissions.mjs` : script Node qui :
    - se loggue via `/api/auth/login` (admin seedé `admingem`),
    - crée des missions,
    - tente suppression avec user non-admin (attendu 403),
    - supprime en admin (200).

Résultats techniques (exécution locale)
---------------------------------------
- Backend démarré sur `http://localhost:5008`.
- Login `admingem` / `suprime` / 2FA `CORAN` fonctionne et fournit un `accessToken`.
- Tests réalisés avec `backend/scripts/check_permissions.mjs` :
  - Création de mission : OK (200) via admin.
  - Tentative de suppression par `cp_gem` (sans `supprimer_missions`) : 403 (contrôle OK).
  - Suppression par admin : 200 (opération réussie).

Risques et recommandations
-------------------------
- Risque UX/Sécurité : l'UI peut afficher des toggles pour des permissions qui n'étaient pas encore implémentées côté backend — nous avons ajouté les clés manquantes mais il faut synchroniser l'UI pour afficher les clefs exactes.
- Recommandation 1 : Ajouter dans l'admin une vue « Permissions effectives » qui montre `role + overrides` par utilisateur (utiliser `/api/debug/whoami` comme source de debug).
- Recommandation 2 : Couvrir avec tests e2e complets (login -> create -> permission toggle -> attempt action) pour chaque permission critique (missions, utilisateurs, finances).
- Recommandation 3 : Ajouter monitoring/logging RBAC (audit logs sur 403 et sur modifications de permissions) — utile pour enquêtes.

Actions proposées
-----------------
- Synchroniser l'UI admin avec `PERMISSIONS` keys et ajouter l'aperçu effectif.
- Convertir progressivement les routes sensibles à `verifierPermission(...)`.
- Ajouter tests Playwright end-to-end couvrant les scénarios critiques.

Fichiers modifiés/ajoutés
-------------------------
- Modifié : `backend/src/core/config/permissions.js`
- Modifié : `backend/src/api/routes/mission.routes.js`
- Modifié : `backend/src/api/routes/debug.routes.js`
- Ajouté : `frontend/e2e/permissions-missions.spec.ts`
- Ajouté : `backend/scripts/check_permissions.mjs`
- Ajouté : `REPORTS/RBAC_AUDIT.md`

Fin
---

Si vous voulez, je peux :
- Générer une page admin pour visualiser et modifier les permissions d'un utilisateur.
- Étendre les tests Playwright pour couvrir toutes les permissions listées dans l'UI.
- Préparer un merge commit avec ces changements et un guide de déploiement.
