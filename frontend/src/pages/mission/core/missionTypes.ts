/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
export interface MissionMember {
  name: string;
  role: string;
  unit: string;
  dailyIndemnity: number;
  days: number;
}

export interface MissionPhoto {
  id: string;
  data?: string; // Base64 (optional if using url)
  url?: string;  // Server URL
  comment: string;
  timestamp: string;
}

export interface MissionReportDay {
  day: number;
  title: string;
  detail?: string; // Détail de l'étape du planning
  observation: string;
  notes: string;
  isCompleted: boolean;
  photos: MissionPhoto[]; // Plusieurs photos par étape
  location?: { lat: number; lng: number };
}

export interface BrandingConfig {
  logo?: string; // Base64
  primaryColor?: [number, number, number];
  secondaryColor?: [number, number, number];
  organizationName?: string;
  footerText?: string;
}

export interface MissionOrderData {
  orderNumber: string;
  date: string;
  region: string;
  startDate: string;
  endDate: string;
  itineraryAller: string;
  itineraryRetour: string;
  purpose: string;
  transport: string;
  members: MissionMember[];
  planning: string[]; // 6-day itinerary
  reportDays?: MissionReportDay[];
  reportObservations?: string;
  reportingMode?: 'daily' | 'narrative';
  narrativeReport?: string;
  isCertified?: boolean;
  isSubmitted?: boolean;
  signatureImage?: string; // Base64 string
  features?: {
    map: boolean;
    expenses: boolean;
    inventory: boolean;
    ai: boolean;
  };
  expenses?: Record<string, unknown>[];
  fuelStats?: {
    kmStart: number;
    kmEnd: number;
    rate: number;
  };
  inventory?: Record<string, unknown>[];
  branding?: BrandingConfig;
  createdBy?: string;
  creatorId?: string;
  integrityHash?: string;
  version?: number; // ✅ AJOUT
  data?: Record<string, unknown>; // ✅ AJOUT pour compatibilité sync
  id?: string; // ✅ AJOUT pour compatibilité word generator
}

export type MissionStatus = 'idle' | 'saving' | 'error' | 'success';

export interface AuditEntry {
  id: string;
  action: string;
  author: string;
  timestamp: string;
  details?: string;
  diff?: Record<string, unknown>;
}

export interface MissionState {
  // Data
  formData: Partial<MissionOrderData>;
  members: MissionMember[];
  currentMissionId: string | null;

  // Metadata & Sync (Industrialized Phase 2)
  version: number;
  updatedAt: string | null;
  lastSyncedAt: string | null;
  status: MissionStatus;
  isSyncing: boolean;
  isSyncingServer: boolean;
  syncStatus: 'synced' | 'pending' | 'failed';
  offlineQueue: Record<string, unknown>[];

  // Granular Dirty Tracking
  dirty: {
    form: boolean;
    members: boolean;
    planning: boolean;
  };

  // Audit & Workflow
  auditTrail: AuditEntry[];
  activeTab: 'prep' | 'report' | 'approval';
  isSimplifiedMode: boolean;
  isCertified: boolean;
  isSubmitted: boolean;
  lastSavedAt: string | null;
}

export type MissionAction =
  | { type: 'SET_FORM_DATA'; payload: Partial<MissionOrderData> }
  | { type: 'UPDATE_FORM_FIELD'; payload: { field: keyof MissionOrderData; value: unknown } }
  | { type: 'ADD_MEMBER'; payload: MissionMember }
  | { type: 'UPDATE_MEMBER'; index: number; payload: Partial<MissionMember> }
  | { type: 'REMOVE_MEMBER'; index: number }
  | { type: 'SET_STATUS'; payload: MissionStatus }
  | { type: 'FORCE_PUSH'; payload: Record<string, unknown> } // ✅ FIX: added payload
  | { type: 'RETRY_SYNC'; payload: Record<string, unknown> } // ✅ FIX: added payload
  | { type: 'OFFLINE_SAVE'; payload: Record<string, unknown> } // ✅ FIX: added payload
  | {
      type: 'LOAD_MISSION';
      payload: {
        id: string | null;
        data: Partial<MissionOrderData>;
        members: MissionMember[];
        version?: number;
        updatedAt?: string;
        auditTrail?: AuditEntry[];
      };
    }
  | {
      type: 'RESET_MISSION';
      payload: {
        orderNumber: string;
        date: string;
        planning: string[];
        createdBy?: string;
        creatorId?: string;
      };
    }
  | { type: 'SET_ACTIVE_TAB'; payload: 'prep' | 'report' | 'approval' }
  | { type: 'SET_SIMPLIFIED_MODE'; payload: boolean }
  | { type: 'SET_CERTIFIED'; payload: boolean }
  | { type: 'SET_SUBMITTED'; payload: boolean }
  | { type: 'CLEAR_DIRTY'; payload?: keyof MissionState['dirty'] }
  | { type: 'SET_SYNC_STATUS'; payload: MissionState['syncStatus'] }
  | {
      type: 'ADD_AUDIT_ENTRY';
      payload: { action: string; author: string; details?: string; diff?: Record<string, unknown> };
    };

