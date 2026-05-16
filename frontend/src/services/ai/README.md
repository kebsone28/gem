# 🧠 Système IA GED OS - Documentation

## Vue d'ensemble

Le système IA GED OS est une architecture centralisée et orchestrée qui gère toutes les interactions IA dans l'application GED OS SAAS. Il permet l'auto-amélioration basée sur les interactions utilisateur et l'enrichissement automatique des réponses avec des métadonnées techniques.

## Architecture

### Composants Principaux

```
┌─────────────────────────────────────────────────────────────┐
│                      GedOsAiCore                              │
│              (Cerveau Centralisé de l'IA)                   │
├─────────────────────────────────────────────────────────────┤
│  • MissionSageService     (Moteurs RULES + Claude)          │
│  • ResponseEnricher       (Enrichissement automatique)      │
│  • AutoTrainingSystem     (Auto-entraînement)               │
│  • ReferentialTypes       (Types enrichis)                  │
└─────────────────────────────────────────────────────────────┘
```

## Fichiers Principaux

### Services IA

| Fichier | Description |
|---------|-------------|
| `GedOsAiCore.ts` | Cerveau centralisé qui orchestre tous les services IA |
| `MissionSageService.ts` | Moteur d'IA avec fallback RULES → Claude |
| `responseEnricher.ts` | Enrichissement automatique des réponses (références, risques, étapes) |
| `autoTrainingSystem.ts` | Système d'auto-entraînement basé sur les interactions |
| `referentialTypes.ts` | Types enrichis pour les référentiels techniques |
| `mentorTrainingService.ts` | Gestion des entrées d'entraînement manuelles |

### Composants UI

| Fichier | Description |
|---------|-------------|
| `AutoTrainingPanel.tsx` | Panneau d'administration pour l'auto-entraînement |
| `MessageBubble.tsx` | Bulle de message avec feedback utilisateur et métadonnées enrichies |
| `GedOsAiChat.tsx` | Composant de chat IA intégré avec GedOsAiCore |

### Pages

| Fichier | Description |
|---------|-------------|
| `AdminAIConfig.tsx` | Page d'administration complète du système IA |

### Hooks

| Fichier | Description |
|---------|-------------|
| `useGedOsAiCore.ts` | Hooks React pour utiliser GedOsAiCore dans les composants |

## Types Enrichis

### Domaines Techniques
- `projet_mfr` - Projets ménages à faible revenu
- `installation_interieur` - Installations intérieures
- `branchement_senelec` - Branchement SENELEC
- `protection_electrique` - Protection électrique
- `anomalies` - Anomalies détectées
- `glossaire` - Glossaire technique
- `specifications` - Spécifications techniques
- `normes` - Normes et standards
- `kobo` - Terrain Kobo
- `finance` - Finance
- `mission` - Missions

### Types de Réponse Enrichie
- `VerdictType` - Conforme, Conforme sous réserve, Non conforme, A vérifier
- `SeverityType` - Critique, Majeure, Mineure, Information
- `ReferenceCitee` - Références normatives citées
- `RisqueIdentifie` - Risques identifiés avec mitigation
- `EtapeProcedure` - Étapes de procédure numérotées
- `DefinitionTechniqueEnrichie` - Définitions techniques enrichies
- `FicheControleTerrain` - Fiche de contrôle terrain

## Fonctionnalités

### 1. Enrichissement Automatique des Réponses

Le système enrichit automatiquement chaque réponse IA avec:
- **Domaine technique** détecté à partir des mots-clés
- **Références normatives** (NS 01-001, Guide MFR, etc.)
- **Risques identifiés** avec descriptions et mitigations
- **Étapes de procédure** extraites des réponses numérotées
- **Métadonnées de contexte** (rôle utilisateur, module actif)
- **Méta-informations** (confiance, sources, version, date)

### 2. Auto-Entraînement

Le système s'améliore automatiquement grâce à:

#### Feedback Utilisateur
- Enregistrement des réactions (positif/négatif/neutre)
- Calcul du taux de satisfaction
- Génération de suggestions basées sur les feedbacks négatifs fréquents

#### Détection de Patterns
- Analyse des bigrammes dans les requêtes
- Identification des patterns fréquents
- Génération de suggestions basées sur les patterns

#### Validation Croisée Moteurs
- Comparaison des réponses RULES vs Claude
- Détection des divergences significatives
- Génération de suggestions pour les cas de divergence

#### Minage de Référentiels
- Génération automatique de Q/R à partir des référentiels techniques
- Questions pré-définies pour les domaines clés
- Confiance élevée (95%) car basée sur des référentiels officiels

#### Métriques d'Apprentissage
- Calcul des métriques journalières
- Tendances hebdomadaires
- Tableau de bord global avec indicateurs clés

### 3. Configuration Centralisée

