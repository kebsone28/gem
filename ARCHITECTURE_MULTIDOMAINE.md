# Architecture Multidomaine GED OS

Ce document détaille la nouvelle architecture multidomaine (Kernel v2) de GED OS. Il sert de référence pour comprendre comment le système est architecturé pour passer d'un simple produit d'électrification à une plateforme globale (Agriculture, Santé, Logistique, etc.).

## 1. Philosophie & Principes

GED OS fonctionne désormais comme un "Système d'Exploitation" métier :
- **Kernel Frontend** : Un noyau dur minimal, responsable du routage, de la sécurité (IAM) et de la communication inter-modules.
- **Domain Adapters Backend** : Un modèle abstrait (Adapter Pattern) permettant d'unifier le traitement des données provenant de multiples domaines métiers très hétérogènes.
- **Modules Plug-and-Play** : Chaque domaine est un module indépendant qui s'enregistre auprès du Kernel.

## 2. Architecture Frontend : Le Kernel & EventBus

Le monolithe historique a été décomposé. L'intelligence ne réside plus dans les vues, mais dans le Kernel et le bus d'événements.

### 2.1 L'EventBus (`core/events/EventBus.ts`)

L'EventBus est le système nerveux central de GED OS. Il implémente le pattern Publisher/Subscriber de manière fortement typée.

**Pourquoi un EventBus ?**
Pour découpler les modules. Si le module "Terrain" se met à jour, il n'a pas besoin de connaître l'existence du module "Logistique". Il se contente de crier `TERRAIN_DATA_UPDATED`. Le module Logistique, s'il est intéressé, écoute ce signal pour rafraîchir ses stocks.

**Exemple d'utilisation :**
```tsx
import { useEventBus } from '../hooks/useEventBus';

// Abonnement (dans un composant React)
useEventBus('MISSION_CREATED', (event) => {
  console.log('Nouvelle mission :', event.payload.missionId);
});

// Émission
const { emit } = useEventBus();
emit('STOCK_ALERT', { item: 'Câble ABC', qty: 0 }, 'logistique');
```

### 2.2 Le Kernel Orchestrator (`core/events/KernelOrchestrator.ts`)

Le KernelOrchestrator est le "cerveau" réactif. C'est ici que sont définies les règles métier transversales.
Par exemple : *Règle : Quand une `MISSION_CREATED` est émise, vérifier si une alerte de type `STOCK_ALERT` doit être générée*.

## 3. Architecture Backend : Domain Adapters

En base de données, nous gérons désormais de multiples entités (Ménages/Infrastructures, Parcelles agricoles, Centres de santé). Pour éviter d'écrire des dizaines de `if (domain === 'agriculture')` partout dans nos contrôleurs, nous utilisons le pattern **DomainAdapter**.

### 3.1 L'Interface `DomainAdapter`

Chaque domaine doit implémenter cette interface (`backend/src/domain-adapters/DomainAdapter.ts`) :

```typescript
export interface DomainAdapter {
  domainType: string;
  normalizeEntity(rawData: any): Promise<NormalizedEntity>;
  validateEntity(entity: any): ValidationError[];
  deriveStatus(entity: any): string;
  generateAlerts(entity: any): Alert[];
  getEntityFields(): string[];
  getOptimalQueryShape(): Record<string, any>;
}
```

### 3.2 Le Factory Pattern (`DomainAdapterFactory.ts`)

Le Factory enregistre tous les adapters au démarrage. Le contrôleur (ou le service) demande l'adapter approprié en fonction du contexte de la requête.

```typescript
const adapter = DomainAdapterFactory.getAdapter(req.domainConfig.domainType);

// Peu importe le domaine, la logique métier reste la même :
const validationErrors = adapter.validateEntity(data);
const alerts = adapter.generateAlerts(data);
```

## 4. Configuration par Domaine : `DomainConfig`

Chaque organisation (tenant) peut configurer la manière dont un domaine se comporte via la table Prisma `DomainConfig`.

```prisma
model DomainConfig {
  id                String    @id @default(uuid())
  organizationId    String
  domainType        String    // "electricity" | "high_voltage" | "solar" | "agriculture" | "health" | "logistics" | "targeting" | "data_collection"
  entityFields      Json      // Champs personnalisés à afficher/requêter
  statusEnum        String[]  // Cycle de vie (ex: ['prepared', 'planted', 'harvested'])
  // ...
}
```
Cette configuration est injectée automatiquement dans chaque requête API via le middleware `domainContext.ts`.

## 5. Guide : Ajouter un Nouveau Domaine (en 2h)

Imaginons que nous voulions ajouter un domaine "Éducation" (suivi des écoles).

### Étape 1 : Base de données (Backend)
1. Créer le modèle Prisma (`School` par exemple).
2. Lancer `npx prisma migrate dev`.

### Étape 2 : Adapter (Backend)
1. Créer `backend/src/domain-adapters/adapters/EducationAdapter.ts` implémentant `DomainAdapter`.
2. Définir `deriveStatus()` (ex: 'open', 'closed', 'understaffed').
3. Définir `generateAlerts()` (ex: alerte si nb d'élèves par classe > 60).
4. L'enregistrer dans `DomainAdapterFactory.ts`.

### Étape 3 : Module (Frontend)
1. Créer un dossier `frontend/src/modules/education/`.
2. Créer le `manifest.ts` (déclaration de la route `/education`, icône "Book").
3. Créer la vue principale (`views/EducationDashboard.tsx`).
4. Utiliser le composant générique `<EntityLayer domainType="education" />` pour la cartographie.

### Étape 4 : Événements (Optionnel)
S'il y a des intéractions, ajouter un type d'événement dans `EventBus.ts` (ex: `SCHOOL_INCIDENT`) et l'émettre depuis le module.

---
**GED OS v2.0 - Plateforme Intelligente Multidomaine**
