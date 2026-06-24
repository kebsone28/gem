# GED OS — Documentation Maître (v1.0 — Juin 2026)

> Ce fichier est la **référence unique et authoritative** de la plateforme GED OS.
> Il remplace tous les fichiers `.md` épars du projet.
> **Dernière mise à jour** : 21 juin 2026 — Post-audit complet + suppression Agriculture/Santé.

---

## Table des Matières

1. [Vision & Identité](#1-vision--identité)
2. [Architecture Technique](#2-architecture-technique)
3. [Environnement de Développement](#3-environnement-de-développement)
4. [Modules Frontend (34 modules actifs)](#4-modules-frontend-34-modules-actifs)
5. [API Backend — Routes actives](#5-api-backend--routes-actives)
6. [Sécurité & Rôles](#6-sécurité--rôles)
7. [Données Terrain & KoboToolbox](#7-données-terrain--kobotoolbox)
8. [Logistique](#8-logistique)
9. [Finances & Simulations](#9-finances--simulations)
10. [IA & Assistants](#10-ia--assistants)
11. [Déploiement & Ports](#11-déploiement--ports)
12. [Erreurs Connues & Fixes](#12-erreurs-connues--fixes)
13. [Roadmap](#13-roadmap)

---

## 1. Vision & Identité

### Qu'est-ce que GED OS ?

**GED OS** (Gestion Électrification Décentralisée — Operating System) est une **plateforme SaaS métier unifiée** conçue pour orchestrer de A à Z les grands projets d'infrastructure, d'électrification rurale et de travaux publics en Afrique.

C'est le **système d'exploitation numérique** de PROQUELEC : au lieu d'utiliser 15 logiciels différents, tout — du devis à la réception des travaux, du camion au technicien sur le terrain — est centralisé en un seul endroit.

### Périmètre actuel (Juin 2026)

| Domaine | Statut |
|---|---|
| ⚡ Électrification rurale | ✅ En production (50 000+ ménages Sénégal) |
| 🔋 Haute Tension & Solaire | ✅ Actif |
| 🚛 Logistique | ✅ Actif |
| 📋 Missions Terrain | ✅ Actif |
| 💰 Finances & Simulation | ✅ Actif |
| 📄 Gestion Documentaire (Sharedoc) | ✅ Actif |
| 🤖 IA & Assistant | ✅ Actif |
| 🌾 Agriculture | ❌ **Supprimé** (Juin 2026) |
| 🏥 Santé | ❌ **Supprimé** (Juin 2026) |

---

## 2. Architecture Technique

### Vue d'ensemble

```
GED OS
├── Frontend (React + Vite + TypeScript)          → http://localhost:8889
│   ├── src/core/          ← Kernel, sécurité, routage
│   ├── src/modules/       ← 34 modules métier autonomes (DDD)
│   ├── src/components/    ← UI partagée (Sidebar, Layout, TopBar…)
│   ├── src/services/      ← Appels API, logique client
│   ├── src/contexts/      ← Contextes React (Auth, Projet, Thème…)
│   └── src/hooks/         ← Hooks réutilisables
│
├── Backend (Node.js + Express + Prisma)          → http://localhost:8888
│   ├── src/api/routes/    ← Routes API RESTful
│   ├── src/modules/       ← 28 modules métier backend (contrôleurs)
│   ├── src/services/      ← Logique métier
│   ├── src/domain-adapters/ ← Pattern adaptateur multi-domaine
│   ├── src/middleware/    ← Auth, CORS, Rate Limit, Tenant…
│   └── src/core/          ← Config, Prisma, sécurité
│
└── Base de Données (PostgreSQL + PostGIS)
    └── ORM: Prisma
```

### Alias de Chemins Frontend (vite.config.ts / tsconfig.app.json)

| Alias | Résolution |
|---|---|
| `@` | `src/` |
| `@core/*` | `src/core/*` |
| `@modules/*` | `src/modules/*` |
| `@components/*` | `src/components/*` |
| `@hooks/*` | `src/hooks/*` |
| `@services/*` | `src/services/*` |
| `@contexts/*` | `src/contexts/*` |
| `@utils/*` | `src/utils/*` |
| `@shared/*` | `src/shared/*` |

> [!IMPORTANT]
> **Règle absolue** : Toujours utiliser les alias absolus pour les imports inter-modules.  
> Utiliser des chemins relatifs **uniquement** pour les imports internes à un même module.

### Middleware Backend (ordre de montage)

```
1. Helmet (sécurité headers)
2. CORS (config dynamique)
3. express.json() — parser + rawBody pour /api/kobo/webhook
4. cookieParser
5. compression
6. Rate limiter global (1000/15min, désactivé en DEV)
7. Rate limiter auth (10/15min, désactivé en DEV)
8. Morgan (logs HTTP)
9. paginationMiddleware
10. requestTimingMiddleware
11. tenantResolver (AsyncLocalStorage — org/projet courant)
12. domainContext (injecte l'adapter domaine actif)
```

---

## 3. Environnement de Développement

### Prérequis

- Node.js ≥ 20
- PostgreSQL avec extension **PostGIS**
- Redis (pour BullMQ — files de traitement)

### Ports Réservés (GED OS Port Contract)

| Service | Port | Configurable ? |
|---|---|---|
| Backend API | **8888** | Non (contractuel) |
| Frontend Dev | **8889** | Non (contractuel) |
| Frontend Preview | **8890** | Non (contractuel) |

> [!WARNING]
> Ne jamais changer ces ports sans mettre à jour **les deux** `.env` (frontend et backend) et le validateur `scripts/validate-ged-os-ports.mjs`.

### Commandes Essentielles

```bash
# Démarrer tout (frontend + backend) avec validation des ports
npm run dev:saas

# Frontend seul
cd frontend && npm run dev

# Backend seul
cd backend && npm run dev

# Vérifier la compilation TypeScript (0 erreur attendu)
cd frontend && npx tsc --noEmit

# Build de production (compile les 3875 modules)
cd frontend && npm run build

# Prisma
npx prisma generate       # Régénérer le client
npx prisma migrate dev    # Appliquer les migrations en dev
npx prisma studio         # Interface visuelle de la DB
```

### Variables d'Environnement Clés

**Backend (`.env`)**
```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
KOBO_API_TOKEN=...
SUPER_ADMIN_EMAIL=admin@proquelec.sn    # Mode "God" — impersonation
FRONTEND_URL=http://localhost:8889
```

**Frontend (`.env`)**
```env
VITE_API_URL=http://localhost:8888/api
VITE_SUPER_ADMIN_EMAIL=admin@proquelec.sn   # Déverrouille le God Mode
```

---

## 4. Modules Frontend (34 modules actifs)

Chaque module est auto-déclaré via son fichier `manifest.ts` et enregistré dans `src/core/kernel/registry.ts`.

### Catégories de Navigation (CATEGORY_ORDER)

Les modules sont groupés et affichés dans la Sidebar selon cet ordre :

| Catégorie | Modules |
|---|---|
| `EXECUTIVE` | Dashboard, KPIs, Indicateurs |
| `PROJECTS` | Portefeuille projets, Bordereau |
| `OPERATIONS` | Terrain, Missions, Logistique, MES |
| `RESOURCES` | Planning, Formation, Atelier |
| `QUALITY` | Approbation, Vérification, PV Automation |
| `FINANCE` | Charges, Simulation, Cahier de bord |
| `DOCUMENTS` | Sharedoc |
| `SECTORS` | KoboToolbox, Kobo Mapping, GED OS Collect |
| `GOVERNANCE` | Organisation, Communication |
| `ADMIN` | Utilisateurs, Sécurité, IA Config, Admin Agent |
| `UTILITAIRE` | Paramètres, Diagnostic, Aide |

### Inventaire Complet (34 modules)

| Clé | Chemin | Description |
|---|---|---|
| `home` | `modules/home` | Page d'accueil / landing interne |
| `dashboard` | `modules/dashboard` | Tableau de bord exécutif |
| `simulation` | `modules/simulation` | Simulation financière de projets |
| `charges` | `modules/charges` | Gestion des charges & dépenses |
| `bordereau` | `modules/bordereau` | Bordereau de livraison |
| `cahier` | `modules/cahier` | Cahier de bord terrain |
| `sharedoc` | `modules/sharedoc` | Gestion documentaire (GED) |
| `pv_automation` | `modules/pv_automation` | Génération automatique de PV signés |
| `terrain` | `modules/terrain` | Carte interactive, missions terrain |
| `communication` | `modules/communication` | Messagerie interne |
| `planning` | `modules/planning` | Planning des ressources |
| `formation` | `modules/formation` | Formation des équipes |
| `logistique` | `modules/logistique` | Parc auto, stocks, livraisons |
| `atelier` | `modules/atelier` | Gestion de l'atelier mécanique |
| `approval` | `modules/approval` | Workflow d'approbation (avec signature) |
| `mission` | `modules/mission` | Création et suivi d'ordres de mission |
| `modules` | `modules/modules` | Vue admin des modules activés |
| `users` | `modules/users` | Gestion des utilisateurs (Admin) |
| `diagnostic` | `modules/diagnostic` | Diagnostic santé de l'application |
| `kobo_terminal` | `modules/kobo_terminal` | Terminal KoboToolbox |
| `ged_os_toolbox` | `modules/ged_os_toolbox` | Boîte à outils GED OS |
| `ged_os_collect` | `modules/ged_os_collect` | Collecte de données terrain |
| `organization` | `modules/organization` | Paramètres de l'organisation |
| `settings` | `modules/settings` | Paramètres utilisateur |
| `security` | `modules/security` | Sécurité & accès |
| `ai_config` | `modules/ai_config` | Configuration des IA |
| `admin_agent` | `modules/admin_agent` | Gestion des agents IA locaux |
| `kobo_mapping` | `modules/kobo_mapping` | Mapping des formulaires Kobo |
| `project_creation` | `modules/project_creation` | Création de projet (Admin) |
| `project_edit` | `modules/project_edit` | Édition d'un projet |
| `help` | `modules/help` | Centre d'aide |
| `login` | `modules/login` | Page de connexion |
| `mission_verification` | `modules/mission_verification` | Vérification des missions |
| `mes` | `modules/mes` | Module MES (Mise en Service) |

---

## 5. API Backend — Routes actives

Toutes les routes sont préfixées par `/api`.

| Préfixe | Module Backend | Description |
|---|---|---|
| `/api/auth` | `auth` | Login, logout, refresh token, impersonation |
| `/api/users` | `user` | CRUD utilisateurs |
| `/api/projects` | `project` | CRUD projets, analytics, bordereau |
| `/api/project-templates` | `projectTemplate` | Gabarits de projets |
| `/api/households` | `household` | Ménages ciblés |
| `/api/logistics` | `logistics` | Logistique (véhicules, stocks) |
| `/api/zones` | `zone` | Zones géographiques |
| `/api/kpi` | `kpi` | Indicateurs de performance |
| `/api/teams` | `team` | Équipes terrain |
| `/api/simulation` | `simulation` | Simulation financière |
| `/api/monitoring` | `monitoring` | Santé système |
| `/api/geo` | `geo` | Données géospatiales (PostGIS) |
| `/api/kobo` | `kobo` | Intégration KoboToolbox (webhook) |
| `/api/upload` | `upload` | Upload de fichiers (S3/local) |
| `/api/missions` | `mission` | Ordres de mission |
| `/api/organization` | `organization` | Organisation multi-tenant |
| `/api/sizing` | `sizing` | Dimensionnement électrique |
| `/api/ai` | `assistant` | IA MissionSage & Assistant |
| `/api/formations` | `formation` | Gestion des formations |
| `/api/approvals` | `approval` | Workflow d'approbation |
| `/api/alerts` | `alerts` | Système d'alertes |
| `/api/chat` | `chat` | Messagerie temps réel (Socket.IO) |
| `/api/pvs` | `pv` | Procès-verbaux |
| `/api/toolbox` | `toolbox` | Formulaires GED OS Toolbox |
| `/api/sharedoc` | `sharedoc` | Gestion documentaire |
| `/api/mes` | `mes` | Mise en service (MES) |
| `/api/sync` | `sync` | Synchronisation offline |
| `/api/admin` | `adminPermissions` | Permissions admin |
| `/api/system` | `system` | Health check, métriques |
| `/api/debug` | `debug` | Routes de debug (DEV seulement) |
| `/health` | — | Health check système (Railway) |
| `/api/ping` | — | Ping basique (Railway + monitoring) |

---

## 6. Sécurité & Rôles

### Système de Rôles (RBAC)

| Rôle | Description | Accès |
|---|---|---|
| `SUPER_ADMIN` | Administrateur système global | Tout, y compris le "God Mode" |
| `ADMIN_PROQUELEC` | Admin de l'organisation PROQUELEC | Tous les projets de l'org |
| `CHEF_PROJET` | Chef de projet | Son(s) projet(s) assigné(s) |
| `TECHNICIEN` | Technicien terrain | Lectures + saisie terrain |
| `COMPTABLE` | Comptable | Finances uniquement |
| `LOGISTICIEN` | Responsable logistique | Logistique, stocks |
| `VIEWER` | Lecture seule | Consultation |

### God Mode (Impersonation Super Admin)

La variable `SUPER_ADMIN_EMAIL` dans les `.env` frontend et backend déverrouille la possibilité pour un Super Admin de "prendre le contrôle" de n'importe quel compte utilisateur pour voir exactement son interface. Cette fonctionnalité est journalisée en audit.

### Multi-Tenant

Chaque organisation est isolée via :
1. **`tenantResolver`** middleware — résout `organizationId` depuis le JWT et le place dans AsyncLocalStorage.
2. Toutes les queries Prisma filtrent par `organizationId`.
3. Le `domainContext` middleware injecte l'adaptateur de domaine approprié selon le type de projet.

---

## 7. Données Terrain & KoboToolbox

### Flux de données

```
Formulaire KoboToolbox (mobile, hors-ligne)
        ↓
  Synchronisation WiFi/4G
        ↓
  Webhook KoboToolbox → POST /api/kobo/webhook
        ↓
  toolbox.controller.js — traitement + matching ménages
        ↓
  PostgreSQL + PostGIS (coordonnées GPS des ménages)
        ↓
  MapLibre GL JS (carte vectorielle interactive côté frontend)
```

### Erreur Connue : `function st_makepoint(unknown, unknown) does not exist`

**Cause** : L'extension PostGIS n'est pas activée sur la base de données, ou les coordonnées GPS remontées par Kobo sont `null` / invalides (ex : soumission sans GPS).

**Fix** :
```sql
-- Activer PostGIS (à faire une seule fois sur la DB)
CREATE EXTENSION IF NOT EXISTS postgis;
```
Les soumissions Kobo sans coordonnées GPS sont ignorées sans planter le serveur (le code logue `Skipped` dans ce cas).

### Stratégie d'Upsert Kobo

Lors d'une synchronisation :
1. Le système cherche d'abord un ménage existant par `koboId`.
2. Si trouvé → UPDATE (mise à jour des données).
3. Si non trouvé → INSERT (nouveau ménage).
4. Les erreurs individuelles sont loguées mais n'arrêtent pas la synchronisation globale.

---

## 8. Logistique

Le module logistique gère :
- **Parc automobile** : véhicules, affectations, maintenance
- **Stocks** : câbles, compteurs, matériel
- **Bons de livraison** : traçabilité des sorties de stock
- **Équipes** : affectation des équipes terrain par zone/grappe

### Routes Backend

- `GET /api/logistics` — Liste des éléments logistiques
- `POST /api/logistics` — Créer un mouvement/bon
- `GET /api/teams` — Équipes disponibles
- `GET /api/teams/regions` — Équipes par région
- `POST /api/teams/:id/assign` — Affecter une équipe à une zone

---

## 9. Finances & Simulations

### Module Simulation

Calcule la rentabilité prévisionnelle d'un projet avant démarrage :
- Coûts matériaux (câbles, compteurs, pylônes)
- Coûts main d'œuvre
- Frais logistiques
- Marge bénéficiaire estimée

### Module Charges

Suivi des dépenses réelles du projet :
- Saisie des factures et charges
- Comparaison budget prévu vs. réel
- Alertes de dépassement

### Module Bordereau

Bordereau de livraison / de travaux :
- Récapitulatif quantitatif des travaux réalisés
- Export PDF pour facturation client

### Module PV Automation

Génération automatique des procès-verbaux de réception :
- Remplissage des modèles Word/PDF avec données du projet
- Signature numérique via `SignatureModal`
- Envoi par email / archivage dans Sharedoc

---

## 10. IA & Assistants

### MissionSage (IA Principale)

**Mission Sage** est l'IA intégrée de GED OS, un assistant contextuel qui :
- Répond aux questions sur les projets et les données terrain
- Aide à la rédaction de rapports de mission
- Analyse les données Kobo pour détecter des anomalies
- Génère des suggestions de planification

**Route** : `POST /api/ai/chat`

### Chatbot Public (GED OS Platform Guide)

Un chatbot de présentation de la plateforme accessible sans authentification, conçu pour les démos clients. Utilise un dictionnaire de Q/R statiques avec un fallback vers l'IA.

### Configuration IA (Module `ai_config`)

Interface admin pour configurer :
- Modèle IA utilisé (OpenAI, Ollama local, Gemini)
- Température, max tokens
- Connexion Ollama pour inférence 100% locale (conformité RGPD)

---

## 11. Déploiement & Ports

### Infrastructure Cible (Production)

```
Internet → Nginx (reverse proxy)
              ↓            ↓
         Frontend    Backend API
         (port 80)   (port 8888)
              ↓
         PostgreSQL + Redis (internes)
```

### Railway (Hébergement actuel)

- Backend déployé sur Railway.app
- Frontend buildé en statique et servi par Nginx ou Railway
- PostgreSQL managé (Railway Postgres)
- Variables d'environnement gérées dans le dashboard Railway

### Docker

Un `docker-compose.yml` est disponible pour lancer l'environnement complet localement :

```bash
docker-compose up --build
```

---

## 12. Erreurs Connues & Fixes

| Erreur | Cause | Fix |
|---|---|---|
| `function st_makepoint does not exist` | PostGIS non installé sur la DB | `CREATE EXTENSION IF NOT EXISTS postgis;` |
| `Failed to resolve import "..."` | Chemin d'import cassé après refactoring | Utiliser les alias `@modules/`, `@components/`, etc. |
| `RangeError: Invalid time value` | Champ date `null` ou invalide passé à `date-fns` | Wrapper `format()` avec un check `isValid(new Date(val))` |
| `403 Forbidden` sur impersonation | `SUPER_ADMIN_EMAIL` manquant dans `.env` | Ajouter la variable dans les deux fichiers `.env` |
| `Error applying submission: Code 42883` | GPS null dans soumission Kobo | Soumission ignorée — pas de plantage. Activer PostGIS pour les valeurs valides. |
| Import `../common/SignatureModal` | Ancienne route relative après déplacement du module | Utiliser `@components/common/SignatureModal` |
| Import `../../modules/mission/...` | Ancienne route relative dans un fichier de module terrain | Utiliser `@modules/mission/...` |

---

## 13. Roadmap

### ✅ Complété (Mai — Juin 2026)

- [x] Architecture DDD / Clean Architecture (séparation modules)
- [x] Alias de chemins absolus dans tout le codebase (213 fichiers migrés)
- [x] Navigation centralisée (CATEGORY_ORDER, CATEGORY_METADATA)
- [x] Sidebar dynamique avec groupement par catégories
- [x] TopBar avec Breadcrumbs hiérarchiques
- [x] Registre de legacy routes (redirections transparentes)
- [x] Suppression des domaines Agriculture et Santé
- [x] Module Sharedoc (GED) : upload, visualisation, suppression
- [x] Fix du God Mode (Super Admin Email)
- [x] Build de production 100% propre (3 875 modules, 0 erreur)

### 🎯 Prochaines Priorités

- [ ] **Accueil Exécutif** (`/executive/dashboard`) — Vue 360° de l'organisation avec KPIs globaux
- [ ] **Portefeuille Projets amélioré** (`/projects/:id`) — Dashboard projet complet
- [ ] **Fix PostGIS** — Script de migration pour activer PostGIS en production
- [ ] **Tests automatisés** — Couverture des routes critiques (auth, missions, bordereau)
- [ ] **Optimisation des bundles** — Code splitting plus agressif (maplibre = 1 Go non compressé)

---

*Document généré automatiquement par analyse du codebase GED OS — 21 juin 2026*
*Ne pas modifier manuellement — regénérer via l'assistant si nécessaire.*