La page d'administration (`/admin/ai-config`) permet de:
- Activer/désactiver l'auto-entraînement
- Activer/désactiver l'enrichissement des réponses
- Activer/désactiver les métriques d'apprentissage
- Activer/désactiver le feedback utilisateur
- Configurer le nombre maximum de suggestions
- Configurer le seuil de confiance

**Accès réservé aux admins master** (ADMIN_PROQUELEC ou master admin email)

## Utilisation

### Dans un composant React

```typescript
import { useGedOsAiCore } from '../../hooks/useGedOsAiCore';

function MonComposant() {
  const { processRequest, isThinking, lastResponse } = useGedOsAiCore();

  const handleQuery = async (query: string) => {
    const response = await processRequest(query, {
      enableEnrichment: true,
      enableTraining: true,
      domain: 'branchement_senelec',
    });
    console.log(response.response);
  };

  return (
    <button onClick={() => handleQuery("Comment brancher Senelec?")}>
      Envoyer
    </button>
  );
}
```

### Pour le chat IA

```typescript
import { useGedOsAiChat } from '../../hooks/useGedOsAiCore';

function ChatComponent() {
  const { sendMessage, isThinking, lastResponse } = useGedOsAiChat(context);

  const handleSend = async (message: string) => {
    await sendMessage(message);
  };

  // Afficher la réponse enrichie avec métadonnées
  if (lastResponse) {
    console.log('Domaine:', lastResponse.domaine);
    console.log('Références:', lastResponse.referencesCitees);
    console.log('Risques:', lastResponse.risquesIdentifies);
  }
}
```

### Pour le feedback utilisateur

```typescript
import { useGedOsAiCore } from '../../hooks/useGedOsAiCore';

function FeedbackComponent() {
  const { recordFeedback } = useGedOsAiCore();

  const handleFeedback = async (rating: 'positive' | 'negative') => {
    await recordFeedback(query, response, rating, user);
  };
}
```

### Dans MessageBubble

```typescript
<MessageBubble
  response={response}
  onFeedback={(rating) => recordFeedback(query, response, rating, user)}
/>
```

## Configuration

### Configuration GedOsAiCore

```typescript
const config = {
  enableAutoTraining: true,        // Activer l'auto-entraînement
  enableResponseEnrichment: true,  // Activer l'enrichissement
  enableLearningMetrics: true,     // Activer les métriques
  enableUserFeedback: true,        // Activer le feedback utilisateur
  maxTrainingSuggestions: 50,      // Max suggestions générées
  confidenceThreshold: 0.7,        // Seuil de confiance
};

const core = getGedOsAiCore(config);
```

## Base de Données

### Tables

| Table | Description |
|-------|-------------|
| `ai_learning_logs` | Logs des requêtes IA |
| `user_feedback` | Feedbacks utilisateur sur les réponses |

### Schéma

```typescript
// ai_learning_logs
{
  id?: number;
  query: string;
  userId: string;
  role: string;
  timestamp: number;
}

// user_feedback
{
  id?: number;
  query: string;
  response: string;
  rating: 'positive' | 'negative' | 'neutral';
  userId: string;
  role: string;
  timestamp: number;
  reason?: string;
  improvedAnswer?: string;
}
```

## Sécurité

- **Accès restreint**: La page d'administration `/admin/ai-config` est accessible uniquement aux admins master
- **Validation des permissions**: Vérification via `isMasterAdminEmail` et rôle `ADMIN_PROQUELEC`
- **Protection des routes**: Garde de route `MasterAdminRoute` dans App.tsx

## Performances

- **Lazy loading**: Les composants lourds sont chargés à la demande
- **Optimisation des requêtes**: Utilisation de hooks React pour éviter les re-renders inutiles
- **Mise en cache**: GedOsAiCore utilise le pattern Singleton pour une instance unique
- **Détection automatique**: L'enrichissement est conditionnel et optimisé

## Extensions Possibles

1. **Analyse de sentiments avancée**: Utiliser NLP pour mieux comprendre les feedbacks
2. **Apprentissage par renforcement**: Implémenter un système de rewards pour l'IA
3. **Export des métriques**: Permettre l'export des données d'apprentissage
4. **A/B testing**: Tester différentes configurations d'enrichissement
5. **Intégration Vision**: Améliorer l'analyse d'images avec des métadonnées enrichies

## Maintenance

### Surveillance

- Surveiller le taux de satisfaction (objectif > 80%)
- Surveiller le nombre de fallbacks (objectif < 10%)
- Surveiller le nombre de suggestions générées

### Amélioration Continue

- Analyser régulièrement les feedbacks négatifs
- Mettre à jour les référentiels techniques
- Ajuster les seuils de confiance
- Ajouter de nouveaux domaines techniques

## Support

Pour toute question ou problème concernant le système IA:
1. Consulter la documentation de chaque fichier
2. Vérifier les logs dans la console du navigateur
3. Vérifier les métriques dans `/admin/ai-config`

## Version

- **Version actuelle**: 10.0
- **Date**: Mai 2026
- **Auteur**: Cascade AI System
