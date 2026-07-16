# Instructions pour l'application de la migration carto_grappes

## Aperçu des modifications

Cette migration ajoute 3 nouvelles tables PostgreSQL pour stocker les régions, grappes et lots du module Cartographie Grappes.

## Nouvelles tables

1. **CartoRegion** - Stocke les régions géographiques
   - id, organizationId, name, code, description, active
   - Index unique sur (organizationId, code)

2. **CartoGrappe** - Stocke les grappes par région
   - id, organizationId, regionId, grappeNumber, grappeKey, menageCount, active
   - Index unique sur (organizationId, grappeKey)
   - Index sur (organizationId, regionId)

3. **CartoLot** - Stocke les lots (A, B, C)
   - id, organizationId, lotKey, title, description, active
   - Index unique sur (organizationId, lotKey)

## Application de la migration

### Option 1: Via psql (recommandé)
```bash
cd C:\Mes-Sites-Web\GED_SAAS\backend
psql -d electrification -f apply_carto_migration.sql
```

### Option 2: Via pgAdmin
1. Ouvrir pgAdmin
2. Connecter à la base de données "electrification"
3. Ouvrir l'éditeur SQL (Tools > Query Tool)
4. Copier le contenu du fichier `apply_carto_migration.sql`
5. Exécuter le script

### Option 3: Via PowerShell
```powershell
cd C:\Mes-Sites-Web\GED_SAAS\backend
.\apply_migration.ps1
```

### Option 4: Via Prisma (NON RECOMMANDÉ - risque de perte de données)
```bash
cd C:\Mes-Sites-Web\GED_SAAS\backend
npx prisma generate
npx prisma db push --accept-data-loss
```
⚠️ **ATTENTION**: Cette option peut entraîner la perte de données existantes dans les tables carto_*

## Initialisation des données par défaut

Après la migration, vous pouvez initialiser les données par défaut via l'API:

```bash
POST /carto-grappes/initialize
```

Cela créera:
- Les 3 lots par défaut (A, B, C) avec leurs descriptions
- Les régions détectées automatiquement à partir des ménages existants

## Modifications du backend

**Nouveaux contrôleurs ajoutés:**
- `getRegions()` - Récupère toutes les régions
- `upsertRegion()` - Crée ou met à jour une région
- `getGrappes()` - Récupère toutes les grappes
- `upsertGrappe()` - Crée ou met à jour une grappe
- `getLots()` - Récupère tous les lots
- `upsertLot()` - Crée ou met à jour un lot
- `initializeDefaultData()` - Initialise les données par défaut

**Nouvelles routes API:**
- `GET /carto-grappes/regions`
- `POST /carto-grappes/regions`
- `GET /carto-grappes/grappes`
- `POST /carto-grappes/grappes`
- `GET /carto-grappes/lots`
- `POST /carto-grappes/lots`
- `POST /carto-grappes/initialize`

## Modifications du frontend

**Nouvelles fonctions API:**
- `fetchRegions()` - Récupère les régions depuis le serveur
- `upsertRegion()` - Enregistre une région sur le serveur
- `fetchGrappes()` - Récupère les grappes depuis le serveur
- `upsertGrappe()` - Enregistre une grappe sur le serveur
- `fetchLots()` - Récupère les lots depuis le serveur
- `upsertLot()` - Enregistre un lot sur le serveur
- `initializeDefaultData()` - Initialise les données par défaut

**Nouvel état dans useCartoGrappes:**
- `serverConfig` - Contient les régions, grappes et lots du serveur
- `initializeServerData()` - Fonction pour initialiser les données par défaut

## Utilisation future

Une fois la migration appliquée et les données initialisées, le système utilisera:

1. **Régions du serveur** au lieu des constantes `REGIONS`
2. **Grappes du serveur** au lieu des calculs dynamiques basés sur `GRAPPE_COUNT`
3. **Lots du serveur** au lieu des constantes statiques A, B, C

Cela permettra:
- Une gestion centralisée des régions, grappes et lots
- La possibilité d'ajouter/modifier des régions sans code
- La persistance des modifications dans PostgreSQL
- Le partage de la configuration entre utilisateurs