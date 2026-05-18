# Guide d'utilisation - GED OS MES

## Table des matières

1. [Présentation](#présentation)
2. [Accès au module](#accès-au-module)
3. [Interface principale](#interface-principale)
4. [Gestion des enregistrements MES](#gestion-des-enregistrements-mes)
5. [Import/Export Excel](#importexport-excel)
6. [Contrôle qualité](#contrôle-qualité)
7. [Statistiques](#statistiques)
8. [Filtrage et recherche](#filtrage-et-recherche)
9. [Bonnes pratiques](#bonnes-pratiques)

---

## Présentation

**GED OS MES** (Mise en Service) est le module de gestion des mises en service électriques de GEM SAAS. Il permet de suivre l'ensemble du processus de branchement et de pose de compteurs, depuis la réception de l'avis Senelec jusqu'à la facturation.

### Fonctionnalités principales

- **Suivi complet** des mises en service (avis, compteur, poste, zone)
- **Géolocalisation** GPS des interventions
- **Contrôle qualité** avec checklist
- **Import/Export Excel** pour les rapports mensuels
- **Statistiques** en temps réel
- **Multi-prestataires** (PROQUELEC, UMSAT, AUTRE)
- **Workflow** en 8 étapes

---

## Accès au module

### Depuis le menu principal

1. Connectez-vous à GEM SAAS
2. Cliquez sur le menu **Admin** dans la barre latérale
3. Sélectionnez **GED OS MES** dans la catégorie **ÉNERGIE**

### URL directe

```
http://localhost:8889/admin/mes
```

### Permissions requises

- `UI_MAP` - Accès à la carte et aux modules
- `mes.create` - Création d'enregistrements
- `mes.update` - Modification d'enregistrements
- `mes.delete` - Suppression d'enregistrements
- `mes.validate` - Validation des enregistrements
- `mes.control` - Contrôle qualité
- `mes.import` - Import Excel
- `mes.export` - Export Excel

---

## Interface principale

### Vue d'ensemble

L'interface principale se compose de:

1. **Barre de statistiques** - Résumé des indicateurs clés
2. **Barre de filtres** - Filtres pour affiner les résultats
3. **Tableau des enregistrements** - Liste des MES
4. **Barre d'actions** - Actions rapides

### Statistiques affichées

- **Total MES** - Nombre total d'enregistrements
- **Validées** - MES validées (statut VALIDE)
- **En cours** - MES en cours de traitement
- **Pose Mono** - Poses monophasées
- **Pose Tri** - Poses triphasées
- **Taux de conformité** - Pourcentage de MES conformes

---

## Gestion des enregistrements MES

### Créer un nouvel enregistrement

1. Cliquez sur le bouton **Nouvelle MES** dans la barre d'actions
2. Remplissez le formulaire avec les informations requises:

#### Informations obligatoires

- **Numéro d'avis** - Numéro unique de l'avis Senelec
- **Numéro de compteur** - Numéro du compteur installé
- **Poste** - Nom du poste électrique
- **Zone** - Zone géographique
- **Type** - MONO (monophasé) ou TRI (triphasé)
- **Nature** - POSE ou BRANCHEMENT_POSE
- **Agent** - Nom de l'agent technique
- **Date** - Date de l'intervention
- **Prestataire** - PROQUELEC, UMSAT ou AUTRE

#### Informations optionnelles

- **Câble** - Type de câble utilisé
- **CT70** - Cochez si CT70 requis
- **PA** - Cochez si Protection Automatique
- **Observations** - Notes sur l'intervention
- **GPS** - Coordonnées GPS (latitude, longitude)
- **Photos** - URLs des photos avant/après
- **Signature client** - Signature numérique du client

3. Cliquez sur **Enregistrer**

### Modifier un enregistrement

1. Cliquez sur l'enregistrement à modifier dans le tableau
2. Modifiez les champs nécessaires
3. Cliquez sur **Enregistrer**

### Supprimer un enregistrement

1. Cliquez sur l'enregistrement à supprimer
2. Cliquez sur **Supprimer**
3. Confirmez la suppression

### Mettre à jour le statut

Les statuts disponibles sont:

1. **RECU** - Avis reçu, en attente de programmation
2. **PROGRAMME** - Intervention programmée
3. **EN_COURS** - Intervention en cours
4. **REALISE** - Intervention terminée
5. **CONTROLE** - En attente de contrôle qualité
6. **VALIDE** - Contrôle validé
7. **FACTURE** - Facture générée
8. **PAYE** - Facture payée

Pour changer le statut:

1. Sélectionnez l'enregistrement
2. Cliquez sur le menu déroulant du statut
3. Choisissez le nouveau statut
4. Sauvegardez

---

## Import/Export Excel

### Import depuis Excel

1. Cliquez sur le bouton **Import Excel** dans la barre d'actions
2. Sélectionnez votre fichier Excel
3. Le système importera automatiquement les données

#### Format Excel attendu

Le fichier Excel doit contenir les colonnes suivantes:

| Colonne | Description | Exemple |
|---------|-------------|---------|
| Avis | Numéro d'avis Senelec | AVS-2024-001 |
| Compteur | Numéro de compteur | CPT-123456 |
| Poste | Nom du poste | POSTE-01 |
| Zone | Zone géographique | ZONE-A |
| Type | MONO ou TRI | MONO |
| Nature | POSE ou BRANCHEMENT_POSE | POSE |
| Cable | Type de câble | 16mm² |
| CT70 | true/false | true |
| PA | true/false | false |
| Agent | Nom de l'agent | Agent Alpha |
| Date | Date de l'intervention | 2024-05-18 |
| Observations | Notes | Installation standard |
| Prestataire | PROQUELEC, UMSAT ou AUTRE | PROQUELEC |

### Export vers Excel

1. Appliquez les filtres souhaités
2. Cliquez sur le bouton **Export Excel**
3. Le fichier sera téléchargé automatiquement

L'export inclut tous les enregistrements visibles dans le tableau.

---

## Contrôle qualité

### Effectuer un contrôle

1. Sélectionnez une MES avec le statut **REALISE**
2. Cliquez sur **Contrôler**
3. Remplissez la checklist:

#### Checklist de contrôle

- **Compteur fixe** - Le compteur est correctement fixé
- **Coupe-circuit** - Le coupe-circuit est installé
- **Raccordement** - Les raccordements sont conformes
- **Conformité zone** - L'installation respecte les normes de la zone
- **Photos valides** - Les photos sont claires et complètes

4. Ajoutez des observations si nécessaire
5. Cliquez sur **Valider le contrôle**

Le statut passera automatiquement à **CONTROLE** si conforme, ou restera à **REALISE** si non conforme.

### Valider une MES

1. Sélectionnez une MES avec le statut **CONTROLE**
2. Cliquez sur **Valider**
3. Confirmez la validation

Le statut passera à **VALIDE** et la MES pourra être facturée.

---

## Statistiques

### Indicateurs disponibles

Les statistiques sont calculées en temps réel et affichées dans la barre supérieure:

- **Total MES** - Nombre total d'enregistrements
- **Pose Mono** - Nombre de poses monophasées
- **Pose Tri** - Nombre de poses triphasées
- **Branchement + Pose Mono** - Branchements avec pose monophasée
- **Branchement + Pose Tri** - Branchements avec pose triphasée
- **En cours** - MES en cours de traitement
- **Réalisées** - MES terminées
- **Contrôlées** - MES contrôlées
- **Validées** - MES validées
- **Taux de conformité** - Pourcentage de MES conformes

### Filtres temporels

Les statistiques peuvent être filtrées par:
- **Mois** - Sélectionnez un mois spécifique
- **Prestataire** - Filtrez par prestataire

---

## Filtrage et recherche

### Filtres disponibles

1. **Prestataire** - PROQUELEC, UMSAT, AUTRE ou Tous
2. **Statut** - Filtrez par statut de la MES
3. **Mois** - Sélectionnez un mois spécifique
4. **Zone** - Filtrez par zone géographique
5. **Poste** - Filtrez par poste électrique

### Recherche textuelle

Utilisez la barre de recherche pour trouver:
- Numéro d'avis
- Numéro de compteur
- Zone
- Nom de l'agent

La recherche est insensible à la casse.

### Réinitialiser les filtres

Cliquez sur le bouton **Réinitialiser** pour effacer tous les filtres et afficher tous les enregistrements.

---

## Bonnes pratiques

### Gestion des avis

- **Unicité** - Chaque numéro d'avis doit être unique
- **Format** - Utilisez un format cohérent (ex: AVS-YYYY-XXX)
- **Vérification** - Vérifiez toujours le numéro d'avis avant création

### Géolocalisation

- **Précision** - Utilisez des coordonnées GPS précises
- **Format** - Latitude entre -90 et 90, Longitude entre -180 et 180
- **Outil** - Utilisez l'outil de géolocalisation intégré si disponible

### Photos

- **Avant/Après** - Prenez toujours des photos avant et après l'intervention
- **Qualité** - Assurez-vous que les photos sont claires et lisibles
- **Stockage** - Les photos sont stockées sous forme d'URLs

### Contrôle qualité

- **Checklist** - Remplissez systématiquement toute la checklist
- **Observations** - Documentez toute non-conformité
- **Validation** - Ne validez que les MES conformes

### Import/Export

- **Sauvegarde** - Exportez régulièrement les données
- **Format** - Respectez le format Excel attendu pour l'import
- **Vérification** - Vérifiez toujours les données après import

### Sécurité

- **Permissions** - Gérez les permissions selon les rôles
- **Audit** - Toutes les actions sont tracées dans les logs
- **Suppression** - Utilisez la suppression logique (deletedAt)

---

## Dépannage

### Problèmes fréquents

#### Erreur "Numéro d'avis déjà utilisé"

- **Cause** - Un enregistrement avec le même numéro d'avis existe déjà
- **Solution** - Vérifiez si l'enregistrement existe déjà ou utilisez un numéro différent

#### Import Excel échoue

- **Cause** - Format du fichier incorrect ou colonnes manquantes
- **Solution** - Vérifiez le format du fichier et les colonnes requises

#### Statut ne change pas

- **Cause** - Permissions insuffisantes ou workflow incorrect
- **Solution** - Vérifiez vos permissions et suivez l'ordre des statuts

#### GPS non enregistré

- **Cause** - Coordonnées invalides ou hors plage
- **Solution** - Vérifiez les coordonnées GPS (lat: -90 à 90, lng: -180 à 180)

---

## Support

Pour toute question ou problème technique:

1. Consultez ce guide d'utilisation
2. Vérifiez les logs système
3. Contactez l'équipe technique

---

## Version

- **Module**: GED OS MES
- **Version**: 1.0.0
- **Date**: Mai 2026
- **Auteur**: GEM SAAS

---

*Ce guide est mis à jour régulièrement. Consultez la version la plus récente pour les dernières fonctionnalités.*
