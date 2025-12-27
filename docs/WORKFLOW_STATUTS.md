# Workflow Séquentiel d'Électrification

Pour respecter la logique séquentielle (Murs → Réseau → Intérieur → Réception), voici la structure de statuts recommandée.

## 1. Les Nouveaux Statuts

Nous allons utiliser un système de préfixe numérique pour trier facilement :

| Étape | Statut Système | Libellé Affiché | Couleur |
|-------|----------------|-----------------|---------|
| **0. Départ** | `Non débuté` | ⚪ Non débuté | Gris |
| **1. Maçonnerie** | `Murs: En cours` | 🧱 Murs : En cours | Orange |
| | `Murs: Terminé` | 🧱 Murs : Terminé | Bleu |
| **2. Réseau** | `Réseau: En cours` | ⚡ Réseau : En cours | Orange |
| | `Réseau: Terminé` | ⚡ Réseau : Terminé | Bleu |
| **3. Intérieur** | `Intérieur: En cours` | 💡 Intérieur : En cours | Orange |
| | `Intérieur: Terminé` | 💡 Intérieur : Terminé | Bleu |
| **4. Final** | `Réception: Validée` | ✅ Réception : Validée | Vert |
| **Incident** | `Problème` | ⚠️ Problème | Rouge |

## 2. Changements à faire

### A. Interface (`terrain.html`)
Remplacer les 3 boutons simples par une **Timeline Verticale** ou des **Boutons d'Étape** qui permettent de faire avancer le ménage dans le processus.

### B. Logique (`terrain_main.js`)
- Mettre à jour les couleurs (`getStatusColor`)
- Mettre à jour les filtres :
  - **À faire** : `Non débuté`
  - **En cours** : Tous les statuts `En cours` + `Terminé` (intermédiaires)
  - **Terminé** : Seulement `Réception: Validée`

Je vais maintenant implémenter cette logique dans l'interface.
