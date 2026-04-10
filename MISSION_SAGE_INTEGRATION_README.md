# MissionSage - Intégration IA dans GEM-MINT

## Vue d'ensemble

MissionSage est l'assistant IA intelligent intégré au système GEM-MINT de PROQUELEC, conçu pour assister les utilisateurs dans leurs tâches quotidiennes liées à l'électrification de masse.

## Fonctionnalités

### Contexte Métier Intégré
- **PROQUELEC**: Expertise en électrification sénégalaise
- **Normes NS 01-001**: Respect des standards pour installations BT ≤1000V
- **Kobo Collect**: Intégration avec la collecte de données terrain
- **Workflow OM**: Gestion complète des Ordres de Mission

### Capacités Techniques
- Réponses contextuelles basées sur le rôle utilisateur
- Accès aux statistiques système en temps réel
- Base de connaissances techniques intégrée
- Réponses structurées et professionnelles

## Architecture

### Services
- `MissionSageService`: Service principal d'orchestration IA
- `AIEngineConfig`: Configuration des providers IA

### Composants
- `MissionSageChat`: Interface de chat React

### Configuration
- Provider par défaut: `PUBLIC_POLLINATIONS`
- Support pour OpenAI et Anthropic (extensible)

## Utilisation

### Intégration dans un composant React

```tsx
import { MissionSageChat, MissionSageService } from './src';

// Dans votre composant
const user = {
  role: 'ADMIN_PROQUELEC',
  displayName: 'John Doe',
  email: 'john@proquelec.sn'
};

const state = {
  stats: {
    totalMissions: 150,
    totalCertified: 120,
    totalHouseholds: 2500
  }
};

// Utilisation directe du service
const response = await MissionSageService.getInstance()
  .processQuery('Comment créer une mission OM?', user, state);

// Ou utilisation du composant
<MissionSageChat user={user} state={state} />
```

### Test de l'intégration

```bash
cd frontend
node test_integration_js.mjs
```

## Contexte Métier Inclus

### Rôles Utilisateur
- ADMIN_PROQUELEC
- CHEF_PROJET
- TECHNICIEN
- DG (Directeur Général)

### Statistiques Système
- Nombre total de missions
- Missions certifiées
- Ménages collectés
- Indemnités totales

### Règles Métier Clés
- Coffret compteur en limite propriété (hublot à 1.60m)
- Câbles enterrés 0.5m sous grillage rouge
- Protection PVC obligatoire
- Interdiction poteaux bois pourris

### Base Technique
- Partie active vs Masse
- DDR (dispositif de coupure fuite terre)
- PE (prise terre)
- Sections câble standard

## Tests Validés

✅ IA publique fonctionnelle avec contexte métier
✅ Réponses structurées et précises
✅ Intégration TypeScript/React complète
✅ Code linté et conforme aux standards

## Prochaines Étapes

1. **Intégration UI**: Ajouter MissionSageChat à l'interface principale
2. **Persistance**: Sauvegarder l'historique des conversations
3. **Analytics**: Suivre l'utilisation et la satisfaction
4. **Multilingue**: Support pour le wolof si nécessaire
5. **Offline**: Mode hors ligne avec règles statiques

## Maintenance

- Les prompts sont enrichis automatiquement avec le contexte utilisateur
- Configuration centralisée via `AIEngineConfig`
- Tests automatisés disponibles pour validation
- Architecture extensible pour nouveaux providers IA