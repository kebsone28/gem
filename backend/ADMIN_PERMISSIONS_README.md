# Admin Role-Permissions API — Documentation rapide

Ce fichier décrit l'API backend et l'intégration frontend pour gérer la matrice rôle → permissions ajoutée lors de l'audit RBAC.

Remarques générales
- Endpoints protégés : exigent authentification (`/api/auth/login`) et la permission `gerer_utilisateurs`.
- Les permissions sont persistées en base via les tables `Role`, `Permission`, `RolePermission` (Prisma).
- Frontend minimal : page admin accessible via `/admin/permissions` (composant `frontend/src/pages/AdminPermissions.tsx`).

Endpoints

1) GET /api/admin/role-permissions
- Description : renvoie la liste des rôles avec leurs permissions et la liste canonique de toutes les permissions.
- Permissions requises : `gerer_utilisateurs`.
- Réponse (200) :
  {
    "ok": true,
    "roles": [ { "role": "CHEF_PROJET", "permissions": ["voir_missions", ...] }, ... ],
    "permissions": ["voir_missions", "creer_mission", ...]
  }

2) POST /api/admin/role-permissions/:role
- Description : remplace l'ensemble des permissions assignées au rôle `:role`.
- Body attendu : `{ "permissions": ["key1","key2",...] }` (array de clés string)
- Permissions requises : `gerer_utilisateurs`.
- Effets :
  - Crée automatiquement les `Permission` manquantes (champ `label` requis par le schéma Prisma est fourni).
  - Recrée le mapping `RolePermission` pour le rôle donné (opération en transaction).
- Réponses :
  - 200 : `{ ok: true, role: "CHEF_PROJET", permissions: [...] }`
  - 400 : input invalide
  - 404 : rôle introuvable
  - 500 : erreur serveur

Sécurité et bonnes pratiques
- N'utiliser que des interfaces d'administration réservées aux comptes dotés de la permission `gerer_utilisateurs`.
- Versionner la configuration des permissions dans le contrôle de source si vous souhaitez reproduire une matrice standard.
- Ajouter audit log sur les modifications (les modifications sont auditées automatiquement par Prisma client extension si `userId`/`organizationId` sont dans le contexte).

Script de test local
- Emplacement : `backend/scripts/test_admin_permissions.mjs`
- Usage (PowerShell) :

```powershell
$env:ADMIN_EMAIL='admingem';
$env:ADMIN_PASSWORD='suprime';
$env:ADMIN_2FA='CORAN';
$env:BACKEND_BASE='http://localhost:5008';
node backend/scripts/test_admin_permissions.mjs
```

Intégration frontend
- Page : `frontend/src/pages/AdminPermissions.tsx` (ajoute une UI pour lire/modifier et sauvegarder la matrice)
- Service API : `frontend/src/services/adminPermissionsService.ts`
- Route client : `/admin/permissions`

Export / Import JSON
--------------------

1) GET /api/admin/role-permissions/export
- Description: exporte la matrice actuelle sous forme JSON. Requiert `gerer_utilisateurs`.
- Réponse: `{ ok: true, exportedAt: '...', roles: [{ role, permissions: [...] }] }`

2) POST /api/admin/role-permissions/import
- Description: importe une matrice complète. Body attendu: `{ roles: [{ role: 'NAME', permissions: ['p1','p2'] }, ...] }`.
- Comportement: crée les permissions/roles manquants, remplace la liste `RolePermission` pour chaque rôle fourni.
- Réponse: `{ ok: true, importedAt: '...', rolesImported: N }`

Notes de déploiement
- Assurez-vous que la base et le schéma Prisma contiennent les champs attendus (`permission.label` requis). Le code crée maintenant les permissions manquantes avec `label` pour conformité.
- Redémarrer le backend après modification de la structure Prisma si nécessaire.

Contact / suite
- Pour exporter/importer la matrice, je peux ajouter endpoints `GET /api/admin/role-permissions/export` et `POST /api/admin/role-permissions/import` (JSON). Voulez-vous que je les ajoute ?
