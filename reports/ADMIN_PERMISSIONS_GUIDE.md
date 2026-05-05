# Guide basique — Gestion des permissions

Ce guide explique rapidement les deux façons de gérer les permissions dans l'application :

## 1) Matrice globale (rôle → permissions)
- Emplacement UI : page `AdminPermissions` (route cliente `/admin/permissions`).
- But : définir la configuration canonique des permissions pour chaque rôle.
- Persistée côté serveur : table `Role` / `Permission` (via les endpoints `/api/admin/role-permissions`).
- Actions disponibles : lire, remplacer les permissions d'un rôle, exporter / importer la matrice au format JSON.
- Impact : les utilisateurs qui n'ont pas d'override (mode automatique) héritent de ces valeurs.

Quand l'utiliser :
- Pour modifier les droits par défaut d'un rôle (par ex. ajouter `VOIR_RAPPORTS` pour tous les directeurs).

## 2) Droits granulaires par utilisateur
- Emplacement UI : panneau "Droits d'accès granulaires" dans la fiche utilisateur (`AdminUsers`).
- But : activer/désactiver des permissions pour un utilisateur spécifique.
- Modes :
  - Mode Automatique : l'utilisateur hérite des permissions définies par son rôle (lecture seule ici).
  - Mode Personnalisé : la liste `user.permissions` contient un override explicite pour cet utilisateur.
- Persistée : sur l'objet utilisateur (champ `permissions`).
- Impact : override local — n'affecte pas les autres membres du même rôle.

Quand l'utiliser :
- Pour accorder temporairement ou durablement des droits spécifiques à un compte sans toucher à la matrice globale.

## Synchronisation / Actions croisées
- Depuis la fiche utilisateur vous pouvez :
  - Ouvrir la matrice globale (bouton "Ouvrir matrice") pour consulter ou modifier le mapping role→permissions.
  - Appliquer l'état courant des cases cochées au rôle (`Appliquer au rôle`) : ceci appelle l'API `/api/admin/role-permissions/:role` et remplace la configuration canonique du rôle.

Attention : `Appliquer au rôle` écrase les permissions par défaut du rôle — prévoir une confirmation et audit.

## Bonnes pratiques
- Préférer modifier la matrice globale pour des changements qui doivent s'appliquer à tous les membres d'un rôle.
- Utiliser les overrides utilisateur pour exceptions, aides temporaires, ou comptes spécifiques.
- Toujours laisser une trace d'audit lors de modifications de la matrice globale.

## Endpoints utiles
- `GET /api/admin/role-permissions` — lister le mapping.
- `POST /api/admin/role-permissions/:role` — remplacer les permissions d'un rôle.
- `GET /api/admin/role-permissions/export` — export JSON.
- `POST /api/admin/role-permissions/import` — import JSON.
- `GET /api/debug/whoami` — debug permissions effectives pour l'utilisateur courant.

---
Guide généré automatiquement — ajuster wording/lieux selon besoin.