export const KAFFRINE_TEMPLATE = `# RAPPORT DE MISSION TERRAIN

## Projet de Raccordement Électrique LSE – Région de Kaffrine

### Période : du 08 au 13 Avril

### Mission : Dakar → Kaffrine → Dakar

---

## 1. Objet de la mission

Dans le cadre du projet de raccordement électrique LSE, une mission de terrain a été effectuée dans la région de Kaffrine du 08 au 13 avril, avec pour objectif principal d’évaluer l’état d’avancement du réseau, d’échanger avec les autorités locales, d’identifier les contraintes terrain et de préparer le déploiement opérationnel des travaux.

Cette mission a également permis de recueillir des informations concrètes sur les ménages, les installations existantes, ainsi que sur les ressources locales mobilisables pour la mise en œuvre du projet.

---

## 2. Localités visitées et situation du réseau

La mission a couvert les villages suivants :

### 1. Nguane Villane

Chef de village : El Hadji Samba Thiombane
Tél : 78 614 86 17
Situation réseau : presque finalisé
Accord : favorable au stockage du matériel chez lui

### 2. Lodoyéle

Chef de village : Moussa Ba
Tél : 78 157 83 65
Situation réseau : presque finalisé
Accord : favorable au stockage

### 3. Cassa Wally Ndour

Chef de village : Waly Ndour
Tél : 77 262 67 46
Situation réseau : presque finalisé
Accord : chef absent, mais son fils confirme leur disponibilité pour le stockage

### 4. Cassa Dierry

Chef de village : Sassy Sow
Tél : 78 116 80 64
Situation réseau : presque finalisé
Accord : favorable au stockage

### 5. Sangole Peulh

Chef de village : Amadou Ka
Tél : 77 929 23 56
Situation réseau : presque finalisé
Accord : favorable au stockage

### 6. Sangole Wolof

Chef de village : Abdoulaye Wilane
Tél : 77 592 85 14 / 70 492 85 14
Situation réseau : presque finalisé
Accord : favorable au stockage

### 7. Wandé

Chef de village : Djibril Diop
Tél : non disponible
Situation réseau : presque finalisé
Accord : favorable au stockage

### 8. Mbabanéne

Chef de village : Ismaila Ndao
Tél : 77 413 04 08
Tél fils : 77 416 50 03
Situation réseau : presque finalisé
Accord : favorable au stockage

### 9. Ngaba

Chef de village : Moustapha Ka
Tél : 78 207 07 57
Responsable magasin : Moussa Ndao
Situation réseau : en cours, presque finalisé
Accord : favorable au stockage

### 10. Cassas Djéguéne

Chef de village : El Hadji Djéguéne
Tél : 77 363 83 69
Situation réseau : presque finalisé
Accord : favorable au stockage

### 11. Sorokhogne

Chef de village : Taha Sine
Tél : 77 635 67 73
Adjoint : Ibou Sine – 78 500 42 40
Situation réseau : presque finalisé
Accord : favorable au stockage

### 12. Diguelé

Chef de village : Saliou Segnane
Tél : 77 679 62 20
Situation réseau : presque finalisé
Accord : favorable au stockage

### 13. Ndoth

Chef de village : Babacar Badiane
Tél : 77 329 49 64
Situation réseau : presque finalisé
Accord : favorable au stockage

---

## 3. Situation des ménages et observations terrain

Les villages présentent une diversité importante de types d’habitat :

* Maisons en dur
* Constructions en banco
* Habitations en paille, parfois avec clôtures également en paille

Un élément marquant observé sur le terrain est que beaucoup de ménages n’ont pas attendu le projet pour s’alimenter en électricité.

Selon les échanges avec les populations, cela s’explique par :

* La durée jugée longue du processus de ciblage
* Un manque d’information sur le projet
* Le sentiment d’avoir été oubliés

En conséquence, plusieurs ménages ont déjà réalisé des installations par leurs propres moyens.

Cependant, ces installations présentent des risques :

* Utilisation majoritaire de câbles 2,5 mm²
* Pose dans des tubes orange
* Modes de pose non conventionnels

Certains ménages sollicitent aujourd’hui la reprise des travaux, conscients des limites techniques et des risques associés à leurs installations actuelles.

Par ailleurs, la configuration du territoire est caractérisée par une longue artère principale, le long de laquelle les villages sont dispersés sur plusieurs kilomètres, ce qui complexifie l’organisation des interventions.

---

## 4. Acteurs locaux rencontrés

### Réseau d’électriciens (via Mr Bamba Ndao – 75 550 78 66)

Après imprégnation du dossier, deux groupes d’électriciens ont été identifiés :

**Groupe 1 :**
Babacar Diouf
Rawane Cissé
Moustapha Diouf
Pa Djiby Ndao
Cheikh Diouf
Ismaïla Sall
Pape Sall
Alsane Vilane
Omar Thiobane

**Groupe 2 :**
Dame Ndao – 78 540 58 00
Ousmane Ly
Momath Ndao
Cheikhou Thiobane
Ibou Ndimbelane
Moustapha Ba
Ousmane Mergane

---

### Entrepreneurs disponibles

Certains entrepreneurs ont manifesté leur intérêt pour accompagner les travaux :

* Serigne Bouna Counta – 77 568 06 82
* Moustapha Cissé – 77 714 97 935

---

## 5. Ressources locales

### Usine de briques de Kaffrine

Propriétaire : Mr Oumar Cissé
Tél : 77 579 77 49

Les briques observées sont de très bonne qualité.
Le technicien indique qu’il s’agit de briques en béton noir, plus résistantes mais légèrement plus chères que celles en béton blanc.

Le propriétaire a exprimé le besoin d’une confirmation du programme afin d’anticiper sa production.
Par ailleurs, Mr Bamba Ndao a également formulé une offre dans ce sens.

---

## 6. Relations institutionnelles

Une rencontre a eu lieu avec le chef d’agence SENELEC de Kaffrine afin de l’informer du projet.

Celui-ci a :

* Posé des questions sur le projet
* Indiqué ne pas avoir été informé de la présence des équipes lors des audits précédents

---

## 7. Analyse des risques et problématiques

La mission met en évidence plusieurs points de vigilance :

* Difficulté à déterminer le nombre exact de ménages bénéficiaires
* Présence importante de ménages déjà installés
* Risque de retards liés à la recherche de ménages de substitution
* Problèmes potentiels de conformité technique

Cela soulève des questions importantes :

* Quel sort sera réservé aux ménages déjà installés ?
* Les habitations en paille doivent-elles être exclues si non conformes aux normes ?
* Comment traiter les ménages techniquement éloignés du réseau ?

---

## 8. Situation actuelle des demandes d’abonnement

De nombreux ménages ont déjà déposé des demandes d’abonnement auprès de ERA.

Pour anticiper les risques, il serait pertinent que :

* LES, via ERA, bloque temporairement ces demandes
* PROQUELEC valide les installations avant toute mise sous tension

Cela permettrait d’éviter :

* L’activation d’installations dangereuses
* L’utilisation de matériel inadapté

---

## 9. Stratégie de déploiement proposée

Le déploiement pourra s’appuyer sur une organisation par village (grappe) :

* Stockage du matériel chez le chef de village ou dans un point stratégique
* Présence d’une équipe de gestion sur place

### Organisation des équipes :

* Gestionnaire de stock
* Livreur
* Contrôleur

### Workflow proposé :

1. Intervention des maçons (construction et implantation des potelets)
2. Passage des équipes réseau et installations intérieures
3. Suivi et appui logistique par les contrôleurs
4. Contrôle final après finalisation complète

Il est essentiel de finaliser le réseau avant validation globale afin d’éviter des retards dans le paiement des électriciens.

Une attention particulière devra être portée à l’évitement des goulots d’étranglement.

---

## 10. Application de gestion du projet

Une application dédiée a été développée pour assurer la gestion globale du projet.

### Fonctionnalités :

* Visualisation des ménages sur carte avec statut :

  * Non installé
  * Réseau terminé
  * Installation intérieure terminée
  * Conforme / non conforme

* Accès aux cahiers de charge

* Suivi de l’avancement des travaux

* Génération automatique :

  * Ordres de mission
  * Rapports
  * Simulations techniques et financières

Chaque utilisateur dispose d’un compte avec des droits spécifiques selon son rôle.

---

## 11. Conclusion

La mission a permis de constater que le projet bénéficie d’un environnement globalement favorable, avec un réseau presque finalisé et une bonne collaboration des autorités locales.

Cependant, la présence de nombreux ménages déjà équipés, les incertitudes sur le ciblage et les contraintes techniques observées introduisent des risques importants pour la mise en œuvre.

Dans ce contexte, il apparaît indispensable de :

* Définir clairement les critères d’éligibilité
* Encadrer les installations existantes
* Anticiper les contraintes logistiques
* Structurer rigoureusement le déploiement

La réussite du projet dépendra fortement de la capacité à gérer ces éléments dès les premières phases opérationnelles.
`;
